# routers/users.py
from fastapi import APIRouter, Depends, HTTPException
from app.schemas.user import UserInDB, UserUpdate
from app.dependencies import get_db_client, get_current_user
from typing import List

router = APIRouter()

@router.get("/me", response_model=UserInDB)
async def get_profile(current_user = Depends(get_current_user)):
    # SAFETY FIX: If the DB doc has '_id' but no 'userId', map it.
    if "userId" not in current_user and "_id" in current_user:
        current_user["userId"] = str(current_user["_id"])
    
    # SAFETY FIX: Ensure _id is a string (if present) so it doesn't break Pydantic
    if "_id" in current_user:
        current_user["_id"] = str(current_user["_id"])
        
    return current_user

@router.put("/me", response_model=UserInDB)
async def update_profile(update: UserUpdate, current_user = Depends(get_current_user), client = Depends(get_db_client)):
    db = client["NLUsers"]
    collection = db["users"]
    
    # Use .dict(by_alias=True) so 'class_' becomes 'class' for MongoDB
    update_dict = {k: v for k, v in update.dict(exclude_unset=True, by_alias=True).items() if v is not None}
    
    # The alias handles "class" automatically now, but if you have manual logic:
    if "class_" in update_dict:
        update_dict["class"] = update_dict.pop("class_")
    
    await collection.update_one({"userId": current_user["userId"]}, {"$set": update_dict})
    
    updated_user = await collection.find_one({"userId": current_user["userId"]})
    
    # Apply same safety fixes to the updated user object
    if updated_user and "userId" not in updated_user and "_id" in updated_user:
        updated_user["userId"] = str(updated_user["_id"])
        
    return updated_user

@router.post("/lessons/complete/{lesson_id}")
async def mark_complete(lesson_id: str, current_user = Depends(get_current_user), client = Depends(get_db_client)):
    db = client["NLUsers"]
    collection = db["users"]
    
    # Check if already completed (idempotent)
    if lesson_id not in current_user.get("completedLessons", []):
        await collection.update_one(
            {"userId": current_user["userId"]}, 
            {"$push": {"completedLessons": lesson_id}}
        )
    return {"message": "Lesson marked as completed"}

@router.get("/progress")
async def get_progress(current_user = Depends(get_current_user), client = Depends(get_db_client)):
    db_curr = client["NLCurriculum"]
    # Access 'class' using .get because it might not exist or be named differently
    user_class = current_user.get("class") or current_user.get("class_")
    
    curriculum = await db_curr["curriculum"].find_one({"class": user_class})
    
    # Handle case where curriculum is missing gracefully
    if not curriculum:
        return {
            "completed": len(current_user.get("completedLessons", [])),
            "total": 0,
            "progress_percentage": 0,
            "completed_lessons": current_user.get("completedLessons", [])
        }
    
    total_lessons = sum(len(subject.get("lessons", [])) for subject in curriculum.get("subjects", []))
    completed = len(current_user.get("completedLessons", []))
    progress = (completed / total_lessons) * 100 if total_lessons > 0 else 0
    
    return {
        "completed": completed,
        "total": total_lessons,
        "progress_percentage": progress,
        "completed_lessons": current_user.get("completedLessons", [])
    }
