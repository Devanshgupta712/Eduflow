from datetime import datetime, timedelta, time
import enum
import uuid
import traceback
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, BackgroundTasks
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete, update, func, or_, and_
import bcrypt
from pydantic import BaseModel

from app.database import get_db
from app.middleware.auth import get_current_user, require_roles
from app.models.user import User, Role, AdminPermission
from app.models.course import Course, Batch
from app.models.registration import Registration, Document
from app.models.attendance import LeaveRequest, Attendance, TimeTracking, AttendanceStatus, LeaveStatus, LeaveType
from app.models.notification import Notification, Message, Feedback, Video
from app.models.project import Project, Task, Assignment, AssignmentSubmission, Violation
from app.models.lead import Lead, LeadActivity
from app.models.placement import Job, JobApplication, MockInterview, CommunicationPractice

from app.schemas.schemas import (
    CourseCreate, CourseOut, BatchCreate, BatchOut,
    StudentCreate, StudentOut, LeaveAction, LeaveOut,
    RegistrationCreate, RegistrationOut, DashboardStats,
    UserOut, AdminPasswordChangeRequest,
    AdminPermissionUpdate, AdminPermissionOut
)
from app.models.setting import SystemSetting
from app.utils.email import send_leave_status_email

class AssignBatchRequest(BaseModel):
    batch_id: str

router = APIRouter(prefix="/api/admin", tags=["Admin"])

def parse_flexible_date(date_str: str):
    """Robust date parser for multiple formats."""
    if not date_str: return datetime.now()
    for fmt in ("%Y-%m-%d", "%d-%m-%Y", "%Y-%m-%dT%H:%M:%S.%fZ", "%Y-%m-%dT%H:%M:%SZ"):
        try:
            return datetime.strptime(date_str, fmt)
        except ValueError:
            continue
    try:
        return datetime.fromisoformat(date_str.replace("Z", "+00:00"))
    except:
        return datetime.now()

def parse_times(date_obj: datetime, timeframe: str):
    """Helper to parse '05:00 - 06:00' into start/end datetimes."""
    try:
        parts = timeframe.split('-')
        s_str = parts[0].strip()
        e_str = parts[1].strip()
        s_h, s_m = map(int, s_str.split(':'))
        e_h, e_m = map(int, e_str.split(':'))
        start = date_obj.replace(hour=s_h, minute=s_m, second=0, microsecond=0)
        end = date_obj.replace(hour=e_h, minute=e_m, second=0, microsecond=0)
        return start, end
    except:
        return date_obj, date_obj + timedelta(hours=1)

@router.get("/dashboard")
async def dashboard_stats(
    db: AsyncSession = Depends(get_db),
    _user: User = Depends(require_roles(Role.SUPER_ADMIN, Role.ADMIN)),
):
    from app.models.course import Course, Batch
    from app.models.user import User, Role
    from app.models.lead import Lead
    from app.models.placement import Job
    from app.models.attendance import LeaveRequest

    students = await db.execute(select(func.count(User.id)).where(User.role == Role.STUDENT))
    courses = await db.execute(select(func.count(Course.id)))
    batches = await db.execute(select(func.count(Batch.id)))
    leads = await db.execute(select(func.count(Lead.id)))
    jobs = await db.execute(select(func.count(Job.id)).where(Job.is_active == True))
    pending = await db.execute(select(func.count(LeaveRequest.id)).where(LeaveRequest.status == "PENDING"))

    return DashboardStats(
        total_students=students.scalar() or 0,
        total_courses=courses.scalar() or 0,
        active_batches=batches.scalar() or 0,
        total_leads=leads.scalar() or 0,
        active_jobs=jobs.scalar() or 0,
        pending_leaves=pending.scalar() or 0,
    )



# ─── Courses ──────────────────────────────────────────
@router.get("/courses")
async def list_courses(db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Course).order_by(Course.created_at.desc())
    )
    courses = result.scalars().all()
    out = []
    for c in courses:
        batches_q = await db.execute(select(func.count(Batch.id)).where(Batch.course_id == c.id))
        regs_q = await db.execute(select(func.count(Registration.id)).where(Registration.course_id == c.id))
        out.append(CourseOut(
            id=c.id, name=c.name, description=c.description,
            duration=c.duration, fee=c.fee, is_active=c.is_active,
            created_at=c.created_at,
            batch_count=batches_q.scalar() or 0,
            student_count=regs_q.scalar() or 0,
        ))
    return out



@router.post("/courses", status_code=201)
async def create_course(
    body: CourseCreate,
    db: AsyncSession = Depends(get_db),
    _user: User = Depends(require_roles(Role.SUPER_ADMIN, Role.ADMIN)),
):
    course = Course(name=body.name, description=body.description, duration=body.duration, fee=body.fee)
    db.add(course)
    await db.flush()
    await db.refresh(course)
    return CourseOut(
        id=course.id, name=course.name, description=course.description,
        duration=course.duration, fee=course.fee, is_active=course.is_active,
        created_at=course.created_at,
    )


class CourseUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    duration: Optional[str] = None
    fee: Optional[float] = None
    is_active: Optional[bool] = None

@router.patch("/courses/{course_id}")
async def update_course(
    course_id: str,
    body: CourseUpdate,
    db: AsyncSession = Depends(get_db),
    _user: User = Depends(require_roles(Role.SUPER_ADMIN, Role.ADMIN)),
):
    course = await db.get(Course, course_id)
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")
    if body.name is not None: course.name = body.name
    if body.description is not None: course.description = body.description
    if body.duration is not None: course.duration = body.duration
    if body.fee is not None: course.fee = body.fee
    if body.is_active is not None: course.is_active = body.is_active
    await db.flush()
    return {"status": "updated"}


@router.delete("/courses/{course_id}")
async def delete_course(
    course_id: str,
    db: AsyncSession = Depends(get_db),
    _user: User = Depends(require_roles(Role.SUPER_ADMIN, Role.ADMIN)),
):
    course = await db.get(Course, course_id)
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")
    # Check for active batches
    batch_count = await db.execute(select(func.count(Batch.id)).where(Batch.course_id == course_id))
    if (batch_count.scalar() or 0) > 0:
        raise HTTPException(status_code=400, detail="Cannot delete course with existing batches. Delete the batches first.")
    db.delete(course)
    await db.flush()
    return {"status": "deleted"}


# ─── Batches ──────────────────────────────────────────

