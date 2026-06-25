import React, { useState, useEffect, useRef } from 'react';
import API_BASE_URL from './config/api';
import Sidebar from './components/Sidebar';
import Dashboard from './pages/Dashboard';
import Telecallers from './pages/Telecallers';
import Campaigns from './pages/Campaigns';
import Contacts from './pages/Contacts';
import CallLogs from './pages/CallLogs';
import TelecallerAccounts from './pages/TelecallerAccounts';
import MonitorGrid from './pages/MonitorGrid';
import RegisterCompany from './components/RegisterCompany';
import Companies from './pages/Companies';
import BillingPage from './pages/BillingPage';
import HelpDesk from './pages/HelpDesk';
import SupportTickets from './pages/SupportTickets';
import { Mail, Lock, LogIn, AlertCircle, Menu, X, ShieldCheck, ArrowLeft, RefreshCw, Phone, Users, TrendingUp, Shield, Zap, Building2, Eye, EyeOff } from 'lucide-react';
import Logo from './components/Logo';

// Interactive Network Constellation Background Animation
const ConstellationCanvas = () => {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let animationFrameId;

    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    const handleResize = () => {
      if (!canvas) return;
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    };
    window.addEventListener('resize', handleResize);

    const particles = [];
    const particleCount = Math.min(75, Math.floor((width * height) / 20000));
    const connectionDistance = 115;
    const mouse = { x: null, y: null, radius: 140 };

    class Particle {
      constructor() {
        this.x = Math.random() * width;
        this.y = Math.random() * height;
        this.vx = (Math.random() - 0.5) * 0.35;
        this.vy = (Math.random() - 0.5) * 0.35;
        this.radius = Math.random() * 2 + 1.25;
      }

      update() {
        this.x += this.vx;
        this.y += this.vy;

        if (this.x < 0 || this.x > width) this.vx = -this.vx;
        if (this.y < 0 || this.y > height) this.vy = -this.vy;

        if (mouse.x !== null && mouse.y !== null) {
          const dx = mouse.x - this.x;
          const dy = mouse.y - this.y;
          const dist = Math.hypot(dx, dy);
          if (dist < mouse.radius) {
            const force = (mouse.radius - dist) / mouse.radius;
            this.x += (dx / dist) * force * 0.25;
            this.y += (dy / dist) * force * 0.25;
          }
        }
      }

      draw() {
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(167, 139, 250, 0.45)';
        ctx.fill();
      }
    }

    for (let i = 0; i < particleCount; i++) {
      particles.push(new Particle());
    }

    const handleMouseMove = (e) => {
      mouse.x = e.clientX;
      mouse.y = e.clientY;
    };

    const handleMouseLeave = () => {
      mouse.x = null;
      mouse.y = null;
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseleave', handleMouseLeave);

    const animate = () => {
      ctx.clearRect(0, 0, width, height);

      particles.forEach((p) => {
        p.update();
        p.draw();
      });

      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const dx = particles[i].x - particles[j].x;
          const dy = particles[i].y - particles[j].y;
          const dist = Math.hypot(dx, dy);

          if (dist < connectionDistance) {
            const alpha = (1 - dist / connectionDistance) * 0.16;
            ctx.beginPath();
            ctx.moveTo(particles[i].x, particles[i].y);
            ctx.lineTo(particles[j].x, particles[j].y);
            ctx.strokeStyle = `rgba(34, 211, 238, ${alpha})`;
            ctx.lineWidth = 0.75;
            ctx.stroke();
          }
        }

        if (mouse.x !== null && mouse.y !== null) {
          const dx = particles[i].x - mouse.x;
          const dy = particles[i].y - mouse.y;
          const dist = Math.hypot(dx, dy);
          if (dist < mouse.radius) {
            const alpha = (1 - dist / mouse.radius) * 0.22;
            ctx.beginPath();
            ctx.moveTo(particles[i].x, particles[i].y);
            ctx.lineTo(mouse.x, mouse.y);
            ctx.strokeStyle = `rgba(167, 139, 250, ${alpha})`;
            ctx.lineWidth = 0.9;
            ctx.stroke();
          }
        }
      }

      animationFrameId = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseleave', handleMouseLeave);
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  return <canvas ref={canvasRef} className="login-canvas" />;
};

