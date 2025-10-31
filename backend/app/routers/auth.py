# routers/auth.py
from fastapi import APIRouter, Depends, HTTPException, status, Request
from fastapi.responses import RedirectResponse
from google.oauth2 import id_token
from google.auth.transport import requests as google_requests
from app.schemas.user import RegisterForm, LoginForm, Token, Name
from app.dependencies import get_db_client
from app.utils.auth import verify_password, get_password_hash, create_access_token
from datetime import datetime
from dotenv import load_dotenv
import os
import uuid

load_dotenv()

GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID")
GOOGLE_REDIRECT_URI = os.getenv("GOOGLE_REDIRECT_URI")
GOOGLE_CLIENT_SECRET = os.getenv("GOOGLE_CLIENT_SECRET")

router = APIRouter(prefix="/auth", tags=["auth"])

# ========================================
# REGISTER: email + names + password + class_
# ========================================
@router.post("/register", response_model=Token)
async def register(form: RegisterForm, client=Depends(get_db_client)):
    db = client["NLUsers"]
    collection = db["users"]

    # Check if email already exists
    existing = await collection.find_one({"email": form.email})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")

    user_id = str(uuid.uuid4())
    username = form.email.split("@")[0]  # fallback username
    hashed_password = get_password_hash(form.password)

    user_doc = {
        "userId": user_id,
        "username": username,
        "name": {"firstName": form.firstName, "lastName": form.lastName},
        "email": form.email,
        "class_": form.class_,
        "password": hashed_password,
        "role": "student",
        "createdAt": datetime.utcnow(),
        "lastLogin": datetime.utcnow(),
    }

    await collection.insert_one(user_doc)
    access_token = create_access_token(data={"sub": user_id})
    return {"access_token": access_token, "token_type": "bearer"}

# ========================================
# LOGIN: email + password
# ========================================
@router.post("/login", response_model=Token)
async def login(form: LoginForm, client=Depends(get_db_client)):
    db = client["NLUsers"]
    collection = db["users"]

    user = await collection.find_one({"email": form.email})
    if not user or not verify_password(form.password, user.get("password")):
        raise HTTPException(status_code=400, detail="Incorrect email or password")

    await collection.update_one(
        {"userId": user["userId"]},
        {"$set": {"lastLogin": datetime.utcnow()}}
    )

    access_token = create_access_token(data={"sub": user["userId"]})
    return {"access_token": access_token, "token_type": "bearer"}

# ========================================
# GOOGLE SSO
# ========================================
@router.get("/google")
async def google_login(role: str = "student"):
    from requests_oauthlib import OAuth2Session
    oauth = OAuth2Session(
        GOOGLE_CLIENT_ID,
        redirect_uri=GOOGLE_REDIRECT_URI,
        scope=["openid", "email", "profile"],
        state=f"role={role}"
    )
    authorization_url, state = oauth.authorization_url("https://accounts.google.com/o/oauth2/v2/auth")
    return {"authorization_url": authorization_url}

@router.get("/google/callback")
async def google_callback(request: Request, client=Depends(get_db_client)):
    code = request.query_params.get("code")
    state = request.query_params.get("state")
    if not code:
        raise HTTPException(status_code=400, detail="Missing code")

    from requests_oauthlib import OAuth2Session
    oauth = OAuth2Session(GOOGLE_CLIENT_ID, redirect_uri=GOOGLE_REDIRECT_URI)
    token = oauth.fetch_token(
        "https://oauth2.googleapis.com/token",
        client_secret=GOOGLE_CLIENT_SECRET,
        code=code
    )

    id_info = id_token.verify_oauth2_token(token["id_token"], google_requests.Request(), GOOGLE_CLIENT_ID)

    db = client["NLUsers"]
    collection = db["users"]

    role = state.split("=")[1] if state and "=" in state else "student"
    user = await collection.find_one({"googleId": id_info["sub"]})

    if not user:
        user_id = str(uuid.uuid4())
        user_doc = {
            "userId": user_id,
            "username": id_info["email"].split("@")[0],
            "name": {
                "firstName": id_info.get("given_name", ""),
                "lastName": id_info.get("family_name", "")
            },
            "email": id_info["email"],
            "googleId": id_info["sub"],
            "role": role,
            "class_": "10",
            "createdAt": datetime.utcnow(),
            "lastLogin": datetime.utcnow(),
        }
        await collection.insert_one(user_doc)
    else:
        role = user.get("role", role)
        await collection.update_one(
            {"userId": user["userId"]},
            {"$set": {"lastLogin": datetime.utcnow()}}
        )
        user_id = user["userId"]

    access_token = create_access_token(data={"sub": user_id})
    redirect_url = f"http://localhost:5173/?token={access_token}&role={role}"
    return RedirectResponse(url=redirect_url)
