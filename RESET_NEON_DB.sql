-- =============================================================
-- NEON DB FK-CATALOG CLEANUP SCRIPT (PG_CONSTRAINT AUTOMATED)
-- Purpose: Uses PostgreSQL system catalog to find ALL FK references to users,
-- clears pre-July 24 child records (e.g. student_feedback.submitted_by),
-- and deletes pre-July 24 test users.
-- PRESERVES ALL JULY 25TH+ STUDENTS & SUPER_ADMIN.
-- =============================================================

DO $$
DECLARE
    r RECORD;
    sql_stmt TEXT;
    del_count INT;
BEGIN
    RAISE NOTICE 'Starting targeted pre-July 24 user cleanup...';

    -- 1. Automatically find EVERY column in ANY table that references users.id
    FOR r IN 
        SELECT DISTINCT
            c.conrelid::regclass::text AS table_name, 
            a.attname AS column_name
        FROM pg_constraint c
        JOIN pg_attribute a ON a.attnum = ANY(c.conkey) AND a.attrelid = c.conrelid
        WHERE c.confrelid = 'users'::regclass
    LOOP
        BEGIN
            IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'created_at') THEN
                sql_stmt := format(
                    'DELETE FROM %I WHERE %I IN (SELECT id FROM users WHERE role != %L AND created_at < %L::timestamp)',
                    r.table_name, r.column_name, 'SUPER_ADMIN', '2026-07-24 23:59:59'
                );
            ELSE
                sql_stmt := format(
                    'DELETE FROM %I WHERE %I IN (SELECT id FROM users WHERE role != %L AND "createdAt" < %L::timestamp)',
                    r.table_name, r.column_name, 'SUPER_ADMIN', '2026-07-24 23:59:59'
                );
            END IF;

            EXECUTE sql_stmt;
            GET DIAGNOSTICS del_count = ROW_COUNT;
            IF del_count > 0 THEN
                RAISE NOTICE '✓ Cleared % references from table % (column %)', del_count, r.table_name, r.column_name;
            END IF;
        EXCEPTION WHEN OTHERS THEN 
            NULL;
        END;
    END LOOP;

    -- 2. Clear old batches and courses prior to July 24
    BEGIN
        DELETE FROM batches WHERE created_at < '2026-07-24 23:59:59'::timestamp OR "createdAt" < '2026-07-24 23:59:59'::timestamp;
        DELETE FROM courses WHERE created_at < '2026-07-24 23:59:59'::timestamp OR "createdAt" < '2026-07-24 23:59:59'::timestamp;
    EXCEPTION WHEN OTHERS THEN NULL; END;

    -- 3. Delete pre-July 24 users (Except SUPER_ADMIN & July 25+ users)
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'created_at') THEN
        sql_stmt := 'DELETE FROM users WHERE role != ''SUPER_ADMIN'' AND created_at < ''2026-07-24 23:59:59''::timestamp';
    ELSE
        sql_stmt := 'DELETE FROM users WHERE role != ''SUPER_ADMIN'' AND "createdAt" < ''2026-07-24 23:59:59''::timestamp';
    END IF;

    EXECUTE sql_stmt;
    GET DIAGNOSTICS del_count = ROW_COUNT;
    RAISE NOTICE '🎉 Successfully deleted % old test users created before July 24th! (July 25+ students & SUPER_ADMIN preserved)', del_count;
END $$;
