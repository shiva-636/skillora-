import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import client from '../api/client';

export default function PostJob() {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [budget, setBudget] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const navigate = useNavigate();

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      const res = await client.post('/jobs', { title, description, budget: budget ? Number(budget) : undefined });
      navigate(`/jobs/${res.data.id}`);
    } catch (err) {
      setError(err.response?.data?.error || 'Unable to post job. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div>
      <h2>Post an Opportunity</h2>
      <form onSubmit={submit} className="card">
        <input placeholder="Title" value={title} onChange={(e) => setTitle(e.target.value)} required />
        <textarea
          placeholder="Describe what you need (mention skills like React, Kotlin, Figma...)"
          rows={5}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          required
        />
        <input placeholder="Budget (₹)" type="number" min="0" value={budget} onChange={(e) => setBudget(e.target.value)} />
        {error && <p style={{ color: '#c0392b' }}>{error}</p>}
        <button className="btn" type="submit" disabled={submitting}>
          {submitting ? 'Posting...' : 'Post Job'}
        </button>
      </form>
    </div>
  );
}
