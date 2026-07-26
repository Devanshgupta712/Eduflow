-- =============================================================
-- DYNAMIC NEON DB USER CLEANUP SCRIPT (AUTOMATED COLUMNS)
-- Purpose: Auto-detects user ID reference columns in all tables,
-- removes child references, and deletes pre-July 24 test users.
-- PRESERVES ALL JULY 25TH+ STUDENTS & SUPER_ADMIN.
-- =============================================================

DO $$
DECLARE
    r RECORD;
    sql_stmt TEXT;
    del_count INT;
BEGIN
    RAISE NOTICE 'Starting automated user cleanup...';

    -- 1. Dynamically clear child table references pointing to pre-July 24 users
    FOR r IN 
        SELECT table_name, column_name 
        FROM information_schema.columns 
        WHERE table_schema = 'public' 
          AND table_name != 'users'
          AND column_name IN ('user_id', 'userId', 'student_id', 'studentId', 'assigned_to_id', 'assignedToId', 'created_by_id', 'createdById', 'trainer_id', 'trainerId', 'sender_id', 'recipient_id')
    LOOP
        BEGIN
            -- Check if users table uses created_at vs "createdAt"
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
                RAISE NOTICE '✓ Cleared % user references from table % (column %)', del_count, r.table_name, r.column_name;
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

    -- 3. Delete pre-July 24 users
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'created_at') THEN
        sql_stmt := 'DELETE FROM users WHERE role != ''SUPER_ADMIN'' AND created_at < ''2026-07-24 23:59:59''::timestamp';
    ELSE
        sql_stmt := 'DELETE FROM users WHERE role != ''SUPER_ADMIN'' AND "createdAt" < ''2026-07-24 23:59:59''::timestamp';
    END IF;

    EXECUTE sql_stmt;
    GET DIAGNOSTICS del_count = ROW_COUNT;
    RAISE NOTICE '🎉 Successfully deleted % old test users created before July 24th!', del_count;
END $$;
