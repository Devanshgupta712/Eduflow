
import asyncio
from sqlalchemy import text
from app.database import engine

async def check_and_fix_db():
    async with engine.begin() as conn:
        # Check if student_id exists in users table
        result = await conn.execute(text(\"\"\"
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'users' AND column_name = 'student_id'
        \"\"\"))
        column_exists = result.fetchone()
        
        if not column_exists:
            print(\"Column 'student_id' is missing in 'users' table. Adding it now...\")
            try:
                await conn.execute(text(\"ALTER TABLE users ADD COLUMN student_id VARCHAR(50) UNIQUE\"))
                print(\"Column 'student_id' added successfully!\")
            except Exception as e:
                print(f\"Error adding column: {e}\")
        else:
            print(\"Column 'student_id' already exists.\")

if __name__ == \"__main__\":
    asyncio.run(check_and_fix_db())
