import React, { useEffect, useState, useRef } from 'react';
import {
  LayoutGrid, Grid2X2, Grid3X3, Monitor,
  Phone, Clock, Coffee, Wifi, WifiOff,
  PhoneCall, Maximize2, RefreshCw, BarChart2,
  Activity, X
} from 'lucide-react';

const GRID_OPTIONS = [
  { label: '1×1', value: 1, icon: Monitor },
  { label: '2×2', value: 2, icon: Grid2X2 },
  { label: '3×3', value: 3, icon: Grid3X3 },
  { label: '4×4', value: 4, icon: LayoutGrid },
];

const STATUS_META = {
  online:   { color: '#10b981', glow: 'rgba(16,185,129,0.35)',  label: 'Online',   bg: 'rgba(16,185,129,0.1)'  },
  offline:  { color: '#6b7280', glow: 'rgba(107,114,128,0.2)', label: 'Offline',  bg: 'rgba(107,114,128,0.08)' },
  calling:  { color: '#6366f1', glow: 'rgba(99,102,241,0.4)',  label: 'Calling',  bg: 'rgba(99,102,241,0.12)' },
  break:    { color: '#f59e0b', glow: 'rgba(245,158,11,0.35)', label: 'On Break', bg: 'rgba(245,158,11,0.1)'  },
};

const formatDur = (secs) => {
  if (!secs) return '—';
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = secs % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
};

