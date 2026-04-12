from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_

from app.database import get_db
from app.routers.auth import get_current_user
from app.models.user import User
from app.models.session import Session, StudentFeedback
from app.models.course import Batch, BatchStudent

router = APIRouter(prefix="/api/sessions", tags=["Sessions"])

@router.get("/")
async def get_all_sessions(
    role: str = "ADMIN", 
    db: AsyncSession = Depends(get_db), 
    user: User = Depends(get_current_user)
):
    query = select(Session, Batch.schedule_link.label("batch_schedule_link")).outerjoin(Batch, Session.batch_id == Batch.id)

    if user.role in ["SUPER_ADMIN", "ADMIN"]:
        result = await db.execute(query.order_by(Session.start_time.asc()))
    elif user.role == "TRAINER":
        result = await db.execute(
            query.where(Session.trainer_id == user.id).order_by(Session.start_time.asc())
        )
    elif user.role == "STUDENT":
        batch_res = await db.execute(select(BatchStudent.batch_id).where(BatchStudent.student_id == user.id))
        student_batch_ids = [r[0] for r in batch_res.fetchall()]
        if not student_batch_ids:
            return []
        result = await db.execute(
            query.where(Session.batch_id.in_(student_batch_ids)).order_by(Session.start_time.asc())
        )
    else:
        return []

    data = []
    for row in result.all():
        s, batch_link = row
        data.append({
            "id": s.id,
            "title": s.title,
            "description": s.description,
            "batch_id": s.batch_id,
            "trainer_id": s.trainer_id,
            "start_time": s.start_time.isoformat(),
            "end_time": s.end_time.isoformat(),
            "status": s.status,
            "meeting_link": s.meeting_link,
            "resources_url": s.resources_url,
            "batch_schedule_link": batch_link,
            "created_at": s.created_at.isoformat(),
            "updated_at": s.updated_at.isoformat()
        })
    return data

@router.post("/")
async def create_session(
    body: dict, 
    db: AsyncSession = Depends(get_db), 
    user: User = Depends(get_current_user)
):
    if user.role not in ["SUPER_ADMIN", "ADMIN"]:
        raise HTTPException(status_code=403, detail="Not authorized")
        
    s = Session(
        title=body.get("title"),
        description=body.get("description"),
        batch_id=body.get("batch_id"),
        trainer_id=body.get("trainer_id"),
        start_time=datetime.fromisoformat(body.get("start_time").replace("Z", "+00:00")),
        end_time=datetime.fromisoformat(body.get("end_time").replace("Z", "+00:00")),
        meeting_link=body.get("meeting_link"),
        resources_url=body.get("resources_url"),
        status="SCHEDULED"
    )
    db.add(s)
    await db.commit()
    return {"status": "success", "id": s.id}

@router.patch("/{session_id}")
async def update_session_status(
    session_id: str, 
    body: dict, 
    db: AsyncSession = Depends(get_db), 
    user: User = Depends(get_current_user)
):
    result = await db.execute(select(Session).where(Session.id == session_id))
    s = result.scalars().first()
    if not s:
        raise HTTPException(status_code=404, detail="Session not found")
        
    if user.role not in ["SUPER_ADMIN", "ADMIN", "TRAINER"]:
        raise HTTPException(status_code=403, detail="Not authorized")
        
    if "status" in body:
        s.status = body["status"]
    if "meeting_link" in body:
        s.meeting_link = body["meeting_link"]
    if "resources_url" in body:
        s.resources_url = body["resources_url"]
    if "title" in body:
        s.title = body["title"]
    if "description" in body:
        s.description = body["description"]
    if "trainer_id" in body:
        s.trainer_id = body["trainer_id"]
    if "batch_id" in body:
        s.batch_id = body["batch_id"]
    if "start_time" in body:
        s.start_time = datetime.fromisoformat(body["start_time"].replace("Z", "+00:00"))
    if "end_time" in body:
        s.end_time = datetime.fromisoformat(body["end_time"].replace("Z", "+00:00"))
        
    await db.commit()
    return {"status": "success"}

@router.delete("/{session_id}")
async def delete_session(
    session_id: str, 
    db: AsyncSession = Depends(get_db), 
    user: User = Depends(get_current_user)
):
    if user.role not in ["SUPER_ADMIN", "ADMIN"]:
        raise HTTPException(status_code=403, detail="Not authorized")
        
    result = await db.execute(select(Session).where(Session.id == session_id))
    s = result.scalars().first()
    if not s:
        raise HTTPException(status_code=404, detail="Session not found")
        
    await db.delete(s)
    await db.commit()
    return {"status": "success"}

# --- Feedback Endpoints ---
@router.post("/feedback")
async def submit_feedback(
    body: dict, 
    db: AsyncSession = Depends(get_db), 
    user: User = Depends(get_current_user)
):
    if user.role != "STUDENT":
        raise HTTPException(status_code=403, detail="Only students can submit feedback")
        
    f = StudentFeedback(
        target_type=body.get("target_type", "SESSION"),
        target_id=body.get("target_id"),
        submitted_by=user.id,
        rating=int(body.get("rating", 0)),
        comments=body.get("comments"),
        is_anonymous=bool(body.get("is_anonymous", False))
    )
    db.add(f)
    await db.commit()
    return {"status": "success"}

@router.get("/feedback/admin")
async def get_all_feedback(
    db: AsyncSession = Depends(get_db), 
    user: User = Depends(get_current_user)
):
    if user.role not in ["SUPER_ADMIN", "ADMIN"]:
        raise HTTPException(status_code=403, detail="Not authorized")
        
    result = await db.execute(select(StudentFeedback).order_by(StudentFeedback.created_at.desc()))
    feedbacks = result.scalars().all()
    
    # We should enrich this with Student name (if not anonymous) and Target Name
    data = []
    for f in feedbacks:
        entry = {
            "id": f.id,
            "target_type": f.target_type,
            "target_id": f.target_id,
            "rating": f.rating,
            "comments": f.comments,
            "is_anonymous": f.is_anonymous,
            "created_at": f.created_at.isoformat(),
            "student_name": "Anonymous"
        }
        if not f.is_anonymous:
            u_res = await db.execute(select(User.name).where(User.id == f.submitted_by))
            u_name = u_res.scalars().first()
            entry["student_name"] = u_name or "Unknown"
        data.append(entry)
        
    return data
