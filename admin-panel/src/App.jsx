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
import RegisterCompany from './components/RegisterCompany';
import Companies from './pages/Companies';
import BillingPage from './pages/BillingPage';
import { Mail, Lock, LogIn, AlertCircle, Menu, X, ShieldCheck, ArrowLeft } from 'lucide-react';
import Logo from './components/Logo';

const App = () => {
  const [token, setToken] = useState(localStorage.getItem('token'));
  const [user, setUser] = useState(null);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [theme, setTheme] = useState(localStorage.getItem('theme') || 'light');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isRegistering, setIsRegistering] = useState(false);
  const [subscriptionExpired, setSubscriptionExpired] = useState(false);
  const [loginType, setLoginType] = useState('company'); // 'company' or 'superadmin'
  
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
          const expiry = new Date(userData.subscriptionEnd);
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
        return <Campaigns />;
      case 'contacts':
        return <Contacts />;
      case 'call-logs':
        return <CallLogs />;
      case 'accounts':
        return <TelecallerAccounts />;
      case 'billing':
        return <BillingPage theme={theme} user={user} />;
      default:
        return <Dashboard setActiveTab={setActiveTab} theme={theme} user={user} />;
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
        <div className="login-glass-card" style={{
          ...styles.loginCard,
          padding: isRegistering ? '2rem 2.25rem' : '3.5rem 3rem'
        }}>
          {isRegistering ? (
            <RegisterCompany onBack={() => setIsRegistering(false)} theme={theme} />
          ) : (
            <>
              <div style={styles.loginHeader}>
                <Logo theme={theme} mode="login" />
                <p style={{ color: 'var(--text-secondary)', fontSize: '1.05rem', marginTop: '10px' }}>SIM-Based Auto Dialing Admin Panel</p>
              </div>

              <form onSubmit={handleLogin} style={{ marginTop: '1.5rem' }}>
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
                      placeholder={loginType === 'superadmin' ? 'Enter superadmin mail' : 'Enter company admin mail'} 
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="input-with-icon"
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
                      placeholder="Enter password" 
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="input-with-icon"
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
                      {loginType === 'superadmin' ? 'Superadmin Login' : 'Access Dashboard'}
                    </>
                  )}
                </button>
              </form>

              {loginType === 'company' && (
                <div style={{ textAlign: 'center', marginTop: '1.5rem', borderTop: '1px solid var(--border-color)', paddingTop: '1.25rem' }}>
                  <span style={{ color: 'var(--text-secondary)', fontSize: '0.95rem' }}>New to Eazzio? </span>
                  <button 
                    onClick={() => setIsRegistering(true)}
                    style={{ background: 'none', border: 'none', color: '#6366f1', fontWeight: '700', cursor: 'pointer', fontSize: '0.95rem', padding: 0 }}
                  >
                    Register Company
                  </button>
                </div>
              )}
              <div style={{ textAlign: 'center', marginTop: loginType === 'company' ? '0.75rem' : '1.5rem', ...(loginType === 'superadmin' ? { borderTop: '1px solid var(--border-color)', paddingTop: '1.25rem' } : {}) }}>
                {loginType === 'company' ? (
                  <button
                    onClick={() => {
                      setLoginType('superadmin');
                      setEmail('');
                      setPassword('');
                      setLoginError('');
                    }}
                    style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontWeight: '600', cursor: 'pointer', fontSize: '0.82rem', padding: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}
                  >
                    <ShieldCheck size={14} />
                    Partner Login
                  </button>
                ) : (
                  <button
                    onClick={() => {
                      setLoginType('company');
                      setEmail('');
                      setPassword('');
                      setLoginError('');
                    }}
                    style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontWeight: '600', cursor: 'pointer', fontSize: '0.82rem', padding: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}
                  >
                    <ArrowLeft size={14} />
                    Company Login
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    );
  }

  // Subscription expired — show renewal / plan selection screen for company admins
  if (subscriptionExpired && user && user.companyRegNum) {
    return (
      <div style={{
        ...styles.loginContainer,
        backgroundImage: theme === 'dark'
          ? 'linear-gradient(to bottom, rgba(11, 17, 32, 0.82), rgba(8, 12, 24, 0.94)), url("/login-bg.png")'
          : 'linear-gradient(to bottom, rgba(248, 250, 252, 0.82), rgba(241, 245, 249, 0.94)), url("/login-bg.png")'
      }}>
        <div style={styles.loginBackgroundDecoration}></div>
        <div className="login-glass-card" style={{ ...styles.loginCard, padding: '2rem 2.25rem', maxWidth: '620px' }}>
          <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
            <div style={{ width: '64px', height: '64px', borderRadius: '50%', backgroundColor: 'rgba(239,68,68,0.12)', border: '2px solid rgba(239,68,68,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1rem auto' }}>
              <AlertCircle size={30} color="#ef4444" />
            </div>
            <h2 style={{ color: 'var(--text-primary)', fontSize: '1.6rem', fontWeight: '800', margin: 0 }}>Subscription Expired</h2>
            <p style={{ color: 'var(--text-secondary)', marginTop: '8px', fontSize: '0.95rem' }}>
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
      </div>
    );
  }

  // Render main dashboard template if authenticated
  return (
    <div className="app-container">
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
