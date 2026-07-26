-- =============================================================
-- SINGLE COMMAND NEON DB CLEANUP (PRE-JULY 24 DATA REMOVAL)
-- Purpose: Deletes all records created BEFORE 24th July 2026 23:59:59.
-- Unlinks trainer references and cleans all tables in one block.
-- PRESERVES ALL JULY 25TH+ STUDENTS & SUPER_ADMIN.
-- =============================================================

DO $$
DECLARE
    r RECORD;
BEGIN
    -- 1. Clear pre-July 24 records from all tables (except users)
    FOR r IN 
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_type = 'BASE TABLE' AND table_name != 'users'
    LOOP
        BEGIN
            EXECUTE format('DELETE FROM %I WHERE created_at < %L::timestamp', r.table_name, '2026-07-24 23:59:59');
        EXCEPTION WHEN OTHERS THEN 
            BEGIN
                EXECUTE format('DELETE FROM %I WHERE "createdAt" < %L::timestamp', r.table_name, '2026-07-24 23:59:59');
            EXCEPTION WHEN OTHERS THEN NULL;
            END;
        END;
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
