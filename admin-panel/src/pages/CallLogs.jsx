import React, { useEffect, useState } from 'react';
import { Volume2, Play, Search, Calendar, PhoneIncoming } from 'lucide-react';

const CallLogs = () => {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeRecordingUrl, setActiveRecordingUrl] = useState(null);

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

  const fetchLogs = async () => {
    try {
      const response = await fetch('/api/call-logs', {
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
  }, []);

  const formatDuration = (seconds) => {
    if (!seconds) return '0s';
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return m > 0 ? `${m}m ${s}s` : `${s}s`;
  };

  const handlePlayRecording = (recordingUrl) => {
    // If clicking same, toggle play/close
    if (activeRecordingUrl === recordingUrl) {
      setActiveRecordingUrl(null);
    } else {
      setActiveRecordingUrl(recordingUrl);
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
      <h1>Call Records & Logs</h1>
      <p className="subtitle">Audit telecaller communications and play back call recordings.</p>

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
                      <td style={{ fontWeight: '600', color: log.call_status === 'connected' ? 'var(--color-success)' : 'var(--text-muted)' }}>
                        {log.call_status === 'connected' ? formatDuration(log.duration) : '-'}
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
};

export default CallLogs;
