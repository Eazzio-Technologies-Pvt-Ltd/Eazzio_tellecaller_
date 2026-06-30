import React, { useEffect, useState, useRef } from 'react';
import API_BASE_URL from '../config/api';
import {
  LayoutGrid, Grid2X2, Grid3X3, Monitor,
  Phone, Clock, Coffee, Wifi, WifiOff,
  PhoneCall, Maximize2, RefreshCw, BarChart2,
  Activity, X, Minimize2, ChevronLeft, ChevronRight
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
          icon={<Coffee size={statIconSize} color="#8b5cf6" />} 
          label="Break"     
          value={formatDur(caller.break_time)}   
          color="#8b5cf6" 
          padding={statBoxPadding}
          valueSize={statValueSize}
          labelSize={statLabelSize}
          style={{ gridColumn: 'span 2' }}
        />
      </div>

      {/* Daily Call Stats Section */}
      <div style={{
        marginTop: gridSize <= 2 ? '10px' : '6px',
        paddingTop: gridSize <= 2 ? '10px' : '6px',
        borderTop: '1px dashed rgba(255,255,255,0.15)',
        display: 'grid',
        gridTemplateColumns: 'repeat(4, 1fr)',
        gap: gridSize <= 2 ? '6px' : '4px',
        textAlign: 'center'
      }}>
        <div style={{ backgroundColor: 'rgba(16, 185, 129, 0.08)', padding: gridSize <= 2 ? '4px 2px' : '2px', borderRadius: '6px', border: '1px solid rgba(16, 185, 129, 0.2)' }}>
          <div style={{ fontSize: gridSize <= 2 ? '0.8rem' : '0.65rem', fontWeight: '800', color: '#10b981' }}>{caller.connected_count || 0}</div>
          <div style={{ fontSize: '0.55rem', color: 'var(--text-secondary)', textTransform: 'uppercase', fontWeight: '600', letterSpacing: '0.2px' }}>Conn</div>
        </div>
        <div style={{ backgroundColor: 'rgba(239, 68, 68, 0.08)', padding: gridSize <= 2 ? '4px 2px' : '2px', borderRadius: '6px', border: '1px solid rgba(239, 68, 68, 0.2)' }}>
          <div style={{ fontSize: gridSize <= 2 ? '0.8rem' : '0.65rem', fontWeight: '800', color: '#ef4444' }}>{caller.non_connected_count || 0}</div>
          <div style={{ fontSize: '0.55rem', color: 'var(--text-secondary)', textTransform: 'uppercase', fontWeight: '600', letterSpacing: '0.2px' }}>Non-C</div>
        </div>
        <div style={{ backgroundColor: 'rgba(99, 102, 241, 0.08)', padding: gridSize <= 2 ? '4px 2px' : '2px', borderRadius: '6px', border: '1px solid rgba(99, 102, 241, 0.2)' }}>
          <div style={{ fontSize: gridSize <= 2 ? '0.8rem' : '0.65rem', fontWeight: '800', color: '#6366f1' }}>{caller.received_count || 0}</div>
          <div style={{ fontSize: '0.55rem', color: 'var(--text-secondary)', textTransform: 'uppercase', fontWeight: '600', letterSpacing: '0.2px' }}>Recv</div>
        </div>
        <div style={{ backgroundColor: 'rgba(245, 158, 11, 0.08)', padding: gridSize <= 2 ? '4px 2px' : '2px', borderRadius: '6px', border: '1px solid rgba(245, 158, 11, 0.2)' }}>
          <div style={{ fontSize: gridSize <= 2 ? '0.8rem' : '0.65rem', fontWeight: '800', color: '#f59e0b' }}>{caller.missed_count || 0}</div>
          <div style={{ fontSize: '0.55rem', color: 'var(--text-secondary)', textTransform: 'uppercase', fontWeight: '600', letterSpacing: '0.2px' }}>Miss</div>
        </div>
      </div>

      {/* Activity bar */}
      <div style={{ ...styles.barTrack, height: barHeight, marginTop: gridSize <= 2 ? 8 : 6 }}>
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

const StatBox = ({ icon, label, value, color, padding, valueSize, labelSize, style }) => (
  <div style={{ ...styles.statBox, padding, ...style }}>
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
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const intervalRef = useRef(null);
  const containerRef = useRef(null);

  // Clamp/reset page if it goes out of bounds when grid size or callers change
  useEffect(() => {
    const perPage = gridSize * gridSize;
    const totalPages = Math.ceil(callers.length / perPage) || 1;
    if (currentPage > totalPages) {
      setCurrentPage(1);
    }
  }, [callers, gridSize, currentPage]);

  const fetchCallers = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/call-logs/analytics`, {
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

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(document.fullscreenElement === containerRef.current);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen().catch(err => {
        console.error('Error enabling fullscreen:', err);
      });
    } else {
      document.exitFullscreen();
    }
  };

  const perPage   = gridSize * gridSize;
  const totalPages = Math.ceil(callers.length / perPage) || 1;
  const startIndex = (currentPage - 1) * perPage;
  const visible   = callers.slice(startIndex, startIndex + perPage);
  const colsStyle = `repeat(${gridSize}, 1fr)`;

  const online  = callers.filter(c => c.status === 'online').length;
  const calling = callers.filter(c => c.status === 'calling').length;
  const offline = callers.filter(c => c.status === 'offline').length;
  const onbreak = callers.filter(c => c.status === 'break').length;

  return (
    <div ref={containerRef} style={{ ...styles.page, position: isFullscreen ? 'relative' : 'static' }} className="monitor-grid-fullscreen-container">
      {isFullscreen && (
        <button
          onClick={toggleFullscreen}
          style={{
            position: 'fixed',
            top: '1rem',
            right: '1rem',
            zIndex: 99999,
            backgroundColor: 'rgba(239, 68, 68, 0.9)',
            color: '#fff',
            border: 'none',
            padding: '8px 16px',
            borderRadius: '8px',
            fontWeight: '700',
            cursor: 'pointer',
            boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
            display: 'flex',
            alignItems: 'center',
            gap: '6px'
          }}
        >
          <Minimize2 size={16} />
          Exit Fullscreen
        </button>
      )}

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
                ...(isFullscreen ? { marginRight: '145px' } : {})
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
          {!isFullscreen && (
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
          )}

          {/* ── Toolbar ── */}
          {!isFullscreen && (
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

              {/* Fullscreen Mode */}
              <button
                onClick={toggleFullscreen}
                style={styles.toolBtn}
                title="Toggle fullscreen mode"
              >
                <Maximize2 size={16} />
                <span style={{ marginLeft: 6, fontSize: '0.8rem' }}>
                  {isFullscreen ? 'Exit Full' : 'Fullscreen'}
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
          )}

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
              <div className="monitor-grid-container" style={{ ...styles.grid, gridTemplateColumns: colsStyle }}>
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

              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, marginTop: 20 }}>
                {totalPages > 1 && (
                  <div style={styles.paginationContainer}>
                    <button
                      onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                      disabled={currentPage === 1}
                      style={{
                        ...styles.pageBtn,
                        ...(currentPage === 1 ? styles.pageBtnDisabled : {}),
                      }}
                    >
                      <ChevronLeft size={16} />
                      Prev
                    </button>

                    <span style={styles.pageInfo}>
                      Page {currentPage} of {totalPages}
                    </span>

                    <button
                      onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                      disabled={currentPage === totalPages}
                      style={{
                        ...styles.pageBtn,
                        ...(currentPage === totalPages ? styles.pageBtnDisabled : {}),
                      }}
                    >
                      Next
                      <ChevronRight size={16} />
                    </button>
                  </div>
                )}
                
                {callers.length > perPage && (
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                    Showing {visible.length} of {callers.length} telecallers — increase grid size to see more on one page
                  </div>
                )}
              </div>
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
        .monitor-grid-fullscreen-container:fullscreen {
          background-color: var(--bg-primary, #090d16) !important;
          padding: 2rem !important;
          overflow-y: auto !important;
          box-sizing: border-box !important;
          width: 100vw !important;
          height: 100vh !important;
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
  paginationContainer: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    gap: '1rem',
    marginTop: '1rem',
    padding: '10px 16px',
    background: 'var(--bg-secondary)',
    border: '1px solid var(--border-color)',
    borderRadius: 14,
  },
  pageInfo: {
    fontSize: '0.9rem',
    fontWeight: '600',
    color: 'var(--text-secondary)',
  },
  pageBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    padding: '8px 16px',
    borderRadius: 10,
    border: '1px solid var(--border-color)',
    background: 'var(--bg-primary)',
    color: 'var(--text-primary)',
    cursor: 'pointer',
    fontSize: '0.85rem',
    fontWeight: '600',
    transition: 'all 0.2s',
  },
  pageBtnDisabled: {
    opacity: 0.4,
    cursor: 'not-allowed',
  },
};

export default MonitorGrid;
