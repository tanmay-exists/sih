# routers/teacher.py
from fastapi import APIRouter, Depends, HTTPException
from app.dependencies import get_db_client, get_current_user
from typing import List, Dict, Any
import logging

router = APIRouter(prefix="/teacher", tags=["teacher"])
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def parse_score(score_str: str) -> float:
    """Converts '3/5' string to 60.0 float."""
    try:
        if "/" in score_str:
            num, den = score_str.split("/")
            return (float(num) / float(den)) * 100
        return float(score_str)
    except:
        return 0.0

@router.get("/dashboard")
async def get_teacher_dashboard(current_user=Depends(get_current_user), client=Depends(get_db_client)):
    # 1. Security Check (Allow Teacher or Admin)
    if current_user.get("role") not in ["teacher", "admin"]:
        raise HTTPException(status_code=403, detail="Access denied")

    db_users = client["NLUsers"]
    db_history = client["NLHistory"]

    # 2. Fetch ALL students (Removed class_id filter)
    # We only filter by role="student" now.
    students_cursor = db_users["users"].find({"role": "student"})
    students_list = [s async for s in students_cursor]
    
    if not students_list:
        return {
            "class_id": "Global",
            "class_average": 0,
            "student_count": 0,
            "roster": []
        }

    student_ids = [s["userId"] for s in students_list]
    
    # 3. Fetch all history for these students
    sessions_cursor = db_history["sessions"].find({"userId": {"$in": student_ids}})
    quizzes_cursor = db_history["quizzes"].find({"userId": {"$in": student_ids}})
    
    sessions = [s async for s in sessions_cursor]
    quizzes = [q async for q in quizzes_cursor]

    # 4. Aggregate Data per Student
    roster_data = []
    
    for student in students_list:
        s_id = student["userId"]
        
        # Filter student specific data
        s_sessions = [x for x in sessions if x["userId"] == s_id]
        s_quizzes = [x for x in quizzes if x["userId"] == s_id]
        
        # Calculate Stats
        total_minutes = sum(s.get("duration", 0) for s in s_sessions) / 60
        
        quiz_scores = [parse_score(q.get("score", "0/1")) for q in s_quizzes]
        avg_score = sum(quiz_scores) / len(quiz_scores) if quiz_scores else 0
        
        # Determine "Engagement" status
        status = "Disengaged"
        if avg_score > 80: status = "Focused"
        elif avg_score > 50: status = "Engaged"
        elif len(s_sessions) > 0: status = "Engaged" # Logged in but low score

        # Handle name safely
        full_name = "Unknown Student"
        name_obj = student.get('name')
        if isinstance(name_obj, dict):
            full_name = f"{name_obj.get('firstName', '')} {name_obj.get('lastName', '')}".strip()
        elif isinstance(name_obj, str):
             full_name = name_obj
        
        if not full_name: 
            full_name = student.get("username", "Unknown")

        roster_data.append({
            "id": s_id,
            "name": full_name,
            "email": student.get("email", "No Email"),
            "status": status,
            "attention": round(avg_score, 1),
            "total_sessions": len(s_sessions),
            "total_time_mins": round(total_minutes, 1),
            "history": {
                "sessions": [{"date": s["timestamp"], "duration": s["duration"]} for s in s_sessions],
                "quizzes": [{"subject": q.get("subject", "General"), "score": parse_score(q.get("score", "0")), "raw_score": q.get("score", "0"), "date": q["timestamp"]} for q in s_quizzes]
            }
        })

    # 5. Calculate Global Averages
    class_avg = sum(s["attention"] for s in roster_data) / len(roster_data) if roster_data else 0

    return {
        "class_id": "All Classes", # Static label since we are fetching everyone
        "class_average": round(class_avg, 1),
        "student_count": len(roster_data),
        "roster": roster_data
    }
