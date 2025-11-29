from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import and_
from typing import List
import random
import string
from datetime import datetime

from app.database import get_db
from app.models import User, Vacation, LoyaltyPoints, UserRole, DriverProfile
from app.schemas import VacationCreate, VacationResponse
from app.auth import get_current_active_user

router = APIRouter()

def generate_booking_reference() -> str:
    """Generate a unique booking reference"""
    return ''.join(random.choices(string.ascii_uppercase + string.digits, k=10))

def calculate_vacation_price(
    days: int,
    passengers: int,
    vehicle_type: str,
    ride_included: bool,
    hotel_included: bool
) -> float:
    """Calculate vacation package price"""
    base_prices = {
        "economy": 3000,
        "premium": 5000,
        "suv": 6000,
        "luxury": 10000
    }
    
    base_price = base_prices.get(vehicle_type, 3000)
    total = 0
    
    if ride_included:
        total += base_price * 0.3  # 30% for transportation
    
    if hotel_included:
        hotel_per_night = 2000
        total += hotel_per_night * days
    
    # Add per passenger cost
    total += (passengers - 1) * 1000
    
    return total

@router.post("/", response_model=VacationResponse, status_code=status.HTTP_201_CREATED)
async def create_vacation(
    vacation_data: VacationCreate,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Create a vacation booking"""
    # Debug information
    print(f"=== CREATE VACATION DEBUG ===")
    print(f"Current user ID: {current_user.id}")
    print(f"Current user email: {current_user.email}")
    print(f"Current user role: {current_user.role}")
    print(f"Current user role type: {type(current_user.role)}")
    print(f"Current user role value: {getattr(current_user.role, 'value', 'no value attr')}")
    print(f"Expected rider role: {UserRole.RIDER}")
    print(f"Expected rider value: {UserRole.RIDER.value}")
    print(f"Direct enum comparison: {current_user.role == UserRole.RIDER}")
    print(f"String comparison: {str(current_user.role) == UserRole.RIDER.value}")
    
    # Fix the role comparison - use direct enum comparison
    if current_user.role != UserRole.RIDER:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only riders can book vacations"
        )
    
    # Validate dates
    if vacation_data.end_date <= vacation_data.start_date:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="End date must be after start date"
        )
    
    # Calculate number of days
    days = (vacation_data.end_date - vacation_data.start_date).days
    
    # Calculate total price with more detailed pricing
    total_price = calculate_vacation_price(
        days,
        vacation_data.passengers,
        vacation_data.vehicle_type.value,
        vacation_data.ride_included,
        vacation_data.hotel_included
    )
    
    # Generate booking reference
    booking_ref = generate_booking_reference()
    
    # Create vacation record
    new_vacation = Vacation(
        user_id=current_user.id,
        destination=vacation_data.destination,
        hotel_name=vacation_data.hotel_name,
        hotel_address=vacation_data.hotel_address,
        start_date=vacation_data.start_date,
        end_date=vacation_data.end_date,
        vehicle_type=vacation_data.vehicle_type,
        passengers=vacation_data.passengers,
        ride_included=vacation_data.ride_included,
        hotel_included=vacation_data.hotel_included,
        total_price=total_price,
        booking_reference=booking_ref,
        status="pending",
        # New fields for automated schedule-based trip planner
        schedule=vacation_data.schedule,
        flight_details=vacation_data.flight_details,
        activities=vacation_data.activities,
        meal_preferences=vacation_data.meal_preferences
    )
    
    try:
        db.add(new_vacation)
        db.commit()
        db.refresh(new_vacation)
        print(f"Vacation booking created successfully with ID: {new_vacation.id}")
    except Exception as e:
        db.rollback()
        print(f"Failed to create vacation booking: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create vacation booking: {str(e)}"
        )
    
    # Add loyalty points
    try:
        loyalty = db.query(LoyaltyPoints).filter(LoyaltyPoints.user_id == current_user.id).first()
        if loyalty:
            points_earned = int(total_price / 100)  # 1 point per 100 currency
            loyalty.total_points = loyalty.total_points + points_earned
            
            # Update tier
            if loyalty.total_points >= 10000:
                loyalty.tier = "platinum"
            elif loyalty.total_points >= 5000:
                loyalty.tier = "gold"
            elif loyalty.total_points >= 1000:
                loyalty.tier = "silver"
            
            db.commit()
            print(f"Loyalty points updated. New total: {loyalty.total_points}")
    except Exception as e:
        print(f"Failed to update loyalty points: {e}")
        # Don't fail the booking if loyalty points can't be updated
        pass
    
    # Send WebSocket notification to nearby drivers
    try:
        from app.websocket import manager
        from app.routers.rides import find_nearby_drivers
        # For simplicity, we'll notify all available drivers
        # Get the user's location from their profile or first ride
        default_lat = 12.9716  # Bangalore
        default_lng = 77.5946
        
        # Try to get user's location from their profile or first ride
        drivers = db.query(User).join(DriverProfile).filter(
            and_(
                User.role == UserRole.DRIVER,
                User.is_active == True,
                DriverProfile.is_available == True,
                DriverProfile.current_lat != None,
                DriverProfile.current_lng != None
            )
        ).all()
        
        print(f"Found {len(drivers)} available drivers to notify")
        
        # Send WebSocket notification to nearby drivers
        for driver in drivers:
            try:
                await manager.send_personal_message({
                    "type": "new_vacation_request",
                    "vacation_id": new_vacation.id,
                    "destination": new_vacation.destination,
                    "hotel_name": new_vacation.hotel_name,
                    "start_date": new_vacation.start_date.isoformat(),
                    "end_date": new_vacation.end_date.isoformat(),
                    "total_price": float(new_vacation.total_price),
                    "passengers": new_vacation.passengers
                }, int(driver.id) if driver.id is not None else 0)
                print(f"Sent vacation request notification to driver {driver.id}")
            except Exception as e:
                print(f"Failed to send WebSocket message to driver {driver.id}: {e}")
    except Exception as e:
        print(f"Failed to send WebSocket notifications: {e}")
    
    return new_vacation

@router.get("/", response_model=List[VacationResponse])
async def get_vacations(
    status: str = None,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Get user's vacation bookings"""
    query = db.query(Vacation)
    
    if status:
        query = query.filter(Vacation.status == status)
    
    if current_user.role == UserRole.ADMIN:
        pass  # Admin sees all
    elif current_user.role == UserRole.DRIVER:
        # Drivers see pending bookings for confirmation
        if not status:  # If no status specified, show pending for drivers
            query = query.filter(Vacation.status == "pending")
    else:
        # Regular users see their own bookings
        query = query.filter(Vacation.user_id == current_user.id)
    
    vacations = query.order_by(Vacation.created_at.desc()).all()
    return vacations

@router.get("/available", response_model=List[VacationResponse])
async def get_available_vacations(
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Get available vacation bookings for drivers"""
    if current_user.role != UserRole.DRIVER:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only drivers can view available vacation bookings"
        )
    
    vacations = db.query(Vacation).filter(
        Vacation.status == "pending"
    ).order_by(Vacation.created_at.desc()).all()
    
    return vacations

@router.get("/{vacation_id}", response_model=VacationResponse)
async def get_vacation(
    vacation_id: int,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Get specific vacation booking"""
    vacation = db.query(Vacation).filter(Vacation.id == vacation_id).first()
    
    if not vacation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Vacation booking not found"
        )
    
    if current_user.role != UserRole.ADMIN and vacation.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to view this booking"
        )
    
    return vacation

