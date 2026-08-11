import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import client from '../api/client';
import { getUser } from '../api/auth';

function ClientJobCard({ job, updatingId, onUpdateStatus }) {
  return (
    <div className="client-job-card">
      <div className="client-job-top">
        <h3><Link to={`/jobs/${job.id}`}>{job.title}</Link></h3>
        <span className={`status-pill ${job.status}`}>{job.status.replace('_', ' ')}</span>
      </div>
      <p className="client-job-meta">
        {job.budget != null && `₹${Number(job.budget).toLocaleString('en-IN')} • `}
        {job.application_count} application{job.application_count === '1' ? '' : 's'}
      </p>
      <div className="client-job-actions">
        <Link className="btn btn-sm" to={`/jobs/${job.id}/applicants`}>View Applicants</Link>
        {job.status === 'open' && (
          <button
            className="btn btn-sm btn-outline" disabled={updatingId === job.id}
            onClick={() => onUpdateStatus(job.id, 'in_progress')}
          >
            Mark In Progress
          </button>
        )}
        {job.status === 'in_progress' && (
          <button
            className="btn btn-sm btn-outline" disabled={updatingId === job.id}
            onClick={() => onUpdateStatus(job.id, 'completed')}
          >
            Mark Completed
          </button>
        )}
        {(job.status === 'open' || job.status === 'in_progress') && (
          <button
            className="btn btn-sm btn-danger-outline" disabled={updatingId === job.id}
            onClick={() => onUpdateStatus(job.id, 'cancelled')}
          >
            Cancel Job
          </button>
        )}
      </div>
    </div>
  );
}

export default function ClientDashboard() {
  const user = getUser();
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [updatingId, setUpdatingId] = useState(null);

  const load = () => {
    setLoading(true);
    client.get('/jobs/mine')
      .then((res) => { setJobs(res.data); setError(''); })
      .catch(() => setError('Unable to load your jobs.'))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const updateJobStatus = async (jobId, status) => {
    setUpdatingId(jobId);
    try {
      await client.patch(`/jobs/${jobId}/status`, { status });
      load();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to update job status');
    } finally {
      setUpdatingId(null);
    }
  };

  const activeJobs = jobs.filter((j) => j.status === 'open' || j.status === 'in_progress').length;
  const totalApplications = jobs.reduce((sum, j) => sum + (Number(j.application_count) || 0), 0);
  const firstName = (user?.name || '').split(' ')[0];

  return (
    <div>
      <h2 className="dash-greeting">Find the right talent{firstName ? `, ${firstName}` : ''}.</h2>
      <p className="dash-subtext">Here's how your postings are doing.</p>

      {!loading && !error && jobs.length > 0 && (
        <div className="stat-row">
          <div className="stat-simple">
            <div className="num">{activeJobs}</div>
            <div className="lbl">Active Jobs</div>
          </div>
          <div className="stat-simple">
            <div className="num">{totalApplications}</div>
            <div className="lbl">Applications</div>
          </div>
        </div>
      )}

      <div className="section-head">
        <h3>Your Jobs</h3>
        <Link className="section-link" to="/post-job">Post a job</Link>
      </div>

      {loading && (
        <div className="job-grid">
          {[0, 1].map((i) => <div key={i} className="skeleton" style={{ height: 120 }} />)}
        </div>
      )}
      {!loading && error && <div className="empty-state">{error}</div>}
      {!loading && !error && jobs.length === 0 && (
        <div className="empty-state">You haven't posted any jobs yet. <Link to="/post-job">Post one</Link>.</div>
      )}
      {!loading && !error && jobs.length > 0 && (
        <div className="job-grid">
          {jobs.map((job) => (
            <ClientJobCard key={job.id} job={job} updatingId={updatingId} onUpdateStatus={updateJobStatus} />
          ))}
        </div>
      )}
    </div>
  );
}