@router.get("/batches")
async def list_batches(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user)
):
    from app.models.course import Batch, Course
    from app.models.user import User, Role
    query = select(Batch)
    if user.role == Role.TRAINER:
        query = query.where(Batch.trainer_id == user.id)
        
    result = await db.execute(query.order_by(Batch.created_at.desc()))
    batches = result.scalars().all()
    out = []
    for b in batches:
        course = await db.get(Course, b.course_id)
        trainer = await db.get(User, b.trainer_id) if b.trainer_id else None
        # Inline import to avoid circular dependencies
        from app.models.course import BatchStudent
        stu_q = await db.execute(select(func.count(BatchStudent.id)).where(BatchStudent.batch_id == b.id))
        out.append(BatchOut(
            id=b.id, name=b.name, start_date=b.start_date, end_date=b.end_date,
            is_active=b.is_active,
            schedule_time=b.schedule_time,
            schedule_link=b.schedule_link if hasattr(b, 'schedule_link') else None,
            course_name=course.name if course else "",
            trainer_name=trainer.name if trainer else None,
            student_count=stu_q.scalar() or 0,
        ))
    return out





@router.post("/batches", status_code=201)
async def create_batch(
    body: BatchCreate,
    db: AsyncSession = Depends(get_db),
    _user: User = Depends(require_roles(Role.SUPER_ADMIN, Role.ADMIN)),
):
    course_id = body.course_id if body.course_id else None
    
    batch = Batch(
        course_id=course_id, name=body.name,
        start_date=parse_flexible_date(body.start_date),
        end_date=parse_flexible_date(body.end_date),
        schedule_time=body.schedule_time,
        schedule_link=body.schedule_link if hasattr(body, 'schedule_link') else None,
        trainer_id=body.trainer_id or None,
    )
    from app.models.session import Session
    db.add(batch)
    await db.flush()
    await db.refresh(batch)
    
    # Session Autopilot: Auto-create first session if link provided
    if batch.schedule_link and batch.schedule_time:
        s_time, e_time = parse_times(batch.start_date, batch.schedule_time)
        first_session = Session(
            title=f"Initial Session - {batch.name}",
            description=f"First session for {batch.name}",
            batch_id=batch.id,
            trainer_id=batch.trainer_id,
            start_time=s_time,
            end_time=e_time,
            meeting_link=batch.schedule_link,
            status="SCHEDULED"
        )
        db.add(first_session)
        await db.flush()

    course = await db.get(Course, batch.course_id) if batch.course_id else None
    return BatchOut(
        id=batch.id, name=batch.name, start_date=batch.start_date,
        end_date=batch.end_date, is_active=batch.is_active,
        schedule_time=batch.schedule_time,
        schedule_link=batch.schedule_link,
        course_name=course.name if course else None,
    )

from app.schemas.schemas import BatchUpdate

@router.put("/batches/{batch_id}")
async def update_batch(
    batch_id: str,
    body: BatchUpdate,
    db: AsyncSession = Depends(get_db),
    _user: User = Depends(require_roles(Role.SUPER_ADMIN, Role.ADMIN))
):
    from app.models.course import Batch
    from app.models.session import Session
    batch = await db.get(Batch, batch_id)
    if not batch:
        raise HTTPException(status_code=404, detail="Batch not found")
        


    if body.name is not None: batch.name = body.name
    if body.course_id is not None: 
        batch.course_id = body.course_id if body.course_id else None
    if body.start_date is not None: batch.start_date = parse_flexible_date(body.start_date)
    if body.end_date is not None: batch.end_date = parse_flexible_date(body.end_date)
    if body.schedule_time is not None: batch.schedule_time = body.schedule_time
    if hasattr(body, 'schedule_link') and body.schedule_link is not None: 
        old_link = batch.schedule_link
        batch.schedule_link = body.schedule_link if body.schedule_link else None
        
        # Auto-sync to scheduled sessions if link changed
        if batch.schedule_link != old_link:
            await db.execute(
                update(Session)
                .where(and_(Session.batch_id == batch_id, Session.status == "SCHEDULED"))
                .values(meeting_link=batch.schedule_link)
            )
            
        # Session Autopilot: If a link exists and NO sessions exist for this batch, create the first one
        if batch.schedule_link:
            ses_check = await db.execute(select(Session).where(Session.batch_id == batch_id))
            if not ses_check.scalars().first():
                s_time, e_time = parse_times(batch.start_date, batch.schedule_time or "09:00 - 10:00")
                first_session = Session(
                    title=f"Welcome Session - {batch.name}",
                    batch_id=batch.id,
                    trainer_id=batch.trainer_id,
                    start_time=s_time,
                    end_time=e_time,
                    meeting_link=batch.schedule_link,
                    status="SCHEDULED"
                )
                db.add(first_session)

    if hasattr(body, 'trainer_id') and body.trainer_id is not None: 
        batch.trainer_id = body.trainer_id if body.trainer_id else None
    if body.is_active is not None: batch.is_active = body.is_active

    await db.flush()
    await db.commit()
    return {"status": "updated"}

@router.delete("/batches/{batch_id}")
async def delete_batch(
    batch_id: str,
    db: AsyncSession = Depends(get_db),
    _user: User = Depends(require_roles(Role.SUPER_ADMIN)) # Only Super Admin can delete
):
    batch = await db.get(Batch, batch_id)
    if not batch:
        raise HTTPException(status_code=404, detail="Batch not found")
        
    # Hard cascade delete related records
    from app.models.course import BatchStudent
    from app.models.attendance import Attendance, LeaveRequest
    from app.models.project import Project, Task, Assignment
    from app.models.registration import Registration
    from app.models.notification import Feedback
    
    await db.execute(delete(BatchStudent).where(BatchStudent.batch_id == batch_id))
    await db.execute(delete(Attendance).where(Attendance.batch_id == batch_id))
    await db.execute(delete(LeaveRequest).where(LeaveRequest.batch_id == batch_id))
    
    # Remove batch reference from Registrations instead of deleting them entirely, 
    # since registration is independent now.
    await db.execute(Registration.__table__.update().where(Registration.batch_id == batch_id).values(batch_id=None))
    
    # Feedback (if it has batch_id)
    # Actually Feedback doesn't have batch_id directly in the current model? Wait, course_id and batch_id are in Course, Batch. I'll wrap feedback in try.
    try:
        await db.execute(delete(Feedback).where(Feedback.batch_id == batch_id))
    except Exception:
        pass
    
    await db.execute(delete(Session).where(Session.batch_id == batch_id))
    await db.execute(delete(Video).where(Video.batch_id == batch_id))
    
    # Projects and Tasks
    projects_res = await db.execute(select(Project.id).where(Project.batch_id == batch_id))
    project_ids = projects_res.scalars().all()
    if project_ids:
        await db.execute(delete(Task).where(Task.project_id.in_(project_ids)))
        await db.execute(delete(Assignment).where(Assignment.project_id.in_(project_ids)))
        await db.execute(delete(Project).where(Project.batch_id == batch_id))

    await db.delete(batch)
    await db.commit()
    return {"status": "deleted"}


# ─── Students ─────────────────────────────────────────

