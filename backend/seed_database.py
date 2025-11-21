"""
Database seeder script to populate initial data
Run this after creating the database
"""
from sqlalchemy.orm import Session
from app.database import SessionLocal, engine, Base
from app.models import City, User, UserRole, LoyaltyPoints
from app.auth import get_password_hash

def seed_cities(db: Session):
    """Add sample cities for intercity rides"""
    cities = [
        {"name": "Mumbai", "state": "Maharashtra", "lat": 19.0760, "lng": 72.8777},
        {"name": "Delhi", "state": "Delhi NCR", "lat": 28.7041, "lng": 77.1025},
        {"name": "Bangalore", "state": "Karnataka", "lat": 12.9716, "lng": 77.5946},
        {"name": "Pune", "state": "Maharashtra", "lat": 18.5204, "lng": 73.8567},
        {"name": "Hyderabad", "state": "Telangana", "lat": 17.3850, "lng": 78.4867},
        {"name": "Chennai", "state": "Tamil Nadu", "lat": 13.0827, "lng": 80.2707},
        {"name": "Kolkata", "state": "West Bengal", "lat": 22.5726, "lng": 88.3639},
        {"name": "Ahmedabad", "state": "Gujarat", "lat": 23.0225, "lng": 72.5714},
        {"name": "Jaipur", "state": "Rajasthan", "lat": 26.9124, "lng": 75.7873},
        {"name": "Goa", "state": "Goa", "lat": 15.2993, "lng": 74.1240}
    ]
    
    existing = db.query(City).count()
    if existing > 0:
        print(f"✓ Cities already seeded ({existing} cities found)")
        return
    
    for city_data in cities:
        city = City(**city_data)
        db.add(city)
    
    db.commit()
    print(f"✓ Added {len(cities)} cities")

def seed_admin_user(db: Session):
    """Create default admin user"""
    admin_email = "admin@uber.com"
    
    existing = db.query(User).filter(User.email == admin_email).first()
    if existing:
        print(f"✓ Admin user already exists")
        return
    
    admin = User(
        name="Admin User",
        email=admin_email,
        password=get_password_hash("admin123"),
        role=UserRole.ADMIN,
        is_active=True,
        is_verified=True
    )
    
    db.add(admin)
    db.commit()
    print(f"✓ Created admin user: {admin_email} / admin123")

def seed_demo_users(db: Session):
    """Create demo rider and driver accounts"""
    demo_users = [
        {
            "name": "Demo Rider",
            "email": "rider@demo.com",
            "password": "rider123",
            "role": UserRole.RIDER
        },
        {
            "name": "Demo Driver",
            "email": "driver@demo.com",
            "password": "driver123",
            "role": UserRole.DRIVER
        }
    ]
    
    for user_data in demo_users:
        existing = db.query(User).filter(User.email == user_data["email"]).first()
        if existing:
            continue
        
        user = User(
            name=user_data["name"],
            email=user_data["email"],
            password=get_password_hash(user_data["password"]),
            role=user_data["role"],
            is_active=True,
            is_verified=True
        )
        
        db.add(user)
        db.commit()
        
        # Create loyalty points for rider
        if user.role == UserRole.RIDER:
            loyalty = LoyaltyPoints(user_id=user.id, total_points=500, tier="silver")
            db.add(loyalty)
            db.commit()
        
        print(f"✓ Created demo user: {user_data['email']} / {user_data['password']}")

def main():
    """Run all seeders"""
    print("\n🌱 Starting database seeding...\n")
    
    # Create tables if they don't exist
    Base.metadata.create_all(bind=engine)
    
    db = SessionLocal()
    try:
        seed_cities(db)
        seed_admin_user(db)
        seed_demo_users(db)
        print("\n✅ Database seeding completed!\n")
        print("=" * 50)
        print("Demo Accounts:")
        print("  Admin:  admin@uber.com / admin123")
        print("  Rider:  rider@demo.com / rider123")
        print("  Driver: driver@demo.com / driver123")
        print("=" * 50)
    finally:
        db.close()

if __name__ == "__main__":
    main()
