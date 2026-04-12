import uuid
from datetime import datetime

from sqlalchemy import String, Boolean, Float, DateTime, ForeignKey, func, Integer
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class Course(Base):
    __tablename__ = "courses"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    name: Mapped[str] = mapped_column(String)
    description: Mapped[str | None] = mapped_column(String, nullable=True)
    duration: Mapped[str | None] = mapped_column(String, nullable=True)
    fee: Mapped[float] = mapped_column(Float, default=0)
    materials: Mapped[str | None] = mapped_column(String, nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), onupdate=func.now())

    batches = relationship("Batch", back_populates="course")
    registrations = relationship("Registration", back_populates="course")
    assessments = relationship("Assessment", back_populates="course")


class Batch(Base):
    __tablename__ = "batches"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    course_id: Mapped[str | None] = mapped_column(String, ForeignKey("courses.id"), nullable=True)
    name: Mapped[str] = mapped_column(String)
    start_date: Mapped[datetime] = mapped_column(DateTime)
    end_date: Mapped[datetime] = mapped_column(DateTime)
    schedule_time: Mapped[str | None] = mapped_column(String, nullable=True)
    schedule_link: Mapped[str | None] = mapped_column(String, nullable=True)
    trainer_id: Mapped[str | None] = mapped_column(String, ForeignKey("users.id"), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), onupdate=func.now())

    course = relationship("Course", back_populates="batches")
    trainer = relationship("User", back_populates="trainer_batches", foreign_keys=[trainer_id])
    students = relationship("BatchStudent", back_populates="batch")
    attendance = relationship("Attendance", back_populates="batch")
    projects = relationship("Project", back_populates="batch")
    videos = relationship("Video", back_populates="batch")
    feedback = relationship("Feedback", back_populates="batch")
    registrations = relationship("Registration", back_populates="batch")
    leave_requests = relationship("LeaveRequest", back_populates="batch")


class BatchStudent(Base):
    __tablename__ = "batch_students"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    batch_id: Mapped[str] = mapped_column(String, ForeignKey("batches.id"))
    student_id: Mapped[str] = mapped_column(String, ForeignKey("users.id"))
    joined_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

    batch = relationship("Batch", back_populates="students")
    student = relationship("User", back_populates="batch_enrollments")
