from fastapi import APIRouter, Depends, HTTPException
from app.schemas.curriculum import Curriculum, Lesson
from app.dependencies import get_db_client, get_current_user
from typing import List

router = APIRouter()

@router.get("/{class_id}", response_model=Curriculum)
async def get_curriculum(class_id: str, client = Depends(get_db_client)):
    db = client["NLCurriculum"]
    curriculum = await db["curriculum"].find_one({"class": class_id})
    if not curriculum:
        raise HTTPException(status_code=404, detail="Curriculum not found")
    curriculum["class_"] = curriculum.pop("class")
    return curriculum

@router.get("/my", response_model=Curriculum)
async def get_my_curriculum(current_user = Depends(get_current_user), client = Depends(get_db_client)):
    return await get_curriculum(current_user["class"], client)

# Admin-only update (add auth check if needed, e.g., role=="admin")
@router.put("/{class_id}", response_model=Curriculum)
async def update_curriculum(class_id: str, curriculum: Curriculum, current_user = Depends(get_current_user), client = Depends(get_db_client)):
    if current_user["role"] != "admin":  # Assume admin role
        raise HTTPException(status_code=403, detail="Admin only")
    db = client["NLCurriculum"]
    curriculum_dict = curriculum.dict()
    curriculum_dict["class"] = curriculum_dict.pop("class_")
    await db["curriculum"].update_one({"class": class_id}, {"$set": curriculum_dict}, upsert=True)
    return curriculum

@router.get("/lessons/{lesson_id}", response_model=Lesson)
async def get_lesson(lesson_id: str, current_user = Depends(get_current_user), client = Depends(get_db_client)):
    db = client["NLCurriculum"]
    curriculum = await db["curriculum"].find_one({"class": current_user["class"]})
    if not curriculum:
        raise HTTPException(status_code=404, detail="Curriculum not found")
    
    for subject in curriculum["subjects"]:
        for lesson in subject["lessons"]:
            if lesson["lessonId"] == lesson_id:
                return lesson
    raise HTTPException(status_code=404, detail="Lesson not found")
