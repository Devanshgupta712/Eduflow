"""
English Fluency Trainer — API Router
All endpoints for practice, conversation, roleplay, drills, streaks, leaderboard.
"""
import json
import os
import random
import uuid
from datetime import datetime, date

import httpx
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from typing import List, Optional
from sqlalchemy import select, func, desc
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.middleware.auth import get_current_user
from app.models.user import User
from app.models.english import (
    EnglishUserProgress, EnglishPracticeSession, EnglishConversation,
    EnglishRoleplay, EnglishBadge, EnglishChallenge, EnglishChallengeSubmission
)
from app.utils.english_prompts import (
    FLUENCY_EVALUATOR_PROMPT, CONVERSATION_PROMPTS, DRILL_PROMPTS,
    READ_ALOUD_PASSAGES, TONGUE_TWISTERS, ONE_MINUTE_TOPICS,
    STORY_STARTERS, OPINION_TOPICS, ROLEPLAY_SCENARIOS,
    WORD_ASSOCIATION_WORDS, PICTURE_DESCRIPTIONS
)

router = APIRouter(prefix="/api/english", tags=["English Fluency"])

# ──── Pydantic Schemas ────
class EvaluateRequest(BaseModel):
    transcript: str
    exercise_type: str
    prompt_text: Optional[str] = ""
    duration_seconds: Optional[int] = 60
    hesitation_seconds: Optional[float] = 0.0
    total_session_seconds: Optional[int] = 0

class ConversationRequest(BaseModel):
    message: str
    mode: str = "CASUAL"
    history: Optional[List[dict]] = []
    scenario_context: Optional[str] = ""

class RoleplayStartRequest(BaseModel):
    scenario_index: Optional[int] = None

class RoleplayRespondRequest(BaseModel):
    roleplay_id: str
    message: str
    history: Optional[List[dict]] = []

class DrillSubmitRequest(BaseModel):
    drill_type: str
    prompt_text: str
    response_text: str
    duration_seconds: Optional[int] = 60
    hesitation_seconds: Optional[float] = 0.0
    total_session_seconds: Optional[int] = 0

class StreakCheckinRequest(BaseModel):
    practice_minutes: Optional[int] = 5
    xp_earned: Optional[int] = 10

class ChallengeSubmitRequest(BaseModel):
    challenge_id: str
    submission_text: str

class HesitationTrackRequest(BaseModel):
    hesitation_seconds: float

class SessionLogRequest(BaseModel):
    module_name: str
    duration_seconds: int


# ──── Helper: Call Groq API ────
async def call_groq(system_prompt: str, user_message: str, stream: bool = False):
    api_key = os.environ.get("GROQ_API_KEY")
    if not api_key:
        raise HTTPException(status_code=500, detail="GROQ_API_KEY not set")

    messages = [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": user_message}
    ]

    if stream:
        return _stream_groq(api_key, messages)

    async with httpx.AsyncClient(timeout=30.0) as client:
        resp = await client.post(
            "https://api.groq.com/openai/v1/chat/completions",
            headers={"Authorization": f"Bearer {api_key}"},
            json={"model": "llama-3.1-8b-instant", "messages": messages, "temperature": 0.7}
        )
        if resp.status_code != 200:
            raise HTTPException(status_code=502, detail=f"Groq API error: {resp.status_code}")
        data = resp.json()
        return data["choices"][0]["message"]["content"]


async def _stream_groq(api_key: str, messages: list):
    async def generate():
        async with httpx.AsyncClient(timeout=30.0) as client:
            try:
                async with client.stream(
                    "POST",
                    "https://api.groq.com/openai/v1/chat/completions",
                    headers={"Authorization": f"Bearer {api_key}"},
                    json={"model": "llama-3.1-8b-instant", "messages": messages, "temperature": 0.7, "stream": True}
                ) as resp:
                    if resp.status_code != 200:
                        yield f"Error: AI service returned {resp.status_code}"
                        return
                    async for line in resp.aiter_lines():
                        if line.startswith("data: "):
                            data = line[6:]
                            if data == "[DONE]":
                                break
                            try:
                                chunk = json.loads(data)
                                content = chunk["choices"][0]["delta"].get("content", "")
                                if content:
                                    yield content
                            except:
                                continue
            except Exception as e:
                yield f"Connection Error: {str(e)}"
    return StreamingResponse(generate(), media_type="text/plain")


