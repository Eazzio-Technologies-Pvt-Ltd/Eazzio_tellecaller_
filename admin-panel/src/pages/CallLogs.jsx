import React, { useEffect, useState } from 'react';
import API_BASE_URL from '../config/api';
import { Volume2, Play, Search, Mic, MicOff, AlertCircle, CheckCircle, Lock, Calendar, Clock, Activity, FileDown, User, PhoneIncoming, PhoneMissed } from 'lucide-react';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

const CallLogs = ({ user, setActiveTab }) => {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedTelecallerId, setSelectedTelecallerId] = useState('all');
  const [activeRecordingUrl, setActiveRecordingUrl] = useState(null);
  const [recordingEnabled, setRecordingEnabled] = useState(user?.callRecordingEnabled || false);
  const [recordingEndDate, setRecordingEndDate] = useState(user?.callRecordingEndDate || null);
  const [recordingToggling, setRecordingToggling] = useState(false);
  const [recordingMsg, setRecordingMsg] = useState('');

  // Filters State
  const [timeFilter, setTimeFilter] = useState('all'); // all, today, yesterday, week, month, custom
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [durationFilter, setDurationFilter] = useState('all'); // all, connected, short, medium, long

  const isCompanyAdmin = user && user.companyRegNum;
  const isDemo = user && user.companyRegNum && user.companyRegNum.startsWith('EAZ-DEMO-') && user.planType === 'demo';
  const isAnnual = user?.planType === 'annual' || user?.planType === 'starter' || user?.planType === 'growth';
  const planKey = (user?.planType || '').toLowerCase();
  // Pricing: Starter/monthly call recording add-on: ₹3,999/annually. Growth: FREE. Basic: Not Available.
  const recordingPrice = planKey === 'growth' || planKey === 'annual'
    ? 'FREE'
    : (planKey === 'starter' || planKey === 'monthly'
      ? '₹3,999/annually'
      : (planKey === 'basic' || planKey === 'demo' ? 'Not Available' : '₹3,999/annually'));

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

  const generatePDFReport = () => {
    try {
      const doc = new jsPDF();
      doc.setFont("helvetica", "bold");
      doc.setFontSize(16);
      doc.text("Eazzio Telecaller System - Call Analytics Report", 14, 15);
      
      doc.setFontSize(9);
      doc.setFont("helvetica", "normal");
      doc.text(`Generated on: ${new Date().toLocaleString()}`, 14, 21);

      // Selected Telecaller
      const tcName = selectedTelecallerId === 'all'
        ? 'All Telecallers'
        : (uniqueTelecallers.find(tc => String(tc.id) === String(selectedTelecallerId))?.name || 'Unknown');
      doc.text(`Telecaller: ${tcName}`, 14, 27);

      // Time Period
      let timeLabel = '';
      if (timeFilter === 'all') timeLabel = 'All Time';
      else if (timeFilter === 'today') timeLabel = 'Today';
      else if (timeFilter === 'yesterday') timeLabel = 'Yesterday';
      else if (timeFilter === 'week') timeLabel = 'Last 7 Days';
      else if (timeFilter === 'month') timeLabel = 'Last 30 Days';
      else if (timeFilter === 'custom') {
        timeLabel = `Custom Range: ${startDate || 'Any'} to ${endDate || 'Any'}`;
      }
      doc.text(`Time Period: ${timeLabel}`, 14, 33);

      // Duration Filter
      let durLabel = 'All Durations';
      if (durationFilter === 'connected') durLabel = 'Connected Only';
      else if (durationFilter === 'short') durLabel = 'Short (< 1 min)';
      else if (durationFilter === 'medium') durLabel = 'Medium (1 - 5 mins)';
      else if (durationFilter === 'long') durLabel = 'Long (> 5 mins)';
      doc.text(`Duration: ${durLabel}`, 14, 39);

      const tableColumn = [
        "Called At",
        "Campaign",
        "Lead Name",
        "Phone",
        "Status",
        "Duration",
        "Telecaller",
        "Response 1",
        "Response 2",
        "Response 3"
      ];
      
      const tableRows = [];

      filteredLogs.forEach(log => {
        const logData = [
          parseDbDate(log.called_at).toLocaleString(),
          log.campaign_name || '-',
          log.contact_name || '-',
          log.contact_phone || '-',
          log.call_status || '-',
          log.call_status === 'connected' || log.call_status === 'received' ? `${log.duration}s` : '-',
          log.telecaller_name || '-',
          log.response_1 || '-',
          log.response_2 || '-',
          log.response_3 || '-'
        ];
        tableRows.push(logData);
      });

      autoTable(doc, {
        head: [tableColumn],
        body: tableRows,
        startY: 45,
        theme: 'grid',
        styles: { fontSize: 7, cellPadding: 2 },
        headStyles: { fillColor: [99, 102, 241] } // Indigo header
      });

      doc.save(`call_report_${new Date().toISOString().split('T')[0]}.pdf`);
    } catch (e) {
      console.error("PDF generation failed:", e);
      alert(`Could not generate PDF: ${e.message}`);
    }
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

    // Auto-update polling: refresh logs every 10 seconds
    const interval = setInterval(() => {
      fetchLogs();
    }, 10000);

    return () => clearInterval(interval);
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

    if (!recActive) {
      // Redirect to call recording subscription page
      if (setActiveTab) {
        setActiveTab('billing');
      }
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

  const getTrackingDate = (d) => {
    const target = new Date(d);
    const year = target.getFullYear();
    const month = String(target.getMonth() + 1).padStart(2, '0');
    const day = String(target.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const isToday = (date) => {
    return getTrackingDate(date) === getTrackingDate(new Date());
  };

  const getTodayStats = () => {
    let total = 0;
    let connected = 0;
    let talkTime = 0;
    let received = 0;
    let receivedDuration = 0;
    let missed = 0;

    logs.forEach(log => {
      const logDate = parseDbDate(log.called_at);
      if (isToday(logDate)) {
        total++;
        if (log.call_status === 'connected' || log.call_status === 'received') {
          connected++;
          talkTime += (log.duration || 0);
        }
        if (log.call_status === 'received') {
          received++;
          receivedDuration += (log.duration || 0);
        }
        if (log.call_status === 'missed') {
          missed++;
        }
      }
    });

    return { total, connected, talkTime, received, receivedDuration, missed };
  };

  const todayStats = getTodayStats();

  const uniqueTelecallers = Array.from(
    new Map(
      logs
        .filter(log => log.telecaller_id && log.telecaller_name)
        .map(log => [log.telecaller_id, log.telecaller_name])
    ).entries()
  ).map(([id, name]) => ({ id, name }));

  const filteredLogs = logs.filter(log => {
    if (selectedTelecallerId !== 'all') {
      if (String(log.telecaller_id) !== String(selectedTelecallerId)) return false;
    }

    // Timing filter
    const logDate = parseDbDate(log.called_at);
    const now = new Date();
    
    if (timeFilter === 'today') {
      if (!isToday(logDate)) return false;
    } else if (timeFilter === 'yesterday') {
      const todayTracking = new Date(getTrackingDate(new Date()));
      const yesterdayTracking = new Date(todayTracking.getTime() - 24 * 60 * 60 * 1000);
      const yesterdayStr = yesterdayTracking.toISOString().substring(0, 10);
      if (getTrackingDate(logDate) !== yesterdayStr) return false;
    } else if (timeFilter === 'week') {
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(now.getDate() - 7);
      if (logDate < sevenDaysAgo) return false;
    } else if (timeFilter === 'month') {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(now.getDate() - 30);
      if (logDate < thirtyDaysAgo) return false;
    } else if (timeFilter === 'custom') {
      if (startDate) {
        const start = new Date(startDate);
        if (logDate < start) return false;
      }
      if (endDate) {
        const end = new Date(endDate);
        if (logDate > end) return false;
      }
    }

    // Duration filter
    if (durationFilter === 'connected') {
      if (log.call_status !== 'connected' && log.call_status !== 'received') return false;
    } else if (durationFilter === 'short') {
      if ((log.call_status !== 'connected' && log.call_status !== 'received') || log.duration >= 60) return false;
    } else if (durationFilter === 'medium') {
      if ((log.call_status !== 'connected' && log.call_status !== 'received') || log.duration < 60 || log.duration > 300) return false;
    } else if (durationFilter === 'long') {
      if ((log.call_status !== 'connected' && log.call_status !== 'received') || log.duration <= 300) return false;
    }

    return true;
  });

  return (
    <div>
      <style>{`
        @keyframes pulse-live {
          0% {
            transform: scale(0.9);
            opacity: 0.6;
          }
          50% {
            transform: scale(1.1);
            opacity: 1;
          }
          100% {
            transform: scale(0.9);
            opacity: 0.6;
          }
        }
        .live-pulsing-dot {
          animation: pulse-live 1.8s infinite ease-in-out;
        }
      `}</style>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem', marginBottom: '0.75rem' }}>
        <div>
          <h1 style={{ margin: 0 }}>Call Records &amp; Logs</h1>
          <p className="subtitle" style={{ margin: '4px 0 0 0' }}>Audit telecaller communications and play back call recordings.</p>
        </div>
        <div style={styles.liveIndicator}>
          <span style={styles.liveDot} className="live-pulsing-dot" />
          <span style={{ fontSize: '0.8rem', fontWeight: '600', color: '#10b981' }}>Live Auto-Updating</span>
        </div>
      </div>

      {/* Daily Stats Grid */}
      <div style={styles.statsGrid}>
        <div className="glass-card" style={{ ...styles.statCard, borderLeft: '4px solid #3b82f6' }}>
          <div style={styles.statIconWrapBlue}>
            <Activity size={20} />
          </div>
          <div>
            <div style={styles.statLabel}>Today's Total Calls</div>
            <div style={styles.statValue}>{todayStats.total}</div>
          </div>
        </div>

        <div className="glass-card" style={{ ...styles.statCard, borderLeft: '4px solid #10b981' }}>
          <div style={styles.statIconWrapGreen}>
            <Play size={20} fill="currentColor" />
          </div>
          <div>
            <div style={styles.statLabel}>Today's Connected</div>
            <div style={styles.statValue}>{todayStats.connected}</div>
          </div>
        </div>

        <div className="glass-card" style={{ ...styles.statCard, borderLeft: '4px solid #a855f7' }}>
          <div style={styles.statIconWrapPurple}>
            <Clock size={20} />
          </div>
          <div>
            <div style={styles.statLabel}>Today's Talk Time</div>
            <div style={styles.statValue}>{formatDuration(todayStats.talkTime)}</div>
          </div>
        </div>

        <div className="glass-card" style={{ ...styles.statCard, borderLeft: '4px solid #10b981' }}>
          <div style={{ ...styles.statIconWrapGreen, background: 'rgba(16,185,129,0.12)', color: '#10b981' }}>
            <PhoneIncoming size={20} />
          </div>
          <div>
            <div style={styles.statLabel}>Today's Received</div>
            <div style={styles.statValue}>{todayStats.received}</div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '2px' }}>
              {todayStats.receivedDuration > 0 ? `⏱ ${formatDuration(todayStats.receivedDuration)}` : 'No duration'}
            </div>
          </div>
        </div>

        <div className="glass-card" style={{ ...styles.statCard, borderLeft: '4px solid #ef4444' }}>
          <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: 'rgba(239,68,68,0.12)', color: '#ef4444', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <PhoneMissed size={20} />
          </div>
          <div>
            <div style={styles.statLabel}>Today's Missed</div>
            <div style={{ ...styles.statValue, color: '#ef4444' }}>{todayStats.missed}</div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '2px' }}>No answer</div>
          </div>
        </div>
      </div>

      {/* Allow Recording Banner — only for company admins */}
      {isCompanyAdmin && (() => {
        let recActive = false;
        if (user?.planType === 'growth') {
          recActive = true;
        } else if (recordingEndDate) {
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
        const isRecordingWorking = (recordingEnabled || user?.planType === 'growth') && recActive;

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
                    {user?.planType === 'basic'
                      ? '● Not Available'
                      : user?.planType === 'growth'
                        ? '● Active (Free)'
                        : isRecordingWorking 
                          ? '● Active' 
                          : (recordingEnabled ? '● Suspended (Expired)' : '● Disabled')}
                  </span>
                </div>
                <div style={styles.recordingSubtitle}>
                  {user?.planType === 'basic' ? (
                    'Call recording is not available on the Basic Plan. Please upgrade to the Starter or Growth plan to start recording calls.'
                  ) : user?.planType === 'growth' ? (
                    "Call recording is free and active. All telecallers' calls are recorded automatically."
                  ) : recordingEnabled && recActive ? (
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
            {user?.planType === 'basic' ? (
              <div 
                style={{ ...styles.recordingUpgradeBadge, cursor: 'pointer' }}
                onClick={() => setActiveTab('billing')}
              >
                <Lock size={14} style={{ marginRight: '4px' }} />
                <span>Upgrade Plan</span>
              </div>
            ) : user?.planType === 'growth' ? (
              <div style={{ ...styles.recordingUpgradeBadge, backgroundColor: 'rgba(16, 185, 129, 0.15)', borderColor: 'rgba(16,185,129,0.3)', color: '#10b981' }}>
                <span>Free & Active</span>
              </div>
            ) : isDemo ? (
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

      {/* Search & Filters Panel */}
      <div className="glass-card" style={styles.filterPanel}>
        <div style={styles.filterRow}>
          {/* Select Telecaller Dropdown */}
          <div style={{ ...styles.filterGroup, flex: 2 }}>
            <label style={styles.filterLabel}>Select Telecaller</label>
            <div style={{ position: 'relative' }}>
              <User size={16} style={styles.selectIcon} />
              <select
                value={selectedTelecallerId}
                onChange={(e) => setSelectedTelecallerId(e.target.value)}
                style={styles.filterSelect}
              >
                <option value="all">All Telecallers</option>
                {uniqueTelecallers.map(tc => (
                  <option key={tc.id} value={tc.id}>{tc.name}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Timing Preset Filter */}
          <div style={styles.filterGroup}>
            <label style={styles.filterLabel}>Time Period</label>
            <div style={{ position: 'relative' }}>
              <Calendar size={16} style={styles.selectIcon} />
              <select
                value={timeFilter}
                onChange={(e) => setTimeFilter(e.target.value)}
                style={styles.filterSelect}
              >
                <option value="all">All Time</option>
                <option value="today">Today</option>
                <option value="yesterday">Yesterday</option>
                <option value="week">Last 7 Days</option>
                <option value="month">Last 30 Days</option>
                <option value="custom">Custom Range</option>
              </select>
            </div>
          </div>

          {/* Talk Time Duration Filter */}
          <div style={styles.filterGroup}>
            <label style={styles.filterLabel}>Duration</label>
            <div style={{ position: 'relative' }}>
              <Clock size={16} style={styles.selectIcon} />
              <select
                value={durationFilter}
                onChange={(e) => setDurationFilter(e.target.value)}
                style={styles.filterSelect}
              >
                <option value="all">All Durations</option>
                <option value="connected">Connected Only</option>
                <option value="short">Short (&lt; 1 min)</option>
                <option value="medium">Medium (1 - 5 mins)</option>
                <option value="long">Long (&gt; 5 mins)</option>
              </select>
            </div>
          </div>

          {/* Export PDF Report Button */}
          <div style={{ ...styles.filterGroup, minWidth: '150px', justifyContent: 'flex-end', display: 'flex', alignItems: 'flex-end' }}>
            <button
              onClick={generatePDFReport}
              className="btn btn-primary"
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                padding: '10px 16px',
                height: '42px',
                width: '100%',
                fontWeight: 'bold',
                cursor: 'pointer',
                borderRadius: '6px',
                border: 'none',
                backgroundColor: 'var(--color-primary, #6366f1)',
                color: '#ffffff'
              }}
            >
              <FileDown size={16} /> Generate Report
            </button>
          </div>
        </div>

        {/* Custom Date Range Pickers (conditional) */}
        {timeFilter === 'custom' && (
          <div style={styles.customDateRow}>
            <div style={styles.filterGroup}>
              <label style={styles.filterLabel}>Start Date &amp; Time</label>
              <input
                type="datetime-local"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                style={styles.dateInput}
              />
            </div>
            <div style={styles.filterGroup}>
              <label style={styles.filterLabel}>End Date &amp; Time</label>
              <input
                type="datetime-local"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                style={styles.dateInput}
              />
            </div>
          </div>
        )}
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
                  <th>Response 1</th>
                  <th>Response 2</th>
                  <th>Response 3</th>
                  <th>Audio Recording</th>
                </tr>
              </thead>
              <tbody>
                {filteredLogs.length === 0 ? (
                  <tr>
                    <td colSpan="12" style={{ textAlign: 'center', color: '#6b7280' }}>
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
                        {(() => {
                          const status = log.call_status;
                          const statusConfig = {
                            connected:     { label: 'CONNECTED',     icon: '📞', className: 'badge-connected' },
                            received:      { label: 'RECEIVED',      icon: '📲', className: 'badge-received' },
                            missed:        { label: 'MISSED',        icon: '📵', className: 'badge-missed' },
                            'non-connected': { label: 'NON-CONNECTED', icon: '🔕', className: 'badge-non-connected' },
                          };
                          const cfg = statusConfig[status] || { label: (status || '—').toUpperCase(), icon: '•', className: '' };
                          return (
                            <span
                              className={`badge ${cfg.className}`}
                              style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontWeight: 700, letterSpacing: '0.03em', fontSize: '0.72rem' }}
                            >
                              <span style={{ fontSize: '0.85em' }}>{cfg.icon}</span>
                              {cfg.label}
                            </span>
                          );
                        })()}
                      </td>
                      <td style={{ fontWeight: '600', color: (log.call_status === 'connected' || log.call_status === 'received') ? 'var(--color-success)' : 'var(--text-muted)' }}>
                        {(log.call_status === 'connected' || log.call_status === 'received') ? formatDuration(log.duration) : '-'}
                      </td>
                      <td>{log.telecaller_name}</td>
                      <td style={{ color: 'var(--text-secondary)', maxWidth: '220px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={log.feedback}>
                        {log.feedback || <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem', fontStyle: 'italic' }}>None</span>}
                      </td>
                      <td style={{ color: 'var(--text-secondary)' }}>{log.response_1 || '-'}</td>
                      <td style={{ color: 'var(--text-secondary)' }}>{log.response_2 || '-'}</td>
                      <td style={{ color: 'var(--text-secondary)' }}>{log.response_3 || '-'}</td>
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
  liveIndicator: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '6px 12px',
    borderRadius: '20px',
    background: 'rgba(16, 185, 129, 0.1)',
    border: '1px solid rgba(16, 185, 129, 0.25)',
  },
  liveDot: {
    width: '8px',
    height: '8px',
    borderRadius: '50%',
    background: '#10b981',
  },
  statsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
    gap: '1rem',
    marginBottom: '1.5rem',
  },
  statCard: {
    display: 'flex',
    alignItems: 'center',
    gap: '14px',
    padding: '1.25rem',
    borderRadius: '12px',
    background: 'var(--bg-card)',
    border: '1px solid var(--border-color)',
    boxShadow: 'var(--shadow-sm)',
  },
  statIconWrapBlue: {
    width: '40px',
    height: '40px',
    borderRadius: '10px',
    background: 'rgba(59, 130, 246, 0.1)',
    color: '#3b82f6',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  statIconWrapGreen: {
    width: '40px',
    height: '40px',
    borderRadius: '10px',
    background: 'rgba(16, 185, 129, 0.1)',
    color: '#10b981',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  statIconWrapPurple: {
    width: '40px',
    height: '40px',
    borderRadius: '10px',
    background: 'rgba(168, 85, 247, 0.1)',
    color: '#a855f7',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  statLabel: {
    fontSize: '0.75rem',
    color: 'var(--text-muted)',
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
  },
  statValue: {
    fontSize: '1.4rem',
    fontWeight: '800',
    color: 'var(--text-primary)',
    marginTop: '2px',
  },
  filterPanel: {
    padding: '1.25rem',
    borderRadius: '14px',
    background: 'var(--bg-card)',
    border: '1px solid var(--border-color)',
    marginBottom: '1.5rem',
    display: 'flex',
    flexDirection: 'column',
    gap: '1rem',
  },
  filterRow: {
    display: 'flex',
    gap: '1rem',
    flexWrap: 'wrap',
    alignItems: 'flex-end',
  },
  filterGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
    flex: 1,
    minWidth: '200px',
  },
  filterLabel: {
    fontSize: '0.78rem',
    fontWeight: '600',
    color: 'var(--text-secondary)',
  },
  searchContainer: {
    position: 'relative',
    display: 'flex',
    alignItems: 'center',
  },
  searchIconInside: {
    position: 'absolute',
    left: '12px',
    color: 'var(--text-muted)',
  },
  filterInputSearch: {
    width: '100%',
    paddingLeft: '2.5rem',
    paddingRight: '12px',
    height: '40px',
    fontSize: '0.88rem',
    borderRadius: '8px',
    border: '1px solid var(--border-color)',
    background: 'rgba(255, 255, 255, 0.03)',
    color: 'var(--text-primary)',
    outline: 'none',
  },
  filterSelect: {
    width: '100%',
    paddingLeft: '2.5rem',
    paddingRight: '2rem',
    height: '40px',
    fontSize: '0.88rem',
    borderRadius: '8px',
    border: '1px solid var(--border-color)',
    background: 'rgba(255, 255, 255, 0.03)',
    color: 'var(--text-primary)',
    outline: 'none',
    appearance: 'none',
    cursor: 'pointer',
  },
  selectIcon: {
    position: 'absolute',
    left: '12px',
    top: '50%',
    transform: 'translateY(-50%)',
    color: 'var(--text-muted)',
    pointerEvents: 'none',
  },
  customDateRow: {
    display: 'flex',
    gap: '1rem',
    flexWrap: 'wrap',
    paddingTop: '0.5rem',
    borderTop: '1px dashed var(--border-color)',
  },
  dateInput: {
    width: '100%',
    padding: '0 12px',
    height: '40px',
    fontSize: '0.88rem',
    borderRadius: '8px',
    border: '1px solid var(--border-color)',
    background: 'rgba(255, 255, 255, 0.03)',
    color: 'var(--text-primary)',
    outline: 'none',
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
