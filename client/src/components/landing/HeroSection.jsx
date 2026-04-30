import { Link } from 'react-router-dom';
import { ArrowRight, BarChart3, Clock, CheckCircle2, Globe, MapPinned, UsersRound, Send } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';

const HeroSection = () => {
  const { isAuthenticated } = useAuth();

  return (
    <section className="landing-hero-revamp">
      <div className="container-lg">
        <div className="landing-hero-grid">
          <div className="landing-hero-copy">
            <h1 className="landing-display">
              When every second matters, <span>intelligence saves lives.</span>
            </h1>
            <p className="landing-subcopy">
              SevaSetu is the AI-powered operating layer for NGOs—turning scattered field reports into verified, prioritized, and coordinated relief missions.
            </p>
            <div className="landing-hero-actions">
              <Link to="/register" className="btn-primary">
                Start Coordinating
                <ArrowRight aria-hidden="true" size={18} />
              </Link>
              <a 
                href="#real-impact" 
                onClick={(e) => {
                  e.preventDefault();
                  document.getElementById('real-impact')?.scrollIntoView({ behavior: 'smooth' });
                }} 
                className="btn-ghost"
              >
                See Real Impact
                <Send aria-hidden="true" size={18} />
              </a>
            </div>
            
            <div className="hero-social-proof">
              <div className="avatar-group">
                <img src="https://i.pravatar.cc/100?u=1" alt="User" />
                <img src="https://i.pravatar.cc/100?u=2" alt="User" />
                <img src="https://i.pravatar.cc/100?u=3" alt="User" />
              </div>
              <p>Trusted by 50+ NGOs & 10,000+ responders</p>
            </div>
          </div>

          <div className="hero-illustration">
            <div className="dashboard-mockup">
              {/* ... existing mockup content ... */}
              <div className="mockup-sidebar">
                <div className="sidebar-dot" />
                <div className="sidebar-dot" />
                <div className="sidebar-dot" />
              </div>
              <div className="mockup-main">
                <div className="mockup-header">
                  <div className="header-left">
                    <span>Needs Intelligence</span>
                    <em className="status-badge">Live</em>
                  </div>
                  <div className="header-right">
                    <strong>Coordination Zone: Kolkata</strong>
                  </div>
                </div>
                
                <div className="mockup-stats">
                  <div className="mockup-stat">
                    <span className="stat-label">Total Needs</span>
                    <span className="stat-value">24 <em className="stat-trend">+12%</em></span>
                  </div>
                  <div className="mockup-stat">
                    <span className="stat-label">Dispatched</span>
                    <span className="stat-value">18 <em className="status-dot pending" /></span>
                  </div>
                  <div className="mockup-stat">
                    <span className="stat-label">Verified Resolved</span>
                    <span className="stat-value">14 <em className="status-dot success" /></span>
                  </div>
                </div>

                <div className="mockup-map-view">
                  <div className="mockup-map">
                    <div className="map-grid" />
                    <div className="map-pin pin-1" />
                    <div className="map-pin pin-2" />
                    <div className="map-pin pin-3" />
                    <div className="map-overlay-card">
                      <div className="overlay-header">
                        <strong>Medical Help Needed</strong>
                        <span>Ward 12 • Urgency 9.2</span>
                      </div>
                      <div className="overlay-meta">
                        <Clock size={12} /> 12min ago
                      </div>
                      <div className="overlay-actions">
                        <em className="priority-high">High Priority</em>
                        <button className="btn-mini">View</button>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="mockup-footer">
                  <div className="footer-status-bar">
                    <div className="status-item"><Globe size={14} /> Logged</div>
                    <div className="status-item active"><MapPinned size={14} /> Scored</div>
                    <div className="status-item"><UsersRound size={14} /> Matched</div>
                    <div className="status-item"><Clock size={14} /> Active</div>
                    <div className="status-item"><CheckCircle2 size={14} /> Resolved</div>
                  </div>
                  <div className="footer-meta">
                    <span><CheckCircle2 size={14} /> Normalized Urgency Scale: 1-10</span>
                    <span>System synced 2min ago</span>
                  </div>
                </div>
              </div>
            </div>
            {/* Floating Detail Photo */}
            <div className="hero-floating-photo">
              <img src="https://images.unsplash.com/photo-1517048676732-d65bc937f952?auto=format&fit=crop&q=80&w=400" alt="Coordination Center" />
              <div className="photo-badge">
                <UsersRound size={12} /> 12 Responders Online
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default HeroSection;
