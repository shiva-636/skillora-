const express = require('express');
const pool = require('../config/db');
const { requireAuth, requireRole } = require('../middleware/auth');
const { scoreStudentForJob } = require('../services/matching');

const router = express.Router();

// Only students apply, and only to jobs that are still open.
router.post('/', requireAuth, requireRole('student'), async (req, res) => {
  const { job_id, message } = req.body;
  if (!job_id) return res.status(400).json({ error: 'job_id is required' });

  try {
    const jobRes = await pool.query('SELECT client_id, status FROM jobs WHERE id = $1', [job_id]);
    const job = jobRes.rows[0];
    if (!job) return res.status(404).json({ error: 'Job not found' });
    if (job.status !== 'open') {
      return res.status(400).json({ error: 'This job is no longer accepting applications' });
    }
    // Defensive check: a client account can't apply to its own listing.
    if (job.client_id === req.user.id) {
      return res.status(403).json({ error: 'You cannot apply to your own job' });
    }

    const result = await pool.query(
      `INSERT INTO applications (job_id, student_id, message)
       VALUES ($1, $2, $3) RETURNING *`,
      [job_id, req.user.id, message || null]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'You already applied to this job' });
    }
    console.error(err);
    res.status(500).json({ error: 'Failed to apply' });
  }
});

// Accept/reject — job-owner only. Critical fix: previously any authenticated
// user could PATCH any application, regardless of who posted the job.
//
// Valid transitions (anything not listed here is rejected, e.g.
// pending -> completed, rejected -> completed, accepted -> rejected):
//   pending   -> accepted    (job owner)
//   pending   -> rejected    (job owner)
//   accepted  -> completed   (job owner)
//   pending   -> withdrawn   (student)
const ALLOWED_TRANSITIONS = {
  pending: ['accepted', 'rejected', 'withdrawn'],
  accepted: ['completed'],
  rejected: [],
  completed: [],
  withdrawn: [],
};

router.patch('/:id', requireAuth, async (req, res) => {
  const { status } = req.body;
  if (!['accepted', 'rejected', 'completed', 'withdrawn'].includes(status)) {
    return res.status(400).json({ error: 'Invalid status' });
  }

  try {
    const appRes = await pool.query(
      `SELECT a.*, j.client_id FROM applications a
       JOIN jobs j ON j.id = a.job_id WHERE a.id = $1`,
      [req.params.id]
    );
    const application = appRes.rows[0];
    if (!application) return res.status(404).json({ error: 'Application not found' });

    const isJobOwner = application.client_id === req.user.id;
    const isApplicant = application.student_id === req.user.id;

    if (status === 'withdrawn') {
      // Only the applicant can withdraw their own application.
      if (!isApplicant) return res.status(403).json({ error: 'Only the applicant can withdraw' });
    } else if (!isJobOwner) {
      // accepted / rejected / completed are job-owner decisions.
      return res.status(403).json({ error: 'Only the job owner can update this application' });
    }

    const allowedNext = ALLOWED_TRANSITIONS[application.status] || [];
    if (!allowedNext.includes(status)) {
      return res.status(400).json({
        error: `Cannot change status from '${application.status}' to '${status}'`,
      });
    }

    const result = await pool.query(
      'UPDATE applications SET status = $1 WHERE id = $2 RETURNING *',
      [status, req.params.id]
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update application' });
  }
});

// Job-owner only — this list contains applicant identities and messages.
router.get('/job/:jobId', requireAuth, async (req, res) => {
  try {
    const jobRes = await pool.query('SELECT client_id FROM jobs WHERE id = $1', [req.params.jobId]);
    const job = jobRes.rows[0];
    if (!job) return res.status(404).json({ error: 'Job not found' });
    if (job.client_id !== req.user.id) {
      return res.status(403).json({ error: 'Only the job owner can view applications' });
    }

    const result = await pool.query(
      'SELECT * FROM applications WHERE job_id = $1 ORDER BY created_at DESC',
      [req.params.jobId]
    );

    // Who has this client (the job owner) already reviewed for this job?
    // Used to hide the "Leave a review" action once it's been used.
    const reviewedRes = await pool.query(
      'SELECT reviewee_id FROM reviews WHERE job_id = $1 AND reviewer_id = $2',
      [req.params.jobId, req.user.id]
    );
    const reviewedIds = new Set(reviewedRes.rows.map((r) => r.reviewee_id));

    // Enrich each application with the applicant's name, rating, and skill
    // match against this job — the same info the "recommended students"
    // view shows, so the client isn't just looking at "Student #12".
    const enriched = await Promise.all(
      result.rows.map(async (app) => {
        const scored = await scoreStudentForJob(req.params.jobId, app.student_id);
        return {
          ...app,
          student_name: scored?.name || `Student #${app.student_id}`,
          student_rating: scored?.ratingAvg ?? 0,
          student_college: scored?.college ?? null,
          student_department: scored?.department ?? null,
          student_skills: scored?.allSkills || [],
          match_score: scored?.matchScore ?? 0,
          reviewed: reviewedIds.has(app.student_id),
        };
      })
    );

    res.json(enriched);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch applications' });
  }
});

// A student's own applications (used by the student dashboard).
router.get('/mine', requireAuth, requireRole('student'), async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT a.*, j.title AS job_title, j.client_id AS job_client_id,
         EXISTS (
           SELECT 1 FROM reviews r
           WHERE r.job_id = a.job_id AND r.reviewer_id = $1 AND r.reviewee_id = j.client_id
         ) AS reviewed
       FROM applications a
       JOIN jobs j ON j.id = a.job_id WHERE a.student_id = $1
       ORDER BY a.created_at DESC`,
      [req.user.id]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch your applications' });
  }
});

module.exports = router;
