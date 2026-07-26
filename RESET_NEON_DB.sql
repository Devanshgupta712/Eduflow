-- =============================================================
-- NEON POSTGRESQL DATE-FILTERED CLEANUP SCRIPT
-- Purpose: Deletes ONLY test data created BEFORE 24th July 2026.
-- PRESERVES ALL DATA CREATED ON OR AFTER 25TH JULY 2026 & SUPER_ADMIN.
-- =============================================================

BEGIN;

-- 1. Delete transactional & operational records created BEFORE 24th July 2026
DELETE FROM lead_activities WHERE "createdAt" < '2026-07-24';
DELETE FROM leads WHERE "createdAt" < '2026-07-24';
DELETE FROM registrations WHERE "createdAt" < '2026-07-24';
DELETE FROM documents WHERE "createdAt" < '2026-07-24';
DELETE FROM attendance WHERE "createdAt" < '2026-07-24' OR date < '2026-07-24';
DELETE FROM leave_requests WHERE "createdAt" < '2026-07-24';
DELETE FROM time_tracking WHERE "createdAt" < '2026-07-24' OR date < '2026-07-24';
DELETE FROM tasks WHERE "createdAt" < '2026-07-24';
DELETE FROM projects WHERE "createdAt" < '2026-07-24';
DELETE FROM videos WHERE "createdAt" < '2026-07-24';
DELETE FROM assessment_submissions WHERE "submittedAt" < '2026-07-24';
DELETE FROM assessments WHERE "createdAt" < '2026-07-24';
DELETE FROM feedback WHERE "createdAt" < '2026-07-24';
DELETE FROM job_applications WHERE "createdAt" < '2026-07-24';
DELETE FROM jobs WHERE "createdAt" < '2026-07-24';
DELETE FROM mock_interviews WHERE "createdAt" < '2026-07-24';
DELETE FROM communication_practice WHERE "createdAt" < '2026-07-24';
DELETE FROM notifications WHERE "createdAt" < '2026-07-24';
DELETE FROM messages WHERE "sentAt" < '2026-07-24';
DELETE FROM batch_students WHERE "joinedAt" < '2026-07-24';
DELETE FROM batches WHERE "createdAt" < '2026-07-24';
DELETE FROM courses WHERE "createdAt" < '2026-07-24';

-- 2. Delete users created BEFORE 24th July 2026 (Except SUPER_ADMIN)
DELETE FROM users WHERE role != 'SUPER_ADMIN' AND "createdAt" < '2026-07-24';

COMMIT;

-- Verification summary of preserved data
SELECT 'Preserved Users (25th July onwards)' AS metric, COUNT(*) AS total FROM users WHERE "createdAt" >= '2026-07-25' OR role = 'SUPER_ADMIN'
UNION ALL SELECT 'Preserved Registrations (25th July onwards)', COUNT(*) FROM registrations WHERE "createdAt" >= '2026-07-25'
UNION ALL SELECT 'Preserved Batches (25th July onwards)', COUNT(*) FROM batches WHERE "createdAt" >= '2026-07-25'
UNION ALL SELECT 'Preserved Courses (25th July onwards)', COUNT(*) FROM courses WHERE "createdAt" >= '2026-07-25';
