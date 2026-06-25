import React, { useEffect, useState } from 'react';
import API_BASE_URL from '../config/api';
import { Plus, Play, Pause, CheckCircle2, Upload, Music, Volume2, Trash2, User, Users, UserCheck, Check, UploadCloud, X } from 'lucide-react';

const Campaigns = ({ user }) => {
  const [campaigns, setCampaigns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  // Form states
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  
  const [formError, setFormError] = useState('');
  const [formSuccess, setFormSuccess] = useState('');

  // CSV Import States
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [importCampaignId, setImportCampaignId] = useState('');
  const [importCampaignName, setImportCampaignName] = useState('');
  const [allotmentType, setAllotmentType] = useState('all'); // 'all', 'single', 'selected'
  const [importAssignTo, setImportAssignTo] = useState('');
  const [selectedTelecallers, setSelectedTelecallers] = useState([]);
  const [csvFile, setCsvFile] = useState(null);
  const [telecallers, setTelecallers] = useState([]);
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState('');
  const [importSuccess, setImportSuccess] = useState('');

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
      console.error('Error fetching campaigns:', err);
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
    fetchCampaigns();
    fetchTelecallers();
  }, []);

  const handleImportContacts = async (e) => {
    e.preventDefault();
    setImportError('');
    setImportSuccess('');

    if (!csvFile) {
      setImportError('Please choose a CSV file.');
      return;
    }
    if (allotmentType === 'selected' && selectedTelecallers.length === 0) {
      setImportError('Please select at least one telecaller.');
      return;
    }
    if (allotmentType === 'single' && !importAssignTo) {
      setImportError('Please select a telecaller.');
      return;
    }

    setImporting(true);
    const formData = new FormData();
    formData.append('campaignId', importCampaignId);
    formData.append('file', csvFile);
    formData.append('allotmentType', allotmentType);
    
    if (allotmentType === 'single') {
      formData.append('assignedToUserId', importAssignTo);
    } else if (allotmentType === 'selected') {
      formData.append('selectedTelecallerIds', JSON.stringify(selectedTelecallers));
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

      setImportSuccess(data.message || 'Contacts imported and split successfully!');
      setCsvFile(null);
      setImportAssignTo('');
      setSelectedTelecallers([]);
      fetchCampaigns();
      setTimeout(() => {
        setIsImportModalOpen(false);
        setImportSuccess('');
      }, 1500);
    } catch (err) {
      setImportError(err.message);
    } finally {
      setImporting(false);
    }
  };

  const handleCreateCampaign = async (e) => {
    e.preventDefault();
    setFormError('');
    setFormSuccess('');

    if (!name) {
      setFormError('Campaign name is required.');
      return;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/api/campaigns`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ name, description })
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to create campaign.');
      }

      setFormSuccess('Campaign created successfully!');
      setName('');
      setDescription('');
      fetchCampaigns();

      const newCampaignId = data.id;
      const newCampaignName = data.name;

      setTimeout(() => {
        setIsCreateModalOpen(false);
        setFormSuccess('');

        // Open the CSV upload modal automatically for this campaign
        setImportCampaignId(newCampaignId);
        setImportCampaignName(newCampaignName);
        setAllotmentType('all');
        setImportAssignTo('');
        setSelectedTelecallers([]);
        setCsvFile(null);
        setImportError('');
        setImportSuccess('');
        setIsImportModalOpen(true);
      }, 1500);
    } catch (err) {
      setFormError(err.message);
    }
  };

  const handleStatusChange = async (campaignId, currentStatus) => {
    let nextStatus = 'active';
    if (currentStatus === 'active') nextStatus = 'paused';
    else if (currentStatus === 'paused') nextStatus = 'active';
    else if (currentStatus === 'pending') nextStatus = 'active';

    if (nextStatus === 'active' && user && user.planType === 'monthly') {
      const activeCount = campaigns.filter(c => c.status === 'active').length;
      if (activeCount >= 5) {
        alert('Starter Plan Limit Reached: You can have at most 5 active campaigns at the same time. Please pause one of your active campaigns or upgrade your plan in the Billing page to activate more.');
        return;
      }
    }

    try {
      const response = await fetch(`${API_BASE_URL}/api/campaigns/${campaignId}/status`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ status: nextStatus })
      });

      if (response.ok) {
        fetchCampaigns();
      } else {
        const errData = await response.json();
        alert(errData.error || 'Failed to update campaign status.');
      }
    } catch (err) {
      console.error('Error changing campaign status:', err);
    }
  };

  const handleCompleteCampaign = async (campaignId) => {
    try {
      const response = await fetch(`/api/campaigns/${campaignId}/status`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ status: 'completed' })
      });

      if (response.ok) {
        fetchCampaigns();
      }
    } catch (err) {
      console.error('Error completing campaign:', err);
    }
  };

  const handleDeleteCampaign = async (id, campaignName) => {
    const confirmed = window.confirm(`Are you sure you want to delete campaign "${campaignName}"?\nWARNING: This will permanently delete all contacts and call recordings associated with this campaign!`);
    if (!confirmed) return;

    try {
      const response = await fetch(`${API_BASE_URL}/api/campaigns/${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to delete campaign.');
      }

      alert('Campaign deleted successfully.');
      fetchCampaigns();
    } catch (err) {
      alert(`Error: ${err.message}`);
    }
  };

  // Voice broadcast file upload functions removed

  return (
    <div>
      <div style={styles.header}>
        <div>
          <h1>Call Campaigns</h1>
          <p className="subtitle">Launch auto-calling campaigns and manage client lists.</p>
        </div>
        <button className="btn btn-primary" onClick={() => setIsCreateModalOpen(true)}>
          <Plus size={18} />
          Create Campaign
        </button>
      </div>

      <div className="glass-card">
        {loading ? (
          <div style={{ color: 'var(--text-primary)', textAlign: 'center', padding: '2rem' }}>Loading campaigns...</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table>
              <thead>
                <tr>
                  <th>Campaign Name</th>
                  <th>Description</th>
                  <th>Status</th>
                  <th>Progress</th>
                  <th>Action Controls</th>
                </tr>
              </thead>
              <tbody>
                {campaigns.length === 0 ? (
                  <tr>
                    <td colSpan="6" style={{ textAlign: 'center', color: '#6b7280' }}>
                      No campaigns created yet. Click 'Create Campaign' to get started.
                    </td>
                  </tr>
                ) : (
                  campaigns.map((camp) => {
                    const total = parseInt(camp.total_contacts || 0);
                    const completed = parseInt(camp.completed_contacts || 0);
                    const progressPercent = total > 0 ? Math.round((completed / total) * 100) : 0;
                    
                    return (
                      <tr key={camp.id}>
                        <td style={{ fontWeight: '600' }}>{camp.name}</td>
                        <td style={{ color: 'var(--text-secondary)', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {camp.description || 'No description'}
                        </td>
                        <td>
                          <span className={`badge badge-${camp.status}`}>
                            {camp.status}
                          </span>
                        </td>
                        <td style={{ width: '180px' }}>
                          <div style={styles.progressContainer}>
                            <div style={styles.progressBarBg}>
                              <div style={{ ...styles.progressBarFill, width: `${progressPercent}%` }}></div>
                            </div>
                            <span style={styles.progressText}>{progressPercent}% ({completed}/{total})</span>
                          </div>
                        </td>

                        <td>
                          <div style={styles.actionsGroup}>
                            {camp.status !== 'completed' && (
                              <button 
                                className="btn btn-secondary"
                                style={styles.iconButton}
                                title={camp.status === 'active' ? 'Pause Campaign' : 'Start Campaign'}
                                onClick={() => handleStatusChange(camp.id, camp.status)}
                              >
                                {camp.status === 'active' ? (
                                  <Pause size={16} color="#fbbf24" />
                                ) : (
                                  <Play size={16} color="#10b981" />
                                )}
                              </button>
                            )}

                            {camp.status !== 'completed' && (
                              <button 
                                className="btn btn-secondary"
                                style={styles.iconButton}
                                title="Mark as Completed"
                                onClick={() => handleCompleteCampaign(camp.id)}
                              >
                                <CheckCircle2 size={16} color="#10b981" />
                              </button>
                            )}

                            {camp.status !== 'completed' && (
                              <button 
                                className="btn btn-secondary"
                                style={styles.iconButton}
                                title="Import CSV Contacts"
                                onClick={() => {
                                  setImportCampaignId(camp.id);
                                  setImportCampaignName(camp.name);
                                  setAllotmentType('all');
                                  setImportAssignTo('');
                                  setSelectedTelecallers([]);
                                  setCsvFile(null);
                                  setImportError('');
                                  setImportSuccess('');
                                  setIsImportModalOpen(true);
                                }}
                              >
                                <Upload size={16} color="var(--color-primary)" />
                              </button>
                            )}

                            <button 
                              className="btn btn-secondary"
                              style={styles.deleteButton}
                              title="Delete Campaign"
                              onClick={() => handleDeleteCampaign(camp.id, camp.name)}
                            >
                              <Trash2 size={16} color="#ef4444" />
                            </button>
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

      {/* Modal - Create Campaign */}
      {isCreateModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h2>Create Call Campaign</h2>
            <form onSubmit={handleCreateCampaign} style={{ marginTop: '1rem' }}>
              {formError && <div style={styles.errorBanner}>{formError}</div>}
              {formSuccess && <div style={styles.successBanner}>{formSuccess}</div>}

              <div className="form-group">
                <label>Campaign Name</label>
                <input 
                  type="text" 
                  placeholder="E.g., Diwali Offer Broadcast" 
                  value={name} 
                  onChange={(e) => setName(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label>Description</label>
                <textarea 
                  placeholder="Describe the campaign objectives..." 
                  rows="3" 
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </div>

              <div className="modal-actions">
                <button type="button" className="btn btn-secondary" onClick={() => setIsCreateModalOpen(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Create Campaign
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal - Import CSV Contacts */}
      {isImportModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '520px', width: '90%' }}>
            <h2>Import Contacts CSV</h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '1.25rem' }}>
              Campaign: <strong>{importCampaignName}</strong>
              <br />
              Upload a .csv containing columns: <strong>Name</strong> and <strong>Phone</strong> (or <strong>Phone Number</strong>).
            </p>

            <form onSubmit={handleImportContacts}>
              {importError && <div style={styles.errorBanner}>{importError}</div>}
              {importSuccess && <div style={styles.successBanner}>{importSuccess}</div>}

              {/* Redesigned File Upload Zone */}
              {!csvFile ? (
                <div className="form-group" style={{ marginBottom: '1.25rem' }}>
                  <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500', fontSize: '0.9rem' }}>CSV File</label>
                  <div
                    onClick={() => document.getElementById('csvFileInput').click()}
                    onDragOver={(e) => {
                      e.preventDefault();
                      e.currentTarget.style.borderColor = 'var(--color-primary)';
                      e.currentTarget.style.backgroundColor = 'rgba(124, 58, 237, 0.04)';
                    }}
                    onDragLeave={(e) => {
                      e.preventDefault();
                      e.currentTarget.style.borderColor = 'var(--border-color)';
                      e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.02)';
                    }}
                    onDrop={(e) => {
                      e.preventDefault();
                      e.currentTarget.style.borderColor = 'var(--border-color)';
                      e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.02)';
                      if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                        setCsvFile(e.dataTransfer.files[0]);
                      }
                    }}
                    style={{
                      border: '2px dashed var(--border-color)',
                      borderRadius: '12px',
                      padding: '1.5rem 1rem',
                      textAlign: 'center',
                      cursor: 'pointer',
                      backgroundColor: 'rgba(255, 255, 255, 0.02)',
                      transition: 'all 0.2s ease',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = 'var(--color-primary)';
                      e.currentTarget.style.backgroundColor = 'rgba(124, 58, 237, 0.04)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = 'var(--border-color)';
                      e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.02)';
                    }}
                  >
                    <UploadCloud size={32} color="var(--text-secondary)" style={{ marginBottom: '4px' }} />
                    <span style={{ fontSize: '0.9rem', fontWeight: '500', color: 'var(--text-primary)' }}>
                      Click or drag CSV file to upload
                    </span>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                      File must contain Name and Phone columns
                    </span>
                    <input 
                      id="csvFileInput"
                      type="file" 
                      accept=".csv"
                      onChange={(e) => setCsvFile(e.target.files[0])}
                      style={{ display: 'none' }}
                    />
                  </div>
                </div>
              ) : (
                <div className="form-group" style={{ marginBottom: '1.25rem' }}>
                  <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500', fontSize: '0.9rem' }}>CSV File</label>
                  <div
                    style={{
                      border: '1.5px solid var(--color-success)',
                      borderRadius: '12px',
                      padding: '10px 14px',
                      backgroundColor: 'rgba(16, 185, 129, 0.06)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: '12px'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1, minWidth: 0 }}>
                      <div style={{
                        backgroundColor: 'rgba(16, 185, 129, 0.12)',
                        borderRadius: '8px',
                        padding: '6px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0
                      }}>
                        <Check size={18} color="var(--color-success)" />
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ margin: 0, fontSize: '0.85rem', fontWeight: '600', color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {csvFile.name}
                        </p>
                        <p style={{ margin: 0, fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
                          {(csvFile.size / 1024).toFixed(1)} KB
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setCsvFile(null)}
                      style={{
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        padding: '4px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: 'var(--text-secondary)',
                        transition: 'color 0.2s ease'
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.color = 'var(--color-danger)'}
                      onMouseLeave={(e) => e.currentTarget.style.color = 'var(--text-secondary)'}
                    >
                      <X size={18} />
                    </button>
                  </div>
                </div>
              )}

              {/* Redesigned Strategy Cards Stack */}
              <div className="form-group" style={{ marginBottom: '1.25rem' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500', fontSize: '0.9rem' }}>Allotment Option</label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  
                  {/* Option 1: Split Equally */}
                  <div
                    onClick={() => setAllotmentType('all')}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                      padding: '12px 16px',
                      borderRadius: '12px',
                      border: allotmentType === 'all' ? '2px solid var(--color-primary)' : '1px solid var(--border-color)',
                      backgroundColor: allotmentType === 'all' ? 'rgba(124, 58, 237, 0.06)' : 'var(--bg-card)',
                      boxShadow: allotmentType === 'all' ? 'var(--shadow-glow)' : 'none',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease-in-out'
                    }}
                    onMouseEnter={(e) => {
                      if (allotmentType !== 'all') {
                        e.currentTarget.style.borderColor = 'var(--color-primary-glow)';
                        e.currentTarget.style.backgroundColor = 'var(--bg-card-hover)';
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (allotmentType !== 'all') {
                        e.currentTarget.style.borderColor = 'var(--border-color)';
                        e.currentTarget.style.backgroundColor = 'var(--bg-card)';
                      }
                    }}
                  >
                    <div style={{
                      width: '36px',
                      height: '36px',
                      borderRadius: '50%',
                      backgroundColor: allotmentType === 'all' ? 'var(--color-primary)' : 'rgba(255, 255, 255, 0.05)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: allotmentType === 'all' ? '#fff' : 'var(--text-secondary)',
                      transition: 'all 0.2s ease',
                      flexShrink: 0
                    }}>
                      <Users size={16} />
                    </div>
                    <div style={{ flex: 1 }}>
                      <h4 style={{ margin: 0, fontSize: '0.85rem', fontWeight: '600', color: 'var(--text-primary)' }}>
                        Split Equally
                      </h4>
                      <p style={{ margin: 0, fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
                        Distribute contacts evenly to all active agents
                      </p>
                    </div>
                    <div style={{
                      width: '18px',
                      height: '18px',
                      borderRadius: '50%',
                      border: allotmentType === 'all' ? '5px solid var(--color-primary)' : '2px solid var(--border-color)',
                      backgroundColor: 'transparent',
                      transition: 'all 0.2s ease',
                      flexShrink: 0
                    }} />
                  </div>

                  {/* Option 2: Single Agent */}
                  <div
                    onClick={() => setAllotmentType('single')}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                      padding: '12px 16px',
                      borderRadius: '12px',
                      border: allotmentType === 'single' ? '2px solid var(--color-primary)' : '1px solid var(--border-color)',
                      backgroundColor: allotmentType === 'single' ? 'rgba(124, 58, 237, 0.06)' : 'var(--bg-card)',
                      boxShadow: allotmentType === 'single' ? 'var(--shadow-glow)' : 'none',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease-in-out'
                    }}
                    onMouseEnter={(e) => {
                      if (allotmentType !== 'single') {
                        e.currentTarget.style.borderColor = 'var(--color-primary-glow)';
                        e.currentTarget.style.backgroundColor = 'var(--bg-card-hover)';
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (allotmentType !== 'single') {
                        e.currentTarget.style.borderColor = 'var(--border-color)';
                        e.currentTarget.style.backgroundColor = 'var(--bg-card)';
                      }
                    }}
                  >
                    <div style={{
                      width: '36px',
                      height: '36px',
                      borderRadius: '50%',
                      backgroundColor: allotmentType === 'single' ? 'var(--color-primary)' : 'rgba(255, 255, 255, 0.05)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: allotmentType === 'single' ? '#fff' : 'var(--text-secondary)',
                      transition: 'all 0.2s ease',
                      flexShrink: 0
                    }}>
                      <User size={16} />
                    </div>
                    <div style={{ flex: 1 }}>
                      <h4 style={{ margin: 0, fontSize: '0.85rem', fontWeight: '600', color: 'var(--text-primary)' }}>
                        Single Agent
                      </h4>
                      <p style={{ margin: 0, fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
                        Allot all contacts in this CSV to one specific agent
                      </p>
                    </div>
                    <div style={{
                      width: '18px',
                      height: '18px',
                      borderRadius: '50%',
                      border: allotmentType === 'single' ? '5px solid var(--color-primary)' : '2px solid var(--border-color)',
                      backgroundColor: 'transparent',
                      transition: 'all 0.2s ease',
                      flexShrink: 0
                    }} />
                  </div>

                  {/* Option 3: Custom Subgroup */}
                  <div
                    onClick={() => setAllotmentType('selected')}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                      padding: '12px 16px',
                      borderRadius: '12px',
                      border: allotmentType === 'selected' ? '2px solid var(--color-primary)' : '1px solid var(--border-color)',
                      backgroundColor: allotmentType === 'selected' ? 'rgba(124, 58, 237, 0.06)' : 'var(--bg-card)',
                      boxShadow: allotmentType === 'selected' ? 'var(--shadow-glow)' : 'none',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease-in-out'
                    }}
                    onMouseEnter={(e) => {
                      if (allotmentType !== 'selected') {
                        e.currentTarget.style.borderColor = 'var(--color-primary-glow)';
                        e.currentTarget.style.backgroundColor = 'var(--bg-card-hover)';
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (allotmentType !== 'selected') {
                        e.currentTarget.style.borderColor = 'var(--border-color)';
                        e.currentTarget.style.backgroundColor = 'var(--bg-card)';
                      }
                    }}
                  >
                    <div style={{
                      width: '36px',
                      height: '36px',
                      borderRadius: '50%',
                      backgroundColor: allotmentType === 'selected' ? 'var(--color-primary)' : 'rgba(255, 255, 255, 0.05)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: allotmentType === 'selected' ? '#fff' : 'var(--text-secondary)',
                      transition: 'all 0.2s ease',
                      flexShrink: 0
                    }}>
                      <UserCheck size={16} />
                    </div>
                    <div style={{ flex: 1 }}>
                      <h4 style={{ margin: 0, fontSize: '0.85rem', fontWeight: '600', color: 'var(--text-primary)' }}>
                        Custom Subgroup
                      </h4>
                      <p style={{ margin: 0, fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
                        Select a subgroup of agents to split contacts between
                      </p>
                    </div>
                    <div style={{
                      width: '18px',
                      height: '18px',
                      borderRadius: '50%',
                      border: allotmentType === 'selected' ? '5px solid var(--color-primary)' : '2px solid var(--border-color)',
                      backgroundColor: 'transparent',
                      transition: 'all 0.2s ease',
                      flexShrink: 0
                    }} />
                  </div>

                </div>
              </div>

              {/* Strategy 2: Single telecaller dropdown */}
              {allotmentType === 'single' && (
                <div className="form-group" style={{ marginBottom: '1.25rem' }}>
                  <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500', fontSize: '0.9rem' }}>Select Telecaller</label>
                  <select 
                    value={importAssignTo} 
                    onChange={(e) => setImportAssignTo(e.target.value)}
                    style={{ 
                      width: '100%', 
                      padding: '0.65rem 0.8rem', 
                      borderRadius: '10px', 
                      border: '1px solid var(--border-color)', 
                      backgroundColor: 'var(--bg-card)', 
                      color: 'var(--text-primary)',
                      fontSize: '0.85rem',
                      outline: 'none',
                      transition: 'border-color 0.2s ease'
                    }}
                    onFocus={(e) => e.target.style.borderColor = 'var(--color-primary)'}
                    onBlur={(e) => e.target.style.borderColor = 'var(--border-color)'}
                    required
                  >
                    <option value="">Choose Telecaller...</option>
                    {telecallers.map(tc => (
                      <option key={tc.id} value={tc.id}>{tc.name}</option>
                    ))}
                  </select>
                </div>
              )}

              {/* Strategy 3: Subgroup checkboxes */}
              {allotmentType === 'selected' && (
                <div className="form-group" style={{ marginBottom: '1.25rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <label style={{ margin: 0, fontWeight: '500', fontSize: '0.9rem' }}>Select Agents ({selectedTelecallers.length})</label>
                    {telecallers.length > 0 && (
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button
                          type="button"
                          onClick={() => setSelectedTelecallers(telecallers.map(tc => tc.id))}
                          style={{
                            background: 'none',
                            border: 'none',
                            fontSize: '0.75rem',
                            fontWeight: '600',
                            color: 'var(--color-primary)',
                            cursor: 'pointer',
                            padding: '2px 4px'
                          }}
                        >
                          Select All
                        </button>
                        <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>|</span>
                        <button
                          type="button"
                          onClick={() => setSelectedTelecallers([])}
                          style={{
                            background: 'none',
                            border: 'none',
                            fontSize: '0.75rem',
                            fontWeight: '600',
                            color: 'var(--text-secondary)',
                            cursor: 'pointer',
                            padding: '2px 4px'
                          }}
                        >
                          Clear
                        </button>
                      </div>
                    )}
                  </div>
                  
                  <div style={{ 
                    maxHeight: '160px', 
                    overflowY: 'auto', 
                    border: '1px solid var(--border-color)', 
                    borderRadius: '12px', 
                    padding: '10px',
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))',
                    gap: '8px',
                    backgroundColor: 'var(--bg-secondary)',
                    scrollbarWidth: 'thin'
                  }}>
                    {telecallers.length === 0 ? (
                      <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '1.5rem 0', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                        No telecallers available
                      </div>
                    ) : (
                      telecallers.map(tc => {
                        const isSelected = selectedTelecallers.includes(tc.id);
                        const initials = tc.name
                          ? tc.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase()
                          : 'TC';
                        
                        return (
                          <div
                            key={tc.id}
                            onClick={() => {
                              if (isSelected) {
                                setSelectedTelecallers(selectedTelecallers.filter(id => id !== tc.id));
                              } else {
                                setSelectedTelecallers([...selectedTelecallers, tc.id]);
                              }
                            }}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '8px',
                              padding: '8px 10px',
                              borderRadius: '10px',
                              border: isSelected ? '1.5px solid var(--color-primary)' : '1px solid var(--border-color)',
                              backgroundColor: isSelected ? 'rgba(124, 58, 237, 0.05)' : 'var(--bg-card)',
                              cursor: 'pointer',
                              transition: 'all 0.15s ease',
                              userSelect: 'none'
                            }}
                            onMouseEnter={(e) => {
                              if (!isSelected) {
                                e.currentTarget.style.borderColor = 'var(--color-primary-glow)';
                                e.currentTarget.style.backgroundColor = 'var(--bg-card-hover)';
                              }
                            }}
                            onMouseLeave={(e) => {
                              if (!isSelected) {
                                e.currentTarget.style.borderColor = 'var(--border-color)';
                                e.currentTarget.style.backgroundColor = 'var(--bg-card)';
                              }
                            }}
                          >
                            <div style={{
                              width: '26px',
                              height: '26px',
                              borderRadius: '50%',
                              backgroundColor: isSelected ? 'var(--color-primary)' : 'var(--border-color)',
                              color: isSelected ? '#fff' : 'var(--text-secondary)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontSize: '0.7rem',
                              fontWeight: '600',
                              flexShrink: 0
                            }}>
                              {isSelected ? <Check size={12} /> : initials}
                            </div>
                            <span style={{ 
                              fontSize: '0.78rem', 
                              fontWeight: isSelected ? '600' : 'normal',
                              color: isSelected ? 'var(--text-primary)' : 'var(--text-secondary)',
                              whiteSpace: 'nowrap',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              flex: 1
                            }}>
                              {tc.name}
                            </span>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              )}

              <div className="modal-actions">
                <button type="button" className="btn btn-secondary" onClick={() => setIsImportModalOpen(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={importing}>
                  {importing ? 'Uploading...' : 'Upload & Allot Contacts'}
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
  progressContainer: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
  },
  progressBarBg: {
    width: '100%',
    height: '6px',
    backgroundColor: 'var(--border-color)',
    borderRadius: '3px',
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#6366f1',
    borderRadius: '3px',
  },
  progressText: {
    fontSize: '0.75rem',
    color: 'var(--text-secondary)',
  },
  actionsGroup: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  iconButton: {
    width: '32px',
    height: '32px',
    padding: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
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

export default Campaigns;