// ── Single telecaller card ────────────────────────────────────────────────────
const CallerCard = ({ caller, gridSize, isExpanded, onClick }) => {
  const meta = STATUS_META[caller.status] || STATUS_META.offline;
  const initials = (caller.name || '?').split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
  const callPct  = caller.working_time
    ? Math.min(100, Math.round((caller.calling_time / caller.working_time) * 100))
    : 0;

  // Dynamic layout adjustments to look beautiful at all grid sizes (1x1 to 4x4)
  const cardPadding = gridSize === 1 ? '1.5rem' : gridSize === 2 ? '1.1rem' : gridSize === 3 ? '0.8rem' : '0.5rem';
  const avatarSize = gridSize <= 2 ? 42 : gridSize === 3 ? 34 : 28;
  const nameSize = gridSize <= 2 ? '0.9rem' : gridSize === 3 ? '0.8rem' : '0.7rem';
  const phoneSize = gridSize <= 2 ? '0.72rem' : gridSize === 3 ? '0.65rem' : '0.58rem';
  const badgePadding = gridSize <= 2 ? '4px 10px' : gridSize === 3 ? '3px 8px' : '2px 5px';
  const badgeFont = gridSize <= 2 ? '0.72rem' : gridSize === 3 ? '0.65rem' : '0.58rem';
  
  const statsGap = gridSize <= 2 ? 8 : gridSize === 3 ? 6 : 4;
  const statBoxPadding = gridSize <= 2 ? '8px 10px' : gridSize === 3 ? '6px 8px' : '4px 5px';
  const statValueSize = gridSize <= 2 ? '0.9rem' : gridSize === 3 ? '0.78rem' : '0.68rem';
  const statLabelSize = gridSize <= 2 ? '0.68rem' : gridSize === 3 ? '0.58rem' : '0.48rem';
  const statIconSize = gridSize <= 2 ? 14 : gridSize === 3 ? 12 : 10;
  
  const barLabelSize = gridSize <= 2 ? '0.68rem' : gridSize === 3 ? '0.6rem' : '0.52rem';
  const barHeight = gridSize <= 2 ? 5 : gridSize === 3 ? 4 : 3;

  return (
    <div 
      className={isExpanded ? "" : "zoom-on-hover"}
      onClick={isExpanded ? undefined : onClick}
      style={{
        ...styles.card,
        padding: cardPadding,
        border: `1px solid ${meta.color}44`,
        boxShadow: `0 0 18px ${meta.glow}, 0 2px 8px rgba(0,0,0,0.3)`,
        animation: caller.status === 'calling' ? 'pulse-calling 2s infinite' : 'none',
        cursor: isExpanded ? 'default' : 'pointer',
      }}>
      {/* Header row */}
      <div style={{ ...styles.cardHeader, marginBottom: gridSize <= 2 ? 12 : 8 }}>
        <div style={{ 
          ...styles.avatar, 
          width: avatarSize, 
          height: avatarSize, 
          fontSize: gridSize <= 2 ? '0.95rem' : gridSize === 3 ? '0.85rem' : '0.75rem',
          background: `linear-gradient(135deg, ${meta.color}cc, ${meta.color}66)` 
        }}>
          {initials}
        </div>
        <div style={styles.callerInfo}>
          <div style={{ ...styles.callerName, fontSize: nameSize }}>{caller.name}</div>
          <div style={{ ...styles.callerPhone, fontSize: phoneSize }}>{caller.email}</div>
        </div>
        <div style={{ 
          ...styles.statusBadge, 
          padding: badgePadding, 
          fontSize: badgeFont, 
          background: meta.bg, 
          color: meta.color, 
          border: `1px solid ${meta.color}55` 
        }}>
          <span style={{ 
            ...styles.statusDot, 
            width: gridSize <= 2 ? 7 : 5, 
            height: gridSize <= 2 ? 7 : 5, 
            background: meta.color, 
            boxShadow: `0 0 6px ${meta.color}` 
          }} />
          {meta.label}
        </div>
      </div>

      {/* Stats grid */}
      <div style={{ ...styles.statsGrid, gap: statsGap, marginBottom: gridSize <= 2 ? 12 : 8 }}>
        <StatBox 
          icon={<PhoneCall size={statIconSize} color="#6366f1" />} 
          label="Talk Time"  
          value={formatDur(caller.calling_time)}  
          color="#6366f1" 
          padding={statBoxPadding}
          valueSize={statValueSize}
          labelSize={statLabelSize}
        />
        <StatBox 
          icon={<Clock size={statIconSize} color="#10b981" />} 
          label="Work Time" 
          value={formatDur(caller.working_time)}  
          color="#10b981" 
          padding={statBoxPadding}
          valueSize={statValueSize}
          labelSize={statLabelSize}
        />
        <StatBox 
          icon={<Activity size={statIconSize} color="#f59e0b" />} 
          label="Idle Time" 
          value={formatDur(caller.idle_time)}    
          color="#f59e0b" 
          padding={statBoxPadding}
          valueSize={statValueSize}
          labelSize={statLabelSize}
        />
        <StatBox 
          icon={<Coffee size={statIconSize} color="#8b5cf6" />} 
          label="Break"     
          value={formatDur(caller.break_time)}   
          color="#8b5cf6" 
          padding={statBoxPadding}
          valueSize={statValueSize}
          labelSize={statLabelSize}
        />
      </div>

      {/* Activity bar */}
      <div style={{ ...styles.barTrack, height: barHeight, marginTop: gridSize <= 2 ? 6 : 4 }}>
        <div style={{
          ...styles.barFill,
          width: `${callPct}%`,
          background: `linear-gradient(90deg, ${meta.color}, ${meta.color}99)`,
          boxShadow: `0 0 8px ${meta.color}88`,
        }} />
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '3px' }}>
        <span style={{ ...styles.barLabel, fontSize: barLabelSize }}>Calling efficiency</span>
        <span style={{ ...styles.barLabel, fontSize: barLabelSize, color: meta.color, fontWeight: '700' }}>{callPct}%</span>
      </div>
    </div>
  );
};

const StatBox = ({ icon, label, value, color, padding, valueSize, labelSize }) => (
  <div style={{ ...styles.statBox, padding }}>
    <div style={styles.statIcon}>{icon}</div>
    <div style={{ ...styles.statValue, color, fontSize: valueSize }}>{value}</div>
    <div style={{ ...styles.statLabel, fontSize: labelSize }}>{label}</div>
  </div>
);

