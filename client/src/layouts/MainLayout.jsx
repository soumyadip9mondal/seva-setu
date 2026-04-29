import { useState } from 'react';
import { Link } from 'react-router-dom';
import Logo from '../components/Logo';
import { useAuth } from '../hooks/useAuth';
import {
  ChevronDown, Send, LogOut, Menu, X,
  LayoutDashboard, FileText, Users, MapPin, ClipboardCheck
} from 'lucide-react';

/* ── Role-based nav definitions ─────────────────────────────── */
const NAV_BY_ROLE = {
  coordinator: [
    { to: '/dashboard',            label: 'Dashboard',  Icon: LayoutDashboard },
    { to: '/needs-archive',        label: 'All Issues', Icon: FileText },
    { to: '/volunteer-approvals',  label: 'Volunteers', Icon: Users },
  ],
  volunteer: [
    { to: '/volunteer',   label: 'My Tasks',  Icon: ClipboardCheck },
    { to: '/my-reports',  label: 'Reports',   Icon: FileText },
  ],
  field_worker: [
    { to: '/field',       label: 'Report Need',  Icon: MapPin },
    { to: '/my-reports',  label: 'My Reports',   Icon: FileText },
  ],
  user: [
    { to: '/user-dashboard', label: 'Dashboard',   Icon: LayoutDashboard },
    { to: '/field',          label: 'Report Need', Icon: MapPin },
    { to: '/my-reports',     label: 'My Reports',  Icon: FileText },
  ],
};

const DASHBOARD_BY_ROLE = {
  coordinator:  '/dashboard',
  volunteer:    '/volunteer',
  field_worker: '/field',
  user:         '/user-dashboard',
};

const DASHBOARD_LABEL_BY_ROLE = {
  coordinator:  'Coordinator Hub',
  volunteer:    'Volunteer Console',
  field_worker: 'Field Terminal',
  user:         'My Dashboard',
};

const LANDING_NAV = [
  { href: '#features',  label: 'Features' },
  { href: '#workflow',  label: 'How It Works' },
  { href: '#roles',     label: 'Roles' },
];

