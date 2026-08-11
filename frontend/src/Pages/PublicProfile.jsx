import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import client from '../api/client';

export default function PublicProfile() {
  const { id } = useParams();
  const [profile, setProfile] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    client.get(`/users/${id}`)
      .then((res) => setProfile(res.data))
      .catch((err) => setError(err.response?.data?.error || 'Unable to load this profile.'));
  }, [id]);

  if (error) return <p style={{ color: '#c0392b' }}>{error}</p>;
  if (!profile) return <p>Loading...</p>;

  return (
    <div>
      <h2>{profile.name}</h2>
      <div className="card">
        <p>{profile.role} {profile.college && `• ${profile.college}`} {profile.department && `• ${profile.department}`}</p>
        <p>Rating: {profile.rating_avg ? `⭐ ${profile.rating_avg}` : 'No ratings yet'}</p>
        {profile.bio && <p>{profile.bio}</p>}
        {profile.github_url && (
          <p><a href={profile.github_url} target="_blank" rel="noreferrer">{profile.github_url}</a></p>
        )}
      </div>

      <h3>Skills</h3>
      {profile.skills.length === 0 && <p>No skills added yet.</p>}
      {profile.skills.map((s) => (
        <div className="card" key={s.name}>{s.name} — {s.proficiency}%</div>
      ))}

      <p style={{ marginTop: 16 }}><Link to="/">← Back to job listings</Link></p>
    </div>
  );
}
