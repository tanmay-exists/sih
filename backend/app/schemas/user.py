from pydantic import BaseModel, EmailStr
from typing import List, Optional
from datetime import datetime

class Name(BaseModel):
    firstName: str
    lastName: str

class UserBase(BaseModel):
    username: str
    name: Name
    email: EmailStr
    class_: str  # Renamed to avoid Python keyword conflict

class UserCreate(UserBase):
    password: Optional[str] = None  # For email/password
    googleId: Optional[str] = None  # For Google SSO

class UserInDB(UserBase):
    userId: str
    password: Optional[str]
    googleId: Optional[str]
    role: str = "student"
    completedLessons: List[str] = []
    createdAt: datetime
    lastLogin: datetime
    status: str = "active"

class UserUpdate(BaseModel):
    name: Optional[Name] = None
    class_: Optional[str] = None

class Token(BaseModel):
    access_token: str
    token_type: str

class Session(BaseModel):
    timestamp: datetime
    duration: int  # in seconds

class Quiz(BaseModel):
    timestamp: datetime
    subject: str
    score: str  # e.g., "3/5"

class History(BaseModel):
    recent_sessions: List[Session]
    recent_quizzes: List[Quiz]
