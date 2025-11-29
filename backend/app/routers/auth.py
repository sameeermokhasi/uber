from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import User, UserRole, DriverProfile, LoyaltyPoints
from app.schemas import UserCreate, UserResponse, Token, DriverProfileCreate
from app.auth import get_password_hash, verify_password, create_access_token

router = APIRouter()

@router.post("/register", response_model=Token, status_code=status.HTTP_201_CREATED)
async def register(user_data: UserCreate, db: Session = Depends(get_db)):
    """Register a new user (rider, driver, or admin)"""
    # Check if user already exists
    existing_user = db.query(User).filter(User.email == user_data.email).first()
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered"
        )
    
    # Create new user
    hashed_password = get_password_hash(user_data.password)
    new_user = User(
        name=user_data.name,
        email=user_data.email,
        phone=user_data.phone,
        password=hashed_password,
        role=user_data.role
    )
    
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    
    # Create loyalty points for riders
    if new_user.role == UserRole.RIDER:
        loyalty = LoyaltyPoints(user_id=new_user.id)
        db.add(loyalty)
    
    # Create driver profile for drivers
    if new_user.role == UserRole.DRIVER:
        # Generate a default license number
        license_number = f"LIC{new_user.id:06d}"
        driver_profile = DriverProfile(
            user_id=new_user.id,
            license_number=license_number,
            is_available=False  # Default to offline until they toggle availability
        )
        db.add(driver_profile)
    
    db.commit()
    
    # Create access token
    access_token = create_access_token(data={"sub": new_user.email})
    
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": new_user
    }

@router.post("/login", response_model=Token)
async def login(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    """Login endpoint"""
    user = db.query(User).filter(User.email == form_data.username).first()
    
    if not user or not verify_password(form_data.password, user.password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Inactive user account"
        )
    
    access_token = create_access_token(data={"sub": user.email})
    
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": user
    }

@router.post("/driver/register", response_model=Token, status_code=status.HTTP_201_CREATED)
async def register_driver(
    user_data: UserCreate,
    driver_data: DriverProfileCreate,
    db: Session = Depends(get_db)
):
    """Register a new driver with profile"""
    # Check if user already exists
    existing_user = db.query(User).filter(User.email == user_data.email).first()
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered"
        )
    
    # Check if license number already exists
    existing_license = db.query(DriverProfile).filter(
        DriverProfile.license_number == driver_data.license_number
    ).first()
    if existing_license:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="License number already registered"
        )
    
    # Create new driver user
    hashed_password = get_password_hash(user_data.password)
    new_user = User(
        name=user_data.name,
        email=user_data.email,
        phone=user_data.phone,
        password=hashed_password,
        role=UserRole.DRIVER
    )
    
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    
    # Create driver profile
    new_driver_profile = DriverProfile(
        user_id=new_user.id,
        license_number=driver_data.license_number,
        vehicle_type=driver_data.vehicle_type,
        vehicle_model=driver_data.vehicle_model,
        vehicle_plate=driver_data.vehicle_plate,
        vehicle_color=driver_data.vehicle_color
    )
    
    db.add(new_driver_profile)
    db.commit()
    
    # Create access token
    access_token = create_access_token(data={"sub": new_user.email})
    
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": new_user
    }
