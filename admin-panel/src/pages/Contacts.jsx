import React, { useEffect, useState } from 'react';
import API_BASE_URL from '../config/api';
import { Upload, User, UserPlus } from 'lucide-react';

const Contacts = () => {
  const [contacts, setContacts] = useState([]);
  const [campaigns, setCampaigns] = useState([]);
  const [telecallers, setTelecallers] = useState([]);
  const [loading, setLoading] = useState(true);
  
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
  
  // Filter States
  const [selectedCampaignFilter, setSelectedCampaignFilter] = useState('');
  const [selectedStatusFilter, setSelectedStatusFilter] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  // Import Modal States
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [importCampaignId, setImportCampaignId] = useState('');
  const [importAssignTo, setImportAssignTo] = useState('');
  const [csvFile, setCsvFile] = useState(null);
  
  const [formError, setFormError] = useState('');
  const [formSuccess, setFormSuccess] = useState('');
  const [importing, setImporting] = useState(false);

  // Campaign Assignment Modal States
  const [isAssignCampaignModalOpen, setIsAssignCampaignModalOpen] = useState(false);
  const [bulkCampaignId, setBulkCampaignId] = useState('');
  const [bulkTelecallerId, setBulkTelecallerId] = useState('');
  const [bulkAssigning, setBulkAssigning] = useState(false);

  // Lead Process History States
  const [isProcessModalOpen, setIsProcessModalOpen] = useState(false);
  const [selectedContact, setSelectedContact] = useState(null);
  const [processLogs, setProcessLogs] = useState([]);
  const [loadingProcess, setLoadingProcess] = useState(false);
  const [activeRecordingUrl, setActiveRecordingUrl] = useState(null);

  const handleViewProcess = async (contact) => {
    setSelectedContact(contact);
    setIsProcessModalOpen(true);
    setLoadingProcess(true);
    setProcessLogs([]);
    setActiveRecordingUrl(null);
    try {
      const response = await fetch(`${API_BASE_URL}/api/call-logs?contactId=${contact.id}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      if (response.ok) {
        const data = await response.json();
        setProcessLogs(data);
      }
    } catch (err) {
      console.error('Error fetching process logs:', err);
    } finally {
      setLoadingProcess(false);
    }
  };

  const handlePlayRecording = (recordingUrl) => {
    let fullUrl = recordingUrl;
    if (recordingUrl && !recordingUrl.startsWith('http') && !recordingUrl.startsWith('blob')) {
      fullUrl = `${API_BASE_URL}${recordingUrl.startsWith('/') ? '' : '/'}${recordingUrl}`;
    }
    if (activeRecordingUrl === fullUrl) {
      setActiveRecordingUrl(null);
    } else {
      setActiveRecordingUrl(fullUrl);
    }
  };

  const fetchCampaigns = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/campaigns`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      if (response.ok) {
        const data = await response.json();
        setCampaigns(data);
      }
    } catch (err) {
      console.error('Error campaigns:', err);
    }
  };

  const fetchTelecallers = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/call-logs/analytics`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      if (response.ok) {
        const data = await response.json();
        setTelecallers(data.callers || []);
      }
    } catch (err) {
      console.error('Error telecallers:', err);
    }
  };

  const fetchContacts = async () => {
    setLoading(true);
    try {
      const url = `${API_BASE_URL}/api/contacts?campaignId=${selectedCampaignFilter}&status=${selectedStatusFilter}&search=${searchTerm}`;
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      if (response.ok) {
        const data = await response.json();
        setContacts(data);
      }
    } catch (err) {
      console.error('Error contacts:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCampaigns();
    fetchTelecallers();
  }, []);

  useEffect(() => {
    fetchContacts();
  }, [selectedCampaignFilter, selectedStatusFilter, searchTerm]);

  const handleImportContacts = async (e) => {
    e.preventDefault();
    setFormError('');
    setFormSuccess('');

    if (!importCampaignId) {
      setFormError('Please select a campaign.');
      return;
    }
    if (!csvFile) {
      setFormError('Please choose a CSV file.');
      return;
    }

    setImporting(true);
    const formData = new FormData();
    formData.append('campaignId', importCampaignId);
    formData.append('file', csvFile);
    if (importAssignTo) {
      formData.append('assignedToUserId', importAssignTo);
    }

    try {
      const response = await fetch(`${API_BASE_URL}/api/contacts/import`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: formData
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to import contacts.');
      }

      setFormSuccess(data.message || 'Contacts imported successfully!');
      setCsvFile(null);
      setImportAssignTo('');
      fetchContacts();
      setTimeout(() => {
        setIsImportModalOpen(false);
        setFormSuccess('');
      }, 1500);
    } catch (err) {
      setFormError(err.message);
    } finally {
      setImporting(false);
    }
  };

  const handleReassignContact = async (contactId, telecallerId) => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/contacts/${contactId}/assign`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ telecallerId: telecallerId || null })
      });

      if (response.ok) {
        fetchContacts();
      } else {
        alert('Failed to reassign contact.');
      }
    } catch (err) {
      console.error('Error reassigning contact:', err);
    }
  };

  const handleConfirmBulkAssignment = async (e) => {
    e.preventDefault();
    if (!bulkCampaignId) {
      alert('Please select a campaign.');
      return;
    }

    setBulkAssigning(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/contacts/assign-campaign`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          campaignId: bulkCampaignId,
          telecallerId: bulkTelecallerId || null
        })
      });

      if (response.ok) {
        alert('Campaign contacts assigned successfully!');
        setIsAssignCampaignModalOpen(false);
        setBulkCampaignId('');
        setBulkTelecallerId('');
        fetchContacts();
      } else {
        const data = await response.json();
        alert(data.error || 'Failed to assign campaign contacts.');
      }
    } catch (err) {
      console.error(err);
      alert('Network error.');
    } finally {
      setBulkAssigning(false);
    }
  };

  const triggerManualAllotment = async () => {
    if (!selectedCampaignFilter) {
      alert('Please select a campaign filter to allot contacts.');
      return;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/api/contacts/allot`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ campaignId: selectedCampaignFilter })
      });

      if (response.ok) {
        alert('Allotment run finished successfully!');
        fetchContacts();
      } else {
        alert('Failed to trigger allotment.');
      }
    } catch (err) {
      console.error('Allotment run error:', err);
    }
  };

  return (
    <div>
      <div style={styles.header}>
        <div>
          <h1>Leads & Contacts Management</h1>
          <p className="subtitle">Import CSV lists and distribute leads to available telecallers.</p>
        </div>
        <div style={styles.actionButtons}>
          <button className="btn btn-secondary" onClick={() => setIsAssignCampaignModalOpen(true)}>
            <UserPlus size={18} />
            Assign to Telecaller
          </button>
          {selectedCampaignFilter && (
            <button className="btn btn-secondary" onClick={triggerManualAllotment}>
              Trigger Allotment
            </button>
          )}
        </div>
      </div>

      {/* Filtering Row */}
      <div style={styles.filterRow}>
        <div style={styles.filterItem}>
          <label>Campaign</label>
          <select 
            value={selectedCampaignFilter}
            onChange={(e) => setSelectedCampaignFilter(e.target.value)}
            style={styles.selectFilter}
          >
            <option value="">All Campaigns</option>
            {campaigns.map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>

        <div style={styles.filterItem}>
          <label>Status</label>
          <select 
            value={selectedStatusFilter}
            onChange={(e) => setSelectedStatusFilter(e.target.value)}
            style={styles.selectFilter}
          >
            <option value="">All Statuses</option>
            <option value="pending">Pending</option>
            <option value="calling">Calling</option>
            <option value="connected">Connected</option>
            <option value="missed">Missed</option>
            <option value="follow_up">Follow Up</option>
            <option value="completed">Completed</option>
          </select>
        </div>

        <div style={{ ...styles.filterItem, flex: 1 }}>
          <label>Search Leads</label>
          <input 
            type="text" 
            placeholder="Search by name or phone..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{ width: '100%', height: '42px' }}
          />
        </div>
      </div>

      {/* Contacts List Grid */}
      <div className="glass-card">
        {loading ? (
          <div style={{ color: 'var(--text-primary)', textAlign: 'center', padding: '2rem' }}>Loading contacts list...</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table>
              <thead>
                <tr>
                  <th>Lead ID</th>
                  <th>Name</th>
                  <th>Phone Number</th>
                  <th>Campaign</th>
                  <th>Calling Status</th>
                  <th>Assigned Telecaller</th>
                  <th>Last Dialed At</th>
                  <th>Follow Up Date</th>
                  <th>Calling Process</th>
                </tr>
              </thead>
              <tbody>
                {contacts.length === 0 ? (
                  <tr>
                    <td colSpan="9" style={{ textAlign: 'center', color: '#6b7280' }}>
                      No contacts found matching the filters.
                    </td>
                  </tr>
                ) : (
                  contacts.map((contact) => (
                    <tr key={contact.id}>
                      <td style={{ color: '#6b7280', fontSize: '0.85rem' }}>#{contact.id}</td>
                      <td style={{ fontWeight: '600' }}>{contact.name}</td>
                      <td style={{ letterSpacing: '0.5px' }}>{contact.phone_number}</td>
                      <td>{contact.campaign_name || 'N/A'}</td>
                      <td>
                        <span className={`badge badge-${contact.status}`}>
                          {contact.status}
                        </span>
                      </td>
                      <td>
                        <span style={{ fontSize: '0.9rem', color: contact.assigned_to ? 'var(--text-primary)' : 'var(--text-muted)' }}>
                          {(() => {
                            const caller = telecallers.find(tc => String(tc.id) === String(contact.assigned_to));
                            return caller ? caller.name : 'Unassigned';
                          })()}
                        </span>
                      </td>
                      <td style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                        {contact.last_called_at ? parseDbDate(contact.last_called_at).toLocaleString() : '-'}
                      </td>
                      <td style={{ color: 'var(--color-secondary)', fontWeight: '500', fontSize: '0.85rem' }}>
                        {contact.follow_up_date ? parseDbDate(contact.follow_up_date).toLocaleDateString() : '-'}
                      </td>
                      <td>
                        <button
                          className="btn btn-secondary"
                          style={{ padding: '6px 12px', fontSize: '0.8rem', height: 'auto', minWidth: 'auto' }}
                          onClick={() => handleViewProcess(contact)}
                        >
                          View Process
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



      {/* Campaign Assignment Modal */}
      {isAssignCampaignModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h2>Assign Campaign to Telecaller</h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '1.5rem' }}>
              Assign all contacts in a selected campaign to a specific telecaller.
            </p>

            <form onSubmit={handleConfirmBulkAssignment}>
              <div className="form-group">
                <label>Select Campaign</label>
                <select 
                  value={bulkCampaignId}
                  onChange={(e) => setBulkCampaignId(e.target.value)}
                  style={{ width: '100%', height: '42px' }}
                >
                  <option value="">Choose Campaign...</option>
                  {campaigns.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>

              <div className="form-group" style={{ marginBottom: '1.5rem', marginTop: '1rem' }}>
                <label>Assign to Telecaller</label>
                <select 
                  value={bulkTelecallerId}
                  onChange={(e) => setBulkTelecallerId(e.target.value)}
                  style={{ width: '100%', height: '42px' }}
                >
                  <option value="">Unassigned (Return to general pool)</option>
                  {telecallers.map(tc => (
                    <option key={tc.id} value={tc.id}>{tc.name}</option>
                  ))}
                </select>
              </div>

              <div className="modal-actions">
                <button 
                  type="button" 
                  className="btn btn-secondary" 
                  onClick={() => {
                    setIsAssignCampaignModalOpen(false);
                    setBulkCampaignId('');
                    setBulkTelecallerId('');
                  }}
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={bulkAssigning}>
                  {bulkAssigning ? 'Assigning...' : 'Confirm Assignment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      {/* Lead Process Timeline Modal */}
      {isProcessModalOpen && selectedContact && (
        <div className="modal-overlay" style={{ zIndex: 1050 }}>
          <div className="modal-content" style={{ maxWidth: '650px', width: '90%', maxHeight: '85vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.75rem' }}>
              <div>
                <h2 style={{ margin: 0 }}>Calling Process Timeline</h2>
                <p className="subtitle" style={{ margin: '4px 0 0' }}>All interactions and status updates for this lead</p>
              </div>
              <button 
                type="button" 
                className="btn btn-secondary" 
                onClick={() => {
                  setIsProcessModalOpen(false);
                  setSelectedContact(null);
                  setProcessLogs([]);
                  setActiveRecordingUrl(null);
                }}
                style={{ minWidth: 'auto', padding: '6px 12px' }}
              >
                ✕ Close
              </button>
            </div>

            {/* Contact Quick Details Info Header */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '10px', background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', padding: '12px', borderRadius: '10px', marginBottom: '1.5rem' }}>
              <div>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 'bold', textTransform: 'uppercase' }}>Lead Name</div>
                <div style={{ fontWeight: 'bold', fontSize: '0.9rem' }}>{selectedContact.name}</div>
              </div>
              <div>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 'bold', textTransform: 'uppercase' }}>Phone Number</div>
                <div style={{ fontWeight: 'bold', fontSize: '0.9rem' }}>{selectedContact.phone_number}</div>
              </div>
              <div>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 'bold', textTransform: 'uppercase' }}>Campaign</div>
                <div style={{ fontSize: '0.9rem' }}>{selectedContact.campaign_name || 'N/A'}</div>
              </div>
              <div>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 'bold', textTransform: 'uppercase' }}>Current Status</div>
                <div style={{ marginTop: '4px' }}>
                  <span className={`badge badge-${selectedContact.status}`} style={{ fontSize: '0.75rem' }}>
                    {selectedContact.status}
                  </span>
                </div>
              </div>
            </div>

            {/* Call Recording Playback Sticky Header inside Modal */}
            {activeRecordingUrl && (
              <div className="glass-card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: 'rgba(99, 102, 241, 0.1)', border: '1px solid rgba(99, 102, 241, 0.3)', borderRadius: '10px', marginBottom: '1.25rem', gap: '10px' }}>
                <span style={{ fontSize: '0.82rem', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  🔊 Playback Active
                </span>
                <audio src={activeRecordingUrl} controls autoPlay style={{ flex: 1, height: '28px' }} />
                <button
                  type="button"
                  className="btn btn-secondary"
                  style={{ padding: '4px 8px', fontSize: '0.75rem', height: 'auto', minWidth: 'auto' }}
                  onClick={() => setActiveRecordingUrl(null)}
                >
                  Stop
                </button>
              </div>
            )}

            {/* Timeline Process List */}
            <div style={{ paddingLeft: '8px' }}>
              {loadingProcess ? (
                <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-secondary)' }}>Loading history logs...</div>
              ) : processLogs.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)', background: 'var(--bg-secondary)', borderRadius: '10px', border: '1px dashed var(--border-color)', fontStyle: 'italic' }}>
                  No call logs or processes found for this lead. It hasn't been called yet.
                </div>
              ) : (
                <div style={{ position: 'relative', borderLeft: '2px solid var(--border-color)', paddingLeft: '20px', marginLeft: '10px' }}>
                  {processLogs.map((log) => {
                    const callDate = parseDbDate(log.called_at);
                    const formattedDate = callDate ? callDate.toLocaleString() : '-';
                    const durationStr = (log.call_status === 'connected' || log.call_status === 'received') 
                      ? `${Math.floor(log.duration / 60)}m ${log.duration % 60}s`
                      : '0s';

                    return (
                      <div key={log.id} style={{ marginBottom: '1.5rem', position: 'relative' }}>
                        {/* Timeline Bullet Point */}
                        <div style={{ 
                          position: 'absolute', 
                          left: '-29px', 
                          top: '2px', 
                          width: '16px', 
                          height: '16px', 
                          borderRadius: '50%', 
                          background: log.call_status === 'connected' || log.call_status === 'received' ? '#10b981' : '#f59e0b',
                          border: '4px solid var(--bg-primary)'
                        }}></div>

                        <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '10px', padding: '12px 16px' }}>
                          {/* Log Header */}
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px', marginBottom: '8px' }}>
                            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 'bold' }}>
                              {formattedDate}
                            </span>
                            <span className={`badge badge-${log.call_status}`} style={{ fontSize: '0.75rem' }}>
                              {log.call_status}
                            </span>
                          </div>

                          {/* Details Grid */}
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '8px', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                            <div>
                              <strong>Called By:</strong> {log.telecaller_name}
                            </div>
                            <div>
                              <strong>Talk Time:</strong> {durationStr}
                            </div>
                          </div>

                          {/* Feedback text */}
                          {log.feedback && (
                            <div style={{ marginTop: '8px', padding: '8px', background: 'var(--bg-primary)', borderRadius: '6px', fontSize: '0.82rem', border: '1px solid var(--border-color)' }}>
                              <strong>Feedback:</strong> {log.feedback}
                            </div>
                          )}

                          {/* Call Recording Play/Listen */}
                          {log.recording_url && (
                            <div style={{ marginTop: '8px', display: 'flex', justifyContent: 'flex-end' }}>
                              <button
                                type="button"
                                className="btn btn-secondary"
                                style={{ padding: '4px 8px', fontSize: '0.78rem', height: 'auto', minWidth: 'auto', display: 'flex', alignItems: 'center', gap: '4px' }}
                                onClick={() => handlePlayRecording(log.recording_url)}
                              >
                                🔊 {activeRecordingUrl && activeRecordingUrl.includes(log.recording_url) ? 'Playing...' : 'Listen Call'}
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1.5rem', borderTop: '1px solid var(--border-color)', paddingTop: '1rem' }}>
              <button 
                type="button" 
                className="btn btn-secondary" 
                onClick={() => {
                  setIsProcessModalOpen(false);
                  setSelectedContact(null);
                  setProcessLogs([]);
                  setActiveRecordingUrl(null);
                }}
              >
                Close View
              </button>
            </div>
          </div>
        </div>
      )}
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
  actionButtons: {
    display: 'flex',
    gap: '10px',
  },
  filterRow: {
    display: 'flex',
    gap: '1rem',
    marginBottom: '1.5rem',
    alignItems: 'center',
    flexWrap: 'wrap',
    background: 'var(--bg-secondary)',
    border: '1px solid var(--border-color)',
    borderRadius: '12px',
    padding: '1rem',
  },
  filterItem: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
    minWidth: '180px',
  },
  selectFilter: {
    height: '42px',
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
  selectWrapper: {
    position: 'relative',
    display: 'flex',
    alignItems: 'center',
    minWidth: '150px',
  },
  selectIcon: {
    position: 'absolute',
    left: '8px',
    color: '#6366f1',
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
  }
};

export default Contacts;
