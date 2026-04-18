from contextlib import asynccontextmanager
import os

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware


from app.config import settings
from app.database import engine, Base, AsyncSessionLocal

# Import all models so tables can be created
from app.models import *  # noqa: F401, F403

from app.routers import auth, admin, marketing, training, placement, ai
from app.ws.socket_manager import sio_app
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from app.tasks.feedback_cron import check_missed_feedback

# Initialize Scheduler
scheduler = AsyncIOScheduler()
# Run every Saturday at 23:59
scheduler.add_job(check_missed_feedback, 'cron', day_of_week='sat', hour=23, minute=59)

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: verify DB connection (tables already exist in production)
    print("Starting up LMS API...")
    try:
        from sqlalchemy import text
        is_sqlite = "sqlite" in str(engine.url)

        if is_sqlite:
            # For local SQLite development: create tables and run migrations
            async with engine.begin() as conn:
                await conn.run_sync(Base.metadata.create_all)

                result = await conn.execute(text("PRAGMA table_info(users)"))
                user_cols = [row[1] for row in result.fetchall()]
                user_migrations = [
                    ("studentId", "TEXT"),
                    ("isActive", "BOOLEAN DEFAULT true"),
                    ("isVerified", "BOOLEAN DEFAULT false"),
                    ("verificationCode", "TEXT"),
                    ("verificationExpiry", "DATETIME"),
                    ("createdAt", "DATETIME DEFAULT CURRENT_TIMESTAMP"),
                    ("updatedAt", "DATETIME"),
                    ("educationStatus", "TEXT"),
                    ("highestEducation", "TEXT"),
                    ("degree", "TEXT"),
                    ("passingYear", "TEXT"),
                    ("dob", "TEXT"),
                    ("can_build_resume", "BOOLEAN DEFAULT false")
                ]
                for col_name, col_type in user_migrations:
                    if col_name not in user_cols:
                        print(f"Adding column {col_name} to users...")
                        await conn.execute(text(f"ALTER TABLE users ADD COLUMN {col_name} {col_type}"))

                result = await conn.execute(text("PRAGMA table_info(leave_requests)"))
                leave_cols = [row[1] for row in result.fetchall()]
                if "leaveType" not in leave_cols:
                    await conn.execute(text("ALTER TABLE leave_requests ADD COLUMN leaveType TEXT DEFAULT 'OTHER' NOT NULL"))
                if "proofUrl" not in leave_cols:
                    await conn.execute(text("ALTER TABLE leave_requests ADD COLUMN proofUrl TEXT"))
                
                # Assessment Sessions migrations for SQLite
                result = await conn.execute(text("PRAGMA table_info(assessment_sessions)"))
                session_cols = [row[1] for row in result.fetchall()]
                session_migrations = [
                    ("fullscreen_exit_count", "INTEGER DEFAULT 0"),
                    ("face_violation_count", "INTEGER DEFAULT 0"),
                    ("mic_violation_count", "INTEGER DEFAULT 0"),
                    ("last_heartbeat", "DATETIME"),
                    ("scheduled_at", "DATETIME")
                ]
                for col_name, col_type in session_migrations:

                    if col_name not in session_cols:
                        print(f"Adding column {col_name} to assessment_sessions...")
                        await conn.execute(text(f"ALTER TABLE assessment_sessions ADD COLUMN {col_name} {col_type}"))
                
                # Suggestions schema migration
                result = await conn.execute(text("PRAGMA table_info(suggestions)"))
                sugg_cols = [row[1] for row in result.fetchall()]
                if "screenshot_base64" not in sugg_cols:
                    await conn.execute(text("ALTER TABLE suggestions ADD COLUMN screenshot_base64 TEXT"))
                
                # Batches schema migration
                result = await conn.execute(text("PRAGMA table_info(batches)"))
                batch_cols = [row[1] for row in result.fetchall()]
                if "schedule_link" not in batch_cols:
                    await conn.execute(text("ALTER TABLE batches ADD COLUMN schedule_link TEXT"))
            print("SQLite startup complete.")
        else:
            # For PostgreSQL production: Run critical startup queries
            print("PostgreSQL detected - running migrations.")
            async with engine.begin() as conn:
                pg_migrations = [
                    # 1. Base Tables Creation (if missing)
                    """CREATE TABLE IF NOT EXISTS suggestions (
                        id VARCHAR PRIMARY KEY,
                        student_id VARCHAR REFERENCES users(id),
                        message TEXT NOT NULL,
                        category VARCHAR(100),
                        is_anonymous BOOLEAN DEFAULT FALSE,
                        is_read BOOLEAN DEFAULT FALSE,
                        admin_reply TEXT,
                        created_at TIMESTAMP DEFAULT NOW()
                    )""",
                    """CREATE TABLE IF NOT EXISTS sessions (
                        id VARCHAR PRIMARY KEY,
                        title VARCHAR NOT NULL,
                        description TEXT,
                        batch_id VARCHAR NOT NULL REFERENCES batches(id),
                        trainer_id VARCHAR NOT NULL REFERENCES users(id),
                        start_time TIMESTAMP NOT NULL,
                        end_time TIMESTAMP NOT NULL,
                        status VARCHAR DEFAULT 'SCHEDULED',
                        meeting_link VARCHAR,
                        resources_url VARCHAR,
                        created_at TIMESTAMP DEFAULT NOW(),
                        updated_at TIMESTAMP DEFAULT NOW()
                    )""",
                    """CREATE TABLE IF NOT EXISTS student_feedback (
                        id VARCHAR PRIMARY KEY,
                        target_type VARCHAR NOT NULL,
                        target_id VARCHAR NOT NULL,
                        submitted_by VARCHAR NOT NULL REFERENCES users(id),
                        rating INTEGER NOT NULL,
                        comments TEXT,
                        is_anonymous BOOLEAN DEFAULT FALSE,
                        created_at TIMESTAMP DEFAULT NOW()
                    )""",

                    # 2. Existing Migrations
                    "ALTER TABLE leave_requests ADD COLUMN IF NOT EXISTS rejection_reason VARCHAR",
                    "ALTER TABLE leave_requests ADD COLUMN IF NOT EXISTS approved_by_id VARCHAR",
                    "ALTER TABLE leave_requests ADD COLUMN IF NOT EXISTS proof_url VARCHAR",
                    "ALTER TABLE leave_requests ADD COLUMN IF NOT EXISTS leave_type VARCHAR DEFAULT 'OTHER'",
                    # FIX: Widen leave_type from VARCHAR(9) to VARCHAR(20) — WORK_FROM_HOME is 14 chars
                    "ALTER TABLE leave_requests ALTER COLUMN leave_type TYPE VARCHAR(20)",
                    # Also widen status columns that may have been created too narrow
                    "ALTER TABLE leave_requests ALTER COLUMN status TYPE VARCHAR(20)",
                    # assignment_submissions: AI grading columns
                    "ALTER TABLE assignment_submissions ADD COLUMN IF NOT EXISTS marks INTEGER",
                    "ALTER TABLE assignment_submissions ADD COLUMN IF NOT EXISTS feedback TEXT",
                    "ALTER TABLE assignment_submissions ADD COLUMN IF NOT EXISTS submitted_at TIMESTAMP DEFAULT NOW()",
                    "ALTER TABLE assignment_submissions ADD COLUMN IF NOT EXISTS graded_at TIMESTAMP",
                    # tasks and assignments modifications for specific student assignment
                    "ALTER TABLE assignments ADD COLUMN IF NOT EXISTS student_id VARCHAR",
                    "ALTER TABLE tasks ADD COLUMN IF NOT EXISTS student_id VARCHAR",
                    "ALTER TABLE tasks ADD COLUMN IF NOT EXISTS pdf_url VARCHAR",
                    # Assessment system upgrade
                    "ALTER TABLE tasks ADD COLUMN IF NOT EXISTS time_limit INTEGER DEFAULT 0",
                    "ALTER TABLE tasks ADD COLUMN IF NOT EXISTS is_randomized BOOLEAN DEFAULT FALSE",
                    "ALTER TABLE tasks ADD COLUMN IF NOT EXISTS structured_content TEXT",
                    "ALTER TABLE assignments ADD COLUMN IF NOT EXISTS time_limit INTEGER DEFAULT 0",
                    "ALTER TABLE assignments ADD COLUMN IF NOT EXISTS is_randomized BOOLEAN DEFAULT FALSE",
                    "ALTER TABLE assignments ADD COLUMN IF NOT EXISTS structured_content TEXT",
                    "ALTER TABLE tasks ADD COLUMN IF NOT EXISTS scheduled_at TIMESTAMP",
                    "ALTER TABLE assignments ADD COLUMN IF NOT EXISTS scheduled_at TIMESTAMP",
                    # Assessment Sessions

                    """CREATE TABLE IF NOT EXISTS assessment_sessions (
                        id VARCHAR PRIMARY KEY,
                        student_id VARCHAR REFERENCES users(id),
                        reference_id VARCHAR NOT NULL,
                        reference_type VARCHAR(50) NOT NULL,
                        start_time TIMESTAMP DEFAULT NOW(),
                        end_time TIMESTAMP,
                        responses TEXT,
                        tab_switch_count INTEGER DEFAULT 0,
                        fullscreen_exit_count INTEGER DEFAULT 0,
                        face_violation_count INTEGER DEFAULT 0,
                        mic_violation_count INTEGER DEFAULT 0,
                        score FLOAT DEFAULT 0.0,
                        completion_time_seconds INTEGER DEFAULT 0,
                        auto_submitted BOOLEAN DEFAULT FALSE,
                        is_completed BOOLEAN DEFAULT FALSE,
                        last_heartbeat TIMESTAMP,
                        created_at TIMESTAMP DEFAULT NOW(),
                        updated_at TIMESTAMP DEFAULT NOW()
                    )""",
                    "ALTER TABLE assessment_sessions ADD COLUMN IF NOT EXISTS fullscreen_exit_count INTEGER DEFAULT 0",
                    "ALTER TABLE assessment_sessions ADD COLUMN IF NOT EXISTS face_violation_count INTEGER DEFAULT 0",
                    "ALTER TABLE assessment_sessions ADD COLUMN IF NOT EXISTS mic_violation_count INTEGER DEFAULT 0",
                    "ALTER TABLE assessment_sessions ADD COLUMN IF NOT EXISTS last_heartbeat TIMESTAMP",
                    "ALTER TABLE suggestions ADD COLUMN IF NOT EXISTS screenshot_base64 TEXT",
                    # Batches: schedule_link for meeting link
                    "ALTER TABLE batches ADD COLUMN IF NOT EXISTS schedule_link VARCHAR",
                    # Resume Builder
                    "ALTER TABLE users ADD COLUMN IF NOT EXISTS can_build_resume BOOLEAN DEFAULT FALSE",
                    """CREATE TABLE IF NOT EXISTS resumes (
                        id VARCHAR PRIMARY KEY,
                        student_id VARCHAR REFERENCES users(id),
                        title VARCHAR NOT NULL,
                        mode VARCHAR DEFAULT 'visual',
                        template VARCHAR DEFAULT 'modern',
                        is_primary BOOLEAN DEFAULT FALSE,
                        personal TEXT DEFAULT '{}',
                        summary TEXT DEFAULT '',
                        skills TEXT DEFAULT '[]',
                        experience TEXT DEFAULT '[]',
                        education TEXT DEFAULT '[]',
                        projects TEXT DEFAULT '[]',
                        certifications TEXT DEFAULT '[]',
                        languages TEXT DEFAULT '[]',
                        original_resume_text TEXT,
                        job_description TEXT,
                        created_at TIMESTAMP DEFAULT NOW(),
                        updated_at TIMESTAMP DEFAULT NOW()
                    )""",
                ]
                for sql in pg_migrations:
                    try:
                        await conn.execute(text(sql))
                        print(f"Migration OK: {sql[:60]}...")
                    except Exception as col_e:
                        print(f"Migration skipped: {col_e}")
            print("PostgreSQL app ready.")

    except Exception as e:
        # Log the error but do NOT crash the app. The API can still serve requests
        # even if the startup check fails (e.g. brief network blip at boot time).
        print(f"WARNING - Startup DB check failed (non-fatal): {e}")

    # Start Scheduler
    scheduler.start()
    print("APScheduler started.")
    
    yield
    # Shutdown: clean up connection pool
    scheduler.shutdown()
    await engine.dispose()
    print("LMS API shut down.")



