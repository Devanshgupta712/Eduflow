import uuid
from datetime import datetime

from sqlalchemy import String, Boolean, DateTime, ForeignKey, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class Resume(Base):
    __tablename__ = "resumes"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    student_id: Mapped[str] = mapped_column(String, ForeignKey("users.id"))
    
    # Metadata
    title: Mapped[str] = mapped_column(String)  # e.g. "Software Engineer Resume"
    mode: Mapped[str] = mapped_column(String, default="visual")  # "visual", "enhanced", "ai_generated"
    template: Mapped[str] = mapped_column(String, default="modern")  # "modern", "classic", "minimal", "tech"
    is_primary: Mapped[bool] = mapped_column(Boolean, default=False)
    
    # Store sections as serialized JSON strings for flexibility
    personal: Mapped[str] = mapped_column(Text, default="{}")
    summary: Mapped[str] = mapped_column(Text, default="")
    skills: Mapped[str] = mapped_column(Text, default="[]")
    experience: Mapped[str] = mapped_column(Text, default="[]")
    education: Mapped[str] = mapped_column(Text, default="[]")
    projects: Mapped[str] = mapped_column(Text, default="[]")
    certifications: Mapped[str] = mapped_column(Text, default="[]")
    languages: Mapped[str] = mapped_column(Text, default="[]")
    layout_metadata: Mapped[str] = mapped_column(Text, default="{}")
    
    # Context used for AI generation (Mode 2 & 3)
    original_resume_text: Mapped[str | None] = mapped_column(Text, nullable=True)
    job_description: Mapped[str | None] = mapped_column(Text, nullable=True)
    
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), onupdate=func.now())

    student = relationship("User", backref="resumes")