@router.get("/users")
async def list_users(
    db: AsyncSession = Depends(get_db),
    _user: User = Depends(require_roles(Role.SUPER_ADMIN, Role.ADMIN))
):
    result = await db.execute(select(User).order_by(User.created_at.desc()))
    users = result.scalars().all()
    return [UserOut.model_validate(u) for u in users]

class UserStatusUpdate(BaseModel):
    is_active: bool

@router.patch("/users/{user_id}/status")
async def update_user_status(
    user_id: str,
    body: UserStatusUpdate,
    db: AsyncSession = Depends(get_db),
    _user: User = Depends(require_roles(Role.SUPER_ADMIN, Role.ADMIN))
):
    target_user = await db.get(User, user_id)
    if not target_user:
        raise HTTPException(status_code=404, detail="User not found")
    if target_user.role == Role.SUPER_ADMIN:
        raise HTTPException(status_code=403, detail="Cannot modify SUPER_ADMIN status")
    
    target_user.is_active = body.is_active
    await db.flush()
    return {"status": "updated", "is_active": target_user.is_active}


@router.patch("/users/{user_id}/password")
async def update_user_password(
    user_id: str,
    body: AdminPasswordChangeRequest,
    db: AsyncSession = Depends(get_db),
    _user: User = Depends(require_roles(Role.SUPER_ADMIN, Role.ADMIN))
):
    target_user = await db.get(User, user_id)
    if not target_user:
        raise HTTPException(status_code=404, detail="User not found")
        
    if _user.role == Role.ADMIN and target_user.role in [Role.SUPER_ADMIN, Role.ADMIN]:
        raise HTTPException(status_code=403, detail="Admins cannot change passwords for other Admins or Super Admins")
        
    if _user.role == Role.SUPER_ADMIN and target_user.role == Role.SUPER_ADMIN:
        raise HTTPException(status_code=403, detail="Cannot change password for SUPER_ADMIN")
        
    from app.routers.auth import get_password_hash
    hashed = get_password_hash(body.new_password)
    target_user.password = hashed
    await db.flush()
    return {"status": "password_updated"}


@router.delete("/users/{user_id}")
async def delete_user(
    user_id: str,
    db: AsyncSession = Depends(get_db),
    _user: User = Depends(require_roles(Role.SUPER_ADMIN)) # Only Super Admin can delete
):
    import traceback
    report = []
    try:
        target_user = await db.get(User, user_id)
        if not target_user:
            raise HTTPException(status_code=404, detail="User not found")
        if target_user.role == Role.SUPER_ADMIN:
            raise HTTPException(status_code=403, detail="Cannot delete SUPER_ADMIN")
        
        # Manual cascade delete for related entities across all modules
        from app.models.notification import Notification, Message, Feedback
        from app.models.attendance import LeaveRequest, TimeTracking, Attendance
        from app.models.lead import Lead, LeadActivity
        from app.models.project import Task, Assignment, AssignmentSubmission, Violation, Project
        from app.models.registration import Document, Registration
        from app.models.placement import JobApplication, AssessmentSubmission, MockInterview, CommunicationPractice
        from app.models.user import AdminPermission
        from app.models.course import Batch, BatchStudent
        
        # 1. DELETE records where user is the primary subject
        entities = [
            (Notification, "Notification", "user_id"),
            (LeaveRequest, "LeaveRequest", "user_id"),
            (TimeTracking, "TimeTracking", "user_id"),
            (Attendance, "Attendance", "student_id"),
            (BatchStudent, "BatchStudent", "student_id"),
            (Registration, "Registration", "student_id"),
            (Document, "Document", "student_id"),
            (Feedback, "Feedback", "student_id"),
            (Violation, "Violation", "student_id"),
            (AssignmentSubmission, "AssignmentSubmission", "student_id"),
            (LeadActivity, "LeadActivity", "user_id"),
            (AdminPermission, "AdminPermission", "user_id"),
            (JobApplication, "JobApplication", "student_id"),
            (AssessmentSubmission, "AssessmentSubmission", "student_id"),
            (MockInterview, "MockInterview", "student_id"),
            (CommunicationPractice, "CommunicationPractice", "student_id"),
        ]

        for model, name, field in entities:
            try:
                attr = getattr(model, field)
                await db.execute(delete(model).where(attr == user_id))
                report.append(f"Cleared {name}")
            except Exception as e:
                report.append(f"Failed {name}: {str(e)}")

        # Messages (sender or recipient)
        try:
            await db.execute(delete(Message).where(or_(Message.sender_id == user_id, Message.recipient_id == user_id)))
            report.append("Cleared Messages")
        except Exception as e:
            report.append(f"Failed Messages: {str(e)}")

        # 2. NULLIFY references
        try:
            await db.execute(Lead.__table__.update().where(Lead.assigned_to_id == user_id).values(assigned_to_id=None))
            report.append("Nullified Lead")
        except Exception as e:
            report.append(f"Failed Nullify Lead: {str(e)}")

        try:
            await db.execute(Batch.__table__.update().where(Batch.trainer_id == user_id).values(trainer_id=None))
            report.append("Nullified Batch")
        except Exception as e:
            report.append(f"Failed Nullify Batch: {str(e)}")

        try:
            await db.execute(Project.__table__.update().where(Project.trainer_id == user_id).values(trainer_id=None))
            report.append("Nullified Project")
        except Exception as e:
            report.append(f"Failed Nullify Project: {str(e)}")

        try:
            await db.execute(Task.__table__.update().where(Task.assigned_by == user_id).values(assigned_by=None))
            report.append("Nullified Task")
        except Exception as e:
            report.append(f"Failed Nullify Task: {str(e)}")

        try:
            await db.execute(Assignment.__table__.update().where(Assignment.assigned_by == user_id).values(assigned_by=None))
            report.append("Nullified Assignment")
        except Exception as e:
            report.append(f"Failed Nullify Assignment: {str(e)}")

        # Finally delete user
        await db.delete(target_user)
        await db.commit()
        return {"status": "deleted", "report": report}

    except Exception as e:
        await db.rollback()
        from fastapi.responses import JSONResponse
        return JSONResponse(
            status_code=500,
            content={
                "error": str(e),
                "trace": traceback.format_exc(),
                "report": report
            }
        )
        
    return {"status": "deleted"}


# ─── Admin Permissions ────────────────────────────────

@router.get("/users/all-permissions")
async def get_all_permissions(
    db: AsyncSession = Depends(get_db),
    _user: User = Depends(require_roles(Role.SUPER_ADMIN))
):
    """Get all admins and trainers with their current permission settings."""
    result = await db.execute(
        select(User).where(User.role.in_([Role.ADMIN, Role.TRAINER])).order_by(User.role, User.name)
    )
    users = result.scalars().all()
    out = []
    for u in users:
        perm_result = await db.execute(select(AdminPermission).where(AdminPermission.user_id == u.id))
        perm = perm_result.scalars().first()
        out.append({
            "user_id": u.id,
            "name": u.name,
            "email": u.email,
            "role": u.role.value,
            "permissions": {
                "manage_users": perm.manage_users if perm else False,
                "manage_batches": perm.manage_batches if perm else False,
                "manage_courses": perm.manage_courses if perm else False,
                "manage_leaves": perm.manage_leaves if perm else False,
            }
        })
    return out


