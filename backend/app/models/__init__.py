# flake8: noqa – Bulk-import all models for table creation & relationships

from app.models.user import User
from app.models.course import Course, Batch, BatchStudent
from app.models.lead import Lead, LeadActivity
from app.models.attendance import Attendance, LeaveRequest, TimeTracking
from app.models.project import Project, ProjectMilestone, Task, Assignment, AssignmentSubmission, Violation
from app.models.placement import Job, JobApplication, Assessment, AssessmentSubmission, MockInterview, CommunicationPractice
from app.models.registration import Registration, Document
from app.models.notification import Notification, Message, Video, Feedback, Suggestion
from app.models.setting import SystemSetting
from app.models.session import Session, StudentFeedback
from app.models.resume import Resume

__all__ = [
    "User",
    "Course", "Batch", "BatchStudent",
    "Lead", "LeadActivity",
    "Attendance", "LeaveRequest", "TimeTracking",
    "Project", "ProjectMilestone", "Task", "Assignment", "AssignmentSubmission", "Violation",
    "Job", "JobApplication", "Assessment", "AssessmentSubmission", "MockInterview", "CommunicationPractice",
    "Registration", "Document",
    "Notification", "Message", "Video", "Feedback", "Suggestion",
    "SystemSetting",
    "Resume",
]


