# schemas/user.py
from pydantic import BaseModel, EmailStr, Field
from typing import List, Optional
from datetime import datetime

# New: Register form
class RegisterForm(BaseModel):
    email: EmailStr
    firstName: str
    lastName: str
    password: str
    # FIX 1: Map incoming JSON "class" to python variable "class_"
    class_: str = Field(alias="class") 

# New: Login form
class LoginForm(BaseModel):
    email: EmailStr
    password: str

# Existing models
class Name(BaseModel):
    firstName: str
    lastName: str

class UserBase(BaseModel):
    username: str
    name: Name
    email: EmailStr
    # FIX 2: Tell Pydantic that 'class_' in Python comes from 'class' in DB
    class_: str = Field(alias="class")

    class Config:
        # FIX 3: This allows Pydantic to read 'class' from the DB
        # and assign it to the 'class_' variable automatically.
        populate_by_name = True 

class UserCreate(UserBase):
    password: Optional[str] = None
    googleId: Optional[str] = None

class UserInDB(UserBase):
    userId: str
    # FIX 4: Add '= None' so it doesn't crash if the field is missing in DB
    password: Optional[str] = None 
    googleId: Optional[str] = None
    role: str = "student"
    completedLessons: List[str] = []
    createdAt: datetime
    lastLogin: datetime
    status: str = "active"

class UserUpdate(BaseModel):
    name: Optional[Name] = None
    # FIX 5: Same alias fix for updates
    class_: Optional[str] = Field(default=None, alias="class")

class Token(BaseModel):
    access_token: str
    token_type: str

class Session(BaseModel):
    timestamp: datetime
    duration: int
    subject: str = "General Study" 

class Quiz(BaseModel):
    timestamp: datetime
    subject: str
    score: str

class History(BaseModel):
    recent_sessions: List[Session]
    recent_quizzes: List[Quiz]
