from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from app.middleware.auth import get_optional_user
from app.models.user import User, Role
from app.models.attendance import Attendance, LeaveRequest
from app.models.project import Task
from app.models.course import Batch
from sqlalchemy import func, select, or_, and_
from app.database import get_db
from sqlalchemy.ext.asyncio import AsyncSession
import os
import httpx
import json
import asyncio
from pydantic import BaseModel
from typing import List, Optional

router = APIRouter(prefix="/api/ai", tags=["AI Assistant"])

class ChatMessage(BaseModel):
    role: str
    content: str

class ChatRequest(BaseModel):
    message: str
    history: Optional[List[ChatMessage]] = []

@router.post("/chat")
async def chat_with_assistant(
    body: ChatRequest,
    user: Optional[User] = Depends(get_optional_user),
    db: AsyncSession = Depends(get_db)
):
    api_key = os.environ.get("GROQ_API_KEY")
    if not api_key:
        return StreamingResponse(iter(["Error: GROQ_API_KEY is not set. Please check server environment variables."]), media_type="text/plain")

    # Persona & Context
    persona = "GUEST"
    context = ""
    
    if user:
        if user.role == Role.SUPER_ADMIN:
            persona = "ADMIN"
            studs = await db.execute(select(func.count(User.id)).where(User.role == Role.STUDENT))
            active_batches = await db.execute(select(func.count(Batch.id)).where(Batch.is_active == True))
            context = f"Platform Stats: {studs.scalar()} students, {active_batches.scalar()} active batches."
        elif user.role == Role.STUDENT:
            persona = "STUDENT"
            att = await db.execute(select(func.count(Attendance.id)).where(Attendance.student_id == user.id, Attendance.status == "PRESENT"))
            tasks = await db.execute(select(func.count(Task.id)).where(Task.assigned_to == user.id, Task.status != "COMPLETED"))
            context = f"Student Profile: {user.name}, Attendance: {att.scalar()} sessions present, Pending Tasks: {tasks.scalar()}."
        else:
            persona = "STAFF"

    if persona == "GUEST":
        system_prompt = "You are the AppTechno AI Guide. Tone: Friendly, welcoming. Goal: Help visitors learn about courses and register."
    elif persona == "ADMIN":
        system_prompt = f"You are the AppTechno Data Assistant. Tone: Precise, analytical. Context: {context}. Help the admin with system insights."
    elif persona == "STUDENT":
        system_prompt = f"You are the AppTechno Strict Mentor. Tone: Firm, results-driven. Context: {context}. Goal: Push the student to complete tasks and attend sessions. Mention stats if they are low."
    else:
        system_prompt = f"You are the AppTechno Professional Assistant. Help {user.name if user else 'user'} with their duties."

    messages = [{"role": "system", "content": system_prompt}]
    if body.history:
        for msg in body.history[-5:]: # Keep last 5 messages for context
            messages.append({"role": msg.role, "content": msg.content})
    
    messages.append({"role": "user", "content": body.message})

    async def generate():
        async with httpx.AsyncClient(timeout=60.0) as client:
            try:
                username = user.name if user else "Guest"
                print(f"DEBUG: AI Request for {username} ({persona}) - Message: {body.message}")
                async with client.stream(
                    "POST",
                    "https://api.groq.com/openai/v1/chat/completions",
                    headers={
                        "Authorization": f"Bearer {api_key}",
                        "Content-Type": "application/json"
                    },
                    json={
                        "model": "llama-3.3-70b-versatile",
                        "messages": messages,
                        "temperature": 0.7,
                        "max_tokens": 1024,
                        "stream": True
                    }
                ) as response:
                    if response.status_code != 200:
                        err_body = await response.aread()
                        print(f"ERROR: Groq API returned {response.status_code} - {err_body}")
                        yield f"Error: AI service returned {response.status_code}. Details: {err_body.decode()}"
                        return

                    async for line in response.aiter_lines():
                        if line.startswith("data: "):
                            data_str = line[6:]
                            if data_str == "[DONE]":
                                break
                            try:
                                chunk = json.loads(data_str)
                                content = chunk["choices"][0]["delta"].get("content", "")
                                if content:
                                    yield content
                            except:
                                continue
            except Exception as e:
                print(f"ERROR in AI generate: {str(e)}")
                yield f"Error: {str(e)}"

    return StreamingResponse(generate(), media_type="text/plain")
