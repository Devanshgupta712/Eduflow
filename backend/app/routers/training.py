from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File, Form, BackgroundTasks
from sqlalchemy import select, func, and_, or_
from sqlalchemy.ext.asyncio import AsyncSession
from datetime import datetime, timezone, date
import json
import asyncio

from app.database import get_db
from app.middleware.auth import get_current_user, require_roles, get_optional_user
from app.models.user import User, Role
from app.models.attendance import Attendance, LeaveRequest, LeaveStatus, LeaveType
from app.utils.cloudinary import upload_to_cloudinary
from app.models.course import Batch, BatchStudent
from app.models.project import (
    Project, ProjectMilestone, ProjectStatus,
    Task, TaskStatus, TaskPriority,
    Assignment, AssignmentType, AssignmentSubmission,
    Violation, ViolationType, ViolationSeverity, ViolationStatus,
    AssessmentSession,
)
from app.models.notification import Video, Feedback

from app.models.setting import SystemSetting
import uuid
from app.schemas.schemas import LeaveOut
from app.utils.ai_prompts import SYSTEM_CONTEXT

router = APIRouter(prefix="/api/training", tags=["Training"])

# Helper to handle various date/time formats from frontend (simple dates or datetime-local ISO strings)
def parse_dt(dt_str: str):
    if not dt_str: return None
    # Try common formats
    for fmt in ("%Y-%m-%d", "%Y-%m-%dT%H:%M", "%Y-%m-%d %H:%M:%S", "%Y-%m-%dT%H:%M:%S"):
        try:
            return datetime.strptime(dt_str, fmt)
        except ValueError:
            continue
    # Fallback to ISO format if above fail
    try:
        return datetime.fromisoformat(dt_str.replace('Z', '+00:00'))
    except:
        return None

@router.get("/my-trainers")
async def get_my_trainers(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user)
):
    from app.models.course import Batch, BatchStudent
    
    # Get batches where student is enrolled
    bs_query = select(BatchStudent.batch_id).where(BatchStudent.student_id == user.id)
    bs_result = await db.execute(bs_query)
    batch_ids = [r[0] for r in bs_result.fetchall()]
    
    if not batch_ids:
        return []
        
    # Get trainers for those batches
    from app.models.session import StudentFeedback
    
    # Calculate current week's Saturday start
    now = datetime.utcnow()
    last_saturday = (now - timedelta(days=(now.weekday() - 5) % 7)).replace(hour=0, minute=0, second=0, microsecond=0)
    if now.weekday() == 5: # It is Saturday
         last_saturday = now.replace(hour=0, minute=0, second=0, microsecond=0)

    # Get already submitted feedbacks for this week
    f_query = select(StudentFeedback.target_id, StudentFeedback.batch_id).where(
        StudentFeedback.submitted_by == user.id,
        StudentFeedback.created_at >= last_saturday
    )
    f_result = await db.execute(f_query)
    completed = {(r[0], r[1]) for r in f_result.fetchall()}
    
    t_query = (
        select(User.id, User.name, Batch.id.label("batch_id"), Batch.name.label("batch_name"))
        .join(Batch, User.id == Batch.trainer_id)
        .where(Batch.id.in_(batch_ids))
    )
    t_result = await db.execute(t_query)
    trainers = t_result.all()
    
    out = []
    for t_id, t_name, b_id, b_name in trainers:
        if (t_id, b_id) not in completed:
            out.append({
                "id": t_id,
                "batch_id": b_id,
                "name": t_name,
                "batch_name": b_name
            })
    return out

@router.get("/qr-config")
async def get_qr_config(
    db: AsyncSession = Depends(get_db),
    _user: User = Depends(require_roles(Role.SUPER_ADMIN, Role.ADMIN))
):
    try:
        result = await db.execute(select(SystemSetting).where(SystemSetting.key == "active_qr_secret"))
        setting = result.scalars().first()
        
        if not setting:
            # Auto-generate if missing
            new_secret = f"atc_punch_{uuid.uuid4().hex}"
            setting = SystemSetting(key="active_qr_secret", value=new_secret)
            db.add(setting)
            await db.commit()
            await db.refresh(setting)
            
        return {"qr_secret": setting.value}
    except Exception as e:
        print(f"Error in get_qr_config: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/qr-config/regenerate")
async def regenerate_qr_config(
    db: AsyncSession = Depends(get_db),
    _user: User = Depends(require_roles(Role.SUPER_ADMIN, Role.ADMIN))
):
    try:
        new_secret = f"atc_punch_{uuid.uuid4().hex}"
        result = await db.execute(select(SystemSetting).where(SystemSetting.key == "active_qr_secret"))
        setting = result.scalars().first()
        
        if setting:
            setting.value = new_secret
        else:
            setting = SystemSetting(key="active_qr_secret", value=new_secret)
            db.add(setting)
            
        await db.commit()
        return {"qr_secret": new_secret, "message": "New QR secret generated. Old QR codes are now invalid."}
    except Exception as e:
        print(f"Error in regenerate_qr_config: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/punch-settings")
async def get_punch_settings(
    db: AsyncSession = Depends(get_db),
    _user: User = Depends(require_roles(Role.SUPER_ADMIN, Role.ADMIN))
):
    """Get office geolocation settings for punch radius restriction."""
    settings = {}
    for key in ["office_latitude", "office_longitude", "office_radius_meters", "late_threshold_time"]:
        result = await db.execute(select(SystemSetting).where(SystemSetting.key == key))
        setting = result.scalars().first()
        settings[key] = setting.value if setting else None
    
    return {
        "latitude": float(settings["office_latitude"]) if settings["office_latitude"] else None,
        "longitude": float(settings["office_longitude"]) if settings["office_longitude"] else None,
        "radius_meters": float(settings["office_radius_meters"]) if settings["office_radius_meters"] else 200.0,
        "late_threshold_time": settings["late_threshold_time"] or "10:00"
    }


@router.post("/punch-settings")
async def update_punch_settings(
    body: dict,
    db: AsyncSession = Depends(get_db),
    _user: User = Depends(require_roles(Role.SUPER_ADMIN, Role.ADMIN))
):
    """Save office geolocation and radius for punch restriction."""
    updates = {
        "office_latitude": str(body.get("latitude", "")),
        "office_longitude": str(body.get("longitude", "")),
        "office_radius_meters": str(body.get("radius_meters", "200")),
        "late_threshold_time": str(body.get("late_threshold_time", "10:00")),
    }
    
    for key, value in updates.items():
        if not value:
            continue
        result = await db.execute(select(SystemSetting).where(SystemSetting.key == key))
        setting = result.scalars().first()
        if setting:
            setting.value = value
        else:
            setting = SystemSetting(key=key, value=value)
            db.add(setting)
    
    await db.commit()
    return {"status": "success", "message": "Punch settings saved successfully."}


# ─── Attendance ───────────────────────────────────────
@router.get("/batches/{batch_id}/students")
async def get_batch_students(
    batch_id: str,
    date: str = "",
    db: AsyncSession = Depends(get_db),
    _user: User = Depends(get_current_user)
):
    from app.models.course import BatchStudent
    from app.models.user import User
    from app.models.project import Assignment, AssignmentSubmission
    
    # 1. Total assignments assigned to this batch
    batch_assignments = await db.execute(select(Assignment.id).where(Assignment.batch_id == batch_id))
    b_assignment_ids = [r[0] for r in batch_assignments.all()]
    total_activities = len(b_assignment_ids)

    # 1.5. Date validation logic
    batch_obj = await db.get(Batch, batch_id)
    if not batch_obj:
        raise HTTPException(status_code=404, detail="Batch not found")
        
    day_date = None
    if date:
        day_date = parse_dt(date).date()
        if batch_obj.start_date and day_date < batch_obj.start_date.date():
            return [] # No students are eligible before the batch starts

    # 2. Get students
    stmt = (
        select(User).join(BatchStudent, User.id == BatchStudent.student_id)
        .where(BatchStudent.batch_id == batch_id)
        .where(User.role == Role.STUDENT)
    )
    if day_date:
        stmt = stmt.where(func.date(BatchStudent.joined_at) <= day_date)

    result = await db.execute(stmt)
    students = result.scalars().all()
    
    out = []
    for s in students:
        completed = 0
        
        # Check assignment submission
        if b_assignment_ids:
            ca = await db.execute(select(func.count(AssignmentSubmission.id)).where(AssignmentSubmission.assignment_id.in_(b_assignment_ids), AssignmentSubmission.student_id == s.id))
            completed += ca.scalar() or 0

        progress = int((completed / total_activities) * 100) if total_activities > 0 else 100
        
        out.append({
            "id": s.id,
            "name": s.name,
            "email": s.email,
            "student_id": s.student_id,
            "is_active": s.is_active,
            "progress_percentage": progress,
            "completed": completed,
            "total_activities": total_activities
        })
        
    return out

@router.get("/attendance")
async def get_attendance(
    batch_id: str = "",
    student_id: str = "",
    date: str = "",
    db: AsyncSession = Depends(get_db),
    _user: User = Depends(get_current_user),
):
    query = select(Attendance)
    
    # Restrict Trainees (Trainers) to only see their own batch attendance
    from app.models.user import Role
    if hasattr(_user, 'role') and _user.role == Role.TRAINER:
        # Get batches owned by this trainer
        batch_ids_result = await db.execute(select(Batch.id).where(Batch.trainer_id == _user.id))
        owned_batch_ids = [r[0] for r in batch_ids_result.all()]
        
        if batch_id:
            if batch_id not in owned_batch_ids:
                raise HTTPException(status_code=403, detail="You do not have permission to access attendance for this batch.")
            query = query.where(Attendance.batch_id == batch_id)
        else:
            query = query.where(Attendance.batch_id.in_(owned_batch_ids))
    elif batch_id:
        query = query.where(Attendance.batch_id == batch_id)

    if student_id:
        query = query.where(Attendance.student_id == student_id)
    if date:
        day = parse_dt(date)
        query = query.where(func.date(Attendance.date) == day.date())
    result = await db.execute(query.order_by(Attendance.date.desc()).limit(100))
    records = result.scalars().all()
    out = []
    for r in records:
        student = await db.get(User, r.student_id)
        out.append({
            "id": r.id, "student_id": r.student_id,
            "student_name": student.name if student else "Unknown",
            "batch_id": r.batch_id, "date": r.date.isoformat() if r.date else None,
            "status": r.status.value, "remarks": r.remarks,
        })
    return out


import io
import csv
from datetime import date, timedelta
from fastapi.responses import StreamingResponse

@router.get("/attendance/export")
async def export_attendance(
    batch_id: str = "",
    start_date: str = "",
    end_date: str = "",
    db: AsyncSession = Depends(get_db),
    _user: User = Depends(require_roles(Role.SUPER_ADMIN, Role.ADMIN, Role.TRAINER)),
):
    if not batch_id:
        raise HTTPException(status_code=400, detail="batch_id is required for export.")

    # --- Authorization ---
    if _user.role == Role.TRAINER:
        batch_ids_result = await db.execute(select(Batch.id).where(Batch.trainer_id == _user.id))
        owned_batch_ids = [r[0] for r in batch_ids_result.all()]
        if batch_id not in owned_batch_ids:
            raise HTTPException(status_code=403, detail="You do not have permission to export this batch.")

    # --- Resolve batch name ---
    batch_obj = await db.get(Batch, batch_id)
    batch_name = batch_obj.name if batch_obj else batch_id

    # --- Parse date range ---
    s_dt = parse_dt(start_date)
    e_dt = parse_dt(end_date)
    if not s_dt or not e_dt:
        raise HTTPException(status_code=400, detail="start_date and end_date are required (YYYY-MM-DD).")
    start_d = s_dt.date()
    end_d = e_dt.date()
    if start_d > end_d:
        raise HTTPException(status_code=400, detail="start_date must be on or before end_date.")

    # --- Fetch all students in this batch (single query) ---
    students_result = await db.execute(
        select(User, BatchStudent.joined_at)
        .join(BatchStudent, User.id == BatchStudent.student_id)
        .where(BatchStudent.batch_id == batch_id)
        .where(User.role == Role.STUDENT)
        .order_by(User.name)
    )
    students_data = students_result.all()

    if not students_data:
        # Return empty CSV with header
        output = io.StringIO()
        writer = csv.writer(output)
        writer.writerow(["Batch", "Date", "Student ID", "Student Name", "Status", "Remarks"])
        output.seek(0)
        response = StreamingResponse(iter([output.getvalue()]), media_type="text/csv")
        response.headers["Content-Disposition"] = f"attachment; filename=attendance_{batch_id}_{start_date}_to_{end_date}.csv"
        return response

    # --- Fetch all attendance records in range (single query) ---
    records_result = await db.execute(
        select(Attendance)
        .where(Attendance.batch_id == batch_id)
        .where(func.date(Attendance.date) >= start_d)
        .where(func.date(Attendance.date) <= end_d)
    )
    records = records_result.scalars().all()

    # Build a lookup: (student_id, date_str) -> Attendance record
    record_lookup: dict[tuple, Attendance] = {}
    for r in records:
        day_str = r.date.strftime("%Y-%m-%d") if r.date else ""
        record_lookup[(r.student_id, day_str)] = r

    # --- Generate complete report: every day x every student ---
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["Batch", "Date", "Student ID", "Student Name", "Status", "Remarks"])

    current_d = start_d
    while current_d <= end_d:
        day_str = current_d.strftime("%Y-%m-%d")
        
        # Check if entire date is predating the batch
        is_pre_batch = batch_obj and batch_obj.start_date and current_d < batch_obj.start_date.date()
        
        for s, joined_at in students_data:
            rec = record_lookup.get((s.id, day_str))
            
            # Determine Chronological status
            if rec:
                status = rec.status.value
            elif is_pre_batch:
                status = "Pre-Batch"
            elif joined_at and current_d < joined_at.date():
                status = "Not Registered"
            else:
                status = "ABSENT"
                
            remarks = rec.remarks or "" if rec else ""
            writer.writerow([
                batch_name,
                day_str,
                s.student_id or "",
                s.name or "",
                status,
                remarks
            ])
        current_d += timedelta(days=1)

    output.seek(0)
    response = StreamingResponse(iter([output.getvalue()]), media_type="text/csv")
    response.headers["Content-Disposition"] = f"attachment; filename=attendance_{batch_id}_{start_date}_to_{end_date}.csv"
    return response


