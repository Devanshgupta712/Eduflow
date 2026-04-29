"""
English Fluency Trainer — Database Models
Tracks practice sessions, conversations, streaks, badges and challenges.
"""
import enum
import uuid
from datetime import datetime

from sqlalchemy import String, Boolean, DateTime, Integer, Float, Text, Enum, func, ForeignKey, JSON
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class ExerciseType(str, enum.Enum):
    READ_ALOUD = "READ_ALOUD"
    ONE_MINUTE_TALK = "ONE_MINUTE_TALK"
    SHADOWING = "SHADOWING"
    TONGUE_TWISTER = "TONGUE_TWISTER"
    RAPID_FIRE = "RAPID_FIRE"
    PICTURE_DESCRIPTION = "PICTURE_DESCRIPTION"
    STORY_CONTINUATION = "STORY_CONTINUATION"
    OPINION_BUILDER = "OPINION_BUILDER"
    WORD_ASSOCIATION = "WORD_ASSOCIATION"


class ConversationMode(str, enum.Enum):
    CASUAL = "CASUAL"
    INTERVIEW = "INTERVIEW"
    DEBATE = "DEBATE"
    STORY = "STORY"
    SITUATION = "SITUATION"


class FluencyLevel(str, enum.Enum):
    BEGINNER = "BEGINNER"
    CONVERSATIONAL = "CONVERSATIONAL"
    CONFIDENT = "CONFIDENT"
    FLUENT = "FLUENT"


# ──── Core Progress Tracking ────
class EnglishUserProgress(Base):
    __tablename__ = "english_user_progress"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id: Mapped[str] = mapped_column(String, ForeignKey("users.id"), unique=True)
    total_practice_minutes: Mapped[int] = mapped_column(Integer, default=0)
    current_streak: Mapped[int] = mapped_column(Integer, default=0)
    longest_streak: Mapped[int] = mapped_column(Integer, default=0)
    last_practice_date: Mapped[str | None] = mapped_column(String, nullable=True)
    xp_total: Mapped[int] = mapped_column(Integer, default=0)
    level: Mapped[str] = mapped_column(String, default="BEGINNER")
    avg_wpm: Mapped[float] = mapped_column(Float, default=0.0)
    avg_filler_count: Mapped[float] = mapped_column(Float, default=0.0)
    avg_grammar_accuracy: Mapped[float] = mapped_column(Float, default=0.0)
    avg_vocabulary_score: Mapped[float] = mapped_column(Float, default=0.0)
    confidence_score: Mapped[float] = mapped_column(Float, default=0.0)
    avg_hesitation_time: Mapped[float] = mapped_column(Float, default=0.0)
    total_sessions: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), onupdate=func.now())

    user = relationship("User", backref="english_progress")


# ──── Individual Practice Sessions ────
class EnglishPracticeSession(Base):
    __tablename__ = "english_practice_sessions"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id: Mapped[str] = mapped_column(String, ForeignKey("users.id"))
    exercise_type: Mapped[str] = mapped_column(String)
    prompt_text: Mapped[str | None] = mapped_column(Text, nullable=True)
    transcript: Mapped[str | None] = mapped_column(Text, nullable=True)
    wpm: Mapped[float] = mapped_column(Float, default=0.0)
    filler_count: Mapped[int] = mapped_column(Integer, default=0)
    grammar_accuracy: Mapped[float] = mapped_column(Float, default=0.0)
    vocabulary_score: Mapped[float] = mapped_column(Float, default=0.0)
    fluency_score: Mapped[float] = mapped_column(Float, default=0.0)
    ai_feedback: Mapped[str | None] = mapped_column(Text, nullable=True)
    duration_seconds: Mapped[int] = mapped_column(Integer, default=0)
    hesitation_time_seconds: Mapped[float] = mapped_column(Float, default=0.0)
    xp_earned: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

    user = relationship("User", backref="english_sessions")


# ──── AI Conversation Logs ────
class EnglishConversation(Base):
    __tablename__ = "english_conversations"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id: Mapped[str] = mapped_column(String, ForeignKey("users.id"))
    mode: Mapped[str] = mapped_column(String, default="CASUAL")
    messages: Mapped[str | None] = mapped_column(Text, nullable=True)  # JSON string
    fluency_score: Mapped[float] = mapped_column(Float, default=0.0)
    grammar_score: Mapped[float] = mapped_column(Float, default=0.0)
    vocabulary_score: Mapped[float] = mapped_column(Float, default=0.0)
    ai_summary: Mapped[str | None] = mapped_column(Text, nullable=True)
    duration_seconds: Mapped[int] = mapped_column(Integer, default=0)
    hesitation_time_seconds: Mapped[float] = mapped_column(Float, default=0.0)
    xp_earned: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

    user = relationship("User", backref="english_conversations")


# ──── Roleplay Sessions ────
class EnglishRoleplay(Base):
    __tablename__ = "english_roleplays"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id: Mapped[str] = mapped_column(String, ForeignKey("users.id"))
    scenario_category: Mapped[str] = mapped_column(String)
    scenario_title: Mapped[str] = mapped_column(String)
    scenario_description: Mapped[str | None] = mapped_column(Text, nullable=True)
    dialogue: Mapped[str | None] = mapped_column(Text, nullable=True)  # JSON string
    scores: Mapped[str | None] = mapped_column(Text, nullable=True)  # JSON string
    hesitation_time_seconds: Mapped[float] = mapped_column(Float, default=0.0)
    xp_earned: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

    user = relationship("User", backref="english_roleplays")


# ──── Badges / Gamification ────
class EnglishBadge(Base):
    __tablename__ = "english_badges"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id: Mapped[str] = mapped_column(String, ForeignKey("users.id"))
    badge_name: Mapped[str] = mapped_column(String)
    badge_icon: Mapped[str] = mapped_column(String, default="🏅")
    earned_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

    user = relationship("User", backref="english_badges")


# ──── Weekly Challenges ────
class EnglishChallenge(Base):
    __tablename__ = "english_challenges"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    title: Mapped[str] = mapped_column(String)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    challenge_type: Mapped[str] = mapped_column(String, default="SPEECH")
    week_start: Mapped[str] = mapped_column(String)
    week_end: Mapped[str] = mapped_column(String)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())


class EnglishChallengeSubmission(Base):
    __tablename__ = "english_challenge_submissions"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    challenge_id: Mapped[str] = mapped_column(String, ForeignKey("english_challenges.id"))
    user_id: Mapped[str] = mapped_column(String, ForeignKey("users.id"))
    submission_text: Mapped[str | None] = mapped_column(Text, nullable=True)
    score: Mapped[float] = mapped_column(Float, default=0.0)
    xp_earned: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

    user = relationship("User", backref="english_challenge_submissions")
    challenge = relationship("EnglishChallenge", backref="submissions")
