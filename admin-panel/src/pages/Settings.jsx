import React, { useState, useEffect } from 'react';
import API_BASE_URL from '../config/api';
import { Settings as SettingsIcon, Save, RefreshCw, AlertCircle, CheckCircle2, Sliders, Phone, Clock, Shield } from 'lucide-react';

const Settings = ({ user }) => {
  // Company call limits (synced to server)
  const [workTime, setWorkTime] = useState(8);
  const [talkTime, setTalkTime] = useState(4);
  const [proxyTime, setProxyTime] = useState(10);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });

  // Operational settings (stored locally)
  const [dialDelay, setDialDelay] = useState(() => localStorage.getItem('setting_dialDelay') || '25');
  const [maxRetries, setMaxRetries] = useState(() => localStorage.getItem('setting_maxRetries') || '3');
  const [callLimit, setCallLimit] = useState(() => localStorage.getItem('setting_recordingLimit') || '100');
  const [opSaving, setOpSaving] = useState(false);
  const [opMessage, setOpMessage] = useState({ type: '', text: '' });

  const fetchSettings = async () => {
    try {
      setLoading(true);
      const res = await fetch(`${API_BASE_URL}/api/auth/company-settings`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      if (res.ok) {
        const data = await res.json();
        setWorkTime(data.workTimeLimitHours);
        setTalkTime(data.talkTimeLimitHours);
        setProxyTime(data.proxyLimitMinutes);
      }
    } catch (err) {
      console.error('Error fetching settings:', err);
      setMessage({ type: 'error', text: 'Failed to load settings.' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  const handleSave = async (e) => {
    e.preventDefault();
    try {
      setSaving(true);
      setMessage({ type: '', text: '' });
      const res = await fetch(`${API_BASE_URL}/api/auth/company-settings`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          workTimeLimitHours: workTime,
          talkTimeLimitHours: talkTime,
          proxyLimitMinutes: proxyTime
        })
      });
      if (res.ok) {
        setMessage({ type: 'success', text: 'Company call limits synced successfully.' });
      } else {
        const data = await res.json();
        setMessage({ type: 'error', text: data.error || 'Failed to update settings.' });
      }
    } catch (err) {
      console.error('Error saving settings:', err);
      setMessage({ type: 'error', text: 'Server error saving settings.' });
    } finally {
      setSaving(false);
    }
  };

  const handleSaveOperational = (e) => {
    e.preventDefault();
    setOpSaving(true);
    setOpMessage({ type: '', text: '' });
    localStorage.setItem('setting_dialDelay', dialDelay);
    localStorage.setItem('setting_maxRetries', maxRetries);
    localStorage.setItem('setting_recordingLimit', callLimit);
    setTimeout(() => {
      setOpSaving(false);
      setOpMessage({ type: 'success', text: 'Operational settings saved successfully.' });
    }, 400);
  };

  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <div style={styles.headerTitleGroup}>
          <SettingsIcon size={28} color="var(--color-primary, #6366f1)" className="spin-slow" />
          <h2 style={styles.title}>Settings</h2>
        </div>
        <p style={styles.subtitle}>Configure your company's dialer limits and operational preferences.</p>
      </div>

      <div style={styles.grid}>

        {/* ── Company Dialer Settings ── */}
        <section style={styles.section}>
          <div style={styles.sectionHeader}>
            <Clock size={18} color="var(--color-primary, #6366f1)" />
            <h3 style={styles.sectionTitle}>Company Dialer Settings</h3>
          </div>
          <p style={styles.sectionSubtitle}>Synced to telecaller mobile app — changes apply on next login.</p>

          {loading ? (
            <div style={styles.loadingContainer}>
              <RefreshCw size={22} className="spin" color="var(--color-primary, #6366f1)" />
              <span style={{ color: 'var(--text-secondary)' }}>Loading configurations...</span>
            </div>
          ) : (
            <form onSubmit={handleSave} style={styles.card}>
              {message.text && (
                <div style={{
                  ...styles.alert,
                  backgroundColor: message.type === 'success' ? 'rgba(16, 185, 129, 0.12)' : 'rgba(239, 68, 68, 0.12)',
                  borderColor: message.type === 'success' ? '#10b981' : '#ef4444',
                  color: message.type === 'success' ? '#10b981' : '#ef4444'
                }}>
                  {message.type === 'success' ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
                  <span>{message.text}</span>
                </div>
              )}

              <div style={styles.formGroup}>
                <label style={styles.label}>
                  <Shield size={14} color="var(--color-primary)" style={{ marginRight: 6 }} />
                  Working Shift Duration (Hours)
                </label>
                <div style={styles.inputWrapper}>
                  <input type="number" min="1" max="24" value={workTime}
                    onChange={(e) => setWorkTime(e.target.value)} style={styles.input} required />
                  <span style={styles.inputAddon}>Hrs</span>
                </div>
                <small style={styles.helpText}>Default is 8 hours. Telecallers are alerted when their daily session ends.</small>
              </div>

              <div style={styles.formGroup}>
                <label style={styles.label}>
                  <Phone size={14} color="var(--color-primary)" style={{ marginRight: 6 }} />
                  Connected Talk Time Target (Hours)
                </label>
                <div style={styles.inputWrapper}>
                  <input type="number" min="1" max="24" value={talkTime}
                    onChange={(e) => setTalkTime(e.target.value)} style={styles.input} required />
                  <span style={styles.inputAddon}>Hrs</span>
                </div>
                <small style={styles.helpText}>Target daily calling talk time. Default is 4 hours.</small>
              </div>

              <div style={styles.formGroup}>
                <label style={styles.label}>
                  <Clock size={14} color="var(--color-primary)" style={{ marginRight: 6 }} />
                  Proxy Call Time Threshold (Minutes)
                </label>
                <div style={styles.inputWrapper}>
                  <input type="number" min="1" max="60" value={proxyTime}
                    onChange={(e) => setProxyTime(e.target.value)} style={styles.input} required />
                  <span style={styles.inputAddon}>Mins</span>
                </div>
                <small style={styles.helpText}>Calls exceeding this threshold trigger a real-time warning. Default is 10 minutes.</small>
              </div>

              <div style={styles.actions}>
                <button type="submit" disabled={saving} className="btn btn-primary" style={styles.saveButton}>
                  {saving ? <><RefreshCw size={15} className="spin" /> Syncing...</> : <><Save size={15} /> Save Dialer Settings</>}
                </button>
              </div>
            </form>
          )}
        </section>

        {/* ── Operational Settings ── */}
        <section style={styles.section}>
          <div style={styles.sectionHeader}>
            <Sliders size={18} color="#a855f7" />
            <h3 style={styles.sectionTitle}>Operational Settings</h3>
          </div>
          <p style={styles.sectionSubtitle}>Local preferences for call flow control stored in browser storage.</p>

          <form onSubmit={handleSaveOperational} style={styles.card}>
            {opMessage.text && (
              <div style={{
                ...styles.alert,
                backgroundColor: opMessage.type === 'success' ? 'rgba(16, 185, 129, 0.12)' : 'rgba(239, 68, 68, 0.12)',
                borderColor: opMessage.type === 'success' ? '#10b981' : '#ef4444',
                color: opMessage.type === 'success' ? '#10b981' : '#ef4444'
              }}>
                {opMessage.type === 'success' ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
                <span>{opMessage.text}</span>
              </div>
            )}

            <div style={styles.formGroup}>
              <label style={styles.label}>Dialing Interval / Delay (seconds)</label>
              <div style={styles.inputWrapper}>
                <input type="number" min="1" value={dialDelay}
                  onChange={(e) => setDialDelay(e.target.value)} style={styles.input} required />
                <span style={styles.inputAddon}>Sec</span>
              </div>
              <small style={styles.helpText}>Time to wait between auto-dial attempts. Default is 25 seconds.</small>
            </div>

            <div style={styles.formGroup}>
              <label style={styles.label}>Max Retry Attempts</label>
              <div style={styles.inputWrapper}>
                <input type="number" min="1" max="10" value={maxRetries}
                  onChange={(e) => setMaxRetries(e.target.value)} style={styles.input} required />
                <span style={styles.inputAddon}>×</span>
              </div>
              <small style={styles.helpText}>Maximum number of call retries per lead per day. Default is 3.</small>
            </div>

            <div style={styles.formGroup}>
              <label style={styles.label}>Daily Call Limit per Telecaller</label>
              <div style={styles.inputWrapper}>
                <input type="number" min="10" value={callLimit}
                  onChange={(e) => setCallLimit(e.target.value)} style={styles.input} required />
                <span style={styles.inputAddon}>Calls</span>
              </div>
              <small style={styles.helpText}>Maximum calls a telecaller can make in a single day. Default is 100.</small>
            </div>

            <div style={styles.actions}>
              <button type="submit" disabled={opSaving} className="btn btn-primary" style={{ ...styles.saveButton, background: 'linear-gradient(135deg, #7c3aed, #a855f7)' }}>
                {opSaving ? <><RefreshCw size={15} className="spin" /> Saving...</> : <><Save size={15} /> Save Operational</>}
              </button>
            </div>
          </form>
        </section>

      </div>
    </div>
  );
};

const styles = {
  container: {
    padding: '2rem',
    maxWidth: '1100px',
    margin: '0 auto'
  },
  header: {
    marginBottom: '2rem'
  },
  headerTitleGroup: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    marginBottom: '8px'
  },
  title: {
    fontSize: '1.75rem',
    fontWeight: '700',
    color: 'var(--text-primary)',
    margin: 0
  },
  subtitle: {
    fontSize: '0.9rem',
    color: 'var(--text-secondary)',
    margin: 0
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(380px, 1fr))',
    gap: '1.5rem',
    alignItems: 'start'
  },
  section: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.75rem'
  },
  sectionHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px'
  },
  sectionTitle: {
    fontSize: '1.1rem',
    fontWeight: '700',
    color: 'var(--text-primary)',
    margin: 0
  },
  sectionSubtitle: {
    fontSize: '0.82rem',
    color: 'var(--text-muted)',
    margin: '0 0 0.5rem 0'
  },
  loadingContainer: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '12px',
    padding: '3rem',
    background: 'var(--glass-bg)',
    borderRadius: '16px',
    border: '1px solid var(--border-color)'
  },
  card: {
    padding: '1.75rem',
    display: 'flex',
    flexDirection: 'column',
    gap: '1.25rem',
    border: '1px solid var(--border-color)',
    borderRadius: '16px',
    backgroundColor: 'var(--glass-bg)'
  },
  alert: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    padding: '10px 14px',
    borderRadius: '8px',
    border: '1px solid',
    fontSize: '0.86rem',
    fontWeight: '500'
  },
  formGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px'
  },
  label: {
    display: 'flex',
    alignItems: 'center',
    fontSize: '0.875rem',
    fontWeight: '600',
    color: 'var(--text-primary)'
  },
  inputWrapper: {
    display: 'flex',
    alignItems: 'stretch',
    borderRadius: '8px',
    overflow: 'hidden',
    border: '1px solid var(--border-color)',
    backgroundColor: 'rgba(255,255,255,0.03)'
  },
  input: {
    flex: 1,
    padding: '10px 14px',
    fontSize: '0.95rem',
    backgroundColor: 'transparent',
    border: 'none',
    color: 'var(--text-primary)',
    outline: 'none'
  },
  inputAddon: {
    display: 'flex',
    alignItems: 'center',
    padding: '0 14px',
    fontSize: '0.82rem',
    fontWeight: '600',
    color: 'var(--text-secondary)',
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderLeft: '1px solid var(--border-color)'
  },
  helpText: {
    fontSize: '0.78rem',
    color: 'var(--text-muted)'
  },
  actions: {
    display: 'flex',
    justifyContent: 'flex-end',
    marginTop: '0.5rem'
  },
  saveButton: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '10px 22px',
    fontSize: '0.9rem',
    fontWeight: '600',
    borderRadius: '8px',
    cursor: 'pointer'
  }
};

export default Settings;