import json
import base64
from datetime import timedelta

@router.get("/batches/{batch_id}/qr")
async def generate_qr_token(
    batch_id: str,
    db: AsyncSession = Depends(get_db),
    _user: User = Depends(require_roles(Role.SUPER_ADMIN, Role.ADMIN, Role.TRAINER))
):
    # Verify batch exists and trainer ownership
    batch = await db.get(Batch, batch_id)
    if not batch:
        raise HTTPException(status_code=404, detail="Batch not found")
    
    if _user.role == Role.TRAINER and batch.trainer_id != _user.id:
        raise HTTPException(status_code=403, detail="You can only generate QR codes for your own batches.")
        
    # Create simple token representing today's attendance session for this batch (IST)
    now = datetime.now(timezone.utc)
    ist_now = now + timedelta(hours=5, minutes=30)
    today_str = ist_now.strftime("%Y-%m-%d")
    payload = {
        "b": batch_id,
        "d": today_str,
        "exp": (ist_now + timedelta(hours=12)).isoformat()
    }
    
    # Simple base64 encoding
    encoded = base64.b64encode(json.dumps(payload).encode()).decode()
    return {"qr_token": encoded, "batch_id": batch_id, "date": today_str}


from app.models.setting import SystemSetting
import uuid

@router.get("/qr/global")
async def get_global_qr(
    db: AsyncSession = Depends(get_db),
    _user: User = Depends(require_roles(Role.SUPER_ADMIN, Role.ADMIN, Role.TRAINER))
):
    """Fetches the current persistent global QR token for trainees."""
    query = select(SystemSetting).where(SystemSetting.key == "active_qr_secret")
    result = await db.execute(query)
    setting = result.scalars().first()
    
    if not setting:
        # Initialize it if it doesn't exist
        secret = str(uuid.uuid4())
        setting = SystemSetting(key="active_qr_secret", value=secret)
        db.add(setting)
        await db.commit()
    
    return {"qr_token": setting.value}


@router.post("/qr/global/rotate")
async def rotate_global_qr(
    db: AsyncSession = Depends(get_db),
    _user: User = Depends(require_roles(Role.SUPER_ADMIN, Role.ADMIN))
):
    """Invalidates the old global QR token and creates a new one."""
    query = select(SystemSetting).where(SystemSetting.key == "active_qr_secret")
    result = await db.execute(query)
    setting = result.scalars().first()
    
    new_secret = str(uuid.uuid4())
    
    if setting:
        setting.value = new_secret
    else:
        setting = SystemSetting(key="active_qr_secret", value=new_secret)
        db.add(setting)
        
    await db.commit()
    return {"qr_token": new_secret, "message": "Global QR Code has been regenerated successfully."}



@router.post("/attendance", status_code=201)
async def mark_attendance(
    body: dict,
    db: AsyncSession = Depends(get_db),
    _user: User = Depends(require_roles(Role.SUPER_ADMIN, Role.ADMIN, Role.TRAINER)),
):
    recs = body.get("records", [])
    if not recs:
        # Fallback for single record if needed
        data = [body] if "student_id" in body else []
    else:
        data = recs

    for item in data:
        # Check for existing record to avoid duplicates
        day = parse_dt(item["date"])
        
        # Chronology Validations
        batch_obj = await db.get(Batch, item["batch_id"])
        if not batch_obj:
            raise HTTPException(status_code=404, detail=f"Batch not found")
        if batch_obj.start_date and day.date() < batch_obj.start_date.date():
            raise HTTPException(status_code=400, detail="Attendance date cannot be before the batch start date.")
            
        bs_res = await db.execute(select(BatchStudent).where(
            BatchStudent.batch_id == item["batch_id"], 
            BatchStudent.student_id == item["student_id"]
        ))
        bs = bs_res.scalars().first()
        if not bs:
            raise HTTPException(status_code=400, detail="Student is not enrolled in this batch.")
        if bs.joined_at and day.date() < bs.joined_at.date():
            raise HTTPException(status_code=400, detail="Attendance date cannot be before the student's enrollment date.")

        existing_result = await db.execute(
            select(Attendance).where(
                Attendance.student_id == item["student_id"],
                Attendance.batch_id == item["batch_id"],
                func.date(Attendance.date) == day.date()
            )
        )
        existing = existing_result.scalars().first()
        
        if existing:
            existing.status = item.get("status", "PRESENT")
            existing.remarks = item.get("remarks")
        else:
            record = Attendance(
                student_id=item["student_id"],
                batch_id=item["batch_id"],
                date=day,
                status=item.get("status", "PRESENT"),
                remarks=item.get("remarks"),
            )
            db.add(record)
            
    await db.commit()
    return {"status": "success", "message": f"Updated {len(data)} records"}


# ─── Leave Requests ───────────────────────────────────
@router.post("/submit-leave", status_code=201)
async def submit_leave(
    start_date: str = Form(...),
    end_date: str = Form(...),
    leave_type: str = Form(...),
    reason: str = Form(""),
    proof: UploadFile = File(None),
    student_id: str = Form(None),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    # Parse dates
    try:
        s_date = parse_dt(start_date)
        e_date = parse_dt(end_date)
        if not s_date or not e_date:
             raise ValueError("Parsing failed")
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid date format. Use YYYY-MM-DD")
    
    # 1. Validation Logic
    try:
        leave_type_enum = LeaveType[leave_type]
    except KeyError:
        leave_type_enum = LeaveType.OTHER

    # 2. Past Date Validation
    today = datetime.now().replace(hour=0, minute=0, second=0, microsecond=0)
    if s_date < today:
        raise HTTPException(status_code=400, detail="Cannot apply for leave on a past date.")

    try:
        # 3. Overlap Check
        overlap_result = await db.execute(
            select(LeaveRequest).where(
                LeaveRequest.user_id == user.id,
                LeaveRequest.status.in_([LeaveStatus.PENDING, LeaveStatus.APPROVED]),
                (
                    ((LeaveRequest.start_date <= s_date) & (LeaveRequest.end_date >= s_date)) |
                    ((LeaveRequest.start_date <= e_date) & (LeaveRequest.end_date >= e_date)) |
                    ((LeaveRequest.start_date >= s_date) & (LeaveRequest.end_date <= e_date))
                )
            )
        )
        if overlap_result.scalars().first():
            raise HTTPException(status_code=400, detail="You already have a pending or approved leave request for these dates.")

        if leave_type_enum in (LeaveType.OTHER, LeaveType.WORK_FROM_HOME):
            # We already changed earlier to allow WORK_FROM_HOME and OTHER reason to be mandatory. Wait, actually reason validation is fine here.
            if not reason.strip():
                raise HTTPException(status_code=400, detail="Reason is mandatory for this leave type.")

        if leave_type_enum == LeaveType.MEDICAL and not proof:
            raise HTTPException(status_code=400, detail="Proof of attachment (medical document or certificate) is required for Medical Leave.")

        # 4. Upload proof to Cloudinary
        proof_url = None
        if proof:
            is_pdf = False
            if proof.filename:
                is_pdf = proof.filename.lower().endswith(".pdf")
            proof_url = upload_to_cloudinary(proof.file, folder="lms/leaves", is_pdf=is_pdf)


        target_user_id = user.id
        if student_id and user.role in (Role.SUPER_ADMIN, Role.ADMIN, Role.TRAINER):
            target_user_id = student_id

        # 5. Determine Batch
        batch_id = None
        res = await db.execute(select(BatchStudent).where(BatchStudent.student_id == target_user_id))
        bs = res.scalars().first()
        if bs:
            batch_id = bs.batch_id

        # 6. Create Record
        leave = LeaveRequest(
            user_id=target_user_id,
            batch_id=batch_id,
            leave_type=leave_type_enum,
            proof_url=proof_url,
            start_date=s_date,
            end_date=e_date,
            reason=reason if leave_type_enum != LeaveType.MEDICAL else (reason or "Medical Leave"),
            status=LeaveStatus.PENDING
        )
        db.add(leave)
        await db.commit()
        await db.refresh(leave)
        
        return {"id": leave.id, "status": "submitted", "proof_url": proof_url}
    except HTTPException:
        raise
    except Exception as e:
        await db.rollback()
        raise HTTPException(status_code=400, detail=f"Database error: {str(e)}")

@router.post("/leave-cancel/{leave_id}")
async def cancel_leave(
    leave_id: str,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    leave = await db.get(LeaveRequest, leave_id)
    if not leave:
        raise HTTPException(status_code=404, detail="Leave request not found")
    
    if leave.user_id != user.id:
        raise HTTPException(status_code=403, detail="You can only cancel your own leave requests")
    
    if leave.status != LeaveStatus.PENDING:
        raise HTTPException(status_code=400, detail="Only pending leave requests can be cancelled")
    
    await db.delete(leave)
    await db.commit()
    return {"status": "cancelled"}

@router.get("/leave-history")
async def get_my_leaves(db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)):
    result = await db.execute(
        select(LeaveRequest).where(LeaveRequest.user_id == user.id).order_by(LeaveRequest.created_at.desc())
    )
    leaves = result.scalars().all()
    out = []
    for l in leaves:
        out.append(LeaveOut.model_validate(l))
    return out

@router.get("/leave-stats")
async def get_leave_stats(db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)):
    from app.models.course import Batch, BatchStudent
    
    result = await db.execute(select(Batch).join(BatchStudent, Batch.id == BatchStudent.batch_id).where(BatchStudent.student_id == user.id))
    batches = result.scalars().all()

    stats = []
    for b in batches:
        # Count used leaves
        l_result = await db.execute(
            select(LeaveRequest).where(
                LeaveRequest.user_id == user.id,
                LeaveRequest.batch_id == b.id,
                LeaveRequest.status.in_([LeaveStatus.APPROVED, LeaveStatus.PENDING])
            )
        )
        leaves = l_result.scalars().all()
        days_used = 0
        for l in leaves:
            days = (l.end_date - l.start_date).days + 1
            days_used += days if days > 0 else 1
        
        stats.append({
            "batch_id": b.id,
            "batch_name": b.name,
            "leave_quota": 0, # Unused conceptually, default to 0
            "days_used": days_used,
            "remaining": 0
        })
    return stats


# ─── Projects ─────────────────────────────────────────
@router.get("/projects")
async def list_projects(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Project).order_by(Project.created_at.desc()))
    projects = result.scalars().all()
    out = []
    for p in projects:
        ms_result = await db.execute(
            select(ProjectMilestone).where(ProjectMilestone.project_id == p.id).order_by(ProjectMilestone.order)
        )
        milestones = ms_result.scalars().all()
        trainer = await db.get(User, p.trainer_id) if p.trainer_id else None
        total_ms = len(milestones)
        done_ms = len([m for m in milestones if m.is_completed])

        # Check for overdue
        is_overdue = False
        if p.deadline and p.status not in (ProjectStatus.COMPLETED,) and p.deadline < datetime.utcnow():
            is_overdue = True

        out.append({
            "id": p.id, "title": p.title, "description": p.description,
            "tech_stack": p.tech_stack, "github_url": p.github_url,
            "batch_id": p.batch_id, "status": p.status.value,
            "is_overdue": is_overdue,
            "trainer_name": trainer.name if trainer else None,
            "deadline": p.deadline.isoformat() if p.deadline else None,
            "start_date": p.start_date.isoformat() if p.start_date else None,
            "end_date": p.end_date.isoformat() if p.end_date else None,
            "max_team_size": p.max_team_size,
            "progress": round((done_ms / total_ms * 100) if total_ms else 0),
            "milestones": [
                {
                    "id": m.id, "title": m.title, "description": m.description,
                    "due_date": m.due_date.isoformat() if m.due_date else None,
                    "is_completed": m.is_completed, "order": m.order,
                }
                for m in milestones
            ],
            "created_at": p.created_at.isoformat() if p.created_at else None,
        })
    return out


@router.post("/projects", status_code=201)
async def create_project(
    body: dict,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_roles(Role.SUPER_ADMIN, Role.ADMIN, Role.TRAINER)),
):
    # Verify trainer owns the batch
    if user.role == Role.TRAINER:
        batch = await db.get(Batch, body.get("batch_id"))
        if not batch or batch.trainer_id != user.id:
            raise HTTPException(status_code=403, detail="You can only create projects for your own batches.")

    project = Project(
        title=body["title"], description=body.get("description"),
        tech_stack=body.get("tech_stack"), github_url=body.get("github_url"),
        batch_id=body.get("batch_id"), trainer_id=user.id,
        status=body.get("status", "NOT_STARTED"),
        max_team_size=body.get("max_team_size", 4),
    )
    if body.get("deadline"):
        project.deadline = parse_dt(body["deadline"])
    if body.get("start_date"):
        project.start_date = parse_dt(body["start_date"])
    if body.get("end_date"):
        project.end_date = parse_dt(body["end_date"])
    db.add(project)
    await db.flush()

    for idx, ms in enumerate(body.get("milestones", [])):
        milestone = ProjectMilestone(
            project_id=project.id, title=ms["title"],
            description=ms.get("description"), order=idx,
        )
        if ms.get("due_date"):
            milestone.due_date = parse_dt(ms["due_date"])
        db.add(milestone)
    await db.flush()
    return {"id": project.id, "status": "created"}


