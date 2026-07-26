-- =============================================================
-- NEON POSTGRESQL DATE-FILTERED CLEANUP SCRIPT (NEON COMPATIBLE)
-- Purpose: Deletes test data created BEFORE 24th July 2026 in strict
-- dependency order (No superuser / session_replication_role required).
-- PRESERVES ALL DATA CREATED ON OR AFTER 25TH JULY 2026 & SUPER_ADMIN.
-- =============================================================

BEGIN;

-- STEP 1: Delete Leaf / Child Tables (Tables pointing to Batches, Projects, Users)
DELETE FROM lead_activities WHERE created_at < '2026-07-24'::timestamp;
DELETE FROM batch_students WHERE joined_at < '2026-07-24'::timestamp;
DELETE FROM attendance WHERE created_at < '2026-07-24'::timestamp OR date < '2026-07-24'::timestamp;
DELETE FROM leave_requests WHERE created_at < '2026-07-24'::timestamp;
DELETE FROM time_tracking WHERE created_at < '2026-07-24'::timestamp OR date < '2026-07-24'::timestamp;
DELETE FROM tasks WHERE created_at < '2026-07-24'::timestamp;
DELETE FROM videos WHERE created_at < '2026-07-24'::timestamp;
DELETE FROM assessment_submissions WHERE submitted_at < '2026-07-24'::timestamp;
DELETE FROM feedback WHERE created_at < '2026-07-24'::timestamp;
DELETE FROM job_applications WHERE created_at < '2026-07-24'::timestamp;
DELETE FROM mock_interviews WHERE created_at < '2026-07-24'::timestamp;
DELETE FROM communication_practice WHERE created_at < '2026-07-24'::timestamp;
DELETE FROM notifications WHERE created_at < '2026-07-24'::timestamp;
DELETE FROM messages WHERE sent_at < '2026-07-24'::timestamp;
DELETE FROM documents WHERE created_at < '2026-07-24'::timestamp;
DELETE FROM registrations WHERE created_at < '2026-07-24'::timestamp;

-- STEP 2: Delete Mid-Level Tables (Projects, Assessments, Leads, Jobs)
DELETE FROM projects WHERE created_at < '2026-07-24'::timestamp;
DELETE FROM assessments WHERE created_at < '2026-07-24'::timestamp;
DELETE FROM leads WHERE created_at < '2026-07-24'::timestamp;
DELETE FROM jobs WHERE created_at < '2026-07-24'::timestamp;

-- STEP 3: Delete Parent Tables (Batches, Courses, Permissions & Users)
DELETE FROM batches WHERE created_at < '2026-07-24'::timestamp;
DELETE FROM courses WHERE created_at < '2026-07-24'::timestamp;
DELETE FROM admin_permissions WHERE created_at < '2026-07-24'::timestamp;
DELETE FROM users WHERE role != 'SUPER_ADMIN' AND created_at < '2026-07-24'::timestamp;

COMMIT;
