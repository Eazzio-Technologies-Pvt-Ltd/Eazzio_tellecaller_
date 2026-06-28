import React, { useEffect, useState } from 'react';
import API_BASE_URL from '../config/api';
import { 
  Search, RefreshCw, Building, Users, Calendar, Hash, 
  IndianRupee, Briefcase, Trash2, Monitor, Grid2X2, Grid3X3, 
  LayoutGrid, X, Maximize2, Minimize2
} from 'lucide-react';

const GRID_OPTIONS = [
  { label: '1×1', value: 1, icon: Monitor },
  { label: '2×2', value: 2, icon: Grid2X2 },
  { label: '3×3', value: 3, icon: Grid3X3 },
  { label: '4×4', value: 4, icon: LayoutGrid },
];

const Companies = () => {
  const [companies, setCompanies] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [gridSize, setGridSize] = useState(3); // Default 3 columns (3x3 grid)
  const [isFullscreen, setIsFullscreen] = useState(false);
  const containerRef = React.useRef(null);

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

  // Company Telecaller Detail modal states
  const [selectedCompany, setSelectedCompany] = useState(null);
  const [telecallers, setTelecallers] = useState([]);
  const [telecallersLoading, setTelecallersLoading] = useState(false);
  const [telecallersError, setTelecallersError] = useState('');

  const fetchCompanies = async () => {
    setRefreshing(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/auth/companies`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch companies.');
      }
      setCompanies(data);
    } catch (err) {
      console.error(err);
      setError(err.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const fetchCompanyTelecallers = async (regNum) => {
    setTelecallersLoading(true);
    setTelecallersError('');
    setTelecallers([]);
    try {
      const response = await fetch(`${API_BASE_URL}/api/auth/companies/${regNum}/telecallers`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch company telecallers.');
      }
      setTelecallers(data);
    } catch (err) {
      console.error(err);
      setTelecallersError(err.message);
    } finally {
      setTelecallersLoading(false);
    }
  };

  const handleDeleteCompany = async (e, companyId, companyName) => {
    e.stopPropagation(); // Stop click from bubbling up to select card
    if (!window.confirm(`Are you sure you want to delete "${companyName}"? This will permanently delete their database, and their administrators and telecallers will not be able to log in.`)) {
      return;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/api/auth/companies/${companyId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to delete company.');
      }

      alert(result.message || 'Company deleted successfully.');
      fetchCompanies(); // Refresh company list
      if (selectedCompany && selectedCompany.id === companyId) {
        setSelectedCompany(null); // Close modal if open
      }
    } catch (err) {
      alert(`Error deleting company: ${err.message}`);
    }
  };

  useEffect(() => {
    fetchCompanies();
  }, []);

  useEffect(() => {
    if (selectedCompany) {
      fetchCompanyTelecallers(selectedCompany.reg_num);
    }
  }, [selectedCompany]);

  const filteredCompanies = companies.filter(c => 
    c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.reg_num.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.nature.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.admin_email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const colsStyle = `repeat(${gridSize}, 1fr)`;

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

      {/* Header */}
      {!isFullscreen && (
        <div style={styles.header}>
          <div>
            <h1 style={styles.title}>
              <Building size={26} style={{ marginRight: 10, color: 'var(--color-primary)' }} />
              Live Monitor Grid (Companies)
            </h1>
            <p style={styles.subtitle}>Overview, columns controls, deletion, and telecaller selection dashboard</p>
          </div>

          <button 
            onClick={fetchCompanies} 
            style={styles.refreshBtn}
            disabled={refreshing}
            title="Refresh List"
          >
            <RefreshCw size={18} className={refreshing ? 'animate-spin' : ''} />
            <span style={{ marginLeft: '8px' }}>Refresh</span>
          </button>
        </div>
      )}

      {/* Toolbar */}
      {!isFullscreen && (
        <div style={styles.toolbar}>
          <div style={styles.searchWrapper}>
            <Search size={18} style={styles.searchIcon} />
            <input 
              type="text" 
              placeholder="Search by company name, registration code, or email..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={styles.searchInput}
            />
          </div>

          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            {/* Grid selector buttons */}
            <div className="companies-grid-selector" style={styles.gridSelector}>
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
                    <Icon size={16} />
                    <span style={{ marginLeft: 6, fontSize: '0.82rem', fontWeight: 600 }}>{opt.label}</span>
                  </button>
                );
              })}
            </div>

            {/* Fullscreen Button */}
            <button
              onClick={toggleFullscreen}
              style={{
                ...styles.gridBtn,
                padding: '0 12px',
                height: '38px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: 'var(--bg-card)',
                border: '1px solid var(--border-color)',
                borderRadius: '8px',
                color: 'var(--text-secondary)',
                cursor: 'pointer',
                fontWeight: 600,
                fontSize: '0.82rem',
                transition: 'all 0.2s'
              }}
              title="Toggle Fullscreen"
            >
              <Maximize2 size={15} style={{ marginRight: '6px' }} />
              {isFullscreen ? 'Exit Full' : 'Fullscreen'}
            </button>
          </div>
        </div>
      )}

      {/* Grid Content */}
      {loading ? (
        <div style={styles.loaderBox}>
          <div style={styles.spinner} />
          <span style={{ marginLeft: 12 }}>Loading registered companies...</span>
        </div>
      ) : error ? (
        <div style={styles.errorBox}>
          <span>Error loading companies: {error}</span>
        </div>
      ) : filteredCompanies.length === 0 ? (
        <div style={styles.emptyBox}>
          <Building size={48} color="#374151" style={{ marginBottom: 12 }} />
          <div style={{ color: 'var(--text-secondary)' }}>No companies found.</div>
        </div>
      ) : (
        <div className="live-monitor-grid" style={{ ...styles.grid, gridTemplateColumns: colsStyle }}>
          {filteredCompanies.map(c => {
            const addedTelecallers = c.telecaller_count || 0;
            const pricePerCaller = c.price_per_telecaller || 49;
            const totalCharge = addedTelecallers * pricePerCaller;
            const isExpired = c.subscription_end ? new Date(c.subscription_end) < new Date() : false;
            const expiryStr = formatDate(c.subscription_end);
            const planText = c.plan_type ? c.plan_type.charAt(0).toUpperCase() + c.plan_type.slice(1) : 'Monthly';

            return (
              <div 
                key={c.id} 
                className="zoom-on-hover" 
                style={styles.card}
                onClick={() => setSelectedCompany(c)}
                title="Click to view company telecallers"
              >
                {/* Top Section */}
                <div style={styles.cardHeader}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={styles.avatar}>
                      {c.name.charAt(0).toUpperCase()}
                    </div>
                    <div style={styles.meta}>
                      <h3 style={styles.companyName}>{c.name}</h3>
                      <span style={styles.regNumBadge}>
                        <Hash size={12} style={{ marginRight: '2px' }} />
                        {c.reg_num}
                      </span>
                    </div>
                  </div>
                  
                  <button
                    onClick={(e) => handleDeleteCompany(e, c.id, c.name)}
                    style={styles.deleteBtn}
                    title="Delete Company"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>

                {/* Details Section */}
                <div style={styles.detailsList}>
                  <div style={styles.detailItem}>
                    <div style={styles.itemLabel}>
                      <Briefcase size={14} style={{ marginRight: '6px' }} />
                      Nature of Business
                    </div>
                    <span style={styles.itemValue}>{c.nature}</span>
                  </div>

                  <div style={styles.detailItem}>
                    <div style={styles.itemLabel}>
                      <Calendar size={14} style={{ marginRight: '6px' }} />
                      Registered On
                    </div>
                    <span style={styles.itemValue}>{formatDate(c.created_at)}</span>
                  </div>

                  <div style={styles.detailItem}>
                    <div style={styles.itemLabel}>
                      <Calendar size={14} style={{ marginRight: '6px', color: isExpired ? '#ef4444' : '#10b981' }} />
                      Plan / Expiry
                    </div>
                    <span style={{ 
                      ...styles.itemValue, 
                      color: isExpired ? '#ef4444' : '#10b981',
                      fontWeight: '700'
                    }}>
                      {planText} / {expiryStr} {isExpired ? '(Expired)' : ''}
                    </span>
                  </div>

                  <div style={styles.detailItem}>
                    <div style={styles.itemLabel}>
                      <Users size={14} style={{ marginRight: '6px' }} />
                      Telecallers Added
                    </div>
                    <span style={{ ...styles.itemValue, fontWeight: '700', color: 'var(--color-primary)' }}>
                      {addedTelecallers} callers
                    </span>
                  </div>

                  <div style={styles.detailItem}>
                    <div style={styles.itemLabel}>
                      <IndianRupee size={14} style={{ marginRight: '6px' }} />
                      Price / Telecaller
                    </div>
                    <span style={{ ...styles.itemValue, color: '#10b981', fontWeight: '700' }}>
                      ₹{pricePerCaller}
                    </span>
                  </div>
                </div>

                {/* Total Billing Panel */}
                <div style={styles.billingBanner}>
                  <span style={styles.billingLabel}>TOTAL MONTHLY CHARGE</span>
                  <span style={styles.billingPrice}>₹{totalCharge}</span>
                </div>

                {/* Admin Credentials Note */}
                <div style={styles.adminNote}>
                  <span style={styles.adminNoteLabel}>Admin Email:</span>
                  <span style={styles.adminNoteVal}>{c.admin_email}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Selected Company Details & Telecallers List Modal */}
      {selectedCompany && (
        <div style={styles.modalOverlay} onClick={() => setSelectedCompany(null)}>
          <div style={styles.modalContent} onClick={(e) => e.stopPropagation()}>
            <div style={styles.modalHeader}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={styles.modalAvatar}>
                  {selectedCompany.name.charAt(0).toUpperCase()}
                </div>
                <div>
                  <h2 style={styles.modalTitle}>{selectedCompany.name}</h2>
                  <span style={styles.modalRegCode}>REG CODE: {selectedCompany.reg_num}</span>
                </div>
              </div>
              <button 
                onClick={() => setSelectedCompany(null)} 
                style={styles.modalCloseBtn}
                title="Close"
              >
                <X size={20} />
              </button>
            </div>

            <div style={styles.modalBody}>
              {/* Company Info section */}
              <div style={styles.modalSection}>
                <h4 style={styles.sectionTitle}>Company Summary</h4>
                <div style={styles.infoGrid}>
                  <div style={styles.infoField}>
                    <span style={styles.infoLabel}>Nature of Business</span>
                    <span style={styles.infoValue}>{selectedCompany.nature}</span>
                  </div>
                  <div style={styles.infoField}>
                    <span style={styles.infoLabel}>Admin Account Email</span>
                    <span style={styles.infoValue}>{selectedCompany.admin_email}</span>
                  </div>
                  <div style={styles.infoField}>
                    <span style={styles.infoLabel}>Registered On</span>
                    <span style={styles.infoValue}>{formatDate(selectedCompany.created_at)}</span>
                  </div>
                  <div style={styles.infoField}>
                    <span style={styles.infoLabel}>Billing Plan Type</span>
                    <span style={{ ...styles.infoValue, textTransform: 'capitalize' }}>
                      {selectedCompany.plan_type || 'monthly'}
                    </span>
                  </div>
                  <div style={styles.infoField}>
                    <span style={styles.infoLabel}>Subscription Expiry Date</span>
                    <span style={{ 
                      ...styles.infoValue, 
                      color: (selectedCompany.subscription_end && new Date(selectedCompany.subscription_end) < new Date()) ? '#ef4444' : '#10b981',
                      fontWeight: '700'
                    }}>
                      {formatDate(selectedCompany.subscription_end)}
                      {(selectedCompany.subscription_end && new Date(selectedCompany.subscription_end) < new Date()) ? ' (Expired)' : ''}
                    </span>
                  </div>
                  <div style={styles.infoField}>
                    <span style={styles.infoLabel}>Monthly Revenue Generated</span>
                    <span style={{ ...styles.infoValue, color: '#10b981', fontWeight: '800' }}>
                      ₹{(selectedCompany.telecaller_count || 0) * (selectedCompany.price_per_telecaller || 49)} ({(selectedCompany.telecaller_count || 0)} active telecallers)
                    </span>
                  </div>
                </div>
              </div>

              {/* Telecallers list section */}
              <div style={styles.modalSection}>
                <h4 style={styles.sectionTitle}>
                  <Users size={16} style={{ marginRight: '6px', color: 'var(--color-primary)' }} />
                  Telecallers Selection/Directory inside Company DB
                </h4>
                
                {telecallersLoading ? (
                  <div style={styles.modalLoader}>
                    <div style={styles.spinner} />
                    <span style={{ marginLeft: 10 }}>Accessing company sqlite tenant database...</span>
                  </div>
                ) : telecallersError ? (
                  <div style={styles.modalError}>
                    Failed to query tenant database: {telecallersError}
                  </div>
                ) : telecallers.length === 0 ? (
                  <div style={styles.modalEmpty}>
                    No telecaller accounts created in this company database yet.
                  </div>
                ) : (
                  <div style={styles.telecallersContainer}>
                    <table style={styles.telecallersTable}>
                      <thead>
                        <tr style={{ borderBottom: '2px solid var(--border-color)', backgroundColor: 'var(--bg-primary)' }}>
                          <th style={{ padding: '12px 16px', color: 'var(--text-muted)', fontSize: '0.8rem', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Telecaller Name</th>
                          <th style={{ padding: '12px 16px', color: 'var(--text-muted)', fontSize: '0.8rem', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Registered Mobile / Email</th>
                          <th style={{ padding: '12px 16px', color: 'var(--text-muted)', fontSize: '0.8rem', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Current Status</th>
                          <th style={{ padding: '12px 16px', color: 'var(--text-muted)', fontSize: '0.8rem', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Today's Calls</th>
                          <th style={{ padding: '12px 16px', color: 'var(--text-muted)', fontSize: '0.8rem', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Created At</th>
                        </tr>
                      </thead>
                      <tbody>
                        {telecallers.map(tc => {
                          const statusBg = tc.status === 'online' ? 'rgba(16, 185, 129, 0.12)' : 
                                           tc.status === 'calling' ? 'var(--color-primary-glow)' :
                                           tc.status === 'break' ? 'rgba(245, 158, 11, 0.12)' : 'rgba(107, 114, 128, 0.08)';
                          const statusColor = tc.status === 'online' ? '#10b981' : 
                                              tc.status === 'calling' ? 'var(--color-primary)' :
                                              tc.status === 'break' ? '#f59e0b' : '#6b7280';
                          return (
                            <tr key={tc.id} style={styles.telecallerRow}>
                              <td style={{ padding: '14px 16px', fontWeight: '700', color: 'var(--text-primary)' }}>{tc.name}</td>
                              <td style={{ padding: '14px 16px', fontFamily: 'monospace', color: 'var(--text-secondary)' }}>{tc.email}</td>
                              <td style={{ padding: '14px 16px' }}>
                                <span style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '4px',
                                  fontSize: '0.75rem',
                                  fontWeight: '700',
                                  padding: '3px 8px',
                                  borderRadius: '6px',
                                  backgroundColor: statusBg,
                                  color: statusColor,
                                  textTransform: 'uppercase',
                                }}>
                                  <span style={{
                                    width: '6px',
                                    height: '6px',
                                    borderRadius: '50%',
                                    backgroundColor: statusColor,
                                  }} />
                                  {tc.status}
                                </span>
                              </td>
                              <td style={{ padding: '14px 16px' }}>
                                <div style={{ display: 'flex', gap: '6px' }}>
                                  <span style={{ fontSize: '0.72rem', backgroundColor: 'rgba(16, 185, 129, 0.1)', color: '#10b981', padding: '2px 6px', borderRadius: '4px', fontWeight: '800' }} title="Connected">
                                    C: {tc.connected_count || 0}
                                  </span>
                                  <span style={{ fontSize: '0.72rem', backgroundColor: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', padding: '2px 6px', borderRadius: '4px', fontWeight: '800' }} title="Non-Connected">
                                    NC: {tc.non_connected_count || 0}
                                  </span>
                                  <span style={{ fontSize: '0.72rem', backgroundColor: 'rgba(99, 102, 241, 0.1)', color: '#6366f1', padding: '2px 6px', borderRadius: '4px', fontWeight: '800' }} title="Received">
                                    R: {tc.received_count || 0}
                                  </span>
                                  <span style={{ fontSize: '0.72rem', backgroundColor: 'rgba(245, 158, 11, 0.1)', color: '#f59e0b', padding: '2px 6px', borderRadius: '4px', fontWeight: '800' }} title="Missed">
                                    M: {tc.missed_count || 0}
                                  </span>
                                </div>
                              </td>
                              <td style={{ padding: '14px 16px', color: 'var(--text-secondary)' }}>{formatDate(tc.created_at)}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
            
            <div style={styles.modalFooter}>
              <button 
                onClick={() => setSelectedCompany(null)} 
                style={styles.modalCloseFooterBtn}
              >
                Close Details
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        .animate-spin {
          animation: spin 1s linear infinite;
        }
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
        .zoom-on-hover {
          transition: all 0.2s ease-in-out;
        }
        .zoom-on-hover:hover {
          transform: translateY(-4px) scale(1.01);
          box-shadow: 0 10px 25px rgba(0, 0, 0, 0.4), 0 0 20px rgba(99, 102, 241, 0.15) !important;
          cursor: pointer;
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

const styles = {
  page: { paddingBottom: '2rem' },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
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
  refreshBtn: {
    display: 'flex',
    alignItems: 'center',
    padding: '8px 16px',
    borderRadius: 10,
    border: '1px solid var(--border-color)',
    background: 'var(--bg-secondary)',
    color: 'var(--text-primary)',
    cursor: 'pointer',
    fontWeight: '600',
    fontSize: '0.9rem',
    transition: 'all 0.2s',
  },
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
  searchWrapper: {
    position: 'relative',
    display: 'flex',
    alignItems: 'center',
    flex: 1,
    minWidth: '280px',
  },
  searchIcon: {
    position: 'absolute',
    left: '16px',
    color: 'var(--text-secondary)',
  },
  searchInput: {
    width: '100%',
    height: '46px',
    paddingLeft: '3rem',
    paddingRight: '1rem',
    fontSize: '0.95rem',
    borderRadius: '10px',
    border: '1px solid var(--border-color)',
    backgroundColor: 'var(--bg-primary)',
    color: 'var(--text-primary)',
    outline: 'none',
  },
  gridSelector: {
    display: 'flex',
    gap: 8,
  },
  gridBtn: {
    display: 'flex',
    alignItems: 'center',
    padding: '8px 14px',
    borderRadius: 8,
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
    boxShadow: 'var(--shadow-glow)',
  },
  loaderBox: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '4rem',
    color: 'var(--text-secondary)',
  },
  spinner: {
    width: 28,
    height: 28,
    border: '3px solid var(--border-color)',
    borderTopColor: 'var(--color-primary)',
    borderRadius: '50%',
    animation: 'spin 0.8s linear infinite',
  },
  errorBox: {
    padding: '1.5rem',
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    border: '1px solid rgba(239, 68, 68, 0.25)',
    color: '#ef4444',
    borderRadius: '12px',
    textAlign: 'center',
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
  grid: {
    display: 'grid',
    gap: '1.5rem',
  },
  card: {
    backgroundColor: 'var(--bg-secondary)',
    border: '1px solid var(--border-color)',
    borderRadius: '16px',
    padding: '1.5rem',
    display: 'flex',
    flexDirection: 'column',
    boxShadow: 'var(--shadow-sm)',
    position: 'relative',
  },
  cardHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: '1.25rem',
    borderBottom: '1px solid var(--border-color)',
    paddingBottom: '1rem',
  },
  avatar: {
    width: '46px',
    height: '46px',
    borderRadius: '12px',
    backgroundColor: 'var(--color-primary)',
    color: '#fff',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontWeight: '800',
    fontSize: '1.2rem',
  },
  meta: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
  },
  companyName: {
    fontSize: '1.1rem',
    fontWeight: '700',
    color: 'var(--text-primary)',
    margin: 0,
  },
  regNumBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    fontSize: '0.75rem',
    fontWeight: '700',
    backgroundColor: 'var(--bg-primary)',
    border: '1px solid var(--border-color)',
    color: 'var(--color-primary)',
    padding: '3px 8px',
    borderRadius: '6px',
    width: 'fit-content',
  },
  deleteBtn: {
    background: 'transparent',
    border: 'none',
    color: '#ef4444',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '8px',
    borderRadius: '8px',
    transition: 'background-color 0.2s',
  },
  detailsList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
    marginBottom: '1.25rem',
  },
  detailItem: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    fontSize: '0.88rem',
  },
  itemLabel: {
    display: 'flex',
    alignItems: 'center',
    color: 'var(--text-muted)',
    fontWeight: '500',
  },
  itemValue: {
    color: 'var(--text-primary)',
    fontWeight: '600',
  },
  billingBanner: {
    backgroundColor: 'var(--bg-primary)',
    border: '1px solid var(--border-color)',
    borderRadius: '10px',
    padding: '12px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '1rem',
  },
  billingLabel: {
    fontSize: '0.75rem',
    fontWeight: '800',
    color: 'var(--text-muted)',
    letterSpacing: '0.5px',
  },
  billingPrice: {
    fontSize: '1.3rem',
    fontWeight: '900',
    color: '#10b981',
  },
  adminNote: {
    fontSize: '0.75rem',
    borderTop: '1px solid var(--border-color)',
    paddingTop: '8px',
    marginTop: 'auto',
    display: 'flex',
    flexDirection: 'column',
    gap: '2px',
  },
  adminNoteLabel: {
    color: 'var(--text-muted)',
  },
  adminNoteVal: {
    fontWeight: '600',
    color: 'var(--text-primary)',
  },

  // Modal styles
  modalOverlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
    backdropFilter: 'blur(5px)',
  },
  modalContent: {
    backgroundColor: 'var(--bg-secondary)',
    borderRadius: '16px',
    border: '1px solid var(--border-color)',
    width: '90%',
    maxWidth: '750px',
    maxHeight: '90vh',
    display: 'flex',
    flexDirection: 'column',
    boxShadow: '0 24px 48px rgba(0, 0, 0, 0.5)',
    overflow: 'hidden',
    animation: 'spin 0s ease', // Placeholder for modal animation trigger
  },
  modalHeader: {
    padding: '1.5rem',
    borderBottom: '1px solid var(--border-color)',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    background: 'var(--bg-secondary)',
  },
  modalAvatar: {
    width: '44px',
    height: '44px',
    borderRadius: '10px',
    backgroundColor: 'var(--color-primary)',
    color: '#fff',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '1.15rem',
    fontWeight: '800',
  },
  modalTitle: {
    fontSize: '1.25rem',
    fontWeight: '800',
    color: 'var(--text-primary)',
    margin: 0,
  },
  modalRegCode: {
    fontSize: '0.75rem',
    fontWeight: '700',
    color: 'var(--color-primary)',
    letterSpacing: '0.5px',
  },
  modalCloseBtn: {
    background: 'transparent',
    border: 'none',
    color: 'var(--text-secondary)',
    cursor: 'pointer',
    padding: '8px',
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'background-color 0.2s',
  },
  modalBody: {
    padding: '1.5rem',
    overflowY: 'auto',
    display: 'flex',
    flexDirection: 'column',
    gap: '1.5rem',
  },
  modalSection: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.75rem',
  },
  sectionTitle: {
    fontSize: '0.9rem',
    fontWeight: '700',
    color: 'var(--text-secondary)',
    margin: 0,
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
    display: 'flex',
    alignItems: 'center',
  },
  infoGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
    gap: '1rem',
    background: 'var(--bg-primary)',
    border: '1px solid var(--border-color)',
    borderRadius: '12px',
    padding: '1rem 1.25rem',
  },
  infoField: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
  },
  infoLabel: {
    fontSize: '0.75rem',
    color: 'var(--text-muted)',
    fontWeight: '500',
  },
  infoValue: {
    fontSize: '0.92rem',
    color: 'var(--text-primary)',
    fontWeight: '600',
  },
  modalLoader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '2.5rem',
    color: 'var(--text-secondary)',
    background: 'var(--bg-primary)',
    border: '1px dashed var(--border-color)',
    borderRadius: '12px',
  },
  modalError: {
    padding: '1rem',
    color: '#ef4444',
    background: 'rgba(239, 68, 68, 0.08)',
    border: '1px solid rgba(239, 68, 68, 0.2)',
    borderRadius: '12px',
    fontSize: '0.9rem',
    textAlign: 'center',
  },
  modalEmpty: {
    padding: '2.5rem',
    color: 'var(--text-muted)',
    background: 'var(--bg-primary)',
    border: '1px dashed var(--border-color)',
    borderRadius: '12px',
    textAlign: 'center',
    fontSize: '0.9rem',
  },
  telecallersContainer: {
    maxHeight: '260px',
    overflowY: 'auto',
    border: '1px solid var(--border-color)',
    borderRadius: '12px',
  },
  telecallersTable: {
    width: '100%',
    borderCollapse: 'collapse',
    textAlign: 'left',
    fontSize: '0.88rem',
  },
  telecallerRow: {
    borderBottom: '1px solid var(--border-color)',
  },
  modalCloseFooterBtn: {
    backgroundColor: 'var(--bg-primary)',
    border: '1px solid var(--border-color)',
    color: 'var(--text-primary)',
    borderRadius: '8px',
    padding: '8px 16px',
    fontWeight: '600',
    cursor: 'pointer',
    transition: 'all 0.2s',
  },
  modalFooter: {
    padding: '1.25rem 1.5rem',
    borderTop: '1px solid var(--border-color)',
    display: 'flex',
    justifyContent: 'flex-end',
    background: 'var(--bg-secondary)',
  },
};

export default Companies;