# ─── Tasks ────────────────────────────────────────────
@router.get("/tasks")
async def list_tasks(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user)
):
    query = select(Task)
    
    # If Student, only show their batch tasks OR tasks mapped directly to them
    if user.role == Role.STUDENT:
        batch_result = await db.execute(select(BatchStudent.batch_id).where(BatchStudent.student_id == user.id))
        student_batches = batch_result.scalars().all()
        
        from sqlalchemy import or_
        if student_batches:
            query = query.where(or_(Task.batch_id.in_(student_batches), Task.student_id == user.id))
        else:
            query = query.where(Task.student_id == user.id)
            
        # Hide tasks that are scheduled for the future
        query = query.where(or_(Task.scheduled_at == None, Task.scheduled_at <= datetime.utcnow()))

            
    result = await db.execute(query.order_by(Task.created_at.desc()))
    tasks = result.scalars().all()
    out = []
    for t in tasks:
        trainer = await db.get(User, t.assigned_by) if t.assigned_by else None
        is_overdue = False
        if t.due_date and t.status != TaskStatus.COMPLETED and t.due_date < datetime.utcnow():
            is_overdue = True
        
        # For students, look up their assessment session(s) for this task
        task_session = None
        attempt_count = 0
        if user.role == Role.STUDENT:
            sess_res = await db.execute(
                select(AssessmentSession).where(
                    AssessmentSession.reference_id == t.id,
                    AssessmentSession.student_id == user.id,
                    AssessmentSession.reference_type == "TASK"
                ).order_by(AssessmentSession.created_at.desc())
            )
            sessions = sess_res.scalars().all()
            attempt_count = len(sessions)
            if sessions:
                task_session = sessions[0]  # latest session
        
        task_data = {
            "id": t.id, "title": t.title, "description": t.description,
            "batch_id": t.batch_id, "student_id": t.student_id, "priority": t.priority.value,
            "status": t.status.value, "is_overdue": is_overdue,
            "assigned_by": trainer.name if trainer else None,
            "due_date": t.due_date.isoformat() if t.due_date else None,
            "pdf_url": t.pdf_url,
            "time_limit": getattr(t, 'time_limit', 0) or 0,
            "is_randomized": getattr(t, 'is_randomized', False) or False,
            "has_assessment": bool(getattr(t, 'structured_content', None)),
            "created_at": t.created_at.isoformat() if t.created_at else None,
        }
        
        if user.role == Role.STUDENT:
            task_data["attempt_count"] = attempt_count
            task_data["is_completed"] = bool(task_session and task_session.is_completed) if task_session else False
            task_data["score"] = task_session.score if task_session and task_session.is_completed else None
        
        out.append(task_data)
    return out

@router.delete("/tasks/{task_id}")
async def delete_task(
    task_id: str,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_roles(Role.SUPER_ADMIN, Role.ADMIN, Role.TRAINER)),
):
    task = await db.get(Task, task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
        
    if user.role == Role.TRAINER and task.assigned_by != user.id:
        raise HTTPException(status_code=403, detail="You can only delete your own tasks")
        
    await db.delete(task)
    await db.flush()
    return {"status": "deleted"}

from fastapi import Form, UploadFile, File
from app.utils.cloudinary import upload_to_cloudinary

@router.post("/upload-task-pdf")
async def upload_task_pdf(
    file: UploadFile = File(...),
    user: User = Depends(require_roles(Role.SUPER_ADMIN, Role.ADMIN, Role.TRAINER))
):
    is_pdf = file.filename.lower().endswith(".pdf")
    if not is_pdf:
        raise HTTPException(status_code=400, detail="Only PDF files are allowed")
    pdf_url = upload_to_cloudinary(file.file, folder="lms/tasks", is_pdf=True)
    return {"url": pdf_url}


@router.post("/tasks", status_code=201)
async def create_task(
    body: dict,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_roles(Role.SUPER_ADMIN, Role.ADMIN, Role.TRAINER)),
):
    # Verify trainer owns the batch
    if user.role == Role.TRAINER:
        batch = await db.get(Batch, body.get("batch_id"))
        if not batch or batch.trainer_id != user.id:
            raise HTTPException(status_code=403, detail="You can only create tasks for your own batches.")

    task = Task(
        title=body["title"], description=body.get("description"),
        batch_id=body.get("batch_id"), student_id=body.get("student_id"),
        assigned_by=user.id,
        priority=body.get("priority", "MEDIUM"),
        status=body.get("status", "PENDING"),
        pdf_url=body.get("pdf_url"),
        time_limit=body.get("time_limit", 0),
        is_randomized=body.get("is_randomized", False),
        structured_content=body.get("structured_content"),
        scheduled_at=parse_dt(body.get("scheduled_at"))
    )
    if body.get("due_date"):
        task.due_date = parse_dt(body["due_date"])
    db.add(task)
    await db.flush()

    # If scheduled for future, setup a background job to notify batch
    if task.scheduled_at and task.scheduled_at > datetime.utcnow() and task.batch_id:
        from app.main import scheduler
        from app.ws.socket_manager import emit_task_unlock
        scheduler.add_job(
            emit_task_unlock, 
            'date', 
            run_date=task.scheduled_at, 
            args=[task.batch_id, {"id": task.id, "title": task.title, "type": "TASK"}]
        )


    # Notify students
    from app.models.notification import Notification
    student_id = body.get("student_id")
    
    if student_id:
        notif = Notification(
            user_id=student_id,
            title="📋 New Task Assigned to You",
            message=f"You have been assigned '{task.title}'.",
            type="TASK",
            reference_id=task.id,
            link=f"/student/tasks?open={task.id}"
        )
        db.add(notif)
        await db.flush()
    elif task.batch_id:
        bs_result = await db.execute(select(BatchStudent).where(BatchStudent.batch_id == task.batch_id))
        for bs in bs_result.scalars().all():
            notif = Notification(
                user_id=bs.student_id,
                title="📋 New Task Assigned",
                message=f"A new task '{task.title}' has been assigned to your batch.",
                type="TASK",
                reference_id=task.id,
                link=f"/student/tasks?open={task.id}"
            )
            db.add(notif)
        await db.flush()

    return {"id": task.id, "status": "created"}


@router.patch("/tasks/{task_id}")
async def update_task(
    task_id: str,
    body: dict,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_roles(Role.SUPER_ADMIN, Role.ADMIN, Role.TRAINER)),
):
    task = await db.get(Task, task_id)
    if not task:
        raise HTTPException(404, "Task not found")
    if user.role == Role.TRAINER and task.assigned_by != user.id:
        raise HTTPException(403, "You can only edit your own tasks")
    if "title" in body:
        task.title = body["title"]
    if "description" in body:
        task.description = body["description"]
    if "status" in body:
        task.status = body["status"]
    if "priority" in body:
        task.priority = body["priority"]
    if "due_date" in body and body["due_date"]:
        task.due_date = parse_dt(body["due_date"])
    elif "due_date" in body and not body["due_date"]:
        task.due_date = None
    if "structured_content" in body:
        task.structured_content = body["structured_content"]
    if "time_limit" in body:
        task.time_limit = body["time_limit"]
    if "is_randomized" in body:
        task.is_randomized = body["is_randomized"]
    if "pdf_url" in body:
        task.pdf_url = body["pdf_url"]
    await db.flush()
    return {"status": "updated"}


@router.delete("/tasks/{task_id}", status_code=204)
async def delete_task(
    task_id: str,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_roles(Role.SUPER_ADMIN, Role.ADMIN, Role.TRAINER)),
):
    task = await db.get(Task, task_id)
    if not task:
        raise HTTPException(404, "Task not found")
    await db.delete(task)
    await db.flush()


@router.get("/assignments")
async def list_assignments(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user)
):
    query = select(Assignment)
    
    # If Student, only show their batch assignments OR assignments mapped directly to them
    if user.role == Role.STUDENT:
        batch_result = await db.execute(select(BatchStudent.batch_id).where(BatchStudent.student_id == user.id))
        student_batches = batch_result.scalars().all()
        
        from sqlalchemy import or_
        if student_batches:
            query = query.where(or_(Assignment.batch_id.in_(student_batches), Assignment.student_id == user.id))
        else:
            query = query.where(Assignment.student_id == user.id)
            
        # Hide assignments scheduled for future
        query = query.where(or_(Assignment.scheduled_at == None, Assignment.scheduled_at <= datetime.utcnow()))

    
    result = await db.execute(query.order_by(Assignment.created_at.desc()))
    assignments = result.scalars().all()
    out = []
    
    for a in assignments:
        trainer = await db.get(User, a.assigned_by) if a.assigned_by else None
        sub_count = await db.execute(
            select(func.count(AssignmentSubmission.id)).where(AssignmentSubmission.assignment_id == a.id)
        )
        
        # If student, attach their personal AI grade / submission
        student_sub = None
        current_status = "PENDING"
        if user.role == Role.STUDENT:
            # 1. Check for formal submission
            sub_res = await db.execute(select(AssignmentSubmission).where(AssignmentSubmission.assignment_id == a.id, AssignmentSubmission.student_id == user.id))
            sub = sub_res.scalars().first()
            
            # 2. Check for assessment session (even if submission record hasn't synced yet)
            sess_res = await db.execute(select(AssessmentSession).where(
                AssessmentSession.reference_id == a.id,
                AssessmentSession.student_id == user.id,
                AssessmentSession.reference_type == "ASSIGNMENT"
            ).order_by(AssessmentSession.created_at.desc()))
            sess = sess_res.scalars().first()

            if sess:
                if sess.status in [SessionStatus.COMPLETED, SessionStatus.FAILED, SessionStatus.EXPIRED]:
                    current_status = "COMPLETED"
                elif sess.status == SessionStatus.ACTIVE:
                    current_status = "IN_PROGRESS"

            if sub:
                student_sub = {
                    "id": sub.id,
                    "marks": sub.marks,
                    "feedback": sub.feedback,
                    "file_url": sub.file_url,
                    "content": sub.content,
                    "session_responses": sess.responses if sess else None
                }
                current_status = "COMPLETED"

        out.append({
            "id": a.id, "title": a.title, "description": a.description,
            "type": a.type.value, "batch_id": a.batch_id,
            "total_marks": a.total_marks,
            "assigned_by": trainer.name if trainer else None,
            "due_date": a.due_date.isoformat() if a.due_date else None,
            "time_limit": a.time_limit or 0,
            "is_randomized": a.is_randomized,
            "structured_content": a.structured_content,
            "submission_count": sub_count.scalar() or 0,
            "created_at": a.created_at.isoformat() if a.created_at else None,
            "my_submission": student_sub,
            "status": current_status
        })
    return out


@router.post("/assignments", status_code=201)
async def create_assignment(
    body: dict,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_roles(Role.SUPER_ADMIN, Role.ADMIN, Role.TRAINER)),
):
    # Verify trainer owns the batch
    if user.role == Role.TRAINER:
        batch = await db.get(Batch, body.get("batch_id"))
        if not batch or batch.trainer_id != user.id:
            raise HTTPException(status_code=403, detail="You can only create assignments for your own batches.")

    assignment = Assignment(
        title=body["title"], description=body.get("description"),
        type=body.get("type", "CODING"),
        batch_id=body.get("batch_id"), student_id=body.get("student_id"), course_id=body.get("course_id"),
        assigned_by=user.id, total_marks=body.get("total_marks", 100),
        time_limit=body.get("time_limit", 0),
        is_randomized=body.get("is_randomized", False),
        structured_content=body.get("structured_content"),
        scheduled_at=parse_dt(body.get("scheduled_at"))
    )
    if body.get("due_date"):
        assignment.due_date = parse_dt(body["due_date"])
    db.add(assignment)
    await db.flush()

    # If scheduled for future, setup notification job
    if assignment.scheduled_at and assignment.scheduled_at > datetime.utcnow() and assignment.batch_id:
        from app.main import scheduler
        from app.ws.socket_manager import emit_task_unlock
        scheduler.add_job(
            emit_task_unlock, 
            'date', 
            run_date=assignment.scheduled_at, 
            args=[assignment.batch_id, {"id": assignment.id, "title": assignment.title, "type": "ASSIGNMENT"}]
        )


    from app.models.notification import Notification
    student_id = body.get("student_id")  # Optional: assign to specific student

    # Notify: specific student OR all batch students
    if student_id:
        # Individual student notification
        notif = Notification(
            user_id=student_id,
            title="📝 New Assignment Assigned to You",
            message=f"You have been assigned '{assignment.title}'. Check the Assignments section for details.",
            type="ASSIGNMENT",
            reference_id=assignment.id,
            link=f"/student/assessments?start={assignment.id}"
        )
        db.add(notif)
        await db.flush()
    elif assignment.batch_id:
        # Entire batch notification
        bs_result = await db.execute(select(BatchStudent).where(BatchStudent.batch_id == assignment.batch_id))
        for bs in bs_result.scalars().all():
            notif = Notification(
                user_id=bs.student_id,
                title="📝 New Assignment Added",
                message=f"A new assignment '{assignment.title}' has been added to your batch.",
                type="ASSIGNMENT",
                reference_id=assignment.id,
                link=f"/student/assessments?start={assignment.id}"
            )
            db.add(notif)
        await db.flush()

    return {"id": assignment.id, "status": "created"}


