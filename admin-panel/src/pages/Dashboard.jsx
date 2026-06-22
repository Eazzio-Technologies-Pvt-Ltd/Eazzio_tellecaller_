import React, { useEffect, useState } from 'react';
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
  Play
} from 'lucide-react';

const Dashboard = ({ setActiveTab }) => {
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
      const res = await fetch(`/api/notifications/${id}`, {
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
      const res = await fetch('/api/notifications', {
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

      const queryParams = selectedTelecaller ? `?telecallerId=${selectedTelecaller}` : '';

      // Fetch analytics, logs, and notifications in parallel
      const [analyticsRes, logsRes, notificationsRes] = await Promise.all([
        fetch(`/api/call-logs/analytics${queryParams}`, { headers }),
        fetch(`/api/call-logs${queryParams}`, { headers }),
        fetch('/api/notifications', { headers })
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

  const { overview, callers, campaigns } = data;
  const connectedCount = parseInt(overview.connected_calls || 0);
  const missedCount = parseInt(overview.missed_calls || 0);
  const totalCalls = connectedCount + missedCount;
  const connectionRate = totalCalls > 0 ? Math.round((connectedCount / totalCalls) * 100) : 0;

  // Sort telecallers by talktime to build the leaderboard
  const topCallers = [...callers].sort((a, b) => b.calling_time - a.calling_time);

  return (
    <div>
      <div style={styles.dashboardHeader}>
        <div>
          <h1>Operational Analytics Dashboard</h1>
          <p className="subtitle">Real-time SIM-based calling campaigns and telecaller telemetry metrics.</p>
        </div>
        <div style={styles.headerActions}>
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
        <div className="glass-card stat-card" style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
          <div style={{ width: '52px', height: '52px', borderRadius: '50%', backgroundColor: '#7C3AED', color: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Briefcase size={22} />
          </div>
          <div className="stat-info">
            <span className="stat-label" style={{ fontSize: '0.75rem', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Total Leads</span>
            <span className="stat-value" style={{ fontSize: '2rem', fontWeight: '800', color: '#7C3AED', marginTop: '2px' }}>{overview.total_contacts || 0}</span>
          </div>
        </div>

        {/* Talk Time Card */}
        <div className="glass-card stat-card" style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
          <div style={{ width: '52px', height: '52px', borderRadius: '50%', backgroundColor: '#1E293B', color: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Hourglass size={22} />
          </div>
          <div className="stat-info">
            <span className="stat-label" style={{ fontSize: '0.75rem', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Talk Time</span>
            <span className="stat-value" style={{ fontSize: '2rem', fontWeight: '800', color: 'var(--text-primary)', marginTop: '2px' }}>{formatDuration(overview.total_talk_time)}</span>
          </div>
        </div>

        {/* Connected Card */}
        <div className="glass-card stat-card" style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
          <div style={{ width: '52px', height: '52px', borderRadius: '50%', backgroundColor: '#06B6D4', color: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <ArrowUpRight size={22} />
          </div>
          <div className="stat-info">
            <span className="stat-label" style={{ fontSize: '0.75rem', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Connected</span>
            <span className="stat-value" style={{ fontSize: '2rem', fontWeight: '800', color: 'var(--text-primary)', marginTop: '2px' }}>{overview.connected_calls || 0}</span>
          </div>
        </div>

        {/* Missed Card */}
        <div className="glass-card stat-card" style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
          <div style={{ width: '52px', height: '52px', borderRadius: '50%', backgroundColor: '#EF4444', color: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <PhoneOff size={22} />
          </div>
          <div className="stat-info">
            <span className="stat-label" style={{ fontSize: '0.75rem', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Missed</span>
            <span className="stat-value" style={{ fontSize: '2rem', fontWeight: '800', color: 'var(--text-primary)', marginTop: '2px' }}>{overview.missed_calls || 0}</span>
          </div>
        </div>
      </div>

      {/* Analytics Charts & Live Campaigns */}
      <div className="grid-charts">
        {/* Left Side: Call Ratio Analysis */}
        <div className="glass-card" style={{ display: 'flex', flexDirection: 'column' }}>
          <h2 style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '1.5rem' }}>
            <div style={{ width: '6px', height: '24px', backgroundColor: '#7c3aed', borderRadius: '9999px' }}></div>
            Outbound Call Outcomes
          </h2>
          
          <div style={styles.chartContainer}>
            {totalCalls === 0 ? (
              <div style={styles.noData}>No calls recorded today. Start a campaign to view logs.</div>
            ) : (
              <div style={styles.ratioWrapper}>
                <svg width="180" height="180" viewBox="0 0 36 36" style={styles.donutSvg}>
                  <circle cx="18" cy="18" r="15.915" fill="none" stroke="var(--donut-track)" strokeWidth="3" />
                  <circle 
                    cx="18" 
                    cy="18" 
                    r="15.915" 
                    fill="none" 
                    stroke="#00b5e2" 
                    strokeWidth="3.5" 
                    strokeDasharray={`${connectionRate} ${100 - connectionRate}`} 
                    strokeDashoffset="25" 
                  />
                </svg>
                <div style={styles.donutText}>
                  <span style={{ fontSize: '2rem', fontWeight: '800', color: 'var(--text-primary)', lineHeight: '1' }}>{connectionRate}%</span>
                  <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 'bold', letterSpacing: '1px', marginTop: '4px' }}>Success</span>
                </div>
              </div>
            )}
            
            <div style={styles.legendContainer}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '220px', padding: '8px 0', borderBottom: '1px solid var(--border-color)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div style={{ ...styles.legendDot, backgroundColor: '#00b5e2', width: '10px', height: '10px', borderRadius: '50%' }}></div>
                  <span style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', fontWeight: '500' }}>Connected</span>
                </div>
                <span style={{ fontWeight: 'bold', color: 'var(--text-primary)', fontSize: '0.95rem' }}>{connectedCount}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '220px', padding: '8px 0', borderBottom: '1px solid var(--border-color)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div style={{ ...styles.legendDot, backgroundColor: '#f87171', width: '10px', height: '10px', borderRadius: '50%' }}></div>
                  <span style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', fontWeight: '500' }}>Missed</span>
                </div>
                <span style={{ fontWeight: 'bold', color: 'var(--text-primary)', fontSize: '0.95rem' }}>{missedCount}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '220px', padding: '8px 0' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div style={{ ...styles.legendDot, backgroundColor: '#94a3b8', width: '10px', height: '10px', borderRadius: '50%' }}></div>
                  <span style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', fontWeight: '500' }}>Total Placed</span>
                </div>
                <span style={{ fontWeight: 'bold', color: 'var(--text-primary)', fontSize: '0.95rem' }}>{totalCalls}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right Side: Campaigns Summary */}
        <div className="glass-card">
          <h2 style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '1.5rem' }}>
            <div style={{ width: '6px', height: '24px', backgroundColor: '#7c3aed', borderRadius: '9999px' }}></div>
            Campaign Overview
          </h2>
          <div style={styles.campaignList}>
            {campaigns.length === 0 ? (
              <p style={{ color: '#6b7280', fontSize: '0.9rem' }}>No campaigns available.</p>
            ) : (
              campaigns.map((c, i) => (
                <div key={i} style={styles.campaignItem}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={styles.campaignCheckWrapper}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#22d3ee" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                    </div>
                    <span style={styles.campaignStatusName}>{c.status}</span>
                  </div>
                  <span style={styles.campaignCount}>{c.count} {parseInt(c.count) === 1 ? 'campaign' : 'campaigns'}</span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* NEW SIDE-BY-SIDE GRID: Leaderboard & Recent Calls */}
      <div style={styles.bottomGrid}>
        {/* Top Performers Leaderboard Card */}
        <div className="glass-card" style={{ padding: 0, overflow: 'hidden', flex: 1, display: 'flex', flexDirection: 'column' }}>
          {/* Purple Gradient Banner Header */}
          <div style={{ background: 'linear-gradient(135deg, #7C3AED 0%, #A78BFA 100%)', padding: '1.25rem 1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#FFFFFF' }}>
              <Trophy size={20} color="#FFFFFF" />
              <span style={{ fontSize: '1.15rem', fontWeight: '700', letterSpacing: '0.5px' }}>Top Performers</span>
            </div>
            <span style={{ fontSize: '0.75rem', fontWeight: '700', backgroundColor: 'rgba(255, 255, 255, 0.2)', padding: '4px 10px', borderRadius: '99px', color: '#FFFFFF', letterSpacing: '0.5px' }}>
              RANK #1
            </span>
          </div>
          
          {/* Body */}
          <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            {topCallers.length === 0 ? (
              <div style={{ color: 'var(--text-secondary)', textAlign: 'center', padding: '1rem' }}>No active telecallers.</div>
            ) : (
              topCallers.map((caller, index) => (
                <div key={caller.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: index < topCallers.length - 1 ? '1rem' : 0, borderBottom: index < topCallers.length - 1 ? '1px solid var(--border-color)' : 'none' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{ width: '48px', height: '48px', borderRadius: '50%', backgroundColor: '#F3E8FF', color: '#7C3AED', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.2rem', fontWeight: 'bold' }}>
                      {caller.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <div style={{ fontWeight: '700', color: 'var(--text-primary)', fontSize: '1rem' }}>{caller.name}</div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '4px' }}>
                        <span className={`dot dot-${caller.status}`} style={{ margin: 0 }}></span>
                        <span style={{ fontSize: '0.75rem', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase' }}>{caller.status}</span>
                      </div>
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 'bold', letterSpacing: '0.5px' }}>Talk Time</div>
                    <div style={{ fontSize: '1.15rem', fontWeight: '800', color: '#7C3AED', marginTop: '2px' }}>{formatDuration(caller.calling_time)}</div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Recent Traffic Feed Card */}
        <div style={{ flex: 1.2, display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', padding: '0 4px' }}>
            <h2 style={{ display: 'flex', alignItems: 'center', gap: '8px', margin: 0 }}>
              <History size={20} color="#7C3AED" />
              Recent Outbound Call Traffic
            </h2>
            <button 
              onClick={() => setActiveTab('call-logs')} 
              style={{ background: 'none', border: 'none', color: '#7C3AED', fontWeight: '700', fontSize: '0.85rem', cursor: 'pointer', textTransform: 'uppercase', letterSpacing: '0.5px', outline: 'none' }}
            >
              View All
            </button>
          </div>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {recentLogs.length === 0 ? (
              <div className="glass-card" style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-secondary)' }}>
                No calls logged today.
              </div>
            ) : (
              recentLogs.map((log) => {
                const isMissed = log.call_status !== 'connected';
                const iconBg = isMissed ? '#FEE2E2' : '#D1FAE5';
                const iconColor = isMissed ? '#EF4444' : '#10B981';
                
                // Status Badge Color overrides
                const badgeBg = isMissed ? 'rgba(239, 68, 68, 0.12)' : 'rgba(16, 185, 129, 0.12)';
                const badgeColor = isMissed ? '#EF4444' : '#10B981';
                
                return (
                  <div key={log.id} className="glass-card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '1rem 1.25rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <div style={{ width: '40px', height: '40px', borderRadius: '50%', backgroundColor: iconBg, color: iconColor, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        {isMissed ? <PhoneOff size={18} /> : <PhoneCall size={18} />}
                      </div>
                      <div>
                        <div style={{ fontWeight: '700', color: 'var(--text-primary)', fontSize: '0.95rem' }}>{log.contact_name}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '2px', fontWeight: '500' }}>
                          {parseDbDate(log.called_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })} • {log.telecaller_name.toUpperCase()}
                        </div>
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                      {log.recording_url && (
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
                             cursor: 'pointer',
                             display: 'flex',
                             alignItems: 'center',
                             justifyContent: 'center',
                             padding: '8px',
                             borderRadius: '50%',
                             backgroundColor: activeRecordingUrl === log.recording_url ? 'rgba(124, 58, 237, 0.15)' : 'var(--bg-primary)',
                             color: activeRecordingUrl === log.recording_url ? 'var(--color-primary)' : 'var(--text-secondary)',
                             border: '1px solid var(--border-color)',
                             transition: 'all 0.2s'
                           }}
                          title="Listen to call recording"
                        >
                          <Play size={14} fill={activeRecordingUrl === log.recording_url ? 'currentColor' : 'none'} />
                        </button>
                      )}
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px' }}>
                        <span style={{ fontSize: '0.7rem', fontWeight: '800', textTransform: 'uppercase', padding: '3px 8px', borderRadius: '99px', backgroundColor: badgeBg, color: badgeColor, letterSpacing: '0.5px' }}>
                          {log.call_status}
                        </span>
                        <span style={{ fontSize: '0.75rem', fontWeight: '600', color: 'var(--text-secondary)' }}>
                          {log.call_status === 'connected' ? `${log.duration}s` : '-'}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
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
    color: '#6366f1',
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
  }
};

export default Dashboard;
