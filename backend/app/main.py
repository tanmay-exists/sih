from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.routers import auth, users, curriculum, tools, teacher
from app.dependencies import get_db_client
from app.routers import history
from app.routers import neuro
import asyncio

app = FastAPI(title="NeuroLearn Backend")

# CORS for frontend (adjust origins)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Your frontend URL
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(auth.router, tags=["auth"])
app.include_router(users.router, prefix="/users", tags=["users"])
app.include_router(curriculum.router, prefix="/curriculum", tags=["curriculum"])
app.include_router(tools.router, tags=["tools"])
app.include_router(history.router)
app.include_router(neuro.router)
app.include_router(teacher.router)

@app.on_event("startup")
async def set_main_loop():
    from app.routers import neuro
    neuro.MAIN_LOOP = asyncio.get_running_loop()

# Health check
@app.get("/")
async def root():
    return {"message": "NeuroLearn Backend is running"}