@router.patch("/assignments/{assignment_id}")
async def update_assignment(
    assignment_id: str,
    body: dict,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_roles(Role.SUPER_ADMIN, Role.ADMIN, Role.TRAINER)),
):
    assignment = await db.get(Assignment, assignment_id)
    if not assignment:
        raise HTTPException(status_code=404, detail="Assignment not found")
    if user.role == Role.TRAINER and assignment.assigned_by != user.id:
        raise HTTPException(status_code=403, detail="You can only edit your own assignments")
    if "title" in body:
        assignment.title = body["title"]
    if "description" in body:
        assignment.description = body["description"]
    if "type" in body:
        assignment.type = body["type"]
    if "total_marks" in body:
        assignment.total_marks = body["total_marks"]
    if "due_date" in body and body["due_date"]:
        assignment.due_date = parse_dt(body["due_date"])
    elif "due_date" in body and not body["due_date"]:
        assignment.due_date = None
    if "time_limit" in body:
        assignment.time_limit = body["time_limit"]
    if "is_randomized" in body:
        assignment.is_randomized = body["is_randomized"]
    if "structured_content" in body:
        assignment.structured_content = body["structured_content"]
    await db.flush()
    return {"status": "updated"}


@router.delete("/assignments/{assignment_id}")
async def delete_assignment(
    assignment_id: str,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_roles(Role.SUPER_ADMIN, Role.ADMIN, Role.TRAINER)),
):
    assignment = await db.get(Assignment, assignment_id)
    if not assignment:
        raise HTTPException(status_code=404, detail="Assignment not found")
        
    if user.role == Role.TRAINER and assignment.assigned_by != user.id:
        raise HTTPException(status_code=403, detail="You can only delete your own assignments")
        
    await db.delete(assignment)
    # The 'submissions' relationship specifies cascade="all, delete-orphan", 
    # so submissions attached to this assignment will be auto-deleted.
    await db.flush()
    return {"status": "deleted"}


from fastapi import Form, UploadFile, File
from app.utils.cloudinary import upload_to_cloudinary
from app.utils.ai_grader import evaluate_submission, extract_text_from_pdf, generate_assignment_instructions

@router.post("/assignments/ai-generate")
async def ai_generate_assignment(
    topic: str = Form(...),
    user: User = Depends(require_roles(Role.SUPER_ADMIN, Role.ADMIN, Role.TRAINER)),
):
    """Generates an assignment description automatically based on a topic string."""
    description = generate_assignment_instructions(topic)
    return {"description": description}


@router.get("/assignments/{assignment_id}/submissions")
async def list_assignment_submissions(
    assignment_id: str,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_roles(Role.SUPER_ADMIN, Role.ADMIN, Role.TRAINER)),
):
    assignment = await db.get(Assignment, assignment_id)
    if not assignment:
        raise HTTPException(404, "Assignment not found")
        
    # 1. Discover all student IDs involved (Assigned + Interacted)
    involved_student_ids = set()
    
    if assignment.student_id:
        involved_student_ids.add(assignment.student_id)
    elif assignment.batch_id:
        bs_res = await db.execute(select(BatchStudent.student_id).where(BatchStudent.batch_id == assignment.batch_id))
        involved_student_ids.update(bs_res.scalars().all())
        
    # Also include anyone who has a submission or session even if they are not "formally" in the batch roster currently
    sub_list_res = await db.execute(select(AssignmentSubmission.student_id).where(AssignmentSubmission.assignment_id == assignment_id))
    involved_student_ids.update(sub_list_res.scalars().all())
    
    sess_list_res = await db.execute(select(AssessmentSession.student_id).where(AssessmentSession.reference_id == assignment_id, AssessmentSession.reference_type == "ASSIGNMENT"))
    involved_student_ids.update(sess_list_res.scalars().all())

    # Filter out None values just in case
    involved_student_ids = {sid for sid in involved_student_ids if sid}

    if not involved_student_ids:
        return []

    # 2. Fetch all unique student profiles
    all_studs_res = await db.execute(select(User).where(User.id.in_(list(involved_student_ids))))
    involved_students = all_studs_res.scalars().all()

    # Get Submissions
    result = await db.execute(select(AssignmentSubmission).where(AssignmentSubmission.assignment_id == assignment_id))
    submissions_map = {sub.student_id: sub for sub in result.scalars().all()}
    
    # Get all sessions attached to this assignment
    sess_res = await db.execute(
        select(AssessmentSession).where(
            AssessmentSession.reference_id == assignment_id,
            AssessmentSession.reference_type == "ASSIGNMENT"
        )
    )
    sessions_map = {sess.student_id: sess for sess in sess_res.scalars().all()}

    out = []
    for s in involved_students:
        sub = submissions_map.get(s.id)
        sess = sessions_map.get(s.id)
        
        proc_report = None
        if sess:
            proc_report = {
                "fullscreen_exits": sess.fullscreen_exit_count or 0,
                "tab_switches": sess.tab_switch_count or 0,
                "face_violations": sess.face_violation_count or 0,
                "mic_violations": getattr(sess, "mic_violation_count", 0),
                "completion_time": sess.completion_time_seconds or 0,
                "auto_submitted": sess.auto_submitted
            }

        if sub:
            out.append({
                "id": sub.id,
                "student_id": s.id,
                "student_name": s.name,
                "student_email": s.email,
                "status": "SUBMITTED",
                "content": sub.content,
                "file_url": sub.file_url,
                "marks": sub.marks,
                "feedback": sub.feedback,
                "submitted_at": sub.submitted_at.isoformat() if sub.submitted_at else None,
                "proctoring_report": proc_report
            })
        else:
            out.append({
                "id": f"pending-{s.id}",
                "student_id": s.id,
                "student_name": s.name,
                "student_email": s.email,
                "status": "IN_PROGRESS" if (sess and not sess.is_completed) else "PENDING",
                "content": None,
                "file_url": None,
                "marks": 0,
                "feedback": None,
                "submitted_at": None,
                "proctoring_report": proc_report
            })

    return out

@router.post("/assignments/{assignment_id}/submit", status_code=201)
async def submit_assignment(
    assignment_id: str,
    content: str = Form(None),
    file: UploadFile = File(None),
    tab_switches: int = Form(0),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    existing = await db.execute(
        select(AssignmentSubmission).where(
            AssignmentSubmission.assignment_id == assignment_id,
            AssignmentSubmission.student_id == user.id,
        )
    )
    if existing.scalars().first():
        raise HTTPException(400, "Already submitted")

    assignment = await db.get(Assignment, assignment_id)
    if not assignment:
        raise HTTPException(404, "Assignment not found")

    # Check deadlines for violations (compare with current UTC time)
    now_utc = datetime.now(timezone.utc).replace(tzinfo=None)
    if assignment.due_date and assignment.due_date < now_utc:
        violation = Violation(
            student_id=user.id,
            type=ViolationType.POOR_ACADEMIC_PERFORMANCE,
            severity=ViolationSeverity.LOW,
            title=f"Late submission: {assignment.title}",
            description=f"Assignment '{assignment.title}' was submitted after the deadline.",
            reference_type="ASSIGNMENT",
            reference_id=assignment_id,
            penalty_points=5,
        )
        db.add(violation)

    # 1. Cloudinary Upload if a Physical PDF is submitted
    pdf_url = None
    extracted_pdf_text = None
    
    if file:
        is_pdf = file.filename.lower().endswith(".pdf")
        # Save securely to Cloudinary CDN
        pdf_url = upload_to_cloudinary(file.file, folder="lms/assignments", is_pdf=is_pdf)
        
        # If it's a PDF, we need to extract the text for the AI Grader
        if is_pdf:
            file.file.seek(0) # Reset pointer
            pdf_bytes = file.file.read()
            extracted_pdf_text = extract_text_from_pdf(pdf_bytes)

    # 2. Determine what the AI evaluates (Prioritize raw code if they pasted it, else fallback to extracted PDF text)
    ai_eval_content = content or extracted_pdf_text or ""
    ai_score = None
    ai_feedback = None

    if ai_eval_content:
        # 3. Trigger the Gemini Auto-Grader!
        eval_result = evaluate_submission(
            assignment_instructions=assignment.description or assignment.title,
            student_content=ai_eval_content,
            max_marks=assignment.total_marks
        )
        ai_score = eval_result.get("score")
        ai_feedback = eval_result.get("feedback")

    # 3. Tab Switching Violation Logging
    if tab_switches > 0:
        violation = Violation(
            student_id=user.id,
            type=ViolationType.TAB_SWITCHING,
            severity=ViolationSeverity.HIGH if tab_switches >= 3 else ViolationSeverity.MEDIUM,
            title=f"Proctoring: Tab Switching detected in {assignment.title}",
            description=f"Student switched tabs {tab_switches} times during the assessment.",
            reference_type="ASSIGNMENT",
            reference_id=assignment_id,
            penalty_points=10 * tab_switches
        )
        db.add(violation)

    submission = AssignmentSubmission(
        assignment_id=assignment_id, 
        student_id=user.id,
        content=content, 
        file_url=pdf_url,
        marks=ai_score,
        feedback=ai_feedback
    )
    db.add(submission)
    await db.flush()
    return {"status": "submitted", "marks": ai_score, "feedback": ai_feedback}


# ─── Violations ───────────────────────────────────────
@router.get("/violations")
async def list_violations(
    student_id: str = "",
    type: str = "",
    status: str = "",
    db: AsyncSession = Depends(get_db),
):
    query = select(Violation)
    if student_id:
        query = query.where(Violation.student_id == student_id)
    if type:
        query = query.where(Violation.type == type)
    if status:
        query = query.where(Violation.status == status)
    result = await db.execute(query.order_by(Violation.created_at.desc()))
    violations = result.scalars().all()
    out = []
    for v in violations:
        student = await db.get(User, v.student_id) if v.student_id else None
        resolver = await db.get(User, v.resolved_by_id) if v.resolved_by_id else None
        out.append({
            "id": v.id,
            "student_id": v.student_id,
            "student_name": student.name if student else "Unknown",
            "type": v.type.value,
            "severity": v.severity.value,
            "status": v.status.value,
            "title": v.title,
            "description": v.description,
            "reference_type": v.reference_type,
            "reference_id": v.reference_id,
            "penalty_points": v.penalty_points,
            "resolved_by": resolver.name if resolver else None,
            "resolution_note": v.resolution_note,
            "resolved_at": v.resolved_at.isoformat() if v.resolved_at else None,
            "created_at": v.created_at.isoformat() if v.created_at else None,
            "screenshot_url": getattr(v, 'screenshot_url', None),
        })
    return out


@router.post("/violations", status_code=201)
async def create_violation(
    body: dict,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_roles(Role.SUPER_ADMIN, Role.ADMIN, Role.TRAINER)),
):
    violation = Violation(
        student_id=body["student_id"],
        type=body["type"],
        severity=body.get("severity", "MEDIUM"),
        title=body["title"],
        description=body.get("description"),
        reference_type=body.get("reference_type"),
        reference_id=body.get("reference_id"),
        penalty_points=body.get("penalty_points", 0),
    )
    db.add(violation)
    await db.flush()
    return {"id": violation.id, "status": "created"}


@router.patch("/violations/{violation_id}")
async def update_violation(
    violation_id: str,
    body: dict,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_roles(Role.SUPER_ADMIN, Role.ADMIN, Role.TRAINER)),
):
    violation = await db.get(Violation, violation_id)
    if not violation:
        raise HTTPException(404, "Violation not found")

    if "status" in body:
        violation.status = body["status"]
        if body["status"] in ("RESOLVED", "DISMISSED"):
            violation.resolved_by_id = user.id
            violation.resolved_at = datetime.utcnow()
    if "resolution_note" in body:
        violation.resolution_note = body["resolution_note"]
    if "severity" in body:
        violation.severity = body["severity"]
    if "penalty_points" in body:
        violation.penalty_points = body["penalty_points"]

    await db.flush()
    return {"status": "updated"}


@router.delete("/violations/{violation_id}")
async def delete_violation(
    violation_id: str,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_roles(Role.SUPER_ADMIN, Role.ADMIN)),
):
    violation = await db.get(Violation, violation_id)
    if not violation:
        raise HTTPException(404, "Violation not found")
    await db.delete(violation)
    await db.flush()
    return {"status": "deleted"}


@router.post("/violations/check-deadlines")
async def check_deadlines(
    db: AsyncSession = Depends(get_db),
    _user: User = Depends(require_roles(Role.SUPER_ADMIN, Role.ADMIN, Role.TRAINER)),
):
    """Scan for overdue projects/tasks and auto-create violations."""
    now = datetime.utcnow()
    violations_created = 0

    # Check overdue projects
    result = await db.execute(
        select(Project).where(
            Project.deadline < now,
            Project.status.notin_([ProjectStatus.COMPLETED]),
        )
    )
    for project in result.scalars().all():
        # Check if violation already exists for this project
        existing = await db.execute(
            select(Violation).where(
                Violation.reference_type == "PROJECT",
                Violation.reference_id == project.id,
                Violation.type == ViolationType.DEADLINE_MISSED,
            )
        )
        if existing.scalars().first():
            continue
        # Get students from batch
        if project.batch_id:
            bs_result = await db.execute(
                select(BatchStudent).where(BatchStudent.batch_id == project.batch_id)
            )
            for bs in bs_result.scalars().all():
                violation = Violation(
                    student_id=bs.student_id,
                    type=ViolationType.POOR_ACADEMIC_PERFORMANCE,
                    severity=ViolationSeverity.LOW,
                    title="Deadline Missed: Final Project",
                    description=f"Student missed the deadline for project '{project.title}'",
                    reference_type="PROJECT",
                    reference_id=project.id,
                    penalty_points=10,
                )
                db.add(violation)
                violations_created += 1
        project.status = ProjectStatus.OVERDUE

    # Check overdue tasks
    result = await db.execute(
        select(Task).where(
            Task.due_date < now,
            Task.status.notin_([TaskStatus.COMPLETED, TaskStatus.OVERDUE]),
        )
    )
    for task in result.scalars().all():
        task.status = TaskStatus.OVERDUE

    await db.flush()
    return {"violations_created": violations_created, "status": "checked"}