app = FastAPI(
    title="Apptech Careers LMS API",
    description="Learning Management System backend for Apptech Careers",
    version="1.1.0",
    lifespan=lifespan,
)

# CORS - Hardened manual implementation for production stability
origins = [
    "https://lms-beta-lilac.vercel.app",
    "https://lms.appteknow.com",
    "http://localhost:3000",
    "http://127.0.0.1:3000"
]
# Merge with settings origins, stripping trailing slashes
for o in settings.CORS_ORIGINS:
    clean_o = o.rstrip('/')
    if clean_o not in origins:
        origins.append(clean_o)

@app.middleware("http")
async def custom_cors_middleware(request: Request, call_next):
    # Handle preflight OPTIONS requests directly
    if request.method == "OPTIONS":
        response = JSONResponse(content="OK")
    else:
        try:
            response = await call_next(request)
        except Exception as e:
            # Re-raise to let the exception handler handle it
            raise e
        
    origin = request.headers.get("origin")
    # Always set headers if origin is in our whitelist OR for any origin if we want extreme stability
    # (Checking against specific whitelisted origins for security + allow_credentials)
    if origin in origins or not origin:
        target_origin = origin if origin else origins[0]
        response.headers["Access-Control-Allow-Origin"] = target_origin
        response.headers["Access-Control-Allow-Credentials"] = "true"
        response.headers["Access-Control-Allow-Methods"] = "*"
        response.headers["Access-Control-Allow-Headers"] = "*"
        
    return response

