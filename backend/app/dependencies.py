from motor.motor_asyncio import AsyncIOMotorClient
from fastapi import Depends, HTTPException, status, Query
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
from dotenv import load_dotenv
import os

load_dotenv()

MONGO_URI = os.getenv("MONGO_URI")
JWT_SECRET = os.getenv("JWT_SECRET")
JWT_ALGORITHM = os.getenv("JWT_ALGORITHM")
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")  # Add this
GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID")  # For Google SSO
GOOGLE_CLIENT_SECRET = os.getenv("GOOGLE_CLIENT_SECRET")  # For Google SSO
GOOGLE_REDIRECT_URI = os.getenv("GOOGLE_REDIRECT_URI")  # For Google SSO

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="auth/login")

async def get_db_client():
    client = AsyncIOMotorClient(MONGO_URI)
    try:
        yield client
    finally:
        client.close()

async def get_current_user(token: str = Depends(oauth2_scheme), client: AsyncIOMotorClient = Depends(get_db_client)):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        user_id: str = payload.get("sub")
        if user_id is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception
    db = client["NLUsers"]
    user = await db["users"].find_one({"userId": user_id})
    if user is None:
        raise credentials_exception
    return user

async def get_current_user_ws(token: str = Query(...), client: AsyncIOMotorClient = Depends(get_db_client)):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Invalid token",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        user_id: str = payload.get("sub")
        if user_id is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception
    db = client["NLUsers"]
    user = await db["users"].find_one({"userId": user_id})
    if user is None:
        raise credentials_exception
    return user
