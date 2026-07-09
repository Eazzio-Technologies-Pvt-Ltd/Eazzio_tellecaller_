import React, { useEffect, useState } from 'react';
import API_BASE_URL from '../config/api';
import { Shuffle, User, AlertCircle, Search, RefreshCw, Calendar, Clock, CheckSquare, Square } from 'lucide-react';

const FollowUpTransfers = () => {
  const [contacts, setContacts] = useState([]);
  const [telecallers, setTelecallers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedContacts, setSelectedContacts] = useState([]);
  const [bulkTelecallerId, setBulkTelecallerId] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [filterTelecallerId, setFilterTelecallerId] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [message, setMessage] = useState(null);

  const fetchOverdueContacts = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/contacts/overdue-follow-ups`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      if (response.ok) {
        const data = await response.json();
        setContacts(data);
      } else {
        showFeedback('error', 'Failed to retrieve overdue follow-up contacts.');
      }
    } catch (err) {
      console.error('Error fetching overdue contacts:', err);
      showFeedback('error', 'Network error fetching overdue contacts.');
    } finally {
      setLoading(false);
    }
  };

  const fetchTelecallers = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/auth/telecallers`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      if (response.ok) {
        const data = await response.json();
        setTelecallers(data);
      }
    } catch (err) {
      console.error('Error fetching telecallers:', err);
    }
  };

  useEffect(() => {
    fetchOverdueContacts();
    fetchTelecallers();
  }, []);

  const showFeedback = (type, text) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 4000);
  };

  const calculateDaysInFollowUp = (startDateString) => {
    if (!startDateString) return 0;
    const start = new Date(startDateString);
    const now = new Date();
    const diffTime = Math.abs(now - start);
    return Math.floor(diffTime / (1000 * 60 * 60 * 24));
  };

  const formatStartedDate = (dateString) => {
    if (!dateString) return '-';
    // Handle database timestamps safely
    let dateVal;
    if (typeof dateString === 'string') {
      if (!dateString.endsWith('Z') && !dateString.includes('+') && !dateString.includes('GMT')) {
        dateVal = new Date(dateString.replace(' ', 'T') + 'Z');
      } else {
        dateVal = new Date(dateString);
      }
    } else {
      dateVal = new Date(dateString);
    }
    return isNaN(dateVal.getTime()) ? '-' : dateVal.toLocaleDateString();
  };

  // Toggle selection for bulk actions
  const handleToggleSelect = (contactId) => {
    if (selectedContacts.includes(contactId)) {
      setSelectedContacts(selectedContacts.filter(id => id !== contactId));
    } else {
      setSelectedContacts([...selectedContacts, contactId]);
    }
  };

  const handleSelectAll = () => {
    const filtered = getFilteredContacts();
    if (selectedContacts.length === filtered.length) {
      setSelectedContacts([]);
    } else {
      setSelectedContacts(filtered.map(c => c.id));
    }
  };

  // Inline single transfer
  const handleSingleTransfer = async (contactId, telecallerId) => {
    if (!telecallerId) return;
    setActionLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/contacts/${contactId}/assign`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ telecallerId: parseInt(telecallerId) })
      });

      if (response.ok) {
        showFeedback('success', 'Lead transferred successfully.');
        setSelectedContacts(selectedContacts.filter(id => id !== contactId));
        fetchOverdueContacts();
      } else {
        const data = await response.json();
        showFeedback('error', data.error || 'Failed to transfer lead.');
      }
    } catch (err) {
      console.error('Single transfer error:', err);
      showFeedback('error', 'Network error transferring lead.');
    } finally {
      setActionLoading(false);
    }
  };

  // Bulk transfer selected leads
  const handleBulkTransfer = async () => {
    if (selectedContacts.length === 0) {
      showFeedback('error', 'Please select at least one lead to transfer.');
      return;
    }
    if (!bulkTelecallerId) {
      showFeedback('error', 'Please select a new telecaller for bulk transfer.');
      return;
    }

    setActionLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/contacts/bulk-transfer`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          contactIds: selectedContacts,
          telecallerId: parseInt(bulkTelecallerId)
        })
      });

      if (response.ok) {
        const data = await response.json();
        showFeedback('success', data.message || 'Leads transferred successfully.');
        setSelectedContacts([]);
        setBulkTelecallerId('');
        fetchOverdueContacts();
      } else {
        const data = await response.json();
        showFeedback('error', data.error || 'Failed to bulk transfer leads.');
      }
    } catch (err) {
      console.error('Bulk transfer error:', err);
      showFeedback('error', 'Network error bulk transferring leads.');
    } finally {
      setActionLoading(false);
    }
  };

  // Filter logic
  const getFilteredContacts = () => {
    return contacts.filter(contact => {
      const matchesSearch = 
        contact.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        contact.phone_number.includes(searchTerm);
      const matchesCaller = 
        !filterTelecallerId || 
        String(contact.assigned_to) === String(filterTelecallerId);
      return matchesSearch && matchesCaller;
    });
  };

  const filteredContacts = getFilteredContacts();

  // Metrics
  const totalOverdue = contacts.length;
  const longestFollowUp = contacts.reduce((max, c) => {
    const days = calculateDaysInFollowUp(c.follow_up_started_at);
    return days > max ? days : max;
  }, 0);

  return (
    <div>
      <div style={styles.header}>
        <div>
          <h1 style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Shuffle size={28} color="#a78bfa" />
            Lead Transfers (Follow-up Overdue)
          </h1>
          <p className="subtitle">
            Leads in follow-up status for over 7 days. Reassign them to start a new follow-up cycle.
          </p>
        </div>
        <button 
          className="btn btn-secondary" 
          onClick={fetchOverdueContacts} 
          disabled={loading}
          style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
        >
          <RefreshCw size={16} className={loading ? 'spin' : ''} />
          Refresh List
        </button>
      </div>

      {message && (
        <div style={message.type === 'success' ? styles.successBanner : styles.errorBanner}>
          <AlertCircle size={16} style={{ marginRight: '8px', flexShrink: 0 }} />
          {message.text}
        </div>
      )}

      {/* Metrics Row */}
      <div style={styles.metricsRow}>
        <div className="glass-card" style={styles.metricCard}>
          <Clock size={24} color="#f59e0b" style={styles.metricIcon} />
          <div>
            <div style={styles.metricLabel}>Total Overdue Leads</div>
            <div style={styles.metricValue}>{totalOverdue}</div>
          </div>
        </div>
        <div className="glass-card" style={styles.metricCard}>
          <Calendar size={24} color="#ef4444" style={styles.metricIcon} />
          <div>
            <div style={styles.metricLabel}>Longest Follow-up</div>
            <div style={styles.metricValue}>
              {longestFollowUp > 0 ? `${longestFollowUp} Days` : 'N/A'}
            </div>
          </div>
        </div>
        <div className="glass-card" style={styles.metricCard}>
          <CheckSquare size={24} color="#10b981" style={styles.metricIcon} />
          <div>
            <div style={styles.metricLabel}>Selected for Transfer</div>
            <div style={styles.metricValue}>{selectedContacts.length}</div>
          </div>
        </div>
      </div>

      {/* Filter and Bulk Action Section */}
      <div style={styles.filterSection}>
        <div style={styles.filterGroup}>
          <div style={{ position: 'relative', flex: 1, minWidth: '240px' }}>
            <Search size={18} style={styles.searchIcon} />
            <input
              type="text"
              placeholder="Search by name or phone number..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={styles.searchInput}
            />
          </div>

          <select
            value={filterTelecallerId}
            onChange={(e) => setFilterTelecallerId(e.target.value)}
            style={styles.selectFilter}
          >
            <option value="">All Current Telecallers</option>
            {telecallers.map(tc => (
              <option key={tc.id} value={tc.id}>{tc.name}</option>
            ))}
          </select>
        </div>

        {selectedContacts.length > 0 && (
          <div style={styles.bulkActionBar}>
            <span style={styles.bulkText}>
              Transfer {selectedContacts.length} selected leads to:
            </span>
            <select
              value={bulkTelecallerId}
              onChange={(e) => setBulkTelecallerId(e.target.value)}
              style={styles.bulkSelect}
            >
              <option value="">Choose New Telecaller...</option>
              <option value="null">Unassigned (Return to general pool)</option>
              {telecallers.map(tc => (
                <option key={tc.id} value={tc.id}>{tc.name}</option>
              ))}
            </select>
            <button
              onClick={handleBulkTransfer}
              className="btn btn-primary"
              disabled={actionLoading || !bulkTelecallerId}
              style={{ padding: '0.65rem 1.25rem', display: 'flex', alignItems: 'center', gap: '8px' }}
            >
              <Shuffle size={16} />
              {actionLoading ? 'Transferring...' : 'Transfer Now'}
            </button>
          </div>
        )}
      </div>

      {/* Main Grid Card */}
      <div className="glass-card">
        {loading ? (
          <div style={styles.centeredMessage}>Loading overdue follow-up list...</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table>
              <thead>
                <tr>
                  <th style={{ width: '40px', textAlign: 'center' }}>
                    <button 
                      onClick={handleSelectAll} 
                      style={styles.checkboxButton}
                      title="Select All"
                    >
                      {selectedContacts.length === filteredContacts.length && filteredContacts.length > 0 ? (
                        <CheckSquare size={18} color="#a78bfa" />
                      ) : (
                        <Square size={18} color="var(--text-muted)" />
                      )}
                    </button>
                  </th>
                  <th>Lead ID</th>
                  <th>Lead Name</th>
                  <th>Phone Number</th>
                  <th>Campaign</th>
                  <th>Current Telecaller</th>
                  <th>Follow-up Started</th>
                  <th>Days in Follow-up</th>
                  <th style={{ textAlign: 'right' }}>Transfer Lead</th>
                </tr>
              </thead>
              <tbody>
                {filteredContacts.length === 0 ? (
                  <tr>
                    <td colSpan="9" style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: '3rem 1rem' }}>
                      No follow-up leads exceed the 1 week threshold.
                    </td>
                  </tr>
                ) : (
                  filteredContacts.map(contact => {
                    const days = calculateDaysInFollowUp(contact.follow_up_started_at);
                    const isSelected = selectedContacts.includes(contact.id);
                    return (
                      <tr key={contact.id} style={isSelected ? styles.selectedRow : {}}>
                        <td style={{ textAlign: 'center' }}>
                          <button 
                            onClick={() => handleToggleSelect(contact.id)} 
                            style={styles.checkboxButton}
                          >
                            {isSelected ? (
                              <CheckSquare size={18} color="#a78bfa" />
                            ) : (
                              <Square size={18} color="var(--text-muted)" />
                            )}
                          </button>
                        </td>
                        <td style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>#{contact.id}</td>
                        <td style={{ fontWeight: '600' }}>{contact.name}</td>
                        <td style={{ letterSpacing: '0.5px' }}>{contact.phone_number}</td>
                        <td>{contact.campaign_name || 'N/A'}</td>
                        <td>
                          <span style={{ fontSize: '0.9rem', color: contact.assigned_to ? 'var(--text-primary)' : 'var(--text-muted)' }}>
                            {contact.assigned_caller || 'Unassigned'}
                          </span>
                        </td>
                        <td style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                          {formatStartedDate(contact.follow_up_started_at)}
                        </td>
                        <td>
                          <span className={`badge ${days >= 10 ? 'badge-missed' : 'badge-follow_up'}`} style={{ fontWeight: '600' }}>
                            {days} Days
                          </span>
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          <div style={styles.inlineSelectWrapper}>
                            <User size={14} style={styles.inlineSelectIcon} />
                            <select
                              defaultValue=""
                              onChange={(e) => handleSingleTransfer(contact.id, e.target.value)}
                              style={styles.inlineSelect}
                              disabled={actionLoading}
                            >
                              <option value="" disabled>Reassign to...</option>
                              <option value="null">Unassigned</option>
                              {telecallers
                                .filter(tc => String(tc.id) !== String(contact.assigned_to))
                                .map(tc => (
                                  <option key={tc.id} value={tc.id}>{tc.name}</option>
                                ))
                              }
                            </select>
                          </div>
                        </td>
                      </tr>
                    );
                  })
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
    marginBottom: '1.5rem',
  },
  successBanner: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    color: '#10b981',
    padding: '0.85rem 1rem',
    borderRadius: '10px',
    marginBottom: '1.5rem',
    fontSize: '0.9rem',
    border: '1px solid rgba(16, 185, 129, 0.3)',
    display: 'flex',
    alignItems: 'center',
  },
  errorBanner: {
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    color: '#ef4444',
    padding: '0.85rem 1rem',
    borderRadius: '10px',
    marginBottom: '1.5rem',
    fontSize: '0.9rem',
    border: '1px solid rgba(239, 68, 68, 0.3)',
    display: 'flex',
    alignItems: 'center',
  },
  metricsRow: {
    display: 'flex',
    gap: '1.5rem',
    marginBottom: '1.5rem',
    flexWrap: 'wrap',
  },
  metricCard: {
    flex: 1,
    minWidth: '220px',
    display: 'flex',
    alignItems: 'center',
    padding: '1.25rem 1.5rem',
    gap: '1rem',
  },
  metricIcon: {
    padding: '10px',
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: '10px',
    border: '1px solid rgba(255, 255, 255, 0.05)',
  },
  metricLabel: {
    color: 'var(--text-secondary)',
    fontSize: '0.82rem',
    fontWeight: '500',
    marginBottom: '2px',
  },
  metricValue: {
    color: 'var(--text-primary)',
    fontSize: '1.5rem',
    fontWeight: '700',
  },
  filterSection: {
    background: 'var(--bg-secondary)',
    border: '1px solid var(--border-color)',
    borderRadius: '12px',
    padding: '1rem',
    marginBottom: '1.5rem',
    display: 'flex',
    flexDirection: 'column',
    gap: '1rem',
  },
  filterGroup: {
    display: 'flex',
    gap: '1rem',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  searchIcon: {
    position: 'absolute',
    left: '12px',
    top: '12px',
    color: 'var(--text-muted)',
    pointerEvents: 'none',
  },
  searchInput: {
    width: '100%',
    height: '42px',
    paddingLeft: '38px',
    background: 'var(--bg-primary)',
    border: '1px solid var(--border-color)',
    borderRadius: '8px',
    color: 'var(--text-primary)',
    fontSize: '0.9rem',
    outline: 'none',
  },
  selectFilter: {
    height: '42px',
    minWidth: '200px',
    padding: '0 12px',
    background: 'var(--bg-primary)',
    border: '1px solid var(--border-color)',
    borderRadius: '8px',
    color: 'var(--text-primary)',
    fontSize: '0.9rem',
    outline: 'none',
    cursor: 'pointer',
  },
  bulkActionBar: {
    display: 'flex',
    gap: '1rem',
    alignItems: 'center',
    paddingTop: '0.75rem',
    borderTop: '1px solid var(--border-color)',
    flexWrap: 'wrap',
  },
  bulkText: {
    color: 'var(--text-primary)',
    fontWeight: '600',
    fontSize: '0.9rem',
  },
  bulkSelect: {
    height: '38px',
    minWidth: '220px',
    padding: '0 10px',
    background: 'var(--bg-primary)',
    border: '1px solid var(--border-color)',
    borderRadius: '6px',
    color: 'var(--text-primary)',
    fontSize: '0.85rem',
    outline: 'none',
    cursor: 'pointer',
  },
  checkboxButton: {
    background: 'transparent',
    border: 'none',
    cursor: 'pointer',
    padding: '4px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  selectedRow: {
    backgroundColor: 'rgba(167, 139, 250, 0.04)',
  },
  inlineSelectWrapper: {
    position: 'relative',
    display: 'inline-flex',
    alignItems: 'center',
    minWidth: '150px',
  },
  inlineSelectIcon: {
    position: 'absolute',
    left: '8px',
    color: '#a78bfa',
    pointerEvents: 'none',
  },
  inlineSelect: {
    padding: '4px 8px 4px 26px',
    fontSize: '0.8rem',
    background: 'var(--bg-primary)',
    border: '1px solid var(--border-color)',
    borderRadius: '6px',
    color: 'var(--text-primary)',
    outline: 'none',
    width: '100%',
    cursor: 'pointer',
  },
  centeredMessage: {
    textAlign: 'center',
    color: 'var(--text-secondary)',
    padding: '3rem 1rem',
  }
};

export default FollowUpTransfers;
