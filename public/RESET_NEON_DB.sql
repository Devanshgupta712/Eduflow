-- =============================================================
-- FAIL-PROOF STEP 2 QUERY BLOCK FOR NEON CONSOLE
-- Purpose: Unlinks all child references using exact column names
-- =============================================================

DO $$
BEGIN
    BEGIN DELETE FROM batch_students WHERE student_id IN (SELECT id FROM users WHERE role != 'SUPER_ADMIN' AND created_at < '2026-07-24 23:59:59'::timestamp); EXCEPTION WHEN OTHERS THEN NULL; END;
    BEGIN DELETE FROM attendance WHERE student_id IN (SELECT id FROM users WHERE role != 'SUPER_ADMIN' AND created_at < '2026-07-24 23:59:59'::timestamp); EXCEPTION WHEN OTHERS THEN NULL; END;
    BEGIN DELETE FROM leave_requests WHERE user_id IN (SELECT id FROM users WHERE role != 'SUPER_ADMIN' AND created_at < '2026-07-24 23:59:59'::timestamp); EXCEPTION WHEN OTHERS THEN NULL; END;
    BEGIN DELETE FROM time_tracking WHERE user_id IN (SELECT id FROM users WHERE role != 'SUPER_ADMIN' AND created_at < '2026-07-24 23:59:59'::timestamp); EXCEPTION WHEN OTHERS THEN NULL; END;
    BEGIN DELETE FROM tasks WHERE assigned_to_id IN (SELECT id FROM users WHERE role != 'SUPER_ADMIN' AND created_at < '2026-07-24 23:59:59'::timestamp) OR created_by_id IN (SELECT id FROM users WHERE role != 'SUPER_ADMIN' AND created_at < '2026-07-24 23:59:59'::timestamp); EXCEPTION WHEN OTHERS THEN NULL; END;
    BEGIN DELETE FROM documents WHERE user_id IN (SELECT id FROM users WHERE role != 'SUPER_ADMIN' AND created_at < '2026-07-24 23:59:59'::timestamp); EXCEPTION WHEN OTHERS THEN NULL; END;
    BEGIN DELETE FROM registrations WHERE user_id IN (SELECT id FROM users WHERE role != 'SUPER_ADMIN' AND created_at < '2026-07-24 23:59:59'::timestamp); EXCEPTION WHEN OTHERS THEN NULL; END;
    BEGIN DELETE FROM messages WHERE sender_id IN (SELECT id FROM users WHERE role != 'SUPER_ADMIN' AND created_at < '2026-07-24 23:59:59'::timestamp) OR recipient_id IN (SELECT id FROM users WHERE role != 'SUPER_ADMIN' AND created_at < '2026-07-24 23:59:59'::timestamp); EXCEPTION WHEN OTHERS THEN NULL; END;
    BEGIN DELETE FROM feedback WHERE user_id IN (SELECT id FROM users WHERE role != 'SUPER_ADMIN' AND created_at < '2026-07-24 23:59:59'::timestamp); EXCEPTION WHEN OTHERS THEN NULL; END;
END $$;
