import { Routes, Route, Link, useNavigate, Navigate, useLocation } from 'react-router-dom';
import JobList from './pages/JobList.jsx';
import JobDetail from './pages/JobDetail.jsx';
import PostJob from './pages/PostJob.jsx';
import Login from './pages/Login.jsx';
import Signup from './pages/Signup.jsx';
import ClientDashboard from './pages/ClientDashboard.jsx';
import StudentDashboard from './pages/StudentDashboard.jsx';
import JobApplicants from './pages/JobApplicants.jsx';
import Profile from './pages/Profile.jsx';
import PublicProfile from './pages/PublicProfile.jsx';
import BottomNav from './components/BottomNav.jsx';
import { getUser, clearSession } from './api/auth';

// Guards routes that need a logged-in user (and optionally a specific role).
// The backend already rejects these requests without a valid token, but
// without this the page still renders and flashes a broken/empty UI before
// any request fails — this sends the user to /login (or "/") right away.
function ProtectedRoute({ role, children }) {
  const user = getUser();
  const location = useLocation();

  if (!user) {
    return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  }
  if (role && user.role !== role) {
    return <Navigate to="/" replace />;
  }
  return children;
}

function Logo() {
  return (
    <img src="/skillora-logo.svg" width="28" height="28" alt="" aria-hidden="true" />
  );
}

export default function App() {
  const user = getUser();
  const navigate = useNavigate();

  const logout = () => {
    clearSession();
    navigate('/');
  };

  return (
    <div>
      <nav className="nav">
        <Link to="/" className="brand">
          <Logo />
          <span className="brand-text">
            <span className="brand-name">Skillora</span>
            <span className="brand-tagline">Campus Freelance Marketplace</span>
          </span>
        </Link>
        <div className="nav-links">
          {user?.role === 'client' && <Link to="/post-job">Post a Job</Link>}
          {user?.role === 'client' && <Link to="/dashboard/client">My Jobs</Link>}
          {user?.role === 'student' && <Link to="/dashboard/student">My Applications</Link>}
          {user && <Link to="/profile">Profile</Link>}
          {!user && <Link to="/login">Login</Link>}
          {!user && <Link to="/signup">Sign up</Link>}
          {user && <a href="#" onClick={(e) => { e.preventDefault(); logout(); }}>Logout</a>}
        </div>
      </nav>
      <div className="container">
        <Routes>
          <Route path="/" element={<JobList />} />
          <Route path="/jobs/:id" element={<JobDetail />} />
          <Route path="/jobs/:id/applicants" element={<ProtectedRoute role="client"><JobApplicants /></ProtectedRoute>} />
          <Route path="/post-job" element={<ProtectedRoute role="client"><PostJob /></ProtectedRoute>} />
          <Route path="/dashboard/client" element={<ProtectedRoute role="client"><ClientDashboard /></ProtectedRoute>} />
          <Route path="/dashboard/student" element={<ProtectedRoute role="student"><StudentDashboard /></ProtectedRoute>} />
          <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
          <Route path="/users/:id" element={<PublicProfile />} />
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
        </Routes>
      </div>
      <footer className="footer">Made by SASU Lab</footer>
      <BottomNav user={user} />
    </div>
  );
}
