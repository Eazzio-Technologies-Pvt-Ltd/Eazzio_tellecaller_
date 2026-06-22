import React, { useState, useEffect } from 'react';
import API_BASE_URL from './config/api';
import Sidebar from './components/Sidebar';
import Dashboard from './pages/Dashboard';
import Telecallers from './pages/Telecallers';
import Campaigns from './pages/Campaigns';
import Contacts from './pages/Contacts';
import CallLogs from './pages/CallLogs';
import TelecallerAccounts from './pages/TelecallerAccounts';
import MonitorGrid from './pages/MonitorGrid';
import { Mail, Lock, LogIn, AlertCircle } from 'lucide-react';
import Logo from './components/Logo';

const App = () => {
  const [token, setToken] = useState(localStorage.getItem('token'));
  const [user, setUser] = useState(null);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [theme, setTheme] = useState(localStorage.getItem('theme') || 'light');
  
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

  const handleLogout = () => {
    localStorage.removeItem('token');
    setToken(null);
    setUser(null);
  };

  const renderActivePage = () => {
    switch (activeTab) {
      case 'dashboard':
        return <Dashboard setActiveTab={setActiveTab} />;
      case 'telecallers':
        return <Telecallers />;
      case 'monitor-grid':
        return <MonitorGrid />;
      case 'campaigns':
        return <Campaigns />;
      case 'contacts':
        return <Contacts />;
      case 'call-logs':
        return <CallLogs />;
      case 'accounts':
        return <TelecallerAccounts />;
      default:
        return <Dashboard setActiveTab={setActiveTab} />;
    }
  };

  // Render Login Screen if not authenticated
  if (!token || !user) {
    return (
      <div style={{
        ...styles.loginContainer,
        backgroundImage: theme === 'dark'
          ? 'linear-gradient(to bottom, rgba(11, 17, 32, 0.82), rgba(8, 12, 24, 0.94)), url("/login-bg.png")'
          : 'linear-gradient(to bottom, rgba(248, 250, 252, 0.82), rgba(241, 245, 249, 0.94)), url("/login-bg.png")'
      }}>
        <div style={styles.loginBackgroundDecoration}></div>
        <div className="login-glass-card" style={styles.loginCard}>
          <div style={styles.loginHeader}>
            <Logo theme={theme} mode="login" />
            <p style={{ color: 'var(--text-secondary)', fontSize: '1.05rem', marginTop: '10px' }}>SIM-Based Auto Dialing Admin Panel</p>
          </div>

          <form onSubmit={handleLogin} style={{ marginTop: '2.5rem' }}>
            {loginError && (
              <div style={styles.errorAlert}>
                <AlertCircle size={18} style={{ flexShrink: 0 }} />
                <span>{loginError}</span>
              </div>
            )}

            <div className="form-group" style={{ marginBottom: '2.25rem' }}>
              <label style={{ fontSize: '1.05rem', fontWeight: '600', marginBottom: '10px', color: 'var(--text-secondary)' }}>Email Address</label>
              <div style={styles.inputWrapper}>
                <Mail size={22} style={styles.inputIcon} />
                <input 
                  type="email" 
                  placeholder="admin@eazzio.com" 
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  style={styles.inputWithIcon}
                />
              </div>
            </div>

            <div className="form-group" style={{ marginBottom: '3.0rem' }}>
              <label style={{ fontSize: '1.05rem', fontWeight: '600', marginBottom: '10px', color: 'var(--text-secondary)' }}>Password</label>
              <div style={styles.inputWrapper}>
                <Lock size={22} style={styles.inputIcon} />
                <input 
                  type="password" 
                  placeholder="••••••••" 
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  style={styles.inputWithIcon}
                />
              </div>
            </div>

            <button 
              type="submit" 
              className="btn btn-primary" 
              style={{ width: '100%', height: '60px', fontSize: '1.2rem', borderRadius: '12px' }}
              disabled={loggingIn}
            >
              {loggingIn ? (
                'Authenticating...'
              ) : (
                <>
                  <LogIn size={22} />
                  Access Dashboard
                </>
              )}
            </button>
          </form>
        </div>
      </div>
    );
  }

  // Render main dashboard template if authenticated
  return (
    <div className="app-container">
      <Sidebar 
        activeTab={activeTab} 
        setActiveTab={setActiveTab} 
        user={user}
        onLogout={handleLogout}
        theme={theme}
        toggleTheme={toggleTheme}
      />
      <main className="main-content">
        {renderActivePage()}
      </main>
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
    overflow: 'hidden',
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
};

export default App;
