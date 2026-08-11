import { useEffect, useState } from 'react';
import client from '../api/client';
import { getUser } from '../api/auth';

export default function Profile() {
  const user = getUser();
  const [profile, setProfile] = useState(null);
  const [skillName, setSkillName] = useState('');
  const [proficiency, setProficiency] = useState(50);
  const [error, setError] = useState('');

  const [editing, setEditing] = useState(false);
  const [bio, setBio] = useState('');
  const [githubUrl, setGithubUrl] = useState('');
  const [college, setCollege] = useState('');
  const [department, setDepartment] = useState('');
  const [saving, setSaving] = useState(false);
  const [editError, setEditError] = useState('');

  const load = () => {
    if (!user) return;
    client.get(`/users/${user.id}`).then((res) => {
      setProfile(res.data);
      setBio(res.data.bio || '');
      setGithubUrl(res.data.github_url || '');
      setCollege(res.data.college || '');
      setDepartment(res.data.department || '');
    }).catch(() => {});
  };

  useEffect(load, [user?.id]);

  const startEditing = () => {
    setBio(profile.bio || '');
    setGithubUrl(profile.github_url || '');
    setCollege(profile.college || '');
    setDepartment(profile.department || '');
    setEditError('');
    setEditing(true);
  };

  const saveProfile = async (e) => {
    e.preventDefault();
    setEditError('');
    setSaving(true);
    try {
      await client.patch('/users/me', { bio, github_url: githubUrl, college, department });
      setEditing(false);
      load();
    } catch (err) {
      setEditError(err.response?.data?.error || 'Failed to save profile.');
    } finally {
      setSaving(false);
    }
  };

  const addSkill = async (e) => {
    e.preventDefault();
    setError('');
    try {
      await client.post('/users/me/skills', { skill: skillName, proficiency: Number(proficiency) });
      setSkillName('');
      setProficiency(50);
      load();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to add skill.');
    }
  };

  const removeSkill = async (name) => {
    await client.delete(`/users/me/skills/${encodeURIComponent(name)}`);
    load();
  };

  if (!user) return <p>Log in to view your profile.</p>;
  if (!profile) return <p>Loading...</p>;

  return (
    <div>
      <h2>My Profile</h2>
      {!editing ? (
        <div className="card">
          <p><strong>{profile.name}</strong> ({profile.role})</p>
          <p>{profile.college} {profile.department && `• ${profile.department}`}</p>
          <p>Rating: {profile.rating_avg || 'No ratings yet'}</p>
          {profile.bio && <p>{profile.bio}</p>}
          {profile.github_url && (
            <p><a href={profile.github_url} target="_blank" rel="noreferrer">{profile.github_url}</a></p>
          )}
          <button className="btn" onClick={startEditing}>Edit Profile</button>
        </div>
      ) : (
        <form onSubmit={saveProfile} className="card">
          <label>Bio</label>
          <textarea
            placeholder="Tell clients a bit about yourself"
            value={bio} onChange={(e) => setBio(e.target.value)} rows={3}
          />
          <label>GitHub URL</label>
          <input
            placeholder="https://github.com/yourusername"
            value={githubUrl} onChange={(e) => setGithubUrl(e.target.value)}
          />
          <label>College</label>
          <input placeholder="College name" value={college} onChange={(e) => setCollege(e.target.value)} />
          <label>Department</label>
          <input placeholder="Department" value={department} onChange={(e) => setDepartment(e.target.value)} />
          {editError && <p style={{ color: '#c0392b' }}>{editError}</p>}
          <button className="btn" type="submit" disabled={saving}>{saving ? 'Saving...' : 'Save'}</button>
          <button
            type="button" className="btn" style={{ background: '#888', marginLeft: 8 }}
            onClick={() => setEditing(false)} disabled={saving}
          >
            Cancel
          </button>
        </form>
      )}

      <h3>Skills</h3>
      {profile.skills.length === 0 && <p>No skills added yet.</p>}
      {profile.skills.map((s) => (
        <div className="card" key={s.name}>
          {s.name} — {s.proficiency}%{' '}
          <button className="btn" style={{ background: '#c0392b' }} onClick={() => removeSkill(s.name)}>Remove</button>
        </div>
      ))}

      <form onSubmit={addSkill} className="card">
        <input placeholder="Skill (e.g. React)" value={skillName} onChange={(e) => setSkillName(e.target.value)} required />
        <input
          type="number" min="0" max="100" placeholder="Proficiency %"
          value={proficiency} onChange={(e) => setProficiency(e.target.value)}
        />
        {error && <p style={{ color: '#c0392b' }}>{error}</p>}
        <button className="btn" type="submit">+ Add Skill</button>
      </form>
    </div>
  );
}
