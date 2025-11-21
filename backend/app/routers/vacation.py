from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
import random
import string
from datetime import datetime

from app.database import get_db
from app.models import User, Vacation, LoyaltyPoints, UserRole
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
    if str(current_user.role) != UserRole.RIDER.value:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only riders can book vacations"
        )
    
    # Calculate number of days
    days = (vacation_data.end_date - vacation_data.start_date).days
    
    if days < 1:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="End date must be after start date"
        )
    
    # Calculate total price
    total_price = calculate_vacation_price(
        days,
        vacation_data.passengers,
        vacation_data.vehicle_type.value,
        vacation_data.ride_included,
        vacation_data.hotel_included
    )
    
    # Generate booking reference
    booking_ref = generate_booking_reference()
    
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
        status="pending"
    )
    
    db.add(new_vacation)
    db.commit()
    db.refresh(new_vacation)
    
    # Add loyalty points
    loyalty = db.query(LoyaltyPoints).filter(LoyaltyPoints.user_id == current_user.id).first()
    if loyalty:
        points_earned = int(total_price / 100)  # 1 point per 100 currency
        loyalty.total_points = int(loyalty.total_points) + points_earned
        
        # Update tier
        if loyalty.total_points >= 10000:
            loyalty.tier = "platinum"
        elif loyalty.total_points >= 5000:
            loyalty.tier = "gold"
        elif loyalty.total_points >= 1000:
            loyalty.tier = "silver"
        
        db.commit()
    
    return new_vacation

@router.get("/", response_model=List[VacationResponse])
async def get_vacations(
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Get user's vacation bookings"""
    if current_user.role == UserRole.ADMIN:
        vacations = db.query(Vacation).order_by(Vacation.created_at.desc()).all()
    else:
        vacations = db.query(Vacation).filter(
            Vacation.user_id == current_user.id
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
    
    return {"message": "Vacation booking confirmed successfully", "vacation": vacation}

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