@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    import traceback
    error_msg = str(exc)
    stack_trace = traceback.format_exc()
    print(f"GLOBAL ERROR: {error_msg}\n{stack_trace}")
    
    origin = request.headers.get("origin")
    response = JSONResponse(
        status_code=500,
        content={"detail": f"Internal Server Error: {error_msg}", "type": str(type(exc).__name__)},
    )
    
    # Manually add CORS headers to the error response so the browser doesn't block it
    target_origin = origin if origin in origins else (origins[0] if origins else "*")
    response.headers["Access-Control-Allow-Origin"] = target_origin
    response.headers["Access-Control-Allow-Credentials"] = "true"
    response.headers["Access-Control-Allow-Methods"] = "*"
    response.headers["Access-Control-Allow-Headers"] = "*"
        
    return response

from app.routers import auth, admin, marketing, training, placement, sessions, resume

# Register routers
app.include_router(auth.router)
app.include_router(admin.router)
app.include_router(marketing.router)
app.include_router(training.router)
app.include_router(placement.router)
app.include_router(ai.router)
app.include_router(sessions.router)
app.include_router(resume.router)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True)

# Mount Socket.io app
app.mount("/socket.io", sio_app)





@app.get("/api/health")
async def health_check():
    return {"status": "ok", "app": "Apptech Careers LMS"}
