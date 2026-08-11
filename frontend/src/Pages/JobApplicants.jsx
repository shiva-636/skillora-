import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import client from '../api/client';

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
      <button type="button" className="btn btn-outline" onClick={onCancel}>Cancel</button>
    </form>
  );
}

// A student's college + department is the closest real signal we have to
// "who is this person" — there's no class-year field in the data model, so
// we show what's actually on file rather than a placeholder like "CSE / 3rd yr".
function studentSubline(app) {
  const parts = [app.student_department, app.student_college].filter(Boolean);
  return parts.length ? parts.join(' • ') : null;
}

function ApplicantCard({ app, onAccept, onReject, onComplete, reviewing, onStartReview, onCancelReview, onSubmitReview }) {
  const subline = studentSubline(app);
  const skills = app.student_skills || [];

  return (
    <div className="card applicant-card">
      <div className="applicant-top">
        <div className="applicant-id">
          <div className="ring" style={{ '--pct': Math.round(app.match_score) }} data-label={`${Math.round(app.match_score)}%`} />
          <div className="applicant-name-block">
            <h4>{app.student_name}</h4>
            {subline && <p className="applicant-meta">{subline}</p>}
            <p className="applicant-rating">
              {app.student_rating > 0 ? (
                <><span className="stars">★ {app.student_rating}</span></>
              ) : 'No ratings yet'}
            </p>
          </div>
        </div>
        <span className={`status-pill ${app.status}`}>{app.status}</span>
      </div>

      {skills.length > 0 && (
        <div className="chip-row">
          {skills.slice(0, 6).map((s) => <span className="chip" key={s.skill}>{s.skill}</span>)}
          {skills.length > 6 && <span className="chip chip-muted">+{skills.length - 6}</span>}
        </div>
      )}

      {app.message && <p className="applicant-message">"{app.message}"</p>}

      <div className="applicant-actions">
        <Link className="applicant-footlink" to={`/users/${app.student_id}`}>View Profile →</Link>
      </div>

      {app.status === 'pending' && (
        <div className="applicant-actions">
          <button className="btn btn-sm" onClick={() => onAccept(app.id)}>Accept</button>
          <button className="btn btn-sm btn-danger-outline" onClick={() => onReject(app.id)}>Reject</button>
        </div>
      )}
      {app.status === 'accepted' && (
        <div className="applicant-actions">
          <button className="btn btn-sm" onClick={() => onComplete(app.id)}>Mark Complete</button>
        </div>
      )}
      {(app.status === 'accepted' || app.status === 'completed') && !app.reviewed && (
        reviewing ? (
          <ReviewForm onSubmit={onSubmitReview} onCancel={onCancelReview} />
        ) : (
          <div className="applicant-actions">
            <button className="btn btn-sm btn-outline" onClick={onStartReview}>Leave a review</button>
          </div>
        )
      )}
      {app.reviewed && <p style={{ color: 'var(--muted)', margin: 0, fontSize: 13 }}>You reviewed this student.</p>}
    </div>
  );
}

export default function JobApplicants() {
  const { id } = useParams();
  const [applications, setApplications] = useState([]);
  const [matches, setMatches] = useState([]);
  const [error, setError] = useState('');
  const [reviewingId, setReviewingId] = useState(null);

  const load = () => {
    client.get(`/applications/job/${id}`).then((res) => setApplications(res.data)).catch(() => {});
    client.get(`/jobs/${id}/matches`).then((res) => setMatches(res.data))
      .catch((err) => setError(err.response?.data?.error || 'Unable to load matches.'));
  };

  useEffect(load, [id]);

  const updateStatus = async (appId, status) => {
    try {
      await client.patch(`/applications/${appId}`, { status });
      load();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to update application');
    }
  };

  const submitReview = async (app, { rating, comment }) => {
    await client.post('/reviews', { job_id: id, reviewee_id: app.student_id, rating, comment });
    setReviewingId(null);
    load();
  };

  return (
    <div>
      <h2>Applications</h2>
      {applications.length === 0 && <div className="empty-state">No applications yet.</div>}
      {applications.map((app) => (
        <ApplicantCard
          key={app.id}
          app={app}
          onAccept={(appId) => updateStatus(appId, 'accepted')}
          onReject={(appId) => updateStatus(appId, 'rejected')}
          onComplete={(appId) => updateStatus(appId, 'completed')}
          reviewing={reviewingId === app.id}
          onStartReview={() => setReviewingId(app.id)}
          onCancelReview={() => setReviewingId(null)}
          onSubmitReview={(vals) => submitReview(app, vals)}
        />
      ))}

      <div className="section-head">
        <h3>Recommended Students (skill match)</h3>
      </div>
      {error && <p style={{ color: 'var(--danger)' }}>{error}</p>}
      {matches.length === 0 && !error && <div className="empty-state">No unmatched students found for this job's required skills yet.</div>}
      {matches.map((m) => (
        <div className="card applicant-card" key={m.id}>
          <div className="applicant-top">
            <div className="applicant-id">
              <div className="ring" style={{ '--pct': Math.round(m.matchScore) }} data-label={`${Math.round(m.matchScore)}%`} />
              <div className="applicant-name-block">
                <h4>{m.name}</h4>
                <p className="applicant-rating">
                  {m.rating_avg > 0 ? <span className="stars">★ {m.rating_avg}</span> : 'No ratings yet'}
                </p>
              </div>
            </div>
          </div>
          <div className="chip-row">
            {m.matchedSkills.map((s) => <span className="chip" key={s.skill}>{s.skill} · {s.proficiency}%</span>)}
          </div>
        </div>
      ))}
    </div>
  );
}
