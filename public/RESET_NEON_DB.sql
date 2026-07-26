-- =============================================================
-- STEP-BY-STEP NEON DB CLEANUP GUIDE (RUN ONE BY ONE)
-- Purpose: Safely deletes test data created BEFORE 24th July 2026.
-- PRESERVES ALL JULY 25TH+ STUDENTS & SUPER_ADMIN.
-- =============================================================

-- STEP 1: Clear all notifications
DELETE FROM notifications 
WHERE created_at < '2026-07-24 23:59:59'::timestamp OR "createdAt" < '2026-07-24 23:59:59'::timestamp;

-- STEP 2: Clear all child table references for pre-July 24 users
DELETE FROM batch_students WHERE user_id IN (SELECT id FROM users WHERE role != 'SUPER_ADMIN' AND (created_at < '2026-07-24 23:59:59'::timestamp OR "createdAt" < '2026-07-24 23:59:59'::timestamp)) OR student_id IN (SELECT id FROM users WHERE role != 'SUPER_ADMIN' AND (created_at < '2026-07-24 23:59:59'::timestamp OR "createdAt" < '2026-07-24 23:59:59'::timestamp));
DELETE FROM attendance WHERE user_id IN (SELECT id FROM users WHERE role != 'SUPER_ADMIN' AND (created_at < '2026-07-24 23:59:59'::timestamp OR "createdAt" < '2026-07-24 23:59:59'::timestamp)) OR student_id IN (SELECT id FROM users WHERE role != 'SUPER_ADMIN' AND (created_at < '2026-07-24 23:59:59'::timestamp OR "createdAt" < '2026-07-24 23:59:59'::timestamp));
DELETE FROM leave_requests WHERE user_id IN (SELECT id FROM users WHERE role != 'SUPER_ADMIN' AND (created_at < '2026-07-24 23:59:59'::timestamp OR "createdAt" < '2026-07-24 23:59:59'::timestamp));
DELETE FROM time_tracking WHERE user_id IN (SELECT id FROM users WHERE role != 'SUPER_ADMIN' AND (created_at < '2026-07-24 23:59:59'::timestamp OR "createdAt" < '2026-07-24 23:59:59'::timestamp));
DELETE FROM tasks WHERE user_id IN (SELECT id FROM users WHERE role != 'SUPER_ADMIN' AND (created_at < '2026-07-24 23:59:59'::timestamp OR "createdAt" < '2026-07-24 23:59:59'::timestamp));
DELETE FROM documents WHERE user_id IN (SELECT id FROM users WHERE role != 'SUPER_ADMIN' AND (created_at < '2026-07-24 23:59:59'::timestamp OR "createdAt" < '2026-07-24 23:59:59'::timestamp));
DELETE FROM registrations WHERE user_id IN (SELECT id FROM users WHERE role != 'SUPER_ADMIN' AND (created_at < '2026-07-24 23:59:59'::timestamp OR "createdAt" < '2026-07-24 23:59:59'::timestamp));
DELETE FROM messages WHERE sender_id IN (SELECT id FROM users WHERE role != 'SUPER_ADMIN' AND (created_at < '2026-07-24 23:59:59'::timestamp OR "createdAt" < '2026-07-24 23:59:59'::timestamp)) OR recipient_id IN (SELECT id FROM users WHERE role != 'SUPER_ADMIN' AND (created_at < '2026-07-24 23:59:59'::timestamp OR "createdAt" < '2026-07-24 23:59:59'::timestamp));
DELETE FROM feedback WHERE user_id IN (SELECT id FROM users WHERE role != 'SUPER_ADMIN' AND (created_at < '2026-07-24 23:59:59'::timestamp OR "createdAt" < '2026-07-24 23:59:59'::timestamp));

-- STEP 3: Delete pre-July 24 Users (Except SUPER_ADMIN & July 25+ Students)
DELETE FROM users 
WHERE role != 'SUPER_ADMIN' 
  AND (created_at < '2026-07-24 23:59:59'::timestamp OR "createdAt" < '2026-07-24 23:59:59'::timestamp);

-- STEP 4: Delete pre-July 24 Batches
DELETE FROM batches 
WHERE created_at < '2026-07-24 23:59:59'::timestamp OR "createdAt" < '2026-07-24 23:59:59'::timestamp;

-- STEP 5: Delete pre-July 24 Courses
DELETE FROM courses 
WHERE created_at < '2026-07-24 23:59:59'::timestamp OR "createdAt" < '2026-07-24 23:59:59'::timestamp;
