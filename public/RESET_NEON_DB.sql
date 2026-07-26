-- =============================================================
-- SHORT & COMPACT NEON DB CLEANUP SCRIPT (NO TRUNCATION)
-- Purpose: Deletes test data & users created BEFORE 24th July 2026.
-- PRESERVES ALL DATA CREATED ON OR AFTER 25TH JULY 2026 & SUPER_ADMIN.
-- =============================================================

DO $$
BEGIN
    -- 1. Delete child records prior to July 24
    BEGIN DELETE FROM assignment_submissions WHERE created_at < '2026-07-24'::timestamp OR submitted_at < '2026-07-24'::timestamp; EXCEPTION WHEN OTHERS THEN NULL; END;
    BEGIN DELETE FROM assignments WHERE created_at < '2026-07-24'::timestamp; EXCEPTION WHEN OTHERS THEN NULL; END;
    BEGIN DELETE FROM sessions WHERE created_at < '2026-07-24'::timestamp; EXCEPTION WHEN OTHERS THEN NULL; END;
    BEGIN DELETE FROM batch_students WHERE joined_at < '2026-07-24'::timestamp OR created_at < '2026-07-24'::timestamp; EXCEPTION WHEN OTHERS THEN NULL; END;
    BEGIN DELETE FROM attendance WHERE created_at < '2026-07-24'::timestamp OR date < '2026-07-24'::timestamp; EXCEPTION WHEN OTHERS THEN NULL; END;
    BEGIN DELETE FROM leave_requests WHERE created_at < '2026-07-24'::timestamp; EXCEPTION WHEN OTHERS THEN NULL; END;
    BEGIN DELETE FROM time_tracking WHERE created_at < '2026-07-24'::timestamp OR date < '2026-07-24'::timestamp; EXCEPTION WHEN OTHERS THEN NULL; END;
    BEGIN DELETE FROM tasks WHERE created_at < '2026-07-24'::timestamp; EXCEPTION WHEN OTHERS THEN NULL; END;
    BEGIN DELETE FROM projects WHERE created_at < '2026-07-24'::timestamp; EXCEPTION WHEN OTHERS THEN NULL; END;
    BEGIN DELETE FROM registrations WHERE created_at < '2026-07-24'::timestamp; EXCEPTION WHEN OTHERS THEN NULL; END;
    BEGIN DELETE FROM leads WHERE created_at < '2026-07-24'::timestamp; EXCEPTION WHEN OTHERS THEN NULL; END;

    -- 2. Delete parent batches & courses prior to July 24
    BEGIN DELETE FROM batches WHERE created_at < '2026-07-24'::timestamp; EXCEPTION WHEN OTHERS THEN NULL; END;
    BEGIN DELETE FROM courses WHERE created_at < '2026-07-24'::timestamp; EXCEPTION WHEN OTHERS THEN NULL; END;

    -- 3. Delete users prior to July 24 (Except SUPER_ADMIN)
    BEGIN DELETE FROM users WHERE role != 'SUPER_ADMIN' AND created_at < '2026-07-24'::timestamp; EXCEPTION WHEN OTHERS THEN NULL; END;
END $$;
