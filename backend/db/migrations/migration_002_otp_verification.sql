-- Run this ONLY if you already created a database before OTP/email
-- verification existed. If you're setting up fresh, just run schema.sql
-- instead — skip this file.

ALTER TABLE users ADD COLUMN IF NOT EXISTS otp_code VARCHAR(6);
ALTER TABLE users ADD COLUMN IF NOT EXISTS otp_expires_at TIMESTAMP;
