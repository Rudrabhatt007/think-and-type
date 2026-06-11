from datetime import datetime, timedelta
from typing import Optional
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import JWTError, jwt
from app.core.config import settings
from app.core.db import get_db
from app.core.redis import get_redis
from app.schemas.auth import GuestLoginRequest, Token, UserResponse

router = APIRouter(prefix="/auth", tags=["auth"])
security = HTTPBearer()

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    """Generate JWT Access Token"""
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)
    return encoded_jwt

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)) -> UserResponse:
    """Dependency to get and validate current user from JWT"""
    token = credentials.credentials
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        user_id_str: str = payload.get("sub")
        username: str = payload.get("username")
        if user_id_str is None or username is None:
            raise credentials_exception
        user_id = UUID(user_id_str)
    except (JWTError, ValueError):
        raise credentials_exception

    # Query the user profile from Supabase db
    supabase_client = get_db()
    response = supabase_client.table("profiles").select("*").eq("id", str(user_id)).execute()
    if not response.data:
        # If user profile not in db but JWT is valid, register it now (fallback)
        new_user = {
            "id": str(user_id),
            "username": username,
            "is_guest": True
        }
        res_insert = supabase_client.table("profiles").insert(new_user).execute()
        if not res_insert.data:
            raise credentials_exception
        user_data = res_insert.data[0]
    else:
        user_data = response.data[0]

    # Query avatar from redis
    redis_client = await get_redis()
    avatar = await redis_client.get(f"avatar:{user_id}")

    return UserResponse(
        id=user_data["id"],
        username=user_data["username"],
        is_guest=user_data["is_guest"],
        avatar=avatar,
        created_at=datetime.fromisoformat(user_data["created_at"].replace("Z", "+00:00"))
    )

@router.post("/guest-login", response_model=Token)
async def guest_login(request: GuestLoginRequest):
    """Logs in or registers a new guest profile by name and returns a JWT token"""
    db_client = get_db()
    
    # Check for existing name to avoid constraint errors
    existing = db_client.table("profiles").select("id").eq("username", request.username).execute()
    if existing.data:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This name is already taken in the database. Please use a different First Name or Last Name."
        )
        
    # Write a new profile record to Supabase
    new_profile = {
        "username": request.username,
        "is_guest": True
    }
    
    response = db_client.table("profiles").insert(new_profile).execute()
    if not response.data or len(response.data) == 0:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to register guest user."
        )
        
    user_record = response.data[0]
    user_id = user_record["id"]
    
    # Store avatar in Redis if provided
    if request.avatar:
        redis_client = await get_redis()
        # Expire avatar after 24 hours to match typical guest session
        await redis_client.setex(f"avatar:{user_id}", 86400, request.avatar)
    
    # Generate JWT
    token_data = {"sub": str(user_id), "username": request.username}
    token = create_access_token(data=token_data)
    
    return Token(access_token=token, token_type="bearer")
