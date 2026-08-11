-- Run this ONLY if you already created a database before OTP attempt
-- limiting/lockout/resend rate-limiting existed. If you're setting up
-- fresh, just run schema.sql instead — skip this file.

ALTER TABLE users ADD COLUMN IF NOT EXISTS otp_attempts INTEGER NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS otp_locked_until TIMESTAMP;
ALTER TABLE users ADD COLUMN IF NOT EXISTS otp_last_sent_at TIMESTAMP;
