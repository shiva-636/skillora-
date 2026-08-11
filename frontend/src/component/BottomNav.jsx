import { Link, useLocation } from 'react-router-dom';

const ICONS = {
  home: <path d="M4 11.5 12 4l8 7.5M6 10v9h5v-5h2v5h5v-9" />,
  post: <path d="M12 5v14M5 12h14" />,
  briefcase: <path d="M4 8h16v11H4zM9 8V6a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2M4 13h16" />,
  file: <path d="M7 3h7l5 5v13H7zM14 3v5h5M9 12h6M9 16h6" />,
  user: <path d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM5 21a7 7 0 0 1 14 0" />,
  key: <path d="M14.5 9.5a4 4 0 1 0-4.9 3.9L4 19v2h3l1-1v-1.5h1.5L11 17v-1.5h1.5L15 13a4 4 0 0 0-.5-3.5Z" />,
  pencil: <path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />,
};

function Icon({ name }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      {ICONS[name]}
    </svg>
  );
}

// Tabs are role-aware and point only at routes that already exist and mean
// something distinct for that role — no filler tabs pointing at duplicate
// or dead pages just to fill out a fixed icon count.
function tabsFor(user) {
  if (!user) {
    return [
      { to: '/', label: 'Home', icon: 'home' },
      { to: '/login', label: 'Login', icon: 'key' },
      { to: '/signup', label: 'Sign up', icon: 'pencil' },
    ];
  }
  if (user.role === 'client') {
    return [
      { to: '/', label: 'Home', icon: 'home' },
      { to: '/post-job', label: 'Post', icon: 'post' },
      { to: '/dashboard/client', label: 'My Jobs', icon: 'briefcase' },
      { to: '/profile', label: 'Profile', icon: 'user' },
    ];
  }
  return [
    { to: '/', label: 'Jobs', icon: 'briefcase' },
    { to: '/dashboard/student', label: 'My Apps', icon: 'file' },
    { to: '/profile', label: 'Profile', icon: 'user' },
  ];
}

export default function BottomNav({ user }) {
  const location = useLocation();
  const tabs = tabsFor(user);

  return (
    <nav className="bottom-nav">
      {tabs.map((tab) => (
        <Link key={tab.to} to={tab.to} className={location.pathname === tab.to ? 'active' : ''}>
          <Icon name={tab.icon} />
          <span>{tab.label}</span>
        </Link>
      ))}
    </nav>
  );
}
