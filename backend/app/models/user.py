import enum
import uuid
from datetime import datetime

from sqlalchemy import String, Boolean, DateTime, Enum, func, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class Role(str, enum.Enum):
    SUPER_ADMIN = "SUPER_ADMIN"
    ADMIN = "ADMIN"
    TRAINER = "TRAINER"
    STUDENT = "STUDENT"
    MARKETER = "MARKETER"


class AdminPermission(Base):
    __tablename__ = "admin_permissions"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id: Mapped[str] = mapped_column(String, ForeignKey("users.id"), unique=True)
    manage_users: Mapped[bool] = mapped_column(Boolean, default=False)
    manage_batches: Mapped[bool] = mapped_column(Boolean, default=False)
    manage_courses: Mapped[bool] = mapped_column(Boolean, default=False)
    manage_leaves: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), onupdate=func.now())

    user = relationship("User", back_populates="permissions")


class User(Base):
    __tablename__ = "users"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    email: Mapped[str] = mapped_column(String, unique=True, index=True)
    password: Mapped[str] = mapped_column(String)
    name: Mapped[str] = mapped_column(String)
    phone: Mapped[str | None] = mapped_column(String, nullable=True)
    role: Mapped[Role] = mapped_column(Enum(Role), default=Role.STUDENT)
    avatar: Mapped[str | None] = mapped_column(String, nullable=True)
    # student_id: Mapped[str | None] = mapped_column(String, unique=True, nullable=True)
    dob: Mapped[str | None] = mapped_column(String, nullable=True)
    education_status: Mapped[str | None] = mapped_column(String, nullable=True) # e.g. Studying, Passout
    highest_education: Mapped[str | None] = mapped_column(String, nullable=True)
    degree: Mapped[str | None] = mapped_column(String, nullable=True)
    passing_year: Mapped[str | None] = mapped_column(String, nullable=True)
    can_build_resume: Mapped[bool] = mapped_column(Boolean, default=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    is_verified: Mapped[bool] = mapped_column(Boolean, default=False)
    is_blocked: Mapped[bool] = mapped_column(Boolean, default=False)
    verification_code: Mapped[str | None] = mapped_column(String, nullable=True)
    verification_expiry: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), onupdate=func.now())


    # Relationships
    trainer_batches = relationship("Batch", back_populates="trainer", foreign_keys="Batch.trainer_id")
    batch_enrollments = relationship("BatchStudent", back_populates="student")
    leads_assigned = relationship("Lead", back_populates="assigned_to", foreign_keys="Lead.assigned_to_id")
    registrations = relationship("Registration", back_populates="student")
    documents = relationship("Document", back_populates="student")
    attendance_records = relationship("Attendance", back_populates="student")
    leave_requests = relationship("LeaveRequest", back_populates="user", foreign_keys="LeaveRequest.user_id")
    leaves_approved = relationship("LeaveRequest", back_populates="approved_by", foreign_keys="LeaveRequest.approved_by_id")
    tasks_assigned = relationship("Task", back_populates="trainer", foreign_keys="Task.assigned_by")
    assignments_assigned = relationship("Assignment", back_populates="trainer", foreign_keys="Assignment.assigned_by")
    assignment_submissions = relationship("AssignmentSubmission", back_populates="student", foreign_keys="AssignmentSubmission.student_id")
    feedback_received = relationship("Feedback", back_populates="student", foreign_keys="Feedback.student_id")
    feedback_given = relationship("Feedback", back_populates="created_by", foreign_keys="Feedback.created_by_id")
    job_applications = relationship("JobApplication", back_populates="student")
    assessment_submissions = relationship("AssessmentSubmission", back_populates="student")
    mock_interviews = relationship("MockInterview", back_populates="student")
    notifications = relationship("Notification", back_populates="user")
    comm_practice = relationship("CommunicationPractice", back_populates="student")
    time_tracking = relationship("TimeTracking", back_populates="user")
    lead_activities = relationship("LeadActivity", back_populates="user")
    permissions = relationship("AdminPermission", back_populates="user", uselist=False)

