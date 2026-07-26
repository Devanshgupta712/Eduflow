-- =============================================================
-- NEON DB CLEANUP SCRIPT: TARGETED PRE-JULY 24 USER DELETION
-- Purpose: Clears all child table references of pre-July 24 users
-- and deletes old test users created in April/May/June 2026.
-- PRESERVES ALL JULY 25TH+ STUDENTS & SUPER_ADMIN.
-- =============================================================

BEGIN;

-- 1. Clear child table references pointing to pre-July 24 users
DELETE FROM batch_students 
WHERE user_id IN (SELECT id FROM users WHERE role != 'SUPER_ADMIN' AND created_at < '2026-07-24'::timestamp)
   OR student_id IN (SELECT id FROM users WHERE role != 'SUPER_ADMIN' AND created_at < '2026-07-24'::timestamp);

DELETE FROM attendance 
WHERE user_id IN (SELECT id FROM users WHERE role != 'SUPER_ADMIN' AND created_at < '2026-07-24'::timestamp)
   OR student_id IN (SELECT id FROM users WHERE role != 'SUPER_ADMIN' AND created_at < '2026-07-24'::timestamp);

DELETE FROM leave_requests 
WHERE user_id IN (SELECT id FROM users WHERE role != 'SUPER_ADMIN' AND created_at < '2026-07-24'::timestamp);

DELETE FROM time_tracking 
WHERE user_id IN (SELECT id FROM users WHERE role != 'SUPER_ADMIN' AND created_at < '2026-07-24'::timestamp);

DELETE FROM tasks 
WHERE user_id IN (SELECT id FROM users WHERE role != 'SUPER_ADMIN' AND created_at < '2026-07-24'::timestamp)
   OR assigned_to_id IN (SELECT id FROM users WHERE role != 'SUPER_ADMIN' AND created_at < '2026-07-24'::timestamp);

DELETE FROM documents 
WHERE user_id IN (SELECT id FROM users WHERE role != 'SUPER_ADMIN' AND created_at < '2026-07-24'::timestamp);

DELETE FROM registrations 
WHERE user_id IN (SELECT id FROM users WHERE role != 'SUPER_ADMIN' AND created_at < '2026-07-24'::timestamp);

DELETE FROM job_applications 
WHERE user_id IN (SELECT id FROM users WHERE role != 'SUPER_ADMIN' AND created_at < '2026-07-24'::timestamp)
   OR student_id IN (SELECT id FROM users WHERE role != 'SUPER_ADMIN' AND created_at < '2026-07-24'::timestamp);

DELETE FROM mock_interviews 
WHERE user_id IN (SELECT id FROM users WHERE role != 'SUPER_ADMIN' AND created_at < '2026-07-24'::timestamp)
   OR student_id IN (SELECT id FROM users WHERE role != 'SUPER_ADMIN' AND created_at < '2026-07-24'::timestamp);

DELETE FROM communication_practice 
WHERE user_id IN (SELECT id FROM users WHERE role != 'SUPER_ADMIN' AND created_at < '2026-07-24'::timestamp);

DELETE FROM notifications 
WHERE user_id IN (SELECT id FROM users WHERE role != 'SUPER_ADMIN' AND created_at < '2026-07-24'::timestamp);

DELETE FROM messages 
WHERE sender_id IN (SELECT id FROM users WHERE role != 'SUPER_ADMIN' AND created_at < '2026-07-24'::timestamp)
   OR recipient_id IN (SELECT id FROM users WHERE role != 'SUPER_ADMIN' AND created_at < '2026-07-24'::timestamp);

DELETE FROM feedback 
WHERE user_id IN (SELECT id FROM users WHERE role != 'SUPER_ADMIN' AND created_at < '2026-07-24'::timestamp);

DELETE FROM lead_activities 
WHERE user_id IN (SELECT id FROM users WHERE role != 'SUPER_ADMIN' AND created_at < '2026-07-24'::timestamp);

DELETE FROM admin_permissions 
WHERE user_id IN (SELECT id FROM users WHERE role != 'SUPER_ADMIN' AND created_at < '2026-07-24'::timestamp);

-- 2. Clear old batches & courses created prior to July 24
DELETE FROM batches WHERE created_at < '2026-07-24'::timestamp;
DELETE FROM courses WHERE created_at < '2026-07-24'::timestamp;

-- 3. Delete pre-July 24 users
DELETE FROM users WHERE role != 'SUPER_ADMIN' AND created_at < '2026-07-24'::timestamp;

COMMIT;

-- 4. Show remaining user counts
SELECT role, COUNT(*) AS total_count 
FROM users 
GROUP BY role;