# ─── Violations Summary ──────────────────────────────
@router.get("/violations/summary")
async def violation_summary(db: AsyncSession = Depends(get_db)):
    total = await db.execute(select(func.count(Violation.id)))
    open_count = await db.execute(
        select(func.count(Violation.id)).where(Violation.status == ViolationStatus.OPEN)
    )
    resolved_count = await db.execute(
        select(func.count(Violation.id)).where(Violation.status == ViolationStatus.RESOLVED)
    )
    total_penalties = await db.execute(
        select(func.coalesce(func.sum(Violation.penalty_points), 0))
    )

    # Get by type
    type_counts = {}
    for vtype in ViolationType:
        c = await db.execute(
            select(func.count(Violation.id)).where(Violation.type == vtype)
        )
        count = c.scalar() or 0
        if count > 0:
            type_counts[vtype.value] = count

    return {
        "total": total.scalar() or 0,
        "open": open_count.scalar() or 0,
        "resolved": resolved_count.scalar() or 0,
        "total_penalties": total_penalties.scalar() or 0,
        "by_type": type_counts,
    }


# ─── Feedback ─────────────────────────────────────────
@router.get("/feedback")
async def list_feedback(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Feedback).order_by(Feedback.created_at.desc()))
    feedbacks = result.scalars().all()
    out = []
    for f in feedbacks:
        student = await db.get(User, f.student_id) if f.student_id else None
        out.append({
            "id": f.id,
            "student_name": student.name if student else "Unknown",
            "rating": f.rating,
            "comment": f.comments,
            "created_at": f.created_at.isoformat() if f.created_at else None,
        })
    return out


# ─── Videos ───────────────────────────────────────────
@router.get("/videos")
async def list_videos(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Video).order_by(Video.created_at.desc()))
    return [
        {
            "id": v.id, "title": v.title, "url": v.url,
            "topic": v.topic, "duration": v.duration,
            "created_at": v.created_at.isoformat() if v.created_at else None,
        }
        for v in result.scalars().all()
    ]
@router.get("/time-tracking")
async def get_time_tracking(
    date: str = "",
    user_id: str = "",
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    from app.models.attendance import TimeTracking
    from sqlalchemy import and_, func
    
    query = select(TimeTracking)
    
    # If user is a student, trainer, or marketer, only let them see their own logs
    if user.role in (Role.STUDENT, Role.TRAINER, Role.MARKETER):
        query = query.where(TimeTracking.user_id == user.id)
    elif user_id:
        query = query.where(TimeTracking.user_id == user_id)
        
    if date:
        day = parse_dt(date)
        query = query.where(func.date(TimeTracking.date) == day.date())
        
    result = await db.execute(query.order_by(TimeTracking.login_time.desc()))
    records = result.scalars().all()
    
    out_logs = []
    for r in records:
        student = await db.get(User, r.user_id)
        out_logs.append({
            "id": r.id,
            "date": r.date.isoformat(),
            "login_time": r.login_time.isoformat() if r.login_time else None,
            "logout_time": r.logout_time.isoformat() if r.logout_time else None,
            "total_minutes": r.total_minutes,
            "user": {
                "name": student.name if student else "Unknown",
                "email": student.email if student else "",
                "student_id": student.student_id if student else None,
                "role": student.role.value if student and hasattr(student.role, 'value') else (str(student.role) if student else "Unknown")
            }
        })
        
    # Stats (simple example for admin)
    stats = {"avgHours": "0h", "activeToday": 0, "onTime": 0, "late": 0, "absent": 0}
    if user.role != Role.STUDENT and date:
        active_count = len([r for r in records if r.logout_time is None])
        completed = [r for r in records if r.total_minutes is not None]
        avg_mins = sum([r.total_minutes for r in completed]) / len(completed) if completed else 0
        
        stats["activeToday"] = active_count
        stats["avgHours"] = f"{avg_mins/60:.1f}h"
        
        # Get configurable late threshold from settings (default 10:00 AM)
        late_hour = 10
        late_minute = 0
        try:
            threshold_result = await db.execute(select(SystemSetting).where(SystemSetting.key == "late_threshold_time"))
            threshold_setting = threshold_result.scalars().first()
            if threshold_setting and threshold_setting.value:
                parts = threshold_setting.value.split(":")
                late_hour = int(parts[0])
                late_minute = int(parts[1]) if len(parts) > 1 else 0
        except:
            pass
        
        # Calculate On Time vs Late (login_time is already stored as IST-naive)
        on_time = 0
        late = 0
        for r in records:
            if r.login_time:
                if r.login_time.hour < late_hour or (r.login_time.hour == late_hour and r.login_time.minute <= late_minute):
                    on_time += 1
                else:
                    late += 1
        
        stats["onTime"] = on_time
        stats["late"] = late
        
        # Count absent = total active users (non-SUPER_ADMIN) minus those who punched in today
        try:
            from app.models.user import Role as UserRole
            total_users_result = await db.execute(
                select(func.count(User.id)).where(User.role != UserRole.SUPER_ADMIN)
            )
            total_users = total_users_result.scalar() or 0
            punched_in_count = len(records)
            stats["absent"] = max(0, total_users - punched_in_count)
        except:
            stats["absent"] = 0

    return {"logs": out_logs, "stats": stats}

@router.get("/time-tracking/export")
async def export_time_tracking(
    start_date: str = "",
    end_date: str = "",
    role: str = "",
    user_id: str = "",
    db: AsyncSession = Depends(get_db),
    _user: User = Depends(require_roles(Role.SUPER_ADMIN, Role.ADMIN)),
):
    """Export time tracking data as CSV grouped by role and batch."""
    import csv
    import io
    from fastapi.responses import StreamingResponse
    from app.models.attendance import TimeTracking
    from app.models.course import BatchStudent, Batch
    from sqlalchemy import and_, func
    
    # Parse dates
    if not start_date or not end_date:
        raise HTTPException(status_code=400, detail="start_date and end_date are required (YYYY-MM-DD)")
    
    dt_start = parse_dt(start_date)
    dt_end = parse_dt(end_date)
    s_date = dt_start.date() if dt_start else None
    e_date = dt_end.date() if dt_end else None
    
    # Fetch all records in range
    query = select(TimeTracking).where(
        and_(
            func.date(TimeTracking.date) >= s_date,
            func.date(TimeTracking.date) <= e_date
        )
    )
    if user_id:
        query = query.where(TimeTracking.user_id == user_id)
        
    result = await db.execute(query.order_by(TimeTracking.date, TimeTracking.login_time))
    records = result.scalars().all()
    
    # Get late threshold setting
    late_hour, late_minute = 10, 0
    try:
        threshold_result = await db.execute(select(SystemSetting).where(SystemSetting.key == "late_threshold_time"))
        threshold_setting = threshold_result.scalars().first()
        if threshold_setting and threshold_setting.value:
            parts = threshold_setting.value.split(":")
            late_hour = int(parts[0])
            late_minute = int(parts[1]) if len(parts) > 1 else 0
    except:
        pass
    
    # Group records by user, enrich with user info
    user_records = {}
    for r in records:
        if r.user_id not in user_records:
            u = await db.get(User, r.user_id)
            if not u:
                continue
            role_val = u.role.value if hasattr(u.role, 'value') else str(u.role)
            if role and role_val != role:
                continue
            
            # Find batch for students
            batch_name = "N/A"
            if role_val == "STUDENT":
                bs_result = await db.execute(
                    select(BatchStudent.batch_id).where(BatchStudent.student_id == u.id)
                )
                batch_id = bs_result.scalars().first()
                if batch_id:
                    batch = await db.get(Batch, batch_id)
                    batch_name = batch.name if batch else "Unknown Batch"
            
            user_records[r.user_id] = {
                "user": u,
                "role": role_val,
                "batch_name": batch_name,
                "logs": []
            }
        
        # Skip records for users who were filtered out (not added to user_records)
        if r.user_id not in user_records:
            continue

        # Determine on-time/late
        status = "N/A"
        if r.login_time:
            if r.login_time.hour < late_hour or (r.login_time.hour == late_hour and r.login_time.minute <= late_minute):
                status = "On Time"
            else:
                status = "Late"
        
        duration_mins = r.total_minutes or 0
        hours_val = duration_mins // 60
        mins_val = duration_mins % 60
        duration_str = f"{hours_val}h {mins_val}m" if hours_val > 0 else f"{mins_val}m"
        
        user_records[r.user_id]["logs"].append({
            "date": r.date.strftime("%Y-%m-%d") if r.date else "",
            "login_time": r.login_time.strftime("%I:%M %p") if r.login_time else "-",
            "logout_time": r.logout_time.strftime("%I:%M %p") if r.logout_time else "-",
            "duration": duration_str,
            "status": status
        })
    
    # Group by role
    admins = {uid: data for uid, data in user_records.items() if data["role"] == "ADMIN"}
    trainers = {uid: data for uid, data in user_records.items() if data["role"] == "TRAINER"}
    students = {uid: data for uid, data in user_records.items() if data["role"] == "STUDENT"}
    marketers = {uid: data for uid, data in user_records.items() if data["role"] == "MARKETER"}
    
    # Group students by batch
    students_by_batch = {}
    for uid, data in students.items():
        bn = data["batch_name"]
        if bn not in students_by_batch:
            students_by_batch[bn] = {}
        students_by_batch[bn][uid] = data
    
    # Build CSV
    output = io.StringIO()
    writer = csv.writer(output)
    
    writer.writerow([f"Attendance Report: {start_date} to {end_date}"])
    writer.writerow([f"Late Threshold: {late_hour:02d}:{late_minute:02d}"])
    writer.writerow([])
    
    def write_section(title, group):
        if not group:
            return
        writer.writerow([f"=== {title} ==="])
        writer.writerow(["Name", "ID", "Date", "Punch In", "Punch Out", "Duration", "Status"])
        for uid, data in group.items():
            u = data["user"]
            for log in data["logs"]:
                writer.writerow([
                    u.name,
                    u.student_id or u.id[:8],
                    log["date"],
                    log["login_time"],
                    log["logout_time"],
                    log["duration"],
                    log["status"]
                ])
        writer.writerow([])
    
    write_section("ADMINS", admins)
    write_section("TRAINERS", trainers)
    write_section("MARKETERS", marketers)
    
    for batch_name, batch_students in students_by_batch.items():
        write_section(f"STUDENTS - {batch_name}", batch_students)
    
    # --- ABSENT SECTION ---
    # Get all active users (non-SUPER_ADMIN)
    absent_query = select(User).where(User.role != Role.SUPER_ADMIN)
    if role:
        absent_query = absent_query.where(User.role == role)
    if user_id:
        absent_query = absent_query.where(User.id == user_id)
        
    all_users_result = await db.execute(absent_query)
    all_users = all_users_result.scalars().all()
    
    # For each day in range, find who didn't punch in
    from datetime import timedelta as td
    current_day = s_date
    absent_rows = []
    while current_day <= e_date:
        # Get user IDs who punched in on this day
        day_result = await db.execute(
            select(TimeTracking.user_id).where(
                func.date(TimeTracking.date) == current_day
            )
        )
        punched_ids = set(day_result.scalars().all())
        
        for u in all_users:
            if u.id not in punched_ids:
                role_val = u.role.value if hasattr(u.role, 'value') else str(u.role)
                absent_rows.append([
                    u.name,
                    u.student_id or u.id[:8],
                    role_val,
                    current_day.strftime("%Y-%m-%d"),
                    "Absent"
                ])
        current_day = current_day + td(days=1)
    
    if absent_rows:
        writer.writerow(["=== ABSENT (Did Not Punch In) ==="])
        writer.writerow(["Name", "ID", "Role", "Date", "Status"])
        for row in absent_rows:
            writer.writerow(row)
        writer.writerow([])
    
    output.seek(0)
    filename = f"attendance_{start_date}_to_{end_date}.csv"
    
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )

@router.post("/time-tracking")
async def create_time_tracking(
    body: dict,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(get_current_user),
):
    if admin.role == Role.STUDENT:
        raise HTTPException(status_code=403, detail="Students cannot manually add logs")
        
    from app.models.attendance import TimeTracking
    from app.models.user import User
    
    user_id = body.get("user_id")
    date_str = body.get("date")
    login_str = body.get("login_time")
    logout_str = body.get("logout_time")
    
    if not all([user_id, date_str, login_str]):
        raise HTTPException(status_code=400, detail="Missing required fields")
        
    target_user = await db.get(User, user_id)
    if not target_user:
        raise HTTPException(status_code=404, detail="User not found")
        
    date_obj = datetime.fromisoformat(date_str).replace(hour=0, minute=0, second=0, microsecond=0)
    login_time = datetime.fromisoformat(login_str)
    logout_time = datetime.fromisoformat(logout_str) if logout_str else None
    
    total_minutes = None
    if logout_time:
        diff = logout_time - login_time
        total_minutes = int(diff.total_seconds() / 60)
        
    log = TimeTracking(
        user_id=user_id,
        date=date_obj,
        login_time=login_time,
        logout_time=logout_time,
        total_minutes=total_minutes
    )
    db.add(log)
    await db.flush()
    return {"status": "success", "id": log.id}

