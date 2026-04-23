import asyncio
import os
import sys

# Add the backend directory to sys.path so we can import app modules
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from sqlalchemy import text
from app.database import engine

async def migrate():
    print("🚀 Starting Database Migration...")
    async with engine.begin() as conn:
        try:
            # Check if the column already exists
            print("🔍 Checking if 'layout_metadata' exists in 'resumes' table...")
            # Note: This is PostgreSQL syntax as seen in your error message
            await conn.execute(text("ALTER TABLE resumes ADD COLUMN IF NOT EXISTS layout_metadata TEXT DEFAULT '{}';"))
            print("✅ Successfully added 'layout_metadata' column to 'resumes' table.")
            
        except Exception as e:
            print(f"❌ Migration failed: {str(e)}")
            if "already exists" in str(e).lower():
                print("💡 Note: The column might already exist.")

if __name__ == "__main__":
    asyncio.run(migrate())
