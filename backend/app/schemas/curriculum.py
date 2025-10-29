from pydantic import BaseModel
from typing import List

class Lesson(BaseModel):
    lessonId: str
    lessonTitle: str
    videoUrl: str
    articleUrl: str

class Subject(BaseModel):
    subject: str
    lessons: List[Lesson]

class Curriculum(BaseModel):
    class_: str  # class keyword
    subjects: List[Subject]
