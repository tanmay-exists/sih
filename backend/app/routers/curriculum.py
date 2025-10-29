from fastapi import APIRouter, Depends, HTTPException
from app.schemas.curriculum import Curriculum, Lesson
from app.dependencies import get_db_client, get_current_user
from typing import List
import logging

router = APIRouter()

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# --- FIX: MOVED THIS FUNCTION UP ---
@router.get("/my", response_model=Curriculum)
async def get_my_curriculum(current_user=Depends(get_current_user), client=Depends(get_db_client)):
    logger.info(f"Current user data: {current_user}")
    class_id = str(current_user.get("class_", ""))  # Use class_ to match NLUsers.users
    if not class_id:
        logger.error("No class_ found in current_user")
        raise HTTPException(status_code=400, detail="User class not found")
    logger.info(f"Fetching curriculum for user: {current_user.get('userId')}, class: {class_id}")
    # This will now correctly call the get_curriculum function below
    return await get_curriculum(class_id, client) 

# --- FIX: THIS DYNAMIC ROUTE NOW COMES AFTER THE STATIC /my ROUTE ---
@router.get("/{class_id}", response_model=Curriculum)
async def get_curriculum(class_id: str, client=Depends(get_db_client)):
    logger.info(f"Querying curriculum for class_id: {class_id}, type: {type(class_id)}")
    db = client["NLCurriculum"]
    curriculum = await db["curriculum"].find_one({"class": str(class_id)})
    if not curriculum:
        logger.error(f"Curriculum not found for class_id: {class_id}")
        raise HTTPException(status_code=404, detail="Curriculum not found")
    logger.info(f"Found curriculum: {curriculum}")
    curriculum["class_"] = curriculum.pop("class")
    return curriculum

@router.put("/{class_id}", response_model=Curriculum)
async def update_curriculum(class_id: str, curriculum: Curriculum, current_user=Depends(get_current_user), client=Depends(get_db_client)):
    if current_user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Admin only")
    db = client["NLCurriculum"]
    curriculum_dict = curriculum.dict()
    curriculum_dict["class"] = curriculum_dict.pop("class_")
    await db["curriculum"].update_one({"class": class_id}, {"$set": curriculum_dict}, upsert=True)
    return curriculum

@router.get("/lessons/{lesson_id}", response_model=Lesson)
async def get_lesson(lesson_id: str, current_user=Depends(get_current_user), client=Depends(get_db_client)):
    db = client["NLCurriculum"]
    curriculum = await db["curriculum"].find_one({"class": str(current_user["class_"])})
    if not curriculum:
        raise HTTPException(status_code=404, detail="Curriculum not found")
    
    for subject in curriculum["subjects"]:
        for lesson in subject["lessons"]:
            if lesson["lessonId"] == lesson_id:
                return lesson
    raise HTTPException(status_code=404, detail="Lesson not found")
