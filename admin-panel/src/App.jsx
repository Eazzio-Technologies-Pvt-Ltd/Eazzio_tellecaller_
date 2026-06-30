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
import { Mail, Lock, LogIn, AlertCircle, Menu, X, ShieldCheck, ArrowLeft, RefreshCw, Phone, Users, TrendingUp, Shield, Zap, Building2, Eye, EyeOff, Briefcase, Tag } from 'lucide-react';
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

// Premium Dual-Pane Layout Frame Redesigned to Centered Single Pane
const AuthLayoutWrapper = ({ children, theme, toggleTheme }) => {
  return (
    <div className="login-layout-container">
      {/* Decorative background shapes mimicking the screenshot */}
      <div className="bg-shape-left-bar"></div>
      <div className="bg-shape-bottom-circle"></div>
      <div className="bg-shape-right-curve"></div>
      
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

      <div className="login-centered-pane">
        {children}
        <div className="auth-page-copyright">
          © 2026 Eazzio Technologies Pvt Ltd | Eazzio v2.2.9 | Protected by Google reCAPTCHA
        </div>
      </div>
    </div>
  );
};


const getDemoDeviceId = () => {
  let devId = localStorage.getItem('eazzio_demo_device_id');
  if (!devId) {
    const match = document.cookie.match(/(?:^|; )eazzio_demo_device_id=([^;]*)/);
    devId = match ? decodeURIComponent(match[1]) : null;
  }
  if (!devId) {
    devId = 'mac-' + Math.floor(100000 + Math.random() * 900000) + '-' + Date.now().toString(36);
  }
  localStorage.setItem('eazzio_demo_device_id', devId);
  const expiry = new Date();
  expiry.setFullYear(expiry.getFullYear() + 10);
  document.cookie = `eazzio_demo_device_id=${devId}; expires=${expiry.toUTCString()}; path=/`;
  return devId;
};

const DemoValidityBanner = ({ subscriptionEnd, onClose }) => {
  const [timeLeft, setTimeLeft] = useState('');
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    if (!subscriptionEnd) {
      setTimeLeft('Calculating...');
      return;
    }

    const updateTimer = () => {
      const now = new Date();
      let expiryStr = subscriptionEnd;
      if (!expiryStr.includes('Z') && !expiryStr.includes('T')) {
        expiryStr = expiryStr.replace(' ', 'T') + 'Z';
      }
      const expiry = new Date(expiryStr);
      const diffMs = expiry - now;

      if (diffMs <= 0) {
        setTimeLeft('Expired');
        return;
      }

      const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
      const hours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diffMs % (1000 * 60)) / 1000);

      const parts = [];
      if (days > 0) parts.push(`${days}d`);
      if (hours > 0 || days > 0) parts.push(`${hours}h`);
      if (minutes > 0 || hours > 0 || days > 0) parts.push(`${minutes}m`);
      parts.push(`${seconds}s`);

      setTimeLeft(parts.join(' '));
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);

    return () => clearInterval(interval);
  }, [subscriptionEnd]);

  if (!visible) return null;

  return (
    <div style={{
      background: 'linear-gradient(90deg, #f59e0b 0%, #ef4444 50%, #ec4899 100%)',
      color: '#ffffff',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontSize: '0.88rem',
      fontWeight: '700',
      padding: '10px 40px 10px 10px',
      textAlign: 'center',
      boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
      gap: '8px',
      width: '100%',
      boxSizing: 'border-box',
      position: 'relative',
      zIndex: 1000
    }}>
      <span>⚠️</span>
      <span>
        Interactive Demo Workspace: Working mode active. Demo expires in{' '}
        <span style={{
          fontFamily: 'monospace',
          fontSize: '0.95rem',
          backgroundColor: 'rgba(0,0,0,0.2)',
          padding: '2px 8px',
          borderRadius: '4px',
          marginLeft: '4px',
          display: 'inline-block',
          boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.2)'
        }}>
          {timeLeft}
        </span>
      </span>
      <button 
        onClick={() => {
          setVisible(false);
          if (onClose) onClose();
        }}
        style={{
          position: 'absolute',
          right: '15px',
          background: 'none',
          border: 'none',
          color: '#ffffff',
          cursor: 'pointer',
          fontWeight: 'bold',
          fontSize: '1rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '4px',
          zIndex: 1001
        }}
        title="Dismiss banner"
      >
        ✕
      </button>
    </div>
  );
};