@router.get("/users/{user_id}/permissions", response_model=AdminPermissionOut)
async def get_admin_permissions(
    user_id: str,
    db: AsyncSession = Depends(get_db),
    _user: User = Depends(require_roles(Role.SUPER_ADMIN))
):
    target_user = await db.get(User, user_id)
    if not target_user or target_user.role not in [Role.ADMIN, Role.TRAINER]:
        raise HTTPException(status_code=404, detail="Admin or Trainer not found")
        
    perm_result = await db.execute(select(AdminPermission).where(AdminPermission.user_id == user_id))
    perm = perm_result.scalars().first()
    
    if not perm:
        perm = AdminPermission(user_id=user_id)
        db.add(perm)
        await db.flush()
        
    return perm


@router.put("/users/{user_id}/permissions", response_model=AdminPermissionOut)
async def update_admin_permissions(
    user_id: str,
    body: AdminPermissionUpdate,
    db: AsyncSession = Depends(get_db),
    _user: User = Depends(require_roles(Role.SUPER_ADMIN))
):
    target_user = await db.get(User, user_id)
    if not target_user or target_user.role not in [Role.ADMIN, Role.TRAINER]:
        raise HTTPException(status_code=404, detail="Admin or Trainer not found")
        
    perm_result = await db.execute(select(AdminPermission).where(AdminPermission.user_id == user_id))
    perm = perm_result.scalars().first()
    
    if not perm:
        perm = AdminPermission(user_id=user_id)
        db.add(perm)
        
    perm.manage_users = body.manage_users
    perm.manage_batches = body.manage_batches
    perm.manage_courses = body.manage_courses
    perm.manage_leaves = body.manage_leaves
    
    await db.flush()
    return perm


# ─── Students ─────────────────────────────────────────
@router.get("/students")
async def list_students(
    role: str = "STUDENT", 
    all: str = "", 
    db: AsyncSession = Depends(get_db),
    _user: User = Depends(require_roles(Role.SUPER_ADMIN, Role.ADMIN))
):
    if all == "true":
        result = await db.execute(select(User).order_by(User.created_at.desc()))
    else:
        result = await db.execute(
            select(User).where(User.role == role).order_by(User.created_at.desc())
        )
    users = result.scalars().all()
    
    if not users:
        return []

    user_ids = [u.id for u in users]
    from app.models.attendance import Attendance, LeaveRequest

    att_result = await db.execute(
        select(Attendance.student_id, Attendance.status)
        .where(Attendance.student_id.in_(user_ids))
    )
    attendances = att_result.all()

    att_map = { uid: {'P': 0, 'A': 0} for uid in user_ids }
    for student_id, status in attendances:
        val = status.value if hasattr(status, 'value') else status
        if val in ('PRESENT', 'LATE'):
            att_map[student_id]['P'] += 1
        elif val == 'ABSENT':
            att_map[student_id]['A'] += 1

    leave_result = await db.execute(
        select(LeaveRequest.user_id)
        .where(LeaveRequest.user_id.in_(user_ids), LeaveRequest.status == 'APPROVED')
    )
    leaves = leave_result.scalars().all()
    leave_map = { uid: 0 for uid in user_ids }
    for uid in leaves:
        leave_map[uid] += 1

    response = []
    for u in users:
        p = att_map[u.id]['P']
        a = att_map[u.id]['A']
        total = p + a
        pct = int((p / total) * 100) if total > 0 else 0
        
        s = StudentOut.model_validate(u)
        s.attendance_percentage = pct
        s.days_present = p
        s.days_absent = a
        s.leaves_taken = leave_map[u.id]
        response.append(s)

    return response


@router.get("/students/{user_id}/report")
async def get_student_report(
    user_id: str,
    db: AsyncSession = Depends(get_db),
    _user: User = Depends(require_roles(Role.SUPER_ADMIN, Role.ADMIN))
):
    student = await db.get(User, user_id)
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")

    from app.models.attendance import Attendance, LeaveRequest, TimeTracking
    from app.models.course import Batch, Course
    from app.models.registration import Registration

    att_res = await db.execute(
        select(Attendance.id, Attendance.date, Attendance.status, Batch.name)
        .outerjoin(Batch, Batch.id == Attendance.batch_id)
        .where(Attendance.student_id == user_id)
        .order_by(Attendance.date.desc())
    )
    attendances = att_res.all()

    leave_res = await db.execute(
        select(LeaveRequest).where(LeaveRequest.user_id == user_id).order_by(LeaveRequest.start_date.desc())
    )
    leaves = leave_res.scalars().all()

    time_res = await db.execute(
        select(TimeTracking).where(TimeTracking.user_id == user_id).order_by(TimeTracking.date.desc())
    )
    time_logs = time_res.scalars().all()

    reg_res = await db.execute(
        select(Registration, Course.name, Batch.name)
        .join(Course, Course.id == Registration.course_id)
        .outerjoin(Batch, Batch.id == Registration.batch_id)
        .where(Registration.student_id == user_id)
    )
    registrations = reg_res.all()

    present = sum(1 for a in attendances if (a.status.value if hasattr(a.status, 'value') else a.status) in ('PRESENT', 'LATE'))
    absent = sum(1 for a in attendances if (a.status.value if hasattr(a.status, 'value') else a.status) == 'ABSENT')
    total = present + absent
    pct = int((present / total) * 100) if total > 0 else 0
    total_punch_minutes = sum(t.total_minutes for t in time_logs if t.total_minutes)

    return {
        "student": {
            "id": student.id,
            "name": student.name,
            "student_id": student.student_id,
            "email": student.email,
            "phone": student.phone
        },
        "stats": {
            "attendance_percentage": pct,
            "days_present": present,
            "days_absent": absent,
            "leaves_taken": len([l for l in leaves if (l.status.value if hasattr(l.status, 'value') else l.status) == 'APPROVED']),
            "total_punch_minutes": total_punch_minutes
        },
        "registrations": [
            {
                "id": r[0].id,
                "course_name": r[1],
                "batch_name": r[2] or "Unassigned",
                "fee_amount": r[0].fee_amount,
                "fee_paid": r[0].fee_paid,
                "status": r[0].status.value if hasattr(r[0].status, 'value') else r[0].status
            } for r in registrations
        ],
        "attendance_logs": [
            {
                "id": a.id,
                "date": a.date,
                "status": a.status.value if hasattr(a.status, 'value') else a.status,
                "batch_name": a.name or "Unknown Batch"
            } for a in attendances
        ],
        "leave_requests": [
            {
                "id": l.id,
                "start_date": l.start_date,
                "end_date": l.end_date,
                "reason": l.reason,
                "status": l.status.value if hasattr(l.status, 'value') else l.status,
                "leave_type": l.leave_type.value if hasattr(l.leave_type, 'value') else l.leave_type
            } for l in leaves
        ],
        "time_logs": [
            {
                "id": t.id,
                "date": t.date,
                "login_time": t.login_time,
                "logout_time": t.logout_time,
                "total_minutes": t.total_minutes
            } for t in time_logs
        ]
    }


