from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import or_, and_
from typing import List, Optional
import math
from datetime import datetime

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
        if driver.driver_profile and driver.driver_profile.current_lat is not None and driver.driver_profile.current_lng is not None:
            try:
                distance = calculate_distance(
                    pickup_lat, pickup_lng,
                    float(driver.driver_profile.current_lat),
                    float(driver.driver_profile.current_lng)
                )
                if distance <= max_distance_km:
                    nearby_drivers.append(driver)
            except (ValueError, TypeError) as e:
                print(f"Error calculating distance for driver {driver.id}: {e}")
                continue
    
    print(f"Found {len(nearby_drivers)} nearby drivers for pickup at ({pickup_lat}, {pickup_lng})")
    for driver in nearby_drivers:
        print(f"  Driver {driver.id} at ({driver.driver_profile.current_lat}, {driver.driver_profile.current_lng})")
    
    return nearby_drivers


@router.post("/", response_model=RideResponse, status_code=status.HTTP_201_CREATED)
async def create_ride(
    ride_data: RideCreate,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Create a new ride request"""
    if current_user.role.value != UserRole.RIDER.value:
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
    print(f"=== FINDING NEARBY DRIVERS FOR RIDE {new_ride.id} ===")
    print(f"Pickup location: ({ride_data.pickup_lat}, {ride_data.pickup_lng})")
    nearby_drivers = find_nearby_drivers(
        db, 
        float(ride_data.pickup_lat), 
        float(ride_data.pickup_lng), 
        max_distance_km=3.0
    )
    print(f"Found {len(nearby_drivers)} nearby drivers")
    
    # Send WebSocket notification to nearby drivers
    if nearby_drivers:
        print(f"Sending notifications to {len(nearby_drivers)} drivers")
        notification_sent = False
        for driver in nearby_drivers:
            # Refresh the driver to get actual values
            db.refresh(driver)
            try:
                print(f"Sending WebSocket message to driver {driver.id}")
                await manager.send_personal_message({
                    "type": "new_ride_request",
                    "ride_id": new_ride.id,
                    "pickup_address": new_ride.pickup_address,
                    "destination_address": new_ride.destination_address,
                    "distance_km": round(float(new_ride.distance_km or 0), 2),
                    "estimated_fare": round(float(new_ride.estimated_fare or 0), 2),
                    "vehicle_type": new_ride.vehicle_type.value if new_ride.vehicle_type is not None else "economy"
                }, int(driver.id) if driver.id is not None else 0)
                print(f"Successfully sent WebSocket message to driver {driver.id}")
                notification_sent = True
            except Exception as e:
                print(f"Failed to send WebSocket message to driver {driver.id}: {e}")
        
        if not notification_sent:
            print("WARNING: No notifications were successfully sent to drivers!")
    else:
        print("No nearby drivers found to notify")
        # As a fallback, let's also broadcast to all connected drivers
        try:
            print("Broadcasting ride request to all connected drivers as fallback")
            await manager.broadcast({
                "type": "new_ride_request",
                "ride_id": new_ride.id,
                "pickup_address": new_ride.pickup_address,
                "destination_address": new_ride.destination_address,
                "distance_km": round(float(new_ride.distance_km or 0), 2),
                "estimated_fare": round(float(new_ride.estimated_fare or 0), 2),
                "vehicle_type": new_ride.vehicle_type.value if new_ride.vehicle_type is not None else "economy"
            })
            print("Broadcast message sent to all connected drivers")
        except Exception as e:
            print(f"Failed to broadcast ride request: {e}")
    
    return new_ride

@router.get("/", response_model=List[RideResponse])
async def get_rides(
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
    status: Optional[str] = None
):
    """Get rides for current user"""
    query = db.query(Ride)
    
    if current_user.role.value == UserRole.RIDER.value:
        query = query.filter(Ride.rider_id == current_user.id)
    elif current_user.role.value == UserRole.DRIVER.value:
        # For drivers, show their assigned rides (accepted, in_progress, completed)
        # and pending rides that they can accept
        query = query.filter(
            or_(
                Ride.driver_id == current_user.id,
                and_(
                    Ride.status == RideStatus.PENDING,
                    Ride.driver_id == None
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
    print(f"Current user role value: {current_user.role.value}")
    print(f"Expected driver role: {UserRole.DRIVER}")
    print(f"Expected driver value: {UserRole.DRIVER.value}")
    print(f"Role comparison result: {str(current_user.role) == UserRole.DRIVER.value}")
    print(f"Direct comparison: {current_user.role == UserRole.DRIVER}")
    
    # Fix the role comparison - use direct enum comparison
    if current_user.role != UserRole.DRIVER:
        print(f"Role check failed. User is not a driver.")
        print(f"User role: {current_user.role}")
        print(f"User role value: {current_user.role.value}")
        print(f"Expected role value: {UserRole.DRIVER.value}")
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
        if driver_profile.current_lat is not None:
            print(f"Driver lat: {driver_profile.current_lat} (type: {type(driver_profile.current_lat)})")
        if driver_profile.current_lng is not None:
            print(f"Driver lng: {driver_profile.current_lng} (type: {type(driver_profile.current_lng)})")
    
    if not driver_profile:
        print("Driver profile not found, returning empty list")
        return []  # Return empty list if driver profile doesn't exist
    
    # Check if driver is available (convert to boolean properly)
    is_available = driver_profile.is_available
    if isinstance(is_available, str):
        is_available = is_available.lower() == 'true'
    
    print(f"Driver availability check result: {is_available}")
    if not is_available:
        print("Driver not available, returning empty list")
        return []  # Return empty list if driver is not available
    
    if driver_profile.current_lat is None or driver_profile.current_lng is None:
        print("Driver location not set, returning empty list")
        print(f"Current lat: {driver_profile.current_lat}")
        print(f"Current lng: {driver_profile.current_lng}")
        return []  # Return empty list if driver location is not set
    
    # Get rides within 3km of driver's current location
    rides_query = db.query(Ride).filter(
        Ride.status == RideStatus.PENDING,
        Ride.driver_id == None
    )
    
    print(f"Total pending rides in system: {rides_query.count()}")
    
    rides = []
    for ride in rides_query.all():
        try:
            print(f"Checking ride {ride.id}: pickup ({ride.pickup_lat}, {ride.pickup_lng})")
            distance = calculate_distance(
                float(ride.pickup_lat), float(ride.pickup_lng),
                float(driver_profile.current_lat), float(driver_profile.current_lng)
            )
            print(f"Distance to ride {ride.id}: {distance} km")
            if distance <= 3.0:  # Within 3km
                rides.append(ride)
                print(f"Ride {ride.id} added to available list")
        except Exception as e:
            print(f"Error calculating distance for ride {ride.id}: {e}")
            continue
    
    print(f"Found {len(rides)} available rides within 3km")
    for ride in rides:
        print(f"  Ride {ride.id}: {ride.pickup_address} -> {ride.destination_address}")
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
    if current_user.role.value == UserRole.RIDER.value and str(ride.rider_id) != str(current_user.id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to view this ride"
        )
    elif current_user.role.value == UserRole.DRIVER.value and str(ride.driver_id) != str(current_user.id):
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
    print(f"=== DEBUG RIDE UPDATE ===")
    print(f"Ride update status: {ride_update.status}")
    print(f"Ride update status type: {type(ride_update.status)}")
    print(f"Current user role: {current_user.role}")
    print(f"Current user role value: {current_user.role.value}")
    print(f"UserRole.DRIVER.value: {UserRole.DRIVER.value}")
    print(f"Ride current status: {ride.status}")
    print(f"Ride current status value: {ride.status.value}")
    print(f"RideStatus.PENDING.value: {RideStatus.PENDING.value}")
    
    # Handle driver accepting ride
    if ride_update.status == RideStatus.ACCEPTED:
        print("Processing ride acceptance")
        if current_user.role == UserRole.DRIVER:
            print("User is a driver")
            if ride.status == RideStatus.PENDING:
                print("Ride is pending, accepting ride")
                ride.driver_id = current_user.id
                ride.status = RideStatus.ACCEPTED
                print(f"Ride accepted. Driver ID: {ride.driver_id}, Status: {ride.status}")
            else:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Ride is not available for acceptance"
                )
        else:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only drivers can accept rides"
            )
    
    # Handle driver starting ride
    elif ride_update.status == RideStatus.IN_PROGRESS:
        print("Processing ride start")
        if current_user.role == UserRole.DRIVER and str(ride.driver_id) == str(current_user.id):
            print("User is the assigned driver")
            if ride.status == RideStatus.ACCEPTED:
                print("Ride is accepted, starting ride")
                ride.status = RideStatus.IN_PROGRESS
                ride.started_at = datetime.utcnow()
                print(f"Ride started. Status: {ride.status}")
            else:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Ride must be accepted before starting"
                )
        else:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only the assigned driver can start this ride"
            )
    
    # Handle driver completing ride
    elif ride_update.status == RideStatus.COMPLETED:
        print("Processing ride completion")
        if current_user.role == UserRole.DRIVER and str(ride.driver_id) == str(current_user.id):
            print("User is the assigned driver")
            if ride.status == RideStatus.IN_PROGRESS:
                print("Ride is in progress, completing ride")
                ride.status = RideStatus.COMPLETED
                ride.completed_at = datetime.utcnow()
                if ride_update.final_fare:
                    ride.final_fare = float(ride_update.final_fare)
                else:
                    ride.final_fare = float(ride.estimated_fare)
                
                # Update driver stats
                driver_profile = db.query(DriverProfile).filter(
                    DriverProfile.user_id == current_user.id
                ).first()
                if driver_profile:
                    driver_profile.total_rides = int(driver_profile.total_rides) + 1
                print(f"Ride completed. Status: {ride.status}")
            else:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Ride must be in progress before completing"
                )
        else:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only the assigned driver can complete this ride"
            )
    
    # Handle rider cancelling ride or driver rejecting ride
    elif ride_update.status == RideStatus.CANCELLED:
        print("Processing ride cancellation/rejection")
        if current_user.role == UserRole.RIDER and str(ride.rider_id) == str(current_user.id):
            print("User is the rider")
            if ride.status in [RideStatus.PENDING, RideStatus.ACCEPTED]:
                print("Ride can be cancelled")
                ride.status = RideStatus.CANCELLED
                print(f"Ride cancelled. Status: {ride.status}")
            else:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Cannot cancel ride at this stage"
                )
        elif current_user.role == UserRole.DRIVER and str(ride.driver_id) == str(current_user.id):
            print("User is the driver")
            if ride.status == RideStatus.ACCEPTED:
                print("Driver rejecting ride")
                ride.status = RideStatus.PENDING
                ride.driver_id = None
                print(f"Ride rejected. Status: {ride.status}, Driver ID: {ride.driver_id}")
                
                # Notify other nearby drivers about the ride becoming available again
                nearby_drivers = find_nearby_drivers(
                    db, 
                    float(ride.pickup_lat), 
                    float(ride.pickup_lng), 
                    max_distance_km=3.0
                )
                
                for driver in nearby_drivers:
                    if str(driver.id) != str(current_user.id):  # Don't notify the rejecting driver
                        try:
                            await manager.send_personal_message({
                                "type": "new_ride_request",
                                "ride_id": ride.id,
                                "pickup_address": ride.pickup_address,
                                "destination_address": ride.destination_address,
                                "distance_km": round(float(ride.distance_km or 0), 2),
                                "estimated_fare": round(float(ride.estimated_fare or 0), 2),
                                "vehicle_type": ride.vehicle_type.value if ride.vehicle_type is not None else "economy"
                            }, int(driver.id) if driver.id is not None else 0)
                        except Exception as e:
                            print(f"Failed to send WebSocket message to driver {driver.id}: {e}")
            else:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Cannot reject ride at this stage"
                )
        else:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Not authorized to cancel/reject this ride"
            )
    
    db.commit()
    db.refresh(ride)
    
    # Send WebSocket notification to rider
    if ride_update.status in [RideStatus.ACCEPTED, RideStatus.IN_PROGRESS, RideStatus.COMPLETED, RideStatus.CANCELLED]:
        await manager.send_personal_message({
            "type": "ride_status_update",
            "ride_id": ride.id,
            "status": str(ride.status)
        }, int(ride.rider_id) if ride.rider_id is not None else 0)
    
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
    
    # Check if the current user is the rider who booked the ride
    if ride.rider_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to cancel this ride"
        )
    
    # Check if the ride is in a cancellable state
    if str(ride.status) in [RideStatus.COMPLETED.value, RideStatus.CANCELLED.value]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot cancel this ride"
        )
    
    # Cancel the ride
    ride.status = RideStatus.CANCELLED.value
    db.commit()

    return None

