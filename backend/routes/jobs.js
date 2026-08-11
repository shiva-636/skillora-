const express = require('express');
const pool = require('../config/db');
const { requireAuth, requireRole } = require('../middleware/auth');
const { rankCandidatesForJob, extractSkillsFromDescription, scoreStudentForJob } = require('../services/matching');
const { normalizeSkillList } = require('../services/skillNormalize');

const router = express.Router();

function validateJobInput({ title, description, budget, team_size }) {
  if (!title || title.trim().length < 3 || title.length > 200) {
    return 'Title must be between 3 and 200 characters';
  }
  if (!description || description.trim().length < 10) {
    return 'Description must be at least 10 characters';
  }
  if (budget !== undefined && budget !== null && budget !== '') {
    const b = Number(budget);
    if (Number.isNaN(b) || b < 0) return 'Budget must be a non-negative number';
  }
  if (team_size !== undefined && team_size !== null && team_size !== '') {
    const t = Number(team_size);
    if (!Number.isInteger(t) || t < 1) return 'Team size must be a positive whole number';
  }
  return null;
}

// Only clients post jobs.
router.post('/', requireAuth, requireRole('client'), async (req, res) => {
  const { title, description, budget, required_skills, team_size } = req.body;

  const validationError = validateJobInput({ title, description, budget, team_size });
  if (validationError) return res.status(400).json({ error: validationError });

  // Normalize whatever the client sends (e.g. "ReactJS", "NodeJS") so it
  // matches the canonical skill vocabulary used everywhere else.
  const skills = required_skills && required_skills.length
    ? normalizeSkillList(required_skills)
    : extractSkillsFromDescription(description);

  try {
    const result = await pool.query(
      `INSERT INTO jobs (client_id, title, description, budget, required_skills, team_size)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [req.user.id, title.trim(), description.trim(), budget || null, skills, team_size || 1]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create job' });
  }
});

// Paginated list with skill/status/college/department filters.
router.get('/', async (req, res) => {
  const { college, department, skill, status } = req.query;
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 20));
  const offset = (page - 1) * limit;

  const conditions = [];
  const values = [];
  let joinClients = false;

  if (status) { values.push(status); conditions.push(`j.status = $${values.length}`); }
  if (skill) { values.push(skill); conditions.push(`$${values.length} = ANY(j.required_skills)`); }
  if (college) { joinClients = true; values.push(college); conditions.push(`c.college = $${values.length}`); }
  if (department) { joinClients = true; values.push(department); conditions.push(`c.department = $${values.length}`); }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const join = joinClients ? 'JOIN users c ON c.id = j.client_id' : '';

  values.push(limit, offset);
  try {
    const result = await pool.query(
      `SELECT j.* FROM jobs j ${join} ${where}
       ORDER BY j.created_at DESC LIMIT $${values.length - 1} OFFSET $${values.length}`,
      values
    );
    res.json({ jobs: result.rows, page, limit });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch jobs' });
  }
});

// A client's own jobs with application counts (used by the client dashboard).
// Declared before /:id so "mine" isn't swallowed as an :id param.
router.get('/mine', requireAuth, requireRole('client'), async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT j.*,
         (SELECT COUNT(*) FROM applications a WHERE a.job_id = j.id) AS application_count
       FROM jobs j WHERE j.client_id = $1 ORDER BY j.created_at DESC`,
      [req.user.id]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch your jobs' });
  }
});

// Open jobs ranked by fit for the calling student, using the same scoring
// formula as the client-side "matches" view. Skips jobs the student already
// has a non-pending relationship with, same exclusion rule as
// rankCandidatesForJob. Declared before /:id so "recommended" isn't
// swallowed as an :id param.
router.get('/recommended', requireAuth, requireRole('student'), async (req, res) => {
  try {
    const limit = Math.min(20, Math.max(1, parseInt(req.query.limit, 10) || 6));
    const openJobsRes = await pool.query(
      `SELECT id FROM jobs
       WHERE status = 'open'
         AND id NOT IN (
           SELECT job_id FROM applications
           WHERE student_id = $1 AND status IN ('pending', 'accepted', 'rejected', 'withdrawn', 'completed')
         )
       ORDER BY created_at DESC
       LIMIT 100`,
      [req.user.id]
    );

    const scored = await Promise.all(
      openJobsRes.rows.map(async ({ id }) => {
        const jobRes = await pool.query('SELECT * FROM jobs WHERE id = $1', [id]);
        const job = jobRes.rows[0];
        const scoreInfo = await scoreStudentForJob(id, req.user.id);
        return { ...job, match_score: scoreInfo?.matchScore ?? 0 };
      })
    );

    scored.sort((a, b) => b.match_score - a.match_score);
    res.json(scored.slice(0, limit));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch recommended jobs' });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM jobs WHERE id = $1', [req.params.id]);
    if (!result.rows[0]) return res.status(404).json({ error: 'Job not found' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch job' });
  }
});

// Job status transitions — owner only. Previously nothing in the app ever
// moved a job out of 'open', so jobs kept accepting applications forever
// even after being staffed/finished. Mirrors the applications.js pattern:
// explicit allow-list, anything not listed is rejected.
const JOB_ALLOWED_TRANSITIONS = {
  open: ['in_progress', 'cancelled'],
  in_progress: ['completed', 'cancelled'],
  completed: [],
  cancelled: [],
};

router.patch('/:id/status', requireAuth, requireRole('client'), async (req, res) => {
  const { status } = req.body;
  if (!['in_progress', 'completed', 'cancelled'].includes(status)) {
    return res.status(400).json({ error: 'Invalid status' });
  }

  try {
    const jobRes = await pool.query('SELECT client_id, status FROM jobs WHERE id = $1', [req.params.id]);
    const job = jobRes.rows[0];
    if (!job) return res.status(404).json({ error: 'Job not found' });
    if (job.client_id !== req.user.id) {
      return res.status(403).json({ error: 'Only the job owner can update this job' });
    }

    const allowedNext = JOB_ALLOWED_TRANSITIONS[job.status] || [];
    if (!allowedNext.includes(status)) {
      return res.status(400).json({
        error: `Cannot change status from '${job.status}' to '${status}'`,
      });
    }

    const result = await pool.query('UPDATE jobs SET status = $1 WHERE id = $2 RETURNING *', [status, req.params.id]);
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update job status' });
  }
});

// Ranked candidate students for a job — job owner only. This exposes student
// names, skills, proficiency and ratings, so it must not be open to any
// logged-in user.
router.get('/:id/matches', requireAuth, async (req, res) => {
  try {
    const jobRes = await pool.query('SELECT client_id FROM jobs WHERE id = $1', [req.params.id]);
    const job = jobRes.rows[0];
    if (!job) return res.status(404).json({ error: 'Job not found' });
    if (job.client_id !== req.user.id) {
      return res.status(403).json({ error: 'Only the job owner can view matches' });
    }

    const ranked = await rankCandidatesForJob(req.params.id);
    res.json(ranked);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to compute matches' });
  }
});

module.exports = router;