# ──── Helper: Get or create user progress ────
async def get_or_create_progress(user_id: str, db: AsyncSession) -> EnglishUserProgress:
    result = await db.execute(select(EnglishUserProgress).where(EnglishUserProgress.user_id == user_id))
    progress = result.scalars().first()
    if not progress:
        progress = EnglishUserProgress(id=str(uuid.uuid4()), user_id=user_id)
        db.add(progress)
        await db.flush()
    return progress


# ──── Helper: Calculate XP level ────
def calculate_level(xp: int) -> str:
    if xp >= 1500:
        return "FLUENT"
    elif xp >= 500:
        return "CONFIDENT"
    elif xp >= 100:
        return "CONVERSATIONAL"
    return "BEGINNER"


# ──── Helper: Check & award badges ────
async def check_badges(user_id: str, progress: EnglishUserProgress, db: AsyncSession):
    result = await db.execute(select(EnglishBadge.badge_name).where(EnglishBadge.user_id == user_id))
    existing = set(result.scalars().all())

    new_badges = []
    badge_checks = [
        ("First Steps", "🎯", progress.total_sessions >= 1),
        ("7-Day Streak", "🔥", progress.current_streak >= 7),
        ("14-Day Streak", "💪", progress.current_streak >= 14),
        ("30-Day Streak", "🏆", progress.current_streak >= 30),
        ("Speed Talker", "⚡", progress.avg_wpm >= 120),
        ("Zero Fillers", "🎯", progress.avg_filler_count <= 1 and progress.total_sessions >= 5),
        ("Grammar Pro", "📝", progress.avg_grammar_accuracy >= 90 and progress.total_sessions >= 5),
        ("Word Master", "📚", progress.avg_vocabulary_score >= 8 and progress.total_sessions >= 5),
        ("Conversational", "🗣️", progress.xp_total >= 100),
        ("Confident Speaker", "💎", progress.xp_total >= 500),
        ("Fluent", "👑", progress.xp_total >= 1500),
        ("Practice Machine", "🤖", progress.total_sessions >= 50),
        ("Century Club", "💯", progress.total_sessions >= 100),
    ]

    for name, icon, condition in badge_checks:
        if condition and name not in existing:
            badge = EnglishBadge(id=str(uuid.uuid4()), user_id=user_id, badge_name=name, badge_icon=icon)
            db.add(badge)
            new_badges.append({"name": name, "icon": icon})

    return new_badges


# ════════════════════════════════════════════
#  ENDPOINTS
# ════════════════════════════════════════════

