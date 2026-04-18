import enum
import uuid
from datetime import datetime

from sqlalchemy import String, Boolean, Float, Integer, DateTime, Enum, ForeignKey, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class ProjectStatus(str, enum.Enum):
    NOT_STARTED = "NOT_STARTED"
    IN_PROGRESS = "IN_PROGRESS"
    UNDER_REVIEW = "UNDER_REVIEW"
    COMPLETED = "COMPLETED"
    OVERDUE = "OVERDUE"


class TaskPriority(str, enum.Enum):
    LOW = "LOW"
    MEDIUM = "MEDIUM"
    HIGH = "HIGH"
    URGENT = "URGENT"


class TaskStatus(str, enum.Enum):
    PENDING = "PENDING"
    IN_PROGRESS = "IN_PROGRESS"
    COMPLETED = "COMPLETED"
    OVERDUE = "OVERDUE"


class AssignmentType(str, enum.Enum):
    CODING = "CODING"
    WRITTEN = "WRITTEN"
    MCQ = "MCQ"
    PROJECT = "PROJECT"


class ViolationType(str, enum.Enum):
    DEADLINE_MISSED = "DEADLINE_MISSED"
    LATE_SUBMISSION = "LATE_SUBMISSION"
    INCOMPLETE_WORK = "INCOMPLETE_WORK"
    LOW_ATTENDANCE = "LOW_ATTENDANCE"
    POOR_ACADEMIC_PERFORMANCE = "POOR_ACADEMIC_PERFORMANCE"
    UNAUTHORIZED_ASSISTANCE = "UNAUTHORIZED_ASSISTANCE"
    HONOR_CODE_VIOLATION = "HONOR_CODE_VIOLATION"
    DISRUPTIVE_BEHAVIOR = "DISRUPTIVE_BEHAVIOR"
    PLAGIARISM = "PLAGIARISM"
    TAB_SWITCHING = "TAB_SWITCHING"
    FACE_LOSS = "FACE_LOSS"
    FULLSCREEN_EXIT = "FULLSCREEN_EXIT"
    MIC_OFF = "MIC_OFF"
    MISSED_FEEDBACK = "MISSED_FEEDBACK"


class ViolationSeverity(str, enum.Enum):
    LOW = "LOW"
    MEDIUM = "MEDIUM"
    HIGH = "HIGH"
    CRITICAL = "CRITICAL"


class ViolationStatus(str, enum.Enum):
    OPEN = "OPEN"
    ACKNOWLEDGED = "ACKNOWLEDGED"
    RESOLVED = "RESOLVED"
    DISMISSED = "DISMISSED"


class Project(Base):
    __tablename__ = "projects"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    tech_stack: Mapped[str | None] = mapped_column(String(500), nullable=True)  # comma-separated
    github_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    batch_id: Mapped[str | None] = mapped_column(String, ForeignKey("batches.id"), nullable=True)
    trainer_id: Mapped[str | None] = mapped_column(String, ForeignKey("users.id"), nullable=True)
    status: Mapped[ProjectStatus] = mapped_column(Enum(ProjectStatus), default=ProjectStatus.NOT_STARTED)
    deadline: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)  # hard deadline
    start_date: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    end_date: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    max_team_size: Mapped[int] = mapped_column(Integer, default=4)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), onupdate=func.now())

    batch = relationship("Batch", back_populates="projects", foreign_keys=[batch_id])
    milestones = relationship("ProjectMilestone", back_populates="project", cascade="all, delete-orphan")
    trainer = relationship("User", foreign_keys=[trainer_id])


class ProjectMilestone(Base):
    __tablename__ = "project_milestones"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    project_id: Mapped[str] = mapped_column(String, ForeignKey("projects.id"))
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    due_date: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    is_completed: Mapped[bool] = mapped_column(Boolean, default=False)
    order: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

    project = relationship("Project", back_populates="milestones")


class Task(Base):
    __tablename__ = "tasks"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    batch_id: Mapped[str | None] = mapped_column(String, ForeignKey("batches.id"), nullable=True)
    student_id: Mapped[str | None] = mapped_column(String, ForeignKey("users.id"), nullable=True)
    assigned_by: Mapped[str | None] = mapped_column(String, ForeignKey("users.id"), nullable=True)
    priority: Mapped[TaskPriority] = mapped_column(Enum(TaskPriority), default=TaskPriority.MEDIUM)
    status: Mapped[TaskStatus] = mapped_column(Enum(TaskStatus), default=TaskStatus.PENDING)
    due_date: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    pdf_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    
    # New Assessment Fields
    time_limit: Mapped[int] = mapped_column(Integer, default=0) # 0 = no limit
    is_randomized: Mapped[bool] = mapped_column(Boolean, default=False)
    structured_content: Mapped[str | None] = mapped_column(Text, nullable=True) # JSON question bank
    scheduled_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)


    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), onupdate=func.now())

    trainer = relationship("User", foreign_keys=[assigned_by])