// ── Main MonitorGrid page ─────────────────────────────────────────────────────
const MonitorGrid = () => {
  const [callers, setCallers]     = useState([]);
  const [gridSize, setGridSize]   = useState(2);
  const [loading, setLoading]     = useState(true);
  const [lastRefresh, setLastRefresh] = useState(null);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [expandedCallerId, setExpandedCallerId] = useState(null);
  const intervalRef = useRef(null);

  const fetchCallers = async () => {
    try {
      const res = await fetch('/api/call-logs/analytics', {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
      });
      if (res.ok) {
        const data = await res.json();
        setCallers(data.callers || []);
        setLastRefresh(new Date());
      }
    } catch (e) {
      console.error('MonitorGrid fetch error:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCallers();
  }, []);

  useEffect(() => {
    if (autoRefresh) {
      intervalRef.current = setInterval(fetchCallers, 8000);
    } else {
      clearInterval(intervalRef.current);
    }
    return () => clearInterval(intervalRef.current);
  }, [autoRefresh]);

  const perPage   = gridSize * gridSize;
  const visible   = callers.slice(0, perPage);
  const colsStyle = `repeat(${gridSize}, 1fr)`;

  const online  = callers.filter(c => c.status === 'online').length;
  const calling = callers.filter(c => c.status === 'calling').length;
  const offline = callers.filter(c => c.status === 'offline').length;
  const onbreak = callers.filter(c => c.status === 'break').length;

  return (
    <div style={styles.page}>
      {expandedCallerId ? (
        <div>
          {/* Expanded detailed view header */}
          <div style={{ ...styles.header, alignItems: 'center', marginBottom: '2rem' }}>
            <div>
              <h1 style={styles.title}>
                <Monitor size={26} style={{ marginRight: 10, color: '#6366f1' }} />
                Telecaller Session Detail
              </h1>
              <p style={styles.subtitle}>Viewing real-time metrics for {callers.find(c => c.id === expandedCallerId)?.name}</p>
            </div>
            
            <button
              onClick={() => setExpandedCallerId(null)}
              className="btn btn-secondary"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '10px 18px',
                borderRadius: '10px',
                cursor: 'pointer',
                fontWeight: '600',
                backgroundColor: 'rgba(239, 68, 68, 0.1)',
                color: '#ef4444',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                boxShadow: '0 4px 12px rgba(239, 68, 68, 0.1)',
                transition: 'all 0.2s',
              }}
            >
              <X size={16} />
              Return to Grid
            </button>
          </div>

          {/* Maximized Caller Card */}
          <div style={{ maxWidth: '700px', margin: '0 auto', animation: 'fadeIn 0.3s ease' }}>
            {callers.find(c => c.id === expandedCallerId) ? (
              <CallerCard 
                caller={callers.find(c => c.id === expandedCallerId)} 
                gridSize={1} 
                isExpanded={true} 
              />
            ) : (
              <div style={{ color: 'var(--text-secondary)', textAlign: 'center' }}>
                Telecaller session not found.
              </div>
            )}
          </div>
        </div>
      ) : (
        <>
          {/* ── Page header ── */}
          <div style={styles.header}>
            <div>
              <h1 style={styles.title}>
                <Monitor size={26} style={{ marginRight: 10, color: '#6366f1' }} />
                Live Monitor Grid
              </h1>
              <p style={styles.subtitle}>Real-time overview of all telecaller activity</p>
            </div>

            {/* Summary pills */}
            <div style={styles.pillRow}>
              <Pill color="#10b981" label="Online"   count={online} />
              <Pill color="#6366f1" label="Calling"  count={calling} />
              <Pill color="#f59e0b" label="Break"    count={onbreak} />
              <Pill color="#6b7280" label="Offline"  count={offline} />
            </div>
          </div>

          {/* ── Toolbar ── */}
          <div style={styles.toolbar}>
            {/* Grid selector */}
            <div style={styles.gridSelector}>
              {GRID_OPTIONS.map(opt => {
                const Icon = opt.icon;
                const active = gridSize === opt.value;
                return (
                  <button
                    key={opt.value}
                    onClick={() => setGridSize(opt.value)}
                    title={`${opt.label} Grid`}
                    style={{
                      ...styles.gridBtn,
                      ...(active ? styles.gridBtnActive : {}),
                    }}
                  >
                    <Icon size={18} />
                    <span style={{ marginLeft: 6, fontSize: '0.85rem', fontWeight: 600 }}>{opt.label}</span>
                  </button>
                );
              })}
            </div>

            <div style={styles.toolbarRight}>
              {/* Auto-refresh toggle */}
              <button
                onClick={() => setAutoRefresh(p => !p)}
                style={{ ...styles.toolBtn, ...(autoRefresh ? styles.toolBtnActive : {}) }}
                title="Toggle auto-refresh every 8 seconds"
              >
                {autoRefresh ? <Wifi size={16} /> : <WifiOff size={16} />}
                <span style={{ marginLeft: 6, fontSize: '0.8rem' }}>
                  {autoRefresh ? 'Live' : 'Paused'}
                </span>
              </button>

              {/* Manual refresh */}
              <button
                onClick={fetchCallers}
                style={styles.toolBtn}
                title="Refresh now"
              >
                <RefreshCw size={16} />
              </button>

              {/* Last refreshed */}
              {lastRefresh && (
                <span style={styles.refreshTime}>
                  Updated {lastRefresh.toLocaleTimeString()}
                </span>
              )}
            </div>
          </div>

          {/* ── Grid ── */}
          {loading ? (
            <div style={styles.loadingBox}>
              <div style={styles.spinner} />
              <span style={{ color: 'var(--text-secondary)', marginLeft: 14 }}>Loading telecaller data…</span>
            </div>
          ) : callers.length === 0 ? (
            <div style={styles.emptyBox}>
              <BarChart2 size={48} color="#374151" style={{ marginBottom: 12 }} />
              <div style={{ color: 'var(--text-secondary)' }}>No telecallers found. Register one first.</div>
            </div>
          ) : (
            <>
              <div style={{ ...styles.grid, gridTemplateColumns: colsStyle }}>
                {visible.map(caller => (
                  <CallerCard 
                    key={caller.id} 
                    caller={caller} 
                    gridSize={gridSize} 
                    onClick={() => setExpandedCallerId(caller.id)}
                  />
                ))}
                {/* Ghost cells to fill remaining grid slots */}
                {Array.from({ length: perPage - visible.length }).map((_, i) => (
                  <div key={`ghost-${i}`} style={styles.ghostCell}>
                    <Monitor size={28} color="#2d3748" />
                    <span style={{ color: '#374151', fontSize: '0.75rem', marginTop: 8 }}>Empty slot</span>
                  </div>
                ))}
              </div>

              {callers.length > perPage && (
                <div style={styles.overflowNote}>
                  Showing {perPage} of {callers.length} telecallers — increase grid size to see more
                </div>
              )}
            </>
          )}
        </>
      )}

      <style>{`
        @keyframes pulse-calling {
          0%,100% { box-shadow: 0 0 18px rgba(99,102,241,0.4), 0 2px 8px rgba(0,0,0,0.3); }
          50%      { box-shadow: 0 0 32px rgba(99,102,241,0.7), 0 2px 8px rgba(0,0,0,0.3); }
        }
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .zoom-on-hover {
          transition: all 0.2s ease-in-out;
        }
        .zoom-on-hover:hover {
          transform: translateY(-4px) scale(1.02);
          border-color: var(--color-primary) !important;
          box-shadow: 0 10px 25px rgba(0, 0, 0, 0.4), 0 0 20px rgba(99, 102, 241, 0.3) !important;
        }
      `}</style>
    </div>
  );
};

