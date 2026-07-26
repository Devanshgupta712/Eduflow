-- =============================================================
-- NEON POSTGRESQL AUTOMATED DATE-FILTERED CLEANUP SCRIPT (2-PASS)
-- Purpose: Auto-detects date columns across all tables and deletes
-- test data created BEFORE 24th July 2026 23:59:59.
-- PRESERVES ALL DATA CREATED ON OR AFTER 25TH JULY 2026 & SUPER_ADMIN.
-- =============================================================

DO $$
DECLARE
    r RECORD;
    del_count INT;
    col_name TEXT;
    sql_stmt TEXT;
BEGIN
    RAISE NOTICE 'Starting automated database cleanup for data prior to 2026-07-24...';

    -- PASS 1: Delete from all child/operational tables first
    FOR r IN 
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
          AND table_type = 'BASE TABLE'
          AND table_name NOT IN ('users', 'courses', 'batches')
    LOOP
        -- Find date column for this table
        SELECT column_name INTO col_name
        FROM information_schema.columns 
        WHERE table_name = r.table_name 
          AND column_name IN ('createdAt', 'created_at', 'joinedAt', 'joined_at', 'submittedAt', 'submitted_at', 'sentAt', 'sent_at', 'date')
        LIMIT 1;

        IF col_name IS NOT NULL THEN
            sql_stmt := format('DELETE FROM %I WHERE %I < %L::timestamp', r.table_name, col_name, '2026-07-24 23:59:59');
            EXECUTE sql_stmt;
            GET DIAGNOSTICS del_count = ROW_COUNT;
            IF del_count > 0 THEN
                RAISE NOTICE '✓ Deleted % rows from table % (column %)', del_count, r.table_name, col_name;
            END IF;
        END IF;
    END LOOP;

    -- PASS 2: Delete from parent tables (batches -> courses -> users)
    FOR r IN 
        SELECT unnest(ARRAY['batches', 'courses', 'users']) AS table_name
    LOOP
        SELECT column_name INTO col_name
        FROM information_schema.columns 
        WHERE table_name = r.table_name 
          AND column_name IN ('createdAt', 'created_at', 'date')
        LIMIT 1;

        IF col_name IS NOT NULL THEN
            IF r.table_name = 'users' THEN
                sql_stmt := format('DELETE FROM %I WHERE role != %L AND %I < %L::timestamp', r.table_name, 'SUPER_ADMIN', col_name, '2026-07-24 23:59:59');
            ELSE
                sql_stmt := format('DELETE FROM %I WHERE %I < %L::timestamp', r.table_name, col_name, '2026-07-24 23:59:59');
            END IF;
            
            EXECUTE sql_stmt;
            GET DIAGNOSTICS del_count = ROW_COUNT;
            IF del_count > 0 THEN
                RAISE NOTICE '✓ Deleted % rows from parent table % (column %)', del_count, r.table_name, col_name;
            END IF;
        END IF;
    END LOOP;

    RAISE NOTICE '🎉 Cleanup complete! Pre-July 24 data removed. July 25+ data & SUPER_ADMIN preserved.';
END $$;