@router.post("/students", status_code=201)
async def create_student(
    body: StudentCreate,
    db: AsyncSession = Depends(get_db),
    _user: User = Depends(require_roles(Role.SUPER_ADMIN, Role.ADMIN, Role.TRAINER)),
):
    # Check duplicate
    result = await db.execute(select(User).where(User.email == body.email))
    if result.scalars().first():
        raise HTTPException(status_code=400, detail="Email already exists")

    from app.routers.auth import get_password_hash
    hashed = get_password_hash(body.password)
    student_id = None
    if body.role == "STUDENT":
        from sqlalchemy import func
        current_year = datetime.now().year
        pattern = f"APC-{current_year}-%"
        count_q = await db.execute(
            select(User.student_id)
            .where(User.student_id.like(pattern))
            .order_by(User.student_id.desc())
            .limit(1)
        )
        last_sid = count_q.scalar()
        if last_sid:
            try:
                last_num = int(last_sid.split("-")[-1])
                new_num = last_num + 1
            except:
                new_num = 1
        else:
            new_num = 1
        student_id = f"APC-{current_year}-{new_num:04d}"

    user = User(
        email=body.email, password=hashed, name=body.name,
        phone=body.phone, role=body.role, student_id=student_id,
    )
    db.add(user)
    await db.flush()
    await db.refresh(user)
    return StudentOut.model_validate(user)


@router.post("/users/{user_id}/assign-batch")
async def assign_user_batch(
    user_id: str,
    body: AssignBatchRequest,
    db: AsyncSession = Depends(get_db),
    _user: User = Depends(require_roles(Role.SUPER_ADMIN, Role.ADMIN))
):
    # 1. Verify user
    target_user = await db.get(User, user_id)
    if not target_user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # 2. Verify batch
    batch = await db.get(Batch, body.batch_id)
    if not batch:
        raise HTTPException(status_code=404, detail="Batch not found")

    if target_user.role == Role.TRAINER:
        batch.trainer_id = target_user.id
        await db.flush()
        return {"status": "success", "message": f"Trainer {target_user.name} assigned to batch {batch.name}"}
    
    if target_user.role != Role.STUDENT:
        raise HTTPException(status_code=400, detail="User is not a student or trainer")
        
    # 3. Check if already in this batch
    existing = await db.execute(
        select(BatchStudent).where(
            BatchStudent.batch_id == body.batch_id,
            BatchStudent.student_id == user_id
        )
    )
    if existing.scalars().first():
        return {"status": "success", "message": "Student is already in this batch"}
    
    # 4. Link Student to Batch
    link = BatchStudent(batch_id=body.batch_id, student_id=user_id)
    db.add(link)
    
    await db.flush()
    return {"status": "success", "message": f"Student assigned to batch {batch.name}"}


@router.get("/users/{user_id}/details")
async def get_student_details(
    user_id: str,
    db: AsyncSession = Depends(get_db),
    _user: User = Depends(require_roles(Role.SUPER_ADMIN, Role.ADMIN))
):
    student = await db.get(User, user_id)
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")
    
    # Get batches and registrations based on role
    batches = []
    registrations = []
    
    if student.role == Role.TRAINER:
        batch_links_result = await db.execute(
            select(Batch, Course.name.label("course_name"))
            .join(Course, Course.id == Batch.course_id)
            .where(Batch.trainer_id == user_id)
        )
        for b, cname in batch_links_result.all():
            batches.append({
                "id": b.id,
                "name": b.name,
                "course_name": cname
            })
    else:
        batch_links_result = await db.execute(
            select(BatchStudent, Batch.name, Course.name.label("course_name"))
            .join(Batch, Batch.id == BatchStudent.batch_id)
            .join(Course, Course.id == Batch.course_id)
            .where(BatchStudent.student_id == user_id)
        )
        for row in batch_links_result.all():
            batches.append({
                "id": row[0].batch_id,
                "name": row[1],
                "course_name": row[2]
            })

        # Get registrations
        reg_result = await db.execute(
            select(Registration, Course.name)
            .join(Course, Course.id == Registration.course_id)
            .where(Registration.student_id == user_id)
        )
        for row in reg_result.all():
            registrations.append({
                "id": row[0].id,
                "course_id": row[0].course_id,
                "course_name": row[1],
                "status": row[0].status
            })

    return {
        "user": UserOut.model_validate(student),
        "batches": batches,
        "registrations": registrations
    }


@router.delete("/users/{user_id}/batches/{batch_id}")
async def remove_user_batch(
    user_id: str,
    batch_id: str,
    db: AsyncSession = Depends(get_db),
    _user: User = Depends(require_roles(Role.SUPER_ADMIN, Role.ADMIN))
):
    target_user = await db.get(User, user_id)
    if not target_user:
        raise HTTPException(status_code=404, detail="User not found")

    if target_user.role == Role.TRAINER:
        batch = await db.get(Batch, batch_id)
        if batch and batch.trainer_id == user_id:
            batch.trainer_id = None
            await db.flush()
        return {"status": "removed"}

    result = await db.execute(
        delete(BatchStudent).where(
            BatchStudent.student_id == user_id,
            BatchStudent.batch_id == batch_id
        )
    )
    if result.rowcount == 0:
        raise HTTPException(status_code=404, detail="Batch link not found")
    
    await db.flush()
    return {"status": "success", "message": "Student removed from batch"}


# ─── Registrations ────────────────────────────────────
@router.get("/registrations")
async def list_registrations(db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Registration, User.name, User.email, User.student_id, Course.name, Batch.name)
        .join(User, User.id == Registration.student_id)
        .join(Course, Course.id == Registration.course_id)
        .outerjoin(Batch, Batch.id == Registration.batch_id)
    )
    regs = []
    for row in result.all():
        r, sname, semail, sid, cname, bname = row
        regs.append(RegistrationOut(
            id=r.id,
            student_name=sname,
            student_email=semail,
            student_sid=sid,
            course_name=cname,
            batch_name=bname,
            fee_amount=r.fee_amount,
            fee_paid=r.fee_paid,
            status=r.status,
            created_at=r.created_at
        ))
    return regs


