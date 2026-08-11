import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import client from '../api/client';
import { getUser } from '../api/auth';

function ReviewForm({ onSubmit, onCancel }) {
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const submit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      await onSubmit({ rating: Number(rating), comment: comment.trim() || undefined });
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to submit review');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={submit} style={{ marginTop: 8 }}>
      <label>Rating</label>
      <select value={rating} onChange={(e) => setRating(e.target.value)}>
        {[5, 4, 3, 2, 1].map((n) => <option key={n} value={n}>{n} star{n === 1 ? '' : 's'}</option>)}
      </select>
      <textarea
        placeholder="Optional comment" rows={2}
        value={comment} onChange={(e) => setComment(e.target.value)}
      />
      {error && <p style={{ color: 'var(--danger)' }}>{error}</p>}
      <button className="btn" type="submit" disabled={submitting}>{submitting ? 'Submitting...' : 'Submit review'}</button>{' '}
      <button type="button" className="btn" style={{ background: '#888' }} onClick={onCancel}>Cancel</button>
    </form>
  );
}

function timeGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

// Profile strength: a transparent count of the fields that make a profile
// usable to a client, not a black-box score. Each field is worth an equal
// share so students can see exactly what moves the number.
function profileCompletion(profile) {
  if (!profile) return { pct: 0, missing: [] };
  const checks = [
    { key: 'bio', label: 'a short bio', done: Boolean(profile.bio && profile.bio.trim()) },
    { key: 'github_url', label: 'a GitHub or portfolio link', done: Boolean(profile.github_url && profile.github_url.trim()) },
    { key: 'college', label: 'your college', done: Boolean(profile.college && profile.college.trim()) },
    { key: 'department', label: 'your department', done: Boolean(profile.department && profile.department.trim()) },
    { key: 'skills', label: 'at least one skill', done: Boolean(profile.skills && profile.skills.length > 0) },
  ];
  const done = checks.filter((c) => c.done).length;
  const missing = checks.filter((c) => !c.done).map((c) => c.label);
  return { pct: Math.round((done / checks.length) * 100), missing };
}

// Skillora Score: a single readable number built from three things a client
// actually sees — how many skills are listed, how complete the profile is,
// and (once there's a track record) the average client rating. Capped
// contributions so no one factor dominates; shown with its own inputs below
// the number rather than presented as an opaque ranking.
function skillScore(profile, completionPct) {
  if (!profile) return null;
  const skillsPart = Math.min(profile.skills?.length || 0, 5) * 0.6; // up to 3
  const completionPart = (completionPct / 100) * 4; // up to 4
  const rating = Number(profile.rating_avg) || 0;
  const ratingPart = rating > 0 ? (rating / 5) * 3 : 0; // up to 3
  const total = Math.min(10, skillsPart + completionPart + ratingPart);
  return { score: Math.round(total * 10) / 10, hasRating: rating > 0 };
}

function RecommendedCard({ job }) {
  const skills = job.required_skills || [];
  return (
    <div className="rec-card">
      <div className="rec-card-top">
        <div>
          <h4>{job.title}</h4>
          {job.budget && <p className="budget">₹{Number(job.budget).toLocaleString('en-IN')}</p>}
        </div>
        <div className="ring" style={{ '--pct': Math.round(job.match_score) }} data-label={`${Math.round(job.match_score)}%`} />
      </div>
      {skills.length > 0 && (
        <div className="chip-row">
          {skills.slice(0, 3).map((s) => <span className="chip" key={s}>{s}</span>)}
          {skills.length > 3 && <span className="chip chip-muted">+{skills.length - 3}</span>}
        </div>
      )}
      <Link className="apply-link" to={`/jobs/${job.id}`}>View &amp; apply →</Link>
    </div>
  );
}

