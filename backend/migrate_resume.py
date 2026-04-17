import asyncio
from sqlalchemy import text
from app.database import engine

async def migrate():
    async with engine.begin() as conn:
        try:
            # Check if column exists (varies by DB, but we can just try to add and catch error)
            await conn.execute(text("ALTER TABLE users ADD COLUMN can_build_resume BOOLEAN DEFAULT FALSE"))
            print("Successfully added can_build_resume column to users table.")
        except Exception as e:
            if "duplicate column name" in str(e).lower() or "already exists" in str(e).lower():
                print("Column can_build_resume already exists.")
            else:
                print(f"Error: {e}")

if __name__ == "__main__":
    asyncio.run(migrate())