@router.delete("/{vacation_id}")
async def cancel_vacation(
    vacation_id: int,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Cancel a vacation booking"""
    vacation = db.query(Vacation).filter(Vacation.id == vacation_id).first()
    
    if not vacation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Vacation booking not found"
        )
    
    if vacation.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to cancel this booking"
        )
    
    if vacation.start_date < datetime.now():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot cancel past vacations"
        )
    
    vacation.status = "cancelled"
    db.commit()
    
    return {"message": "Vacation booking cancelled successfully"}

@router.patch("/{vacation_id}/confirm")
async def confirm_vacation(
    vacation_id: int,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Confirm a vacation booking (driver action)"""
    # Only drivers and admins can confirm bookings
    if str(current_user.role) not in [UserRole.DRIVER.value, UserRole.ADMIN.value]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only drivers and admins can confirm vacation bookings"
        )
    
    vacation = db.query(Vacation).filter(Vacation.id == vacation_id).first()
    
    if not vacation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Vacation booking not found"
        )
    
    if vacation.status != "pending":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Vacation booking is not in pending status"
        )
    
    vacation.status = "confirmed"
    db.commit()
    db.refresh(vacation)
    
    # Send WebSocket notification to rider
    try:
        from app.websocket import manager
        await manager.send_personal_message({
            "type": "vacation_status_update",
            "vacation_id": vacation.id,
            "status": "confirmed"
        }, int(vacation.user_id) if vacation.user_id is not None else 0)
    except Exception as e:
        print(f"Failed to send WebSocket notification to rider: {e}")
    
    return {"message": "Vacation booking confirmed successfully", "vacation": vacation}

@router.patch("/{vacation_id}/reject")
async def reject_vacation(
    vacation_id: int,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Reject a vacation booking (driver action)"""
    # Only drivers and admins can reject bookings
    if str(current_user.role) not in [UserRole.DRIVER.value, UserRole.ADMIN.value]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only drivers and admins can reject vacation bookings"
        )
    
    vacation = db.query(Vacation).filter(Vacation.id == vacation_id).first()
    
    if not vacation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Vacation booking not found"
        )
    
    if vacation.status != "pending":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Vacation booking is not in pending status"
        )
    
    # Set status to rejected
    vacation.status = "rejected"
    db.commit()
    db.refresh(vacation)
    
    # Send WebSocket notification to rider
    try:
        from app.websocket import manager
        await manager.send_personal_message({
            "type": "vacation_status_update",
            "vacation_id": vacation.id,
            "status": "rejected"
        }, int(vacation.user_id) if vacation.user_id is not None else 0)
    except Exception as e:
        print(f"Failed to send WebSocket notification to rider: {e}")
    
    return {"message": "Vacation booking rejected successfully", "vacation": vacation}

@router.get("/loyalty/points")
async def get_loyalty_points(
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Get user's loyalty points"""
    loyalty = db.query(LoyaltyPoints).filter(LoyaltyPoints.user_id == current_user.id).first()
    
    if not loyalty:
        return {
            "total_points": 0,
            "tier": "bronze",
            "message": "No loyalty points yet"
        }
    
    return {
        "total_points": loyalty.total_points,
        "tier": loyalty.tier,
        "benefits": {
            "bronze": "Basic rewards",
            "silver": "5% discount on rides",
            "gold": "10% discount + priority booking",
            "platinum": "15% discount + free upgrades"
        }.get(loyalty.tier, "Basic rewards")
    }