// Premium Dual-Pane Layout Frame
const AuthLayoutWrapper = ({ children, theme, toggleTheme, liveCalls, agentsOnline, dialSuccess }) => {
  return (
    <div className="login-layout-container">
      <ConstellationCanvas />
      
      {/* Theme Toggle Button */}
      <button onClick={toggleTheme} className="login-theme-toggle" aria-label="Toggle Theme">
        {theme === 'dark' ? (
          <>
            <span style={{ fontSize: '1rem', display: 'flex', alignItems: 'center' }}>☀️</span>
            <span>Light Mode</span>
          </>
        ) : (
          <>
            <span style={{ fontSize: '1rem', display: 'flex', alignItems: 'center' }}>🌙</span>
            <span>Dark Mode</span>
          </>
        )}
      </button>

      {/* Left Pane (Informational & Branding) */}
      <div className="login-left-pane">
        <div className="left-pane-header">
          <Logo theme="dark" mode="sidebar" />
          <span className="left-pane-subtitle">SIM-BASED AUTO DIALER ADMIN PANEL</span>
        </div>

        <div className="left-pane-content">
          <h1 className="left-pane-title">
            Intelligent <br />
            <span className="gradient-text">Call Management.</span>
          </h1>
          <p className="left-pane-description">
            Automate your telecalling operations with AI-powered dialing, real-time analytics, and seamless agent management.
          </p>

          <div className="left-pane-stats-grid">
            {/* Stat 1: Live Calls */}
            <div className="stat-glass-card">
              <div className="stat-card-header">
                <div className="stat-card-icon-wrapper purple">
                  <Phone size={18} />
                </div>
                <span className="stat-card-badge green">+12%</span>
              </div>
              <div className="stat-card-body">
                <h3 className="stat-card-number">{liveCalls.toLocaleString()}</h3>
                <p className="stat-card-label">Live Calls</p>
              </div>
            </div>

            {/* Stat 2: Agents Online */}
            <div className="stat-glass-card">
              <div className="stat-card-header">
                <div className="stat-card-icon-wrapper blue">
                  <Users size={18} />
                </div>
                <span className="stat-card-badge green">+3</span>
              </div>
              <div className="stat-card-body">
                <h3 className="stat-card-number">{agentsOnline}</h3>
                <p className="stat-card-label">Agents Online</p>
              </div>
            </div>

            {/* Stat 3: Dial Success */}
            <div className="stat-glass-card">
              <div className="stat-card-header">
                <div className="stat-card-icon-wrapper green">
                  <TrendingUp size={18} />
                </div>
                <span className="stat-card-badge green">+1.4%</span>
              </div>
              <div className="stat-card-body">
                <h3 className="stat-card-number">{dialSuccess}%</h3>
                <p className="stat-card-label">Dial Success</p>
              </div>
            </div>

            {/* Stat 4: Uptime */}
            <div className="stat-glass-card">
              <div className="stat-card-header">
                <div className="stat-card-icon-wrapper cyan">
                  <Shield size={18} />
                </div>
                <span className="stat-card-badge green">30d</span>
              </div>
              <div className="stat-card-body">
                <h3 className="stat-card-number">99.9%</h3>
                <p className="stat-card-label">Uptime</p>
              </div>
            </div>
          </div>
        </div>

        <div className="left-pane-footer">
          <span>Enterprise-grade security · Trusted by 500+ businesses</span>
        </div>
      </div>

      {/* Right Pane (Card Holder) */}
      <div className="login-right-pane">
        {children}
      </div>
    </div>
  );
};


