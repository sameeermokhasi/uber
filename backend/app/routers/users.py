from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import and_
from typing import List

from app.database import get_db
from app.models import User, DriverProfile, UserRole, Ride, RideStatus
from app.schemas import UserResponse, DriverProfileResponse, DriverWithProfile, LocationUpdate
from app.auth import get_current_active_user
from app.websocket import manager

router = APIRouter()

@router.get("/me", response_model=UserResponse)
async def get_current_user_info(current_user: User = Depends(get_current_active_user)):
    """Get current user information"""
    return current_user

@router.get("/me/debug", response_model=UserResponse)
async def get_current_user_debug(
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Get current user with debug information"""
    print(f"=== USER DEBUG ===")
    print(f"User ID: {current_user.id}")
    print(f"User Email: {current_user.email}")
    print(f"User Role: {current_user.role}")
    print(f"User Role Type: {type(current_user.role)}")
    print(f"UserRole.DRIVER: {UserRole.DRIVER}")
    print(f"UserRole.DRIVER Type: {type(UserRole.DRIVER)}")
    print(f"UserRole.DRIVER.value: {UserRole.DRIVER.value}")
    print(f"UserRole.DRIVER.value Type: {type(UserRole.DRIVER.value)}")
    print(f"Role comparison: {str(current_user.role) == str(UserRole.DRIVER.value)}")
    print(f"=== END USER DEBUG ===")
    
    # Also check if user has a driver profile
    driver_profile = db.query(DriverProfile).filter(
        DriverProfile.user_id == current_user.id
    ).first()
    
    print(f"Driver profile exists: {driver_profile is not None}")
    if driver_profile:
        print(f"Driver profile available: {driver_profile.is_available}")
    
    return current_user

@router.get("/drivers", response_model=List[DriverWithProfile])
async def get_drivers(
    db: Session = Depends(get_db),
    available_only: bool = False
):
    """Get list of drivers"""
    query = db.query(User).filter(User.role == UserRole.DRIVER)
    drivers = query.all()
    
    result = []
    for driver in drivers:
        driver_profile = db.query(DriverProfile).filter(
            DriverProfile.user_id == driver.id
        ).first()
        
        if available_only and driver_profile and not driver_profile.is_available:
            continue
        
        driver_dict = UserResponse.from_orm(driver).dict()
        if driver_profile:
            driver_dict['driver_profile'] = DriverProfileResponse.from_orm(driver_profile).dict()
        else:
            driver_dict['driver_profile'] = None
        result.append(driver_dict)
    
    return result

@router.patch("/driver/location", response_model=UserResponse)
async def update_driver_location(
    location_data: LocationUpdate,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Update driver's current location"""
    if current_user.role != UserRole.DRIVER:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only drivers can update their location"
        )
    
    # Get or create driver profile
    driver_profile = db.query(DriverProfile).filter(
        DriverProfile.user_id == current_user.id
    ).first()
    
    if not driver_profile:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Driver profile not found"
        )
    
    # Update location
    driver_profile.current_lat = location_data.lat
    driver_profile.current_lng = location_data.lng
    
    db.commit()
    db.refresh(driver_profile)
    db.refresh(current_user)
    
    # Send WebSocket update to all riders with active rides with this driver
    active_rides = db.query(Ride).filter(
        and_(
            Ride.driver_id == current_user.id,
            Ride.status.in_([RideStatus.ACCEPTED, RideStatus.IN_PROGRESS])
        )
    ).all()
    
    for ride in active_rides:
        # Send location update to rider
        await manager.send_personal_message({
            "type": "driver_location_update",
            "ride_id": ride.id,
            "lat": location_data.lat,
            "lng": location_data.lng
        }, int(ride.rider_id))
    
    return current_user

@router.patch("/driver/availability", response_model=UserResponse)
async def toggle_driver_availability(
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Toggle driver availability status"""
    
    # Check if user is a driver
    if current_user.role != UserRole.DRIVER:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only drivers can update their availability"
        )
    
    # Get or create driver profile
    driver_profile = db.query(DriverProfile).filter(
        DriverProfile.user_id == current_user.id
    ).first()
    
    if not driver_profile:
        # Create driver profile if it doesn't exist
        driver_profile = DriverProfile(
            user_id=current_user.id,
            license_number=f"LIC{current_user.id:06d}",  # Generate a default license number
            is_available=True
        )
        db.add(driver_profile)
        try:
            db.commit()
        except Exception as e:
            db.rollback()
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Failed to create driver profile: {str(e)}"
            )
        db.refresh(driver_profile)
    
    # Toggle availability
    driver_profile.is_available = not driver_profile.is_available
    
    try:
        db.commit()
        db.refresh(driver_profile)
        db.refresh(current_user)
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to update availability: {str(e)}"
        )
    
    return current_user