# ──── 1. Dashboard / Progress ────
@router.get("/progress")
async def get_progress(user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    progress = await get_or_create_progress(user.id, db)

    # Recent sessions
    sessions_res = await db.execute(
        select(EnglishPracticeSession)
        .where(EnglishPracticeSession.user_id == user.id)
        .order_by(desc(EnglishPracticeSession.created_at))
        .limit(10)
    )
    recent = sessions_res.scalars().all()

    # Badges
    badges_res = await db.execute(select(EnglishBadge).where(EnglishBadge.user_id == user.id))
    badges = badges_res.scalars().all()

    return {
        "progress": {
            "total_practice_minutes": progress.total_practice_minutes,
            "current_streak": progress.current_streak,
            "longest_streak": progress.longest_streak,
            "last_practice_date": progress.last_practice_date,
            "xp_total": progress.xp_total,
            "level": progress.level,
            "avg_wpm": round(progress.avg_wpm, 1),
            "avg_filler_count": round(progress.avg_filler_count, 1),
            "avg_grammar_accuracy": round(progress.avg_grammar_accuracy, 1),
            "avg_vocabulary_score": round(progress.avg_vocabulary_score, 1),
            "confidence_score": round(progress.confidence_score, 1),
            "avg_hesitation_time": round(progress.avg_hesitation_time, 1),
            "total_sessions": progress.total_sessions,
        },
        "recent_sessions": [
            {
                "id": s.id,
                "exercise_type": s.exercise_type,
                "fluency_score": s.fluency_score,
                "wpm": s.wpm,
                "xp_earned": s.xp_earned,
                "created_at": s.created_at.isoformat() if s.created_at else None,
            }
            for s in recent
        ],
        "badges": [{"name": b.badge_name, "icon": b.badge_icon, "earned_at": b.earned_at.isoformat() if b.earned_at else None} for b in badges],
    }


# ──── 2. Get Practice Content ────
@router.get("/practice/content")
async def get_practice_content(exercise_type: str = "READ_ALOUD"):
    if exercise_type == "READ_ALOUD":
        return {"content": random.choice(READ_ALOUD_PASSAGES)}
    elif exercise_type == "TONGUE_TWISTER":
        return {"content": random.choice(TONGUE_TWISTERS)}
    elif exercise_type == "ONE_MINUTE_TALK":
        return {"content": {"topic": random.choice(ONE_MINUTE_TOPICS)}}
    elif exercise_type == "STORY_CONTINUATION":
        return {"content": {"starter": random.choice(STORY_STARTERS)}}
    elif exercise_type == "OPINION_BUILDER":
        return {"content": {"topic": random.choice(OPINION_TOPICS)}}
    elif exercise_type == "WORD_ASSOCIATION":
        return {"content": {"word": random.choice(WORD_ASSOCIATION_WORDS)}}
    elif exercise_type == "PICTURE_DESCRIPTION":
        return {"content": random.choice(PICTURE_DESCRIPTIONS)}
    elif exercise_type == "RAPID_FIRE":
        result = await call_groq(DRILL_PROMPTS["RAPID_FIRE"], "Generate 10 rapid fire questions for English fluency practice.")
        try:
            return {"content": json.loads(result)}
        except:
            return {"content": {"questions": ["What is your name?", "What did you eat today?", "Describe your room.", "What is your hobby?", "Do you prefer morning or night?", "What is your favorite movie?", "Where would you travel?", "What makes you happy?", "Describe your best friend.", "What is your dream job?"]}}
    return {"content": {}}


# ──── 3. Evaluate Practice ────
@router.post("/practice/evaluate")
async def evaluate_practice(body: EvaluateRequest, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    word_count = len(body.transcript.split())
    duration_min = max(body.duration_seconds / 60, 0.1)
    estimated_wpm = round(word_count / duration_min)

    user_msg = f"""Exercise: {body.exercise_type}
Prompt: {body.prompt_text}
Duration: {body.duration_seconds} seconds
Word count: {word_count}
Estimated WPM: {estimated_wpm}

Transcript:
\"{body.transcript}\""""

    ai_response = await call_groq(FLUENCY_EVALUATOR_PROMPT, user_msg)

    # Parse AI JSON
    try:
        feedback = json.loads(ai_response)
    except:
        # Try to extract JSON from response
        start = ai_response.find("{")
        end = ai_response.rfind("}") + 1
        try:
            feedback = json.loads(ai_response[start:end])
        except:
            feedback = {"fluency_score": 5, "wpm": estimated_wpm, "filler_count": 0, "grammar_accuracy": 70, "vocabulary_score": 5, "encouragement": "Keep practicing!", "specific_tip": "Try speaking more naturally."}

    fluency = feedback.get("fluency_score", 5)
    wpm = feedback.get("wpm", estimated_wpm)
    fillers = feedback.get("filler_count", 0)
    grammar = feedback.get("grammar_accuracy", 70) if "grammar_accuracy" in feedback else (len(feedback.get("grammar_errors", [])) == 0) * 100
    vocab = feedback.get("vocabulary_score", 5)
    confidence = feedback.get("confidence_score", 5)

    # XP based on exercise type
    xp_map = {"READ_ALOUD": 10, "ONE_MINUTE_TALK": 20, "TONGUE_TWISTER": 5, "SHADOWING": 15, "RAPID_FIRE": 15, "PICTURE_DESCRIPTION": 20, "STORY_CONTINUATION": 25, "OPINION_BUILDER": 20, "WORD_ASSOCIATION": 10}
    xp = xp_map.get(body.exercise_type, 10)
    if fluency >= 8:
        xp = int(xp * 1.5)

    final_duration = max(body.duration_seconds, body.total_session_seconds)
    
    # Save session
    session = EnglishPracticeSession(
        id=str(uuid.uuid4()), user_id=user.id, exercise_type=body.exercise_type,
        prompt_text=body.prompt_text, transcript=body.transcript,
        wpm=wpm, filler_count=fillers, grammar_accuracy=grammar,
        vocabulary_score=vocab, fluency_score=fluency,
        ai_feedback=json.dumps(feedback), duration_seconds=final_duration,
        hesitation_time_seconds=body.hesitation_seconds,
        xp_earned=xp
    )
    db.add(session)

    # Update progress
    progress = await get_or_create_progress(user.id, db)
    n = progress.total_sessions
    progress.avg_wpm = (progress.avg_wpm * n + wpm) / (n + 1)
    progress.avg_filler_count = (progress.avg_filler_count * n + fillers) / (n + 1)
    progress.avg_grammar_accuracy = (progress.avg_grammar_accuracy * n + grammar) / (n + 1)
    progress.avg_vocabulary_score = (progress.avg_vocabulary_score * n + vocab) / (n + 1)
    progress.confidence_score = (progress.confidence_score * n + confidence) / (n + 1)
    progress.avg_hesitation_time = (progress.avg_hesitation_time * n + body.hesitation_seconds) / (n + 1)
    progress.total_sessions += 1
    progress.total_practice_minutes += max(final_duration // 60, 1)
    progress.xp_total += xp
    progress.level = calculate_level(progress.xp_total)

    # Streak
    today = date.today().isoformat()
    if progress.last_practice_date != today:
        yesterday = date.today().replace(day=date.today().day - 1).isoformat() if date.today().day > 1 else ""
        if progress.last_practice_date == yesterday:
            progress.current_streak += 1
        else:
            progress.current_streak = 1
        progress.last_practice_date = today
        if progress.current_streak > progress.longest_streak:
            progress.longest_streak = progress.current_streak

    new_badges = await check_badges(user.id, progress, db)

    return {
        "feedback": feedback,
        "xp_earned": xp,
        "total_xp": progress.xp_total,
        "level": progress.level,
        "streak": progress.current_streak,
        "new_badges": new_badges,
    }


# ──── 4. AI Conversation Partner (Streaming) ────
@router.post("/conversation/chat")
async def conversation_chat(body: ConversationRequest, user: User = Depends(get_current_user)):
    api_key = os.environ.get("GROQ_API_KEY")
    if not api_key:
        return StreamingResponse(iter(["Error: GROQ_API_KEY not set"]), media_type="text/plain")

    mode = body.mode.upper()
    system_prompt = CONVERSATION_PROMPTS.get(mode, CONVERSATION_PROMPTS["CASUAL"])

    if body.scenario_context:
        system_prompt += f"\n\nCurrent scenario context: {body.scenario_context}"

    messages = [{"role": "system", "content": system_prompt}]
    if body.history:
        for msg in body.history[-10:]:
            messages.append({"role": msg.get("role", "user"), "content": msg.get("content", "")})
    messages.append({"role": "user", "content": body.message})

    async def generate():
        async with httpx.AsyncClient(timeout=30.0) as client:
            try:
                async with client.stream(
                    "POST", "https://api.groq.com/openai/v1/chat/completions",
                    headers={"Authorization": f"Bearer {api_key}"},
                    json={"model": "llama-3.1-8b-instant", "messages": messages, "temperature": 0.7, "stream": True}
                ) as resp:
                    if resp.status_code != 200:
                        yield f"Error: AI service returned {resp.status_code}"
                        return
                    async for line in resp.aiter_lines():
                        if line.startswith("data: "):
                            data = line[6:]
                            if data == "[DONE]":
                                break
                            try:
                                chunk = json.loads(data)
                                content = chunk["choices"][0]["delta"].get("content", "")
                                if content:
                                    yield content
                            except:
                                continue
            except Exception as e:
                yield f"Error: {str(e)}"

    return StreamingResponse(generate(), media_type="text/plain")


# ──── 5. Roleplay ────
@router.get("/roleplay/scenarios")
async def get_scenarios():
    return {"scenarios": ROLEPLAY_SCENARIOS}


@router.post("/roleplay/chat")
async def roleplay_chat(body: ConversationRequest, user: User = Depends(get_current_user)):
    api_key = os.environ.get("GROQ_API_KEY")
    if not api_key:
        return StreamingResponse(iter(["Error: GROQ_API_KEY not set"]), media_type="text/plain")

    system_prompt = f"""You are doing a roleplay exercise for English fluency practice.
{body.scenario_context}

RULES:
1. Stay in character throughout.
2. Keep responses to 2-3 sentences.
3. If the user makes grammar mistakes, subtly model the correct form in your response.
4. After 5 exchanges, provide a brief performance summary with scores."""

    messages = [{"role": "system", "content": system_prompt}]
    if body.history:
        for msg in body.history[-10:]:
            messages.append({"role": msg.get("role", "user"), "content": msg.get("content", "")})
    messages.append({"role": "user", "content": body.message})

    async def generate():
        async with httpx.AsyncClient(timeout=30.0) as client:
            try:
                async with client.stream(
                    "POST", "https://api.groq.com/openai/v1/chat/completions",
                    headers={"Authorization": f"Bearer {api_key}"},
                    json={"model": "llama-3.1-8b-instant", "messages": messages, "temperature": 0.7, "stream": True}
                ) as resp:
                    if resp.status_code != 200:
                        yield f"Error: {resp.status_code}"
                        return
                    async for line in resp.aiter_lines():
                        if line.startswith("data: "):
                            data = line[6:]
                            if data == "[DONE]":
                                break
                            try:
                                chunk = json.loads(data)
                                content = chunk["choices"][0]["delta"].get("content", "")
                                if content:
                                    yield content
                            except:
                                continue
            except Exception as e:
                yield f"Error: {str(e)}"

    return StreamingResponse(generate(), media_type="text/plain")


# ──── 6. Drills ────
@router.get("/drills/random")
async def get_random_drill(drill_type: str = ""):
    types = ["PICTURE_DESCRIPTION", "STORY_CONTINUATION", "OPINION_BUILDER", "WORD_ASSOCIATION", "RAPID_FIRE"]
    if not drill_type or drill_type not in types:
        drill_type = random.choice(types)

    if drill_type == "PICTURE_DESCRIPTION":
        return {"drill_type": drill_type, "content": random.choice(PICTURE_DESCRIPTIONS)}
    elif drill_type == "STORY_CONTINUATION":
        return {"drill_type": drill_type, "content": {"starter": random.choice(STORY_STARTERS)}}
    elif drill_type == "OPINION_BUILDER":
        return {"drill_type": drill_type, "content": {"topic": random.choice(OPINION_TOPICS)}}
    elif drill_type == "WORD_ASSOCIATION":
        return {"drill_type": drill_type, "content": {"word": random.choice(WORD_ASSOCIATION_WORDS)}}
    else:
        return {"drill_type": drill_type, "content": {"questions": random.sample(ONE_MINUTE_TOPICS, min(5, len(ONE_MINUTE_TOPICS)))}}


@router.post("/drills/evaluate")
async def evaluate_drill(body: DrillSubmitRequest, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    prompt_key = body.drill_type.upper()
    system_prompt = DRILL_PROMPTS.get(prompt_key, DRILL_PROMPTS.get("OPINION_BUILDER"))

    user_msg = f"Prompt: {body.prompt_text}\n\nUser's response:\n\"{body.response_text}\"\n\nDuration: {body.duration_seconds} seconds"
    ai_response = await call_groq(system_prompt, user_msg)

    try:
        feedback = json.loads(ai_response)
    except:
        start = ai_response.find("{")
        end = ai_response.rfind("}") + 1
        try:
            feedback = json.loads(ai_response[start:end])
        except:
            feedback = {"overall_score": 5, "confidence_score": 5, "tip": "Keep practicing!"}

    score = feedback.get("overall_score", 5)
    confidence = feedback.get("confidence_score", 5)
    xp = int(score * 3)

    final_duration = max(body.duration_seconds, body.total_session_seconds)
    
    session = EnglishPracticeSession(
        id=str(uuid.uuid4()), user_id=user.id, exercise_type=body.drill_type,
        prompt_text=body.prompt_text, transcript=body.response_text,
        fluency_score=score, ai_feedback=json.dumps(feedback),
        duration_seconds=final_duration, hesitation_time_seconds=body.hesitation_seconds, xp_earned=xp
    )
    db.add(session)

    progress = await get_or_create_progress(user.id, db)
    n = progress.total_sessions
    progress.confidence_score = (progress.confidence_score * n + confidence) / (n + 1)
    progress.avg_hesitation_time = (progress.avg_hesitation_time * n + body.hesitation_seconds) / (n + 1)
    progress.xp_total += xp
    progress.total_sessions += 1
    progress.total_practice_minutes += max(final_duration // 60, 1)
    progress.level = calculate_level(progress.xp_total)

    today = date.today().isoformat()
    if progress.last_practice_date != today:
        from datetime import timedelta
        yesterday = (date.today() - timedelta(days=1)).isoformat()
        if progress.last_practice_date == yesterday:
            progress.current_streak += 1
        else:
            progress.current_streak = 1
        progress.last_practice_date = today
        if progress.current_streak > progress.longest_streak:
            progress.longest_streak = progress.current_streak

    new_badges = await check_badges(user.id, progress, db)

    return {"feedback": feedback, "xp_earned": xp, "total_xp": progress.xp_total, "level": progress.level, "streak": progress.current_streak, "new_badges": new_badges}


# ──── 7. Streak Check-in ────
@router.post("/streak/checkin")
async def streak_checkin(body: StreakCheckinRequest, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    progress = await get_or_create_progress(user.id, db)
    today = date.today().isoformat()

    if progress.last_practice_date != today:
        from datetime import timedelta
        yesterday = (date.today() - timedelta(days=1)).isoformat()
        if progress.last_practice_date == yesterday:
            progress.current_streak += 1
        else:
            progress.current_streak = 1
        progress.last_practice_date = today
        if progress.current_streak > progress.longest_streak:
            progress.longest_streak = progress.current_streak

    progress.total_practice_minutes += body.practice_minutes
    progress.xp_total += body.xp_earned
    progress.level = calculate_level(progress.xp_total)

    return {"streak": progress.current_streak, "longest_streak": progress.longest_streak, "xp_total": progress.xp_total, "level": progress.level}


# ──── 8. Leaderboard ────
@router.get("/leaderboard")
async def get_leaderboard(db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(EnglishUserProgress, User.name)
        .join(User, User.id == EnglishUserProgress.user_id)
        .order_by(desc(EnglishUserProgress.xp_total))
        .limit(20)
    )
    rows = result.all()

    return {"leaderboard": [
        {
            "rank": i + 1,
            "name": name,
            "xp": p.xp_total,
            "level": p.level,
            "streak": p.current_streak,
            "sessions": p.total_sessions,
        }
        for i, (p, name) in enumerate(rows)
    ]}


# ──── 9. Badges ────
@router.get("/badges")
async def get_badges(user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(EnglishBadge).where(EnglishBadge.user_id == user.id).order_by(desc(EnglishBadge.earned_at)))
    badges = result.scalars().all()
    return {"badges": [{"name": b.badge_name, "icon": b.badge_icon, "earned_at": b.earned_at.isoformat() if b.earned_at else None} for b in badges]}


# ──── 10. Challenges ────
@router.get("/challenges")
async def get_challenges(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(EnglishChallenge).where(EnglishChallenge.is_active == True).order_by(desc(EnglishChallenge.created_at)))
    challenges = result.scalars().all()
    return {"challenges": [{"id": c.id, "title": c.title, "description": c.description, "type": c.challenge_type, "week_start": c.week_start, "week_end": c.week_end} for c in challenges]}


# ──── 11. Session History ────
@router.get("/history")
async def get_history(limit: int = 20, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(EnglishPracticeSession)
        .where(EnglishPracticeSession.user_id == user.id)
        .order_by(desc(EnglishPracticeSession.created_at))
        .limit(limit)
    )
    sessions = result.scalars().all()
    return {"sessions": [
        {
            "id": s.id, "exercise_type": s.exercise_type, "prompt_text": s.prompt_text,
            "fluency_score": s.fluency_score, "wpm": s.wpm, "filler_count": s.filler_count,
            "grammar_accuracy": s.grammar_accuracy, "vocabulary_score": s.vocabulary_score,
            "xp_earned": s.xp_earned, "duration_seconds": s.duration_seconds,
            "created_at": s.created_at.isoformat() if s.created_at else None,
        }
        for s in sessions
    ]}

# ──── 12. Hesitation Tracking (for Live Call/Conversation) ────
@router.post("/track_hesitation")
async def track_hesitation(body: HesitationTrackRequest, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    progress = await get_or_create_progress(user.id, db)
    n = progress.total_sessions
    # Treat each tracked hesitation as a mini-session for averaging
    progress.avg_hesitation_time = (progress.avg_hesitation_time * n + body.hesitation_seconds) / (n + 1)
    progress.total_sessions += 1
    return {"status": "success", "avg_hesitation_time": progress.avg_hesitation_time}

# ──── 12.5. Log Non-Evaluated Session Time ────
@router.post("/session/log")
async def log_session_time(body: SessionLogRequest, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    progress = await get_or_create_progress(user.id, db)
    minutes = max(body.duration_seconds // 60, 1)
    
    # We create a dummy session just to track the time cleanly in history
    session = EnglishPracticeSession(
        id=str(uuid.uuid4()), user_id=user.id, exercise_type=body.module_name.upper(),
        duration_seconds=body.duration_seconds, xp_earned=0,
        fluency_score=progress.confidence_score # Just dummy value
    )
    db.add(session)
    
    progress.total_practice_minutes += minutes
    progress.total_sessions += 1
    return {"status": "logged", "total_minutes": progress.total_practice_minutes}

# ──── 13. Admin Reports ────
@router.get("/admin/reports")
async def get_admin_reports(batch_id: Optional[str] = None, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    if user.role not in ["ADMIN", "SUPER_ADMIN", "TRAINER"]:
        raise HTTPException(status_code=403, detail="Not authorized")

    from app.models.batch import BatchStudent

    query = select(EnglishUserProgress, User.name, User.email).join(User, User.id == EnglishUserProgress.user_id)
    
    if batch_id:
        query = query.join(BatchStudent, BatchStudent.student_id == User.id).where(BatchStudent.batch_id == batch_id)
        
    query = query.order_by(desc(EnglishUserProgress.xp_total))
    result = await db.execute(query)
    rows = result.all()

    return {"reports": [
        {
            "user_id": p.user_id,
            "name": name,
            "email": email,
            "total_practice_minutes": p.total_practice_minutes,
            "xp_total": p.xp_total,
            "level": p.level,
            "confidence_score": round(p.confidence_score, 1),
            "avg_hesitation_time": round(p.avg_hesitation_time, 1),
            "total_sessions": p.total_sessions,
            "last_practice_date": p.last_practice_date
        }
        for (p, name, email) in rows
    ]}

# ──── 13.5. Admin Student Breakdown ────
@router.get("/admin/reports/{student_id}")
async def get_student_english_breakdown(student_id: str, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    if user.role not in ["ADMIN", "SUPER_ADMIN", "TRAINER"]:
        raise HTTPException(status_code=403, detail="Not authorized")

    # Get user basics
    user_res = await db.execute(select(User).where(User.id == student_id))
    student = user_res.scalars().first()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")

    progress = await get_or_create_progress(student_id, db)
    
    # Calculate time spent per module
    mod_res = await db.execute(
        select(EnglishPracticeSession.exercise_type, func.sum(EnglishPracticeSession.duration_seconds))
        .where(EnglishPracticeSession.user_id == student_id)
        .group_by(EnglishPracticeSession.exercise_type)
    )
    module_breakdown = {row[0]: round(row[1] / 60, 1) for row in mod_res.all()}
    
    # Get recent 5 sessions
    ses_res = await db.execute(
        select(EnglishPracticeSession)
        .where(EnglishPracticeSession.user_id == student_id)
        .order_by(desc(EnglishPracticeSession.created_at))
        .limit(5)
    )
    recent = ses_res.scalars().all()

    return {
        "student": {"name": student.name, "email": student.email},
        "progress": {
            "level": progress.level,
            "xp_total": progress.xp_total,
            "confidence_score": round(progress.confidence_score, 1),
            "avg_hesitation_time": round(progress.avg_hesitation_time, 1),
            "total_sessions": progress.total_sessions,
            "total_practice_minutes": progress.total_practice_minutes,
            "streak": progress.current_streak
        },
        "module_breakdown": module_breakdown,
        "recent_sessions": [
            {
                "type": s.exercise_type,
                "date": s.created_at.isoformat() if s.created_at else None,
                "score": s.fluency_score,
                "duration_min": round(s.duration_seconds / 60, 1)
            } for s in recent
        ]
    }

# ──── 14. Weekly Progress ────
@router.get("/progress/weekly")
async def get_weekly_progress(user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    from datetime import datetime, timedelta
    
    end_date = datetime.utcnow()
    start_date = end_date - timedelta(days=7)
    
    result = await db.execute(
        select(
            func.date(EnglishPracticeSession.created_at).label("practice_date"),
            func.sum(EnglishPracticeSession.duration_seconds).label("total_seconds"),
            func.sum(EnglishPracticeSession.xp_earned).label("total_xp")
        )
        .where(EnglishPracticeSession.user_id == user.id)
        .where(EnglishPracticeSession.created_at >= start_date)
        .group_by(func.date(EnglishPracticeSession.created_at))
    )
    
    rows = result.all()
    weekly_data = []
    
    # Fill missing days
    for i in range(6, -1, -1):
        d = (end_date - timedelta(days=i)).strftime("%Y-%m-%d")
        found = next((r for r in rows if str(r.practice_date) == d), None)
        if found:
            weekly_data.append({"date": d, "minutes": round(found.total_seconds / 60, 1), "xp": found.total_xp})
        else:
            weekly_data.append({"date": d, "minutes": 0, "xp": 0})
            
    return {"weekly_data": weekly_data}
