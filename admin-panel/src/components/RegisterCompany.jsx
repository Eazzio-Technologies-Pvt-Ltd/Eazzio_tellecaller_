import React, { useState, useEffect } from 'react';
import API_BASE_URL from '../config/api';
import { Building2, Briefcase, Users, Mail, Lock, CheckCircle, ArrowLeft, RefreshCw } from 'lucide-react';

const RegisterCompany = ({ onBack, theme, renewalMode = false, prefillEmail = '', onRenewalSuccess, prefillNoOfTelecallers = '' }) => {
  const isLight = theme === 'light';

  // Form Fields
  const [name, setName] = useState('');
  const [nature, setNature] = useState('');
  const [noOfTelecallers, setNoOfTelecallers] = useState(prefillNoOfTelecallers ? prefillNoOfTelecallers.toString() : '5');
  const [email, setEmail] = useState(prefillEmail);
  const [password, setPassword] = useState('');
  const [planType, setPlanType] = useState('monthly'); // 'monthly' or 'annual'

  // Status States
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successData, setSuccessData] = useState(null);

  useEffect(() => {
    if (renewalMode && prefillEmail) {
      setEmail(prefillEmail);
    }
    if (renewalMode && prefillNoOfTelecallers) {
      setNoOfTelecallers(prefillNoOfTelecallers.toString());
    }
  }, [renewalMode, prefillEmail, prefillNoOfTelecallers]);

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

    if (!renewalMode && (!name || !nature || !password)) {
      setError('Please fill in all fields.');
      setLoading(false);
      return;
    }

    if (!email || !noOfTelecallers) {
      setError('Please fill in all required fields.');
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
          ...(renewalMode ? { 'Authorization': `Bearer ${localStorage.getItem('token')}` } : {})
        },
        body: JSON.stringify({ 
          noOfTelecallers: telecallersCount,
          planType: planType
        }),
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
        description: renewalMode 
          ? `Subscription Renewal for ${telecallersCount} seats (${planType === 'annual' ? 'Annual' : 'Monthly'})`
          : `Setup Fee for ${telecallersCount} Telecallers`,
        order_id: orderData.orderId,
        handler: async function (response) {
          setLoading(true);
          try {
            // 4. Verify payment and finalize registration or renewal
            const endpoint = renewalMode 
              ? `${API_BASE_URL}/api/auth/renew-subscription-with-payment`
              : `${API_BASE_URL}/api/auth/register-company-with-payment`;

            const registerRes = await fetch(endpoint, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                ...(renewalMode ? { 'Authorization': `Bearer ${localStorage.getItem('token')}` } : {})
              },
              body: JSON.stringify({
                ...(renewalMode ? {} : { name, nature, password }),
                noOfTelecallers: telecallersCount,
                email,
                planType,
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature
              }),
            });

            const registerData = await registerRes.json();
            if (!registerRes.ok) {
              throw new Error(registerData.error || 'Failed to verify payment and process registration.');
            }

            if (renewalMode) {
              if (onRenewalSuccess) {
                onRenewalSuccess(registerData);
              }
            } else {
              setSuccessData(registerData);
            }
          } catch (err) {
            setError(err.message);
          } finally {
            setLoading(false);
          }
        },
        prefill: {
          name: renewalMode ? '' : (name + ' Admin'),
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

  const handleFreeDemoRegister = async (e) => {
    if (e) e.preventDefault();
    setError('');
    setLoading(true);

    if (!name || !nature || !password || !email || !noOfTelecallers) {
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
      const registerRes = await fetch(`${API_BASE_URL}/api/auth/register-company`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name,
          nature,
          password,
          noOfTelecallers: telecallersCount,
          email,
        }),
      });

      const registerData = await registerRes.json();
      if (!registerRes.ok) {
        throw new Error(registerData.error || 'Failed to register demo company.');
      }

      setSuccessData(registerData);
    } catch (err) {
      setError(err.message);
    } finally {
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
            <span style={styles.detailVal}>{noOfTelecallers} seats</span>
          </div>
          <div style={styles.detailRow}>
            <span style={styles.detailLabel}>Plan Subscribed:</span>
            <span style={{ ...styles.detailVal, textTransform: 'capitalize' }}>{planType} Billing</span>
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
            title={renewalMode ? "Logout" : "Go Back"}
          >
            <ArrowLeft size={20} color="var(--text-primary)" />
          </button>
        )}
        <div>
          <h2 style={{ color: 'var(--text-primary)', fontSize: '1.8rem', fontWeight: '800', margin: 0 }}>
            {renewalMode ? "Renew Subscription" : "Register Company"}
          </h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', marginTop: '4px' }}>
            {renewalMode ? "Select plan and seats to renew your portal" : "Create a new business portal on Eazzio"}
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
        {error && (
          <div style={styles.errorAlert}>
            <span>{error}</span>
          </div>
        )}

        {!renewalMode && (
          <>
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
          </>
        )}

        <div className="form-group">
          <label style={styles.label}>Number of Telecallers</label>
          <div style={styles.inputWrapper}>
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
        </div>

        {/* Plan Selection Cards */}
        <div style={{ marginBottom: '0.4rem' }}>
          <label style={styles.label}>Select Subscription Plan</label>
          <div className="plan-selection-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginTop: '6px' }}>
            {/* Card 1: Monthly */}
            <div 
              onClick={() => setPlanType('monthly')}
              style={{
                ...styles.planCard,
                borderColor: planType === 'monthly' ? '#6366f1' : 'var(--border-color)',
                backgroundColor: planType === 'monthly' ? 'rgba(99, 102, 241, 0.05)' : 'var(--bg-primary)',
              }}
            >
              <div style={{ fontSize: '0.75rem', fontWeight: '800', textTransform: 'uppercase', color: planType === 'monthly' ? '#6366f1' : 'var(--text-secondary)', marginBottom: '4px' }}>Starter Plan</div>
              <span style={{ fontSize: '1.25rem', fontWeight: '900', color: planType === 'monthly' ? '#6366f1' : 'var(--text-primary)' }}>₹59</span>
              <span style={{ fontSize: '0.75rem', fontWeight: '700', color: 'var(--text-secondary)', marginTop: '2px' }}>/ telecaller / month</span>
              <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginTop: '4px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>billed monthly</span>
            </div>

            {/* Card 2: Annual */}
            <div 
              onClick={() => setPlanType('annual')}
              style={{
                ...styles.planCard,
                borderColor: planType === 'annual' ? '#10b981' : 'var(--border-color)',
                backgroundColor: planType === 'annual' ? 'rgba(16, 185, 129, 0.05)' : 'var(--bg-primary)',
              }}
            >
              <div style={styles.popularBadge}>Best Value</div>
              <div style={{ fontSize: '0.75rem', fontWeight: '800', textTransform: 'uppercase', color: planType === 'annual' ? '#10b981' : 'var(--text-secondary)', marginBottom: '4px' }}>Growth Plan</div>
              <span style={{ fontSize: '1.25rem', fontWeight: '900', color: planType === 'annual' ? '#10b981' : 'var(--text-primary)' }}>₹49</span>
              <span style={{ fontSize: '0.75rem', fontWeight: '700', color: 'var(--text-secondary)', marginTop: '2px' }}>/ telecaller / month</span>
              <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginTop: '4px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>billed annually</span>
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
              disabled={renewalMode}
            />
          </div>
        </div>

        {!renewalMode && (
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
        )}

        <button
          type="submit"
          className="btn btn-primary"
          style={{ width: '100%', height: '46px', fontSize: '1.05rem', borderRadius: '10px', marginTop: '0.5rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
          disabled={loading}
        >
          {loading ? (
            <>
              <RefreshCw size={18} className="animate-spin" />
              Processing Payment...
            </>
          ) : (
            renewalMode ? 'Pay & Renew Subscription' : 'Complete Registration'
          )}
        </button>

        {!renewalMode && (
          <button
            type="button"
            onClick={handleFreeDemoRegister}
            className="btn btn-secondary"
            style={{ width: '100%', height: '46px', fontSize: '1.05rem', borderRadius: '10px', marginTop: '0.5rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', border: '1px solid var(--border-color)', cursor: 'pointer' }}
            disabled={loading}
          >
            {loading ? (
              <>
                <RefreshCw size={18} className="animate-spin" />
                Registering Demo...
              </>
            ) : (
              'Register Free Trial Demo (No Payment)'
            )}
          </button>
        )}
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
    disabled: {
      opacity: 0.6,
      cursor: 'not-allowed',
    }
  },
  planCard: {
    border: '2px solid var(--border-color)',
    borderRadius: '10px',
    padding: '14px',
    cursor: 'pointer',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'all 0.2s ease',
    position: 'relative',
  },
  popularBadge: {
    position: 'absolute',
    top: '-8px',
    right: '8px',
    backgroundColor: '#10b981',
    color: '#fff',
    fontSize: '0.6rem',
    fontWeight: '800',
    padding: '2px 6px',
    borderRadius: '4px',
    textTransform: 'uppercase',
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
