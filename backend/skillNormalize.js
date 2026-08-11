// Canonical skill vocabulary + synonym mapping.
// Everything is normalized to a lowercase canonical form before it's stored
// or matched, so "React", "ReactJS", "react.js" are all treated as one skill.

const SYNONYMS = {
  'react': 'react', 'reactjs': 'react', 'react.js': 'react', 'react js': 'react',
  'node': 'node', 'nodejs': 'node', 'node.js': 'node', 'node js': 'node',
  'express': 'express', 'expressjs': 'express', 'express.js': 'express',
  'android': 'android',
  'kotlin': 'kotlin',
  'firebase': 'firebase',
  'ui/ux': 'ui/ux', 'ui ux': 'ui/ux', 'uiux': 'ui/ux', 'ux/ui': 'ui/ux',
  'python': 'python',
  'django': 'django',
  'flask': 'flask',
  'machine learning': 'machine learning', 'ml': 'machine learning',
  'figma': 'figma',
  'postgresql': 'postgresql', 'postgres': 'postgresql',
  'mongodb': 'mongodb', 'mongo': 'mongodb',
  'java': 'java',
  'c++': 'c++', 'cpp': 'c++',
  'flutter': 'flutter',
  'swift': 'swift',
  'graphic design': 'graphic design', 'graphic designer': 'graphic design',
  'video editing': 'video editing', 'video editor': 'video editing',
};

// Canonical display labels, keyed by canonical id (used for keyword extraction & seeding).
const CANONICAL_SKILLS = [
  'react', 'node', 'express', 'android', 'kotlin', 'firebase', 'ui/ux',
  'python', 'django', 'flask', 'machine learning', 'figma', 'postgresql',
  'mongodb', 'java', 'c++', 'flutter', 'swift', 'graphic design', 'video editing',
];

/** Normalize free-typed skill text ("ReactJS ") -> canonical id ("react"). */
function normalizeSkill(raw) {
  if (!raw) return null;
  const cleaned = raw.trim().toLowerCase();
  return SYNONYMS[cleaned] || cleaned;
}

function normalizeSkillList(list) {
  return [...new Set((list || []).map(normalizeSkill).filter(Boolean))];
}

module.exports = { normalizeSkill, normalizeSkillList, CANONICAL_SKILLS };
