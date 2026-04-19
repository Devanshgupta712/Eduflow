from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from typing import List, Optional
import httpx
import os
import json
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, or_
from app.database import get_db
from app.middleware.auth import get_optional_user
from app.models.user import User, Role
from app.models.attendance import Attendance
from app.models.course import Batch, BatchStudent
from app.models.project import Assignment, AssignmentSubmission, Task
from app.utils.ai_prompts import SYSTEM_CONTEXT

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

    # Start with the shared platform knowledge
    system_prompt = SYSTEM_CONTEXT

    # Add role-specific personality and real-time context
    if not user:
        system_prompt += """

[PERSONA — GUEST MODE]: You are a Friendly Guide for AppTechno's landing page.
STRICT RULES FOR GUEST RESPONSES:
1. Keep every response SHORT — maximum 2-3 sentences per answer.
2. Never give long bullet-point lists unless the user specifically asks "list all courses".
3. Be warm and conversational, like a friendly receptionist — not a brochure.
4. After answering, always end with ONE simple follow-up question to keep the conversation going.
5. If asked about courses, briefly mention 1-2 relevant ones and say "Want details on any specific one?"
6. Goal: Guide them toward clicking 'Enroll For Free' or 'Log In'."""
    else:
        # Fetch real-time student context (mirroring training.py chatbot logic)
        user_id = user.id
        user_name = user.name
        user_role = user.role.value if hasattr(user.role, 'value') else str(user.role)
        
        try:
            # 1. Fetch Batches
            batch_res = await db.execute(
                select(Batch.name).join(BatchStudent, BatchStudent.batch_id == Batch.id).where(BatchStudent.student_id == user_id)
            )
            batches = batch_res.scalars().all()
            batch_str = ", ".join(batches) if batches else "None"
            
            # 2. Fetch Attendance
            att_res = await db.execute(select(Attendance.status).where(Attendance.student_id == user_id))
            all_att = att_res.scalars().all()
            present = len([s for s in all_att if (s.value if hasattr(s, 'value') else s) in ('PRESENT', 'LATE')])
            total_att = len(all_att)
            att_pct = int((present / total_att) * 100) if total_att > 0 else 0
            
            # 3. Fetch Assignments
            batch_ids_res = await db.execute(select(BatchStudent.batch_id).where(BatchStudent.student_id == user_id))
            batch_ids = batch_ids_res.scalars().all()
            
            assign_query = select(func.count(Assignment.id))
            if batch_ids:
                assign_query = assign_query.where(or_(Assignment.batch_id.in_(batch_ids), Assignment.student_id == user_id))
            else:
                assign_query = assign_query.where(Assignment.student_id == user_id)
            
            total_assign_res = await db.execute(assign_query)
            total_assign = total_assign_res.scalar() or 0
            
            done_assign_res = await db.execute(select(func.count(AssignmentSubmission.id)).where(AssignmentSubmission.student_id == user_id))
            done_assign = done_assign_res.scalar() or 0
            
            context_block = f"""
[PERSONALIZED CONTEXT FOR VOICE AI]
User: {user_name} ({user_role})
Batches: {batch_str}
Attendance: {att_pct}%
Assignments: {done_assign}/{total_assign}
"""
            if user.role == Role.STUDENT:
                system_prompt += f"\n{context_block}\n[PERSONA]: You are a 'Strict Mentor'. If attendance is < 85% or assignments are pending, mention it firmly but with care."
            elif user.role in [Role.SUPER_ADMIN, Role.ADMIN]:
                # Add platform-wide stats for admin
                s_count = await db.execute(select(func.count(User.id)).where(User.role == Role.STUDENT))
                b_count = await db.execute(select(func.count(Batch.id)))
                system_prompt += f"\n[PLATFORM STATS]: {s_count.scalar()} students, {b_count.scalar()} active batches.\n[PERSONA]: You are a 'Data Analytics Assistant'. Provide concise, data-driven insights."
        except Exception as e:
            print(f"DB Error in AI persona: {e}")
            await db.rollback()
            system_prompt += f"\n[USER]: {user_name} ({user_role})."

    # Build messages for Groq
    messages = [{"role": "system", "content": system_prompt}]
    if body.history:
        for msg in body.history[-10:]: # Keep last 10 turns
            messages.append({"role": msg.role, "content": msg.content})
    messages.append({"role": "user", "content": body.message})

    async def generate():
        async with httpx.AsyncClient(timeout=30.0) as client:
            try:
                async with client.stream(
                    "POST",
                    "https://api.groq.com/openai/v1/chat/completions",
                    headers={"Authorization": f"Bearer {api_key}"},
                    json={
                        "model": "llama-3.1-8b-instant",
                        "messages": messages,
                        "temperature": 0.7,
                        "stream": True
                    }
                ) as resp:
                    if resp.status_code != 200:
                        yield f"Error: AI service returned {resp.status_code}"
                        return
                    async for line in resp.aiter_lines():
                        if line.startswith("data: "):
                            data = line[6:]
                            if data == "[DONE]": break
                            try:
                                chunk = json.loads(data)
                                content = chunk["choices"][0]["delta"].get("content", "")
                                if content: yield content
                            except: continue
            except Exception as e:
                yield f"Connection Error: {str(e)}"

    return StreamingResponse(generate(), media_type="text/plain")
