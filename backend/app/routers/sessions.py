from datetime import datetime, timedelta
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete, and_, or_, func
from app.utils.email import send_session_notification

from app.database import get_db
from app.routers.auth import get_current_user
from app.models.user import User

router = APIRouter(prefix="/api/sessions", tags=["Sessions"])


async def check_trainer_conflict(db: AsyncSession, trainer_id: str, s_time: datetime, e_time: datetime, exclude_session_id: str = None):
    """Check if trainer is already booked during this time slot."""
    from app.models.session import Session
    query = select(Session).where(
        and_(
            Session.trainer_id == trainer_id,
            Session.status != "CANCELLED",
            or_(
                and_(Session.start_time <= s_time, Session.end_time > s_time),
                and_(Session.start_time < e_time, Session.end_time >= e_time),
                and_(Session.start_time >= s_time, Session.end_time <= e_time)
            )
        )
    )
    if exclude_session_id:
        query = query.where(Session.id != exclude_session_id)
    result = await db.execute(query)
    return result.scalars().first()


@router.get("/")
async def get_all_sessions(
    role: str = "ADMIN",
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user)
):
    from app.models.session import Session, SessionAttendee
    from app.models.course import Batch, BatchStudent

    query = select(Session, Batch.schedule_link.label("batch_schedule_link")).outerjoin(Batch, Session.batch_id == Batch.id)

    if user.role in ["SUPER_ADMIN", "ADMIN"]:
        result = await db.execute(query.order_by(Session.start_time.asc()))
        rows = result.all()
        data = []
        for s, batch_link in rows:
            # Load attendee IDs for admin view (for editing selective sessions)
            attendee_ids = []
            if s.selective_attendance:
                att_res = await db.execute(
                    select(SessionAttendee.student_id).where(SessionAttendee.session_id == s.id)
                )
                attendee_ids = att_res.scalars().all()
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
                "selective_attendance": s.selective_attendance,
                "attendee_ids": list(attendee_ids),
                "created_at": s.created_at.isoformat(),
                "updated_at": s.updated_at.isoformat()
            })
        return data

    elif user.role == "TRAINER":
        result = await db.execute(
            query.where(Session.trainer_id == user.id).order_by(Session.start_time.asc())
        )
        rows = result.all()

    elif user.role == "STUDENT":
        # Student sees a session if:
        # 1. session is NOT selective AND they are in the batch, OR
        # 2. session IS selective AND they are listed in SessionAttendee
        batch_res = await db.execute(select(BatchStudent.batch_id).where(BatchStudent.student_id == user.id))
        student_batch_ids = [r[0] for r in batch_res.fetchall()]

        attendee_session_res = await db.execute(
            select(SessionAttendee.session_id).where(SessionAttendee.student_id == user.id)
        )
        selective_session_ids = [r[0] for r in attendee_session_res.fetchall()]

        if not student_batch_ids and not selective_session_ids:
            return []

        result = await db.execute(
            query.where(
                or_(
                    and_(Session.selective_attendance == False, Session.batch_id.in_(student_batch_ids)) if student_batch_ids else False,
                    Session.id.in_(selective_session_ids) if selective_session_ids else False,
                )
            ).order_by(Session.start_time.asc())
        )
        rows = result.all()
    else:
        return []

    data = []
    for s, batch_link in rows:
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
            "selective_attendance": s.selective_attendance,
            "attendee_ids": [],
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

    selective = bool(body.get("selective_attendance", False))
    attendee_ids: List[str] = body.get("attendee_ids", []) or []

    recurrence = body.get("recurrence", {})
    r_type = recurrence.get("type", "NONE")
    r_count = int(recurrence.get("count", 1))

    from app.models.session import Session, SessionAttendee
    from app.models.course import BatchStudent

    created_sessions = []

    for i in range(r_count):
        current_start = start_time
        current_end = end_time
        if r_type == "DAILY":
            current_start += timedelta(days=i)
            current_end += timedelta(days=i)
        elif r_type == "WEEKLY":
            current_start += timedelta(weeks=i)
            current_end += timedelta(weeks=i)

        conflict = await check_trainer_conflict(db, trainer_id, current_start, current_end)
        if conflict:
            raise HTTPException(
                status_code=409,
                detail=f"Conflict detected for instance {i+1} ({current_start.strftime('%d %b %H:%M')}). Trainer already has: {conflict.title}"
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
            status="SCHEDULED",
            selective_attendance=selective,
        )
        db.add(s)
        await db.flush()  # Get the session ID

        # Create SessionAttendee records for selective sessions
        if selective and attendee_ids:
            for student_id in attendee_ids:
                attendee = SessionAttendee(session_id=s.id, student_id=student_id)
                db.add(attendee)

        created_sessions.append(s)

    await db.commit()

    # Send notifications to selected students or all batch students
    try:
        notify_ids = attendee_ids if selective else None
        background_tasks.add_task(
            trigger_session_notifications, db, batch_id, body.get("title"), start_time, notify_ids
        )
    except Exception:
        pass

    return {"status": "success", "count": len(created_sessions)}


