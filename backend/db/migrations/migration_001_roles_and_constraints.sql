-- Run this ONLY if you already created a database with the old schema
-- (before roles, review uniqueness, and the extra status values existed).
-- If you're setting up fresh, just run schema.sql instead — skip this file.

ALTER TABLE users ADD COLUMN IF NOT EXISTS role VARCHAR(20) NOT NULL DEFAULT 'student';
ALTER TABLE users ADD CONSTRAINT users_role_check CHECK (role IN ('student', 'client'));

ALTER TABLE user_skills ADD CONSTRAINT user_skills_proficiency_check CHECK (proficiency BETWEEN 0 AND 100);

ALTER TABLE jobs ADD CONSTRAINT jobs_budget_check CHECK (budget IS NULL OR budget >= 0);
ALTER TABLE jobs ADD CONSTRAINT jobs_team_size_check CHECK (team_size >= 1);

ALTER TABLE applications DROP CONSTRAINT IF EXISTS applications_status_check;
ALTER TABLE applications ADD CONSTRAINT applications_status_check
  CHECK (status IN ('pending', 'accepted', 'rejected', 'withdrawn', 'completed'));

ALTER TABLE reviews ADD CONSTRAINT reviews_no_self_review CHECK (reviewer_id <> reviewee_id);
ALTER TABLE reviews ADD CONSTRAINT reviews_unique_per_job UNIQUE (job_id, reviewer_id, reviewee_id);

-- If you had test data with client_id = student_id relationships that violate
-- the new checks, clean those rows up before running this script.