@router.patch("/time-tracking/{log_id}")
async def update_time_tracking(
    log_id: str,
    body: dict,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(get_current_user),
):
    if admin.role == Role.STUDENT:
        raise HTTPException(status_code=403, detail="Students cannot edit logs")
        
    from app.models.attendance import TimeTracking
    log = await db.get(TimeTracking, log_id)
    if not log:
        raise HTTPException(status_code=404, detail="Log not found")
        
    if "login_time" in body:
        log.login_time = datetime.fromisoformat(body["login_time"])
    if "logout_time" in body:
        log.logout_time = datetime.fromisoformat(body["logout_time"]) if body["logout_time"] else None
        
    if log.login_time and log.logout_time:
        diff = log.logout_time - log.login_time
        log.total_minutes = int(diff.total_seconds() / 60)
    else:
        log.total_minutes = None
        
    await db.flush()
    return {"status": "success"}

@router.delete("/time-tracking/{log_id}")
async def delete_time_tracking(
    log_id: str,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(get_current_user),
):
    if admin.role == Role.STUDENT:
        raise HTTPException(status_code=403, detail="Students cannot delete logs")
        
    from app.models.attendance import TimeTracking
    log = await db.get(TimeTracking, log_id)
    if not log:
        raise HTTPException(status_code=404, detail="Log not found")
    if log:
        db.delete(log)
        await db.commit()
    return {"status": "success"}


# ─── AI Task Generator ───────────────────────────────────────────────────────
import os
import httpx
from pydantic import BaseModel as PydanticBaseModel
from typing import List as TypingList
from app.ws.socket_manager import emit_violation_alert


class GenerateTaskRequest(PydanticBaseModel):
    topic: str
    task_type: str = "CODING"   # CODING, WRITTEN, PROJECT, MCQ
    difficulty: str = "Intermediate"  # Introductory, Beginner, Intermediate, Advanced, Professional, Expert, Master
    question_count: int = 5
    time_limit: int = 0  # 0 = no limit
    is_randomized: bool = True

@router.post("/generate-task")
async def generate_task(
    body: GenerateTaskRequest,
    _current_user: User = Depends(require_roles(Role.TRAINER, Role.SUPER_ADMIN, Role.ADMIN))
):
    api_key = os.environ.get("GROQ_API_KEY")
    if not api_key:
        raise HTTPException(status_code=503, detail="AI not configured. Please contact admin.")
        
    if body.task_type.upper() == "MCQ":
        format_instr = f"""Create EXACTLY {body.question_count} multiple-choice questions.
Return ONLY a JSON object in this EXACT format, with no extra text:
{{
  "title": "concise quiz title",
  "description": "2-3 sentence intro to the quiz topic",
  "questions": [
    {{
      "question": "Question text here?",
      "options": ["Option A", "Option B", "Option C", "Option D"],
      "answer": 0,
      "explanation": "Why option A is correct",
      "difficulty": "easy",
      "topic": "specific sub-topic"
    }}
  ],
  "estimated_hours": 1
}}
IMPORTANT: 'answer' must be the 0-based INDEX of the correct option in the 'options' array (0=A, 1=B, 2=C, 3=D)."""
    elif body.task_type.upper() == "CODING":
        format_instr = f"""Create EXACTLY {body.question_count} distinct and high-quality coding problems about "{body.topic}".
Return ONLY a JSON object in this EXACT format:
{{
  "title": "Professional Lab Title",
  "description": "2-3 sentence technical overview of the coding challenges",
  "questions": [
    {{
      "index": 0,
      "question": "DETAILED problem statement. Include specific requirements, expected behavior, and a real-world scenario if possible. Explain the logic clearly.",
      "initial_code": "starter code with appropriate function signatures or boilerplate",
      "constraints": ["e.g. O(n) time complexity", "e.g. No external libraries"],
      "hints": ["technical tip 1", "logic hint 2"]
    }}
  ],
  "estimated_hours": {max(1, body.question_count // 2)}
}}
IMPORTANT: The "questions" array MUST contain EXACTLY {body.question_count} unique items.
For '{body.difficulty}' level:
- If Beginner: Use simple syntax, basic loops/conditionals, and very clear instructions.
- If Intermediate: Include data structures (lists, dicts), modularity, and error handling.
- If Advanced/Expert: Include algorithm optimization, complex data structures, edge cases, and architectural best practices.
Each problem must be technical, accurate, and challenging enough for the selected difficulty."""
    else:
        format_instr = f"""Create EXACTLY {body.question_count} specific requirements/steps for this {body.task_type} task.
Return ONLY a JSON object in this EXACT format:
{{
  "title": "concise task title",
  "description": "2-3 sentence overview of the task",
  "requirements": ["step 1", "step 2", "step 3"],
  "hints": ["hint 1", "hint 2"],
  "estimated_hours": 3
}}"""

    prompt = f"""Generate a {body.difficulty}-level {body.task_type} task for a software training program on the topic: "{body.topic}"

CRITICAL INSTRUCTION: The difficulty must STRICTLY match the selected level ({body.difficulty}). 
If {body.difficulty} is set to 'Introductory' or 'Beginner', the questions must be extremely simple, basic, foundational, and easy to solve for an absolute novice.
If {body.difficulty} is set to 'Intermediate', target a mid-level practitioner.
If {body.difficulty} is set to 'Advanced', 'Professional', 'Expert', or 'Master', the questions must be highly complex, tricky, and require deep problem-solving skills and architectural knowledge.
Please tailor the complexity, vocabulary, and scenarios specifically to the {body.difficulty} level.

{format_instr}"""

    # Retry logic for Rate Limits (429)
    # Priority: High Intelligence -> Reliability -> High Rate Limit
    models = [
        "llama-3.3-70b-versatile", 
        "llama-3.1-70b-versatile", 
        "mixtral-8x7b-32768", 
        "llama-3.1-8b-instant"
    ]
    last_status = 200
    error_detail = "Unknown error"

    for model_name in models:
        for attempt in range(2):
            try:
                async with httpx.AsyncClient(timeout=45.0) as client:
                    resp = await client.post(
                        "https://api.groq.com/openai/v1/chat/completions",
                        headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
                        json={
                            "model": model_name,
                            "messages": [
                                {"role": "system", "content": "You are a world-class software engineering instructor. Your task is to generate highly practical, industry-relevant coding challenges or MCQs. Ensure technical accuracy, clear explanations, and follow the requested JSON format strictly. No conversational filler."},
                                {"role": "user", "content": prompt}
                            ],
                            "temperature": 0.5,
                            "max_tokens": 4096,
                            "response_format": {"type": "json_object"}
                        }
                    )
                
                last_status = resp.status_code
                if resp.status_code == 429:
                    if attempt == 0:
                        await asyncio.sleep(2)
                        continue
                    else:
                        break 
                
                if not resp.is_success:
                    try:
                        err_json = resp.json()
                        error_detail = err_json.get("error", {}).get("message", resp.text)
                    except:
                        error_detail = resp.text
                    break # Try next model

                data = resp.json()
                if not data.get("choices"):
                    error_detail = "AI returned no choices"
                    break
                    
                raw = data["choices"][0]["message"]["content"].strip()
                start_idx = raw.find('{')
                end_idx = raw.rfind('}')
                if start_idx != -1 and end_idx != -1:
                    raw = raw[start_idx:end_idx+1]
                
                task = json.loads(raw)
                return task

            except (httpx.TimeoutException, json.JSONDecodeError) as e:
                error_detail = str(e)
                if attempt == 0:
                    continue
                break
            except Exception as e:
                error_detail = str(e)
                break
    
    if last_status == 429:
        raise HTTPException(status_code=429, detail="AI rate limit reached. Please wait 10 seconds and try again.")
    raise HTTPException(status_code=last_status if last_status >= 400 else 502, 
                        detail=f"AI Error ({last_status}): {error_detail}")

# ─── Assessment Session APIs ───────────────────────────────────────────────────
import random

