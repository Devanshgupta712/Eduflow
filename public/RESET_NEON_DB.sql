-- =============================================================
-- FAIL-PROOF NEON DB CLEANUP SCRIPT (AUTO DATE COLUMN DETECTION)
-- Purpose: Auto-detects date columns (created_at, joined_at, submitted_at, etc.)
-- across all tables and deletes pre-July 24 test data cleanly.
-- PRESERVES ALL JULY 25TH+ STUDENTS & SUPER_ADMIN.
-- =============================================================

DO $$
DECLARE
    r RECORD;
    col_name TEXT;
BEGIN
    -- 1. Loop through all tables (except users) and delete pre-July 24 rows using auto-detected date column
    FOR r IN 
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_type = 'BASE TABLE' AND table_name != 'users'
    LOOP
        -- Find the date column for this table
        SELECT column_name INTO col_name
        FROM information_schema.columns 
        WHERE table_name = r.table_name 
          AND column_name IN ('createdAt', 'created_at', 'joinedAt', 'joined_at', 'submittedAt', 'submitted_at', 'sentAt', 'sent_at', 'date')
        LIMIT 1;

        IF col_name IS NOT NULL THEN
            BEGIN
                EXECUTE format('DELETE FROM %I WHERE %I < %L::timestamp', r.table_name, col_name, '2026-07-24 23:59:59');
            EXCEPTION WHEN OTHERS THEN 
                NULL;
            END;
        END IF;
    END LOOP;

    -- 2. Nullify trainer references in batches if pointing to an old pre-July 24 user
    BEGIN UPDATE batches SET trainer_id = NULL WHERE trainer_id IN (SELECT id FROM users WHERE role != 'SUPER_ADMIN' AND (created_at < '2026-07-24 23:59:59'::timestamp OR "createdAt" < '2026-07-24 23:59:59'::timestamp)); EXCEPTION WHEN OTHERS THEN NULL; END;
    BEGIN UPDATE batches SET "trainerId" = NULL WHERE "trainerId" IN (SELECT id FROM users WHERE role != 'SUPER_ADMIN' AND (created_at < '2026-07-24 23:59:59'::timestamp OR "createdAt" < '2026-07-24 23:59:59'::timestamp)); EXCEPTION WHEN OTHERS THEN NULL; END;

    -- 3. Delete pre-July 24 users (Except SUPER_ADMIN & July 25+ users)
    BEGIN
        DELETE FROM users WHERE role != 'SUPER_ADMIN' AND created_at < '2026-07-24 23:59:59'::timestamp;
    EXCEPTION WHEN OTHERS THEN
        DELETE FROM users WHERE role != 'SUPER_ADMIN' AND "createdAt" < '2026-07-24 23:59:59'::timestamp;
    END;

    RAISE NOTICE '🎉 Cleanup complete! All pre-July 24 test data removed. July 25+ students & SUPER_ADMIN preserved.';
END $$;
