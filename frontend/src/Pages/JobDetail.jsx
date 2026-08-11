import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import client from '../api/client';
import { getUser } from '../api/auth';

export default function JobDetail() {
  const { id } = useParams();
  const [job, setJob] = useState(null);
  const [message, setMessage] = useState('');
  const [statusMessage, setStatusMessage] = useState('');
  const [applying, setApplying] = useState(false);
  const [applied, setApplied] = useState(false);
  const user = getUser();

  useEffect(() => {
    client.get(`/jobs/${id}`).then((res) => setJob(res.data)).catch(() => setJob(null));
  }, [id]);

  const apply = async (e) => {
    e.preventDefault();
    setApplying(true);
    setStatusMessage('');
    try {
      await client.post('/applications', { job_id: id, message: message.trim() || undefined });
      setStatusMessage('Applied! The client will review your application.');
      setApplied(true);
    } catch (err) {
      const msg = err.response?.data?.error;
      if (err.response?.status === 409) {
        setStatusMessage('You have already applied to this job.');
        setApplied(true);
      } else {
        setStatusMessage(msg || 'Unable to apply right now. Please try again.');
      }
    } finally {
      setApplying(false);
    }
  };

  if (!job) return <p>Loading...</p>;

  // Matches/applicants are only visible to the job's owner — see the client dashboard.
  const canApply = user && user.role === 'student' && job.status === 'open';

  return (
    <div>
      <h2>{job.title}</h2>
      <p>{job.description}</p>
      <p>Budget: ₹{job.budget ?? 'N/A'} • Required: {(job.required_skills || []).join(', ') || 'None tagged'}</p>
      <p>Status: {job.status}</p>

      {canApply && !applied && (
        <form onSubmit={apply} className="card">
          <label>Message to client</label>
          <textarea
            placeholder="Why are you suitable for this project?"
            value={message} onChange={(e) => setMessage(e.target.value)} rows={4}
          />
          <button className="btn" type="submit" disabled={applying}>
            {applying ? 'Applying...' : 'Apply'}
          </button>
        </form>
      )}
      {!user && <p>Log in as a student to apply.</p>}
      {statusMessage && <p>{statusMessage}</p>}
    </div>
  );
}
