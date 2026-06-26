import React, { useEffect, useState } from 'react';
import API_BASE_URL from '../config/api';
import { 
  PhoneCall, 
  PhoneOff, 
  Hourglass, 
  Briefcase,
  Trophy,
  History,
  Volume2,
  ArrowUpRight,
  Bell,
  Settings,
  Play,
  IndianRupee,
  Users,
  Trash2,
  TrendingUp,
  Phone,
  PhoneIncoming,
  PhoneOutgoing,
  PhoneMissed,
  Search,
  Building2
} from 'lucide-react';

const decodeToken = (token) => {
  if (!token) return null;
  try {
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
    return JSON.parse(jsonPayload);
  } catch (e) {
    console.error('Error decoding token:', e);
    return null;
  }
};

const DemoValidityBadge = ({ subscriptionEnd }) => {
  const [timeLeft, setTimeLeft] = useState('');

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

  if (!timeLeft) return null;

  return (
    <div style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: '6px',
      padding: '6px 12px',
      borderRadius: '8px',
      backgroundColor: 'rgba(245, 158, 11, 0.1)',
      border: '1px solid rgba(245, 158, 11, 0.35)',
      color: '#f59e0b',
      fontSize: '0.82rem',
      fontWeight: '700',
    }}>
      <span style={{ fontSize: '1rem', display: 'flex', alignItems: 'center' }}>⏳</span>
      <span>Demo Workspace Validity: <span style={{ fontFamily: 'monospace', fontWeight: '800' }}>{timeLeft}</span></span>
    </div>
  );
};

