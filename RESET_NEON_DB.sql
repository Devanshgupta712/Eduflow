-- =============================================================
-- NEON POSTGRESQL DATE-FILTERED CLEANUP SCRIPT (SNAKE_CASE + DYNAMIC)
-- Purpose: Safely deletes test data created BEFORE 24th July 2026.
-- PRESERVES ALL DATA CREATED ON OR AFTER 25TH JULY 2026 & SUPER_ADMIN.
-- =============================================================

-- OPTION A: Dynamic PL/pgSQL Script (Auto-detects column names)
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN 
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
          AND table_type = 'BASE TABLE'
    LOOP
        -- Check for created_at (snake_case)
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = r.table_name AND column_name = 'created_at') THEN
            IF r.table_name = 'users' THEN
                EXECUTE format('DELETE FROM %I WHERE role != %L AND created_at < %L::timestamp', r.table_name, 'SUPER_ADMIN', '2026-07-24');
            ELSE
                EXECUTE format('DELETE FROM %I WHERE created_at < %L::timestamp', r.table_name, '2026-07-24');
            END IF;
        -- Check for "createdAt" (camelCase)
        ELSIF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = r.table_name AND column_name = 'createdAt') THEN
            IF r.table_name = 'users' THEN
                EXECUTE format('DELETE FROM %I WHERE role != %L AND "createdAt" < %L::timestamp', r.table_name, 'SUPER_ADMIN', '2026-07-24');
            ELSE
                EXECUTE format('DELETE FROM %I WHERE "createdAt" < %L::timestamp', r.table_name, '2026-07-24');
            END IF;
        END IF;
    END LOOP;
END $$;

-- OPTION B: Explicit Static SQL Queries (snake_case)
BEGIN;

DELETE FROM lead_activities WHERE created_at < '2026-07-24'::timestamp;
DELETE FROM leads WHERE created_at < '2026-07-24'::timestamp;
DELETE FROM registrations WHERE created_at < '2026-07-24'::timestamp;
DELETE FROM documents WHERE created_at < '2026-07-24'::timestamp;
DELETE FROM attendance WHERE created_at < '2026-07-24'::timestamp OR date < '2026-07-24'::timestamp;
DELETE FROM leave_requests WHERE created_at < '2026-07-24'::timestamp;
DELETE FROM time_tracking WHERE created_at < '2026-07-24'::timestamp OR date < '2026-07-24'::timestamp;
DELETE FROM tasks WHERE created_at < '2026-07-24'::timestamp;
DELETE FROM projects WHERE created_at < '2026-07-24'::timestamp;
DELETE FROM videos WHERE created_at < '2026-07-24'::timestamp;
DELETE FROM assessment_submissions WHERE submitted_at < '2026-07-24'::timestamp;
DELETE FROM assessments WHERE created_at < '2026-07-24'::timestamp;
DELETE FROM feedback WHERE created_at < '2026-07-24'::timestamp;
DELETE FROM job_applications WHERE created_at < '2026-07-24'::timestamp;
DELETE FROM jobs WHERE created_at < '2026-07-24'::timestamp;
DELETE FROM mock_interviews WHERE created_at < '2026-07-24'::timestamp;
DELETE FROM communication_practice WHERE created_at < '2026-07-24'::timestamp;
DELETE FROM notifications WHERE created_at < '2026-07-24'::timestamp;
DELETE FROM messages WHERE sent_at < '2026-07-24'::timestamp;
DELETE FROM batch_students WHERE joined_at < '2026-07-24'::timestamp;
DELETE FROM batches WHERE created_at < '2026-07-24'::timestamp;
DELETE FROM courses WHERE created_at < '2026-07-24'::timestamp;
DELETE FROM users WHERE role != 'SUPER_ADMIN' AND created_at < '2026-07-24'::timestamp;

COMMIT;