const App = () => {
  const [token, setToken] = useState(localStorage.getItem('token'));
  const [user, setUser] = useState(null);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [theme, setTheme] = useState('light');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [showDemoBanner, setShowDemoBanner] = useState(true);
  const [isRegistering, setIsRegistering] = useState(false);
  const [subscriptionExpired, setSubscriptionExpired] = useState(false);
  const [loginType, setLoginType] = useState('company'); // 'company' or 'superadmin'
  const [showLogin, setShowLogin] = useState(false);
  const [showDemoPage, setShowDemoPage] = useState(false);
  const [demoName, setDemoName] = useState('');
  const [demoEmail, setDemoEmail] = useState('');
  const [demoPassword, setDemoPassword] = useState('');
  const [demoCompanyName, setDemoCompanyName] = useState('');
  const [demoCompanyNature, setDemoCompanyNature] = useState('');
  const [demoLoading, setDemoLoading] = useState(false);
  const [demoError, setDemoError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showDemoPassword, setShowDemoPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

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

  // Forgot Password States
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [resetOtp, setResetOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [forgotStep, setForgotStep] = useState(1); // 1: send OTP, 2: verify & reset
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotError, setForgotError] = useState('');
  const [forgotSuccess, setForgotSuccess] = useState('');

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

  const handleForgotPasswordRequest = async (e) => {
    e.preventDefault();
    setForgotError('');
    setForgotSuccess('');

    if (!forgotEmail) {
      setForgotError('Please enter your email address.');
      return;
    }

    setForgotLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/auth/forgot-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email: forgotEmail })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to send OTP.');
      }

      setForgotSuccess(data.message || 'OTP verification code has been sent to your email.');
      setForgotStep(2);
    } catch (err) {
      setForgotError(err.message);
    } finally {
      setForgotLoading(false);
    }
  };

  const handleResetPasswordSubmit = async (e) => {
    e.preventDefault();
    setForgotError('');
    setForgotSuccess('');

    if (!forgotEmail || !resetOtp || !newPassword || !confirmPassword) {
      setForgotError('Please fill in all fields.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setForgotError('New passwords do not match.');
      return;
    }

    if (newPassword.length < 6) {
      setForgotError('Password must be at least 6 characters long.');
      return;
    }

    setForgotLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/auth/reset-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email: forgotEmail, otp: resetOtp, newPassword })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to reset password.');
      }

      setForgotSuccess(data.message || 'Password reset successfully.');
      // Return to login form
      setTimeout(() => {
        setShowForgotPassword(false);
        setForgotEmail('');
        setResetOtp('');
        setNewPassword('');
        setConfirmPassword('');
        setForgotStep(1);
        setForgotSuccess('');
        setForgotError('');
      }, 3000);
    } catch (err) {
      setForgotError(err.message);
    } finally {
      setForgotLoading(false);
    }
  };

  const handleDemoRequestSubmit = async (e) => {
    e.preventDefault();
    setDemoError('');
    setDemoLoading(true);

    if (!demoName || !demoEmail || !demoPassword || !demoCompanyName || !demoCompanyNature) {
      setDemoError('Please provide all details, including company name and nature.');
      setDemoLoading(false);
      return;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/api/auth/register-demo-company`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          name: demoName, 
          email: demoEmail,
          password: demoPassword,
          companyName: demoCompanyName,
          nature: demoCompanyNature,
          macAddress: getDemoDeviceId()
        })
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

      // Reset demo registration states
      setDemoName('');
      setDemoEmail('');
      setDemoPassword('');
      setDemoCompanyName('');
      setDemoCompanyNature('');
    } catch (err) {
      setDemoError(err.message);
      setDemoLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    setToken(null);
    setUser(null);
  };

  const handleGoogleSignInClick = () => {
    alert('Google Sign-In integration is coming soon! Please use your email and password to sign in.');
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
          return <BillingPage theme={theme} user={user} setToken={setToken} setUser={setUser} />;
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
        return <CallLogs user={user} setActiveTab={setActiveTab} />;
      case 'accounts':
        return <TelecallerAccounts />;
      case 'billing':
        return <BillingPage theme={theme} user={user} setToken={setToken} setUser={setUser} />;
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
          title="eazzio-telecaller SIM Auto Dialer & CRM"
        />
      );
    }

    if (showDemoPage) {
      return (
        <AuthLayoutWrapper theme={theme} toggleTheme={toggleTheme}>
          <div className="login-glass-card-premium" style={{ padding: '2rem 3rem', maxWidth: '620px' }}>

            {/* Card Header: Back button left */}
            <div className="auth-card-header" style={{ justifyContent: 'flex-start', marginBottom: '1rem' }}>
              <button
                onClick={() => {
                  window.history.pushState({}, '', '/');
                  setShowDemoPage(false);
                }}
                className="btn-back-link"
              >
                <ArrowLeft size={14} />
                Back to Website
              </button>
            </div>

            {/* Centered Logo */}
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '0.75rem' }}>
              <img
                src={theme === 'dark' ? '/logo-light.png' : '/logo-dark.png'}
                alt="Eazzio Telecaller"
                className="auth-logo-img"
                style={{ height: '62px', maxWidth: '240px', objectFit: 'contain' }}
              />
            </div>

            <h2 className="auth-main-title" style={{ marginTop: '0.5rem' }}>Request 1-Week Trial Demo</h2>
            <p className="auth-main-subtitle">
              Type your details below to get instant admin access to a fully seeded, working demo workspace.
            </p>

            <div className="auth-card-divider-line"></div>

            <form onSubmit={handleDemoRequestSubmit} className="auth-form-content">
              {demoError && (
                <div style={styles.errorAlert}>
                  <AlertCircle size={18} style={{ flexShrink: 0 }} />
                  <span>{demoError}</span>
                </div>
              )}

              <div className="auth-input-group">
                <label className="auth-input-label-callyzer">
                  Full Name <span>*</span>
                </label>
                <input
                  type="text"
                  placeholder="Enter your full name"
                  value={demoName}
                  onChange={(e) => setDemoName(e.target.value)}
                  className="auth-input-field-callyzer"
                  required
                />
              </div>

              <div className="auth-input-group">
                <label className="auth-input-label-callyzer">
                  Email Address <span>*</span>
                </label>
                <input
                  type="email"
                  placeholder="Enter your email address"
                  value={demoEmail}
                  onChange={(e) => setDemoEmail(e.target.value)}
                  className="auth-input-field-callyzer"
                  required
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div className="auth-input-group">
                  <label className="auth-input-label-callyzer">
                    Company Name <span>*</span>
                  </label>
                  <input
                    type="text"
                    placeholder="Enter company name"
                    value={demoCompanyName}
                    onChange={(e) => setDemoCompanyName(e.target.value)}
                    className="auth-input-field-callyzer"
                    required
                  />
                </div>

                <div className="auth-input-group">
                  <label className="auth-input-label-callyzer">
                    Nature of Business <span>*</span>
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Real Estate, Finance"
                    value={demoCompanyNature}
                    onChange={(e) => setDemoCompanyNature(e.target.value)}
                    className="auth-input-field-callyzer"
                    required
                  />
                </div>
              </div>

              <div className="auth-input-group">
                <label className="auth-input-label-callyzer">
                  Choose Password <span>*</span>
                </label>
                <div className="auth-password-wrapper">
                  <input
                    type={showDemoPassword ? "text" : "password"}
                    placeholder="Create a password (min 6 characters)"
                    value={demoPassword}
                    onChange={(e) => setDemoPassword(e.target.value)}
                    className="auth-input-field-callyzer password-input"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowDemoPassword(!showDemoPassword)}
                    className="auth-password-toggle"
                    aria-label={showDemoPassword ? "Hide password" : "Show password"}
                  >
                    {showDemoPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                className="btn-signin-callyzer"
                style={{ marginTop: '0.5rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', width: '100%' }}
                disabled={demoLoading}
              >
                {demoLoading ? (
                  <>
                    <RefreshCw size={18} className="animate-spin" />
                    Initializing Demo Workspace...
                  </>
                ) : (
                  <>
                    <LogIn size={18} />
                    START 1-WEEK TRIAL
                  </>
                )}
              </button>
            </form>

            <div className="auth-card-divider-line"></div>

            {/* Three column footer — same as login page */}
            <div className="auth-card-footer-columns">
              <div>
                <h3 className="auth-footer-col-title">Eazzio</h3>
                <div className="auth-footer-links-list">
                  <a href="/" className="auth-footer-link-item">Home</a>
                  <a href="/#features" className="auth-footer-link-item">Features</a>
                  <a href="/#pricing" className="auth-footer-link-item">Pricing</a>
                </div>
              </div>
              <div>
                <h3 className="auth-footer-col-title">Follow us on</h3>
                <div className="auth-social-icons-row">
                  <a href="https://facebook.com" target="_blank" rel="noopener noreferrer" className="auth-social-circle-btn" aria-label="Facebook">
                    <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M22 12c0-5.52-4.48-10-10-10S2 6.48 2 12c0 4.84 3.44 8.87 8 9.8V15H8v-3h2V9.5C10 7.57 11.57 6 13.5 6H16v3h-2c-.55 0-1 .45-1 1v2h3v3h-3v6.95c4.56-.93 8-4.96 8-9.75z"/></svg>
                  </a>
                  <a href="https://twitter.com" target="_blank" rel="noopener noreferrer" className="auth-social-circle-btn" aria-label="X (Twitter)">
                    <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
                  </a>
                  <a href="https://linkedin.com" target="_blank" rel="noopener noreferrer" className="auth-social-circle-btn" aria-label="LinkedIn">
                    <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z"/></svg>
                  </a>
                </div>
              </div>
              <div>
                <h3 className="auth-footer-col-title">Write us on</h3>
                <a href="mailto:hello@eazzio.com" className="auth-mail-contact-row">
                  <Mail size={16} />
                  <span>hello@eazzio.com</span>
                </a>
              </div>
            </div>
          </div>
        </AuthLayoutWrapper>
      );
    }

    return (
      <AuthLayoutWrapper theme={theme} toggleTheme={toggleTheme}>
        <div className="login-glass-card-premium" style={{
          padding: isRegistering ? '1.25rem 1.75rem' : showForgotPassword ? '2rem 2.25rem' : '2rem 3rem',
          maxWidth: (isRegistering || showForgotPassword) ? '620px' : '620px'
        }}>
          {isRegistering ? (
            <RegisterCompany onBack={() => setIsRegistering(false)} theme={theme} />
          ) : showForgotPassword ? (
            <>
              {/* Back to Login Button */}
              <div style={{ alignSelf: 'flex-start', marginBottom: '1.5rem', display: 'flex', width: '100%' }}>
                <button
                  onClick={() => {
                    setShowForgotPassword(false);
                    setForgotError('');
                    setForgotSuccess('');
                    setForgotStep(1);
                  }}
                  className="auth-footer-link-secondary"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    background: 'none',
                    border: 'none',
                    color: 'var(--text-secondary, #475569)',
                    fontSize: '0.9rem',
                    fontWeight: '600',
                    cursor: 'pointer',
                    padding: 0
                  }}
                >
                  <ArrowLeft size={16} style={{ marginRight: '6px' }} />
                  Back to Login
                </button>
              </div>

              <div style={{ textAlign: 'center', marginBottom: '2rem', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                <h2 className="auth-header-title">Reset password</h2>
                <p className="auth-header-desc">
                  {forgotStep === 1 
                    ? 'Enter your email address to receive a password reset code.' 
                    : 'Enter the verification OTP and your new password below.'}
                </p>
              </div>

              {forgotStep === 1 ? (
                <form onSubmit={handleForgotPasswordRequest} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                  {forgotError && (
                    <div style={styles.errorAlert}>
                      <AlertCircle size={18} style={{ flexShrink: 0 }} />
                      <span>{forgotError}</span>
                    </div>
                  )}
                  {forgotSuccess && (
                    <div style={{
                      backgroundColor: 'rgba(16,185,129,0.1)',
                      border: '1px solid rgba(16,185,129,0.2)',
                      borderRadius: '8px',
                      padding: '12px',
                      color: '#10b981',
                      fontSize: '0.88rem',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px'
                    }}>
                      <ShieldCheck size={18} style={{ flexShrink: 0 }} />
                      <span>{forgotSuccess}</span>
                    </div>
                  )}

                  <div className="form-group">
                    <label className="auth-input-label">Email Address</label>
                    <div className="auth-input-container">
                      <Mail size={18} className="auth-input-icon" />
                      <input 
                        type="email" 
                        placeholder="Enter registered email address" 
                        value={forgotEmail}
                        onChange={(e) => setForgotEmail(e.target.value)}
                        className="auth-input-field"
                        required
                      />
                    </div>
                  </div>

                  <button 
                    type="submit" 
                    className="btn-gradient-auth" 
                    style={{ marginTop: '0.75rem' }}
                    disabled={forgotLoading}
                  >
                    {forgotLoading ? 'Sending Reset Code...' : 'Send Reset Code'}
                  </button>
                </form>
              ) : (
                <form onSubmit={handleResetPasswordSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                  {forgotError && (
                    <div style={styles.errorAlert}>
                      <AlertCircle size={18} style={{ flexShrink: 0 }} />
                      <span>{forgotError}</span>
                    </div>
                  )}
                  {forgotSuccess && (
                    <div style={{
                      backgroundColor: 'rgba(16,185,129,0.1)',
                      border: '1px solid rgba(16,185,129,0.2)',
                      borderRadius: '8px',
                      padding: '12px',
                      color: '#10b981',
                      fontSize: '0.88rem',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px'
                    }}>
                      <ShieldCheck size={18} style={{ flexShrink: 0 }} />
                      <span>{forgotSuccess}</span>
                    </div>
                  )}

                  <div className="form-group">
                    <label className="auth-input-label">Verification OTP Code</label>
                    <div className="auth-input-container">
                      <Lock size={18} className="auth-input-icon" />
                      <input 
                        type="text" 
                        placeholder="Enter 6-digit OTP code" 
                        value={resetOtp}
                        onChange={(e) => setResetOtp(e.target.value)}
                        className="auth-input-field"
                        maxLength={6}
                        required
                      />
                    </div>
                  </div>

                  <div className="form-group">
                    <label className="auth-input-label">New Password</label>
                    <div className="auth-input-container">
                      <Lock size={18} className="auth-input-icon" />
                      <input 
                        type={showNewPassword ? "text" : "password"} 
                        placeholder="Enter new password (min 6 chars)" 
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        className="auth-input-field"
                        style={{ paddingRight: '2.75rem' }}
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowNewPassword(!showNewPassword)}
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
                      >
                        {showNewPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                      </button>
                    </div>
                  </div>

                  <div className="form-group">
                    <label className="auth-input-label">Confirm New Password</label>
                    <div className="auth-input-container">
                      <Lock size={18} className="auth-input-icon" />
                      <input 
                        type={showConfirmPassword ? "text" : "password"} 
                        placeholder="Confirm new password" 
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        className="auth-input-field"
                        style={{ paddingRight: '2.75rem' }}
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
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
                      >
                        {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                      </button>
                    </div>
                  </div>

                  <button 
                    type="submit" 
                    className="btn-gradient-auth" 
                    style={{ marginTop: '0.75rem' }}
                    disabled={forgotLoading}
                  >
                    {forgotLoading ? 'Resetting Password...' : 'Reset Password'}
                  </button>
                </form>
              )}
            </>
          ) : (
            <>
              {/* Card Header: Back to Website on left, SIGN UP on right */}
              <div className="auth-card-header" style={{ justifyContent: 'space-between', marginBottom: '1rem' }}>
                <button
                  type="button"
                  className="btn-back-link"
                  onClick={() => {
                    window.history.pushState({}, '', '/');
                    setShowLogin(false);
                  }}
                >
                  <ArrowLeft size={14} />
                  Back to Website
                </button>
                <button className="auth-signup-btn" type="button" onClick={() => setIsRegistering(true)}>
                  SIGN UP <span style={{ marginLeft: '4px' }}>→</span>
                </button>
              </div>

              {/* Centered Logo above Sign In */}
              <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '0.75rem' }}>
                <img 
                  src={theme === 'dark' ? '/logo-light.png' : '/logo-dark.png'} 
                  alt="Eazzio Telecaller" 
                  className="auth-logo-img" 
                  style={{ height: '62px', maxWidth: '240px', objectFit: 'contain' }}
                />
              </div>

              <h2 className="auth-main-title" style={{ marginTop: '0.5rem' }}>Sign In</h2>
              <p className="auth-main-subtitle">to access your account</p>

              <div className="auth-card-divider-line"></div>

              <form onSubmit={handleLogin} className="auth-form-content">
                {loginError && (
                  <div style={styles.errorAlert}>
                    <AlertCircle size={18} style={{ flexShrink: 0 }} />
                    <span>{loginError}</span>
                  </div>
                )}

                <div className="auth-input-group">
                  <label className="auth-input-label-callyzer">
                    Email Address <span>*</span>
                  </label>
                  <input 
                    type="email" 
                    placeholder="Enter Your Email Address" 
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="auth-input-field-callyzer"
                    required
                  />
                </div>

                <div className="auth-input-group">
                  <label className="auth-input-label-callyzer">
                    Password <span>*</span>
                  </label>
                  <div className="auth-password-wrapper">
                    <input 
                      type={showPassword ? "text" : "password"} 
                      placeholder="Enter Your Password" 
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="auth-input-field-callyzer password-input"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="auth-password-toggle"
                      aria-label={showPassword ? "Hide password" : "Show password"}
                    >
                      {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setShowForgotPassword(true);
                      setForgotStep(1);
                      setForgotEmail('');
                      setResetOtp('');
                      setNewPassword('');
                      setConfirmPassword('');
                      setForgotError('');
                      setForgotSuccess('');
                    }}
                    className="auth-forgot-password-link-callyzer"
                  >
                    Forgot Password?
                  </button>
                </div>

                <button 
                  type="submit" 
                  className="btn-signin-callyzer" 
                  disabled={loggingIn}
                >
                  {loggingIn ? 'Signing In...' : 'SIGN IN'}
                </button>

                <div className="auth-or-separator">OR</div>

                <button 
                  type="button"
                  onClick={handleGoogleSignInClick}
                  className="btn-google-callyzer"
                >
                  <svg className="google-icon-svg" viewBox="0 0 24 24">
                    <path fill="#EA4335" d="M12.24 10.285V14.4h6.887c-.275 1.565-1.88 4.604-6.887 4.604-4.33 0-7.86-3.577-7.86-8s3.53-8 7.86-8c2.46 0 4.105 1.025 5.047 1.926l3.227-3.11C18.28 1.845 15.483 1 12.24 1 6.01 1 1 6.01 1 12.24s5.01 11.24 11.24 11.24c6.5 0 10.822-4.574 10.822-11.023 0-.74-.08-1.302-.178-1.742H12.24z"/>
                  </svg>
                  <span>Sign In with Google</span>
                </button>
              </form>

              {loginType === 'company' && (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.75rem', width: '100%', margin: '0.5rem auto 0 auto' }}>
                  <div style={{ width: '100%', display: 'flex', gap: '1rem', alignItems: 'center' }}>
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
                </div>
              )}

              {loginType === 'superadmin' && (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.75rem', width: '100%', maxWidth: '440px', margin: '1rem auto 0 auto' }}>
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
                    >
                      <ArrowLeft size={16} />
                      Company Login
                    </button>
                  </div>
                </div>
              )}

              <div className="auth-card-divider-line"></div>

              {/* Three column footer */}
              <div className="auth-card-footer-columns">
                <div>
                  <h3 className="auth-footer-col-title">Eazzio</h3>
                  <div className="auth-footer-links-list">
                    <a href="/" className="auth-footer-link-item">Home</a>
                    <a href="/#features" className="auth-footer-link-item">Features</a>
                    <a href="/#pricing" className="auth-footer-link-item">Pricing</a>
                  </div>
                </div>
                <div>
                  <h3 className="auth-footer-col-title">Follow us on</h3>
                  <div className="auth-social-icons-row">
                    <a href="https://facebook.com" target="_blank" rel="noopener noreferrer" className="auth-social-circle-btn" aria-label="Facebook">
                      <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M22 12c0-5.52-4.48-10-10-10S2 6.48 2 12c0 4.84 3.44 8.87 8 9.8V15H8v-3h2V9.5C10 7.57 11.57 6 13.5 6H16v3h-2c-.55 0-1 .45-1 1v2h3v3h-3v6.95c4.56-.93 8-4.96 8-9.75z"/></svg>
                    </a>
                    <a href="https://twitter.com" target="_blank" rel="noopener noreferrer" className="auth-social-circle-btn" aria-label="X (Twitter)">
                      <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
                    </a>
                    <a href="https://linkedin.com" target="_blank" rel="noopener noreferrer" className="auth-social-circle-btn" aria-label="LinkedIn">
                      <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z"/></svg>
                    </a>
                  </div>
                </div>
                <div>
                  <h3 className="auth-footer-col-title">Write us on</h3>
                  <a href="mailto:hello@eazzio.com" className="auth-mail-contact-row">
                    <Mail size={16} />
                    <span>hello@eazzio.com</span>
                  </a>
                </div>
              </div>
            </>
          )}
        </div>
      </AuthLayoutWrapper>
    );
  }

  if (subscriptionExpired && user && user.companyRegNum) {
    const isDemo = user.companyRegNum.startsWith('EAZ-DEMO-') && user.planType === 'demo';
    return (
      <AuthLayoutWrapper theme={theme} toggleTheme={toggleTheme}>
        <div className="login-glass-card-premium" style={{ padding: '2rem 2.25rem', maxWidth: '620px', textAlign: 'center' }}>
          <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
            <div style={{ width: '64px', height: '64px', borderRadius: '50%', backgroundColor: 'rgba(239,68,68,0.12)', border: '2px solid rgba(239,68,68,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1rem auto' }}>
              <AlertCircle size={30} color="#ef4444" />
            </div>
            <h2 className="auth-header-title" style={{ fontSize: '1.6rem', textAlign: 'center' }}>
              {isDemo ? 'please take subscription' : 'Subscription Expired'}
            </h2>
            <p style={{ color: 'var(--text-secondary)', marginTop: '8px', fontSize: '0.95rem', textAlign: 'center', lineHeight: '1.5' }}>
              {isDemo 
                ? 'Your 1-week free trial has expired. To continue using Eazzio and access your campaigns, please purchase a subscription.'
                : 'Your Eazzio subscription has expired. Please contact Eazzio Support or the system administrator to renew the plan.'}
            </p>
          </div>
          {isDemo ? (
            <RegisterCompany
              onBack={handleLogout}
              theme={theme}
              renewalMode={true}
              prefillEmail={user.email}
              prefillNoOfTelecallers={user.noOfTelecallers}
              onRenewalSuccess={(data) => {
                setSubscriptionExpired(false);
                // If backend returned a new token (demo → normal upgrade), update it first
                const activeToken = (data && data.token) ? data.token : token;
                if (data && data.token) {
                  localStorage.setItem('token', data.token);
                  setToken(data.token);
                }
                fetch(`${API_BASE_URL}/api/auth/me`, {
                  headers: {
                    'Authorization': `Bearer ${activeToken}`
                  }
                })
                .then(res => res.json())
                .then(userData => {
                  setUser(userData);
                })
                .catch(err => console.error('Error fetching updated user after renewal:', err));
              }}
            />
          ) : (
            <div style={{ marginTop: '2rem', display: 'flex', justifyContent: 'center' }}>
              <button
                onClick={handleLogout}
                style={{
                  padding: '10px 24px',
                  backgroundColor: '#ef4444',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '8px',
                  fontWeight: '700',
                  cursor: 'pointer',
                  fontSize: '0.9rem',
                  boxShadow: '0 4px 12px rgba(239, 68, 68, 0.2)'
                }}
              >
                Sign Out / Back to Login
              </button>
            </div>
          )}
        </div>
      </AuthLayoutWrapper>
    );
  }

  const isDemoUser = user && user.companyRegNum && user.companyRegNum.startsWith('EAZ-DEMO-') && user.planType === 'demo';

  // Render main dashboard template if authenticated
  return (
    <div className="app-container" style={isDemoUser ? { display: 'block' } : {}}>
      {isDemoUser && showDemoBanner && (
        <DemoValidityBanner subscriptionEnd={user?.subscriptionEnd} onClose={() => setShowDemoBanner(false)} />
      )}
      <div className="app-layout-wrapper" style={{ display: 'flex', width: '100%', minHeight: (isDemoUser && showDemoBanner) ? 'calc(100vh - 38px)' : '100vh' }}>
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
          showDemoBanner={showDemoBanner}
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
