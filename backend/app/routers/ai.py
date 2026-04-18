from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from app.middleware.auth import get_current_user
from app.models.user import User
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
    user: User = Depends(get_current_user)
):
    api_key = os.environ.get("GROQ_API_KEY")
    if not api_key:
        raise HTTPException(status_code=503, detail="AI Assistant not configured.")

    system_prompt = f"""You are AppTechno AI, the official student success assistant for AppTechno Software Solutions.
Your goal is to help students with their technical doubts, platform navigation, and career guidance.
Current User: {user.name} ({user.role})
Institute Context: AppTechno is a premium software training institute specializing in Full Stack Development, Data Science, and AI.

Instructions:
1. Be concise, professional, and encouraging.
2. If the student asks about platform features, guide them clearly.
3. Keep responses short enough for comfortable speech synthesis (2-3 sentences per point).
4. Do not mention that you are an AI unless asked. You are the 'AppTechno Success Agent'.
"""

    messages = [{"role": "system", "content": system_prompt}]
    if body.history:
        for msg in body.history[-5:]: # Keep last 5 messages for context
            messages.append({"role": msg.role, "content": msg.content})
    
    messages.append({"role": "user", "content": body.message})

    async def generate():
        async with httpx.AsyncClient(timeout=60.0) as client:
            try:
                print(f"DEBUG: AI Request for {user.name} - Message: {body.message}")
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
