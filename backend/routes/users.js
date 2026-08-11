const express = require('express');
const pool = require('../config/db');
const { requireAuth } = require('../middleware/auth');
const { normalizeSkill } = require('../services/skillNormalize');

const router = express.Router();

// Get a user's public profile
router.get('/:id', async (req, res) => {
  try {
    const userRes = await pool.query(
      `SELECT id, name, role, college, department,
              github_url, bio, rating_avg, is_verified
       FROM users
       WHERE id = $1`,
      [req.params.id]
    );

    if (!userRes.rows[0]) {
      return res.status(404).json({ error: 'User not found' });
    }

    const skillsRes = await pool.query(
      `SELECT s.name, us.proficiency
       FROM user_skills us
       JOIN skills s ON s.id = us.skill_id
       WHERE us.user_id = $1`,
      [req.params.id]
    );

    res.json({
      ...userRes.rows[0],
      skills: skillsRes.rows,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch profile' });
  }
});

// Update the logged-in user's own profile
router.patch('/me', requireAuth, async (req, res) => {
  const { bio, github_url, college, department } = req.body;

  try {
    const result = await pool.query(
      `UPDATE users SET
         bio = COALESCE($1, bio),
         github_url = COALESCE($2, github_url),
         college = COALESCE($3, college),
         department = COALESCE($4, department)
       WHERE id = $5
       RETURNING id, name, role, college, department,
                 github_url, bio, rating_avg`,
      [bio, github_url, college, department, req.user.id]
    );

    if (!result.rows[0]) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

// Add or update a skill
router.post('/me/skills', requireAuth, async (req, res) => {
  const { skill, proficiency } = req.body;

  if (!skill || !skill.trim()) {
    return res.status(400).json({ error: 'skill is required' });
  }

  const prof =
    proficiency === undefined ||
    proficiency === null ||
    proficiency === ''
      ? 50
      : Number(proficiency);

  if (!Number.isInteger(prof) || prof < 0 || prof > 100) {
    return res.status(400).json({
      error: 'proficiency must be a whole number between 0 and 100',
    });
  }

  const canonical = normalizeSkill(skill);

  try {
    let skillRes = await pool.query(
      'SELECT id FROM skills WHERE name = $1',
      [canonical]
    );

    let skillId;

    if (skillRes.rows[0]) {
      skillId = skillRes.rows[0].id;
    } else {
      const inserted = await pool.query(
        'INSERT INTO skills (name) VALUES ($1) RETURNING id',
        [canonical]
      );

      skillId = inserted.rows[0].id;
    }

    await pool.query(
      `INSERT INTO user_skills (user_id, skill_id, proficiency)
       VALUES ($1, $2, $3)
       ON CONFLICT (user_id, skill_id)
       DO UPDATE SET proficiency = EXCLUDED.proficiency`,
      [req.user.id, skillId, prof]
    );

    res.status(201).json({
      skill: canonical,
      proficiency: prof,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update skills' });
  }
});

// Remove a skill
router.delete('/me/skills/:skillName', requireAuth, async (req, res) => {
  const canonical = normalizeSkill(req.params.skillName);

  try {
    await pool.query(
      `DELETE FROM user_skills
       WHERE user_id = $1
       AND skill_id = (
         SELECT id FROM skills WHERE name = $2
       )`,
      [req.user.id, canonical]
    );

    res.status(204).send();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to remove skill' });
  }
});

module.exports = router;
