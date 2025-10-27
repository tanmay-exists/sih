from fastapi import APIRouter, Depends, HTTPException
from app.schemas.user import Session, Quiz, History
from app.dependencies import get_db_client, get_current_user
from datetime import datetime
from typing import List

router = APIRouter(prefix="/history", tags=["history"])

@router.post("/sessions")
async def save_session(duration: int, current_user = Depends(get_current_user), client = Depends(get_db_client)):
    db = client["NLHistory"]
    collection = db["sessions"]
    
    session_dict = {
        "userId": current_user["userId"],
        "timestamp": datetime.utcnow(),
        "duration": duration
    }
    await collection.insert_one(session_dict)
    return {"message": "Session saved"}

@router.post("/quizzes")
async def save_quiz(subject: str, score: str, current_user = Depends(get_current_user), client = Depends(get_db_client)):
    db = client["NLHistory"]
    collection = db["quizzes"]
    
    quiz_dict = {
        "userId": current_user["userId"],
        "timestamp": datetime.utcnow(),
        "subject": subject,
        "score": score
    }
    await collection.insert_one(quiz_dict)
    return {"message": "Quiz saved"}

@router.get("/", response_model=History)
async def get_history(current_user = Depends(get_current_user), client = Depends(get_db_client)):
    db = client["NLHistory"]
    
    # Get recent sessions (last 10, sorted desc)
    sessions_cursor = db["sessions"].find({"userId": current_user["userId"]}).sort("timestamp", -1).limit(10)
    recent_sessions = [Session(**doc) async for doc in sessions_cursor]
    
    # Get recent quizzes (last 10, sorted desc)
    quizzes_cursor = db["quizzes"].find({"userId": current_user["userId"]}).sort("timestamp", -1).limit(10)
    recent_quizzes = [Quiz(**doc) async for doc in quizzes_cursor]
    
    return {"recent_sessions": recent_sessions, "recent_quizzes": recent_quizzes}
