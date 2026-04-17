from datetime import datetime
from pydantic import BaseModel, Field


# ─── Auth ──────────────────────────────────────────────
class LoginRequest(BaseModel):
    email: str
    password: str

class SendOTPRequest(BaseModel):
    email: str

class VerifyOTPRequest(BaseModel):
    email: str
    otp: str

class VerifyEmailRequest(BaseModel):
    email: str
    code: str



class RegisterRequest(BaseModel):
    name: str
    email: str
    password: str
    role: str = "STUDENT"
    phone: str | None = Field(default=None, max_length=10)
    course: str | None = None

class AdminPasswordChangeRequest(BaseModel):
    new_password: str
    
class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: "UserOut"

class AdminPermissionUpdate(BaseModel):
    manage_users: bool = False
    manage_batches: bool = False
    manage_courses: bool = False
    manage_leaves: bool = False

class AdminPermissionOut(AdminPermissionUpdate):
    id: str
    user_id: str

    class Config:
        from_attributes = True

class UserOut(BaseModel):
    id: str
    email: str
    name: str
    phone: str | None
    role: str
    student_id: str | None
    dob: str | None = None
    education_status: str | None = None
    highest_education: str | None = None
    degree: str | None = None
    passing_year: str | None = None
    can_build_resume: bool = False
    is_active: bool
    created_at: datetime
    permissions: AdminPermissionOut | None = None

    class Config:
        from_attributes = True
        use_enum_values = True

# ─── Courses ───────────────────────────────────────────
class CourseCreate(BaseModel):
    name: str
    description: str | None = None
    duration: str | None = None
    fee: float = 0

class CourseOut(BaseModel):
    id: str
    name: str
    description: str | None
    duration: str | None
    fee: float
    is_active: bool
    created_at: datetime
    batch_count: int = 0
    student_count: int = 0

    class Config:
        from_attributes = True

# ─── Batches ───────────────────────────────────────────
class BatchCreate(BaseModel):
    course_id: str | None = None
    name: str
    start_date: str
    end_date: str
    schedule_time: str | None = None
    schedule_link: str | None = None
    trainer_id: str | None = None

class BatchUpdate(BaseModel):
    course_id: str | None = None
    name: str | None = None
    start_date: str | None = None
    end_date: str | None = None
    schedule_time: str | None = None
    schedule_link: str | None = None
    trainer_id: str | None = None
    is_active: bool | None = None

class BatchOut(BaseModel):
    id: str
    name: str
    start_date: datetime
    end_date: datetime
    is_active: bool
    schedule_time: str | None = None
    schedule_link: str | None = None
    course_name: str | None = None
    trainer_name: str | None = None
    student_count: int = 0

    class Config:
        from_attributes = True

# ─── Students ─────────────────────────────────────────
class StudentCreate(BaseModel):
    name: str
    email: str
    phone: str | None = None
    password: str = "welcome123"
    role: str = "STUDENT"

class StudentOut(BaseModel):
    id: str
    name: str
    email: str
    phone: str | None
    student_id: str | None
    role: str
    can_build_resume: bool = False
    is_active: bool
    created_at: datetime
    attendance_percentage: int | None = None
    days_present: int = 0
    days_absent: int = 0
    leaves_taken: int = 0

    class Config:
        from_attributes = True

# ─── Leads ─────────────────────────────────────────────
class LeadCreate(BaseModel):
    name: str
    email: str | None = None
    phone: str | None = None
    source: str | None = None
    notes: str | None = None
    assigned_to_id: str | None = None

class LeadUpdate(BaseModel):
    name: str | None = None
    email: str | None = None
    phone: str | None = None
    source: str | None = None
    status: str | None = None
    notes: str | None = None

class LeadOut(BaseModel):
    id: str
    name: str
    email: str | None
    phone: str | None
    source: str | None
    status: str
    notes: str | None
    assigned_to_name: str | None = None
    activity_count: int = 0
    created_at: datetime

    class Config:
        from_attributes = True

# ─── Attendance ────────────────────────────────────────
class AttendanceRecord(BaseModel):
    student_id: str
    batch_id: str
    date: str
    status: str

class AttendanceBulk(BaseModel):
    records: list[AttendanceRecord]

class AttendanceOut(BaseModel):
    id: str
    student_id: str
    student_name: str = ""
    student_sid: str | None = None
    batch_id: str
    date: datetime
    status: str

    class Config:
        from_attributes = True

# ─── Leave ─────────────────────────────────────────────
class LeaveCreate(BaseModel):
    start_date: str
    end_date: str
    reason: str | None = None

class LeaveAction(BaseModel):
    id: str
    status: str
    rejection_reason: str | None = None
    approved_by_id: str | None = None

class LeaveOut(BaseModel):
    id: str
    user_name: str = ""
    user_role: str = ""
    user_student_id: str | None = None
    leave_type: str = "OTHER"
    proof_url: str | None = None
    start_date: datetime
    end_date: datetime
    reason: str | None
    rejection_reason: str | None = None
    status: str
    approved_by_name: str | None = None
    created_at: datetime

    class Config:
        from_attributes = True

# ─── Projects / Tasks ─────────────────────────────────
class ProjectCreate(BaseModel):
    batch_id: str
    title: str
    description: str | None = None
    deadline: str | None = None

class TaskOut(BaseModel):
    id: str
    title: str
    status: str
    deadline: datetime | None
    violation_flag: bool
    student_name: str | None = None
    student_sid: str | None = None

    class Config:
        from_attributes = True

class ProjectOut(BaseModel):
    id: str
    title: str
    description: str | None
    deadline: datetime | None
    batch_name: str = ""
    task_count: int = 0
    tasks: list[TaskOut] = []

    class Config:
        from_attributes = True

# ─── Jobs ──────────────────────────────────────────────
class JobCreate(BaseModel):
    title: str
    company: str
    description: str | None = None
    location: str | None = None
    salary: str | None = None

class JobOut(BaseModel):
    id: str
    title: str
    company: str
    description: str | None
    location: str | None
    salary: str | None
    is_active: bool
    application_count: int = 0
    created_at: datetime

    class Config:
        from_attributes = True

# ─── Registrations ─────────────────────────────────────
class RegistrationCreate(BaseModel):
    student_id: str
    course_id: str
    batch_id: str | None = None
    fee_amount: float = 0
    fee_paid: float = 0

class RegistrationOut(BaseModel):
    id: str
    student_name: str = ""
    student_email: str = ""
    student_sid: str | None = None
    course_name: str = ""
    batch_name: str | None = None
    fee_amount: float
    fee_paid: float
    status: str
    created_at: datetime

    class Config:
        from_attributes = True

# ─── Dashboard ─────────────────────────────────────────
class DashboardStats(BaseModel):
    total_students: int = 0
    total_courses: int = 0
    total_batches: int = 0
    total_leads: int = 0
    active_jobs: int = 0
    pending_leaves: int = 0
    recent_leads: list[LeadOut] = []
