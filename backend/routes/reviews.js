const express = require('express');
const pool = require('../config/db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

router.post('/', requireAuth, async (req, res) => {
  const { job_id, reviewee_id, rating, comment } = req.body;

  if (!job_id || !reviewee_id || rating === undefined) {
    return res.status(400).json({ error: 'job_id, reviewee_id, and rating are required' });
  }
  const ratingNum = Number(rating);
  if (!Number.isInteger(ratingNum) || ratingNum < 1 || ratingNum > 5) {
    return res.status(400).json({ error: 'Rating must be a whole number between 1 and 5' });
  }
  if (Number(reviewee_id) === req.user.id) {
    return res.status(400).json({ error: 'You cannot review yourself' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const jobRes = await client.query('SELECT client_id FROM jobs WHERE id = $1', [job_id]);
    const job = jobRes.rows[0];
    if (!job) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Job not found' });
    }

    // Both reviewer and reviewee must actually be tied to this job:
    // one of them is the client, the other must have an accepted/completed application.
    const isReviewerClient = job.client_id === req.user.id;
    const isRevieweeClient = job.client_id === Number(reviewee_id);

    if (!isReviewerClient && !isRevieweeClient) {
      await client.query('ROLLBACK');
      return res.status(403).json({ error: 'You did not participate in this job' });
    }

    const otherPartyId = isReviewerClient ? Number(reviewee_id) : req.user.id;
    const appRes = await client.query(
      `SELECT id FROM applications
       WHERE job_id = $1 AND student_id = $2 AND status IN ('accepted', 'completed')`,
      [job_id, otherPartyId]
    );
    if (appRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(403).json({ error: 'This job has no completed engagement between these two users' });
    }

    let review;
    try {
      const insertRes = await client.query(
        `INSERT INTO reviews (job_id, reviewer_id, reviewee_id, rating, comment)
         VALUES ($1, $2, $3, $4, $5) RETURNING *`,
        [job_id, req.user.id, reviewee_id, ratingNum, comment || null]
      );
      review = insertRes.rows[0];
    } catch (err) {
      if (err.code === '23505') {
        await client.query('ROLLBACK');
        return res.status(409).json({ error: 'You already reviewed this person for this job' });
      }
      throw err;
    }

    await client.query(
      `UPDATE users SET rating_avg = (
         SELECT AVG(rating) FROM reviews WHERE reviewee_id = $1
       ) WHERE id = $1`,
      [reviewee_id]
    );

    await client.query('COMMIT');
    res.status(201).json(review);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ error: 'Failed to submit review' });
  } finally {
    client.release();
  }
});

module.exports = router;
