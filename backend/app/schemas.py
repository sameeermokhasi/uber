from pydantic import BaseModel, EmailStr, Field
from typing import Optional, List
from datetime import datetime
from app.models import UserRole, RideStatus, VehicleType

# User Schemas
class UserBase(BaseModel):
    email: EmailStr
    name: str
    phone: Optional[str] = None

class UserCreate(UserBase):
    password: str
    role: UserRole = UserRole.RIDER

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class UserResponse(UserBase):
    id: int
    role: UserRole
    is_active: bool
    is_verified: bool
    profile_picture: Optional[str] = None
    created_at: datetime
    
    class Config:
        from_attributes = True

class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse

# Driver Profile Schemas
class DriverProfileCreate(BaseModel):
    license_number: str
    vehicle_type: VehicleType = VehicleType.ECONOMY
    vehicle_model: Optional[str] = None
    vehicle_plate: Optional[str] = None
    vehicle_color: Optional[str] = None

class DriverProfileResponse(BaseModel):
    id: int
    user_id: int
    license_number: str
    vehicle_type: VehicleType
    vehicle_model: Optional[str]
    vehicle_plate: Optional[str]
    vehicle_color: Optional[str]
    rating: float
    total_rides: int
    is_available: bool
    current_lat: Optional[float]
    current_lng: Optional[float]
    
    class Config:
        from_attributes = True

class DriverWithProfile(UserResponse):
    driver_profile: Optional[DriverProfileResponse] = None

# Ride Schemas
class RideCreate(BaseModel):
    pickup_address: str
    pickup_lat: float
    pickup_lng: float
    destination_address: str
    destination_lat: float
    destination_lng: float
    vehicle_type: VehicleType = VehicleType.ECONOMY
    scheduled_time: Optional[datetime] = None

class RideResponse(BaseModel):
    id: int
    rider_id: int
    driver_id: Optional[int]
    pickup_address: str
    pickup_lat: float
    pickup_lng: float
    destination_address: str
    destination_lat: float
    destination_lng: float
    status: RideStatus
    vehicle_type: VehicleType
    distance_km: Optional[float]
    duration_minutes: Optional[int]
    estimated_fare: Optional[float]
    final_fare: Optional[float]
    rating: Optional[int]
    scheduled_time: Optional[datetime]
    created_at: datetime
    started_at: Optional[datetime]
    completed_at: Optional[datetime]
    
    class Config:
        from_attributes = True

class RideUpdate(BaseModel):
    status: Optional[RideStatus] = None
    driver_id: Optional[int] = None
    final_fare: Optional[float] = None

class RideRating(BaseModel):
    rating: int = Field(ge=1, le=5)
    feedback: Optional[str] = None

# Location Update Schema
class LocationUpdate(BaseModel):
    lat: float
    lng: float

# Intercity Ride Schemas
class IntercityRideCreate(BaseModel):
    origin_city_id: int
    destination_city_id: int
    pickup_address: str
    dropoff_address: str
    scheduled_date: datetime
    vehicle_type: VehicleType = VehicleType.ECONOMY
    passengers: int = 1

class IntercityRideResponse(BaseModel):
    id: int
    rider_id: int
    driver_id: Optional[int]
    origin_city_id: int
    destination_city_id: int
    pickup_address: str
    dropoff_address: str
    scheduled_date: datetime
    status: RideStatus
    vehicle_type: VehicleType
    distance_km: Optional[float]
    estimated_duration_hours: Optional[float]
    price: float
    passengers: int
    created_at: datetime
    
    class Config:
        from_attributes = True

# City Schemas
class CityCreate(BaseModel):
    name: str
    state: Optional[str] = None
    country: str = "India"
    lat: Optional[float] = None
    lng: Optional[float] = None

class CityResponse(BaseModel):
    id: int
    name: str
    state: Optional[str]
    country: str
    lat: Optional[float]
    lng: Optional[float]
    is_active: bool
    
    class Config:
        from_attributes = True

# Vacation Schemas
class VacationCreate(BaseModel):
    destination: str
    hotel_name: Optional[str] = None
    hotel_address: Optional[str] = None
    start_date: datetime
    end_date: datetime
    vehicle_type: VehicleType = VehicleType.ECONOMY
    passengers: int = 1
    ride_included: bool = True
    hotel_included: bool = True

class VacationResponse(BaseModel):
    id: int
    user_id: int
    destination: str
    hotel_name: Optional[str]
    hotel_address: Optional[str]
    start_date: datetime
    end_date: datetime
    total_price: float
    ride_included: bool
    hotel_included: bool
    vehicle_type: VehicleType
    passengers: int
    status: str
    booking_reference: Optional[str]
    created_at: datetime
    
    class Config:
        from_attributes = True

# Admin Schemas
class AdminStats(BaseModel):
    total_users: int
    total_drivers: int
    total_riders: int
    total_rides: int
    active_rides: int
    completed_rides: int
    total_revenue: float
