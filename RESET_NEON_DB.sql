-- =============================================================
-- NEON POSTGRESQL DATE-FILTERED CLEANUP SCRIPT (COMPLETE DEPENDENCY ORDER)
-- Purpose: Safely deletes test data created BEFORE 24th July 2026.
-- Handles all sub-child tables (sessions, assignments, etc.).
-- PRESERVES ALL DATA CREATED ON OR AFTER 25TH JULY 2026 & SUPER_ADMIN.
-- =============================================================

DO $$
BEGIN
    -- 1. Sub-Child Tables (Sessions, Assignments, Milestones, Violations)
    BEGIN DELETE FROM sessions WHERE created_at < '2026-07-24'::timestamp; EXCEPTION WHEN OTHERS THEN NULL; END;
    BEGIN DELETE FROM assignment_submissions WHERE submitted_at < '2026-07-24'::timestamp OR created_at < '2026-07-24'::timestamp; EXCEPTION WHEN OTHERS THEN NULL; END;
    BEGIN DELETE FROM assignments WHERE created_at < '2026-07-24'::timestamp; EXCEPTION WHEN OTHERS THEN NULL; END;
    BEGIN DELETE FROM project_milestones WHERE created_at < '2026-07-24'::timestamp; EXCEPTION WHEN OTHERS THEN NULL; END;
    BEGIN DELETE FROM violations WHERE created_at < '2026-07-24'::timestamp; EXCEPTION WHEN OTHERS THEN NULL; END;
    BEGIN DELETE FROM assessment_sessions WHERE created_at < '2026-07-24'::timestamp; EXCEPTION WHEN OTHERS THEN NULL; END;

    -- 2. Leaf Child Tables (Attendance, Tasks, Submissions, Feedback, Jobs, Logs)
    BEGIN DELETE FROM lead_activities WHERE created_at < '2026-07-24'::timestamp; EXCEPTION WHEN OTHERS THEN NULL; END;
    BEGIN DELETE FROM batch_students WHERE joined_at < '2026-07-24'::timestamp OR created_at < '2026-07-24'::timestamp; EXCEPTION WHEN OTHERS THEN NULL; END;
    BEGIN DELETE FROM attendance WHERE created_at < '2026-07-24'::timestamp OR date < '2026-07-24'::timestamp; EXCEPTION WHEN OTHERS THEN NULL; END;
    BEGIN DELETE FROM leave_requests WHERE created_at < '2026-07-24'::timestamp; EXCEPTION WHEN OTHERS THEN NULL; END;
    BEGIN DELETE FROM time_tracking WHERE created_at < '2026-07-24'::timestamp OR date < '2026-07-24'::timestamp; EXCEPTION WHEN OTHERS THEN NULL; END;
    BEGIN DELETE FROM tasks WHERE created_at < '2026-07-24'::timestamp; EXCEPTION WHEN OTHERS THEN NULL; END;
    BEGIN DELETE FROM videos WHERE created_at < '2026-07-24'::timestamp; EXCEPTION WHEN OTHERS THEN NULL; END;
    BEGIN DELETE FROM assessment_submissions WHERE submitted_at < '2026-07-24'::timestamp; EXCEPTION WHEN OTHERS THEN NULL; END;
    BEGIN DELETE FROM feedback WHERE created_at < '2026-07-24'::timestamp; EXCEPTION WHEN OTHERS THEN NULL; END;
    BEGIN DELETE FROM job_applications WHERE created_at < '2026-07-24'::timestamp; EXCEPTION WHEN OTHERS THEN NULL; END;
    BEGIN DELETE FROM mock_interviews WHERE created_at < '2026-07-24'::timestamp; EXCEPTION WHEN OTHERS THEN NULL; END;
    BEGIN DELETE FROM communication_practice WHERE created_at < '2026-07-24'::timestamp; EXCEPTION WHEN OTHERS THEN NULL; END;
    BEGIN DELETE FROM notifications WHERE created_at < '2026-07-24'::timestamp; EXCEPTION WHEN OTHERS THEN NULL; END;
    BEGIN DELETE FROM messages WHERE sent_at < '2026-07-24'::timestamp OR created_at < '2026-07-24'::timestamp; EXCEPTION WHEN OTHERS THEN NULL; END;
    BEGIN DELETE FROM documents WHERE created_at < '2026-07-24'::timestamp; EXCEPTION WHEN OTHERS THEN NULL; END;
    BEGIN DELETE FROM registrations WHERE created_at < '2026-07-24'::timestamp; EXCEPTION WHEN OTHERS THEN NULL; END;

    -- 3. Mid-Level Tables (Projects, Assessments, Leads, Jobs)
    BEGIN DELETE FROM projects WHERE created_at < '2026-07-24'::timestamp; EXCEPTION WHEN OTHERS THEN NULL; END;
    BEGIN DELETE FROM assessments WHERE created_at < '2026-07-24'::timestamp; EXCEPTION WHEN OTHERS THEN NULL; END;
    BEGIN DELETE FROM leads WHERE created_at < '2026-07-24'::timestamp; EXCEPTION WHEN OTHERS THEN NULL; END;
    BEGIN DELETE FROM jobs WHERE created_at < '2026-07-24'::timestamp; EXCEPTION WHEN OTHERS THEN NULL; END;

    -- 4. Parent Tables (Batches, Courses, Permissions, Users)
    BEGIN DELETE FROM batches WHERE created_at < '2026-07-24'::timestamp; EXCEPTION WHEN OTHERS THEN NULL; END;
    BEGIN DELETE FROM courses WHERE created_at < '2026-07-24'::timestamp; EXCEPTION WHEN OTHERS THEN NULL; END;
    BEGIN DELETE FROM admin_permissions WHERE created_at < '2026-07-24'::timestamp; EXCEPTION WHEN OTHERS THEN NULL; END;
    BEGIN DELETE FROM users WHERE role != 'SUPER_ADMIN' AND created_at < '2026-07-24'::timestamp; EXCEPTION WHEN OTHERS THEN NULL; END;
END $$;
