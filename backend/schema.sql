-- Skillora database schema

CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  name VARCHAR(120) NOT NULL,
  college_email VARCHAR(150) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role VARCHAR(20) NOT NULL DEFAULT 'student' CHECK (role IN ('student', 'client')),
  college VARCHAR(150),
  department VARCHAR(150),
  is_verified BOOLEAN DEFAULT FALSE,
  otp_code VARCHAR(6),
  otp_expires_at TIMESTAMP,
  otp_attempts INTEGER NOT NULL DEFAULT 0,
  otp_locked_until TIMESTAMP,
  otp_last_sent_at TIMESTAMP,
  github_url VARCHAR(255),
  bio TEXT,
  rating_avg NUMERIC(3,2) DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Canonical skill names live here (e.g. "react"). Raw text a user types
-- ("ReactJS", "React.js") is normalized to one of these before storage/matching.
CREATE TABLE IF NOT EXISTS skills (
  id SERIAL PRIMARY KEY,
  name VARCHAR(80) UNIQUE NOT NULL
);

CREATE TABLE IF NOT EXISTS user_skills (
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  skill_id INTEGER REFERENCES skills(id) ON DELETE CASCADE,
  proficiency INTEGER DEFAULT 50 CHECK (proficiency BETWEEN 0 AND 100),
  PRIMARY KEY (user_id, skill_id)
);

CREATE TABLE IF NOT EXISTS jobs (
  id SERIAL PRIMARY KEY,
  client_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  title VARCHAR(200) NOT NULL,
  description TEXT NOT NULL,
  budget NUMERIC(10,2) CHECK (budget IS NULL OR budget >= 0),
  status VARCHAR(20) NOT NULL DEFAULT 'open'
    CHECK (status IN ('open', 'in_progress', 'completed', 'cancelled')),
  required_skills TEXT[], -- normalized, extracted / tagged skill names
  team_size INTEGER DEFAULT 1 CHECK (team_size >= 1),
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS applications (
  id SERIAL PRIMARY KEY,
  job_id INTEGER REFERENCES jobs(id) ON DELETE CASCADE,
  student_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  match_score NUMERIC(5,2), -- computed skill match %
  status VARCHAR(20) NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'accepted', 'rejected', 'withdrawn', 'completed')),
  message TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(job_id, student_id)
);

CREATE TABLE IF NOT EXISTS reviews (
  id SERIAL PRIMARY KEY,
  job_id INTEGER REFERENCES jobs(id) ON DELETE CASCADE,
  reviewer_id INTEGER REFERENCES users(id),
  reviewee_id INTEGER REFERENCES users(id),
  rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  CHECK (reviewer_id <> reviewee_id),
  UNIQUE(job_id, reviewer_id, reviewee_id)
);
