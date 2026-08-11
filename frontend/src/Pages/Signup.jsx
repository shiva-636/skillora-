import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import client from '../api/client';
import { saveSession } from '../api/auth';

export default function Signup() {
  const location = useLocation();
  const verifyEmail = location.state?.verifyEmail || '';

  const [name, setName] = useState('');
  const [college_email, setEmail] = useState(verifyEmail);
  const [password, setPassword] = useState('');
  const [college, setCollege] = useState('');
  const [role, setRole] = useState('student');
  const [error, setError] = useState('');
  // Arriving from Login's "Resend verification code" skips straight to
  // the OTP screen — a code has already been sent for this email.
  const [step, setStep] = useState(verifyEmail ? 'verify' : 'signup'); // 'signup' | 'verify'
  const [otp, setOtp] = useState('');
  const [devOtp, setDevOtp] = useState(null);
  const [info, setInfo] = useState(verifyEmail ? 'A new code has been sent to your college email.' : '');
  const navigate = useNavigate();

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    try {
      const res = await client.post('/auth/signup', { name, college_email, password, college, role });
      setInfo(res.data.message || 'Check your college email for a verification code.');
      setDevOtp(res.data.devOtp || null);
      setStep('verify');
    } catch (err) {
      const data = err.response?.data;
      if (data?.needsVerification) {
        // Account exists but was never verified — send them straight to
        // the OTP screen instead of a dead-end error.
        setEmail(data.college_email || college_email);
        setInfo('This email already started signing up. Enter the code sent to it, or resend a new one below.');
        setStep('verify');
        return;
      }
      setError(data?.error || 'Signup failed. Please try again.');
    }
  };

  const verify = async (e) => {
    e.preventDefault();
    setError('');
    try {
      const res = await client.post('/auth/verify-otp', { college_email, otp });
      saveSession(res.data.user, res.data.token);
      // Use the verified account's actual role from the server, not the local
      // `role` state — that state is never set when arriving via Login's
      // "Resend verification code" flow (it stays at its 'student' default),
      // which previously misrouted verified clients to the student dashboard.
      navigate(res.data.user.role === 'client' ? '/dashboard/client' : '/dashboard/student');
    } catch (err) {
      const data = err.response?.data;
      const remaining = data?.attemptsRemaining;
      setError(
        data?.error
          ? `${data.error}${typeof remaining === 'number' ? ` (${remaining} attempt${remaining === 1 ? '' : 's'} left)` : ''}`
          : 'Verification failed. Please try again.'
      );
    }
  };

  const resend = async () => {
    setError('');
    setInfo('');
    try {
      const res = await client.post('/auth/resend-otp', { college_email });
      setInfo(res.data.message || 'A new code has been sent.');
      setDevOtp(res.data.devOtp || null);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to resend code.');
    }
  };

  if (step === 'verify') {
    return (
      <div>
        <h2>Verify your email</h2>
        <form onSubmit={verify} className="card">
          <p>{info}</p>
          {devOtp && (
            <p style={{ color: '#888' }}>
              (Dev mode — no email service is wired up yet, so here's your code: <strong>{devOtp}</strong>)
            </p>
          )}
          <input
            placeholder="6-digit code" value={otp}
            onChange={(e) => setOtp(e.target.value)} required maxLength={6}
          />
          {error && <p style={{ color: '#c0392b' }}>{error}</p>}
          <button className="btn" type="submit">Verify & continue</button>
          <button type="button" className="btn" style={{ background: '#888', marginLeft: 8 }} onClick={resend}>
            Resend code
          </button>
        </form>
      </div>
    );
  }

  return (
    <div>
      <h2>Sign up</h2>
      <form onSubmit={submit} className="card">
        <label>I am a...</label>
        <select value={role} onChange={(e) => setRole(e.target.value)}>
          <option value="student">Student (looking for opportunities)</option>
          <option value="client">Client (posting opportunities)</option>
        </select>
        <input placeholder="Full name" value={name} onChange={(e) => setName(e.target.value)} required />
        <input placeholder="College email (.edu / .ac.xx)" value={college_email} onChange={(e) => setEmail(e.target.value)} required />
        <input placeholder="College name" value={college} onChange={(e) => setCollege(e.target.value)} />
        <input placeholder="Password (min 8 characters)" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} />
        {error && <p style={{ color: '#c0392b' }}>{error}</p>}
        <button className="btn" type="submit">Create account</button>
      </form>
    </div>
  );
}