const App = () => {
  const [token, setToken] = useState(localStorage.getItem('token'));
  const [user, setUser] = useState(null);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [theme, setTheme] = useState(localStorage.getItem('theme') || 'light');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isRegistering, setIsRegistering] = useState(false);
  const [subscriptionExpired, setSubscriptionExpired] = useState(false);
  const [loginType, setLoginType] = useState('company'); // 'company' or 'superadmin'
  const [showLogin, setShowLogin] = useState(false);
  const [showDemoPage, setShowDemoPage] = useState(false);
  const [demoName, setDemoName] = useState('');
  const [demoEmail, setDemoEmail] = useState('');
  const [demoLoading, setDemoLoading] = useState(false);
  const [demoError, setDemoError] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Oscillating metrics for left pane stats card
  const [liveCalls, setLiveCalls] = useState(2841);
  const [agentsOnline, setAgentsOnline] = useState(147);
  const [dialSuccess, setDialSuccess] = useState(94.2);

  useEffect(() => {
    const interval = setInterval(() => {
      setLiveCalls(prev => {
        const delta = Math.floor(Math.random() * 5) - 2; // -2 to +2
        const next = prev + delta;
        return next > 2800 && next < 2900 ? next : 2841;
      });
      setAgentsOnline(prev => {
        const delta = Math.floor(Math.random() * 3) - 1; // -1 to +1
        const next = prev + delta;
        return next > 130 && next < 160 ? next : 147;
      });
      setDialSuccess(prev => {
        const delta = (Math.random() * 0.2 - 0.1); // -0.1% to +0.1%
        const next = parseFloat((prev + delta).toFixed(1));
        return next > 92 && next < 97 ? next : 94.2;
      });
    }, 4000);

    return () => clearInterval(interval);
  }, []);


  useEffect(() => {
    const handleUrlParams = () => {
      const params = new URLSearchParams(window.location.search);
      if (params.get('demo') === 'true') {
        setShowDemoPage(true);
        setShowLogin(false);
        setIsRegistering(false);
      } else if (params.get('login') === 'true') {
        setShowDemoPage(false);
        setShowLogin(true);
        if (params.get('register') === 'true') {
          setIsRegistering(true);
        } else {
          setIsRegistering(false);
        }
        if (params.get('type') === 'superadmin') {
          setLoginType('superadmin');
        } else {
          setLoginType('company');
        }
      } else {
        setShowDemoPage(false);
        setShowLogin(false);
      }
    };

    handleUrlParams();
    window.addEventListener('popstate', handleUrlParams);
    return () => window.removeEventListener('popstate', handleUrlParams);
  }, []);
  
  // Login Form States
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [loggingIn, setLoggingIn] = useState(false);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prev => {
      const next = prev === 'dark' ? 'light' : 'dark';
      localStorage.setItem('theme', next);
      return next;
    });
  };

  useEffect(() => {
    if (token) {
      // Validate token & get current user
      fetch(`${API_BASE_URL}/api/auth/me`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })
      .then(res => {
        if (!res.ok) {
          throw new Error('Token validation failed');
        }
        return res.json();
      })
      .then(userData => {
        if (userData.role !== 'admin') {
          throw new Error('Unauthorized role access.');
        }
        setUser(userData);
        // Check subscription expiry for company admins
        if (userData.companyRegNum && userData.subscriptionEnd) {
          const now = new Date();
          let expiryStr = userData.subscriptionEnd;
          if (!expiryStr.includes('Z') && !expiryStr.includes('T')) {
            expiryStr = expiryStr.replace(' ', 'T') + 'Z';
          }
          const expiry = new Date(expiryStr);
          if (expiry < now) {
            setSubscriptionExpired(true);
          } else {
            setSubscriptionExpired(false);
          }
        }
      })
      .catch(err => {
        console.error(err);
        handleLogout();
      });
    }
  }, [token]);

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoginError('');
    
    if (!email || !password) {
      setLoginError('Please enter both email and password.');
      return;
    }

    setLoggingIn(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Login failed.');
      }

      if (data.user.role !== 'admin') {
        throw new Error('Access denied. Telecallers must use the mobile application.');
      }

      localStorage.setItem('token', data.token);
      setToken(data.token);
      setUser(data.user);
      setActiveTab('dashboard');
    } catch (err) {
      setLoginError(err.message);
    } finally {
      setLoggingIn(false);
    }
  };

  const handleDemoRequestSubmit = async (e) => {
    e.preventDefault();
    setDemoError('');
    setDemoLoading(true);

    if (!demoName || !demoEmail) {
      setDemoError('Please provide both name and email.');
      setDemoLoading(false);
      return;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/api/auth/register-demo-company`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name: demoName, email: demoEmail })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to initialize demo workspace.');
      }

      // Auto-login with the returned token & user details
      localStorage.setItem('token', data.token);
      setToken(data.token);
      setUser(data.user);
      setActiveTab('dashboard');
      setShowDemoPage(false);
    } catch (err) {
      setDemoError(err.message);
    } finally {
      setDemoLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    setToken(null);
    setUser(null);
  };

  const renderActivePage = () => {
    // 1. Eazzio Admin Pages (Superadmin)
    if (user && (user.companyRegNum === null || user.email === 'tellecaller111@eazzio.com')) {
      switch (activeTab) {
        case 'dashboard':
          return <Dashboard setActiveTab={setActiveTab} theme={theme} user={user} />;
        case 'monitor-grid':
          return <Companies />;
        case 'support':
          return <SupportTickets />;
        case 'billing':
          return <BillingPage theme={theme} user={user} />;
        default:
          return <Dashboard setActiveTab={setActiveTab} theme={theme} user={user} />;
      }
    }

    // 2. Company Admin Pages (Original)
    switch (activeTab) {
      case 'dashboard':
        return <Dashboard setActiveTab={setActiveTab} theme={theme} user={user} />;
      case 'telecallers':
        return <Telecallers />;
      case 'monitor-grid':
        return <MonitorGrid />;
      case 'campaigns':
        return <Campaigns user={user} />;
      case 'contacts':
        return <Contacts />;
      case 'call-logs':
        return <CallLogs user={user} />;
      case 'accounts':
        return <TelecallerAccounts />;
      case 'billing':
        return <BillingPage theme={theme} user={user} />;
      case 'help-desk':
        return <HelpDesk user={user} />;
      default:
        return <Dashboard setActiveTab={setActiveTab} theme={theme} user={user} />;
    }
  };

  // Render Website / Login Screen if not authenticated
  if (!token || !user) {
    if (!showLogin && !showDemoPage) {
      return (
        <iframe 
          src="/landing.html" 
          style={{
            border: 'none',
            width: '100vw',
            height: '100vh',
            display: 'block',
            margin: 0,
            padding: 0,
            overflow: 'hidden'
          }}
          title="Eazzio FAST Telecaller & CRM"
        />
      );
    }

    if (showDemoPage) {
      return (
        <AuthLayoutWrapper theme={theme} toggleTheme={toggleTheme} liveCalls={liveCalls} agentsOnline={agentsOnline} dialSuccess={dialSuccess}>
          <div className="login-glass-card-premium" style={{ padding: '3rem 2.5rem', maxWidth: '480px' }}>
            <div style={{ alignSelf: 'flex-start', marginBottom: '1.5rem', display: 'flex', width: '100%' }}>
              <button
                onClick={() => {
                  window.history.pushState({}, '', '/');
                  setShowDemoPage(false);
                }}
                className="auth-footer-link-secondary"
              >
                <ArrowLeft size={16} />
                Back to Website
              </button>
            </div>

            <div style={{ textAlign: 'center', marginBottom: '1.5rem', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
              <Logo theme={theme} mode="login" />
              <p style={{ color: 'var(--text-secondary)', fontSize: '1.05rem', marginTop: '10px', fontWeight: '600' }}>Request 5-Minute Interactive Demo</p>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem', marginTop: '6px', lineHeight: '1.4' }}>
                Type your details below to get instant admin access to a fully seeded, read-only demo workspace.
              </p>
            </div>

            <form onSubmit={handleDemoRequestSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              {demoError && (
                <div style={styles.errorAlert}>
                  <AlertCircle size={18} style={{ flexShrink: 0 }} />
                  <span>{demoError}</span>
                </div>
              )}

              <div className="form-group">
                <label className="auth-input-label">Full Name</label>
                <div className="auth-input-container">
                  <span style={{ position: 'absolute', left: '14px', fontSize: '1.2rem', color: '#475569', pointerEvents: 'none' }}>👤</span>
                  <input 
                    type="text" 
                    placeholder="Enter your name" 
                    value={demoName}
                    onChange={(e) => setDemoName(e.target.value)}
                    required
                    className="auth-input-field"
                    style={{ paddingLeft: '2.75rem' }}
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="auth-input-label">Email Address</label>
                <div className="auth-input-container">
                  <Mail size={18} className="auth-input-icon" />
                  <input 
                    type="email" 
                    placeholder="Enter your email" 
                    value={demoEmail}
                    onChange={(e) => setDemoEmail(e.target.value)}
                    required
                    className="auth-input-field"
                  />
                </div>
              </div>

              <button 
                type="submit" 
                className="btn-gradient-auth" 
                style={{ marginTop: '0.5rem' }}
                disabled={demoLoading}
              >
                {demoLoading ? (
                  <>
                    <RefreshCw size={18} className="animate-spin" />
                    Initializing Demo Workspace...
                  </>
                ) : (
                  <>
                    <LogIn size={20} />
                    Start 5-Minute Demo
                  </>
                )}
              </button>
            </form>
          </div>
        </AuthLayoutWrapper>
      );
    }

    return (
      <AuthLayoutWrapper theme={theme} toggleTheme={toggleTheme} liveCalls={liveCalls} agentsOnline={agentsOnline} dialSuccess={dialSuccess}>
        <div className="login-glass-card-premium" style={{
          padding: isRegistering ? '2rem 2.25rem' : '3.5rem 3rem',
          maxWidth: isRegistering ? '620px' : '480px'
        }}>
          {isRegistering ? (
            <RegisterCompany onBack={() => setIsRegistering(false)} theme={theme} />
          ) : (
            <>
              {/* Back to Website button */}
              <div style={{ alignSelf: 'flex-start', marginBottom: '1.5rem', display: 'flex', width: '100%' }}>
                <button
                  onClick={() => {
                    window.history.pushState({}, '', '/');
                    setShowLogin(false);
                  }}
                  className="auth-footer-link-secondary"
                >
                  <ArrowLeft size={16} />
                  Back to Website
                </button>
              </div>

              <div style={{ textAlign: 'center', marginBottom: '2rem', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                <h2 className="auth-header-title">Welcome back</h2>
                <p className="auth-header-desc">
                  {loginType === 'superadmin' ? 'Sign in to partner admin workspace' : 'Sign in to your telecaller dashboard'}
                </p>
              </div>

              <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                {loginError && (
                  <div style={styles.errorAlert}>
                    <AlertCircle size={18} style={{ flexShrink: 0 }} />
                    <span>{loginError}</span>
                  </div>
                )}

                <div className="form-group">
                  <div className="auth-input-label-row">
                    <label className="auth-input-label">Email Address</label>
                  </div>
                  <div className="auth-input-container">
                    <Mail size={18} className="auth-input-icon" />
                    <input 
                      type="email" 
                      placeholder={loginType === 'superadmin' ? 'Enter superadmin mail' : 'Enter company admin mail'} 
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="auth-input-field"
                      required
                    />
                  </div>
                </div>

                <div className="form-group">
                  <div className="auth-input-label-row">
                    <label className="auth-input-label">Password</label>
                  </div>
                  <div className="auth-input-container">
                    <Lock size={18} className="auth-input-icon" />
                    <input 
                      type={showPassword ? "text" : "password"} 
                      placeholder="Enter password" 
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="auth-input-field"
                      style={{ paddingRight: '2.75rem' }}
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      style={{
                        position: 'absolute',
                        right: '14px',
                        background: 'none',
                        border: 'none',
                        color: '#64748b',
                        cursor: 'pointer',
                        padding: 0,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        zIndex: 2,
                      }}
                      className="password-toggle-btn"
                      aria-label={showPassword ? "Hide password" : "Show password"}
                    >
                      {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                </div>

                <button 
                  type="submit" 
                  className="btn-gradient-auth" 
                  style={{ marginTop: '0.75rem', position: 'relative' }}
                  disabled={loggingIn}
                >
                  {loggingIn ? (
                    'Authenticating...'
                  ) : (
                    <>
                      <Zap size={18} style={{ fill: 'currentColor', position: 'absolute', left: '20px' }} />
                      <span>{loginType === 'superadmin' ? 'Superadmin Login' : 'Access Dashboard'}</span>
                      <span style={{ fontSize: '1.1rem', position: 'absolute', right: '20px' }}>→</span>
                    </>
                  )}
                </button>
              </form>

              {loginType === 'company' && (
                <div className="auth-divider">or continue with</div>
              )}
              
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.75rem', marginTop: loginType === 'company' ? '0' : '1.5rem' }}>
                {loginType === 'company' ? (
                  <div style={{ width: '100%', display: 'flex', gap: '1rem', alignItems: 'center' }}>
                    <button 
                      type="button"
                      onClick={() => setIsRegistering(true)}
                      className="btn-auth-secondary"
                    >
                      <Building2 size={16} />
                      Register Company
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setLoginType('superadmin');
                        setEmail('');
                        setPassword('');
                        setLoginError('');
                      }}
                      className="btn-auth-secondary"
                    >
                      <ShieldCheck size={16} />
                      Partner Login
                    </button>
                  </div>
                ) : (
                  <div style={{ width: '100%', display: 'flex', justifyContent: 'center' }}>
                    <button
                      type="button"
                      onClick={() => {
                        setLoginType('company');
                        setEmail('');
                        setPassword('');
                        setLoginError('');
                      }}
                      className="btn-auth-secondary"
                      style={{ maxWidth: '240px' }}
                    >
                      <ArrowLeft size={16} />
                      Company Login
                    </button>
                  </div>
                )}
              </div>

              <div className="auth-card-footer-text">
                © {new Date().getFullYear()} Eazzio Telecaller · Enterprise Security
              </div>
            </>
          )}
        </div>
      </AuthLayoutWrapper>
    );
  }

  if (subscriptionExpired && user && user.companyRegNum) {
    return (
      <AuthLayoutWrapper theme={theme} toggleTheme={toggleTheme} liveCalls={liveCalls} agentsOnline={agentsOnline} dialSuccess={dialSuccess}>
        <div className="login-glass-card-premium" style={{ padding: '2rem 2.25rem', maxWidth: '620px' }}>
          <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
            <div style={{ width: '64px', height: '64px', borderRadius: '50%', backgroundColor: 'rgba(239,68,68,0.12)', border: '2px solid rgba(239,68,68,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1rem auto' }}>
              <AlertCircle size={30} color="#ef4444" />
            </div>
            <h2 className="auth-header-title" style={{ fontSize: '1.6rem', textAlign: 'center' }}>Subscription Expired</h2>
            <p style={{ color: 'var(--text-secondary)', marginTop: '8px', fontSize: '0.95rem', textAlign: 'center' }}>
              Your Eazzio subscription has expired. Please renew to continue using the platform.
            </p>
          </div>
          <RegisterCompany
            onBack={handleLogout}
            theme={theme}
            renewalMode={true}
            prefillEmail={user.email}
            prefillNoOfTelecallers={user.noOfTelecallers}
            onRenewalSuccess={(data) => {
              setSubscriptionExpired(false);
              fetch(`${API_BASE_URL}/api/auth/me`, {
                headers: {
                  'Authorization': `Bearer ${token}`
                }
              })
              .then(res => res.json())
              .then(userData => {
                setUser(userData);
              })
              .catch(err => console.error('Error fetching updated user after renewal:', err));
            }}
          />
        </div>
      </AuthLayoutWrapper>
    );
  }

  const isDemoUser = user && user.companyRegNum && user.companyRegNum.startsWith('EAZ-DEMO-');

  // Render main dashboard template if authenticated
  return (
    <div className="app-container" style={isDemoUser ? { display: 'block' } : {}}>
      {isDemoUser && (
        <div style={{
          backgroundColor: '#ef4444',
          color: '#ffffff',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '0.88rem',
          fontWeight: '700',
          padding: '10px',
          textAlign: 'center',
          boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
          gap: '8px',
          width: '100%',
          boxSizing: 'border-box'
        }}>
          <span>⚠️</span>
          <span>Interactive Demo Workspace: Read-only mode active. This workspace will be deleted in 5 minutes.</span>
        </div>
      )}
      <div style={{ display: 'flex', width: '100%', minHeight: isDemoUser ? 'calc(100vh - 38px)' : '100vh' }}>
        <div className="mobile-header">
          <Logo theme={theme} mode="sidebar" />
          <button 
            onClick={() => setIsSidebarOpen(!isSidebarOpen)} 
            className="mobile-menu-toggle"
            title="Toggle Navigation Menu"
          >
            {isSidebarOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>

        {isSidebarOpen && (
          <div className="mobile-sidebar-overlay" onClick={() => setIsSidebarOpen(false)}></div>
        )}

        <Sidebar 
          activeTab={activeTab} 
          setActiveTab={setActiveTab} 
          user={user}
          onLogout={handleLogout}
          theme={theme}
          toggleTheme={toggleTheme}
          isOpen={isSidebarOpen}
          onClose={() => setIsSidebarOpen(false)}
        />
        <main className="main-content">
          {renderActivePage()}
        </main>
      </div>
    </div>
  );
};

const styles = {
  loginContainer: {
    display: 'flex',
    minHeight: '100vh',
    width: '100vw',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundSize: 'cover',
    backgroundPosition: 'center',
    backgroundRepeat: 'no-repeat',
    position: 'relative',
    overflowY: 'auto',
    padding: '2rem 1rem',
    boxSizing: 'border-box',
  },
  loginBackgroundDecoration: {
    position: 'absolute',
    width: '600px',
    height: '600px',
    borderRadius: '50%',
    background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.15) 0%, rgba(168, 85, 247, 0.15) 100%)',
    filter: 'blur(120px)',
    top: '50%',
    left: '50%',
    transform: 'translate(-50%, -50%)',
    zIndex: 1,
  },
  loginCard: {
    width: '90%',
    maxWidth: '560px',
    padding: '4.5rem 4rem',
    zIndex: 2,
    boxShadow: '0 16px 48px rgba(0, 0, 0, 0.6)',
  },
  loginHeader: {
    textAlign: 'center',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '8px',
    marginBottom: '1.5rem',
  },
  loginIcon: {
    fontSize: '32px',
    marginBottom: '8px',
  },
  errorAlert: {
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
    border: '1px solid rgba(239, 68, 68, 0.25)',
    color: '#ef4444',
    padding: '0.75rem',
    borderRadius: '8px',
    marginBottom: '1.25rem',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    fontSize: '0.85rem',
  },
  inputWrapper: {
    position: 'relative',
    display: 'flex',
    alignItems: 'center',
  },
  inputIcon: {
    position: 'absolute',
    left: '20px',
    color: '#6b7280',
  },
  inputWithIcon: {
    paddingLeft: '3.75rem',
    paddingRight: '1.25rem',
    paddingTop: '1rem',
    paddingBottom: '1rem',
    fontSize: '1.1rem',
    width: '100%',
    height: '60px',
    borderRadius: '12px',
  },
  loginTypeTabs: {
    display: 'flex',
    borderRadius: '10px',
    backgroundColor: 'var(--bg-primary)',
    border: '1px solid var(--border-color)',
    padding: '4px',
    marginTop: '1.5rem',
    marginBottom: '0.5rem',
    width: '100%',
  },
  loginTypeTab: {
    flex: 1,
    padding: '10px 0',
    fontSize: '0.9rem',
    fontWeight: '600',
    borderRadius: '8px',
    border: 'none',
    backgroundColor: 'transparent',
    color: 'var(--text-secondary)',
    cursor: 'pointer',
    transition: 'all 0.2s',
    textAlign: 'center',
    outline: 'none',
  },
  loginTypeTabActive: {
    backgroundColor: '#6366f1',
    color: '#ffffff',
    boxShadow: '0 4px 12px rgba(99, 102, 241, 0.25)',
  },
};

export default App;
