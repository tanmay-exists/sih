# schemas/user.py
from pydantic import BaseModel, EmailStr
from typing import List, Optional
from datetime import datetime

# New: Register form
class RegisterForm(BaseModel):
    email: EmailStr
    firstName: str
    lastName: str
    password: str
    class_: str  # e.g., "10"

# New: Login form
class LoginForm(BaseModel):
    email: EmailStr
    password: str

# Existing models (kept for DB & Google flow)
class Name(BaseModel):
    firstName: str
    lastName: str

class UserBase(BaseModel):
    username: str
    name: Name
    email: EmailStr
    class_: str

class UserCreate(UserBase):
    password: Optional[str] = None
    googleId: Optional[str] = None

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