async def trigger_session_notifications(
    db: AsyncSession, batch_id: str, title: str, start_time: datetime, notify_ids: Optional[List[str]] = None
):
    from app.models.course import BatchStudent
    try:
        if notify_ids:
            # Selective: notify only specified students
            res = await db.execute(
                select(User.email).where(User.id.in_(notify_ids))
            )
        else:
            # All students in the batch
            res = await db.execute(
                select(User.email).join(BatchStudent, User.id == BatchStudent.student_id).where(BatchStudent.batch_id == batch_id)
            )
        emails = res.scalars().all()
        for email in emails:
            send_session_notification(email, title, start_time.strftime("%d %b %Y, %I:%M %p"))
    except Exception as e:
        print(f"[trigger_session_notifications] Error: {e}")


@router.patch("/{session_id}")
async def update_session_status(
    session_id: str,
    body: dict,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user)
):
    from app.models.session import Session, SessionAttendee
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
    if "batch_id" in body:
        s.batch_id = body["batch_id"]

    if "start_time" in body or "end_time" in body or "trainer_id" in body:
        new_start = datetime.fromisoformat(body.get("start_time", s.start_time.isoformat()).replace("Z", "+00:00"))
        new_end = datetime.fromisoformat(body.get("end_time", s.end_time.isoformat()).replace("Z", "+00:00"))
        new_trainer = body.get("trainer_id", s.trainer_id)
        conflict = await check_trainer_conflict(db, new_trainer, new_start, new_end, exclude_session_id=session_id)
        if conflict:
            raise HTTPException(status_code=409, detail=f"Conflict detected. Trainer is already busy with: {conflict.title}")
        s.start_time = new_start
        s.end_time = new_end
        s.trainer_id = new_trainer

    # Handle selective attendance update
    if "selective_attendance" in body:
        s.selective_attendance = bool(body["selective_attendance"])

    if "attendee_ids" in body:
        # Replace all attendees for this session
        await db.execute(delete(SessionAttendee).where(SessionAttendee.session_id == session_id))
        if s.selective_attendance:
            for student_id in (body["attendee_ids"] or []):
                db.add(SessionAttendee(session_id=session_id, student_id=student_id))

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
    from app.models.session import Session, SessionAttendee
    result = await db.execute(select(Session).where(Session.id == session_id))
    s = result.scalars().first()
    if not s:
        raise HTTPException(status_code=404, detail="Session not found")
    await db.execute(delete(SessionAttendee).where(SessionAttendee.session_id == session_id))
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
@router.get("/feedback/saturday-status")
async def get_saturday_feedback_status(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user)
):
    if user.role != "STUDENT":
        return {"is_saturday": False, "has_submitted": True, "should_block": False, "pending_count": 0}

    from app.models.session import StudentFeedback
    from app.models.project import Violation, ViolationType
    from app.models.course import BatchStudent
    
    now = datetime.utcnow()
    is_saturday = now.weekday() == 5
    
    # Calculate current week's Saturday start
    last_saturday = (now - timedelta(days=(now.weekday() - 5) % 7)).replace(hour=0, minute=0, second=0, microsecond=0)
    if is_saturday:
        last_saturday = now.replace(hour=0, minute=0, second=0, microsecond=0)
    
    # 1. Get total required feedbacks (count of active batches)
    batch_res = await db.execute(select(func.count(BatchStudent.batch_id)).where(BatchStudent.student_id == user.id))
    total_required = batch_res.scalar() or 0
    
    # 2. Get submitted feedbacks for this week
    f_res = await db.execute(
        select(func.count(StudentFeedback.id)).where(
            StudentFeedback.submitted_by == user.id,
            StudentFeedback.created_at >= last_saturday
        )
    )
    submitted_count = f_res.scalar() or 0
    
    # Logic: Block if Saturday AND ZERO feedbacks submitted
    should_block = is_saturday and submitted_count == 0
    
    # 3. Automatic Consolidated Violation Logic (Sunday Check)
    if now.weekday() == 6 and submitted_count < total_required:
        # Check if violation already exists for THIS week
        v_check = await db.execute(
            select(Violation).where(
                Violation.student_id == user.id,
                Violation.type == ViolationType.MISSED_FEEDBACK,
                Violation.created_at >= last_saturday
            )
        )
        if not v_check.scalars().first():
            v = Violation(
                student_id=user.id,
                type=ViolationType.MISSED_FEEDBACK,
                title="⚠️ Weekly Feedback Incomplete",
                description=f"System detected {total_required - submitted_count} missing feedback(s) for last Saturday. A violation has been recorded.",
                severity="MEDIUM"
            )
            db.add(v)
            await db.flush()
            
            # 4. Auto-Block Trigger: If 3 missed feedback violations exist, block user
            v_count_res = await db.execute(
                select(func.count(Violation.id)).where(
                    Violation.student_id == user.id,
                    Violation.type == ViolationType.MISSED_FEEDBACK
                )
            )
            total_violations = v_count_res.scalar() or 0
            if total_violations >= 3:
                user.is_blocked = True
                db.add(user)
            
            await db.commit()

    return {
        "is_saturday": is_saturday,
        "submitted_count": submitted_count,
        "total_required": total_required,
        "should_block": should_block,
        "is_blocked": user.is_blocked,
        "current_day": now.strftime("%A")
    }

@router.get("/feedback/trainee-rating")
async def get_trainee_rating(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user)
):
    from app.models.notification import Feedback
    # Calculate average rating for this student from Feedback model
    res = await db.execute(
        select(func.avg(Feedback.rating)).where(Feedback.student_id == user.id)
    )
    avg_rating = res.scalar() or 0.0
    return {"rating": float(avg_rating)}

@router.post("/trainee-feedback")
async def submit_trainee_feedback(
    body: dict,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user)
):
    if user.role != "STUDENT":
        raise HTTPException(status_code=403, detail="Only students can submit self-feedback")
    
    from app.models.notification import Feedback as TraineeFeedback
    from app.models.course import BatchStudent
    
    # Get student's batch
    batch_res = await db.execute(select(BatchStudent.batch_id).where(BatchStudent.student_id == user.id))
    batch_id = batch_res.scalar()
    
    f = TraineeFeedback(
        student_id=user.id,
        batch_id=batch_id or "NO_BATCH",
        week=int(body.get("week", 1)),
        rating=int(body.get("rating", 0)),
        comments=body.get("comments"),
        created_by_id=user.id # Self-evaluation
    )
    db.add(f)
    await db.commit()
    return {"status": "success"}