@router.post("/registrations")
async def create_registration(
    body: RegistrationCreate,
    db: AsyncSession = Depends(get_db),
    _user: User = Depends(require_roles(Role.SUPER_ADMIN, Role.ADMIN)),
):
    reg = Registration(
        student_id=body.student_id, course_id=body.course_id,
        batch_id=body.batch_id, fee_amount=body.fee_amount, fee_paid=body.fee_paid,
    )
    db.add(reg)
    await db.flush()
    await db.refresh(reg)
    student = await db.get(User, reg.student_id)
    course = await db.get(Course, reg.course_id)
    return RegistrationOut(
        id=reg.id, student_name=student.name if student else "",
        course_name=course.name if course else "",
        fee_amount=reg.fee_amount, fee_paid=reg.fee_paid,
        status=reg.status, created_at=reg.created_at,
    )


@router.delete("/registrations/{registration_id}")
async def delete_registration(
    registration_id: str,
    db: AsyncSession = Depends(get_db),
    _user: User = Depends(require_roles(Role.SUPER_ADMIN, Role.ADMIN)),
):
    result = await db.execute(delete(Registration).where(Registration.id == registration_id))
    if result.rowcount == 0:
        raise HTTPException(status_code=404, detail="Registration not found")
    
@router.get("/search/global")
async def global_search(
    q: str = Query(..., min_length=1),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Role-based Intelligent Global Search.
    Admin/Trainer: Search Students, Batches, Assignments.
    Student: Search Courses, My Assignments.
    """
    results = []
    query = q.lower()

    # 1. ADMIN/TRAINER: Search Students & Batches
    if current_user.role in [Role.SUPER_ADMIN, Role.ADMIN, Role.TRAINER]:
        # Search Students
        search_studs = await db.execute(
            select(User).where(
                (User.role == Role.STUDENT) &
                ((User.name.ilike(f"%{q}%")) | (User.email.ilike(f"%{q}%")) | (User.student_id.ilike(f"%{q}%")))
            ).limit(5)
        )
        for s in search_studs.scalars().all():
            results.append({
                "id": s.id, "title": s.name, "subtitle": f"StudentID: {s.student_id or 'N/A'}",
                "type": "STUDENT", "icon": "👤", "email": s.email
            })

        # Search Batches
        search_batches = await db.execute(
            select(Batch).where(Batch.name.ilike(f"%{q}%")).limit(3)
        )
        for b in search_batches.scalars().all():
            results.append({
                "id": b.id, "title": b.name, "subtitle": "Batch Roster",
                "type": "BATCH", "icon": "👥"
            })

    # 2. EVERYONE: Search Courses
    search_courses = await db.execute(
        select(Course).where((Course.name.ilike(f"%{q}%")) & (Course.is_active == True)).limit(3)
    )
    for c in search_courses.scalars().all():
        results.append({
            "id": c.id, "title": c.name, "subtitle": f"Course: {c.duration or ''}",
            "type": "COURSE", "icon": "📚"
        })

    # 3. STUDENT Mode: Search Assignments
    if current_user.role == Role.STUDENT:
        # Search Assignments related to student
        # Join via batch
        search_assigns = await db.execute(
            select(Assignment)
            .join(BatchStudent, BatchStudent.batch_id == Assignment.batch_id)
            .where((BatchStudent.student_id == current_user.id) & (Assignment.title.ilike(f"%{q}%")))
            .limit(5)
        )
        for a in search_assigns.scalars().all():
            results.append({
                "id": a.id, "title": a.title, "subtitle": "Assignment Task",
                "type": "ASSIGNMENT", "icon": "📝"
            })
    
    # 4. ADMIN Mode: Search All Assignments
    if current_user.role in [Role.SUPER_ADMIN, Role.ADMIN, Role.TRAINER]:
        search_assigns_admin = await db.execute(
            select(Assignment).where(Assignment.title.ilike(f"%{q}%")).limit(3)
        )
        for a in search_assigns_admin.scalars().all():
            results.append({
                "id": a.id, "title": a.title, "subtitle": "Assignment Management",
                "type": "ASSIGNMENT", "icon": "⚙️"
            })
            
    # 5. ADMIN/MARKETING Mode: Search Leads
    if current_user.role in [Role.SUPER_ADMIN, Role.ADMIN, Role.MARKETING]:
        search_leads = await db.execute(
            select(Lead).where((Lead.name.ilike(f"%{q}%")) | (Lead.phone.ilike(f"%{q}%"))).limit(3)
        )
        for l in search_leads.scalars().all():
            results.append({
                "id": l.id, "title": l.name, "subtitle": f"Lead Status: {l.status.value}",
                "type": "LEAD", "icon": "🎯"
            })

    return results


# ─── Leaves ───────────────────────────────────────────
@router.get("/leaves")
async def list_leaves(
    batch_id: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles(Role.SUPER_ADMIN, Role.ADMIN, Role.TRAINER))
):
    query = select(LeaveRequest)

    if current_user.role == Role.TRAINER:
        # Only show leaves from students in the trainer's assigned batches
        from app.models.course import BatchStudent
        batch_result = await db.execute(
            select(Batch.id).where(Batch.trainer_id == current_user.id)
        )
        trainer_batch_ids = batch_result.scalars().all()

        if not trainer_batch_ids:
            return []  # Trainer has no batches assigned

        # Get students in those batches
        student_result = await db.execute(
            select(BatchStudent.student_id).where(BatchStudent.batch_id.in_(trainer_batch_ids))
        )
        student_ids = student_result.scalars().all()

        # Also include trainer's own leave requests
        query = query.where(
            (LeaveRequest.user_id.in_(student_ids)) |
            (LeaveRequest.user_id == current_user.id)
        )
    elif batch_id:
        query = query.where(LeaveRequest.batch_id == batch_id)

    result = await db.execute(query.order_by(LeaveRequest.created_at.desc()))
    leaves = result.scalars().all()
    out = []
    for l in leaves:
        user = await db.get(User, l.user_id)
        approver = await db.get(User, l.approved_by_id) if l.approved_by_id else None
        out.append(LeaveOut(
            id=l.id,
            user_name=user.name if user else "",
            user_role=user.role.value if user else "",
            user_student_id=user.student_id if user else None,
            leave_type=l.leave_type.value if hasattr(l, 'leave_type') and hasattr(l.leave_type, 'value') else str(getattr(l, 'leave_type', 'OTHER')),
            proof_url=l.proof_url,
            start_date=l.start_date, end_date=l.end_date,
            reason=l.reason,
            rejection_reason=getattr(l, 'rejection_reason', None),
            status=l.status.value,
            approved_by_name=approver.name if approver else None,
            created_at=l.created_at,
        ))
    return out



@router.patch("/leaves")
async def action_leave(
    body: LeaveAction,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles(Role.SUPER_ADMIN, Role.ADMIN, Role.TRAINER)),
):
    leave = await db.get(LeaveRequest, body.id)
    if not leave:
        raise HTTPException(status_code=404, detail="Leave request not found")
    
    # Fetch the leave requester
    requester = await db.get(User, leave.user_id)
    if not requester:
         raise HTTPException(status_code=404, detail="User who requested leave not found")

    # Only SUPER_ADMIN can approve/reject trainer leaves
    if requester.role == Role.TRAINER and current_user.role != Role.SUPER_ADMIN:
        raise HTTPException(status_code=403, detail="Only Super Admin can approve or reject trainer leave requests.")

    try:
        new_status = LeaveStatus(body.status)
    except ValueError:
        raise HTTPException(status_code=422, detail=f"Invalid status: {body.status}. Must be PENDING, APPROVED, or REJECTED.")

    old_status = leave.status
    leave.status = new_status
    try:
        leave.approved_by_id = current_user.id
    except Exception:
        pass  # Column may not exist in older DB schema; not critical
    
    if new_status == LeaveStatus.REJECTED:
        leave.rejection_reason = body.rejection_reason
    else:
        leave.rejection_reason = None

    try:
        # Handle Auto-marking attendance if approved and we have a valid batch
        if new_status == LeaveStatus.APPROVED and leave.batch_id:
            current_date = leave.start_date
            while current_date <= leave.end_date:
                att_result = await db.execute(
                    select(Attendance).where(
                        Attendance.student_id == leave.user_id,
                        Attendance.date == current_date
                    )
                )
                att = att_result.scalars().first()
                if att:
                    att.status = AttendanceStatus.ON_LEAVE
                else:
                    new_att = Attendance(
                        student_id=leave.user_id,
                        batch_id=leave.batch_id,
                        date=current_date,
                        status=AttendanceStatus.ON_LEAVE,
                        remarks=f"Auto-marked: Leave Approved ({leave.leave_type})"
                    )
                    db.add(new_att)
                current_date += timedelta(days=1)

        await db.flush()
    except Exception as db_err:
        await db.rollback()
        raise HTTPException(status_code=500, detail=f"Database error while updating leave: {str(db_err)}")

    # Send Email Notification in background (safe — email failure must never block leave action)
    try:
        leave_details = {
            "start_date": leave.start_date.strftime("%Y-%m-%d"),
            "end_date": leave.end_date.strftime("%Y-%m-%d")
        }
        background_tasks.add_task(
            send_leave_status_email,
            requester.email,
            new_status.value,
            leave_details,
            body.rejection_reason
        )
    except Exception as email_err:
        print(f"[Leave Action] Email notification skipped: {email_err}")

    # Create in-app notification for the leave requester
    try:
        if new_status == LeaveStatus.APPROVED:
            notif_title = "✅ Leave Approved"
            notif_message = (
                f"Your leave request ({leave.leave_type}) from "
                f"{leave.start_date.strftime('%d %b')} to {leave.end_date.strftime('%d %b %Y')} "
                f"has been approved."
            )
        elif new_status == LeaveStatus.REJECTED:
            reason_text = f" Reason: {body.rejection_reason}" if body.rejection_reason else ""
            notif_title = "❌ Leave Rejected"
            notif_message = (
                f"Your leave request ({leave.leave_type}) from "
                f"{leave.start_date.strftime('%d %b')} to {leave.end_date.strftime('%d %b %Y')} "
                f"has been rejected.{reason_text}"
            )
        else:
            notif_title = "🔄 Leave Reset"
            notif_message = f"Your leave request ({leave.leave_type}) has been reset to pending."

        notif = Notification(
            user_id=leave.user_id,
            title=notif_title,
            message=notif_message,
            type="LEAVE",
            reference_id=leave.id,
            link="/training/leaves",
            read=False,
        )
        db.add(notif)
        await db.flush()
    except Exception as notif_err:
        print(f"[Leave Action] In-app notification skipped: {notif_err}")

    return {"status": "updated"}



# ─── Notifications ────────────────────────────────────
class SendNotificationRequest(BaseModel):
    title: str
    message: str
    target: str  # "ALL", "USER", or "ROLE"
    user_id: str | None = None
    role: str | None = None

@router.get("/notifications")
async def list_notifications(
    db: AsyncSession = Depends(get_db),
    _user: User = Depends(require_roles(Role.SUPER_ADMIN, Role.ADMIN)),
):
    # Group by title and message for SQLite compatibility to mimic distinct on specific columns
    result = await db.execute(
        select(Notification)
        .where(Notification.reference_id.in_(["admin_broadcast", "admin_direct"]))
        .group_by(Notification.title, Notification.message)
        .order_by(Notification.created_at.desc())
        .limit(50)
    )
    notifs = result.scalars().all()
    return [
        {
            "id": n.id, "title": n.title, "message": n.message,
            "read": n.read, "created_at": n.created_at.isoformat() if n.created_at else None,
        }
        for n in notifs
    ]

@router.delete("/notifications/all")
async def delete_all_notifications(
    db: AsyncSession = Depends(get_db),
    _user: User = Depends(require_roles(Role.SUPER_ADMIN, Role.ADMIN)),
):
    from app.models.notification import Notification
    await db.execute(
        delete(Notification).where(
            Notification.reference_id.in_(["admin_broadcast", "admin_direct"])
        )
    )
    await db.flush()
    return {"status": "deleted_all"}

@router.delete("/notifications/{notification_id}")
async def delete_notification(
    notification_id: str,
    db: AsyncSession = Depends(get_db),
    _user: User = Depends(require_roles(Role.SUPER_ADMIN, Role.ADMIN)),
):
    from app.models.notification import Notification
    result = await db.execute(
        delete(Notification).where(
            Notification.id == notification_id,
            Notification.reference_id.in_(["admin_broadcast", "admin_direct"])
        )
    )
    if result.rowcount == 0:
        raise HTTPException(status_code=404, detail="Notification not found")
    await db.flush()
    return {"status": "deleted"}

@router.post("/notifications/send", status_code=201)
async def send_notification(
    body: SendNotificationRequest,
    db: AsyncSession = Depends(get_db),
    _user: User = Depends(require_roles(Role.SUPER_ADMIN, Role.ADMIN)),
):
    from app.models.notification import Notification

    if body.target == "ALL":
        result = await db.execute(select(User).where(User.is_active == True))
        users = result.scalars().all()
        for u in users:
            n = Notification(user_id=u.id, title=body.title, message=body.message, type="SYSTEM", reference_id="admin_broadcast")
            db.add(n)
        await db.flush()
        return {"status": "sent", "count": len(users)}
        
    elif body.target == "ROLE" and body.role:
        result = await db.execute(select(User).where(User.is_active == True, User.role == body.role))
        users = result.scalars().all()
        if not users:
            raise HTTPException(status_code=404, detail=f"No active users found with role {body.role}")
        
        for u in users:
            n = Notification(user_id=u.id, title=body.title, message=body.message, type="SYSTEM", reference_id="admin_broadcast")
            db.add(n)
        await db.flush()
        return {"status": "sent", "count": len(users)}

    elif body.target == "USER" and body.user_id:
        user = await db.get(User, body.user_id)
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        n = Notification(user_id=user.id, title=body.title, message=body.message, type="SYSTEM", reference_id="admin_direct")

        db.add(n)
        await db.flush()
        return {"status": "sent", "count": 1}
        
    raise HTTPException(status_code=400, detail="Invalid target or missing parameters")


# ─── Database Export ──────────────────────────────────
@router.get("/db-export")
async def export_database(
    db: AsyncSession = Depends(get_db),
    _user: User = Depends(require_roles(Role.SUPER_ADMIN)),
):
    """Export entire database as SQL INSERT statements. SUPER_ADMIN only."""
    import io
    from fastapi.responses import StreamingResponse
    from sqlalchemy import text, inspect as sa_inspect
    from app.database import engine
    
    output = io.StringIO()
    output.write("-- LMS Database Export\n")
    output.write(f"-- Generated at: {datetime.now().isoformat()}\n")
    output.write("-- Format: SQL INSERT statements\n\n")
    
    # Get all table names from metadata
    from app.database import Base
    table_names = list(Base.metadata.tables.keys())
    
    for table_name in sorted(table_names):
        table = Base.metadata.tables[table_name]
        columns = [c.name for c in table.columns]
        
        # Fetch all rows
        result = await db.execute(text(f'SELECT * FROM "{table_name}"'))
        rows = result.fetchall()
        
        if not rows:
            output.write(f"-- Table: {table_name} (0 rows)\n\n")
            continue
        
        output.write(f"-- Table: {table_name} ({len(rows)} rows)\n")
        
        for row in rows:
            values = []
            for i, val in enumerate(row):
                if val is None:
                    values.append("NULL")
                elif isinstance(val, bool):
                    values.append("TRUE" if val else "FALSE")
                elif isinstance(val, (int, float)):
                    values.append(str(val))
                else:
                    # Escape single quotes
                    escaped = str(val).replace("'", "''")
                    values.append(f"'{escaped}'")
            
            cols_str = ", ".join(f'"{c}"' for c in columns)
            vals_str = ", ".join(values)
            output.write(f'INSERT INTO "{table_name}" ({cols_str}) VALUES ({vals_str});\n')
        
        output.write("\n")
    
    output.seek(0)
    filename = f"lms_db_export_{datetime.now().strftime('%Y%m%d_%H%M%S')}.sql"
    
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="application/sql",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )

# ─── System Settings ──────────────────────────────────
class GeofenceSettingsUpdate(BaseModel):
    office_latitude: float
    office_longitude: float
    office_radius_meters: int

@router.get("/settings/geofence")
async def get_geofence_settings(
    db: AsyncSession = Depends(get_db),
    _user: User = Depends(require_roles(Role.SUPER_ADMIN)),
):
    keys = ["office_latitude", "office_longitude", "office_radius_meters"]
    result = await db.execute(select(SystemSetting).where(SystemSetting.key.in_(keys)))
    settings = result.scalars().all()
    
    settings_dict = {s.key: s.value for s in settings}
    return {
        "office_latitude": float(settings_dict.get("office_latitude", 0.0)),
        "office_longitude": float(settings_dict.get("office_longitude", 0.0)),
        "office_radius_meters": int(settings_dict.get("office_radius_meters", 200)),
    }

@router.put("/settings/geofence")
async def update_geofence_settings(
    body: GeofenceSettingsUpdate,
    db: AsyncSession = Depends(get_db),
    _user: User = Depends(require_roles(Role.SUPER_ADMIN)),
):
    updates = {
        "office_latitude": str(body.office_latitude),
        "office_longitude": str(body.office_longitude),
        "office_radius_meters": str(body.office_radius_meters),
    }

    for key, value in updates.items():
        result = await db.execute(select(SystemSetting).where(SystemSetting.key == key))
        setting = result.scalars().first()
        if setting:
            setting.value = value
        else:
            new_setting = SystemSetting(key=key, value=value)
            db.add(new_setting)

    await db.flush()
    return {"status": "success", "message": "Geofence settings updated"}


# ─── Suggestion Box ────────────────────────────────────────

@router.get("/suggestions")
async def get_suggestions(
    is_read: str = "",
    category: str = "",
    db: AsyncSession = Depends(get_db),
    _user: User = Depends(require_roles(Role.SUPER_ADMIN, Role.ADMIN)),
):
    from app.models.notification import Suggestion
    query = select(Suggestion).order_by(Suggestion.created_at.desc())
    if is_read == "true":
        query = query.where(Suggestion.is_read == True)
    elif is_read == "false":
        query = query.where(Suggestion.is_read == False)
    if category:
        query = query.where(Suggestion.category == category)

    result = await db.execute(query)
    suggestions = result.scalars().all()

    out = []
    for s in suggestions:
        student_name = "Anonymous"
        student_sid = None
        user_role = None
        if s.student_id and not s.is_anonymous:
            student = await db.get(User, s.student_id)
            if student:
                student_name = student.name
                student_sid = student.student_id
                user_role = student.role.value if hasattr(student.role, 'value') else str(student.role)
        out.append({
            "id": s.id,
            "student_name": student_name,
            "student_sid": student_sid,
            "user_role": user_role,
            "message": s.message,
            "category": s.category or "General",
            "is_anonymous": s.is_anonymous,
            "is_read": s.is_read,
            "admin_reply": s.admin_reply,
            "created_at": s.created_at.isoformat() if s.created_at else None,
            "screenshot_base64": s.screenshot_base64,
            "has_screenshot": bool(s.screenshot_base64),
        })
    return out


@router.patch("/suggestions/{suggestion_id}/read")
async def mark_suggestion_read(
    suggestion_id: str,
    db: AsyncSession = Depends(get_db),
    _user: User = Depends(require_roles(Role.SUPER_ADMIN, Role.ADMIN)),
):
    from app.models.notification import Suggestion
    s = await db.get(Suggestion, suggestion_id)
    if not s:
        raise HTTPException(status_code=404, detail="Suggestion not found")
    s.is_read = True
    await db.commit()
    return {"status": "marked_read"}


@router.patch("/suggestions/{suggestion_id}/reply")
async def reply_to_suggestion(
    suggestion_id: str,
    body: dict,
    db: AsyncSession = Depends(get_db),
    _user: User = Depends(require_roles(Role.SUPER_ADMIN, Role.ADMIN)),
):
    from app.models.notification import Suggestion
    s = await db.get(Suggestion, suggestion_id)
    if not s:
        raise HTTPException(status_code=404, detail="Suggestion not found")
    s.admin_reply = (body.get("reply") or "").strip() or None
    s.is_read = True
    await db.commit()
    return {"status": "replied"}
