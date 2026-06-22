import React, { useEffect, useState } from 'react';
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

  const fetchCampaigns = async () => {
    try {
      const response = await fetch('/api/campaigns', {
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
      const response = await fetch('/api/call-logs/analytics', {
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
      const url = `/api/contacts?campaignId=${selectedCampaignFilter}&status=${selectedStatusFilter}&search=${searchTerm}`;
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
      const response = await fetch('/api/contacts/import', {
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
      const response = await fetch(`/api/contacts/${contactId}/assign`, {
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
      const response = await fetch('/api/contacts/assign-campaign', {
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
      const response = await fetch('/api/contacts/allot', {
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
          <button className="btn btn-primary" onClick={() => setIsImportModalOpen(true)}>
            <Upload size={18} />
            Import Contacts (CSV)
          </button>
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
                </tr>
              </thead>
              <tbody>
                {contacts.length === 0 ? (
                  <tr>
                    <td colSpan="8" style={{ textAlign: 'center', color: '#6b7280' }}>
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
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* CSV Import Modal */}
      {isImportModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h2>Import Contacts CSV</h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '1.5rem' }}>
              Upload a comma-separated value (.csv) list containing columns: <strong>Name</strong> and <strong>Phone</strong> (or <strong>Phone Number</strong>).
            </p>

            <form onSubmit={handleImportContacts}>
              {formError && <div style={styles.errorBanner}>{formError}</div>}
              {formSuccess && <div style={styles.successBanner}>{formSuccess}</div>}

              <div className="form-group">
                <label>Select Campaign</label>
                <select 
                  value={importCampaignId}
                  onChange={(e) => setImportCampaignId(e.target.value)}
                  style={{ width: '100%' }}
                >
                  <option value="">Choose Campaign...</option>
                  {campaigns.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>

              {/* Specific Telecaller Selector */}
              <div className="form-group">
                <label>Assign to Specific Telecaller (Optional)</label>
                <select 
                  value={importAssignTo}
                  onChange={(e) => setImportAssignTo(e.target.value)}
                  style={{ width: '100%' }}
                >
                  <option value="">Auto Allot (Round-Robin)</option>
                  {telecallers.map(tc => (
                    <option key={tc.id} value={tc.id}>{tc.name}</option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label>CSV File</label>
                <input 
                  type="file" 
                  accept=".csv"
                  onChange={(e) => setCsvFile(e.target.files[0])}
                  style={{ display: 'block', width: '100%', cursor: 'pointer' }}
                />
              </div>

              <div className="modal-actions">
                <button type="button" className="btn btn-secondary" onClick={() => setIsImportModalOpen(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={importing}>
                  {importing ? 'Importing...' : 'Upload Contacts'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

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
