from datetime import datetime, timedelta
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
import uuid

from app.database import AsyncSessionLocal
from app.models.user import User, Role
from app.models.session import StudentFeedback
from app.models.project import Violation, ViolationType, ViolationSeverity, ViolationStatus

async def check_missed_feedback():
    print("Running weekly Saturday feedback check...")
    
    async with AsyncSessionLocal() as db:
        try:
            # 1. Get all active students
            query = select(User).where(User.role == Role.STUDENT, User.is_active == True)
            result = await db.execute(query)
            students = result.scalars().all()
            
            # We assume a week goes from Sunday to Saturday.
            # So "current week" means within the last 7 days.
            # Or we can just check if they submitted any feedback in the last 7 days.
            one_week_ago = datetime.utcnow() - timedelta(days=7)
            
            for student in students:
                # Check if this student has submitted feedback in the last week
                fb_query = select(StudentFeedback).where(
                    StudentFeedback.submitted_by == student.id,
                    StudentFeedback.created_at >= one_week_ago
                )
                fb_result = await db.execute(fb_query)
                feedbacks = fb_result.scalars().all()
                
                if not feedbacks:
                    # Student missed the feedback -> Violation
                    violation = Violation(
                        id=str(uuid.uuid4()),
                        student_id=student.id,
                        type=ViolationType.MISSED_FEEDBACK,
                        severity=ViolationSeverity.LOW,
                        status=ViolationStatus.OPEN,
                        title="Missed Weekly Feedback",
                        description="Student failed to submit the mandatory weekly feedback on Saturday.",
                        penalty_points=0,  # No penalty points as requested by user
                        created_at=datetime.utcnow()
                    )
                    db.add(violation)
            
            await db.commit()
            print("Completed weekly Saturday feedback check.")
            
        except Exception as e:
            await db.rollback()
            print(f"Error in check_missed_feedback cron job: {e}")