class Assignment(Base):
    __tablename__ = "assignments"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    type: Mapped[AssignmentType] = mapped_column(Enum(AssignmentType), default=AssignmentType.CODING)
    batch_id: Mapped[str | None] = mapped_column(String, ForeignKey("batches.id"), nullable=True)
    course_id: Mapped[str | None] = mapped_column(String, ForeignKey("courses.id"), nullable=True)
    student_id: Mapped[str | None] = mapped_column(String, ForeignKey("users.id"), nullable=True)
    assigned_by: Mapped[str | None] = mapped_column(String, ForeignKey("users.id"), nullable=True)
    total_marks: Mapped[int] = mapped_column(Integer, default=100)
    due_date: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    
    # New Assessment Fields
    time_limit: Mapped[int] = mapped_column(Integer, default=0)
    is_randomized: Mapped[bool] = mapped_column(Boolean, default=False)
    structured_content: Mapped[str | None] = mapped_column(Text, nullable=True)
    scheduled_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)


    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), onupdate=func.now())

    batch = relationship("Batch", foreign_keys=[batch_id])
    submissions = relationship("AssignmentSubmission", back_populates="assignment", cascade="all, delete-orphan")
    trainer = relationship("User", foreign_keys=[assigned_by])


class AssignmentSubmission(Base):
    __tablename__ = "assignment_submissions"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    assignment_id: Mapped[str] = mapped_column(String, ForeignKey("assignments.id"))
    student_id: Mapped[str] = mapped_column(String, ForeignKey("users.id"))
    content: Mapped[str | None] = mapped_column(Text, nullable=True)
    file_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    marks: Mapped[int | None] = mapped_column(Integer, nullable=True)
    feedback: Mapped[str | None] = mapped_column(Text, nullable=True)
    submitted_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    graded_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)

    assignment = relationship("Assignment", back_populates="submissions")
    student = relationship("User", foreign_keys=[student_id])


class Violation(Base):
    __tablename__ = "violations"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    student_id: Mapped[str] = mapped_column(String, ForeignKey("users.id"))
    type: Mapped[ViolationType] = mapped_column(Enum(ViolationType))
    severity: Mapped[ViolationSeverity] = mapped_column(Enum(ViolationSeverity), default=ViolationSeverity.MEDIUM)
    status: Mapped[ViolationStatus] = mapped_column(Enum(ViolationStatus), default=ViolationStatus.OPEN)
    title: Mapped[str] = mapped_column(String(300), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    # Link to the source (project, task, assignment, etc.)
    reference_type: Mapped[str | None] = mapped_column(String(50), nullable=True)  # "PROJECT", "TASK", "ASSIGNMENT"
    reference_id: Mapped[str | None] = mapped_column(String, nullable=True)
    # Resolution
    resolved_by_id: Mapped[str | None] = mapped_column(String, ForeignKey("users.id"), nullable=True)
    resolution_note: Mapped[str | None] = mapped_column(Text, nullable=True)
    resolved_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    # Penalties
    penalty_points: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

    student = relationship("User", foreign_keys=[student_id], backref="violations")
    resolved_by = relationship("User", foreign_keys=[resolved_by_id])


class AssessmentSession(Base):
    __tablename__ = "assessment_sessions"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    student_id: Mapped[str] = mapped_column(String, ForeignKey("users.id"))
    reference_id: Mapped[str] = mapped_column(String, nullable=False) # Task/Assignment ID
    reference_type: Mapped[str] = mapped_column(String(50), nullable=False) # "TASK" | "ASSIGNMENT"
    
    start_time: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    end_time: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    responses: Mapped[str | None] = mapped_column(Text, nullable=True) # JSON student answers
    
    tab_switch_count: Mapped[int] = mapped_column(Integer, default=0)
    fullscreen_exit_count: Mapped[int] = mapped_column(Integer, default=0)
    face_violation_count: Mapped[int] = mapped_column(Integer, default=0)
    mic_violation_count: Mapped[int] = mapped_column(Integer, default=0)
    
    score: Mapped[float] = mapped_column(Float, default=0.0)
    completion_time_seconds: Mapped[int] = mapped_column(Integer, default=0)
    auto_submitted: Mapped[bool] = mapped_column(Boolean, default=False)
    is_completed: Mapped[bool] = mapped_column(Boolean, default=False)

    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), onupdate=func.now())
