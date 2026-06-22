import React, { useEffect, useState } from 'react';
import { UserPlus, Mail, Shield, User, Lock, Trash2, Phone } from 'lucide-react';

const Telecallers = () => {
  const [callers, setCallers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  
  // Form State
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [formError, setFormError] = useState('');
  const [formSuccess, setFormSuccess] = useState('');

  const fetchTelecallers = async () => {
    try {
      const response = await fetch('/api/call-logs/analytics', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      if (response.ok) {
        const data = await response.json();
        setCallers(data.callers || []);
      }
    } catch (err) {
      console.error('Error fetching callers:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTelecallers();
  }, []);

  const handleAddCaller = async (e) => {
    e.preventDefault();
    setFormError('');
    setFormSuccess('');

    if (!name || !email) {
      setFormError('Please fill in all fields.');
      return;
    }

    try {
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name,
          email,
          role: 'telecaller'
        })
      });

      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to add telecaller.');
      }

      setFormSuccess('Telecaller registered successfully!');
      setName('');
      setEmail('');
      setPassword('');
      fetchTelecallers();
      setTimeout(() => {
        setIsModalOpen(false);
        setFormSuccess('');
      }, 1500);

    } catch (err) {
      setFormError(err.message);
    }
  };

  const handleDeleteCaller = async (id, callerName) => {
    const confirmed = window.confirm(`Are you sure you want to delete telecaller "${callerName}"?\nTheir allotted contacts will be unassigned and returned to the pool.`);
    if (!confirmed) return;

    try {
      const response = await fetch(`/api/auth/${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to delete telecaller.');
      }

      alert('Telecaller deleted successfully.');
      fetchTelecallers();
    } catch (err) {
      alert(`Error: ${err.message}`);
    }
  };

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

  return (
    <div>
      <div style={styles.header}>
        <div>
          <h1>Telecallers Directory</h1>
          <p className="subtitle">Register and audit telecaller working sessions and productivity rates.</p>
        </div>
        <button className="btn btn-primary" onClick={() => setIsModalOpen(true)}>
          <UserPlus size={18} />
          Register Telecaller
        </button>
      </div>

      <div className="glass-card">
        {loading ? (
          <div style={{ color: 'var(--text-primary)', textAlign: 'center', padding: '2rem' }}>Loading directory...</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Mobile Number</th>
                  <th>Current Status</th>
                  <th>Today's Talk Time</th>
                  <th>Active Work Time</th>
                  <th>Total Idle Time</th>
                  <th>Break Taken</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {callers.length === 0 ? (
                  <tr>
                    <td colSpan="8" style={{ textAlign: 'center', color: '#6b7280' }}>
                      No telecallers registered yet. Click the register button to add one.
                    </td>
                  </tr>
                ) : (
                  callers.map((caller) => (
                    <tr key={caller.id}>
                      <td style={{ fontWeight: '600' }}>{caller.name}</td>
                      <td style={{ color: 'var(--text-secondary)' }}>{caller.email || 'N/A'}</td>
                      <td>
                        <span className={`badge badge-${caller.status}`}>
                          <span className={`dot dot-${caller.status}`}></span>
                          {caller.status}
                        </span>
                      </td>
                      <td style={{ fontWeight: '600', color: 'var(--color-secondary)' }}>
                        {formatDuration(caller.calling_time)}
                      </td>
                      <td>{formatDuration(caller.working_time)}</td>
                      <td style={{ color: 'var(--color-warning)' }}>{formatDuration(caller.idle_time)}</td>
                      <td style={{ color: 'var(--text-secondary)' }}>{formatDuration(caller.break_time)}</td>
                      <td>
                        <button 
                          className="btn btn-secondary" 
                          style={styles.deleteButton}
                          title="Delete Telecaller"
                          onClick={() => handleDeleteCaller(caller.id, caller.name)}
                        >
                          <Trash2 size={16} color="#ef4444" />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal - Register Telecaller */}
      {isModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h2 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <UserPlus size={20} color="#6366f1" />
              Register New Telecaller
            </h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '1.5rem' }}>
              This will create a telecaller account that can log into the mobile app.
            </p>

            <form onSubmit={handleAddCaller}>
              {formError && (
                <div style={styles.errorBanner}>{formError}</div>
              )}
              {formSuccess && (
                <div style={styles.successBanner}>{formSuccess}</div>
              )}

              <div className="form-group">
                <label>Full Name</label>
                <div style={styles.inputWrapper}>
                  <User size={16} style={styles.inputIcon} />
                  <input 
                    type="text" 
                    placeholder="John Doe" 
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    style={styles.inputWithIcon}
                  />
                </div>
              </div>

              <div className="form-group">
                <label>Mobile Number</label>
                <div style={styles.inputWrapper}>
                  <Phone size={16} style={styles.inputIcon} />
                  <input 
                    type="text" 
                    placeholder="e.g. 9876543210" 
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    style={styles.inputWithIcon}
                  />
                </div>
              </div>

              <div className="modal-actions">
                <button type="button" className="btn btn-secondary" onClick={() => setIsModalOpen(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Create Account
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
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '1rem',
  },
  inputWrapper: {
    position: 'relative',
    display: 'flex',
    alignItems: 'center',
  },
  inputIcon: {
    position: 'absolute',
    left: '12px',
    color: '#6b7280',
  },
  inputWithIcon: {
    paddingLeft: '2.5rem',
    width: '100%',
  },
  errorBanner: {
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    color: '#ef4444',
    padding: '0.75rem',
    borderRadius: '8px',
    marginBottom: '1rem',
    fontSize: '0.85rem',
    border: '1px solid rgba(239, 68, 68, 0.3)',
  },
  successBanner: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    color: '#10b981',
    padding: '0.75rem',
    borderRadius: '8px',
    marginBottom: '1rem',
    fontSize: '0.85rem',
    border: '1px solid rgba(16, 185, 129, 0.3)',
  },
  deleteButton: {
    width: '32px',
    height: '32px',
    padding: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'rgba(239, 68, 68, 0.05)',
    border: '1px solid rgba(239, 68, 68, 0.1)',
  }
};

export default Telecallers;
