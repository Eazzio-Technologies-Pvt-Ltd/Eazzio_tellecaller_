import React, { useState } from 'react';
import API_BASE_URL from '../config/api';
import { Building2, Briefcase, Users, Mail, Lock, CheckCircle, ArrowLeft, RefreshCw } from 'lucide-react';

const RegisterCompany = ({ onBack, theme }) => {
  const isLight = theme === 'light';

  // Form Fields
  const [name, setName] = useState('');
  const [nature, setNature] = useState('');
  const [noOfTelecallers, setNoOfTelecallers] = useState('5');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  // Status States
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successData, setSuccessData] = useState(null);

  const loadRazorpayScript = () => {
    return new Promise((resolve) => {
      if (window.Razorpay) {
        resolve(true);
        return;
      }
      const script = document.createElement('script');
      script.src = 'https://checkout.razorpay.com/v1/checkout.js';
      script.onload = () => resolve(true);
      script.onerror = () => resolve(false);
      document.body.appendChild(script);
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    if (!name || !nature || !email || !password || !noOfTelecallers) {
      setError('Please fill in all fields.');
      setLoading(false);
      return;
    }

    const telecallersCount = parseInt(noOfTelecallers) || 0;
    if (telecallersCount <= 0) {
      setError('Please enter a valid number of telecallers.');
      setLoading(false);
      return;
    }

    try {
      // 1. Load Razorpay script
      const loaded = await loadRazorpayScript();
      if (!loaded) {
        throw new Error('Failed to load Razorpay SDK. Please check your internet connection.');
      }

      // 2. Create Razorpay order on backend
      const orderRes = await fetch(`${API_BASE_URL}/api/auth/razorpay-order`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ noOfTelecallers: telecallersCount }),
      });

      const orderData = await orderRes.json();
      if (!orderRes.ok) {
        throw new Error(orderData.error || 'Failed to create payment order.');
      }

      // 3. Open Razorpay Checkout Modal
      const options = {
        key: orderData.keyId,
        amount: orderData.amount,
        currency: 'INR',
        name: 'Eazzio Auto Dialer',
        description: `Setup Fee for ${telecallersCount} Telecallers`,
        order_id: orderData.orderId,
        handler: async function (response) {
          setLoading(true);
          try {
            // 4. Verify payment and finalize registration
            const registerRes = await fetch(`${API_BASE_URL}/api/auth/register-company-with-payment`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                name,
                nature,
                noOfTelecallers: telecallersCount,
                email,
                password,
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature
              }),
            });

            const registerData = await registerRes.json();
            if (!registerRes.ok) {
              throw new Error(registerData.error || 'Failed to verify payment and register company.');
            }

            setSuccessData(registerData);
          } catch (err) {
            setError(err.message);
          } finally {
            setLoading(false);
          }
        },
        prefill: {
          name: name + ' Admin',
          email: email
        },
        theme: {
          color: '#6366f1'
        },
        modal: {
          ondismiss: function () {
            setLoading(false);
            setError('Payment was cancelled.');
          }
        }
      };

      const rzp = new window.Razorpay(options);
      rzp.open();

    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  };

  // Render Success State
  if (successData) {
    return (
      <div style={styles.successCard}>
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <CheckCircle size={64} color="#10b981" style={{ margin: '0 auto 1.5rem auto' }} />
          <h2 style={{ color: 'var(--text-primary)', fontSize: '1.8rem', fontWeight: '800' }}>Registration Successful!</h2>
          <p style={{ color: 'var(--text-secondary)', marginTop: '8px' }}>Your company has been registered on the Eazzio platform.</p>
        </div>

        <div style={styles.codeContainer}>
          <span style={styles.codeLabel}>YOUR UNIQUE COMPANY CODE</span>
          <span style={styles.codeValue}>{successData.regNum}</span>
          <p style={styles.codeHelp}>
            Please save this code. Telecallers will need this code to log into the mobile application.
          </p>
        </div>

        <div style={styles.detailsBox}>
          <div style={styles.detailRow}>
            <span style={styles.detailLabel}>Company Name:</span>
            <span style={styles.detailVal}>{name}</span>
          </div>
          <div style={styles.detailRow}>
            <span style={styles.detailLabel}>Admin Email:</span>
            <span style={styles.detailVal}>{email}</span>
          </div>
          <div style={styles.detailRow}>
            <span style={styles.detailLabel}>Nature of Business:</span>
            <span style={styles.detailVal}>{nature}</span>
          </div>
          <div style={styles.detailRow}>
            <span style={styles.detailLabel}>Telecallers Count:</span>
            <span style={styles.detailVal}>{noOfTelecallers}</span>
          </div>
        </div>

        <button 
          onClick={onBack} 
          className="btn btn-primary" 
          style={{ width: '100%', height: '56px', fontSize: '1.1rem', borderRadius: '12px', marginTop: '1rem' }}
        >
          Return to Login
        </button>
      </div>
    );
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '1.5rem' }}>
        {onBack && (
          <button 
            onClick={onBack} 
            style={styles.backBtn}
            title="Go Back"
          >
            <ArrowLeft size={20} color="var(--text-primary)" />
          </button>
        )}
        <div>
          <h2 style={{ color: 'var(--text-primary)', fontSize: '1.8rem', fontWeight: '800', margin: 0 }}>Register Company</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', marginTop: '4px' }}>Create a new business portal on Eazzio</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
        {error && (
          <div style={styles.errorAlert}>
            <span>{error}</span>
          </div>
        )}

        <div className="form-group">
          <label style={styles.label}>Company Name</label>
          <div style={styles.inputWrapper}>
            <Briefcase size={18} style={styles.inputIcon} />
            <input 
              type="text" 
              placeholder="e.g. Acme Corporation" 
              value={name}
              onChange={(e) => setName(e.target.value)}
              style={styles.input}
              required
            />
          </div>
        </div>

        <div className="form-group">
          <label style={styles.label}>Nature of Company</label>
          <div style={styles.inputWrapper}>
            <Building2 size={18} style={styles.inputIcon} />
            <input 
              type="text" 
              placeholder="e.g. Sales, Real Estate, Support" 
              value={nature}
              onChange={(e) => setNature(e.target.value)}
              style={styles.input}
              required
            />
          </div>
        </div>

        <div className="form-group">
          <label style={styles.label}>Number of Telecallers</label>
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            <div style={{ ...styles.inputWrapper, flex: 1 }}>
              <Users size={18} style={styles.inputIcon} />
              <input 
                type="number" 
                min="1"
                placeholder="e.g. 5" 
                value={noOfTelecallers}
                onChange={(e) => setNoOfTelecallers(e.target.value)}
                style={styles.input}
                required
              />
            </div>
            <div style={styles.priceTag}>
              <span style={{ fontSize: '1.05rem', fontWeight: '800', color: '#10B981' }}>₹49</span>
              <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', marginLeft: '2px' }}>/ telecaller</span>
            </div>
          </div>
        </div>

        <div className="form-group">
          <label style={styles.label}>Admin Email Address</label>
          <div style={styles.inputWrapper}>
            <Mail size={18} style={styles.inputIcon} />
            <input 
              type="email" 
              placeholder="admin@yourcompany.com" 
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              style={styles.input}
              required
            />
          </div>
        </div>

        <div className="form-group">
          <label style={styles.label}>Admin Password</label>
          <div style={styles.inputWrapper}>
            <Lock size={18} style={styles.inputIcon} />
            <input 
              type="password" 
              placeholder="Enter admin password" 
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={styles.input}
              required
            />
          </div>
        </div>

        <button 
          type="submit" 
          className="btn btn-primary" 
          style={{ width: '100%', height: '46px', fontSize: '1.05rem', borderRadius: '10px', marginTop: '0.5rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
          disabled={loading}
        >
          {loading ? (
            <>
              <RefreshCw size={18} className="animate-spin" />
              Registering Business...
            </>
          ) : (
            'Complete Registration'
          )}
        </button>
      </form>

      <style>{`
        .animate-spin {
          animation: spin 1s linear infinite;
        }
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};

const styles = {
  backBtn: {
    background: 'var(--bg-primary)',
    border: '1px solid var(--border-color)',
    borderRadius: '8px',
    width: '36px',
    height: '36px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    transition: 'all 0.2s',
  },
  label: {
    fontSize: '0.85rem',
    fontWeight: '600',
    marginBottom: '4px',
    color: 'var(--text-secondary)',
    display: 'block',
  },
  inputWrapper: {
    position: 'relative',
    display: 'flex',
    alignItems: 'center',
    width: '100%',
  },
  inputIcon: {
    position: 'absolute',
    left: '12px',
    color: 'var(--text-secondary)',
  },
  input: {
    paddingLeft: '2.5rem',
    paddingRight: '0.75rem',
    paddingTop: '0.45rem',
    paddingBottom: '0.45rem',
    fontSize: '0.92rem',
    width: '100%',
    height: '40px',
    borderRadius: '8px',
    border: '1px solid var(--border-color)',
    backgroundColor: 'var(--bg-primary)',
    color: 'var(--text-primary)',
    outline: 'none',
    transition: 'all 0.2s',
  },
  priceTag: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '0 12px',
    height: '40px',
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    border: '1px solid rgba(16, 185, 129, 0.25)',
    borderRadius: '8px',
    flexShrink: 0,
  },
  errorAlert: {
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
    border: '1px solid rgba(239, 68, 68, 0.25)',
    color: '#ef4444',
    padding: '0.5rem 0.75rem',
    borderRadius: '6px',
    fontSize: '0.85rem',
  },
  successCard: {
    animation: 'fadeIn 0.3s ease',
  },
  codeContainer: {
    backgroundColor: 'var(--bg-primary)',
    border: '2px dashed var(--color-primary)',
    borderRadius: '10px',
    padding: '1.25rem',
    textAlign: 'center',
    marginBottom: '1.25rem',
  },
  codeLabel: {
    display: 'block',
    fontSize: '0.7rem',
    fontWeight: '800',
    color: 'var(--text-muted)',
    letterSpacing: '1px',
    marginBottom: '6px',
  },
  codeValue: {
    display: 'block',
    fontSize: '2rem',
    fontWeight: '900',
    color: 'var(--color-primary)',
    letterSpacing: '2px',
    fontFamily: 'monospace',
  },
  codeHelp: {
    fontSize: '0.75rem',
    color: 'var(--text-secondary)',
    marginTop: '8px',
    lineHeight: '1.3',
  },
  detailsBox: {
    backgroundColor: 'var(--bg-primary)',
    border: '1px solid var(--border-color)',
    borderRadius: '10px',
    padding: '1rem',
    marginBottom: '1.25rem',
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  detailRow: {
    display: 'flex',
    justifyContent: 'space-between',
    fontSize: '0.85rem',
  },
  detailLabel: {
    color: 'var(--text-muted)',
    fontWeight: '500',
  },
  detailVal: {
    color: 'var(--text-primary)',
    fontWeight: '600',
  },
};

export default RegisterCompany;
