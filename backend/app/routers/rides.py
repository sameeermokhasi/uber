from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import or_, and_
from typing import List, Optional
import math

from app.database import get_db
from app.models import User, Ride, DriverProfile, RideStatus, UserRole
from app.schemas import RideCreate, RideResponse, RideUpdate, RideRating, LocationUpdate
from app.auth import get_current_active_user
from app.websocket import manager

router = APIRouter()

def calculate_fare(distance_km: float, vehicle_type: str) -> float:
    """Calculate ride fare based on distance and vehicle type"""
    base_fare = {
        "economy": 50,
        "premium": 100,
        "suv": 120,
        "luxury": 200
    }
    
    per_km_rate = {
        "economy": 10,
        "premium": 15,
        "suv": 18,
        "luxury": 25
    }
    
    base = base_fare.get(vehicle_type, 50)
    rate = per_km_rate.get(vehicle_type, 10)
    
    return base + (distance_km * rate)

def calculate_distance(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    """Calculate distance between two coordinates using Haversine formula"""
    R = 6371  # Earth's radius in kilometers
    
    lat1_rad = math.radians(lat1)
    lat2_rad = math.radians(lat2)
    delta_lat = math.radians(lat2 - lat1)
    delta_lng = math.radians(lng2 - lng1)
    
    a = math.sin(delta_lat/2)**2 + math.cos(lat1_rad) * math.cos(lat2_rad) * math.sin(delta_lng/2)**2
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1-a))
    
    return R * c

def find_nearby_drivers(db: Session, pickup_lat: float, pickup_lng: float, max_distance_km: float = 3.0) -> List[User]:
    """Find drivers within specified distance of pickup location"""
    # Get all available drivers with location data
    drivers = db.query(User).join(DriverProfile).filter(
        and_(
            User.role == UserRole.DRIVER,
            User.is_active == True,
            DriverProfile.is_available == True,
            DriverProfile.current_lat != None,
            DriverProfile.current_lng != None
        )
    ).all()
    
    nearby_drivers = []
    for driver in drivers:
        if driver.driver_profile:
            distance = calculate_distance(
                pickup_lat, pickup_lng,
                driver.driver_profile.current_lat,
                driver.driver_profile.current_lng
            )
            if distance <= max_distance_km:
                nearby_drivers.append(driver)
    
    return nearby_drivers