const Pill = ({ color, label, count }) => (
  <div style={{ ...styles.pill, borderColor: `${color}44`, background: `${color}11` }}>
    <span style={{ ...styles.pillDot, background: color, boxShadow: `0 0 6px ${color}` }} />
    <span style={{ color, fontWeight: 700, fontSize: '0.9rem' }}>{count}</span>
    <span style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', marginLeft: 4 }}>{label}</span>
  </div>
);

const styles = {
  page: { paddingBottom: '2rem' },

  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    flexWrap: 'wrap',
    gap: '1rem',
    marginBottom: '1.5rem',
  },
  title: {
    fontSize: '1.6rem',
    fontWeight: 800,
    color: 'var(--text-primary)',
    display: 'flex',
    alignItems: 'center',
    margin: 0,
  },
  subtitle: { color: 'var(--text-secondary)', fontSize: '0.9rem', marginTop: 4 },

  pillRow:  { display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' },
  pill: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    padding: '6px 14px',
    borderRadius: 999,
    border: '1px solid',
    backdropFilter: 'blur(6px)',
  },
  pillDot: { width: 8, height: 8, borderRadius: '50%' },

  toolbar: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: '1rem',
    marginBottom: '1.5rem',
    background: 'var(--bg-secondary)',
    border: '1px solid var(--border-color)',
    borderRadius: 14,
    padding: '10px 16px',
  },
  gridSelector: { display: 'flex', gap: 8 },
  gridBtn: {
    display: 'flex',
    alignItems: 'center',
    padding: '8px 16px',
    borderRadius: 10,
    border: '1px solid var(--border-color)',
    background: 'var(--bg-primary)',
    color: 'var(--text-secondary)',
    cursor: 'pointer',
    transition: 'all 0.2s',
  },
  gridBtnActive: {
    background: 'var(--color-primary)',
    color: '#fff',
    border: '1px solid var(--color-primary)',
    boxShadow: '0 4px 12px var(--color-primary-glow)',
  },
  toolbarRight: { display: 'flex', alignItems: 'center', gap: 10 },
  toolBtn: {
    display: 'flex',
    alignItems: 'center',
    padding: '8px 14px',
    borderRadius: 10,
    border: '1px solid var(--border-color)',
    background: 'var(--bg-primary)',
    color: 'var(--text-secondary)',
    cursor: 'pointer',
    fontSize: '0.85rem',
    transition: 'all 0.2s',
  },
  toolBtnActive: {
    background: 'rgba(16,185,129,0.12)',
    color: '#10b981',
    border: '1px solid rgba(16,185,129,0.4)',
  },
  refreshTime: { fontSize: '0.75rem', color: 'var(--text-muted)' },

  grid: {
    display: 'grid',
    gap: 16,
  },

  // Card styles
  card: {
    background: 'var(--bg-secondary)',
    borderRadius: 16,
    padding: '1.1rem',
    transition: 'transform 0.2s',
    cursor: 'default',
  },
  cardHeader: { display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 },
  avatar: {
    width: 42,
    height: 42,
    borderRadius: 12,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#fff',
    fontWeight: 800,
    fontSize: '0.95rem',
    flexShrink: 0,
  },
  callerInfo: { flex: 1, minWidth: 0 },
  callerName: {
    fontWeight: 700,
    fontSize: '0.9rem',
    color: 'var(--text-primary)',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  callerPhone: {
    fontSize: '0.72rem',
    color: 'var(--text-muted)',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  statusBadge: {
    display: 'flex',
    alignItems: 'center',
    gap: 5,
    padding: '4px 10px',
    borderRadius: 999,
    fontSize: '0.72rem',
    fontWeight: 700,
    whiteSpace: 'nowrap',
    flexShrink: 0,
  },
  statusDot: { width: 7, height: 7, borderRadius: '50%' },

  statsGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: 8,
    marginBottom: 12,
  },
  statBox: {
    background: 'var(--bg-primary)',
    borderRadius: 10,
    padding: '8px 10px',
    display: 'flex',
    flexDirection: 'column',
    gap: 2,
    border: '1px solid var(--border-color)',
  },
  statIcon: { marginBottom: 2 },
  statValue: { fontWeight: 700, fontSize: '0.9rem' },
  statLabel: { fontSize: '0.68rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.4px' },


  barTrack: {
    height: 5,
    background: 'var(--bg-primary)',
    borderRadius: 999,
    overflow: 'hidden',
    marginTop: 6,
  },
  barFill: { height: '100%', borderRadius: 999, transition: 'width 0.5s ease' },
  barLabel: { fontSize: '0.68rem', color: 'var(--text-muted)' },

  ghostCell: {
    border: '2px dashed #2d3748',
    borderRadius: 16,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 160,
    opacity: 0.5,
  },

  loadingBox: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '4rem',
  },
  spinner: {
    width: 32,
    height: 32,
    border: '3px solid var(--border-color)',
    borderTopColor: '#6366f1',
    borderRadius: '50%',
    animation: 'spin 0.8s linear infinite',
  },
  emptyBox: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '5rem',
    border: '2px dashed var(--border-color)',
    borderRadius: 16,
  },
  overflowNote: {
    marginTop: 12,
    textAlign: 'center',
    fontSize: '0.8rem',
    color: 'var(--text-muted)',
    padding: '10px',
    background: 'var(--bg-secondary)',
    borderRadius: 10,
    border: '1px solid var(--border-color)',
  },
};

export default MonitorGrid;
