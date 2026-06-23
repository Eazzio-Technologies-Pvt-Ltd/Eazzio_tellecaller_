import React, { useEffect, useState, useCallback } from 'react';
import API_BASE_URL from '../config/api';
import { UserPlus, Mail, Shield, User, Lock, Trash2, Phone, FileSpreadsheet, Pencil, CreditCard, AlertTriangle } from 'lucide-react';

const Telecallers = () => {
  const [callers, setCallers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  
  // Modal Navigation
  const [modalTab, setModalTab] = useState('single'); // 'single' or 'bulk'
  
  // Form State (Single User)
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  // Bulk Upload state
  const [csvFile, setCsvFile] = useState(null);

  // Edit Form States
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editId, setEditId] = useState(null);
  const [editName, setEditName] = useState('');
  const [editEmail, setEditEmail] = useState('');

  // Edit Surcharge Payment States
  const [editCount, setEditCount] = useState(0);
  const [isPayingForEdit, setIsPayingForEdit] = useState(false);
  const [pendingEditCaller, setPendingEditCaller] = useState(null); // caller awaiting payment

  // Telecaller limit exceed payment states
  const [isPayingForLimit, setIsPayingForLimit] = useState(false);
  const [pendingCaller, setPendingCaller] = useState(null); // { name, email }
  const [limitErrorDetails, setLimitErrorDetails] = useState(null); // { allowedLimit, rate, planType }

  // Success / Error alerts
  const [formError, setFormError] = useState('');
  const [formSuccess, setFormSuccess] = useState('');

  const fetchTelecallers = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/call-logs/analytics`, {
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
      // NOTE: Passing Authorization header ensures the request is routed to this company's tenant DB
      const response = await fetch(`${API_BASE_URL}/api/auth/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          name,
          email,
          role: 'telecaller'
        })
      });

      const data = await response.json();
      
      if (!response.ok) {
        if (response.status === 403 && data.error === 'limit_exceeded') {
          // Open the Pay & Register modal
          setPendingCaller({ name, email });
          setLimitErrorDetails({
            allowedLimit: data.allowedLimit,
            rate: data.rate,
            planType: data.planType
          });
          setIsPayingForLimit(true);
          return;
        }
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

  // Dynamically load Razorpay checkout script
  const loadRazorpayScript = () => {
    return new Promise((resolve) => {
      if (window.Razorpay) { resolve(true); return; }
      const script = document.createElement('script');
      script.src = 'https://checkout.razorpay.com/v1/checkout.js';
      script.onload = () => resolve(true);
      script.onerror = () => resolve(false);
      document.body.appendChild(script);
    });
  };

  const handleStartEdit = async (caller) => {
    setFormError('');
    setFormSuccess('');

    // Fetch fresh edit_count from server
    try {
      const meRes = await fetch(`${API_BASE_URL}/api/auth/me`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      const meData = await meRes.json();
      const currentEditCount = meData.editCount || 0;
      setEditCount(currentEditCount);

      if (currentEditCount >= 3) {
        // Need to pay ₹20 before editing
        setPendingEditCaller(caller);
        setIsPayingForEdit(true);
      } else {
        // Free edits remaining — open edit modal directly
        setEditId(caller.id);
        setEditName(caller.name);
        setEditEmail(caller.email || '');
        setIsEditModalOpen(true);
      }
    } catch (err) {
      setFormError('Could not verify edit count. Please try again.');
    }
  };

  const handlePayAndEdit = async () => {
    setFormError('');
    setIsPayingForEdit(false); // hide confirm modal while paying

    try {
      const loaded = await loadRazorpayScript();
      if (!loaded) throw new Error('Failed to load Razorpay SDK. Please check your internet connection.');

      // Create ₹20 order on backend
      const orderRes = await fetch(`${API_BASE_URL}/api/auth/razorpay-edit-order`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      const orderData = await orderRes.json();
      if (!orderRes.ok) throw new Error(orderData.error || 'Failed to create payment order.');

      // Open Razorpay Checkout for ₹20 edit surcharge
      const options = {
        key: orderData.keyId,
        amount: orderData.amount,
        currency: 'INR',
        name: 'Eazzio Auto Dialer',
        description: 'Edit Surcharge — ₹20 per edit (after 3 free)',
        order_id: orderData.orderId,
        handler: function (response) {
          // Payment successful — open the edit form
          setEditId(pendingEditCaller.id);
          setEditName(pendingEditCaller.name);
          setEditEmail(pendingEditCaller.email || '');
          setFormSuccess('Payment of ₹20 successful! You may now edit.');
          setPendingEditCaller(null);
          setIsEditModalOpen(true);
        },
        prefill: { email: '' },
        theme: { color: '#6366f1' },
        modal: {
          ondismiss: function () {
            setFormError('Edit payment was cancelled. Edit not performed.');
            setPendingEditCaller(null);
          }
        }
      };

      const rzp = new window.Razorpay(options);
      rzp.open();
    } catch (err) {
      setFormError(err.message);
      setPendingEditCaller(null);
    }
  };

  const handlePayAndAddCaller = async () => {
    setFormError('');
    setIsPayingForLimit(false);

    try {
      const loaded = await loadRazorpayScript();
      if (!loaded) throw new Error('Failed to load Razorpay SDK. Please check your internet connection.');

      // Create extra telecaller order on backend
      const orderRes = await fetch(`${API_BASE_URL}/api/auth/razorpay-extra-telecaller-order`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      const orderData = await orderRes.json();
      if (!orderRes.ok) throw new Error(orderData.error || 'Failed to create payment order.');

      // Open Razorpay Checkout for extra seat charge
      const options = {
        key: orderData.keyId,
        amount: orderData.amount,
        currency: 'INR',
        name: 'Eazzio Auto Dialer',
        description: `Extra Telecaller Seat — ₹${orderData.rate} (${limitErrorDetails.planType === 'annual' ? 'Billed Annually' : 'Billed Monthly'})`,
        order_id: orderData.orderId,
        handler: async function (response) {
          setLoading(true);
          try {
            // Verify payment and add the telecaller
            const addRes = await fetch(`${API_BASE_URL}/api/auth/add-extra-telecaller-with-payment`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('token')}`
              },
              body: JSON.stringify({
                name: pendingCaller.name,
                email: pendingCaller.email,
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature
              })
            });

            const addData = await addRes.json();
            if (!addRes.ok) throw new Error(addData.error || 'Failed to verify payment and add extra telecaller.');

            setFormSuccess('Payment successful! Extra telecaller registered and seat limit increased.');
            setName('');
            setEmail('');
            setPassword('');
            fetchTelecallers();
            setTimeout(() => {
              setIsModalOpen(false);
              setFormSuccess('');
              setPendingCaller(null);
              setLimitErrorDetails(null);
            }, 2500);

          } catch (err) {
            setFormError(err.message);
          } finally {
            setLoading(false);
          }
        },
        prefill: { email: '' },
        theme: { color: '#6366f1' },
        modal: {
          ondismiss: function () {
            setFormError('Payment was cancelled. Telecaller seat was not added.');
            setPendingCaller(null);
            setLimitErrorDetails(null);
          }
        }
      };

      const rzp = new window.Razorpay(options);
      rzp.open();
    } catch (err) {
      setFormError(err.message);
      setPendingCaller(null);
      setLimitErrorDetails(null);
    }
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    setFormError('');
    setFormSuccess('');

    if (!editName || !editEmail) {
      setFormError('Please fill in all fields.');
      return;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/api/auth/telecallers/${editId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          name: editName,
          email: editEmail
        })
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to update telecaller.');
      }

      setFormSuccess('Telecaller details updated successfully!');
      fetchTelecallers();
      setTimeout(() => {
        setIsEditModalOpen(false);
        setFormSuccess('');
      }, 1500);

    } catch (err) {
      setFormError(err.message);
    }
  };

  const handleCsvSubmit = async (e) => {
    e.preventDefault();
    setFormError('');
    setFormSuccess('');

    if (!csvFile) {
      setFormError('Please select a CSV file first.');
      return;
    }

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const text = evt.target.result;
        const lines = text.split(/\r?\n/);
        if (lines.length <= 1) {
          throw new Error('CSV file is empty or missing data rows.');
        }

        const telecallers = [];
        // Detect headers like "name", "mobile", "phone", etc. to ignore first row
        const startIdx = (lines[0].toLowerCase().includes('name') || lines[0].toLowerCase().includes('mobile') || lines[0].toLowerCase().includes('phone') || lines[0].toLowerCase().includes('email')) ? 1 : 0;

        for (let i = startIdx; i < lines.length; i++) {
          const line = lines[i].trim();
          if (!line) continue;

          // Simple comma parsing (Name,Mobile)
          const cols = line.split(',');
          if (cols.length < 2) continue;

          const tcName = cols[0].trim().replace(/^["']|["']$/g, '');
          const tcEmail = cols[1].trim().replace(/^["']|["']$/g, '');

          if (tcName && tcEmail) {
            telecallers.push({ name: tcName, email: tcEmail });
          }
        }

        if (telecallers.length === 0) {
          throw new Error('No valid telecallers found in the CSV. Format should be: Name,MobileNumber');
        }

        const response = await fetch(`${API_BASE_URL}/api/auth/register-bulk`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          },
          body: JSON.stringify({ telecallers })
        });

        const data = await response.json();
        if (!response.ok) {
          throw new Error(data.error || 'Failed to import CSV telecallers.');
        }

        let msg = `Successfully registered ${data.registeredCount} telecallers.`;
        if (data.errors && data.errors.length > 0) {
          msg += ` (${data.errors.length} duplicates skipped).`;
        }
        
        setFormSuccess(msg);
        setCsvFile(null);
        fetchTelecallers();
        setTimeout(() => {
          setIsModalOpen(false);
          setFormSuccess('');
          setModalTab('single');
        }, 2500);

      } catch (err) {
        setFormError(err.message);
      }
    };

    reader.onerror = () => {
      setFormError('Failed to read the uploaded CSV file.');
    };

    reader.readAsText(csvFile);
  };

  const handleDeleteCaller = async (id, callerName) => {
    const confirmed = window.confirm(`Are you sure you want to delete telecaller "${callerName}"?\nTheir allotted contacts will be unassigned and returned to the pool.`);
    if (!confirmed) return;

    try {
      const response = await fetch(`${API_BASE_URL}/api/auth/${id}`, {
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
        <button className="btn btn-primary" onClick={() => { setIsModalOpen(true); setModalTab('single'); setFormError(''); setFormSuccess(''); }}>
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
                  <th>Break Taken (Idle)</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {callers.length === 0 ? (
                  <tr>
                    <td colSpan="7" style={{ textAlign: 'center', color: '#6b7280' }}>
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
                      <td style={{ color: 'var(--text-secondary)' }}>
                        Break: {formatDuration(caller.break_time)} <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>(Idle: {formatDuration(caller.idle_time)})</span>
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: '4px' }}>
                          <button 
                            className="btn btn-secondary" 
                            style={{ width: '32px', height: '32px', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(124, 58, 237, 0.05)', border: '1px solid rgba(124, 58, 237, 0.1)' }}
                            title="Edit Telecaller"
                            onClick={() => handleStartEdit(caller)}
                          >
                            <Pencil size={16} color="#7c3aed" />
                          </button>
                          <button 
                            className="btn btn-secondary" 
                            style={styles.deleteButton}
                            title="Delete Telecaller"
                            onClick={() => handleDeleteCaller(caller.id, caller.name)}
                          >
                            <Trash2 size={16} color="#ef4444" />
                          </button>
                        </div>
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
          <div className="modal-content" style={{ maxWidth: '500px' }}>
            <h2 style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '0.5rem' }}>
              <UserPlus size={20} color="#6366f1" />
              Register New Telecallers
            </h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '1.25rem' }}>
              Add account profiles to your company's tenant telecalling system.
            </p>

            {/* Selector Tabs */}
            <div style={styles.modalTabs}>
              <button 
                type="button" 
                onClick={() => { setModalTab('single'); setFormError(''); setFormSuccess(''); }}
                style={{ ...styles.modalTab, ...(modalTab === 'single' ? styles.modalTabActive : {}) }}
              >
                <User size={16} style={{ marginRight: '6px' }} />
                Single Account
              </button>
              <button 
                type="button" 
                onClick={() => { setModalTab('bulk'); setFormError(''); setFormSuccess(''); }}
                style={{ ...styles.modalTab, ...(modalTab === 'bulk' ? styles.modalTabActive : {}) }}
              >
                <FileSpreadsheet size={16} style={{ marginRight: '6px' }} />
                Bulk CSV Upload
              </button>
            </div>

            {modalTab === 'single' ? (
              <form onSubmit={handleAddCaller}>
                {formError && (
                  <div style={styles.errorBanner}>{formError}</div>
                )}
                {formSuccess && (
                  <div style={styles.successBanner}>{formSuccess}</div>
                )}

                <div className="form-group" style={{ marginBottom: '1.25rem' }}>
                  <label>Full Name</label>
                  <div style={styles.inputWrapper}>
                    <User size={16} style={styles.inputIcon} />
                    <input 
                      type="text" 
                      placeholder="John Doe" 
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      style={styles.inputWithIcon}
                      required
                    />
                  </div>
                </div>

                <div className="form-group" style={{ marginBottom: '1.5rem' }}>
                  <label>Mobile Number (Login ID)</label>
                  <div style={styles.inputWrapper}>
                    <Phone size={16} style={styles.inputIcon} />
                    <input 
                      type="text" 
                      placeholder="e.g. 9876543210" 
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      style={styles.inputWithIcon}
                      required
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
            ) : (
              <form onSubmit={handleCsvSubmit}>
                {formError && (
                  <div style={styles.errorBanner}>{formError}</div>
                )}
                {formSuccess && (
                  <div style={styles.successBanner}>{formSuccess}</div>
                )}

                <div className="form-group" style={{ marginBottom: '1.5rem' }}>
                  <label>Select CSV File</label>
                  <input 
                    type="file" 
                    accept=".csv"
                    onChange={(e) => setCsvFile(e.target.files[0])}
                    style={styles.fileInput}
                    required
                  />
                  <div style={styles.csvHelpBox}>
                    <p style={{ margin: 0, fontWeight: '700', color: 'var(--text-primary)', marginBottom: '4px' }}>CSV Formatting Guideline:</p>
                    <p style={{ margin: 0 }}>Column 1: <strong>Name</strong> (Full Name)</p>
                    <p style={{ margin: 0 }}>Column 2: <strong>Mobile</strong> (10-digit number)</p>
                    <p style={{ marginTop: '6px', fontStyle: 'italic', margin: 0 }}>Example row: <code>Ramesh Kumar,9876543210</code></p>
                  </div>
                </div>

                <div className="modal-actions">
                  <button type="button" className="btn btn-secondary" onClick={() => setIsModalOpen(false)}>
                    Cancel
                  </button>
                  <button type="submit" className="btn btn-primary">
                    Upload & Import
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Modal - Edit Telecaller */}
      {isEditModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '500px' }}>
            <h2 style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '0.5rem' }}>
              <Pencil size={20} color="#6366f1" />
              Edit Telecaller Details
            </h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '1.25rem' }}>
              Update the name or login mobile number for this telecaller.
            </p>

            <form onSubmit={handleEditSubmit}>
              {formError && (
                <div style={styles.errorBanner}>{formError}</div>
              )}
              {formSuccess && (
                <div style={styles.successBanner}>{formSuccess}</div>
              )}

              <div className="form-group" style={{ marginBottom: '1.25rem' }}>
                <label>Full Name</label>
                <div style={styles.inputWrapper}>
                  <User size={16} style={styles.inputIcon} />
                  <input 
                    type="text" 
                    placeholder="John Doe" 
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    style={styles.inputWithIcon}
                    required
                  />
                </div>
              </div>

              <div className="form-group" style={{ marginBottom: '1.5rem' }}>
                <label>Mobile Number (Login ID)</label>
                <div style={styles.inputWrapper}>
                  <Phone size={16} style={styles.inputIcon} />
                  <input 
                    type="text" 
                    placeholder="e.g. 9876543210" 
                    value={editEmail}
                    onChange={(e) => setEditEmail(e.target.value)}
                    style={styles.inputWithIcon}
                    required
                  />
                </div>
              </div>

              <div className="modal-actions">
                <button type="button" className="btn btn-secondary" onClick={() => setIsEditModalOpen(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Payment Confirmation Modal - Edit Surcharge */}
      {isPayingForEdit && pendingEditCaller && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '420px' }}>
            <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
              <div style={{ 
                width: '64px', height: '64px', borderRadius: '50%', 
                backgroundColor: 'rgba(245, 158, 11, 0.12)',
                border: '2px solid rgba(245, 158, 11, 0.3)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                margin: '0 auto 1rem auto'
              }}>
                <AlertTriangle size={30} color="#f59e0b" />
              </div>
              <h2 style={{ color: 'var(--text-primary)', fontSize: '1.3rem', fontWeight: '800', margin: 0 }}>
                Edit Surcharge Required
              </h2>
            </div>

            <div style={{
              backgroundColor: 'rgba(245, 158, 11, 0.08)',
              border: '1px solid rgba(245, 158, 11, 0.25)',
              borderRadius: '10px',
              padding: '1rem',
              marginBottom: '1.25rem'
            }}>
              <p style={{ color: 'var(--text-primary)', fontSize: '0.9rem', margin: 0, lineHeight: '1.5' }}>
                You have used all <strong>3 free edits</strong> for this subscription month.
                Each additional edit costs <strong style={{ color: '#f59e0b' }}>&#8377;20</strong>.
              </p>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.82rem', marginTop: '8px', margin: '8px 0 0 0' }}>
                Editing: <strong style={{ color: 'var(--text-primary)' }}>{pendingEditCaller.name}</strong>
              </p>
            </div>

            <div style={{
              backgroundColor: 'var(--bg-primary)',
              border: '1px solid var(--border-color)',
              borderRadius: '10px',
              padding: '1rem',
              marginBottom: '1.5rem',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <span style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Edit Surcharge</span>
              <span style={{ color: '#10b981', fontWeight: '800', fontSize: '1.2rem' }}>&#8377;20</span>
            </div>

            <div className="modal-actions">
              <button 
                type="button" 
                className="btn btn-secondary" 
                onClick={() => { setIsPayingForEdit(false); setPendingEditCaller(null); }}
              >
                Cancel
              </button>
              <button 
                type="button" 
                className="btn btn-primary" 
                onClick={handlePayAndEdit}
                style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
              >
                <CreditCard size={16} />
                Pay &#8377;20 &amp; Edit
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Payment Confirmation Modal - Extra Telecaller Limit */}
      {isPayingForLimit && pendingCaller && limitErrorDetails && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '420px' }}>
            <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
              <div style={{ 
                width: '64px', height: '64px', borderRadius: '50%', 
                backgroundColor: 'rgba(99, 102, 241, 0.12)',
                border: '2px solid rgba(99, 102, 241, 0.3)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                margin: '0 auto 1rem auto'
              }}>
                <UserPlus size={30} color="#6366f1" />
              </div>
              <h2 style={{ color: 'var(--text-primary)', fontSize: '1.3rem', fontWeight: '800', margin: 0 }}>
                Seat Limit Reached
              </h2>
            </div>

            <div style={{
              backgroundColor: 'rgba(99, 102, 241, 0.08)',
              border: '1px solid rgba(99, 102, 241, 0.25)',
              borderRadius: '10px',
              padding: '1rem',
              marginBottom: '1.25rem'
            }}>
              <p style={{ color: 'var(--text-primary)', fontSize: '0.9rem', margin: 0, lineHeight: '1.5' }}>
                You have reached your limit of <strong>{limitErrorDetails.allowedLimit} telecallers</strong>.
                Adding another telecaller requires purchasing an additional seat under your <strong style={{ textTransform: 'capitalize' }}>{limitErrorDetails.planType} plan</strong>.
              </p>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.82rem', marginTop: '8px', margin: '8px 0 0 0' }}>
                Registering: <strong style={{ color: 'var(--text-primary)' }}>{pendingCaller.name} ({pendingCaller.email})</strong>
              </p>
            </div>

            <div style={{
              backgroundColor: 'var(--bg-primary)',
              border: '1px solid var(--border-color)',
              borderRadius: '10px',
              padding: '1rem',
              marginBottom: '1.5rem',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <span style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Extra Seat Charge</span>
              <span style={{ color: '#10b981', fontWeight: '800', fontSize: '1.2rem' }}>&#8377;{limitErrorDetails.rate}</span>
            </div>

            <div className="modal-actions">
              <button 
                type="button" 
                className="btn btn-secondary" 
                onClick={() => { setIsPayingForLimit(false); setPendingCaller(null); setLimitErrorDetails(null); }}
              >
                Cancel
              </button>
              <button 
                type="button" 
                className="btn btn-primary" 
                onClick={handlePayAndAddCaller}
                style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
              >
                <CreditCard size={16} />
                Pay &#8377;{limitErrorDetails.rate} &amp; Add Seat
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Global error/success display for out-of-modal notifications */}
      {formError && !isEditModalOpen && !isPayingForEdit && (
        <div style={{ 
          ...styles.errorBanner, 
          position: 'fixed', bottom: '24px', right: '24px', 
          maxWidth: '360px', zIndex: 9999,
          boxShadow: '0 4px 20px rgba(0,0,0,0.2)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between'
        }}>
          <span>{formError}</span>
          <button 
            onClick={() => setFormError('')} 
            style={{ marginLeft: '12px', background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontWeight: 700, fontSize: '1rem' }}
          >&#x2715;</button>
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
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
    color: '#ef4444',
    padding: '0.75rem',
    borderRadius: '8px',
    marginBottom: '1rem',
    fontSize: '0.85rem',
    border: '1px solid rgba(239, 68, 68, 0.25)',
  },
  successBanner: {
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    color: '#10b981',
    padding: '0.75rem',
    borderRadius: '8px',
    marginBottom: '1rem',
    fontSize: '0.85rem',
    border: '1px solid rgba(16, 185, 129, 0.25)',
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
  },
  modalTabs: {
    display: 'flex',
    borderBottom: '1px solid var(--border-color)',
    marginBottom: '1.5rem',
    gap: '8px',
  },
  modalTab: {
    flex: 1,
    padding: '10px 0',
    background: 'none',
    border: 'none',
    borderBottom: '2px solid transparent',
    color: 'var(--text-secondary)',
    fontWeight: '600',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '0.9rem',
    transition: 'all 0.2s',
  },
  modalTabActive: {
    borderBottomColor: '#6366f1',
    color: '#6366f1',
  },
  fileInput: {
    width: '100%',
    padding: '12px 16px',
    borderRadius: '8px',
    border: '1px dashed var(--border-color)',
    backgroundColor: 'var(--bg-primary)',
    color: 'var(--text-primary)',
    cursor: 'pointer',
    outline: 'none',
  },
  csvHelpBox: {
    marginTop: '10px',
    padding: '12px',
    backgroundColor: 'var(--bg-primary)',
    border: '1px solid var(--border-color)',
    borderRadius: '8px',
    fontSize: '0.8rem',
    color: 'var(--text-secondary)',
    lineHeight: '1.4',
  },
};

export default Telecallers;
