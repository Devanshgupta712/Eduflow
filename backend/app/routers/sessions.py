from datetime import datetime, timedelta
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, or_
from app.utils.email import send_session_notification # We will create this

from app.database import get_db
from app.routers.auth import get_current_user
from app.models.user import User
# Models are imported inline inside route functions to avoid circularities

router = APIRouter(prefix="/api/sessions", tags=["Sessions"])

async def check_trainer_conflict(db: AsyncSession, trainer_id: str, s_time: datetime, e_time: datetime, exclude_session_id: str = None):
    """Check if trainer is already booked during this time slot."""
    from app.models.session import Session
    query = select(Session).where(
        and_(
            Session.trainer_id == trainer_id,
            Session.status != "CANCELLED",
            or_(
                # New session starts inside an existing one
                and_(Session.start_time <= s_time, Session.end_time > s_time),
                # New session ends inside an existing one
                and_(Session.start_time < e_time, Session.end_time >= e_time),
                # New session completely wraps an existing one
                and_(Session.start_time >= s_time, Session.end_time <= e_time)
            )
        )
    )
    if exclude_session_id:
        query = query.where(Session.id != exclude_session_id)
        
    result = await db.execute(query)
    conflict = result.scalars().first()
    return conflict
@router.get("/")
async def get_all_sessions(
    role: str = "ADMIN", 
    db: AsyncSession = Depends(get_db), 
    user: User = Depends(get_current_user)
):
    from app.models.session import Session
    from app.models.course import Batch, BatchStudent
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
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db), 
    user: User = Depends(get_current_user)
):
    if user.role not in ["SUPER_ADMIN", "ADMIN"]:
        raise HTTPException(status_code=403, detail="Not authorized")
        
    start_time = datetime.fromisoformat(body.get("start_time").replace("Z", "+00:00"))
    end_time = datetime.fromisoformat(body.get("end_time").replace("Z", "+00:00"))
    trainer_id = body.get("trainer_id")
    batch_id = body.get("batch_id")
    
    # Recurrence logic
    recurrence = body.get("recurrence", {})
    r_type = recurrence.get("type", "NONE") # NONE, DAILY, WEEKLY
    r_count = int(recurrence.get("count", 1))
    
    from app.models.session import Session
    from app.models.course import BatchStudent
    
    created_sessions = []
    
    for i in range(r_count):
        # Calculate times for this instance
        current_start = start_time
        current_end = end_time
        
        if r_type == "DAILY":
            current_start += timedelta(days=i)
            current_end += timedelta(days=i)
        elif r_type == "WEEKLY":
            current_start += timedelta(weeks=i)
            current_end += timedelta(weeks=i)
            
        # 1. Check for conflicts
        conflict = await check_trainer_conflict(db, trainer_id, current_start, current_end)
        if conflict:
            raise HTTPException(
                status_code=409, 
                detail=f"Conflict detected for instance {i+1} ({current_start.strftime('%d %b %H:%M')}). Trainer is already busy with session: {conflict.title}"
            )

        s = Session(
            title=body.get("title"),
            description=body.get("description"),
            batch_id=batch_id,
            trainer_id=trainer_id,
            start_time=current_start,
            end_time=current_end,
            meeting_link=body.get("meeting_link"),
            resources_url=body.get("resources_url"),
            status="SCHEDULED"
        )
        db.add(s)
        created_sessions.append(s)

    await db.commit()
    
    # Send email notification in background
    # (We will send to all students in the batch)
    try:
        background_tasks.add_task(trigger_session_notifications, db, batch_id, body.get("title"), start_time)
    except: pass

    return {"status": "success", "count": len(created_sessions)}

async def trigger_session_notifications(db: AsyncSession, batch_id: str, title: str, start_time: datetime):
    # Get students in batch
    res = await db.execute(
        select(User.email).join(BatchStudent, User.id == BatchStudent.student_id).where(BatchStudent.batch_id == batch_id)
    )
    emails = res.scalars().all()
    for email in emails:
        send_session_notification(email, title, start_time.strftime("%d %b %Y, %I:%M %p"))
@router.patch("/{session_id}")
async def update_session_status(
    session_id: str, 
    body: dict, 
    db: AsyncSession = Depends(get_db), 
    user: User = Depends(get_current_user)
):
    from app.models.session import Session
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
    if "start_time" in body or "end_time" in body or "trainer_id" in body:
        new_start = datetime.fromisoformat(body.get("start_time", s.start_time.isoformat()).replace("Z", "+00:00"))
        new_end = datetime.fromisoformat(body.get("end_time", s.end_time.isoformat()).replace("Z", "+00:00"))
        new_trainer = body.get("trainer_id", s.trainer_id)
        
        conflict = await check_trainer_conflict(db, new_trainer, new_start, new_end, exclude_session_id=session_id)
        if conflict:
            raise HTTPException(status_code=409, detail=f"Conflict detected. Trainer is already busy with session: {conflict.title}")
            
        s.start_time = new_start
        s.end_time = new_end
        s.trainer_id = new_trainer

    if "title" in body:
        s.title = body["title"]
    if "description" in body:
        s.description = body["description"]
    if "batch_id" in body:
        s.batch_id = body["batch_id"]
        
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
        
    from app.models.session import Session
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
        
    from app.models.session import StudentFeedback
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
        
    from app.models.session import StudentFeedback
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