@router.post("/assessments/{ref_type}/{ref_id}/start")
async def start_assessment_session(
    ref_type: str,
    ref_id: str,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    from app.models.project import AssessmentSession, Task, Assignment
    import random
    import uuid
    from datetime import datetime

    # Check for any existing sessions to enforce strict one-attempt policy
    existing = await db.execute(select(AssessmentSession).where(
        AssessmentSession.student_id == user.id,
        AssessmentSession.reference_id == ref_id
    ))
    sessions = existing.scalars().all()
    for s in sessions:
        if s.is_completed:
            raise HTTPException(status_code=400, detail="You have already completed or abandoned this assessment. Retakes are not permitted.")
            
    # If a session exists but is not completed, resume it
    session = sessions[0] if sessions else None
    if session:
        return {"session_id": session.id, "start_time": session.start_time.isoformat(), "resumed": True, "responses": session.responses}

    # Load the task/assignment for structured content
    if ref_type.upper() == "TASK":
        item = await db.get(Task, ref_id)
    else:
        item = await db.get(Assignment, ref_id)
    if not item:
        raise HTTPException(status_code=404, detail="Assessment not found")

    # Prepare frozen question list (Snapshot)
    questions = []
    if item.structured_content:
        content = json.loads(item.structured_content)
        if "questions" in content:
            questions = content["questions"]
            # Shuffle ONLY if randomization is enabled in the assignment/task
            if getattr(item, 'is_randomized', False):
                try:
                    random.shuffle(questions)
                    for q in questions:
                        opts = list(enumerate(q["options"]))
                        random.shuffle(opts)
                        
                        # Re-map the correct answer index to its new shuffled position
                        orig_answer_raw = q.get("answer", 0)
                        try:
                            orig_answer = int(orig_answer_raw)
                        except (ValueError, TypeError):
                            orig_answer = 0
                        
                        for new_idx, (old_idx, opt_text) in enumerate(opts):
                            if old_idx == orig_answer:
                                q["answer"] = new_idx
                        q["options"] = [opt_text for old_idx, opt_text in opts]
                except Exception as ex:
                    print(f"Randomization error: {ex}")

    # Create the session and store the FROZEN question snapshot immediately
    session = AssessmentSession(
        id=str(uuid.uuid4()),
        student_id=user.id,
        reference_id=ref_id,
        reference_type=ref_type.upper(),
        responses=json.dumps({"questions": questions}),
        start_time=datetime.utcnow()
    )
    db.add(session)
    await db.commit() # Commit fully to ensure session.responses is persisted
    await db.refresh(session)

    return {
        "session_id": session.id, 
        "start_time": session.start_time.isoformat(), 
        "resumed": False,
        "responses": session.responses
    }


@router.get("/assessments/{session_id}/questions")
async def get_session_questions(
    session_id: str,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    from app.models.project import AssessmentSession
    # Get session questions

    session = await db.get(AssessmentSession, session_id)
    if not session or session.student_id != user.id:
        raise HTTPException(status_code=404, detail="Session not found")

    time_limit = 0
    if session.reference_type == "TASK":
        item = await db.get(Task, session.reference_id)
    else:
        item = await db.get(Assignment, session.reference_id)
    if item:
        time_limit = getattr(item, 'time_limit', 0)

    # Calculation for response
    remaining_seconds = max(0, time_limit * 60 - int(elapsed)) if time_limit > 0 else None

    # Inactivity check (10-minute rule) for resumption
    if not session.is_completed and session.updated_at:
        inactive_seconds = (datetime.utcnow() - session.updated_at.replace(tzinfo=None)).total_seconds()
        if inactive_seconds > 600: # 10 minutes
            session.is_completed = True
            session.auto_submitted = True
            session.end_time = datetime.utcnow()
            await db.flush()
            return {
                "session_id": session.id,
                "is_completed": True,
                "status": "cancelled",
                "reason": "inactivity_timeout"
            }

    # Smart content source: session.responses may contain either:
    #   a) Randomized question data (has 'questions' key) → use it
    #   b) Heartbeat-saved answers (has 'saved_answers' key only) → use item.structured_content instead
    content_raw = None
    if session.responses:
        try:
            sess_data = json.loads(session.responses)
            if isinstance(sess_data, dict) and "questions" in sess_data:
                # This is a randomized question snapshot — use it
                content_raw = session.responses
            # else: heartbeat saved_answers — fall through to item.structured_content
        except Exception:
            pass

    # Always fall back to the original item content
    if content_raw is None:
        content_raw = item.structured_content if item else None

    content = {}
    if content_raw:
        try:
            content = json.loads(content_raw)
        except Exception:
            pass

    qs_list = []
    if isinstance(content, list):
        qs_list = content
    elif isinstance(content, dict) and "questions" in content:
        qs_list = content["questions"]

    questions_for_student = []
    for i, q in enumerate(qs_list):
        if not isinstance(q, dict):
            continue
        entry: dict = {
            "index": i,
            "question": q.get("question", ""),
            "options": q.get("options", []),
            "difficulty": q.get("difficulty"),
            "topic": q.get("topic"),
        }
        if "initial_code" in q:
            entry["initial_code"] = q["initial_code"]
        if "hints" in q:
            entry["hints"] = q["hints"]
        if "constraints" in q:
            entry["constraints"] = q["constraints"]
        questions_for_student.append(entry)

    # For non-MCQ coding tasks (no questions array), build description from requirements
    task_description = content.get("description", "")
    if not task_description and isinstance(content, dict):
        requirements = content.get("requirements", [])
        hints = content.get("hints", [])
        parts = []
        if requirements:
            parts.append("Requirements:\n" + "\n".join(f"• {r}" for r in requirements))
        if hints:
            parts.append("Hints:\n" + "\n".join(f"💡 {h}" for h in hints))
        task_description = "\n\n".join(parts) if parts else (item.description or "")

    # Extract score and results from responses if available
    session_score = session.score or 0
    session_results = []
    ai_status = "n/a"
    if session.responses:
        try:
            resp_data = json.loads(session.responses)
            session_results = resp_data.get("results", [])
            ai_status = resp_data.get("ai_grading", "n/a")
        except Exception:
            pass

    return {
        "session_id": session.id,
        "start_time": session.start_time.isoformat(),
        "remaining_seconds": remaining_seconds,
        "time_limit_mins": time_limit,
        "is_completed": session.is_completed,
        "tab_switch_count": session.tab_switch_count,
        "questions": questions_for_student,
        "title": content.get("title", item.title if item else ""),
        "description": task_description,
        "score": session_score,
        "results": session_results,
        "ai_grading": ai_status,
    }


@router.post("/assessments/{session_id}/heartbeat")
async def session_heartbeat(
    session_id: str,
    body: dict,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    from app.models.project import AssessmentSession
    # Session heartbeat

    session = await db.get(AssessmentSession, session_id)
    if not session or session.student_id != user.id:
        raise HTTPException(status_code=404, detail="Session not found")
    if session.is_completed:
        return {"status": "already_completed", "score": session.score}

    # Auto-submit check: check time limit server-side
    if session.reference_type == "TASK":
        item = await db.get(Task, session.reference_id)
    else:
        item = await db.get(Assignment, session.reference_id)

    time_limit = getattr(item, 'time_limit', 0) if item else 0
    elapsed = (datetime.utcnow() - session.start_time).total_seconds()
    remaining_seconds = max(0, time_limit * 60 - int(elapsed)) if time_limit > 0 else 9999

    # Save answers WITHOUT overwriting the question data (CRITICAL STABILITY FIX)
    if "answers" in body:
        existing_resp = session.responses or "{}"
        try:
            resp_data = json.loads(existing_resp)
            if isinstance(resp_data, dict) and "questions" in resp_data:
                # Preserve question data, merge saved answers
                resp_data["saved_answers"] = body["answers"]
                session.responses = json.dumps(resp_data)
            else:
                # No question data yet, just save answers
                session.responses = json.dumps({"saved_answers": body["answers"]})
        except Exception:
            pass

    # Log proctoring violations
    violation_sent = False
    
    if body.get("tab_switched"):
        session.tab_switch_count = (session.tab_switch_count or 0) + 1
        violation_sent = "TAB_SWITCHING"
    if body.get("fullscreen_exited"):
        session.fullscreen_exit_count = (session.fullscreen_exit_count or 0) + 1
        violation_sent = "FULLSCREEN_EXIT"
    if body.get("face_violation"):
        session.face_violation_count = (session.face_violation_count or 0) + 1
        violation_sent = "FACE_LOSS"
    if body.get("mic_violation"):
        session.mic_violation_count = (session.mic_violation_count or 0) + 1
        violation_sent = "MIC_OFF"

    # Auto-create Violation record for face violations with screenshot evidence
    # Throttle: max 1 record per 30 seconds per student per session
    if body.get("face_violation"):
        face_desc = body.get("face_description", "Face violation during assessment")
        screenshot_b64 = body.get("screenshot_base64")
        item_title = getattr(item, 'title', 'Unknown') if item else 'Unknown'

        # Check throttle: find last violation for this student + reference
        last_viol_res = await db.execute(
            select(Violation).where(
                Violation.student_id == user.id,
                Violation.reference_id == session.reference_id,
                Violation.type == ViolationType.FACE_LOSS,
            ).order_by(Violation.created_at.desc()).limit(1)
        )
        last_viol = last_viol_res.scalars().first()
        
        should_create = True
        if last_viol and last_viol.created_at:
            seconds_since = (datetime.utcnow() - last_viol.created_at.replace(tzinfo=None)).total_seconds()
            if seconds_since < 30:
                should_create = False

        if should_create:
            face_count = session.face_violation_count or 1
            severity = ViolationSeverity.MEDIUM if face_count < 3 else ViolationSeverity.HIGH
            new_violation = Violation(
                student_id=user.id,
                type=ViolationType.FACE_LOSS,
                severity=severity,
                title=f"Face violation during: {item_title}",
                description=face_desc,
                reference_type=session.reference_type,
                reference_id=session.reference_id,
                penalty_points=2 if face_count < 3 else 5,
                screenshot_url=screenshot_b64[:500000] if screenshot_b64 else None,  # cap at ~500KB
            )
            db.add(new_violation)

    # Emit real-time alert if a violation occurred
    if violation_sent and item and item.batch_id:
        background_tasks.add_task(
            emit_violation_alert, 
            item.batch_id, 
            {
                "student_id": user.id,
                "student_name": user.name,
                "type": violation_sent,
                "timestamp": datetime.utcnow().isoformat(),
                "reference_id": session.reference_id,
                "reference_type": session.reference_type
            }
        )


    # Inactivity check (10-minute rule)
    # If the student resume a session after being 'gone' for > 10 mins
    # This is checked here and in get_questions
    if session.updated_at:
        inactive_seconds = (datetime.utcnow() - session.updated_at.replace(tzinfo=None)).total_seconds()
        if inactive_seconds > 600: # 10 minutes
            session.is_completed = True
            session.auto_submitted = True
            session.end_time = datetime.utcnow()
            await db.flush()
            return {"status": "cancelled", "reason": "inactivity_timeout"}

    await db.flush()

    # Hard cut-off: auto-submit on excessive tab switches (optional, kept for backward compatibility)
    if remaining_seconds <= 0 or (session.tab_switch_count or 0) >= 10: # Increased limit since we have 30s grace
        reason = "time_expired" if remaining_seconds <= 0 else "excessive_violations"
        session.is_completed = True
        session.auto_submitted = True
        session.end_time = datetime.utcnow()
        session.completion_time_seconds = int(elapsed)
        await db.flush()
        return {"status": "auto_submitted", "reason": reason}

    return {
        "status": "saved",
        "remaining_seconds": remaining_seconds,
        "tab_switch_count": session.tab_switch_count,
        "fullscreen_exit_count": session.fullscreen_exit_count,
        "face_violation_count": session.face_violation_count,
    }


@router.post("/assessments/{session_id}/submit")
async def submit_assessment(
    session_id: str,
    body: dict,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    from app.models.project import AssessmentSession
    # Submit assessment

    session = await db.get(AssessmentSession, session_id)
    if not session or session.student_id != user.id:
        raise HTTPException(status_code=404, detail="Session not found")
    if session.is_completed:
        return {"status": "already_completed", "score": session.score}

    if session.reference_type == "TASK":
        item = await db.get(Task, session.reference_id)
    else:
        item = await db.get(Assignment, session.reference_id)

    student_answers = body.get("answers", {})  # {question_index: selected_option_index}
    
    # NEW: If student_answers has a 'content' key that looks like JSON, parse it.
    # This handles the frontend's current behavior of stringifying mcqAnswers into 'content'.
    if isinstance(student_answers, dict) and "content" in student_answers:
        content_val = student_answers["content"]
        if isinstance(content_val, str) and content_val.strip().startswith('{'):
            try:
                student_answers = json.loads(content_val)
            except:
                pass
    score = 0.0
    results = []

    # Grade MCQ answers if structured content available
    # CRITICAL: Prefer session snapshot questions to maintain order stability
    questions_source = None
    if session.responses and session.responses.strip().startswith('{'):
        try:
            sess_content = json.loads(session.responses)
            if "questions" in sess_content:
                questions_source = sess_content["questions"]
        except Exception:
            pass
            
    # Fallback to original structured content only if session snapshot is missing
    if questions_source is None and item and item.structured_content:
        try:
            item_content = json.loads(item.structured_content)
            questions_source = item_content.get("questions", [])
        except Exception:
            pass

    # Determine task type upfront so MCQ grader can skip coding answers
    is_pure_coding = False
    if questions_source:
        first_q = questions_source[0] if questions_source else {}
        if not first_q.get("options"):  # coding questions have no options
            is_pure_coding = True
    elif student_answers:  # no questions source at all = pure coding fallback
        is_pure_coding = True

    if questions_source and not is_pure_coding:
        try:
            questions = questions_source
            total = len(questions)
            if total > 0:
                correct_count = 0
                for i, q in enumerate(questions):
                    selected_raw = student_answers.get(str(i)) if str(i) in student_answers else student_answers.get(i)
                    correct = q.get("answer", -1)
                    try:
                        correct = int(correct)
                    except (ValueError, TypeError):
                        correct = -1
                    # Only grade if selected is a number (MCQ selection), not code string
                    try:
                        selected_int = int(selected_raw) if selected_raw is not None else None
                    except (ValueError, TypeError):
                        selected_int = None
                    is_correct = selected_int is not None and selected_int == correct
                    if is_correct:
                        correct_count += 1
                    results.append({
                        "index": i,
                        "question": q.get("question", ""),
                        "options": q.get("options", []),
                        "selected": selected_raw,
                        "correct": correct,
                        "is_correct": is_correct,
                        "explanation": q.get("explanation", ""),
                        "topic": q.get("topic", ""),
                    })
                score = round((correct_count / total) * 100, 1)
        except Exception as e:
            print(f"Grading error: {e}")

    # ── Save submission immediately (do NOT wait for AI grading) ──
    # This ensures the response is returned within Render's 30s timeout.
    elapsed = int((datetime.utcnow() - session.start_time).total_seconds())
    session.score = score
    session.is_completed = True
    session.end_time = datetime.utcnow()
    session.completion_time_seconds = elapsed
    # Store results in session.responses
    # NEW: Merge results into existing session.responses (which may hold randomized questions)
    existing_responses = {}
    if session.responses and session.responses.strip().startswith('{'):
        try:
            existing_responses = json.loads(session.responses)
        except:
            pass
            
    existing_responses.update({
        "answers": student_answers,
        "results": results,
        "final_score": score,
        "total_questions": len(questions_source) if questions_source else 0,
        "ai_grading": "pending" if is_pure_coding else "n/a"
    })
    session.responses = json.dumps(existing_responses)
    
    # ── Map to AssignmentSubmission for UI compatibility ──
    if session.reference_type == "ASSIGNMENT":
        from app.models.project import AssignmentSubmission
        res_sub = await db.execute(select(AssignmentSubmission).where(
            AssignmentSubmission.assignment_id == session.reference_id,
            AssignmentSubmission.student_id == user.id
        ))
        existing_sub = res_sub.scalars().first()
        if existing_sub:
            existing_sub.marks = score
            if not is_pure_coding:
                existing_sub.feedback = f"Automatically graded: {score}%"
        else:
            raw_content = ""
            if is_pure_coding and student_answers:
                # Merge student's coding answers into a single readable string for the legacy view
                raw_content = "\n\n".join([str(v) for v in student_answers.values() if str(v).strip()])
            
            new_sub = AssignmentSubmission(
                id=str(uuid.uuid4()),
                assignment_id=session.reference_id,
                student_id=user.id,
                content=raw_content or "Submitted via Proctored Session",
                marks=score,
                feedback="AI Grading Pending..." if is_pure_coding else f"Automatically graded: {score}%"
            )
            db.add(new_sub)

    await db.flush()

    # ── Kick off AI grading as a fire-and-forget background task ──
    if is_pure_coding and student_answers:
        import asyncio
        from app.utils.ai_grader import evaluate_submission

        async def _grade_in_background():
            try:
                student_code_block = ""
                code_count = 0
                for idx, code in student_answers.items():
                    # Only include string answers that look like actual code (not MCQ option '0', '1', etc)
                    # For multi-question tasks, the keys '0', '1', '2' hold code if it's a pure coding task.
                    if isinstance(code, str) and len(code.strip()) > 1:
                        # Exclude single digit strings which are likely unintentional MCQ selections
                        if code.strip().isdigit() and len(code.strip()) == 1:
                            continue
                        
                        try:
                            # If key is numeric, use it. Otherwise (e.g. 'content'), use 1 as default problem index.
                            prob_num = int(idx) + 1 if str(idx).isdigit() else 1
                        except:
                            prob_num = 1
                            
                        student_code_block += f"### PROBLEM {prob_num}:\n{code}\n\n"
                        code_count += 1
                        
                if not student_code_block:
                    print(f"[AI Grading] ⚠️ No valid code found to grade for session {session_id}")
                    return

                print(f"[AI Grading] 🚀 Sending {code_count} problems ({len(student_code_block)} chars) to Groq for session {session_id}...")

                task_context = f"Title: {item.title}\nDescription: {item.description or ''}\n"
                if item.structured_content:
                    task_context += f"Detailed Requirements: {item.structured_content}"

                try:
                    eval_res = await asyncio.wait_for(
                        asyncio.to_thread(evaluate_submission, task_context, student_code_block),
                        timeout=60.0 # Increased timeout for larger multi-question tasks
                    )
                except asyncio.TimeoutError:
                    eval_res = {"score": 0, "feedback": "AI grading timed out. Your trainer will review this submission manually."}

                ai_score = float(eval_res.get("score", 0))
                ai_feedback = eval_res.get("feedback", "No feedback.")

                # Open a fresh DB session to update the score
                from app.database import AsyncSessionLocal
                async with AsyncSessionLocal() as bg_db:
                    from app.models.project import AssessmentSession as AS
                    bg_session = await bg_db.get(AS, session_id)
                    if bg_session:
                        import json as jl
                        resp = jl.loads(bg_session.responses or "{}")
                        
                        # Store feedback and update the score
                        feedback_entry = {
                            "type": "coding_feedback",
                            "score": ai_score,
                            "feedback": ai_feedback
                        }
                        
                        current_results = resp.get("results", [])
                        # Ensure we don't duplicate feedback
                        filtered_results = [r for r in current_results if r.get("type") != "coding_feedback"]
                        filtered_results.append(feedback_entry)
                        
                        resp["results"] = filtered_results
                        resp["ai_grading"] = "done"
                        bg_session.score = ai_score
                        bg_session.responses = jl.dumps(resp)
                        
                        await bg_db.commit()

                        # ── SYNC TO ASSIGNMENTSUBMISSION ──
                        if bg_session.reference_type == "ASSIGNMENT":
                            from app.models.project import AssignmentSubmission as ASUB
                            # Open another session for the sync to be safe
                            async with AsyncSessionLocal() as sync_db:
                                res_asub = await sync_db.execute(select(ASUB).where(
                                    ASUB.assignment_id == bg_session.reference_id,
                                    ASUB.student_id == bg_session.student_id
                                ))
                                sub_to_update = res_asub.scalars().first()
                                if sub_to_update:
                                    sub_to_update.marks = int(ai_score)
                                    sub_to_update.feedback = ai_feedback
                                    await sync_db.commit()
                                    print(f"[AI Grading] ✅ Synced score {int(ai_score)}% to AssignmentSubmission for student {bg_session.student_id}")
                        print(f"[AI Grading] ✅ Session {session_id} successfully graded: {ai_score}%")
            except Exception as bg_err:
                print(f"[AI Grading Background] ❌ EXCEPTION: {bg_err}")
                import traceback
                traceback.print_exc()

        background_tasks.add_task(_grade_in_background)

    return {
        "status": "submitted",
        "score": score,
        "completion_time_seconds": elapsed,
        "results": results,
        "ai_grading": "pending" if is_pure_coding else "n/a",
    }


@router.get("/assessments/{ref_id}/ranking")
async def get_assessment_ranking(
    ref_id: str,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    from app.models.project import AssessmentSession

    # Get all completed sessions for this assessment, sorted by score DESC then completion time ASC
    result = await db.execute(
        select(AssessmentSession, User.name)
        .join(User, AssessmentSession.student_id == User.id)
        .where(AssessmentSession.reference_id == ref_id, AssessmentSession.is_completed == True)
        .order_by(AssessmentSession.score.desc(), AssessmentSession.completion_time_seconds.asc())
        .limit(10)
    )
    rows = result.all()

    ranking = []
    current_rank = None
    for i, (s, name) in enumerate(rows):
        entry = {
            "rank": i + 1, "name": name,
            "score": s.score,
            "completion_time_seconds": s.completion_time_seconds,
            "auto_submitted": s.auto_submitted,
        }
        ranking.append(entry)
        if s.student_id == user.id:
            current_rank = i + 1

    # Find current user's rank if not in top 10
    if current_rank is None:
        all_result = await db.execute(
            select(AssessmentSession)
            .where(AssessmentSession.reference_id == ref_id, AssessmentSession.is_completed == True)
            .order_by(AssessmentSession.score.desc(), AssessmentSession.completion_time_seconds.asc())
        )
        all_sessions = all_result.scalars().all()
        for i, s in enumerate(all_sessions):
            if s.student_id == user.id:
                current_rank = i + 1
                break

    return {"ranking": ranking, "my_rank": current_rank}


@router.post("/run-code")
async def run_code(
    body: dict,
    _user: User = Depends(get_current_user),
):
    """Secure code execution proxy to Piston API."""
    language = body.get("language", "python")
    code = body.get("code", "")
    stdin = body.get("stdin", "")
    version = body.get("version", "*")

    if not code.strip():
        return {"stdout": "", "stderr": "No code provided.", "code": 1}

    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.post(
                "https://emkc.org/api/v2/piston/execute",
                json={
                    "language": language,
                    "version": version,
                    "files": [{"content": code}],
                    "stdin": stdin
                }
            )
        if not resp.is_success:
            err_txt = resp.text
            raise Exception("piston_unavailable")
        data = resp.json()
        run_result = data.get("run", {})
        compile_result = data.get("compile", {})
        return {
            "stdout": run_result.get("stdout", ""),
            "stderr": run_result.get("stderr", "") or compile_result.get("stderr", ""),
            "code": run_result.get("code", 0),
            "signal": run_result.get("signal"),
            "language": data.get("language"),
            "version": data.get("version"),
        }
    except Exception as e:
        # Fallback to Compiler Explorer (Godbolt) API
        lang_str = body.get("language", language).lower()
        gb_compiler = "python311"
        if "java" in lang_str and "javascript" not in lang_str:
            gb_compiler = "java2100"
        elif "c++" in lang_str or "cpp" in lang_str:
            gb_compiler = "g141"
        elif "javascript" in lang_str or "node" in lang_str:
            gb_compiler = "v8113"

        try:
            # `code` was already extracted at top of function from body["code"]
            # Do NOT re-read from body["files"] - frontend sends plain {code, language, stdin}
            source_code = code  # already set from body.get("code", "") above
            stdin_data = body.get("stdin", stdin)

            # Godbolt always saves Java files as "example.java"
            # So rename the public class to "example" to avoid compile error
            if "java" in lang_str and "javascript" not in lang_str:
                import re
                source_code = re.sub(
                    r'public\s+class\s+\w+',
                    'public class example',
                    source_code
                )

            async with httpx.AsyncClient(timeout=15.0) as client:
                res = await client.post(
                    f"https://godbolt.org/api/compiler/{gb_compiler}/compile",
                    json={
                        "source": source_code,
                        "options": {
                            "userArguments": "",
                            "executeParameters": {"args": [], "stdin": stdin_data},
                            "compilerOptions": {"executorRequest": True}
                        },
                        "filters": {"execute": True}
                    },
                    headers={"Accept": "application/json"}
                )

                if not res.is_success:
                    raise Exception(f"Godbolt execution failed: {res.status_code}")

                data = res.json()

                # Godbolt returns stdout/stderr as list of {"text": "..."} dicts
                out_arr = data.get("stdout", [])
                err_arr = data.get("stderr", [])
                build_err_arr = data.get("buildResult", {}).get("stderr", [])

                stdout_str = "\n".join(x.get("text", "") for x in out_arr)
                stderr_str = "\n".join(x.get("text", "") for x in err_arr + build_err_arr)

                return {
                    "stdout": stdout_str,
                    "stderr": stderr_str,
                    "code": data.get("code", 0),
                    "signal": None,
                    "language": lang_str,
                    "version": gb_compiler,
                }

        except httpx.TimeoutException:
            return {"stdout": "", "stderr": "Execution timed out (15s limit).", "code": 1}
        except Exception as ex:
            raise HTTPException(status_code=502, detail=f"Code runner unavailable: Both primary and cloud compilers failed. Details: {str(ex)}")


@router.get("/piston/runtimes")
async def get_runtimes(_user: User = Depends(get_current_user)):
    """Fetch available Piston language runtimes."""
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.get("https://emkc.org/api/v2/piston/runtimes")
        if resp.is_success:
            return resp.json()
        return []
    except Exception:
        return []


class ChatMessage(PydanticBaseModel):
    role: str   # "user" or "model"
    text: str

class ChatRequest(PydanticBaseModel):
    message: str
    history: TypingList[ChatMessage] = []

# SYSTEM_CONTEXT moved to app.utils.ai_prompts

@router.post("/chatbot")
async def chatbot_proxy(
    body: ChatRequest,
    db: AsyncSession = Depends(get_db),
    user: User | None = Depends(get_optional_user)
):
    api_key = os.environ.get("GROQ_API_KEY")
    if not api_key:
        raise HTTPException(status_code=503, detail="Chatbot not configured. Please contact support.")

    # Base context
    system_prompt = SYSTEM_CONTEXT
    
    # Add User Context if logged in — wrapped in try/except so chatbot
    # still works even if the DB session is stale (Neon cold-start / timeout)
    if user:
        # Cache user attributes NOW before any DB ops (avoids lazy-load greenlet errors)
        user_id = user.id
        user_name = user.name
        user_email = user.email
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
            
            avg_marks_res = await db.execute(select(func.avg(AssignmentSubmission.marks)).where(AssignmentSubmission.student_id == user_id))
            avg_marks = avg_marks_res.scalar() or 0
            
            context_block = f"""
[PERSONALIZED CONTEXT FOR AI ASSISTANT]
You are now speaking with: {user_name} ({user_role})
Email: {user_email}
Active Batches: {batch_str}
Attendance: {att_pct}% ({present}/{total_att} days)
Assignment Progress: {done_assign} completed out of {total_assign} assigned.
Average Score: {avg_marks:.1f}%

INSTRUCTIONS: Use this data to provide personalized mentorship. If attendance is low, encourage them. If assignments are pending, gently remind them. Act as their personal LMS mentor while maintaining the AppTechno AI persona.
"""
            system_prompt += context_block
        except Exception as db_err:
            # Gracefully degrade — chatbot works without personalization
            try:
                await db.rollback()
            except Exception:
                pass
            # Add minimal user context from cached values (no DB needed)
            system_prompt += f"\n[USER]: {user_name} ({user_role}). Personalized data unavailable due to a temporary issue.\n"

    # Build OpenAI-compatible messages array (Groq uses OpenAI format)
    messages = [{"role": "system", "content": system_prompt}]

    # Add conversation history
    for msg in body.history:
        role = "assistant" if msg.role == "model" else "user"
        messages.append({"role": role, "content": msg.text})

    # Add current user message
    messages.append({"role": "user", "content": body.message})

    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.post(
                "https://api.groq.com/openai/v1/chat/completions",
                headers={
                    "Authorization": f"Bearer {api_key}",
                    "Content-Type": "application/json"
                },
                json={
                    "model": "llama-3.1-8b-instant",
                    "messages": messages,
                    "temperature": 0.7,
                    "max_tokens": 512
                }
            )
        if resp.status_code == 429:
            raise HTTPException(status_code=429, detail="AI is a bit busy. Please try again in a moment.")
        if not resp.is_success:
            raise HTTPException(status_code=502, detail=f"AI service error: {resp.status_code}")
        data = resp.json()
        reply = data["choices"][0]["message"]["content"]
        return {"reply": reply}
    except httpx.TimeoutException:
        raise HTTPException(status_code=504, detail="AI response timed out. Please try again.")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Chatbot error: {str(e)}")

@router.get("/students/{user_id}/full-report")
async def get_student_full_report(
    user_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles(Role.SUPER_ADMIN, Role.ADMIN, Role.TRAINER))
):
    student = await db.get(User, user_id)
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")

    # 1. Academic Performance
    # Get all assignments from batches this student belongs to
    batch_ids_res = await db.execute(select(BatchStudent.batch_id).where(BatchStudent.student_id == user_id))
    batch_ids = batch_ids_res.scalars().all()
    
    # Also direct assignments
    assignments_res = await db.execute(
        select(Assignment).where((Assignment.batch_id.in_(batch_ids)) | (Assignment.student_id == user_id))
    )
    assignments = assignments_res.scalars().all()
    assignment_ids = [a.id for a in assignments]
    
    submissions_res = await db.execute(
        select(AssignmentSubmission).where((AssignmentSubmission.student_id == user_id) & (AssignmentSubmission.assignment_id.in_(assignment_ids)))
    )
    submissions_map = {sub.assignment_id: sub for sub in submissions_res.scalars().all()}
    
    academic_list = []
    total_marks_earned = 0
    total_marks_possible = 0
    
    for a in assignments:
        sub = submissions_map.get(a.id)
        academic_list.append({
            "id": a.id, "title": a.title, "type": a.type.value,
            "status": "SUBMITTED" if sub else "PENDING",
            "marks": sub.marks if sub else 0,
            "total_marks": a.total_marks,
            "submitted_at": sub.submitted_at.isoformat() if sub and sub.submitted_at else None
        })
        if sub:
            total_marks_earned += (sub.marks or 0)
        total_marks_possible += a.total_marks

    grade_percentage = (total_marks_earned / total_marks_possible * 100) if total_marks_possible > 0 else 0

    # 2. Attendance Stats
    attendance_res = await db.execute(select(Attendance).where(Attendance.student_id == user_id))
    attendance_records = attendance_res.scalars().all()
    total_days = len(attendance_records)
    present_days = len([r for r in attendance_records if r.status == "PRESENT"])
    late_days = len([r for r in attendance_records if r.status == "LATE"])
    attendance_percentage = ((present_days + late_days) / total_days * 100) if total_days > 0 else 0

    # 3. Proctoring & Violations
    violations_res = await db.execute(select(Violation).where(Violation.student_id == user_id))
    violations = violations_res.scalars().all()
    violation_summary = {
        "total": len(violations),
        "TAB_SWITCH": len([v for v in violations if v.type == ViolationType.TAB_SWITCHING]),
        "FACE_LOSS": len([v for v in violations if v.type == ViolationType.FACE_LOSS]),
        "MIC_OFF": len([v for v in violations if v.type == ViolationType.MIC_OFF]),
        "FULLSCREEN_EXIT": len([v for v in violations if v.type == ViolationType.FULLSCREEN_EXIT])
    }

    # 4. Effort & Time Tracking
    time_res = await db.execute(select(func.sum(TimeTracking.total_minutes)).where(TimeTracking.user_id == user_id))
    total_minutes = time_res.scalar() or 0
    
    # 5. Leave History
    leave_res = await db.execute(select(LeaveRequest).where(LeaveRequest.user_id == user_id))
    leaves = leave_res.scalars().all()

    return {
        "student": {
            "id": student.id,
            "name": student.name,
            "email": student.email,
            "student_id": student.student_id,
            "joined_at": student.created_at.isoformat() if student.created_at else None
        },
        "stats": {
            "grade_percentage": round(grade_percentage, 1),
            "attendance_percentage": round(attendance_percentage, 1),
            "total_work_hours": round(total_minutes / 60, 1),
            "total_violations": violation_summary["total"]
        },
        "academics": academic_list,
        "violations_detail": violation_summary,
        "attendance": {
            "total": total_days,
            "present": present_days,
            "late": late_days,
            "absent": total_days - present_days - late_days
        },
        "leaves": len(leaves)
    }
