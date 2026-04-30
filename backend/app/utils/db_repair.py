
import logging
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import engine

logger = logging.getLogger(__name__)

async def repair_database():
    \"\"\"
    Ensures that the student_id column exists in the users table.
    This prevents the 'no such column' error while restoring the field.
    \"\"\"
    async with engine.begin() as conn:
        try:
            # Check if student_id exists (Works for both Postgres and SQLite)
            if engine.url.drivername.startswith(\"postgresql\"):
                result = await conn.execute(text(\"\"\"
                    SELECT column_name 
                    FROM information_schema.columns 
                    WHERE table_name = 'users' AND column_name = 'student_id'
                \"\"\"))
                exists = result.fetchone()
            else:
                # SQLite fallback
                result = await conn.execute(text(\"PRAGMA table_info(users)\"))
                columns = [row[1] for row in result.fetchall()]
                exists = 'student_id' in columns

            if not exists:
                logger.info(\"Column 'student_id' is missing in 'users' table. Repairing database...\")
                if engine.url.drivername.startswith(\"postgresql\"):
                    await conn.execute(text(\"ALTER TABLE users ADD COLUMN student_id VARCHAR(100) UNIQUE\"))
                else:
                    await conn.execute(text(\"ALTER TABLE users ADD COLUMN student_id TEXT\"))
                logger.info(\"Column 'student_id' added successfully.\")
            else:
                logger.info(\"Column 'student_id' already exists in the database.\")
        except Exception as e:
            logger.error(f\"Database repair failed: {e}\")
