-- =============================================================
-- NEON POSTGRESQL DATABASE RESET SCRIPT
-- Purpose: Wipes all test data created before 24th July 2026.
-- Retains only the SUPER_ADMIN account.
-- =============================================================

BEGIN;

-- Disable triggers / foreign key restrictions during truncate
SET session_replication_role = 'replica';

-- 1. Truncate all data tables
TRUNCATE TABLE 
    admin_permissions,
    assessment_submissions,
    assessments,
    attendance,
    batch_students,
    batches,
    communication_practice,
    courses,
    documents,
    feedback,
    job_applications,
    jobs,
    lead_activities,
    leads,
    leave_requests,
    messages,
    mock_interviews,
    notifications,
    projects,
    registrations,
    tasks,
    time_tracking,
    videos
RESTART IDENTITY CASCADE;

-- 2. Clean users table: remove all users except SUPER_ADMIN
DELETE FROM users WHERE role != 'SUPER_ADMIN';

-- 3. Ensure default SUPER_ADMIN user exists
INSERT INTO users (id, email, password, name, phone, role, "isActive", "createdAt", "updatedAt")
SELECT 
    'f307c945-d736-4b98-883a-840dc2ff17ff', 
    'admin@apptech.com', 
    '$2b$12$EixZaYVK1fsbw1ZfbX3OXePaWxn96p36WQoeg6Lruj3vjPGga31lW', -- admin123
    'Super Admin', 
    '9000000001', 
    'SUPER_ADMIN', 
    true, 
    NOW(), 
    NOW()
WHERE NOT EXISTS (SELECT 1 FROM users WHERE role = 'SUPER_ADMIN');

-- Re-enable foreign key constraints
SET session_replication_role = 'DEFAULT';

COMMIT;

-- Verification
SELECT table_name, row_count FROM (
    SELECT 'users' AS table_name, COUNT(*) AS row_count FROM users
    UNION ALL SELECT 'courses', COUNT(*) FROM courses
    UNION ALL SELECT 'batches', COUNT(*) FROM batches
    UNION ALL SELECT 'registrations', COUNT(*) FROM registrations
    UNION ALL SELECT 'leads', COUNT(*) FROM leads
) summary;
