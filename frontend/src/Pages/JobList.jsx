import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import client from '../api/client';
import { getUser } from '../api/auth';

// Skillora's tagged-skill vocabulary (see backend/services/skillNormalize.js)
// doesn't include a category field, so we bucket the known canonical skills
// into groups a client browsing jobs would recognize. This is a display-only
// grouping, not a stored attribute.
const CATEGORIES = {
  'Web Dev': ['react', 'node', 'express', 'python', 'django', 'flask', 'postgresql', 'mongodb', 'java'],
  'Mobile': ['android', 'kotlin', 'flutter', 'swift', 'firebase'],
  'Design': ['ui/ux', 'figma', 'graphic design'],
  'Data / ML': ['machine learning', 'python'],
  'Media': ['video editing'],
};

function jobCategories(job) {
  const skills = job.required_skills || [];
  return Object.entries(CATEGORIES)
    .filter(([, catSkills]) => catSkills.some((s) => skills.includes(s)))
    .map(([name]) => name);
}

function JobCard({ job }) {
  const skills = job.required_skills || [];
  return (
    <div className="job-card">
      <div className="job-card-top">
        <h3><Link to={`/jobs/${job.id}`}>{job.title}</Link></h3>
        {job.match_score !== undefined ? (
          <div className="ring" style={{ '--pct': Math.round(job.match_score) }} data-label={`${Math.round(job.match_score)}%`} />
        ) : (
          job.budget != null && <span className="job-budget">₹{Number(job.budget).toLocaleString('en-IN')}</span>
        )}
      </div>
      <p className="job-desc">{job.description}</p>
      {skills.length > 0 && (
        <div className="chip-row">
          {skills.slice(0, 4).map((s) => <span className="chip" key={s}>{s}</span>)}
          {skills.length > 4 && <span className="chip chip-muted">+{skills.length - 4}</span>}
        </div>
      )}
      <div className="job-card-foot">
        {job.match_score !== undefined && job.budget != null && (
          <span className="job-budget">₹{Number(job.budget).toLocaleString('en-IN')}</span>
        )}
        <span className="job-team">{job.team_size > 1 ? `Team of ${job.team_size}` : 'Solo gig'}</span>
        <Link className="applicant-footlink" to={`/jobs/${job.id}`}>View &amp; apply →</Link>
      </div>
    </div>
  );
}

export default function JobList() {
  const user = getUser();
  const [jobs, setJobs] = useState([]);
  const [matchByJobId, setMatchByJobId] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('All');
  const [maxBudget, setMaxBudget] = useState(null);
  const [budgetCeiling, setBudgetCeiling] = useState(0);
  const [sort, setSort] = useState('newest');

  useEffect(() => {
    setLoading(true);
    client.get('/jobs?status=open&limit=50')
      .then((res) => {
        const list = res.data.jobs || [];
        setJobs(list);
        const highest = Math.max(0, ...list.map((j) => Number(j.budget) || 0));
        setBudgetCeiling(highest);
        setMaxBudget(highest);
        setError('');
      })
      .catch(() => setError('Unable to load jobs right now.'))
      .finally(() => setLoading(false));

    if (user?.role === 'student') {
      client.get('/jobs/recommended?limit=50')
        .then((res) => {
          const map = {};
          (res.data || []).forEach((j) => { map[j.id] = j.match_score; });
          setMatchByJobId(map);
        })
        .catch(() => {});
    }
  }, [user?.role]);

  const availableSkills = useMemo(() => {
    const counts = {};
    jobs.forEach((j) => (j.required_skills || []).forEach((s) => { counts[s] = (counts[s] || 0) + 1; }));
    return Object.entries(counts).sort((a, b) => b[1] - a[1]).map(([s]) => s).slice(0, 10);
  }, [jobs]);

  const [skillFilter, setSkillFilter] = useState(null);

  const filtered = useMemo(() => {
    let list = jobs.map((j) => (
      matchByJobId[j.id] !== undefined ? { ...j, match_score: matchByJobId[j.id] } : j
    ));

    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter((j) => j.title.toLowerCase().includes(q) || j.description.toLowerCase().includes(q));
    }
    if (category !== 'All') {
      list = list.filter((j) => jobCategories(j).includes(category));
    }
    if (skillFilter) {
      list = list.filter((j) => (j.required_skills || []).includes(skillFilter));
    }
    if (maxBudget !== null && budgetCeiling > 0) {
      list = list.filter((j) => j.budget == null || Number(j.budget) <= maxBudget);
    }

    const sorted = [...list];
    if (sort === 'budget_high') sorted.sort((a, b) => (Number(b.budget) || 0) - (Number(a.budget) || 0));
    else if (sort === 'budget_low') sorted.sort((a, b) => (Number(a.budget) || 0) - (Number(b.budget) || 0));
    else if (sort === 'match' && user?.role === 'student') sorted.sort((a, b) => (b.match_score ?? -1) - (a.match_score ?? -1));
    else sorted.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

    return sorted;
  }, [jobs, matchByJobId, search, category, skillFilter, maxBudget, budgetCeiling, sort, user?.role]);

  return (
    <div>
      <div className="discovery-head">
        <h2>Open Opportunities</h2>
        <p className="discovery-sub">Browse gigs from clients across campus and apply to the ones that fit.</p>
      </div>

      <div className="search-bar">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18">
          <circle cx="11" cy="11" r="7" /><path d="M21 21l-4.3-4.3" />
        </svg>
        <input
          placeholder="Search jobs by title or keyword"
          value={search} onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <div className="filter-row">
        {['All', ...Object.keys(CATEGORIES)].map((cat) => (
          <button
            key={cat}
            className={`filter-chip ${category === cat ? 'active' : ''}`}
            onClick={() => setCategory(cat)}
          >
            {cat}
          </button>
        ))}
      </div>

      <div className="filter-panel">
        <div className="filter-field">
          Skill
          <select value={skillFilter || ''} onChange={(e) => setSkillFilter(e.target.value || null)}>
            <option value="">All skills</option>
            {availableSkills.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        {budgetCeiling > 0 && (
          <div className="filter-field">
            Max budget
            <input
              type="range" min="0" max={budgetCeiling} value={maxBudget ?? budgetCeiling}
              onChange={(e) => setMaxBudget(Number(e.target.value))}
            />
            <span className="range-value">₹{(maxBudget ?? budgetCeiling).toLocaleString('en-IN')}</span>
          </div>
        )}
        <div className="filter-field">
          Sort by
          <select value={sort} onChange={(e) => setSort(e.target.value)}>
            <option value="newest">Newest</option>
            <option value="budget_high">Budget: high to low</option>
            <option value="budget_low">Budget: low to high</option>
            {user?.role === 'student' && <option value="match">Best match</option>}
          </select>
        </div>
      </div>

      {loading && (
        <div className="job-grid">
          {[0, 1, 2, 3].map((i) => <div key={i} className="skeleton" style={{ height: 160 }} />)}
        </div>
      )}
      {!loading && error && <div className="empty-state">{error}</div>}
      {!loading && !error && (
        <p className="result-count">{filtered.length} open job{filtered.length === 1 ? '' : 's'}</p>
      )}
      {!loading && !error && filtered.length === 0 && (
        <div className="empty-state">No jobs match your filters right now. Try widening your search.</div>
      )}
      {!loading && !error && filtered.length > 0 && (
        <div className="job-grid">
          {filtered.map((job) => <JobCard job={job} key={job.id} />)}
        </div>
      )}
    </div>
  );
}
