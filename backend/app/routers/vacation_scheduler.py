from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
import json
from datetime import datetime, timedelta

from app.database import get_db
from app.models import User, Vacation, Ride, DriverProfile, RideStatus, UserRole, VehicleType
from app.schemas import RideCreate
from app.auth import get_current_active_user
from app.routers.rides import calculate_fare, calculate_distance

router = APIRouter()

def parse_schedule(vacation: Vacation) -> dict:
    """Parse the vacation schedule JSON data"""
    try:
        if vacation.schedule:
            return json.loads(vacation.schedule)
        return {}
    except json.JSONDecodeError:
        return {}

def create_automated_rides_for_vacation(db: Session, vacation: Vacation, user: User):
    """Create automated rides based on vacation schedule"""
    schedule = parse_schedule(vacation)
    
    if not schedule:
        return []
    
    # Get flight details
    flight_details = {}
    if vacation.flight_details:
        try:
            flight_details = json.loads(vacation.flight_details)
        except json.JSONDecodeError:
            pass
    
    # Get activities
    activities = []
    if vacation.activities:
        try:
            activities = json.loads(vacation.activities)
        except json.JSONDecodeError:
            pass
    
    # Create rides based on schedule
    rides = []
    
    # Create airport pickup ride (30 minutes before flight departure)
    if flight_details.get('departureTime'):
        try:
            departure_time = datetime.fromisoformat(flight_details['departureTime'])
            pickup_time = departure_time - timedelta(minutes=30)
            
            # Create ride from user's location to airport
            # For simplicity, we'll use default coordinates
            pickup_lat = 12.9716  # Bangalore
            pickup_lng = 77.5946
            airport_lat = 13.1986  # Bangalore Airport
            airport_lng = 77.7066
            
            distance = calculate_distance(pickup_lat, pickup_lng, airport_lat, airport_lng)
            estimated_fare = calculate_fare(distance, vacation.vehicle_type.value if vacation.vehicle_type else "economy")
            
            ride = Ride(
                rider_id=user.id,
                pickup_address="Home",
                pickup_lat=pickup_lat,
                pickup_lng=pickup_lng,
                destination_address=f"{flight_details.get('departureCity', 'Airport')} Airport",
                destination_lat=airport_lat,
                destination_lng=airport_lng,
                vehicle_type=vacation.vehicle_type or VehicleType.ECONOMY,
                distance_km=distance,
                duration_minutes=int((distance / 40) * 60),  # Assuming 40 km/h average speed
                estimated_fare=estimated_fare,
                scheduled_time=pickup_time
            )
            
            db.add(ride)
            rides.append(ride)
        except Exception as e:
            print(f"Failed to create airport pickup ride: {e}")
    
    # Create airport dropoff ride (30 minutes after flight arrival)
    if flight_details.get('arrivalTime'):
        try:
            arrival_time = datetime.fromisoformat(flight_details['arrivalTime'])
            dropoff_time = arrival_time + timedelta(minutes=30)
            
            # Create ride from airport to hotel
            airport_lat = 15.3808  # Goa Airport
            airport_lng = 73.8380
            hotel_lat = 15.2993  # Goa city center
            hotel_lng = 74.1240
            
            distance = calculate_distance(airport_lat, airport_lng, hotel_lat, hotel_lng)
            estimated_fare = calculate_fare(distance, vacation.vehicle_type.value if vacation.vehicle_type else "economy")
            
            ride = Ride(
                rider_id=user.id,
                pickup_address=f"{flight_details.get('arrivalCity', 'Destination')} Airport",
                pickup_lat=airport_lat,
                pickup_lng=airport_lng,
                destination_address=vacation.hotel_name or "Hotel",
                destination_lat=hotel_lat,
                destination_lng=hotel_lng,
                vehicle_type=vacation.vehicle_type or VehicleType.ECONOMY,
                distance_km=distance,
                duration_minutes=int((distance / 40) * 60),  # Assuming 40 km/h average speed
                estimated_fare=estimated_fare,
                scheduled_time=dropoff_time
            )
            
            db.add(ride)
            rides.append(ride)
        except Exception as e:
            print(f"Failed to create airport dropoff ride: {e}")
    
    # Create rides for activities
    for activity in activities:
        try:
            # For simplicity, we'll create rides between hotel and activity locations
            # In a real implementation, this would be more sophisticated
            hotel_lat = 15.2993  # Goa city center
            hotel_lng = 74.1240
            
            # Default activity location (would be parsed from activity data in real implementation)
            activity_lat = 15.3000
            activity_lng = 74.1250
            
            # Create ride from hotel to activity
            distance = calculate_distance(hotel_lat, hotel_lng, activity_lat, activity_lng)
            estimated_fare = calculate_fare(distance, vacation.vehicle_type.value if vacation.vehicle_type else "economy")
            
            ride = Ride(
                rider_id=user.id,
                pickup_address=vacation.hotel_name or "Hotel",
                pickup_lat=hotel_lat,
                pickup_lng=hotel_lng,
                destination_address=activity.get('location', 'Activity Location'),
                destination_lat=activity_lat,
                destination_lng=activity_lng,
                vehicle_type=vacation.vehicle_type or VehicleType.ECONOMY,
                distance_km=distance,
                duration_minutes=int((distance / 40) * 60),  # Assuming 40 km/h average speed
                estimated_fare=estimated_fare,
                scheduled_time=datetime.now() + timedelta(hours=2)  # Placeholder time
            )
            
            db.add(ride)
            rides.append(ride)
        except Exception as e:
            print(f"Failed to create activity ride: {e}")
    
    try:
        db.commit()
        for ride in rides:
            db.refresh(ride)
        return rides
    except Exception as e:
        db.rollback()
        print(f"Failed to commit rides: {e}")
        return []

@router.post("/vacation/{vacation_id}/schedule-rides")
async def schedule_vacation_rides(
    vacation_id: int,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Create automated rides based on vacation schedule"""
    # Get vacation
    vacation = db.query(Vacation).filter(
        Vacation.id == vacation_id,
        Vacation.user_id == current_user.id
    ).first()
    
    if not vacation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Vacation booking not found"
        )
    
    # Create automated rides
    rides = create_automated_rides_for_vacation(db, vacation, current_user)
    
    return {
        "message": f"Created {len(rides)} automated rides for your vacation",
        "rides": rides
    }