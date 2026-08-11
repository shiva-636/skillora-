import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import client from '../api/client';
import { saveSession } from '../api/auth';

export default function Login() {
  const [college_email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [needsVerification, setNeedsVerification] = useState(false);
  const [resending, setResending] = useState(false);
  const navigate = useNavigate();

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setNeedsVerification(false);
    try {
      const res = await client.post('/auth/login', { college_email, password });
      saveSession(res.data.user, res.data.token);
      navigate(res.data.user.role === 'client' ? '/dashboard/client' : '/dashboard/student');
    } catch (err) {
      setError(err.response?.data?.error || 'Login failed. Please check your credentials.');
      setNeedsVerification(Boolean(err.response?.data?.needsVerification));
    }
  };

  // Lets a user who closed the browser mid-signup get back to the OTP
  // screen directly, instead of bouncing to Signup and hitting
  // "account already exists" with no way forward.
  const resendVerification = async () => {
    setError('');
    setResending(true);
    try {
      await client.post('/auth/resend-otp', { college_email });
      navigate('/signup', { state: { verifyEmail: college_email } });
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to resend code.');
    } finally {
      setResending(false);
    }
  };

  return (
    <div>
      <h2>Login</h2>
      <form onSubmit={submit} className="card">
        <input placeholder="College email" value={college_email} onChange={(e) => setEmail(e.target.value)} required />
        <input placeholder="Password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        {error && <p style={{ color: '#c0392b' }}>{error}</p>}
        {needsVerification && (
          <p>
            <button
              type="button"
              className="btn"
              style={{ background: '#888' }}
              onClick={resendVerification}
              disabled={resending || !college_email}
            >
              {resending ? 'Sending...' : 'Resend verification code'}
            </button>
          </p>
        )}
        <button className="btn" type="submit">Login</button>
      </form>
    </div>
  );
}
