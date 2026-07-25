import sys
import os
from pptx import Presentation
from pptx.util import Inches, Pt
from pptx.enum.text import PP_ALIGN
from pptx.dml.color import RGBColor
from pptx.enum.shapes import MSO_SHAPE

def create_lms_presentation(output_path):
    prs = Presentation()
    # Set slide dimensions to widescreen 16:9 (13.333 x 7.5 inches)
    prs.slide_width = Inches(13.333)
    prs.slide_height = Inches(7.5)
    
    # Colors
    NAVY = RGBColor(15, 23, 42)        # #0f172a
    BLUE_ACCENT = RGBColor(0, 102, 255) # #0066ff
    LIGHT_BG = RGBColor(248, 250, 252)  # #f8fafc
    CARD_BG = RGBColor(255, 255, 255)   # #ffffff
    TEXT_DARK = RGBColor(30, 41, 59)     # #1e293b
    TEXT_MUTED = RGBColor(100, 116, 139) # #64748b
    WHITE = RGBColor(255, 255, 255)
    GOLD = RGBColor(245, 158, 11)      # #f59e0b
    GREEN = RGBColor(16, 185, 129)     # #10b981
    BORDER_COLOR = RGBColor(226, 232, 240)

    blank_layout = prs.slide_layouts[6]

    def add_header(slide, title_text, subtitle_text=""):
        # Header background banner
        header_box = slide.shapes.add_shape(MSO_SHAPE.RECTANGLE, Inches(0), Inches(0), Inches(13.333), Inches(1.2))
        header_box.fill.solid()
        header_box.fill.fore_color.rgb = NAVY
        header_box.line.color.rgb = NAVY
        
        # Title text
        txBox = slide.shapes.add_textbox(Inches(0.8), Inches(0.15), Inches(11.733), Inches(0.55))
        tf = txBox.text_frame
        tf.word_wrap = True
        p = tf.paragraphs[0]
        p.text = title_text
        p.font.size = Pt(26)
        p.font.bold = True
        p.font.color.rgb = WHITE
        p.font.name = 'Calibri'
        
        if subtitle_text:
            p2 = tf.add_paragraph()
            p2.text = subtitle_text
            p2.font.size = Pt(13)
            p2.font.color.rgb = GOLD
            p2.font.name = 'Calibri'

    def add_card(slide, left, top, width, height, title, items, title_color=BLUE_ACCENT):
        card = slide.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, Inches(left), Inches(top), Inches(width), Inches(height))
        card.fill.solid()
        card.fill.fore_color.rgb = CARD_BG
        card.line.color.rgb = BORDER_COLOR
        card.line.width = Pt(1.5)
        
        txBox = slide.shapes.add_textbox(Inches(left + 0.2), Inches(top + 0.15), Inches(width - 0.4), Inches(height - 0.3))
        tf = txBox.text_frame
        tf.word_wrap = True
        
        p = tf.paragraphs[0]
        p.text = title
        p.font.size = Pt(18)
        p.font.bold = True
        p.font.color.rgb = title_color
        p.font.name = 'Calibri'
        p.space_after = Pt(10)
        
        for item in items:
            p_item = tf.add_paragraph()
            p_item.text = f"• {item}"
            p_item.font.size = Pt(13)
            p_item.font.color.rgb = TEXT_DARK
            p_item.font.name = 'Calibri'
            p_item.space_after = Pt(6)

    # -------------------------------------------------------------
    # SLIDE 1: Title Slide
    # -------------------------------------------------------------
    slide1 = prs.slides.add_slide(blank_layout)
    bg1 = slide1.shapes.add_shape(MSO_SHAPE.RECTANGLE, Inches(0), Inches(0), Inches(13.333), Inches(7.5))
    bg1.fill.solid()
    bg1.fill.fore_color.rgb = NAVY
    bg1.line.color.rgb = NAVY

    # Decorative accent bar
    bar = slide1.shapes.add_shape(MSO_SHAPE.RECTANGLE, Inches(1.2), Inches(2.2), Inches(0.15), Inches(3.2))
    bar.fill.solid()
    bar.fill.fore_color.rgb = BLUE_ACCENT
    bar.line.color.rgb = BLUE_ACCENT

    txBox = slide1.shapes.add_textbox(Inches(1.6), Inches(2.1), Inches(10.5), Inches(3.5))
    tf = txBox.text_frame
    tf.word_wrap = True

    p = tf.paragraphs[0]
    p.text = "LMS DATA ARCHITECTURE & SYSTEM FLOW"
    p.font.size = Pt(36)
    p.font.bold = True
    p.font.color.rgb = WHITE
    p.font.name = 'Calibri'

    p2 = tf.add_paragraph()
    p2.text = "End-to-End Business Pipeline & 22-Table Relational Schema for Data Analytics"
    p2.font.size = Pt(20)
    p2.font.color.rgb = GOLD
    p2.font.name = 'Calibri'
    p2.space_before = Pt(12)

    p3 = tf.add_paragraph()
    p3.text = "Target Audience: Data Analytics & Engineering Students | System: AppTechno LMS"
    p3.font.size = Pt(14)
    p3.font.color.rgb = RGBColor(148, 163, 184)
    p3.font.name = 'Calibri'
    p3.space_before = Pt(24)

    # -------------------------------------------------------------
    # SLIDE 2: Executive Summary & Context
    # -------------------------------------------------------------
    slide2 = prs.slides.add_slide(blank_layout)
    add_header(slide2, "1. Executive Summary & EdTech Data Analytics", "Why Data Analytics Students Need to Understand LMS Architecture")

    add_card(slide2, 0.8, 1.6, 5.6, 5.2, "🎯 Purpose of an Enterprise LMS", [
        "Automates the complete student lifecycle from initial inquiry to job placement.",
        "Generates multi-dimensional business data across marketing, finance, academics, and recruitment.",
        "Provides real-world datasets ideal for building Business Intelligence (BI) dashboards.",
        "Requires scalable relational database schemas to ensure transactional consistency."
    ], BLUE_ACCENT)

    add_card(slide2, 6.8, 1.6, 5.6, 5.2, "📈 Key Data Analytics Domain Scope", [
        "Marketing & Sales Funnel: Prospect conversion & marketing ROI.",
        "Financial Analytics: Revenue realization & fee collection efficiency.",
        "Academic & Engagement: Attendance tracking & churn prediction.",
        "Evaluation Analytics: Exam performance & weekly trainer feedback.",
        "Career Analytics: Mock interview readiness & placement conversion."
    ], GOLD)

    # -------------------------------------------------------------
    # SLIDE 3: Student Lifecycle Flow (Phases 1 - 5)
    # -------------------------------------------------------------
    slide3 = prs.slides.add_slide(blank_layout)
    add_header(slide3, "2. End-to-End Student Lifecycle Data Pipeline", "5 Key Phases of Data Generation in an Enterprise LMS")

    phases = [
        ("Phase 1: Marketing", ["Lead capture from Ads/Referrals", "Touchpoint logs (Calls/Emails)", "Lead conversion to Student"], BLUE_ACCENT),
        ("Phase 2: Finance", ["Course & batch selection", "Tuition fee tracking", "Receipt & document verification"], GOLD),
        ("Phase 3: Operations", ["Daily QR/Geo attendance", "Time tracking portal logs", "Leave request & quota audit"], GREEN),
        ("Phase 4: Learning", ["Project & task ticketing", "Video lecture views", "Assessments & weekly feedback"], BLUE_ACCENT),
        ("Phase 5: Placement", ["Mock interview scores", "Verbal communication drills", "Job application funnel"], GOLD)
    ]

    left_margin = 0.8
    card_width = 2.2
    gap = 0.2
    for idx, (p_title, p_items, p_color) in enumerate(phases):
        c_left = left_margin + idx * (card_width + gap)
        add_card(slide3, c_left, 1.6, card_width, 5.2, p_title, p_items, p_color)

    # -------------------------------------------------------------
    # SLIDE 4: User Roles & Permission Matrix (RBAC)
    # -------------------------------------------------------------
    slide4 = prs.slides.add_slide(blank_layout)
    add_header(slide4, "3. System Roles & Access Matrix", "Role-Based Access Control (RBAC) & Data Access Boundaries")

    roles = [
        ("SUPER_ADMIN / ADMIN", "Full system governance, course/batch creation, fee setup, leave approvals, user permissions", BLUE_ACCENT),
        ("TRAINER", "Batch management, project/task assignment, attendance tracking, assessment grading", GREEN),
        ("MARKETER", "Lead generation, prospect follow-ups (Calls/Emails/WhatsApp), registration conversion", GOLD),
        ("STUDENT", "Class attendance, portal time logging, assignment submissions, tests, job applications", BLUE_ACCENT)
    ]

    top_pos = 1.6
    for title, desc, col in roles:
        card = slide4.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, Inches(0.8), Inches(top_pos), Inches(11.733), Inches(1.15))
        card.fill.solid()
        card.fill.fore_color.rgb = CARD_BG
        card.line.color.rgb = BORDER_COLOR
        card.line.width = Pt(1.5)

        txBox = slide4.shapes.add_textbox(Inches(1.0), Inches(top_pos + 0.15), Inches(11.3), Inches(0.85))
        tf = txBox.text_frame
        p = tf.paragraphs[0]
        p.text = title
        p.font.size = Pt(17)
        p.font.bold = True
        p.font.color.rgb = col
        p.font.name = 'Calibri'
        
        p2 = tf.add_paragraph()
        p2.text = desc
        p2.font.size = Pt(13)
        p2.font.color.rgb = TEXT_DARK
        p2.font.name = 'Calibri'

        top_pos += 1.35

    # -------------------------------------------------------------
    # SLIDE 5: Database Schema (22 Tables - Part 1)
    # -------------------------------------------------------------
    slide5 = prs.slides.add_slide(blank_layout)
    add_header(slide5, "4. Relational Database Schema (Part 1: Core, Marketing, Finance)", "22 Tables Grouped into Functional Modules")

    add_card(slide5, 0.8, 1.6, 5.6, 2.5, "Module A: Users & RBAC", [
        "users: Account master (email, role, phone, studentId)",
        "admin_permissions: Granular administrative flags"
    ], BLUE_ACCENT)

    add_card(slide5, 6.8, 1.6, 5.6, 2.5, "Module B: Courses & Batches", [
        "courses: Master course catalog & base tuition fees",
        "batches: Academic cohorts, schedules & trainer assignment",
        "batch_students: Junction table mapping student enrollments"
    ], GOLD)

    add_card(slide5, 0.8, 4.3, 5.6, 2.5, "Module C: Marketing Funnel", [
        "leads: Prospect pipeline (source, status, assignee)",
        "lead_activities: Sales touchpoint log (calls, emails)"
    ], GREEN)

    add_card(slide5, 6.8, 4.3, 5.6, 2.5, "Module D: Finance & Admissions", [
        "registrations: Fee tracking (feeAmount, feePaid, receipt)",
        "documents: Student KYC uploads & admin verification status"
    ], BLUE_ACCENT)

    # -------------------------------------------------------------
    # SLIDE 6: Database Schema (22 Tables - Part 2)
    # -------------------------------------------------------------
    slide6 = prs.slides.add_slide(blank_layout)
    add_header(slide6, "5. Relational Database Schema (Part 2: Ops, Academics, Career)", "Attendance, Evaluation & Placement Modules")

    add_card(slide6, 0.8, 1.6, 5.6, 2.5, "Module E: Attendance & Time Logs", [
        "attendance: Daily class QR/Geo attendance records",
        "leave_requests: Leave applications, proof URLs & status",
        "time_tracking: Lab portal active duration tracking"
    ], BLUE_ACCENT)

    add_card(slide6, 6.8, 1.6, 5.6, 2.5, "Module F: Projects & Content", [
        "projects: Capstone & module projects per batch",
        "tasks: Task tickets per student & plagiarism flags",
        "videos: Lecture recordings & timeline chapters"
    ], GOLD)

    add_card(slide6, 0.8, 4.3, 5.6, 2.5, "Module G: Evaluation Engine", [
        "assessments: Exam master (Coding & Aptitude tests)",
        "assessment_submissions: Student test scores & answers",
        "feedback: Weekly ratings for batch & trainer performance"
    ], GREEN)

    add_card(slide6, 6.8, 4.3, 5.6, 2.5, "Module H: Placement & Career", [
        "jobs: Corporate hiring drives & salary packages",
        "job_applications: Recruitment funnel stage tracking",
        "mock_interviews & communication_practice: Drill scores"
    ], BLUE_ACCENT)

    # -------------------------------------------------------------
    # SLIDE 7: Analytics Project 1 - Marketing Funnel
    # -------------------------------------------------------------
    slide7 = prs.slides.add_slide(blank_layout)
    add_header(slide7, "6. Data Analytics Project 1: Lead Conversion Funnel", "Evaluating Marketing Channels & Sales Productivity")

    add_card(slide7, 0.8, 1.6, 5.6, 5.2, "📋 Project Specifications", [
        "Primary Tables: leads, lead_activities, registrations",
        "Goal: Measure marketing ROI and sales conversion efficiency.",
        "Analytical Focus: Tracking lead journeys from NEW to CONVERTED.",
        "Business Impact: Optimizing marketing spend on high-performing channels."
    ], BLUE_ACCENT)

    add_card(slide7, 6.8, 1.6, 5.6, 5.2, "💡 Key KPIs & Analytics Questions", [
        "1. Lead Conversion Rate (LCR) by Source (Google Ads vs LinkedIn vs Referral).",
        "2. Marketer Sales Productivity: Conversion % per assigned sales rep.",
        "3. Average Touchpoints: Number of calls/emails needed before student registration.",
        "4. Drop-off Analysis: High-loss stages in the marketing funnel."
    ], GOLD)

    # -------------------------------------------------------------
    # SLIDE 8: Analytics Project 2 - Student Churn Risk
    # -------------------------------------------------------------
    slide8 = prs.slides.add_slide(blank_layout)
    add_header(slide8, "7. Data Analytics Project 2: Student Churn Prediction", "Predictive Analytics for Academic Retention & Early Intervention")

    add_card(slide8, 0.8, 1.6, 5.6, 5.2, "📊 Metric Formulas", [
        "Attendance Percentage = (Count of PRESENT / Total Batch Days) * 100",
        "Task Overdue Rate = (Count of OVERDUE Tasks / Total Assigned Tasks) * 100",
        "Primary Tables: attendance, tasks, leave_requests, feedback",
        "Goal: Identify at-risk students before course abandonment."
    ], BLUE_ACCENT)

    add_card(slide8, 6.8, 1.6, 5.6, 5.2, "🎯 Churn Risk Rules & Actions", [
        "High Risk Threshold: Attendance < 75% AND Overdue Tasks > 30%.",
        "Early Warning Indicator: Consistently low weekly feedback rating (< 3 stars).",
        "Intervention Trigger: Automated alert to batch trainers and academic advisors.",
        "Outcome: Increased course completion rate and student success."
    ], GREEN)

    # -------------------------------------------------------------
    # SLIDE 9: Analytics Project 3 - Financial Realization
    # -------------------------------------------------------------
    slide9 = prs.slides.add_slide(blank_layout)
    add_header(slide9, "8. Data Analytics Project 3: Revenue & Fee Realization", "Financial Analytics & Tuition Collection Efficiency")

    add_card(slide9, 0.8, 1.6, 5.6, 5.2, "💰 Revenue Metrics", [
        "Total Agreed Tuition Revenue = SUM(feeAmount)",
        "Collected Cash Realization = SUM(feePaid)",
        "Outstanding Fee Balance = SUM(feeAmount - feePaid)",
        "Collection Efficiency % = (Total Fee Paid / Total Fee Amount) * 100",
        "Primary Tables: registrations, courses, batches"
    ], GOLD)

    add_card(slide9, 6.8, 1.6, 5.6, 5.2, "📈 BI Dashboard Questions", [
        "1. Which course generates the highest gross revenue per batch?",
        "2. What is the total uncollected fee balance across active batches?",
        "3. Fee payment delinquency trends by student enrollment month.",
        "4. Revenue realization forecasting for upcoming batch end-dates."
    ], BLUE_ACCENT)

    # -------------------------------------------------------------
    # SLIDE 10: Analytics Projects 4 & 5 - Quality & Placement
    # -------------------------------------------------------------
    slide10 = prs.slides.add_slide(blank_layout)
    add_header(slide10, "9. Analytics Projects 4 & 5: Quality & Career Funnel", "Faculty Evaluation & Job Placement Readiness Analytics")

    add_card(slide10, 0.8, 1.6, 5.6, 5.2, "⭐ Project 4: Trainer Satisfaction Index", [
        "Primary Tables: feedback, batches, users",
        "Metric: Weekly 1 to 5 star rating average per trainer.",
        "NLP Sentiment Analysis: Text mining qualitative comments in feedback.comments.",
        "Goal: Ensuring consistent teaching quality across cohorts."
    ], GREEN)

    add_card(slide10, 6.8, 1.6, 5.6, 5.2, "💼 Project 5: Placement Funnel Performance", [
        "Primary Tables: job_applications, jobs, mock_interviews",
        "Metric: Correlation between Mock Score (>80) and Job Selection.",
        "Recruitment Funnel Conversion %: APPLIED -> SHORTLISTED -> INTERVIEW -> SELECTED.",
        "Goal: Maximizing corporate hiring rates for students."
    ], GOLD)

    # -------------------------------------------------------------
    # SLIDE 11: Summary & Takeaways
    # -------------------------------------------------------------
    slide11 = prs.slides.add_slide(blank_layout)
    add_header(slide11, "10. Summary & Key Takeaways for Students", "Connecting Database Architecture with Real-World BI & Analytics")

    add_card(slide11, 0.8, 1.6, 11.733, 5.2, "🎓 Essential Lessons for Data Analytics Students", [
        "1. Relational Integrity: Foreign key constraints ensure data consistency across complex multi-table workflows.",
        "2. Domain-Driven Analytics: Organizing database tables into functional domains simplifies dashboard design.",
        "3. Actionable Insights: Raw transactional tables (logs, marks, fees) drive strategic business decisions.",
        "4. Industry Relevance: Understanding LMS schema prepares students for EdTech, SaaS, and Corporate Analytics roles.",
        "5. Complete Presentation & Reference guide available in workspace file: LMS_DATA_ARCHITECTURE_AND_FLOW.md"
    ], BLUE_ACCENT)

    # Save presentation
    prs.save(output_path)
    print(f"Presentation saved successfully to: {output_path}")

if __name__ == "__main__":
    out_file = sys.argv[1] if len(sys.argv) > 1 else "LMS_Data_Architecture_and_Flow.pptx"
    create_lms_presentation(out_file)