const Dashboard = ({ setActiveTab, theme, user }) => {
  const isLight = theme === 'light';
  const decoded = decodeToken(localStorage.getItem('token'));
  const activeUser = user || decoded;
  const [data, setData] = useState(null);
  const [recentLogs, setRecentLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedTelecaller, setSelectedTelecaller] = useState('');

  const [showSettings, setShowSettings] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [activeRecordingUrl, setActiveRecordingUrl] = useState(null);
  
  // Settings values (load from localStorage or use defaults)
  const [dialDelay, setDialDelay] = useState(localStorage.getItem('setting_dialDelay') || '5');
  const [maxRetries, setMaxRetries] = useState(localStorage.getItem('setting_maxRetries') || '3');
  const [recordingLimit, setRecordingLimit] = useState(localStorage.getItem('setting_recordingLimit') || '100');

  const parseDbDate = (dateString) => {
    if (!dateString) return new Date();
    if (typeof dateString === 'string') {
      if (!dateString.endsWith('Z') && !dateString.includes('+') && !dateString.includes('GMT')) {
        const isoString = dateString.replace(' ', 'T') + 'Z';
        const parsed = new Date(isoString);
        if (!isNaN(parsed.getTime())) {
          return parsed;
        }
      }
    }
    return new Date(dateString);
  };

  const getHourlyCounts = (logs) => {
    const counts = { '9AM': 0, '10AM': 0, '11AM': 0, '12PM': 0, '1PM': 0 };
    if (!logs || logs.length === 0) {
      return { '9AM': 1, '10AM': 4, '11AM': 3, '12PM': 2, '1PM': 1 };
    }
    logs.forEach(log => {
      if (!log.called_at) return;
      const date = parseDbDate(log.called_at);
      const hour = date.getHours();
      if (hour === 9) counts['9AM']++;
      else if (hour === 10) counts['10AM']++;
      else if (hour === 11) counts['11AM']++;
      else if (hour === 12) counts['12PM']++;
      else if (hour === 13) counts['1PM']++;
    });
    const total = Object.values(counts).reduce((a, b) => a + b, 0);
    if (total === 0) {
      return { '9AM': 1, '10AM': 4, '11AM': 3, '12PM': 2, '1PM': 1 };
    }
    return counts;
  };

  const formatTimeAgo = (dateString) => {
    const date = parseDbDate(dateString);
    const now = new Date();
    const diffMs = now - date;
    const diffSecs = Math.max(0, Math.floor(diffMs / 1000));
    const diffMins = Math.floor(diffSecs / 60);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffSecs < 10) return 'just now';
    if (diffSecs < 60) return `${diffSecs}s ago`;
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${diffDays}d ago`;
  };

  const handleDeleteNotification = async (id) => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/notifications/${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      if (res.ok) {
        setNotifications(prev => prev.filter(n => n.id !== id));
      }
    } catch (err) {
      console.error('Delete notification error:', err);
    }
  };

  const handleClearAllNotifications = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/notifications`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      if (res.ok) {
        setNotifications([]);
      }
    } catch (err) {
      console.error('Clear all notifications error:', err);
    }
  };
  
  const handleSaveSettings = (e) => {
    e.preventDefault();
    localStorage.setItem('setting_dialDelay', dialDelay);
    localStorage.setItem('setting_maxRetries', maxRetries);
    localStorage.setItem('setting_recordingLimit', recordingLimit);
    setShowSettings(false);
    alert('Operational settings updated successfully!');
  };

  const fetchDashboardData = async () => {
    try {
      const headers = {
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      };

      // If Superadmin, fetch company stats and company details in parallel
      if (activeUser && activeUser.companyRegNum === null) {
        const [statsRes, companiesRes] = await Promise.all([
          fetch(`${API_BASE_URL}/api/auth/superadmin-stats`, { headers }),
          fetch(`${API_BASE_URL}/api/auth/companies`, { headers })
        ]);
        
        if (!statsRes.ok || !companiesRes.ok) {
          throw new Error('Failed to retrieve platform analytics');
        }
        
        const superStats = await statsRes.json();
        const companiesList = await companiesRes.json();
        
        setData({
          ...superStats,
          companies: companiesList
        });
        return;
      }

      const queryParams = selectedTelecaller ? `?telecallerId=${selectedTelecaller}` : '';

      // Fetch analytics, logs, and notifications in parallel
      const [analyticsRes, logsRes, notificationsRes] = await Promise.all([
        fetch(`${API_BASE_URL}/api/call-logs/analytics${queryParams}`, { headers }),
        fetch(`${API_BASE_URL}/api/call-logs${queryParams}`, { headers }),
        fetch(`${API_BASE_URL}/api/notifications`, { headers })
      ]);

      if (!analyticsRes.ok || !logsRes.ok) {
        throw new Error('Failed to retrieve dashboard analytics');
      }

      const analyticsData = await analyticsRes.json();
      const logsData = await logsRes.json();
      
      let notificationsData = [];
      if (notificationsRes.ok) {
        notificationsData = await notificationsRes.json();
      }

      setData(analyticsData);
      setRecentLogs(logsData.slice(0, 5)); // Only show the 5 most recent calls
      setNotifications(notificationsData);
    } catch (err) {
      console.error(err);
      setError(err.message);
    } finally {
      if (loading) setLoading(false);
    }
  };

  const handleDeleteCompany = async (companyId, companyName) => {
    if (!window.confirm(`Are you sure you want to delete "${companyName}"? This will permanently delete their database, and their administrators and telecallers will not be able to log in.`)) {
      return;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/api/auth/companies/${companyId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to delete company.');
      }

      alert(result.message || 'Company deleted successfully.');
      fetchDashboardData();
    } catch (err) {
      alert(`Error deleting company: ${err.message}`);
    }
  };

  useEffect(() => {
    fetchDashboardData();
    // Poll analytics every 8 seconds for real-time monitoring
    const interval = setInterval(fetchDashboardData, 8000);
    return () => clearInterval(interval);
  }, [selectedTelecaller]);

  const formatDuration = (seconds) => {
    if (!seconds) return '0s';
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    
    const parts = [];
    if (h > 0) parts.push(`${h}h`);
    if (m > 0) parts.push(`${m}m`);
    if (s > 0 || parts.length === 0) parts.push(`${s}s`);
    return parts.join(' ');
  };

  if (loading && !data) {
    return <div style={{ color: 'var(--text-primary)', textAlign: 'center', marginTop: '4rem' }}>Loading Dashboard Analytics...</div>;
  }

  if (error) {
    return <div style={{ color: '#ef4444', textAlign: 'center', marginTop: '4rem' }}>Error: {error}</div>;
  }

  // Superadmin dashboard early return
  if (activeUser && (activeUser.companyRegNum === null || activeUser.email === 'tellecaller111@eazzio.com')) {
    const totalMonthlyRevenue = data.companies
      ? data.companies.reduce((sum, comp) => sum + ((comp.price_per_telecaller || 59) * (comp.telecaller_count || 0)), 0)
      : 0;

    const starterPlanCount = data.companies
      ? data.companies.filter(c => (c.price_per_telecaller || 59) === 59).length
      : 0;

    const growthPlanCount = data.companies
      ? data.companies.filter(c => (c.price_per_telecaller || 59) !== 59).length
      : 0;

    const formatDateStr = (dateString) => {
      if (!dateString) return 'N/A';
      try {
        const date = new Date(dateString);
        if (isNaN(date.getTime())) return 'N/A';
        return date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
      } catch (err) {
        return 'N/A';
      }
    };

    const isCompanyExpired = (dateString) => {
      if (!dateString) return false;
      try {
        const expiry = new Date(dateString);
        if (isNaN(expiry.getTime())) return false;
        return expiry < new Date();
      } catch (e) {
        return false;
      }
    };

    return (
      <div>
        <div style={{ ...styles.dashboardHeader, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h1 style={{ margin: 0 }}>Eazzio Platform Administration</h1>
            <p className="subtitle" style={{ marginTop: '6px' }}>Consolidated platform metrics, company registrations, and billing.</p>
          </div>
          <div style={{
            padding: '6px 14px',
            borderRadius: '8px',
            border: isLight ? '1px solid rgba(14, 165, 233, 0.4)' : '1px solid rgba(56, 189, 248, 0.4)',
            backgroundColor: isLight ? 'rgba(14, 165, 233, 0.08)' : 'rgba(56, 189, 248, 0.08)',
            color: isLight ? '#0284c7' : '#38bdf8',
            fontSize: '0.85rem',
            fontWeight: '700',
            letterSpacing: '1px',
            textTransform: 'uppercase'
          }}>
            SUPERADMIN
          </div>
        </div>

        {/* Grid Cards */}
        <div className="grid-stats" style={{ marginBottom: '2.5rem', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1.5rem' }}>
          {/* Card 1: Total Registered Companies */}
          <div className="glass-card stat-card stat-card-purple" style={{
            display: 'flex',
            flexDirection: 'row',
            alignItems: 'center',
            gap: '1rem',
            padding: '1.5rem',
            border: '1px solid var(--border-color)'
          }}>
            <div style={{ width: '48px', height: '48px', borderRadius: '50%', backgroundColor: 'rgba(124, 58, 237, 0.12)', color: '#7c3aed', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Building2 size={22} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
              <span style={{ fontSize: '0.85rem', fontWeight: '500', color: 'var(--text-muted)' }}>Registered Companies</span>
              <span style={{ fontSize: '1.75rem', fontWeight: '800', color: '#7c3aed' }}>{data.totalCompanies || 0}</span>
            </div>
          </div>

          {/* Card 2: Total Platform Telecallers */}
          <div className="glass-card stat-card stat-card-green" style={{
            display: 'flex',
            flexDirection: 'row',
            alignItems: 'center',
            gap: '1rem',
            padding: '1.5rem',
            border: '1px solid var(--border-color)'
          }}>
            <div style={{ width: '48px', height: '48px', borderRadius: '50%', backgroundColor: 'rgba(16, 185, 129, 0.12)', color: '#10b981', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Users size={22} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
              <span style={{ fontSize: '0.85rem', fontWeight: '500', color: 'var(--text-muted)' }}>Total Platform Telecallers</span>
              <span style={{ fontSize: '1.75rem', fontWeight: '800', color: '#10b981' }}>{data.totalTelecallers || 0}</span>
            </div>
          </div>

          {/* Card 3: Est. Monthly Revenue */}
          <div className="glass-card stat-card stat-card-teal" style={{
            display: 'flex',
            flexDirection: 'row',
            alignItems: 'center',
            gap: '1rem',
            padding: '1.5rem',
            border: '1px solid var(--border-color)'
          }}>
            <div style={{ width: '48px', height: '48px', borderRadius: '50%', backgroundColor: 'rgba(13, 148, 136, 0.12)', color: '#0d9488', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <IndianRupee size={22} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
              <span style={{ fontSize: '0.85rem', fontWeight: '500', color: 'var(--text-muted)' }}>Est. Monthly Revenue</span>
              <span style={{ fontSize: '1.75rem', fontWeight: '800', color: '#0d9488' }}>₹{totalMonthlyRevenue.toLocaleString('en-IN')}</span>
            </div>
          </div>

        </div>

        {/* Company details list with telecaller count */}
        <div className="glass-card" style={{ padding: '1.75rem', overflowX: 'auto', marginBottom: '2.5rem' }}>
          <h2 style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '1.5rem', fontSize: '1.25rem', color: 'var(--text-primary)' }}>
            <div style={{ width: '6px', height: '24px', backgroundColor: 'var(--color-primary)', borderRadius: '9999px' }}></div>
            Registered Company Directory
          </h2>

          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                <th style={{ padding: '12px 16px', color: 'var(--text-muted)', fontSize: '0.82rem', fontWeight: '700', textTransform: 'uppercase' }}>Company Name</th>
                <th style={{ padding: '12px 16px', color: 'var(--text-muted)', fontSize: '0.82rem', fontWeight: '700', textTransform: 'uppercase' }}>Reg Code</th>
                <th style={{ padding: '12px 16px', color: 'var(--text-muted)', fontSize: '0.82rem', fontWeight: '700', textTransform: 'uppercase' }}>Business</th>
                <th style={{ padding: '12px 16px', color: 'var(--text-muted)', fontSize: '0.82rem', fontWeight: '700', textTransform: 'uppercase' }}>Admin Details</th>
                <th style={{ padding: '12px 16px', color: 'var(--text-muted)', fontSize: '0.82rem', fontWeight: '700', textTransform: 'uppercase' }}>Plan Type</th>
                <th style={{ padding: '12px 16px', color: 'var(--text-muted)', fontSize: '0.82rem', fontWeight: '700', textTransform: 'uppercase' }}>Callers</th>
                <th style={{ padding: '12px 16px', color: 'var(--text-muted)', fontSize: '0.82rem', fontWeight: '700', textTransform: 'uppercase' }}>Subscription Expiry</th>
                <th style={{ padding: '12px 16px', color: 'var(--text-muted)', fontSize: '0.82rem', fontWeight: '700', textTransform: 'uppercase', textAlign: 'center' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {data.companies && data.companies.map((comp) => {
                const expired = isCompanyExpired(comp.subscription_end);
                return (
                  <tr key={comp.id} style={{ borderBottom: '1px solid var(--border-color)', transition: 'background-color 0.2s' }} className="table-row-hover">
                    <td style={{ padding: '16px', fontSize: '0.92rem', color: 'var(--text-primary)', fontWeight: '700' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div style={{ width: '32px', height: '32px', borderRadius: '8px', backgroundColor: 'var(--color-primary-glow)', color: 'var(--color-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '700' }}>
                          {comp.name.charAt(0).toUpperCase()}
                        </div>
                        {comp.name}
                      </div>
                    </td>
                    <td style={{ padding: '16px', fontSize: '0.92rem', color: 'var(--color-primary)', fontFamily: 'monospace', fontWeight: '700' }}>
                      {comp.reg_num}
                    </td>
                    <td style={{ padding: '16px', fontSize: '0.92rem', color: 'var(--text-secondary)' }}>
                      {comp.nature}
                    </td>
                    <td style={{ padding: '16px', fontSize: '0.92rem', color: 'var(--text-secondary)' }}>
                      <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <span>{comp.admin_email}</span>
                        <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>PW: {comp.admin_plain_password || 'encrypted'}</span>
                      </div>
                    </td>
                    <td style={{ padding: '16px', fontSize: '0.92rem' }}>
                      <span style={{
                        fontSize: '0.72rem',
                        fontWeight: '800',
                        textTransform: 'uppercase',
                        padding: '4px 8px',
                        borderRadius: '6px',
                        backgroundColor: (comp.price_per_telecaller || 59) === 59 ? 'rgba(124, 58, 237, 0.12)' : 'rgba(37, 99, 235, 0.12)',
                        color: (comp.price_per_telecaller || 59) === 59 ? '#7c3aed' : '#2563eb',
                        letterSpacing: '0.5px'
                      }}>
                        {(comp.price_per_telecaller || 59) === 59 ? 'Starter (₹59)' : 'Growth (₹99)'}
                      </span>
                    </td>
                    <td style={{ padding: '16px', fontSize: '0.95rem', color: '#10b981', fontWeight: '800' }}>
                      {comp.telecaller_count || 0}
                    </td>
                    <td style={{ padding: '16px', fontSize: '0.92rem' }}>
                      <span style={{
                        fontSize: '0.8rem',
                        fontWeight: '700',
                        color: expired ? '#ef4444' : 'var(--text-secondary)',
                        backgroundColor: expired ? 'rgba(239, 68, 68, 0.1)' : 'transparent',
                        padding: expired ? '4px 8px' : 0,
                        borderRadius: expired ? '6px' : 0,
                      }}>
                        {expired ? `EXPIRED: ${formatDateStr(comp.subscription_end)}` : formatDateStr(comp.subscription_end)}
                      </span>
                    </td>
                    <td style={{ padding: '16px', textAlign: 'center' }}>
                      <button
                        onClick={() => handleDeleteCompany(comp.id, comp.name)}
                        style={{
                          background: 'transparent',
                          border: 'none',
                          color: '#ef4444',
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          padding: '6px',
                          borderRadius: '6px',
                          transition: 'background-color 0.2s',
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(239, 68, 68, 0.1)'}
                        onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                        title="Delete Company"
                      >
                        <Trash2 size={16} />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  const { overview, callers, campaigns } = data;
  const connectedCount = parseInt(overview.connected_calls || 0);
  const nonConnectedCount = parseInt(overview.non_connected_calls || 0);
  const receivedCount = parseInt(overview.received_calls || 0);
  const missedCount = parseInt(overview.missed_calls || 0);
  const totalCalls = connectedCount + nonConnectedCount + receivedCount + missedCount;
  const successfulCalls = connectedCount + receivedCount;
  const connectionRate = totalCalls > 0 ? Math.round((successfulCalls / totalCalls) * 100) : 0;

  // Sort telecallers by talktime to build the leaderboard
  const topCallers = [...callers].sort((a, b) => b.calling_time - a.calling_time);

  return (
    <div>
      <div style={styles.dashboardHeader}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem', flexWrap: 'wrap' }}>
          <div>
            <span style={{ fontSize: '0.8rem', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Company Registration Code</span>
            {activeUser && activeUser.companyRegNum && (
              <h1 style={{ margin: '4px 0 0 0', fontSize: '1.5rem', fontWeight: '800', color: '#6366f1' }}>
                {activeUser.companyRegNum}
              </h1>
            )}
          </div>
          {activeUser && activeUser.companyRegNum && activeUser.companyRegNum.startsWith('EAZ-DEMO-') && (
            <div style={{ marginTop: '12px' }}>
              <DemoValidityBadge subscriptionEnd={activeUser.subscriptionEnd} />
            </div>
          )}
        </div>
        <div style={styles.headerActions}>
          <div style={styles.searchWrapper}>
            <Search size={16} color="var(--text-muted)" style={styles.searchIcon} />
            <input 
              type="text" 
              placeholder="Search..." 
              style={styles.searchInput}
            />
          </div>
          <select
            value={selectedTelecaller}
            onChange={(e) => setSelectedTelecaller(e.target.value)}
            style={styles.telecallerSelect}
            title="Filter by Telecaller"
          >
            <option value="">All Telecallers</option>
            {data && data.callers && data.callers.map(caller => (
              <option key={caller.id} value={caller.id}>
                {caller.name}
              </option>
            ))}
          </select>
          <button 
            style={{
              ...styles.headerActionBtn,
              backgroundColor: showNotifications ? 'rgba(124, 58, 237, 0.12)' : 'var(--bg-card)',
              borderColor: showNotifications ? 'var(--color-primary)' : 'var(--border-color)',
              color: showNotifications ? 'var(--color-secondary)' : 'var(--text-secondary)',
              position: 'relative'
            }} 
            onClick={() => { setShowNotifications(!showNotifications); setShowSettings(false); }}
            title="Notifications"
          >
            <Bell size={18} />
            {notifications.length > 0 && (
              <span style={{
                position: 'absolute',
                top: '-4px',
                right: '-4px',
                backgroundColor: '#ef4444',
                color: '#fff',
                fontSize: '0.65rem',
                fontWeight: 'bold',
                borderRadius: '50%',
                padding: '2px 5px',
                border: '2px solid var(--bg-card)',
                lineHeight: 1
              }}>
                {notifications.length}
              </span>
            )}
          </button>
          <button 
            style={{
              ...styles.headerActionBtn,
              backgroundColor: showSettings ? 'rgba(124, 58, 237, 0.12)' : 'var(--bg-card)',
              borderColor: showSettings ? 'var(--color-primary)' : 'var(--border-color)',
              color: showSettings ? 'var(--color-secondary)' : 'var(--text-secondary)'
            }} 
            onClick={() => { setShowSettings(!showSettings); setShowNotifications(false); }}
            title="Settings"
          >
            <Settings size={18} />
          </button>

          {/* Notifications Popover */}
          {showNotifications && (
            <div style={styles.notificationsPopover}>
              <h4 style={{ margin: '0 0 0.5rem 0', color: 'var(--text-primary)', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>Recent System Alerts</span>
                {notifications.length > 0 && (
                  <button 
                    onClick={handleClearAllNotifications}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: 'var(--color-primary)',
                      fontSize: '0.75rem',
                      fontWeight: '700',
                      cursor: 'pointer',
                      padding: 0
                    }}
                  >
                    Clear All
                  </button>
                )}
              </h4>
              <div style={{ display: 'flex', flexDirection: 'column', maxHeight: '300px', overflowY: 'auto' }}>
                {notifications.length === 0 ? (
                  <div style={{ padding: '1rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                    No new alerts.
                  </div>
                ) : (
                  notifications.map(n => (
                    <div key={n.id} style={styles.notificationItem}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
                        <span style={{ fontSize: '0.85rem', fontWeight: '500', color: 'var(--text-primary)', flex: 1 }}>
                          {n.message}
                        </span>
                        <button
                          onClick={() => handleDeleteNotification(n.id)}
                          style={{
                            background: 'none',
                            border: 'none',
                            color: 'var(--text-muted)',
                            cursor: 'pointer',
                            fontSize: '0.75rem',
                            padding: '0 4px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                          }}
                          title="Dismiss alert"
                        >
                          ✕
                        </button>
                      </div>
                      <span style={styles.notificationTime}>
                        {formatTimeAgo(n.created_at)}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Active Recording Sticky Player */}
      {activeRecordingUrl && (
        <div className="glass-card" style={styles.audioPlayerPanel}>
          <div style={styles.playerInfo}>
            <Volume2 size={20} color="#a855f7" className="bounce" />
            <span style={{ fontSize: '0.9rem', fontWeight: '600', color: 'var(--text-primary)' }}>Active Recording Playback</span>
          </div>
          <audio 
            src={activeRecordingUrl} 
            controls 
            autoPlay 
            style={styles.audioElement}
          />
          <button 
            onClick={() => setActiveRecordingUrl(null)}
            style={{
              padding: '6px 12px',
              fontSize: '0.8rem',
              borderRadius: '8px',
              border: '1px solid var(--border-color)',
              background: 'var(--bg-primary)',
              color: 'var(--text-primary)',
              cursor: 'pointer'
            }}
          >
            Close Player
          </button>
        </div>
      )}

      {/* Grid Cards */}
      <div className="grid-stats">
        {/* Total Leads Card */}
        <div className="glass-card stat-card stat-card-purple" style={{
          display: 'flex',
          flexDirection: 'row',
          alignItems: 'center',
          gap: '1rem',
          padding: '1.5rem',
          border: '1px solid var(--border-color)'
        }}>
          <div style={{ width: '48px', height: '48px', borderRadius: '50%', backgroundColor: 'rgba(124, 58, 237, 0.12)', color: '#7c3aed', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <TrendingUp size={22} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            <span style={{ fontSize: '0.85rem', fontWeight: '500', color: 'var(--text-muted)' }}>Total Leads</span>
            <span style={{ fontSize: '1.75rem', fontWeight: '800', color: '#7c3aed' }}>{overview.total_contacts || 0}</span>
          </div>
        </div>

        {/* Talk Time Card */}
        <div className="glass-card stat-card stat-card-blue" style={{
          display: 'flex',
          flexDirection: 'row',
          alignItems: 'center',
          gap: '1rem',
          padding: '1.5rem',
          border: '1px solid var(--border-color)'
        }}>
          <div style={{ width: '48px', height: '48px', borderRadius: '50%', backgroundColor: 'rgba(37, 99, 235, 0.12)', color: '#2563eb', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Phone size={22} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            <span style={{ fontSize: '0.85rem', fontWeight: '500', color: 'var(--text-muted)' }}>Talk Time</span>
            <span style={{ fontSize: '1.75rem', fontWeight: '800', color: '#2563eb' }}>{formatDuration(overview.total_talk_time)}</span>
          </div>
        </div>

        {/* Connected Card */}
        <div className="glass-card stat-card stat-card-green" style={{
          display: 'flex',
          flexDirection: 'row',
          alignItems: 'center',
          gap: '1rem',
          padding: '1.5rem',
          border: '1px solid var(--border-color)'
        }}>
          <div style={{ width: '48px', height: '48px', borderRadius: '50%', backgroundColor: 'rgba(16, 185, 129, 0.12)', color: '#10b981', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <PhoneOutgoing size={22} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            <span style={{ fontSize: '0.85rem', fontWeight: '500', color: 'var(--text-muted)' }}>Connected (Out)</span>
            <span style={{ fontSize: '1.75rem', fontWeight: '800', color: '#10b981' }}>{overview.connected_calls || 0}</span>
          </div>
        </div>

        {/* Non-Connected Card */}
        <div className="glass-card stat-card stat-card-orange" style={{
          display: 'flex',
          flexDirection: 'row',
          alignItems: 'center',
          gap: '1rem',
          padding: '1.5rem',
          border: '1px solid var(--border-color)'
        }}>
          <div style={{ width: '48px', height: '48px', borderRadius: '50%', backgroundColor: 'rgba(245, 158, 11, 0.12)', color: '#f59e0b', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <PhoneOff size={22} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            <span style={{ fontSize: '0.85rem', fontWeight: '500', color: 'var(--text-muted)' }}>Non-Connected</span>
            <span style={{ fontSize: '1.75rem', fontWeight: '800', color: '#f59e0b' }}>{overview.non_connected_calls || 0}</span>
          </div>
        </div>

        {/* Received Card */}
        <div className="glass-card stat-card stat-card-teal" style={{
          display: 'flex',
          flexDirection: 'row',
          alignItems: 'center',
          gap: '1rem',
          padding: '1.5rem',
          border: '1px solid var(--border-color)'
        }}>
          <div style={{ width: '48px', height: '48px', borderRadius: '50%', backgroundColor: 'rgba(13, 148, 136, 0.12)', color: '#0d9488', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <PhoneIncoming size={22} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            <span style={{ fontSize: '0.85rem', fontWeight: '500', color: 'var(--text-muted)' }}>Received (In)</span>
            <span style={{ fontSize: '1.75rem', fontWeight: '800', color: '#0d9488' }}>{overview.received_calls || 0}</span>
          </div>
        </div>

        {/* Missed Card */}
        <div className="glass-card stat-card stat-card-red" style={{
          display: 'flex',
          flexDirection: 'row',
          alignItems: 'center',
          gap: '1rem',
          padding: '1.5rem',
          border: '1px solid var(--border-color)'
        }}>
          <div style={{ width: '48px', height: '48px', borderRadius: '50%', backgroundColor: 'rgba(239, 68, 68, 0.12)', color: '#ef4444', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <PhoneMissed size={22} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            <span style={{ fontSize: '0.85rem', fontWeight: '500', color: 'var(--text-muted)' }}>Missed (In)</span>
            <span style={{ fontSize: '1.75rem', fontWeight: '800', color: '#ef4444' }}>{overview.missed_calls || 0}</span>
          </div>
        </div>
      </div>

      {/* Analytics Charts & Live Campaigns */}
      <div className="grid-charts" style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '1.5rem', marginBottom: '1.5rem' }}>
        {/* Left Side: Call Ratio Analysis */}
        <div className="glass-card" style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', marginBottom: '1rem' }}>
            <h2 style={{ display: 'flex', alignItems: 'center', gap: '10px', margin: 0, fontSize: '1.2rem', color: 'var(--text-primary)' }}>
              <div style={{ width: '6px', height: '24px', backgroundColor: '#6366f1', borderRadius: '9999px' }}></div>
              Outbound Call Outcomes
            </h2>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginTop: '8px' }}>
              <span style={{ fontSize: '2.25rem', fontWeight: '800', color: 'var(--text-primary)' }}>{connectionRate}%</span>
              <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>success rate</span>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', flex: 1, justifyContent: 'space-between' }}>
            {totalCalls === 0 ? (
              <div style={styles.noData}>No calls recorded today. Start a campaign to view logs.</div>
            ) : (
              (() => {
                const hourlyData = getHourlyCounts(recentLogs);
                const rawMax = Math.max(...Object.values(hourlyData));
                const scaleMax = rawMax <= 8 ? 8 : Math.ceil(rawMax / 4) * 4;
                const yGridValues = [0, scaleMax * 0.25, scaleMax * 0.5, scaleMax * 0.75, scaleMax];
                const hours = ['9AM', '10AM', '11AM', '12PM', '1PM'];

                return (
                  <div style={{ width: '100%', height: '200px', position: 'relative', marginTop: '0.5rem' }}>
                    <svg width="100%" height="100%" viewBox="0 0 500 200" preserveAspectRatio="none">
                      {/* Horizontal Grid lines */}
                      {yGridValues.map((val) => {
                        const y = 160 - (val / scaleMax) * 140;
                        return (
                          <g key={val}>
                            <text x="15" y={y + 4} fill="var(--text-muted)" fontSize="10" textAnchor="end">
                              {Math.round(val)}
                            </text>
                            <line x1="30" y1={y} x2="480" y2={y} stroke="rgba(255,255,255,0.06)" strokeWidth="1" />
                          </g>
                        );
                      })}
                      {/* Bars */}
                      {hours.map((hour, idx) => {
                        const val = hourlyData[hour] || 0;
                        const x = 75 + idx * 95;
                        const h = (val / scaleMax) * 140;
                        const y = 160 - h;
                        return (
                          <g key={hour}>
                            <rect
                              x={x - 10}
                              y={y}
                              width="20"
                              height={Math.max(h, 2)}
                              rx="3"
                              ry="3"
                              fill="#ff4d79"
                              style={{ transition: 'all 0.3s ease' }}
                            />
                            <text x={x} y="180" fill="var(--text-muted)" fontSize="10" textAnchor="middle">
                              {hour}
                            </text>
                          </g>
                        );
                      })}
                    </svg>
                  </div>
                );
              })()
            )}

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem 1.25rem', marginTop: '1.25rem', justifyContent: 'flex-start', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', fontWeight: '500' }}>
                <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#10b981' }}></div>
                <span style={{ color: 'var(--text-secondary)' }}>Connected (Outbound)</span>
                <span style={{ fontWeight: '700', color: 'var(--text-primary)' }}>{connectedCount}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', fontWeight: '500' }}>
                <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#f59e0b' }}></div>
                <span style={{ color: 'var(--text-secondary)' }}>Non-Connected (Outbound)</span>
                <span style={{ fontWeight: '700', color: 'var(--text-primary)' }}>{nonConnectedCount}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', fontWeight: '500' }}>
                <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#06b6d4' }}></div>
                <span style={{ color: 'var(--text-secondary)' }}>Received (Inbound)</span>
                <span style={{ fontWeight: '700', color: 'var(--text-primary)' }}>{receivedCount}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', fontWeight: '500' }}>
                <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#ff4d79' }}></div>
                <span style={{ color: 'var(--text-secondary)' }}>Missed (Inbound)</span>
                <span style={{ fontWeight: '700', color: 'var(--text-primary)' }}>{missedCount}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', fontWeight: '500' }}>
                <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#94a3b8' }}></div>
                <span style={{ color: 'var(--text-secondary)' }}>Total Placed</span>
                <span style={{ fontWeight: '700', color: 'var(--text-primary)' }}>{totalCalls}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right Side: Campaigns Summary & Top Performers stacked */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {/* Campaign Overview Card */}
          <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
            <h2 style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '1.5rem', fontSize: '1.2rem', color: 'var(--text-primary)' }}>
              <div style={{ width: '6px', height: '24px', backgroundColor: '#6366f1', borderRadius: '9999px' }}></div>
              Campaign Overview
            </h2>
            <div style={{ display: 'flex', flexDirection: 'column', flex: 1, justifyContent: 'space-between' }}>
              {campaigns.length === 0 ? (
                <p style={{ color: '#6b7280', fontSize: '0.9rem' }}>No campaigns available.</p>
              ) : (
                (() => {
                  const activeCamp = campaigns.find(c => c.status === 'active');
                  const pendingCamp = campaigns.find(c => c.status === 'pending');
                  const pausedCamp = campaigns.find(c => c.status === 'paused');
                  const completedCamp = campaigns.find(c => c.status === 'completed');
                  const totalCount = campaigns.reduce((acc, c) => acc + parseInt(c.count || 0), 0);

                  const activeCount = activeCamp ? parseInt(activeCamp.count || 0) : 0;
                  const pendingCount = pendingCamp ? parseInt(pendingCamp.count || 0) : 0;

                  return (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', flex: 1, justifyContent: 'space-between' }}>
                      <div style={{ display: 'flex', gap: '1rem' }}>
                        <div style={{
                          flex: 1,
                          padding: '1.25rem',
                          borderRadius: '12px',
                          backgroundColor: 'rgba(16, 185, 129, 0.06)',
                          border: '1px solid rgba(16, 185, 129, 0.15)',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '0.5rem',
                          alignItems: 'flex-start'
                        }}>
                          <span style={{ fontSize: '2rem', fontWeight: '800', color: '#10b981', lineHeight: 1 }}>{activeCount}</span>
                          <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.2 }}>
                            <span style={{ fontSize: '0.75rem', fontWeight: '700', color: '#10b981' }}>Active</span>
                            <span style={{ fontSize: '0.7rem', color: 'rgba(16, 185, 129, 0.7)' }}>campaign</span>
                          </div>
                        </div>

                        <div style={{
                          flex: 1,
                          padding: '1.25rem',
                          borderRadius: '12px',
                          backgroundColor: 'rgba(245, 158, 11, 0.06)',
                          border: '1px solid rgba(245, 158, 11, 0.15)',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '0.5rem',
                          alignItems: 'flex-start'
                        }}>
                          <span style={{ fontSize: '2rem', fontWeight: '800', color: '#f59e0b', lineHeight: 1 }}>{pendingCount}</span>
                          <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.2 }}>
                            <span style={{ fontSize: '0.75rem', fontWeight: '700', color: '#f59e0b' }}>Pending</span>
                            <span style={{ fontSize: '0.7rem', color: 'rgba(245, 158, 11, 0.7)' }}>campaign</span>
                          </div>
                        </div>
                      </div>

                      {(pausedCamp || completedCamp) && (
                        <div style={{ display: 'flex', gap: '10px' }}>
                          {pausedCamp && (
                            <div style={{ flex: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.5rem 0.75rem', borderRadius: '8px', backgroundColor: 'rgba(107, 114, 128, 0.06)', border: '1px solid rgba(107, 114, 128, 0.12)', color: '#4b5563', fontSize: '0.8rem' }}>
                              <span style={{ fontWeight: '600' }}>Paused: {pausedCamp.count}</span>
                            </div>
                          )}
                          {completedCamp && (
                            <div style={{ flex: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.5rem 0.75rem', borderRadius: '8px', backgroundColor: 'rgba(59, 130, 246, 0.06)', border: '1px solid rgba(59, 130, 246, 0.12)', color: '#2563eb', fontSize: '0.8rem' }}>
                              <span style={{ fontWeight: '600' }}>Done: {completedCamp.count}</span>
                            </div>
                          )}
                        </div>
                      )}

                      <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', borderTop: '1px solid var(--border-color)', paddingTop: '1rem' }}>
                        <span style={{ fontSize: '2rem', fontWeight: '800', color: 'var(--text-primary)', lineHeight: 1 }}>{totalCount}</span>
                        <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>total campaigns</span>
                      </div>
                    </div>
                  );
                })()
              )}
            </div>
          </div>

          {/* Top Performers Leaderboard Card */}
          <div className="glass-card" style={{ padding: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column', flex: 1 }}>
            <div style={{ background: 'linear-gradient(135deg, #7C3AED 0%, #A78BFA 100%)', padding: '1rem 1.25rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#FFFFFF' }}>
                <Trophy size={18} color="#FFFFFF" />
                <span style={{ fontSize: '1rem', fontWeight: '700', letterSpacing: '0.5px' }}>Top Performers</span>
              </div>
              <span style={{ fontSize: '0.7rem', fontWeight: '700', backgroundColor: 'rgba(255, 255, 255, 0.2)', padding: '3px 8px', borderRadius: '99px', color: '#FFFFFF', letterSpacing: '0.5px' }}>
                RANK #1
              </span>
            </div>
            
            <div style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem', justifyContent: 'center', flex: 1 }}>
              {topCallers.length === 0 ? (
                <div style={{ color: 'var(--text-secondary)', textAlign: 'center', padding: '0.5rem' }}>No active telecallers.</div>
              ) : (
                topCallers.slice(0, 2).map((caller) => (
                  <div key={caller.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.75rem', borderRadius: '10px', backgroundColor: 'var(--bg-primary)', border: '1px solid var(--border-color)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <div style={{ width: '32px', height: '32px', borderRadius: '50%', backgroundColor: '#F3E8FF', color: '#7C3AED', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.85rem', fontWeight: 'bold' }}>
                        {caller.name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <div style={{ fontWeight: '700', color: 'var(--text-primary)', fontSize: '0.85rem' }}>{caller.name}</div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginTop: '2px' }}>
                          <span className={`dot dot-${caller.status}`} style={{ margin: 0, width: '5px', height: '5px' }}></span>
                          <span style={{ fontSize: '0.65rem', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase' }}>{caller.status}</span>
                        </div>
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: '0.6rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 'bold', letterSpacing: '0.5px' }}>Talk Time</div>
                      <div style={{ fontSize: '0.95rem', fontWeight: '800', color: '#7C3AED', marginTop: '1px' }}>{formatDuration(caller.calling_time)}</div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Bottom: Recent Outbound Call Traffic */}
      <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', padding: '1.5rem', marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
          <h2 style={{ display: 'flex', alignItems: 'center', gap: '8px', margin: 0, fontSize: '1.2rem', color: 'var(--text-primary)' }}>
            <History size={20} color="#6366f1" />
            Recent Outbound Call Traffic
          </h2>
          <button 
            onClick={() => setActiveTab('call-logs')} 
            style={{ background: 'none', border: 'none', color: '#6366f1', fontWeight: '700', fontSize: '0.85rem', cursor: 'pointer', textTransform: 'uppercase', letterSpacing: '0.5px', outline: 'none' }}
          >
            View All
          </button>
        </div>
        
        {recentLogs.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-secondary)' }}>
            No calls logged today.
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1rem' }}>
            {recentLogs.map((log) => {
              const isMissed = log.call_status !== 'connected';
              const avatarBg = isMissed ? 'rgba(239, 68, 68, 0.1)' : 'rgba(16, 185, 129, 0.1)';
              const avatarColor = isMissed ? '#ef4444' : '#10b981';
              
              const badgeBg = isMissed ? 'rgba(239, 68, 68, 0.08)' : 'rgba(16, 185, 129, 0.08)';
              const badgeColor = isMissed ? '#ef4444' : '#10b981';
              
              const initials = log.contact_name 
                ? log.contact_name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase() 
                : 'C';

              return (
                <div 
                  key={log.id} 
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    padding: '1.25rem',
                    borderRadius: '12px',
                    backgroundColor: 'rgba(255, 255, 255, 0.02)',
                    border: '1px solid var(--border-color)',
                    transition: 'all 0.3s ease',
                    minHeight: '160px'
                  }} 
                  className="traffic-card-hover"
                >
                  {/* Top Section: Avatar and Name Info */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{ width: '36px', height: '36px', borderRadius: '50%', backgroundColor: avatarBg, color: avatarColor, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '700', fontSize: '0.85rem', flexShrink: 0 }}>
                      {initials}
                    </div>
                    <div style={{ overflow: 'hidden' }}>
                      <div style={{ fontWeight: '700', color: 'var(--text-primary)', fontSize: '0.9rem', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }} title={log.contact_name}>{log.contact_name}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', marginTop: '2px', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }} title={log.telecaller_name}>{log.telecaller_name}</div>
                    </div>
                  </div>

                  {/* Middle Section: Time and Badge */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1.25rem' }}>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      {parseDbDate(log.called_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                    </span>
                    <span style={{ fontSize: '0.65rem', fontWeight: '800', textTransform: 'uppercase', padding: '3px 8px', borderRadius: '4px', backgroundColor: badgeBg, color: badgeColor, letterSpacing: '0.5px' }}>
                      {log.call_status === 'connected' ? 'CONNECTED' : log.call_status.toUpperCase()}
                    </span>
                  </div>

                  {/* Bottom Section: Play recording */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '1rem', borderTop: '1px solid rgba(255, 255, 255, 0.03)', paddingTop: '0.75rem' }}>
                    {log.recording_url ? (
                      <button
                        onClick={() => {
                          if (activeRecordingUrl === log.recording_url) {
                            setActiveRecordingUrl(null);
                          } else {
                            setActiveRecordingUrl(log.recording_url);
                          }
                        }}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: activeRecordingUrl === log.recording_url ? '#6366f1' : 'var(--text-muted)',
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                          fontSize: '0.75rem',
                          fontWeight: '600',
                          padding: 0,
                          transition: 'all 0.2s'
                        }}
                      >
                        <Play size={10} fill={activeRecordingUrl === log.recording_url ? 'currentColor' : 'none'} />
                        <span>Play recording</span>
                      </button>
                    ) : (
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>No recording</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div style={{ height: '2rem' }}></div>

      {/* Settings Modal */}
      {showSettings && (
        <div className="modal-overlay" onClick={() => setShowSettings(false)}>
          <div className="modal-content" style={{ position: 'relative' }} onClick={(e) => e.stopPropagation()}>
            <h2 style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <Settings size={22} color="var(--color-primary)" />
              Operational Settings
            </h2>
            <form onSubmit={handleSaveSettings}>
              <div className="form-group">
                <label>Dialing Interval / Delay (seconds)</label>
                <input 
                  type="number" 
                  value={dialDelay} 
                  onChange={(e) => setDialDelay(e.target.value)} 
                  min="1"
                  required
                />
              </div>
              <div className="form-group">
                <label>Max Retry Attempts</label>
                <input 
                  type="number" 
                  value={maxRetries} 
                  onChange={(e) => setMaxRetries(e.target.value)} 
                  min="1"
                  required
                />
              </div>
              <div className="form-group">
                <label>Daily Call Limit per Telecaller</label>
                <input 
                  type="number" 
                  value={recordingLimit} 
                  onChange={(e) => setRecordingLimit(e.target.value)} 
                  min="10"
                  required
                />
              </div>
              <div className="modal-actions">
                <button type="button" className="btn btn-secondary" onClick={() => setShowSettings(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Save Settings
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

const styles = {
  audioPlayerPanel: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '1rem',
    border: '1px solid var(--color-primary)',
    borderRadius: '12px',
    background: 'var(--bg-secondary)',
    boxShadow: 'var(--shadow-md)',
    marginBottom: '1.5rem',
    gap: '1.5rem',
    zIndex: 99,
  },
  playerInfo: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
  },
  audioElement: {
    flex: 1,
    height: '32px',
  },
  chartContainer: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '2.5rem',
    minHeight: '200px',
    flexWrap: 'wrap',
  },
  noData: {
    color: '#6b7280',
    fontSize: '0.9rem',
  },
  ratioWrapper: {
    position: 'relative',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  donutSvg: {
    transform: 'rotate(-90deg)',
  },
  donutText: {
    position: 'absolute',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
  },
  donutPercent: {
    fontSize: '1.5rem',
    fontWeight: '800',
    color: 'var(--text-primary)',
  },
  donutLabel: {
    fontSize: '0.65rem',
    color: 'var(--text-secondary)',
    textTransform: 'uppercase',
    fontWeight: '600',
    letterSpacing: '0.5px',
    marginTop: '2px',
  },
  legendContainer: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.75rem',
  },
  legendItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    fontSize: '0.9rem',
    color: 'var(--text-secondary)',
  },
  legendDot: {
    width: '12px',
    height: '12px',
    borderRadius: '4px',
  },
  campaignList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '1rem',
    marginTop: '0.5rem',
  },
  campaignItem: {
    display: 'flex',
    justifyContent: 'space-between',
    padding: '0.85rem 1rem',
    borderRadius: '10px',
    background: 'var(--bg-primary)',
    border: '1px solid var(--border-color)',
  },
  campaignStatusName: {
    textTransform: 'capitalize',
    fontWeight: '600',
    fontSize: '0.9rem',
  },
  campaignCount: {
    color: 'var(--color-primary)',
    fontWeight: '600',
    fontSize: '0.9rem',
  },
  bottomGrid: {
    display: 'flex',
    gap: '1.5rem',
    marginTop: '1.5rem',
    flexWrap: 'wrap',
  },
  dashboardHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '1rem',
  },
  headerActions: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    position: 'relative',
  },
  notificationsPopover: {
    position: 'absolute',
    top: '50px',
    right: '0px',
    width: '320px',
    backgroundColor: 'var(--bg-card)',
    border: '1px solid var(--border-color)',
    borderRadius: '12px',
    padding: '1.25rem 1rem',
    boxShadow: 'var(--shadow-md)',
    zIndex: 100,
    backdropFilter: 'blur(16px)',
    textAlign: 'left',
  },
  notificationItem: {
    padding: '0.75rem 0',
    borderBottom: '1px solid var(--border-color)',
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
    textAlign: 'left',
  },
  notificationTime: {
    fontSize: '0.75rem',
    color: 'var(--text-muted)',
    textAlign: 'left',
  },
  telecallerSelect: {
    padding: '0 1rem',
    height: '42px',
    borderRadius: '10px',
    border: '1px solid var(--border-color)',
    background: 'var(--bg-card)',
    color: 'var(--text-primary)',
    fontSize: '0.9rem',
    outline: 'none',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    minWidth: '180px',
  },
  headerActionBtn: {
    width: '42px',
    height: '42px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'var(--bg-card)',
    border: '1px solid var(--border-color)',
    borderRadius: '10px',
    cursor: 'pointer',
    color: 'var(--text-secondary)',
    transition: 'all 0.2s ease',
  },
  campaignCheckWrapper: {
    width: '32px',
    height: '32px',
    borderRadius: '8px',
    backgroundColor: 'rgba(6, 182, 212, 0.12)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  fabButton: {
    position: 'absolute',
    right: '24px',
    bottom: '24px',
    width: '48px',
    height: '48px',
    borderRadius: '50%',
    backgroundColor: 'var(--color-primary)',
    color: '#ffffff',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    border: 'none',
    cursor: 'pointer',
    boxShadow: '0 4px 14px rgba(124, 58, 237, 0.4)',
    transition: 'transform 0.2s, background-color 0.2s',
  },
  searchWrapper: {
    position: 'relative',
    display: 'flex',
    alignItems: 'center',
    marginRight: '1rem'
  },
  searchIcon: {
    position: 'absolute',
    left: '12px'
  },
  searchInput: {
    padding: '8px 12px 8px 36px',
    borderRadius: '999px',
    border: '1px solid var(--border-color)',
    backgroundColor: 'var(--bg-card)',
    color: 'var(--text-primary)',
    fontSize: '0.85rem',
    outline: 'none',
    width: '180px',
    transition: 'all 0.2s'
  }
};

export default Dashboard;
