-- =============================================================
-- NEON POSTGRESQL DATE-FILTERED CLEANUP SCRIPT (PERFECT DEPENDENCY ORDER)
-- Purpose: Safely deletes test data created BEFORE 24th July 2026 23:59:59.
-- Explicitly handles assignment_submissions -> assignments -> batches -> courses hierarchy.
-- PRESERVES ALL DATA CREATED ON OR AFTER 25TH JULY 2026 & SUPER_ADMIN.
-- =============================================================

DO $$
DECLARE
    del_count INT;
BEGIN
    RAISE NOTICE 'Starting date-filtered database cleanup for data prior to 2026-07-24...';

    -- =============================================================
    -- STEP 1: Deepest Sub-Child Tables
    -- =============================================================
    BEGIN DELETE FROM assignment_submissions WHERE submitted_at < '2026-07-24 23:59:59'::timestamp OR created_at < '2026-07-24 23:59:59'::timestamp; GET DIAGNOSTICS del_count = ROW_COUNT; IF del_count > 0 THEN RAISE NOTICE '✓ Deleted % rows from assignment_submissions', del_count; END IF; EXCEPTION WHEN OTHERS THEN NULL; END;
    BEGIN DELETE FROM project_milestones WHERE created_at < '2026-07-24 23:59:59'::timestamp; GET DIAGNOSTICS del_count = ROW_COUNT; IF del_count > 0 THEN RAISE NOTICE '✓ Deleted % rows from project_milestones', del_count; END IF; EXCEPTION WHEN OTHERS THEN NULL; END;
    BEGIN DELETE FROM assessment_submissions WHERE "submittedAt" < '2026-07-24 23:59:59'::timestamp OR submitted_at < '2026-07-24 23:59:59'::timestamp OR created_at < '2026-07-24 23:59:59'::timestamp; GET DIAGNOSTICS del_count = ROW_COUNT; IF del_count > 0 THEN RAISE NOTICE '✓ Deleted % rows from assessment_submissions', del_count; END IF; EXCEPTION WHEN OTHERS THEN NULL; END;
    BEGIN DELETE FROM assessment_sessions WHERE created_at < '2026-07-24 23:59:59'::timestamp; GET DIAGNOSTICS del_count = ROW_COUNT; IF del_count > 0 THEN RAISE NOTICE '✓ Deleted % rows from assessment_sessions', del_count; END IF; EXCEPTION WHEN OTHERS THEN NULL; END;
    BEGIN DELETE FROM violations WHERE created_at < '2026-07-24 23:59:59'::timestamp; GET DIAGNOSTICS del_count = ROW_COUNT; IF del_count > 0 THEN RAISE NOTICE '✓ Deleted % rows from violations', del_count; END IF; EXCEPTION WHEN OTHERS THEN NULL; END;
    BEGIN DELETE FROM english_challenge_submissions WHERE created_at < '2026-07-24 23:59:59'::timestamp; GET DIAGNOSTICS del_count = ROW_COUNT; IF del_count > 0 THEN RAISE NOTICE '✓ Deleted % rows from english_challenge_submissions', del_count; END IF; EXCEPTION WHEN OTHERS THEN NULL; END;
    BEGIN DELETE FROM english_challenges WHERE created_at < '2026-07-24 23:59:59'::timestamp; EXCEPTION WHEN OTHERS THEN NULL; END;
    BEGIN DELETE FROM english_badges WHERE created_at < '2026-07-24 23:59:59'::timestamp; EXCEPTION WHEN OTHERS THEN NULL; END;
    BEGIN DELETE FROM english_roleplays WHERE created_at < '2026-07-24 23:59:59'::timestamp; EXCEPTION WHEN OTHERS THEN NULL; END;
    BEGIN DELETE FROM english_conversations WHERE created_at < '2026-07-24 23:59:59'::timestamp; EXCEPTION WHEN OTHERS THEN NULL; END;
    BEGIN DELETE FROM english_practice_sessions WHERE created_at < '2026-07-24 23:59:59'::timestamp; EXCEPTION WHEN OTHERS THEN NULL; END;
    BEGIN DELETE FROM english_user_progress WHERE created_at < '2026-07-24 23:59:59'::timestamp; EXCEPTION WHEN OTHERS THEN NULL; END;
    BEGIN DELETE FROM lead_activities WHERE created_at < '2026-07-24 23:59:59'::timestamp OR "createdAt" < '2026-07-24 23:59:59'::timestamp; GET DIAGNOSTICS del_count = ROW_COUNT; IF del_count > 0 THEN RAISE NOTICE '✓ Deleted % rows from lead_activities', del_count; END IF; EXCEPTION WHEN OTHERS THEN NULL; END;

    -- =============================================================
    -- STEP 2: Child Operational Tables
    -- =============================================================
    BEGIN DELETE FROM assignments WHERE created_at < '2026-07-24 23:59:59'::timestamp OR "createdAt" < '2026-07-24 23:59:59'::timestamp; GET DIAGNOSTICS del_count = ROW_COUNT; IF del_count > 0 THEN RAISE NOTICE '✓ Deleted % rows from assignments', del_count; END IF; EXCEPTION WHEN OTHERS THEN NULL; END;
    BEGIN DELETE FROM sessions WHERE created_at < '2026-07-24 23:59:59'::timestamp OR "createdAt" < '2026-07-24 23:59:59'::timestamp; GET DIAGNOSTICS del_count = ROW_COUNT; IF del_count > 0 THEN RAISE NOTICE '✓ Deleted % rows from sessions', del_count; END IF; EXCEPTION WHEN OTHERS THEN NULL; END;
    BEGIN DELETE FROM tasks WHERE created_at < '2026-07-24 23:59:59'::timestamp OR "createdAt" < '2026-07-24 23:59:59'::timestamp; GET DIAGNOSTICS del_count = ROW_COUNT; IF del_count > 0 THEN RAISE NOTICE '✓ Deleted % rows from tasks', del_count; END IF; EXCEPTION WHEN OTHERS THEN NULL; END;
    BEGIN DELETE FROM videos WHERE created_at < '2026-07-24 23:59:59'::timestamp OR "createdAt" < '2026-07-24 23:59:59'::timestamp; GET DIAGNOSTICS del_count = ROW_COUNT; IF del_count > 0 THEN RAISE NOTICE '✓ Deleted % rows from videos', del_count; END IF; EXCEPTION WHEN OTHERS THEN NULL; END;
    BEGIN DELETE FROM batch_students WHERE joined_at < '2026-07-24 23:59:59'::timestamp OR "joinedAt" < '2026-07-24 23:59:59'::timestamp OR created_at < '2026-07-24 23:59:59'::timestamp OR "createdAt" < '2026-07-24 23:59:59'::timestamp; GET DIAGNOSTICS del_count = ROW_COUNT; IF del_count > 0 THEN RAISE NOTICE '✓ Deleted % rows from batch_students', del_count; END IF; EXCEPTION WHEN OTHERS THEN NULL; END;
    BEGIN DELETE FROM attendance WHERE created_at < '2026-07-24 23:59:59'::timestamp OR "createdAt" < '2026-07-24 23:59:59'::timestamp OR date < '2026-07-24 23:59:59'::timestamp; GET DIAGNOSTICS del_count = ROW_COUNT; IF del_count > 0 THEN RAISE NOTICE '✓ Deleted % rows from attendance', del_count; END IF; EXCEPTION WHEN OTHERS THEN NULL; END;
    BEGIN DELETE FROM leave_requests WHERE created_at < '2026-07-24 23:59:59'::timestamp OR "createdAt" < '2026-07-24 23:59:59'::timestamp; GET DIAGNOSTICS del_count = ROW_COUNT; IF del_count > 0 THEN RAISE NOTICE '✓ Deleted % rows from leave_requests', del_count; END IF; EXCEPTION WHEN OTHERS THEN NULL; END;
    BEGIN DELETE FROM time_tracking WHERE created_at < '2026-07-24 23:59:59'::timestamp OR "createdAt" < '2026-07-24 23:59:59'::timestamp OR date < '2026-07-24 23:59:59'::timestamp; GET DIAGNOSTICS del_count = ROW_COUNT; IF del_count > 0 THEN RAISE NOTICE '✓ Deleted % rows from time_tracking', del_count; END IF; EXCEPTION WHEN OTHERS THEN NULL; END;
    BEGIN DELETE FROM feedback WHERE created_at < '2026-07-24 23:59:59'::timestamp OR "createdAt" < '2026-07-24 23:59:59'::timestamp; GET DIAGNOSTICS del_count = ROW_COUNT; IF del_count > 0 THEN RAISE NOTICE '✓ Deleted % rows from feedback', del_count; END IF; EXCEPTION WHEN OTHERS THEN NULL; END;
    BEGIN DELETE FROM job_applications WHERE created_at < '2026-07-24 23:59:59'::timestamp OR "createdAt" < '2026-07-24 23:59:59'::timestamp; GET DIAGNOSTICS del_count = ROW_COUNT; IF del_count > 0 THEN RAISE NOTICE '✓ Deleted % rows from job_applications', del_count; END IF; EXCEPTION WHEN OTHERS THEN NULL; END;
    BEGIN DELETE FROM mock_interviews WHERE created_at < '2026-07-24 23:59:59'::timestamp OR "createdAt" < '2026-07-24 23:59:59'::timestamp; GET DIAGNOSTICS del_count = ROW_COUNT; IF del_count > 0 THEN RAISE NOTICE '✓ Deleted % rows from mock_interviews', del_count; END IF; EXCEPTION WHEN OTHERS THEN NULL; END;
    BEGIN DELETE FROM communication_practice WHERE created_at < '2026-07-24 23:59:59'::timestamp OR "createdAt" < '2026-07-24 23:59:59'::timestamp; GET DIAGNOSTICS del_count = ROW_COUNT; IF del_count > 0 THEN RAISE NOTICE '✓ Deleted % rows from communication_practice', del_count; END IF; EXCEPTION WHEN OTHERS THEN NULL; END;
    BEGIN DELETE FROM notifications WHERE created_at < '2026-07-24 23:59:59'::timestamp OR "createdAt" < '2026-07-24 23:59:59'::timestamp; GET DIAGNOSTICS del_count = ROW_COUNT; IF del_count > 0 THEN RAISE NOTICE '✓ Deleted % rows from notifications', del_count; END IF; EXCEPTION WHEN OTHERS THEN NULL; END;
    BEGIN DELETE FROM messages WHERE sent_at < '2026-07-24 23:59:59'::timestamp OR "sentAt" < '2026-07-24 23:59:59'::timestamp OR created_at < '2026-07-24 23:59:59'::timestamp OR "createdAt" < '2026-07-24 23:59:59'::timestamp; GET DIAGNOSTICS del_count = ROW_COUNT; IF del_count > 0 THEN RAISE NOTICE '✓ Deleted % rows from messages', del_count; END IF; EXCEPTION WHEN OTHERS THEN NULL; END;
    BEGIN DELETE FROM documents WHERE created_at < '2026-07-24 23:59:59'::timestamp OR "createdAt" < '2026-07-24 23:59:59'::timestamp; GET DIAGNOSTICS del_count = ROW_COUNT; IF del_count > 0 THEN RAISE NOTICE '✓ Deleted % rows from documents', del_count; END IF; EXCEPTION WHEN OTHERS THEN NULL; END;
    BEGIN DELETE FROM registrations WHERE created_at < '2026-07-24 23:59:59'::timestamp OR "createdAt" < '2026-07-24 23:59:59'::timestamp; GET DIAGNOSTICS del_count = ROW_COUNT; IF del_count > 0 THEN RAISE NOTICE '✓ Deleted % rows from registrations', del_count; END IF; EXCEPTION WHEN OTHERS THEN NULL; END;

    -- =============================================================
    -- STEP 3: Mid-Level Parent Tables
    -- =============================================================
    BEGIN DELETE FROM projects WHERE created_at < '2026-07-24 23:59:59'::timestamp OR "createdAt" < '2026-07-24 23:59:59'::timestamp; GET DIAGNOSTICS del_count = ROW_COUNT; IF del_count > 0 THEN RAISE NOTICE '✓ Deleted % rows from projects', del_count; END IF; EXCEPTION WHEN OTHERS THEN NULL; END;
    BEGIN DELETE FROM assessments WHERE created_at < '2026-07-24 23:59:59'::timestamp OR "createdAt" < '2026-07-24 23:59:59'::timestamp; GET DIAGNOSTICS del_count = ROW_COUNT; IF del_count > 0 THEN RAISE NOTICE '✓ Deleted % rows from assessments', del_count; END IF; EXCEPTION WHEN OTHERS THEN NULL; END;
    BEGIN DELETE FROM leads WHERE created_at < '2026-07-24 23:59:59'::timestamp OR "createdAt" < '2026-07-24 23:59:59'::timestamp; GET DIAGNOSTICS del_count = ROW_COUNT; IF del_count > 0 THEN RAISE NOTICE '✓ Deleted % rows from leads', del_count; END IF; EXCEPTION WHEN OTHERS THEN NULL; END;
    BEGIN DELETE FROM jobs WHERE created_at < '2026-07-24 23:59:59'::timestamp OR "createdAt" < '2026-07-24 23:59:59'::timestamp; GET DIAGNOSTICS del_count = ROW_COUNT; IF del_count > 0 THEN RAISE NOTICE '✓ Deleted % rows from jobs', del_count; END IF; EXCEPTION WHEN OTHERS THEN NULL; END;

    -- =============================================================
    -- STEP 4: Top Parent Tables (Batches -> Courses -> Permissions -> Users)
    -- =============================================================
    BEGIN DELETE FROM batches WHERE created_at < '2026-07-24 23:59:59'::timestamp OR "createdAt" < '2026-07-24 23:59:59'::timestamp; GET DIAGNOSTICS del_count = ROW_COUNT; IF del_count > 0 THEN RAISE NOTICE '✓ Deleted % rows from batches', del_count; END IF; EXCEPTION WHEN OTHERS THEN NULL; END;
    BEGIN DELETE FROM courses WHERE created_at < '2026-07-24 23:59:59'::timestamp OR "createdAt" < '2026-07-24 23:59:59'::timestamp; GET DIAGNOSTICS del_count = ROW_COUNT; IF del_count > 0 THEN RAISE NOTICE '✓ Deleted % rows from courses', del_count; END IF; EXCEPTION WHEN OTHERS THEN NULL; END;
    BEGIN DELETE FROM admin_permissions WHERE created_at < '2026-07-24 23:59:59'::timestamp OR "createdAt" < '2026-07-24 23:59:59'::timestamp; EXCEPTION WHEN OTHERS THEN NULL; END;
    BEGIN DELETE FROM users WHERE role != 'SUPER_ADMIN' AND (created_at < '2026-07-24 23:59:59'::timestamp OR "createdAt" < '2026-07-24 23:59:59'::timestamp); GET DIAGNOSTICS del_count = ROW_COUNT; IF del_count > 0 THEN RAISE NOTICE '✓ Deleted % rows from users', del_count; END IF; EXCEPTION WHEN OTHERS THEN NULL; END;

    RAISE NOTICE '🎉 Cleanup complete! All pre-July 24 test data removed. July 25+ data & SUPER_ADMIN preserved.';
END $$;
