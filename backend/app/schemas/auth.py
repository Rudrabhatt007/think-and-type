from pydantic import BaseModel, Field
from uuid import UUID
from datetime import datetime
from typing import Optional

class GuestLoginRequest(BaseModel):
    username: str = Field(..., min_length=2, max_length=20, pattern=r"^[a-zA-Z0-9_\s\-]+$")
    avatar: Optional[str] = None

class Token(BaseModel):
    access_token: str
    token_type: str

class TokenData(BaseModel):
    user_id: UUID
    username: str

class UserResponse(BaseModel):
    id: UUID
    username: str
    is_guest: bool
    avatar: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True
