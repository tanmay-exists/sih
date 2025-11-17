# routers/tools.py
from fastapi import APIRouter, Depends, HTTPException
from app.dependencies import get_db_client, get_current_user
from app.schemas.curriculum import Lesson
import requests
from bs4 import BeautifulSoup
import google.generativeai as genai
from dotenv import load_dotenv
import os
from motor.motor_asyncio import AsyncIOMotorClient
import json
from pydantic import BaseModel

load_dotenv()
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")

router = APIRouter(prefix="/tools", tags=["tools"])

class ChatbotRequest(BaseModel):
    query: str
    lesson_id: str

async def fetch_article_content(article_url: str) -> str:
    """Fetch article text from URL using requests and BeautifulSoup."""
    try:
        headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
        }
        response = requests.get(article_url, headers=headers, timeout=10)
        response.raise_for_status()
        soup = BeautifulSoup(response.text, "html.parser")
        
        # Try Wikipedia-specific selector first
        content = ""
        mw_content = soup.select_one('.mw-parser-output')
        if mw_content:
            content = mw_content.get_text(strip=True, separator=' ')
        if not content:
            # Fallback: Common selectors
            for elem in soup.select("article, .entry-content, .post-content, .content, p"):
                text = elem.get_text(strip=True)
                if text:
                    content += text + " "
            if not content:
                for p in soup.select("p"):
                    content += p.get_text(strip=True) + " "
        # Limit to ~4000 chars
        return content[:4000]
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch article: {str(e)}")

@router.post("/chatbot")
async def chatbot(request: ChatbotRequest, current_user=Depends(get_current_user), client=Depends(get_db_client)):
    """Chatbot to help understand lessons using Gemini."""
    db = client["NLCurriculum"]
    curriculum = await db["curriculum"].find_one({"class": current_user["class_"]})
    
    lesson = None
    if curriculum:
        for subject in curriculum["subjects"]:
            for l in subject["lessons"]:
                if l["lessonId"] == request.lesson_id:
                    # Assuming Lesson is defined and can be used to validate/structure the dict
                    from app.schemas.curriculum import Lesson
                    lesson = Lesson(**l)
                    break
            if lesson:
                break
    
    # 1. FETCH ARTICLE CONTENT
    article_content = ""
    if lesson:
        try:
            # Re-use the existing function to get context
            article_content = await fetch_article_content(lesson.articleUrl)
        except HTTPException:
            # Silently fail fetching content if the URL is bad, and proceed with a general answer
            pass

    # 2. CONSTRUCT FOCUSED PROMPT
    context = ""
    if article_content:
        # If we have content, explicitly tell the AI to use it
        context = f"Based on the following article content: {article_content}\n\n"
    elif lesson:
        # If we don't have content but know the lesson title
        context = f"The current lesson title is '{lesson.lessonTitle}'. "

    
    genai.configure(api_key=GEMINI_API_KEY)
    model = genai.GenerativeModel('gemini-2.0-flash-001')
    
    try:
        # --- FIX: Inject the article content into the prompt for better focus ---
        full_prompt = (
            f"You are a helpful, expert tutor for students with ADHD. Provide clear, concise answers, using **bold text** and bullet points for key concepts. "
            f"Explain for the lesson {request.lesson_id}: {context} The student's question is: {request.query}"
        )
        
        response = await model.generate_content_async(full_prompt)
        # ------------------------------------------------------------------------
        return {"response": response.text}
    except Exception as e:
        # ... (error handling remains the same) ...
        raise HTTPException(status_code=500, detail=f"Chatbot error: {str(e)}")


@router.get("/fun-fact/{lesson_id}")
async def get_fun_fact(lesson_id: str, current_user=Depends(get_current_user), client=Depends(get_db_client)):
    """Generates a fun, real-world fact about a lesson."""
    db = client["NLCurriculum"]
    curriculum = await db["curriculum"].find_one({"class": current_user["class_"]})
    
    lesson = None
    if curriculum:
        for subject in curriculum["subjects"]:
            for l in subject["lessons"]:
                if l["lessonId"] == lesson_id:
                    lesson = Lesson(**l)
                    break
            if lesson:
                break
                
    if not lesson:
        raise HTTPException(status_code=404, detail="Lesson not found")

    article_content = ""
    try:
        article_content = await fetch_article_content(lesson.articleUrl)
    except HTTPException:
        pass # Continue without article content if fetch fails

    genai.configure(api_key=GEMINI_API_KEY)
    model = genai.GenerativeModel('gemini-2.0-flash-001') # Use a fast model
    
    prompt = (
        f"You are a fun and engaging tutor. The student is studying '{lesson.lessonTitle}'. "
        f"Provide one *short* (2-3 sentences) and *interesting* real-world application or fun fact about this topic. "
        f"Make it surprising and engaging to help them refocus!"
    )
    
    if article_content:
        prompt += f"\n\nHere is some context from their lesson: {article_content[:1000]}"

    try:
        response = await model.generate_content_async(prompt)
        return {"fun_fact": response.text}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Fun fact generation error: {str(e)}")