@router.post("/", response_model=RideResponse, status_code=status.HTTP_201_CREATED)
async def create_ride(
    ride_data: RideCreate,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Create a new ride request"""
    if str(current_user.role) != UserRole.RIDER.value:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only riders can create ride requests"
        )
    
    # Calculate distance
    distance = calculate_distance(
        float(ride_data.pickup_lat), float(ride_data.pickup_lng),
        float(ride_data.destination_lat), float(ride_data.destination_lng)
    )
    
    # Calculate estimated fare
    estimated_fare = calculate_fare(distance, ride_data.vehicle_type.value)
    
    # Estimate duration (assuming average speed of 40 km/h)
    duration = int((distance / 40) * 60)
    
    new_ride = Ride(
        rider_id=current_user.id,
        pickup_address=ride_data.pickup_address,
        pickup_lat=float(ride_data.pickup_lat),
        pickup_lng=float(ride_data.pickup_lng),
        destination_address=ride_data.destination_address,
        destination_lat=float(ride_data.destination_lat),
        destination_lng=float(ride_data.destination_lng),
        vehicle_type=ride_data.vehicle_type,
        distance_km=distance,
        duration_minutes=duration,
        estimated_fare=estimated_fare,
        scheduled_time=ride_data.scheduled_time
    )
    
    db.add(new_ride)
    db.commit()
    db.refresh(new_ride)
    
    # Find nearby drivers within 3km
    nearby_drivers = find_nearby_drivers(
        db, 
        float(ride_data.pickup_lat), 
        float(ride_data.pickup_lng), 
        max_distance_km=3.0
    )
    
    # Send WebSocket notification to nearby drivers
    for driver in nearby_drivers:
        # Refresh the driver to get actual values
        db.refresh(driver)
        try:
            await manager.send_personal_message({
                "type": "new_ride_request",
                "ride_id": new_ride.id,
                "pickup_address": new_ride.pickup_address,
                "destination_address": new_ride.destination_address,
                "distance_km": round(float(str(new_ride.distance_km or 0)), 2),
                "estimated_fare": round(float(str(new_ride.estimated_fare or 0)), 2),
                "vehicle_type": str(new_ride.vehicle_type.value) if new_ride.vehicle_type is not None else "economy"
            }, int(str(driver.id)) if driver.id is not None else 0)
        except Exception as e:
            print(f"Failed to send WebSocket message to driver {driver.id}: {e}")
    
    return new_ride

@router.get("/", response_model=List[RideResponse])
async def get_rides(
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
    status: Optional[str] = None
):
    """Get rides for current user"""
    query = db.query(Ride)
    
    if str(current_user.role) == UserRole.RIDER.value:
        query = query.filter(Ride.rider_id == current_user.id)
    elif str(current_user.role) == UserRole.DRIVER.value:
        query = query.filter(
            or_(
                Ride.driver_id == current_user.id,
                and_(
                    Ride.status == RideStatus.PENDING,
                    Ride.id.in_(
                        db.query(Ride.id)
                        .join(User, Ride.rider_id == User.id)
                        .join(DriverProfile, User.id == DriverProfile.user_id)
                        .filter(
                            DriverProfile.user_id == current_user.id,
                            DriverProfile.is_available == True,
                            DriverProfile.current_lat != None,
                            DriverProfile.current_lng != None
                        )
                    )
                )
            )
        )
    
    if status:
        query = query.filter(Ride.status == status)
    
    rides = query.order_by(Ride.created_at.desc()).all()
    return rides

@router.get("/available", response_model=List[RideResponse])
async def get_available_rides(
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Get available rides for drivers"""
    print(f"=== GET AVAILABLE RIDES DEBUG ===")
    print(f"Current user ID: {current_user.id}")
    print(f"Current user email: {current_user.email}")
    print(f"Current user role: {current_user.role}")
    print(f"Current user role type: {type(current_user.role)}")
    print(f"Expected driver role: {UserRole.DRIVER}")
    print(f"Expected driver value: {UserRole.DRIVER.value}")
    print(f"Role comparison result: {str(current_user.role) != UserRole.DRIVER.value}")
    
    # Fix the role comparison - it was checking for NOT equal
    if str(current_user.role) != UserRole.DRIVER.value:
        print(f"Role check failed. User is not a driver.")
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only drivers can view available rides"
        )
    
    # Check if driver is available and has location
    driver_profile = db.query(DriverProfile).filter(
        DriverProfile.user_id == current_user.id
    ).first()
    
    print(f"Driver profile found: {driver_profile is not None}")
    if driver_profile:
        print(f"Driver is available: {driver_profile.is_available}")
        print(f"Driver has location: {driver_profile.current_lat is not None and driver_profile.current_lng is not None}")
    
    if not driver_profile or str(driver_profile.is_available) != 'True':
        print("Driver not available or profile not found, returning empty list")
        return []  # Return empty list if driver is not available
    
    if driver_profile.current_lat is None or driver_profile.current_lng is None:
        print("Driver location not set, returning empty list")
        return []  # Return empty list if driver location is not set
    
    # Get rides within 3km of driver's current location
    rides_query = db.query(Ride).filter(
        Ride.status == RideStatus.PENDING,
        Ride.driver_id == None
    )
    
    rides = []
    for ride in rides_query.all():
        distance = calculate_distance(
            float(str(ride.pickup_lat)), float(str(ride.pickup_lng)),
            float(str(driver_profile.current_lat)), float(str(driver_profile.current_lng))
        )
        if distance <= 3.0:  # Within 3km
            rides.append(ride)
    
    print(f"Found {len(rides)} available rides")
    print("=== END GET AVAILABLE RIDES DEBUG ===")
    return rides

