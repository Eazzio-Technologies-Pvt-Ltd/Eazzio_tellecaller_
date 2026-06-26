import React, { useEffect, useState } from 'react';
import API_BASE_URL from '../config/api';
import { Volume2, Play, Search, Mic, MicOff, AlertCircle, CheckCircle, Lock } from 'lucide-react';

const CallLogs = ({ user }) => {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeRecordingUrl, setActiveRecordingUrl] = useState(null);
  const [recordingEnabled, setRecordingEnabled] = useState(user?.callRecordingEnabled || false);
  const [recordingEndDate, setRecordingEndDate] = useState(user?.callRecordingEndDate || null);
  const [recordingToggling, setRecordingToggling] = useState(false);
  const [recordingMsg, setRecordingMsg] = useState('');

  const isCompanyAdmin = user && user.companyRegNum;
  const isDemo = user && user.companyRegNum && user.companyRegNum.startsWith('EAZ-DEMO-');
  const isAnnual = user?.planType === 'annual';
  // Pricing: ₹99/month extra for monthly plan, ₹999/year for annual plan
  const recordingPrice = isAnnual ? '₹999/year' : '₹99/month';

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

  const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    const date = parseDbDate(dateStr);
    return date.toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const fetchLogs = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/call-logs`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      if (response.ok) {
        const data = await response.json();
        setLogs(data);
      }
    } catch (err) {
      console.error('Error logs:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
    setRecordingEnabled(user?.callRecordingEnabled || false);
    setRecordingEndDate(user?.callRecordingEndDate || null);
  }, [user]);

  const formatDuration = (seconds) => {
    if (!seconds) return '0s';
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return m > 0 ? `${m}m ${s}s` : `${s}s`;
  };

  const handlePlayRecording = (recordingUrl) => {
    if (activeRecordingUrl === recordingUrl) {
      setActiveRecordingUrl(null);
    } else {
      setActiveRecordingUrl(recordingUrl);
    }
  };

  const handleToggleRecording = async () => {
    if (isDemo) return;

    // Check if recording is active (non-expired)
    let recActive = false;
    if (recordingEndDate) {
      const now = new Date();
      let expiryStr = recordingEndDate.toString();
      if (!expiryStr.includes('Z') && !expiryStr.includes('T')) {
        expiryStr = expiryStr.replace(' ', 'T') + 'Z';
      }
      const expiry = new Date(expiryStr);
      if (expiry >= now) {
        recActive = true;
      }
    }

    if (!recActive && !recordingEnabled) {
      setRecordingMsg('Inactive subscription. Please activate call recording in the Billing page first.');
      setTimeout(() => setRecordingMsg(''), 5000);
      return;
    }

    setRecordingToggling(true);
    setRecordingMsg('');
    try {
      const response = await fetch(`${API_BASE_URL}/api/auth/toggle-call-recording`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ enabled: !recordingEnabled })
      });
      const data = await response.json();
      if (response.ok && data.success) {
        setRecordingEnabled(data.callRecordingEnabled);
        setRecordingMsg(data.message);
        setTimeout(() => setRecordingMsg(''), 4000);
      } else {
        setRecordingMsg(data.error || 'Failed to update recording setting.');
        setTimeout(() => setRecordingMsg(''), 4000);
      }
    } catch (err) {
      setRecordingMsg('Network error. Please try again.');
      setTimeout(() => setRecordingMsg(''), 4000);
    } finally {
      setRecordingToggling(false);
    }
  };

  const filteredLogs = logs.filter(log => {
    const term = searchTerm.toLowerCase();
    return (
      log.contact_name?.toLowerCase().includes(term) ||
      log.contact_phone?.includes(term) ||
      log.telecaller_name?.toLowerCase().includes(term) ||
      log.campaign_name?.toLowerCase().includes(term) ||
      log.feedback?.toLowerCase().includes(term)
    );
  });

  return (
    <div>
      <h1>Call Records &amp; Logs</h1>
      <p className="subtitle">Audit telecaller communications and play back call recordings.</p>

      {/* Allow Recording Banner — only for company admins */}
      {isCompanyAdmin && (() => {
        let recActive = false;
        if (recordingEndDate) {
          const now = new Date();
          let expiryStr = recordingEndDate.toString();
          if (!expiryStr.includes('Z') && !expiryStr.includes('T')) {
            expiryStr = expiryStr.replace(' ', 'T') + 'Z';
          }
          const expiry = new Date(expiryStr);
          if (expiry >= now) {
            recActive = true;
          }
        }
        const isRecordingWorking = recordingEnabled && recActive;

        return (
          <div style={styles.recordingBanner}>
            <div style={styles.recordingBannerLeft}>
              <div style={{
                ...styles.recordingIconWrap,
                background: isRecordingWorking
                  ? 'rgba(16, 185, 129, 0.15)'
                  : 'rgba(239, 68, 68, 0.1)',
                border: `1px solid ${isRecordingWorking ? 'rgba(16,185,129,0.3)' : 'rgba(239,68,68,0.2)'}`
              }}>
                {isRecordingWorking
                  ? <Mic size={20} color="#10b981" />
                  : <MicOff size={20} color="#ef4444" />
                }
              </div>
              <div>
                <div style={styles.recordingTitle}>
                  Call Recording
                  <span style={{
                    ...styles.recordingBadge,
                    background: isRecordingWorking ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.12)',
                    color: isRecordingWorking ? '#10b981' : '#ef4444',
                    border: `1px solid ${isRecordingWorking ? 'rgba(16,185,129,0.3)' : 'rgba(239,68,68,0.2)'}`,
                  }}>
                    {isRecordingWorking 
                      ? '● Active' 
                      : (recordingEnabled ? '● Suspended (Expired)' : '● Disabled')}
                  </span>
                </div>
                <div style={styles.recordingSubtitle}>
                  {recordingEnabled && recActive ? (
                    `Telecallers' calls are being recorded and stored. Subscription valid until ${formatDate(recordingEndDate)}.`
                  ) : recActive ? (
                    `Call recording is paid and active (until ${formatDate(recordingEndDate)}) but currently disabled. Allow recording on the right.`
                  ) : isDemo ? (
                    'Call recording requires a paid subscription plan.'
                  ) : (
                    <>
                      Enable to record and store all telecaller calls. Requires an active Call Recording subscription (Go to Billing page to activate).{' '}
                      <span style={{
                        fontWeight: '700',
                        color: isAnnual ? '#a78bfa' : '#38bdf8',
                        background: isAnnual ? 'rgba(167,139,250,0.1)' : 'rgba(56,189,248,0.1)',
                        padding: '2px 8px',
                        borderRadius: '6px',
                        fontSize: '0.8rem',
                        display: 'inline-block',
                        marginTop: '4px',
                      }}>
                        Add-on: {recordingPrice} extra
                      </span>
                    </>
                  )}
                </div>
              {recordingMsg && (
                <div style={{
                  display: 'flex', alignItems: 'center', gap: '6px',
                  marginTop: '6px', fontSize: '0.8rem',
                  color: recordingMsg.includes('error') || recordingMsg.includes('Failed') || recordingMsg.includes('Network')
                    ? '#ef4444' : '#10b981'
                }}>
                  {recordingMsg.includes('error') || recordingMsg.includes('Failed') || recordingMsg.includes('Network')
                    ? <AlertCircle size={14} />
                    : <CheckCircle size={14} />
                  }
                  {recordingMsg}
                </div>
              )}
            </div>
          </div>

          <div style={styles.recordingBannerRight}>
            {isDemo ? (
              <div style={styles.recordingUpgradeBadge}>
                <Lock size={14} />
                <span>Upgrade to enable recording</span>
              </div>
            ) : (
              <button
                onClick={handleToggleRecording}
                disabled={recordingToggling}
                style={{
                  ...styles.recordingToggleBtn,
                  background: recordingEnabled
                    ? 'rgba(239, 68, 68, 0.12)'
                    : 'rgba(16, 185, 129, 0.12)',
                  border: `2px solid ${recordingEnabled ? 'rgba(239,68,68,0.4)' : 'rgba(16,185,129,0.4)'}`,
                  color: recordingEnabled ? '#ef4444' : '#10b981',
                  opacity: recordingToggling ? 0.7 : 1,
                }}
              >
                {recordingToggling ? (
                  'Updating...'
                ) : recordingEnabled ? (
                  <><MicOff size={16} /> Disable Recording</>
                ) : (
                  <><Mic size={16} /> Allow Recording</>
                )}
              </button>
            )}
          </div>
        </div>
      );
    })()}

      {/* Search Filter Bar */}
      <div style={styles.searchBar}>
        <Search size={18} style={styles.searchIcon} />
        <input
          type="text"
          placeholder="Search by caller, lead name, phone number, campaign or notes..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          style={styles.searchInput}
        />
      </div>

      {/* Active Recording Sticky Player */}
      {activeRecordingUrl && (
        <div className="glass-card" style={styles.audioPlayerPanel}>
          <div style={styles.playerInfo}>
            <Volume2 size={20} color="#a855f7" className="bounce" />
            <span style={{ fontSize: '0.9rem', fontWeight: '600' }}>Active Recording Playback</span>
          </div>
          <audio
            src={activeRecordingUrl}
            controls
            autoPlay
            style={styles.audioElement}
          />
          <button
            className="btn btn-secondary"
            style={{ padding: '6px 12px', fontSize: '0.8rem' }}
            onClick={() => setActiveRecordingUrl(null)}
          >
            Close Player
          </button>
        </div>
      )}

      {/* Logs Table */}
      <div className="glass-card">
        {loading ? (
          <div style={{ color: 'var(--text-primary)', textAlign: 'center', padding: '2rem' }}>Loading call archives...</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table>
              <thead>
                <tr>
                  <th>Called At</th>
                  <th>Campaign</th>
                  <th>Lead Name</th>
                  <th>Phone Number</th>
                  <th>Status</th>
                  <th>Talk Time</th>
                  <th>Assigned Telecaller</th>
                  <th>Feedback Comments</th>
                  <th>Audio Recording</th>
                </tr>
              </thead>
              <tbody>
                {filteredLogs.length === 0 ? (
                  <tr>
                    <td colSpan="9" style={{ textAlign: 'center', color: '#6b7280' }}>
                      No call records matching your search queries.
                    </td>
                  </tr>
                ) : (
                  filteredLogs.map((log) => (
                    <tr key={log.id}>
                      <td style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                        {parseDbDate(log.called_at).toLocaleString()}
                      </td>
                      <td style={{ fontWeight: '500' }}>{log.campaign_name}</td>
                      <td style={{ fontWeight: '600' }}>{log.contact_name}</td>
                      <td style={{ letterSpacing: '0.5px' }}>{log.contact_phone}</td>
                      <td>
                        <span className={`badge badge-${log.call_status}`}>
                          {log.call_status}
                        </span>
                      </td>
                      <td style={{ fontWeight: '600', color: (log.call_status === 'connected' || log.call_status === 'received') ? 'var(--color-success)' : 'var(--text-muted)' }}>
                        {(log.call_status === 'connected' || log.call_status === 'received') ? formatDuration(log.duration) : '-'}
                      </td>
                      <td>{log.telecaller_name}</td>
                      <td style={{ color: 'var(--text-secondary)', maxWidth: '220px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={log.feedback}>
                        {log.feedback || <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem', fontStyle: 'italic' }}>None</span>}
                      </td>
                      <td>
                        {log.recording_url ? (
                          <button
                            className={`btn ${activeRecordingUrl === log.recording_url ? 'btn-primary' : 'btn-secondary'}`}
                            style={{ padding: '6px 12px', fontSize: '0.85rem' }}
                            onClick={() => handlePlayRecording(log.recording_url)}
                          >
                            <Play size={14} />
                            {activeRecordingUrl === log.recording_url ? 'Playing' : 'Listen'}
                          </button>
                        ) : (
                          <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem', fontStyle: 'italic' }}>No recording</span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

const styles = {
  searchBar: {
    position: 'relative',
    display: 'flex',
    alignItems: 'center',
    marginBottom: '1.5rem',
  },
  searchIcon: {
    position: 'absolute',
    left: '16px',
    color: 'var(--text-muted)',
  },
  searchInput: {
    width: '100%',
    paddingLeft: '3rem',
    height: '48px',
    fontSize: '0.95rem',
  },
  audioPlayerPanel: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '1rem',
    border: '1px solid var(--color-secondary)',
    background: 'var(--bg-secondary)',
    boxShadow: 'var(--shadow-md)',
    marginBottom: '1.5rem',
    gap: '1.5rem',
    position: 'sticky',
    top: '1.5rem',
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
  recordingBanner: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '1.25rem 1.5rem',
    borderRadius: '14px',
    background: 'var(--bg-card)',
    border: '1px solid var(--border-color)',
    marginBottom: '1.5rem',
    gap: '1rem',
    flexWrap: 'wrap',
    boxShadow: 'var(--shadow-sm)',
  },
  recordingBannerLeft: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '14px',
    flex: 1,
  },
  recordingIconWrap: {
    width: '44px',
    height: '44px',
    borderRadius: '12px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  recordingTitle: {
    fontSize: '0.95rem',
    fontWeight: '700',
    color: 'var(--text-primary)',
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    flexWrap: 'wrap',
  },
  recordingBadge: {
    fontSize: '0.72rem',
    fontWeight: '700',
    padding: '3px 10px',
    borderRadius: '20px',
    letterSpacing: '0.03em',
  },
  recordingSubtitle: {
    fontSize: '0.82rem',
    color: 'var(--text-secondary)',
    marginTop: '4px',
    lineHeight: '1.5',
  },
  recordingBannerRight: {
    display: 'flex',
    alignItems: 'center',
    flexShrink: 0,
  },
  recordingToggleBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '8px',
    padding: '10px 20px',
    borderRadius: '10px',
    fontSize: '0.88rem',
    fontWeight: '700',
    cursor: 'pointer',
    transition: 'all 0.25s ease',
    whiteSpace: 'nowrap',
  },
  recordingUpgradeBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    padding: '9px 16px',
    borderRadius: '10px',
    fontSize: '0.82rem',
    fontWeight: '600',
    background: 'rgba(245, 158, 11, 0.1)',
    color: '#f59e0b',
    border: '1px solid rgba(245, 158, 11, 0.25)',
  },
};

export default CallLogs;