const MainLayout = ({ children }) => {
  const { isAuthenticated, currentUser, logout } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const role = currentUser?.role;
  const authNavLinks = NAV_BY_ROLE[role] || [];

  const closeMenu = () => setMenuOpen(false);

  const handleLogout = () => {
    closeMenu();
    logout();
  };

  return (
    <div className="layout-root">

      {/* ── Navbar ─────────────────────────────────────────────── */}
      <header className="site-header">
        <nav className="container-lg nav-bar">

          {/* Logo */}
          <div className="nav-left">
            <Link
              to={isAuthenticated ? (DASHBOARD_BY_ROLE[role] || '/') : '/'}
              className="nav-logo-link"
              onClick={closeMenu}
            >
              <Logo size={32} />
              <span className="nav-logo-text">SevaSetu</span>
            </Link>

            {/* Desktop nav links */}
            <div className="nav-links-desktop">
              {!isAuthenticated
                ? LANDING_NAV.map(({ href, label }) => (
                    <a key={href} href={href} className="nav-link">{label}</a>
                  ))
                : authNavLinks.map(({ to, label }) => (
                    <Link key={to} to={to} className="nav-link">{label}</Link>
                  ))
              }
            </div>
          </div>

          {/* Right side — desktop */}
          <div className="nav-actions">
            {!isAuthenticated ? (
              <>
                <Link to="/login" className="nav-link">Sign in</Link>
                <Link to="/register" className="btn-primary nav-cta">Join the Mission</Link>
              </>
            ) : (
              <>
                {role && (
                  <span style={{
                    fontSize: '0.68rem', fontWeight: 700, textTransform: 'uppercase',
                    letterSpacing: '0.06em', padding: '0.25rem 0.65rem',
                    borderRadius: 9999, background: 'rgba(45, 97, 72, 0.08)',
                    border: '1px solid rgba(45, 97, 72, 0.18)', color: '#2d6148',
                  }}>
                    {role.replace('_', ' ')}
                  </span>
                )}

                {DASHBOARD_BY_ROLE[role] && (
                  <Link to={DASHBOARD_BY_ROLE[role]} className="btn-primary nav-cta">
                    {DASHBOARD_LABEL_BY_ROLE[role]}
                  </Link>
                )}

                <div className="nav-user-section">
                  <button
                    onClick={logout}
                    className="nav-link"
                    style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}
                  >
                    <LogOut size={14} />
                    Logout
                  </button>
                </div>
              </>
            )}

            {/* Hamburger — mobile only */}
            <button
              className="nav-hamburger"
              onClick={() => setMenuOpen(o => !o)}
              aria-label="Toggle menu"
              aria-expanded={menuOpen}
            >
              {menuOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
          </div>
        </nav>
      </header>

      {/* ── Mobile slide-down menu ─────────────────────────────── */}
      <div className={`nav-mobile-menu${menuOpen ? ' is-open' : ''}`} role="navigation">
        {!isAuthenticated ? (
          <>
            {LANDING_NAV.map(({ href, label }) => (
              <a key={href} href={href} className="nav-mobile-link" onClick={closeMenu}>{label}</a>
            ))}
            <div className="nav-mobile-divider" />
            <Link to="/login" className="nav-mobile-link" onClick={closeMenu}>Sign in</Link>
            <Link to="/register" className="nav-mobile-link nav-mobile-cta" onClick={closeMenu}>Join the Mission</Link>
          </>
        ) : (
          <>
            {role && (
              <span className="nav-mobile-role-badge">{role.replace('_', ' ')}</span>
            )}
            {authNavLinks.map(({ to, label, Icon }) => (
              <Link key={to} to={to} className="nav-mobile-link" onClick={closeMenu}>
                <Icon size={16} />
                {label}
              </Link>
            ))}
            <div className="nav-mobile-divider" />
            {DASHBOARD_BY_ROLE[role] && (
              <Link to={DASHBOARD_BY_ROLE[role]} className="nav-mobile-link nav-mobile-cta" onClick={closeMenu}>
                {DASHBOARD_LABEL_BY_ROLE[role]}
              </Link>
            )}
            <button
              onClick={handleLogout}
              className="nav-mobile-link"
              style={{ color: '#c35d51', fontWeight: 600, width: '100%', textAlign: 'left' }}
            >
              <LogOut size={16} />
              Logout
            </button>
          </>
        )}
      </div>

      {/* Overlay — closes menu when tapping outside */}
      {menuOpen && (
        <div
          onClick={closeMenu}
          style={{
            position: 'fixed', inset: 0, zIndex: 999,
            background: 'rgba(15, 23, 29, 0.2)',
            backdropFilter: 'blur(2px)',
          }}
        />
      )}

      {/* ── Page Content ──────────────────────────────────────── */}
      <main className="layout-main">
        {children}
      </main>

      {/* ── Footer ────────────────────────────────────────────── */}
      {!isAuthenticated ? (
        <footer className="site-footer">
          <div className="container-lg">
            <div className="footer-grid">
              <div className="footer-col-brand">
                <div className="footer-brand">
                  <Logo size={28} />
                  <span className="footer-brand-text">SevaSetu</span>
                </div>
                <p className="footer-desc">
                  An open initiative for community resilience and coordinated humanitarian response.
                </p>
              </div>

              <div className="footer-col">
                <h4>Platform</h4>
                <nav>
                  <a href="#features">Features</a>
                  <a href="#workflow">How It Works</a>
                  <a href="#roles">Roles</a>
                  <a href="#">Open Source</a>
                </nav>
              </div>

              <div className="footer-col">
                <h4>Resources</h4>
                <nav>
                  <a href="#">Help Center</a>
                  <a href="#">Docs</a>
                  <a href="#">Blog</a>
                  <a href="#">Case Studies</a>
                </nav>
              </div>

              <div className="footer-col">
                <h4>Company</h4>
                <nav>
                  <a href="#">About Us</a>
                  <a href="#">Contact</a>
                  <a href="#">Careers</a>
                </nav>
              </div>

              <div className="footer-col-newsletter">
                <h4>Stay Updated</h4>
                <p>Get updates on new features and impact stories.</p>
                <div className="footer-newsletter-form">
                  <input type="email" placeholder="Enter your email" />
                  <button type="button"><Send size={16} /></button>
                </div>
              </div>
            </div>

            <div className="footer-bottom">
              <p className="footer-copy">
                © 2026 SevaSetu Open Initiative — Community resilience, powered by AI.
              </p>
              <div className="footer-legal">
                <a href="#">Privacy</a>
                <a href="#">Terms</a>
                <a href="#">GitHub</a>
              </div>
            </div>
          </div>
        </footer>
      ) : (
        <footer style={{
          borderTop: '1px solid rgba(15, 23, 29, 0.06)',
          background: '#ffffff',
          padding: '1rem 0',
        }}>
          <div className="container-lg" style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            flexWrap: 'wrap', gap: '0.5rem',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Logo size={20} />
              <span style={{ fontSize: '0.8rem', fontWeight: 600, color: '#64748b' }}>SevaSetu</span>
            </div>
            <p style={{ fontSize: '0.72rem', color: '#94a3b8' }}>
              © 2026 SevaSetu Open Initiative
            </p>
          </div>
        </footer>
      )}
    </div>
  );
};

export default MainLayout;
