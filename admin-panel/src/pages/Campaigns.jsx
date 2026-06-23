import React, { useEffect, useState } from 'react';
import API_BASE_URL from '../config/api';
import { Plus, Play, Pause, CheckCircle2, Upload, Music, Volume2, Trash2 } from 'lucide-react';

const Campaigns = () => {
  const [campaigns, setCampaigns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  // Form states
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  
  const [formError, setFormError] = useState('');
  const [formSuccess, setFormSuccess] = useState('');

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

  useEffect(() => {
    fetchCampaigns();
  }, []);

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
      setTimeout(() => {
        setIsCreateModalOpen(false);
        setFormSuccess('');
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
