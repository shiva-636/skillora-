const pool = require('../config/db');
const { normalizeSkill, CANONICAL_SKILLS } = require('./skillNormalize');

/**
 * v1 skill matching: no ML required.
 * Score = overlap between job.required_skills and student's tagged skills,
 * weighted by the student's proficiency and their rating average.
 * Excludes the job owner and students who already have a non-pending
 * relationship with this job (accepted/rejected/withdrawn/completed).
 */
async function rankCandidatesForJob(jobId) {
  const jobRes = await pool.query('SELECT * FROM jobs WHERE id = $1', [jobId]);
  const job = jobRes.rows[0];
  if (!job) throw new Error('Job not found');

  const requiredSkills = job.required_skills || [];
  if (requiredSkills.length === 0) return [];

  const candidatesRes = await pool.query(
    `SELECT u.id, u.name, u.rating_avg, s.name AS skill_name, us.proficiency
     FROM users u
     JOIN user_skills us ON us.user_id = u.id
     JOIN skills s ON s.id = us.skill_id
     WHERE u.is_verified = true
       AND u.role = 'student'
       AND u.id <> $2
       AND s.name = ANY($1::text[])
       AND u.id NOT IN (
         SELECT student_id FROM applications
         WHERE job_id = $2 AND status IN ('accepted', 'rejected', 'withdrawn', 'completed')
       )`,
    [requiredSkills, job.client_id]
  );

  const byUser = {};
  for (const row of candidatesRes.rows) {
    if (!byUser[row.id]) {
      byUser[row.id] = { id: row.id, name: row.name, rating_avg: Number(row.rating_avg) || 0, matchedSkills: [] };
    }
    byUser[row.id].matchedSkills.push({ skill: row.skill_name, proficiency: row.proficiency });
  }

  const ranked = Object.values(byUser).map((c) => {
    const coverage = c.matchedSkills.length / requiredSkills.length; // % of required skills covered
    const avgProficiency = c.matchedSkills.reduce((s, m) => s + m.proficiency, 0) / c.matchedSkills.length;
    // Weighted score: skill coverage matters most, then proficiency, then track record.
    const score = coverage * 60 + (avgProficiency / 100) * 30 + (c.rating_avg / 5) * 10;
    return { ...c, matchScore: Math.round(score * 100) / 100 };
  });

  return ranked.sort((a, b) => b.matchScore - a.matchScore);
}

/**
 * "AI Job -> Skill Analyzer" stub.
 * Keyword extraction against a known, normalized skill vocabulary.
 * Swap the body of this function for an LLM call later without touching callers.
 * Matches on canonical labels AND common synonyms (react.js, node.js, etc.)
 * via normalizeSkill, so phrasing variance doesn't silently drop a skill.
 */
function extractSkillsFromDescription(description) {
  const text = description.toLowerCase();
  const found = new Set();

  for (const canonical of CANONICAL_SKILLS) {
    // Word-boundary match for plain alphanumeric/space skill names, so short
    // words like "java" or "react" don't false-positive inside "javascript"
    // or "reactive". \b doesn't bound usefully around symbols, so skills
    // like "c++" or "ui/ux" fall back to a plain substring check.
    if (/^[a-z0-9 ]+$/.test(canonical)) {
      const pattern = canonical.replace(/ /g, '\\s+');
      if (new RegExp(`\\b${pattern}\\b`, 'i').test(text)) found.add(canonical);
    } else if (text.includes(canonical)) {
      found.add(canonical);
    }
  }

  // Also sweep common synonym phrasing that isn't a substring of the canonical form.
  const extraPhrases = ['reactjs', 'react.js', 'react js', 'nodejs', 'node.js', 'node js',
    'expressjs', 'express.js', 'ui ux', 'uiux', 'ux/ui', ' ml ', 'postgres', 'mongo',
    'cpp', 'graphic designer', 'video editor'];
  for (const phrase of extraPhrases) {
    if (text.includes(phrase)) {
      const canonical = normalizeSkill(phrase.trim());
      if (canonical) found.add(canonical);
    }
  }

  return [...found];
}

/**
 * Score a single student against a job's required_skills — same formula as
 * rankCandidatesForJob, but for one known student (e.g. someone who already
 * applied) rather than searching for candidates. Unlike rankCandidatesForJob,
 * this doesn't exclude anyone based on application status, and returns a
 * result (score 0) even when there's no skill overlap.
 */
async function scoreStudentForJob(jobId, studentId) {
  const jobRes = await pool.query('SELECT required_skills FROM jobs WHERE id = $1', [jobId]);
  const job = jobRes.rows[0];
  if (!job) return null;
  const requiredSkills = job.required_skills || [];

  const studentRes = await pool.query(
    `SELECT u.name, u.rating_avg, u.college, u.department, s.name AS skill_name, us.proficiency
     FROM users u
     LEFT JOIN user_skills us ON us.user_id = u.id
     LEFT JOIN skills s ON s.id = us.skill_id
     WHERE u.id = $1`,
    [studentId]
  );
  if (studentRes.rows.length === 0) return null;

  const name = studentRes.rows[0].name;
  const ratingAvg = Number(studentRes.rows[0].rating_avg) || 0;
  const college = studentRes.rows[0].college || null;
  const department = studentRes.rows[0].department || null;
  const allSkills = studentRes.rows
    .filter((r) => r.skill_name)
    .map((r) => ({ skill: r.skill_name, proficiency: r.proficiency }));
  const matchedSkills = allSkills.filter((s) => requiredSkills.includes(s.skill));

  if (requiredSkills.length === 0 || matchedSkills.length === 0) {
    return { name, ratingAvg, college, department, allSkills, matchedSkills: [], matchScore: 0 };
  }

  const coverage = matchedSkills.length / requiredSkills.length;
  const avgProficiency = matchedSkills.reduce((s, m) => s + m.proficiency, 0) / matchedSkills.length;
  const score = coverage * 60 + (avgProficiency / 100) * 30 + (ratingAvg / 5) * 10;

  return { name, ratingAvg, college, department, allSkills, matchedSkills, matchScore: Math.round(score * 100) / 100 };
}

module.exports = { rankCandidatesForJob, extractSkillsFromDescription, scoreStudentForJob };
