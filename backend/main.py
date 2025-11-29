from fastapi import FastAPI, WebSocket, WebSocketDisconnect, Depends
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
import uvicorn

from app.database import engine, Base, get_db
from app.models import User, UserRole
from app.routers import auth, rides, users, admin, vacation, vacation_scheduler
from app.websocket import manager
from app.auth import decode_access_token, get_current_active_user
from sqlalchemy.orm import Session

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    Base.metadata.create_all(bind=engine)
    yield
    # Shutdown
    pass

app = FastAPI(
    title="Uber Clone API",
    description="Comprehensive ride-hailing and vacation platform",
    version="1.0.0",
    lifespan=lifespan
)

# CORS middleware - Updated to allow all frontend ports
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173", 
        "http://localhost:3000",
        "http://localhost:5000",  # Rider frontend
        "http://localhost:6001",  # Driver frontend (changed from 6000)
        "http://localhost:7001"   # Admin frontend
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(auth.router, prefix="/api/auth", tags=["Authentication"])
app.include_router(rides.router, prefix="/api/rides", tags=["Rides"])
app.include_router(users.router, prefix="/api/users", tags=["Users"])
app.include_router(admin.router, prefix="/api/admin", tags=["Admin"])
app.include_router(vacation.router, prefix="/api/vacation", tags=["Vacation"])
app.include_router(vacation_scheduler.router, prefix="/api/scheduler", tags=["Vacation Scheduler"])

@app.get("/")
async def root():
    return {
        "message": "Uber Clone API",
        "version": "1.0.0",
        "status": "operational"
    }

@app.get("/health")
async def health_check():
    return {"status": "healthy"}

@app.get("/test-db")
async def test_db(current_user: User = Depends(get_current_active_user), db: Session = Depends(get_db)):
    try:
        # Test database connection by querying a simple table
        count = db.query(User).count()
        return {"status": "Database connection successful", "user_count": count}
    except Exception as e:
        return {"status": "Database connection failed", "error": str(e)}

@app.get("/test-user-role/{user_id}")
async def test_user_role(user_id: int, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        return {"error": "User not found"}
    
    return {
        "user_id": user.id,
        "email": user.email,
        "role": user.role,
        "is_driver": user.role == UserRole.DRIVER
    }

@app.websocket("/ws/{token}")
async def websocket_endpoint(websocket: WebSocket, token: str, db: Session = Depends(get_db)):
    # Decode token to get user info
    payload = decode_access_token(token)
    if not payload:
        await websocket.close(code=1008)
        return
    
    user_email = payload.get("sub")
    if not user_email:
        await websocket.close(code=1008)
        return
    
    # Get actual user from database
    user = db.query(User).filter(User.email == user_email).first()
    if not user:
        await websocket.close(code=1008)
        return
    
    user_id = user.id
    
    await manager.connect(websocket, user_id)
    try:
        while True:
            data = await websocket.receive_text()
            # Echo back or process messages
            await manager.send_personal_message(
                {"type": "message", "data": data},
                user_id
            )
    except WebSocketDisconnect:
        manager.disconnect(websocket, user_id)

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)