@router.get("/{ride_id}", response_model=RideResponse)
async def get_ride(
    ride_id: int,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Get a specific ride"""
    ride = db.query(Ride).filter(Ride.id == ride_id).first()
    
    if not ride:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Ride not found"
        )
    
    # Check authorization
    if str(current_user.role) == UserRole.RIDER.value and str(ride.rider_id) != str(current_user.id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to view this ride"
        )
    elif str(current_user.role) == UserRole.DRIVER.value and str(ride.driver_id) != str(current_user.id):
        if str(ride.status) != RideStatus.PENDING.value:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Not authorized to view this ride"
            )
    
    return ride

@router.patch("/{ride_id}", response_model=RideResponse)
async def update_ride(
    ride_id: int,
    ride_update: RideUpdate,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Update ride status"""
    ride = db.query(Ride).filter(Ride.id == ride_id).first()
    
    if not ride:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Ride not found"
        )
    
    # Handle driver accepting ride
    if str(ride_update.status) == RideStatus.ACCEPTED.value and str(current_user.role) == UserRole.DRIVER.value:
        if str(ride.status) != RideStatus.PENDING.value:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Ride is not available"
            )
        ride.driver_id = current_user.id
        ride.status = str(RideStatus.ACCEPTED.value)
    
    # Handle cancellation
    elif str(ride_update.status) == RideStatus.CANCELLED.value:
        if str(current_user.role) == UserRole.RIDER.value and str(ride.rider_id) != str(current_user.id):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Not authorized"
            )
        ride.status = str(RideStatus.CANCELLED.value)
    
    # Handle ride completion
    elif str(ride_update.status) == RideStatus.COMPLETED.value:
        if str(current_user.role) == UserRole.DRIVER.value and str(ride.driver_id) == str(current_user.id):
            ride.status = str(RideStatus.COMPLETED.value)
            if ride_update.final_fare:
                ride.final_fare = float(str(ride_update.final_fare))
            else:
                ride.final_fare = float(str(ride.estimated_fare))
            
            # Update driver stats
            driver_profile = db.query(DriverProfile).filter(
                DriverProfile.user_id == current_user.id
            ).first()
            if driver_profile:
                driver_profile.total_rides = int(str(driver_profile.total_rides)) + 1
        else:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Not authorized"
            )
    
    db.commit()
    db.refresh(ride)
    
    # Send WebSocket notification to rider
    if str(ride_update.status) in [RideStatus.ACCEPTED.value, RideStatus.IN_PROGRESS.value, RideStatus.COMPLETED.value, RideStatus.CANCELLED.value]:
        await manager.send_personal_message({
            "type": "ride_status_update",
            "ride_id": ride.id,
            "status": str(ride.status.value)
        }, int(str(ride.rider_id)) if ride.rider_id is not None else 0)
    
    return ride

@router.post("/{ride_id}/rate", response_model=RideResponse)
async def rate_ride(
    ride_id: int,
    rating_data: RideRating,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Rate a completed ride"""
    ride = db.query(Ride).filter(Ride.id == ride_id).first()
    
    if not ride:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Ride not found"
        )
    
    if str(ride.rider_id) != str(current_user.id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to rate this ride"
        )
    
    if str(ride.status) != RideStatus.COMPLETED.value:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Can only rate completed rides"
        )
    
    ride.rating = int(str(rating_data.rating))
    ride.feedback = rating_data.feedback
    
    # Update driver rating
    if ride.driver_id is not None:
        driver_profile = db.query(DriverProfile).filter(
            DriverProfile.user_id == ride.driver_id
        ).first()
        if driver_profile:
            # Calculate new average rating
            total_rated_rides = db.query(Ride).filter(
                Ride.driver_id == ride.driver_id,
                Ride.rating != None
            ).count()
            
            total_rating = db.query(Ride).filter(
                Ride.driver_id == ride.driver_id,
                Ride.rating != None
            ).with_entities(Ride.rating).all()
            
            avg_rating = sum([int(str(r[0])) for r in total_rating]) / total_rated_rides if total_rated_rides > 0 else 5.0
            driver_profile.rating = float(str(round(avg_rating, 2)))
    
    db.commit()
    db.refresh(ride)
    
    return ride

@router.delete("/{ride_id}", status_code=status.HTTP_204_NO_CONTENT)
async def cancel_ride(
    ride_id: int,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Cancel a ride"""
    ride = db.query(Ride).filter(Ride.id == ride_id).first()
    
    if not ride:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Ride not found"
        )
    
    if str(ride.rider_id) != str(current_user.id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to cancel this ride"
        )
    
    if str(ride.status) in [RideStatus.COMPLETED.value, RideStatus.CANCELLED.value]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot cancel this ride"
        )
    
    ride.status = str(RideStatus.CANCELLED.value)
    db.commit()
    
    return None