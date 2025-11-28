from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from app.schemas.user import Session, Quiz, History
from app.dependencies import get_db_client, get_current_user
from datetime import datetime
from typing import List

router = APIRouter(prefix="/history", tags=["history"])

class HistoryInput(BaseModel):
    sessions: List[Session] = []
    quizzes: List[Quiz] = []

# Updated to accept subject (defaulting to General Study if missing)
@router.post("/sessions")
async def save_session(duration: int, subject: str = "General Study", current_user=Depends(get_current_user), client=Depends(get_db_client)):
    db = client["NLHistory"]
    collection = db["sessions"]
    
    session_dict = {
        "userId": current_user["userId"],
        "timestamp": datetime.utcnow(),
        "duration": duration,
        "subject": subject  # <--- NEW: Saving subject
    }
    await collection.insert_one(session_dict)
    return {"message": "Session saved"}

@router.post("/quizzes")
async def save_quiz(subject: str, score: str, current_user=Depends(get_current_user), client=Depends(get_db_client)):
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
async def get_history(current_user=Depends(get_current_user), client=Depends(get_db_client)):
    db = client["NLHistory"]
    
    # Get recent sessions (last 10, sorted desc)
    sessions_cursor = db["sessions"].find({"userId": current_user["userId"]}).sort("timestamp", -1).limit(10)
    sessions = [Session(**doc) async for doc in sessions_cursor]
    
    # Get recent quizzes (last 10, sorted desc)
    quizzes_cursor = db["quizzes"].find({"userId": current_user["userId"]}).sort("timestamp", -1).limit(10)
    quizzes = [Quiz(**doc) async for doc in quizzes_cursor]
    
    return {"recent_sessions": sessions, "recent_quizzes": quizzes}

@router.post("/")
async def save_history(history: HistoryInput, current_user=Depends(get_current_user), client=Depends(get_db_client)):
    db = client["NLHistory"]
    user_id = current_user["userId"]
    
    # Replace sessions
    await db["sessions"].delete_many({"userId": user_id})
    if history.sessions:
        await db["sessions"].insert_many([
            {
                "userId": user_id, 
                "timestamp": s.timestamp, 
                "duration": s.duration,
                "subject": s.subject # <--- NEW: Include subject in bulk insert
            }
            for s in history.sessions
        ])
    
    # Replace quizzes
    await db["quizzes"].delete_many({"userId": user_id})
    if history.quizzes:
        await db["quizzes"].insert_many([
            {
                "userId": user_id, 
                "timestamp": q.timestamp, 
                "subject": q.subject, 
                "score": q.score
            }
            for q in history.quizzes
        ])
    
    return {"message": "History saved"}
