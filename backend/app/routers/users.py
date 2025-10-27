from fastapi import APIRouter, Depends, HTTPException
from app.schemas.user import UserInDB, UserUpdate
from app.dependencies import get_db_client, get_current_user
from typing import List

router = APIRouter()

@router.get("/me", response_model=UserInDB)
async def get_profile(current_user = Depends(get_current_user)):
    return current_user

@router.put("/me", response_model=UserInDB)
async def update_profile(update: UserUpdate, current_user = Depends(get_current_user), client = Depends(get_db_client)):
    db = client["NLUsers"]
    collection = db["users"]
    
    update_dict = {k: v for k, v in update.dict(exclude_unset=True).items() if v is not None}
    if "class_" in update_dict:
        update_dict["class"] = update_dict.pop("class_")
    
    await collection.update_one({"userId": current_user["userId"]}, {"$set": update_dict})
    updated_user = await collection.find_one({"userId": current_user["userId"]})
    return updated_user

@router.post("/lessons/complete/{lesson_id}")
async def mark_complete(lesson_id: str, current_user = Depends(get_current_user), client = Depends(get_db_client)):
    db = client["NLUsers"]
    collection = db["users"]
    
    # Check if already completed (idempotent)
    if lesson_id not in current_user["completedLessons"]:
        await collection.update_one({"userId": current_user["userId"]}, {"$push": {"completedLessons": lesson_id}})
    return {"message": "Lesson marked as completed"}

@router.get("/progress")
async def get_progress(current_user = Depends(get_current_user), client = Depends(get_db_client)):
    db_curr = client["NLCurriculum"]
    curriculum = await db_curr["curriculum"].find_one({"class": current_user["class"]})
    if not curriculum:
        raise HTTPException(status_code=404, detail="Curriculum not found for class")
    
    total_lessons = sum(len(subject["lessons"]) for subject in curriculum["subjects"])
    completed = len(current_user["completedLessons"])
    progress = (completed / total_lessons) * 100 if total_lessons > 0 else 0
    
    return {
        "completed": completed,
        "total": total_lessons,
        "progress_percentage": progress,
        "completed_lessons": current_user["completedLessons"]
    }