export default function StudentDashboard() {
  const user = getUser();
  const [applications, setApplications] = useState([]);
  const [appsError, setAppsError] = useState('');
  const [appsLoading, setAppsLoading] = useState(true);
  const [reviewingId, setReviewingId] = useState(null);

  const [profile, setProfile] = useState(null);
  const [profileError, setProfileError] = useState('');

  const [recommended, setRecommended] = useState([]);
  const [recError, setRecError] = useState('');
  const [recLoading, setRecLoading] = useState(true);

  const loadApplications = () => {
    setAppsLoading(true);
    client.get('/applications/mine')
      .then((res) => { setApplications(res.data); setAppsError(''); })
      .catch(() => setAppsError('Unable to load your applications right now. Try refreshing the page.'))
      .finally(() => setAppsLoading(false));
  };

  const loadProfile = () => {
    if (!user) return;
    client.get(`/users/${user.id}`)
      .then((res) => { setProfile(res.data); setProfileError(''); })
      .catch(() => setProfileError('Unable to load your profile.'));
  };

  const loadRecommended = () => {
    setRecLoading(true);
    client.get('/jobs/recommended')
      .then((res) => { setRecommended(res.data); setRecError(''); })
      .catch(() => setRecError('Unable to load recommendations right now.'))
      .finally(() => setRecLoading(false));
  };

  useEffect(loadApplications, []);
  useEffect(loadProfile, [user?.id]);
  useEffect(loadRecommended, []);

  const withdraw = async (appId) => {
    try {
      await client.patch(`/applications/${appId}`, { status: 'withdrawn' });
      loadApplications();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to withdraw application');
    }
  };

  const submitReview = async (app, { rating, comment }) => {
    await client.post('/reviews', { job_id: app.job_id, reviewee_id: app.job_client_id, rating, comment });
    setReviewingId(null);
    loadApplications();
  };

  const { pct: completionPct, missing } = profileCompletion(profile);
  const score = skillScore(profile, completionPct);
  const firstName = (user?.name || '').split(' ')[0];

  return (
    <div>
      <h2 className="dash-greeting">{timeGreeting()}{firstName ? `, ${firstName}` : ''} 👋</h2>
      <p className="dash-subtext">Here's where things stand today.</p>

      <div className="dash-stats">
        <div className="stat-card">
          <div className="ring ring-teal" style={{ '--pct': completionPct }} data-label={`${completionPct}%`} />
          <div style={{ flex: 1 }}>
            <h4>Profile strength</h4>
            <div className="progress-track"><div className="progress-fill" style={{ width: `${completionPct}%` }} /></div>
            {profileError && <p className="stat-caption">{profileError}</p>}
            {!profileError && missing.length > 0 && (
              <p className="stat-caption">Add {missing[0]}{missing.length > 1 ? ` and ${missing.length - 1} more thing${missing.length > 2 ? 's' : ''}` : ''} to strengthen it. <Link className="stat-cta" to="/profile">Edit profile →</Link></p>
            )}
            {!profileError && missing.length === 0 && <p className="stat-caption">Your profile is complete. Nice work.</p>}
          </div>
        </div>

        <div className="stat-card">
          <div className="ring" style={{ '--pct': score ? score.score * 10 : 0 }} data-label={score ? score.score.toFixed(1) : '–'} />
          <div style={{ flex: 1 }}>
            <h4>Skillora score</h4>
            <p className="stat-caption">
              Built from your skills, profile completeness{score?.hasRating ? ', and your client ratings' : ''}.
              {!score?.hasRating && ' Complete a job and get reviewed to raise it further.'}
            </p>
          </div>
        </div>
      </div>

      <div className="section-head">
        <h3>Recommended for you</h3>
        <Link className="section-link" to="/">Browse all jobs</Link>
      </div>
      {recLoading && (
        <div className="rec-row">
          {[0, 1, 2].map((i) => <div key={i} className="skeleton" style={{ minWidth: 240, height: 128 }} />)}
        </div>
      )}
      {!recLoading && recError && <div className="empty-state">{recError}</div>}
      {!recLoading && !recError && recommended.length === 0 && (
        <div className="empty-state">
          {missing.includes('at least one skill')
            ? <>Add a few skills to your profile and we'll surface jobs that fit. <Link to="/profile">Add skills →</Link></>
            : <>No open jobs match your skills right now. <Link to="/">Browse all jobs</Link> instead.</>}
        </div>
      )}
      {!recLoading && !recError && recommended.length > 0 && (
        <div className="rec-row">
          {recommended.map((job) => <RecommendedCard job={job} key={job.id} />)}
        </div>
      )}

      <div className="section-head">
        <h3>Active applications</h3>
      </div>
      {appsLoading && <div className="skeleton" style={{ height: 90, marginBottom: 12 }} />}
      {!appsLoading && appsError && <div className="empty-state">{appsError}</div>}
      {!appsLoading && !appsError && applications.length === 0 && (
        <div className="empty-state">No applications yet. <Link to="/">Browse open opportunities</Link> and apply to ones that fit.</div>
      )}
      {!appsLoading && !appsError && applications.map((app) => (
        <div className="card app-card" key={app.id}>
          <div className="app-card-top">
            <h4><Link to={`/jobs/${app.job_id}`}>{app.job_title}</Link></h4>
            <span className={`status-pill ${app.status}`}>{app.status}</span>
          </div>
          {app.status === 'pending' && (
            <button className="btn" style={{ background: 'var(--danger)', alignSelf: 'flex-start' }} onClick={() => withdraw(app.id)}>Withdraw</button>
          )}
          {(app.status === 'accepted' || app.status === 'completed') && !app.reviewed && (
            reviewingId === app.id ? (
              <ReviewForm onSubmit={(vals) => submitReview(app, vals)} onCancel={() => setReviewingId(null)} />
            ) : (
              <button className="btn" style={{ alignSelf: 'flex-start' }} onClick={() => setReviewingId(app.id)}>Leave a review</button>
            )
          )}
          {app.reviewed && <p style={{ color: 'var(--muted)', margin: 0, fontSize: 13.5 }}>You reviewed this client.</p>}
        </div>
      ))}
    </div>
  );
}
