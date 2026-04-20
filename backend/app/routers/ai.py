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

    from datetime import datetime
    current_time = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

    # Start with the shared platform knowledge
    system_prompt = SYSTEM_CONTEXT + f"\n\n[CURRENT_TIME]: {current_time}"

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
            
            # Fetch latest 3 pending assignments titles
            from sqlalchemy import not_
            pending_titles = []
            if batch_ids:
                pending_res = await db.execute(
                    select(Assignment.title)
                    .where(
                        (Assignment.batch_id.in_(batch_ids)) &
                        not_(Assignment.id.in_(
                            select(AssignmentSubmission.assignment_id).where(AssignmentSubmission.student_id == user_id)
                        ))
                    )
                    .order_by(Assignment.created_at.desc())
                    .limit(3)
                )
                pending_titles = pending_res.scalars().all()
            pending_str = ", ".join(pending_titles) if pending_titles else "None"
            
            # 4. Fetch Primary Course
            from app.models.registration import Registration
            from app.models.course import Course as CourseModel
            course_res = await db.execute(
                select(CourseModel.name)
                .join(Registration, Registration.course_id == CourseModel.id)
                .where(Registration.student_id == user_id)
                .order_by(Registration.created_at.desc())
                .limit(1)
            )
            course_name = course_res.scalar() or "Not Enrolled"
            
            # 5. Get Latest Attendance Status
            latest_att_res = await db.execute(
                select(Attendance.status, Attendance.date)
                .where(Attendance.student_id == user_id)
                .order_by(Attendance.date.desc())
                .limit(1)
            )
            latest_att_row = latest_att_res.first()
            latest_status = "No records"
            if latest_att_row:
                status, date = latest_att_row
                latest_status = f"{status.value if hasattr(status, 'value') else status} on {date}"

            context_block = f"""
[PERSONALIZED CONTEXT FOR VOICE AI]
User: {user_name} ({user_role})
Course: {course_name}
Batches: {batch_str}
Attendance: {att_pct}% (Latest: {latest_status})
Assignments: {done_assign}/{total_assign}
Pending Tasks: {pending_str}
"""
            if user.role == Role.STUDENT:
                system_prompt += f"\n{context_block}\n[PERSONA]: You are {user_name}'s 'Strict Mentor'. You have high standards because you want them to land a 14 LPA job. If attendance is < 90% or there are Pending Tasks, address it FIRMLY. You do not accept excuses. Be disciplined, professional, and push them to excel. Excellence is not an option; it is the requirement."
            elif user.role in [Role.SUPER_ADMIN, Role.ADMIN, Role.TRAINER]:
                # Broaden context for administrative roles
                from app.models.attendance import LeaveRequest
                from app.models.placement import Job
                from app.models.course import Course as CourseModel

                s_count = await db.execute(select(func.count(User.id)).where(User.role == Role.STUDENT))
                b_count = await db.execute(select(func.count(Batch.id)))
                c_count = await db.execute(select(func.count(CourseModel.id)))
                l_count = await db.execute(select(func.count(LeaveRequest.id)).where(LeaveRequest.status == "PENDING"))
                j_count = await db.execute(select(func.count(Job.id)).where(Job.is_active == True))
                
                admin_context = f"""
[ADMIN/TRAINER PLATFORM OVERVIEW]
Total Students: {s_count.scalar()}
Active Batches: {b_count.scalar()}
Total Courses: {c_count.scalar()}
Pending Leave Requests: {l_count.scalar()}
Active Job Postings: {j_count.scalar()}
"""
                system_prompt += f"\n{admin_context}\n[PERSONA]: You are the 'Lead Operations Intelligence Assistant'. You have full access to platform metrics. Provide concise, data-driven insights. Help the {user_role} manage the ecosystem efficiently by highlighting pending actions like leave requests."
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
