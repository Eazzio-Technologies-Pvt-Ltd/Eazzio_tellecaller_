import React, { useEffect, useState } from 'react';
import { Mail, Key, User, Search, Copy, Check, ShieldAlert, Phone } from 'lucide-react';

const TelecallerAccounts = () => {
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [copiedId, setCopiedId] = useState('');
  const [copiedType, setCopiedType] = useState(''); // 'email' or 'password'

  const parseDbDate = (dateString) => {
    if (!dateString) return null;
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

  const fetchAccounts = async () => {
    try {
      const response = await fetch('/api/auth/telecallers', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      if (response.ok) {
        const data = await response.json();
        setAccounts(data);
      }
    } catch (err) {
      console.error('Error fetching accounts:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAccounts();
  }, []);

  const handleCopy = (text, id, type) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setCopiedType(type);
    setTimeout(() => {
      setCopiedId('');
      setCopiedType('');
    }, 2000);
  };

  const filteredAccounts = accounts.filter(acc => 
    acc.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    acc.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div>
      <div style={styles.header}>
        <div>
          <h1>Telecaller Accounts & Credentials</h1>
          <p className="subtitle">View registered mobile numbers and credentials for telecallers.</p>
        </div>
      </div>

      {/* Search Filter Row */}
      <div style={styles.filterRow}>
        <div style={{ display: 'flex', alignItems: 'center', flex: 1, position: 'relative' }}>
          <Search size={18} style={styles.searchIcon} />
          <input 
            type="text" 
            placeholder="Search accounts by name or mobile number..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={styles.searchInput}
          />
        </div>
      </div>

      {/* Accounts List */}
      <div className="glass-card">
        {loading ? (
          <div style={{ color: 'var(--text-primary)', textAlign: 'center', padding: '2rem' }}>Loading credentials...</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table>
              <thead>
                <tr>
                  <th>Telecaller Name</th>
                  <th>Registered Mobile Number</th>
                  <th>Access Mode</th>
                  <th>Active Status</th>
                  <th>Account Created</th>
                </tr>
              </thead>
              <tbody>
                {filteredAccounts.length === 0 ? (
                  <tr>
                    <td colSpan="5" style={{ textAlign: 'center', color: '#6b7280' }}>
                      No telecaller accounts found.
                    </td>
                  </tr>
                ) : (
                  filteredAccounts.map((account) => (
                    <tr key={account.id}>
                      <td style={{ fontWeight: '600' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <User size={16} color="var(--color-primary)" />
                          {account.name}
                        </div>
                      </td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <span style={{ color: 'var(--text-primary)' }}>{account.email}</span>
                          <button 
                            onClick={() => handleCopy(account.email, account.id, 'email')}
                            style={styles.copyBtn}
                            title="Copy Mobile Number"
                          >
                            {copiedId === account.id && copiedType === 'email' ? (
                              <Check size={13} color="var(--color-success)" />
                            ) : (
                              <Copy size={13} color="var(--text-muted)" />
                            )}
                          </button>
                        </div>
                      </td>
                      <td>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '4px 8px', borderRadius: '6px', fontSize: '0.85rem', backgroundColor: 'rgba(99, 102, 241, 0.15)', color: '#818cf8', fontWeight: '600' }}>
                          Passwordless (SIM Number)
                        </span>
                      </td>
                      <td>
                        <span className={`badge badge-${account.status}`}>
                          <span className={`dot dot-${account.status}`}></span>
                          {account.status}
                        </span>
                      </td>
                      <td style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                        {account.created_at ? parseDbDate(account.created_at).toLocaleDateString() : '-'}
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
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '1rem',
  },
  filterRow: {
    display: 'flex',
    marginBottom: '1.5rem',
    background: 'var(--bg-secondary)',
    border: '1px solid var(--border-color)',
    borderRadius: '12px',
    padding: '0.75rem 1rem',
  },
  searchIcon: {
    position: 'absolute',
    left: '12px',
    color: 'var(--text-muted)',
  },
  searchInput: {
    width: '100%',
    height: '42px',
    paddingLeft: '2.5rem',
  },
  passwordCode: {
    backgroundColor: 'var(--bg-primary)',
    padding: '4px 8px',
    borderRadius: '6px',
    fontFamily: 'monospace',
    fontSize: '0.9rem',
    color: 'var(--color-secondary)',
    border: '1px solid var(--border-color)',
  },
  copyBtn: {
    background: 'transparent',
    border: 'none',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '6px',
    borderRadius: '6px',
    transition: 'background-color 0.2s',
    ':hover': {
      backgroundColor: 'rgba(255, 255, 255, 0.05)',
    }
  }
};

export default TelecallerAccounts;
