import uuid
from datetime import datetime

from sqlalchemy import String, Boolean, DateTime, ForeignKey, func, Integer, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class Session(Base):
    __tablename__ = "sessions"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    title: Mapped[str] = mapped_column(String)
    description: Mapped[str | None] = mapped_column(String, nullable=True)
    batch_id: Mapped[str] = mapped_column(String, ForeignKey("batches.id"))
    trainer_id: Mapped[str] = mapped_column(String, ForeignKey("users.id"))
    
    start_time: Mapped[datetime] = mapped_column(DateTime)
    end_time: Mapped[datetime] = mapped_column(DateTime)
    
    status: Mapped[str] = mapped_column(String, default="SCHEDULED")  # SCHEDULED, ONGOING, COMPLETED, CANCELLED
    meeting_link: Mapped[str | None] = mapped_column(String, nullable=True)
    resources_url: Mapped[str | None] = mapped_column(String, nullable=True)

    # Selective attendance: if True, only students in SessionAttendee can see this session
    selective_attendance: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False, server_default="false")
    
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), onupdate=func.now())

    # Relationships
    batch = relationship("Batch", primaryjoin="Session.batch_id == Batch.id")
    trainer = relationship("User", primaryjoin="Session.trainer_id == User.id")
    attendees = relationship("SessionAttendee", back_populates="session", cascade="all, delete-orphan")


class SessionAttendee(Base):
    """Join table: links specific students to a session when selective_attendance is True."""
    __tablename__ = "session_attendees"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    session_id: Mapped[str] = mapped_column(String, ForeignKey("sessions.id", ondelete="CASCADE"))
    student_id: Mapped[str] = mapped_column(String, ForeignKey("users.id", ondelete="CASCADE"))

    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

    # Relationships
    session = relationship("Session", back_populates="attendees")
    student = relationship("User", primaryjoin="SessionAttendee.student_id == User.id")


class StudentFeedback(Base):
    __tablename__ = "student_feedback"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    target_type: Mapped[str] = mapped_column(String)  # SESSION, TRAINER, COURSE
    target_id: Mapped[str] = mapped_column(String)    # UUID of the target
    submitted_by: Mapped[str] = mapped_column(String, ForeignKey("users.id"))
    
    rating: Mapped[int] = mapped_column(Integer)
    comments: Mapped[str | None] = mapped_column(Text, nullable=True)
    is_anonymous: Mapped[bool] = mapped_column(Boolean, default=False)
    
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

    # Relationships
    student = relationship("User", primaryjoin="StudentFeedback.submitted_by == User.id")
