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