@router.get("/summarize-and-quiz/{lesson_id}")
async def summarize_and_quiz(lesson_id: str, current_user=Depends(get_current_user), client=Depends(get_db_client)):
    print(f"\n--- [DEBUG] summarize_and_quiz START for {lesson_id} ---")
    
    # ... (Database logic to find lesson remains the same) ...
    db = client["NLCurriculum"]
    curriculum = await db["curriculum"].find_one({"class": current_user["class_"]})
    if not curriculum:
        print("--- [DEBUG] CRASH: Curriculum not found ---")
        raise HTTPException(status_code=404, detail="Curriculum not found")
    
    lesson = None
    for subject in curriculum["subjects"]:
        for l in subject["lessons"]:
            if l["lessonId"] == lesson_id:
                lesson = Lesson(**l)
                break
        if lesson:
            break
    if not lesson:
        print("--- [DEBUG] CRASH: Lesson not found ---")
        raise HTTPException(status_code=404, detail="Lesson not found")
    
    print(f"--- [DEBUG] Lesson found: {lesson.lessonTitle}. Fetching URL: {lesson.articleUrl}")

    # --- SUSPECT #1: Article Scraping ---
    article_content = ""
    try:
        article_content = await fetch_article_content(lesson.articleUrl)
        if not article_content:
            print("--- [DEBUG] CRASH: fetch_article_content returned NO content ---")
            raise HTTPException(status_code=500, detail="No content extracted from article")
        print(f"--- [DEBUG] Article fetched. Length: {len(article_content)} chars ---")
    except Exception as e:
        print(f"--- [DEBUG] CRASH at fetch_article_content: {str(e)} ---")
        # Re-raise the exception to send the 500 error
        raise e

    # Initialize Gemini
    genai.configure(api_key=GEMINI_API_KEY)
    model = genai.GenerativeModel('gemini-2.5-flash')
    
    # --- SUSPECT #2: Summary Generation ---
    summary = ""
    try:
        print("--- [DEBUG] Generating summary... ---")
        summary_response = await model.generate_content_async(
            f"Summarize the following article concisely (200-250 words) for a student with ADHD, focusing on key points: {article_content}. Also mention formulas if any."
        )
        summary = summary_response.text
        print("--- [DEBUG] Summary generated successfully. ---")
    except Exception as e:
        print(f"--- [DEBUG] CRASH at summary generation: {str(e)} ---")
        raise HTTPException(status_code=500, detail=f"Summary generation error: {str(e)}")

    # --- SUSPECT #3: MCQ Generation & JSON Parsing ---
    try:
        print("--- [DEBUG] Generating MCQs... ---")
        mcq_prompt = (
            f"Generate 5 multiple-choice questions based on the article content. "
            f"Each question should have 1 correct answer and 3 incorrect answers. "
            f"Return in JSON format: {{ 'questions': [{{ 'question': str, 'options': [str, str, str, str], 'correct': int (0-3 index) }}] }}. "
            f"Content: {article_content}"
        )
        mcq_response = await model.generate_content_async(mcq_prompt)
        
        mcq_text = mcq_response.text.strip()
        print(f"--- [DEBUG] RAW MCQ Response from Gemini: --- \n{mcq_text}\n----------------------------------")

        if mcq_text.startswith("```json") and mcq_text.endswith("```"):
            mcq_text = mcq_text[7:-3].strip()
        
        # This is the most likely line to crash
        mcqs = json.loads(mcq_text)
        print("--- [DEBUG] MCQs parsed successfully. ---")

        if not isinstance(mcqs, dict) or "questions" not in mcqs or len(mcqs["questions"]) != 5:
            print("--- [DEBUG] CRASH: Invalid MCQ format (not dict or missing 'questions') ---")
            raise HTTPException(status_code=500, detail="Invalid MCQ format")
    
    except json.JSONDecodeError as e:
        print(f"--- [DEBUG] CRASH at json.loads: {str(e)} ---")
        print("--- [DEBUG] The RAW MCQ response above was not valid JSON. ---")
        raise HTTPException(status_code=500, detail=f"MCQ JSON parsing error: {str(e)}")
    except Exception as e:
        print(f"--- [DEBUG] CRASH at MCQ generation: {str(e)} ---")
        raise HTTPException(status_code=500, detail=f"MCQ generation error: {str(e)}")

    print(f"--- [DEBUG] summarize_and_quiz END for {lesson_id} ---")
    
    return {
        "summary": summary,
        "short_cues": summary[:200] + "..." if len(summary) > 200 else summary,
        "mcqs": mcqs["questions"]
    }

@router.get("/suggestions")
async def personalized_suggestions(current_user=Depends(get_current_user), client=Depends(get_db_client)):
    """Personalized learning suggestions based on progress."""
    db = client["NLCurriculum"]
    curriculum = await db["curriculum"].find_one({"class": current_user["class_"]})
    if not curriculum:
        raise HTTPException(status_code=404, detail="Curriculum not found")
    
    suggestions = []
    for subject in curriculum["subjects"]:
        incomplete = [l for l in subject["lessons"] if l["lessonId"] not in current_user.get("completedLessons", [])]
        if incomplete:
            suggestions.append({"subject": subject["subject"], "next_lesson": incomplete[0]})
    
    return {"suggestions": suggestions}

@router.get("/review/{lesson_id}")
async def review_lesson(lesson_id: str, current_user=Depends(get_current_user), client=Depends(get_db_client)):
    """Review a completed lesson."""
    if lesson_id not in current_user.get("completedLessons", []):
        raise HTTPException(status_code=400, detail="Lesson not completed")
    db = client["NLCurriculum"]
    curriculum = await db["curriculum"].find_one({"class": current_user["class_"]})
    if not curriculum:
        raise HTTPException(status_code=404, detail="Curriculum not found")
    
    for subject in curriculum["subjects"]:
        for lesson in subject["lessons"]:
            if lesson["lessonId"] == lesson_id:
                return lesson
    raise HTTPException(status_code=404, detail="Lesson not found")
