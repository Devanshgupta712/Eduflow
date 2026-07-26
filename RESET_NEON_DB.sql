-- =============================================================
-- NEON POSTGRESQL DATE-FILTERED CLEANUP SCRIPT (FIXED FOR NEON)
-- Purpose: Safely deletes test data created BEFORE 24th July 2026.
-- PRESERVES ALL DATA CREATED ON OR AFTER 25TH JULY 2026 & SUPER_ADMIN.
-- =============================================================

BEGIN;

-- 1. Marketing & Leads
DELETE FROM lead_activities WHERE "createdAt" < '2026-07-24'::timestamp;
DELETE FROM leads WHERE "createdAt" < '2026-07-24'::timestamp;

-- 2. Finance & Admissions
DELETE FROM registrations WHERE "createdAt" < '2026-07-24'::timestamp;
DELETE FROM documents WHERE "createdAt" < '2026-07-24'::timestamp;

-- 3. Operations, Attendance & Leaves
DELETE FROM attendance WHERE "createdAt" < '2026-07-24'::timestamp OR date < '2026-07-24'::timestamp;
DELETE FROM leave_requests WHERE "createdAt" < '2026-07-24'::timestamp;
DELETE FROM time_tracking WHERE "createdAt" < '2026-07-24'::timestamp OR date < '2026-07-24'::timestamp;

-- 4. Projects & Tasks
DELETE FROM tasks WHERE "createdAt" < '2026-07-24'::timestamp;
DELETE FROM projects WHERE "createdAt" < '2026-07-24'::timestamp;
DELETE FROM videos WHERE "createdAt" < '2026-07-24'::timestamp;

-- 5. Exams & Feedback
DELETE FROM assessment_submissions WHERE "submittedAt" < '2026-07-24'::timestamp;
DELETE FROM assessments WHERE "createdAt" < '2026-07-24'::timestamp;
DELETE FROM feedback WHERE "createdAt" < '2026-07-24'::timestamp;

-- 6. Jobs & Placement
DELETE FROM job_applications WHERE "createdAt" < '2026-07-24'::timestamp;
DELETE FROM jobs WHERE "createdAt" < '2026-07-24'::timestamp;
DELETE FROM mock_interviews WHERE "createdAt" < '2026-07-24'::timestamp;
DELETE FROM communication_practice WHERE "createdAt" < '2026-07-24'::timestamp;

-- 7. System & Notifications
DELETE FROM notifications WHERE "createdAt" < '2026-07-24'::timestamp;
DELETE FROM messages WHERE "sentAt" < '2026-07-24'::timestamp;

-- 8. Batches & Courses
DELETE FROM batch_students WHERE "joinedAt" < '2026-07-24'::timestamp;
DELETE FROM batches WHERE "createdAt" < '2026-07-24'::timestamp;
DELETE FROM courses WHERE "createdAt" < '2026-07-24'::timestamp;

-- 9. Users (Preserves SUPER_ADMIN & Users registered 25th July onwards)
DELETE FROM users WHERE role != 'SUPER_ADMIN' AND "createdAt" < '2026-07-24'::timestamp;

COMMIT;
