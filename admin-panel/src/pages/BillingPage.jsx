import React, { useEffect, useState } from 'react';
import API_BASE_URL from '../config/api';
import { IndianRupee, RefreshCw, Building, Users, Calendar, ArrowUpRight, ShieldAlert, FileText, Printer } from 'lucide-react';

const BillingPage = ({ theme, user }) => {
  const isLight = theme === 'light';
  const isCompanyAdmin = user && user.companyRegNum !== null;

  // Superadmin States
  const [companies, setCompanies] = useState([]);
  const [stats, setStats] = useState({ totalCompanies: 0, totalTelecallers: 0, totalCharge: 0 });

  // Company Admin States
  const [telecallers, setTelecallers] = useState([]);
  const [companyBill, setCompanyBill] = useState(0);
  const [editCount, setEditCount] = useState(0);
  const [planType, setPlanType] = useState('monthly');
  const [noOfTelecallers, setNoOfTelecallers] = useState(0);
  const [subscriptionStart, setSubscriptionStart] = useState(null);
  const [subscriptionEnd, setSubscriptionEnd] = useState(null);
  const [pricePerTelecaller, setPricePerTelecaller] = useState(59);

  // Common States
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const fetchBillingData = async () => {
    setRefreshing(true);
    try {
      const headers = {
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      };

      if (isCompanyAdmin) {
        // Company Admin: Fetch billing details including edit count and telecaller list
        const res = await fetch(`${API_BASE_URL}/api/auth/company-billing`, { headers });
        if (!res.ok) {
          throw new Error('Failed to retrieve billing details.');
        }
        const data = await res.json();
        setTelecallers(data.telecallers || []);
        const edits = data.editCount || 0;
        setEditCount(edits);

        const seats = data.noOfTelecallers || 0;
        const plan = data.planType || 'monthly';
        const rate = data.pricePerTelecaller || (plan === 'annual' ? 49 : 59);

        setPlanType(plan);
        setNoOfTelecallers(seats);
        setSubscriptionStart(data.subscriptionStart || null);
        setSubscriptionEnd(data.subscriptionEnd || null);
        setPricePerTelecaller(rate);
        
        const seatsBill = plan === 'annual' ? seats * rate * 12 : seats * rate;
        const editSurcharge = Math.max(0, edits - 3) * 20;
        setCompanyBill(seatsBill + editSurcharge);
      } else {
        // Superadmin: Fetch global metrics and all registered companies
        const [statsRes, companiesRes] = await Promise.all([
          fetch(`${API_BASE_URL}/api/auth/superadmin-stats`, { headers }),
          fetch(`${API_BASE_URL}/api/auth/companies`, { headers })
        ]);

        if (!statsRes.ok || !companiesRes.ok) {
          throw new Error('Failed to retrieve billing analytics.');
        }

        const statsData = await statsRes.json();
        const companiesData = await companiesRes.json();

        setStats(statsData);
        setCompanies(companiesData);
      }
    } catch (err) {
      console.error(err);
      setError(err.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchBillingData();
  }, [isCompanyAdmin]);

  const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const getBillingCycle = () => {
    const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    const d = new Date();
    return `${months[d.getMonth()]} ${d.getFullYear()}`;
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div style={styles.page}>
      {/* Header */}
      <div className="no-print" style={styles.header}>
        <div>
          <h1 style={styles.title}>
            <IndianRupee size={26} style={{ marginRight: 10, color: '#f59e0b' }} />
            {isCompanyAdmin ? 'Company Subscriptions & Billing' : 'Billing & Revenue Dashboard'}
          </h1>
          <p style={styles.subtitle}>
            {isCompanyAdmin 
              ? `Account billing breakdown for Registration Code: ${user.companyRegNum}` 
              : 'Financial audit of registered companies and subscription revenues'}
          </p>
        </div>

        <button 
          onClick={fetchBillingData} 
          style={styles.refreshBtn}
          disabled={refreshing}
          title="Refresh Financials"
        >
          <RefreshCw size={18} className={refreshing ? 'animate-spin' : ''} />
          <span style={{ marginLeft: '8px' }}>Refresh</span>
        </button>
      </div>

      {loading ? (
        <div style={styles.loaderBox}>
          <div style={styles.spinner} />
          <span style={{ marginLeft: 12 }}>Loading financial records...</span>
        </div>
      ) : error ? (
        <div style={styles.errorBox}>
          <span>Error loading billing data: {error}</span>
        </div>
      ) : isCompanyAdmin ? (
        // ── COMPANY ADMIN BILLING VIEW ──────────────────────────────────────────
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {/* Billing Overview stats */}
          <div className="grid-stats no-print" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.5rem' }}>
            <div className="glass-card stat-card" style={{ ...styles.statCard, borderLeft: '4px solid #10b981' }}>
              <div style={{ width: '48px', height: '48px', borderRadius: '50%', backgroundColor: '#10b981', color: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <IndianRupee size={22} />
              </div>
              <div className="stat-info">
                <span className="stat-label" style={{ color: 'var(--text-muted)', fontSize: '0.75rem', fontWeight: '600' }}>CURRENT BILL CYCLE TOTAL</span>
                <span className="stat-value" style={{ fontSize: '1.8rem', fontWeight: '900', color: '#10b981', marginTop: '2px' }}>
                  ₹{companyBill}
                </span>
              </div>
            </div>

            <div className="glass-card stat-card" style={{ ...styles.statCard, borderLeft: '4px solid #6366f1' }}>
              <div style={{ width: '48px', height: '48px', borderRadius: '50%', backgroundColor: '#6366f1', color: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Users size={22} />
              </div>
              <div className="stat-info">
                <span className="stat-label" style={{ color: 'var(--text-muted)', fontSize: '0.75rem', fontWeight: '600' }}>REGISTERED SEAT LIMIT</span>
                <span className="stat-value" style={{ fontSize: '1.8rem', fontWeight: '900', color: '#6366f1', marginTop: '2px' }}>
                  {noOfTelecallers} seats
                </span>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                  {telecallers.length} active telecallers registered
                </span>
              </div>
            </div>

            <div className="glass-card stat-card" style={{ ...styles.statCard, borderLeft: '4px solid #f59e0b' }}>
              <div style={{ width: '48px', height: '48px', borderRadius: '50%', backgroundColor: '#f59e0b', color: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <FileText size={22} />
              </div>
              <div className="stat-info">
                <span className="stat-label" style={{ color: 'var(--text-muted)', fontSize: '0.75rem', fontWeight: '600' }}>ACTIVE BILLING PLAN</span>
                <span className="stat-value" style={{ fontSize: '1.6rem', fontWeight: '900', color: '#f59e0b', marginTop: '2px' }}>
                  {planType === 'annual' ? 'Starter Plan' : 'Growth Plan'}
                </span>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                  ₹{pricePerTelecaller} / seat / {planType === 'annual' ? 'year' : 'month'}
                </span>
              </div>
            </div>
          </div>

          {/* Premium Invoice Statement */}
          <div className="glass-card invoice-card" style={styles.invoiceCard}>
            <div style={styles.invoiceHeader}>
              <div>
                <span style={styles.invoiceBadge}>CURRENT INVOICE</span>
                <h2 style={{ margin: '8px 0 4px 0', fontSize: '1.4rem', color: 'var(--text-primary)' }}>
                  Statement for {user.name.replace(' Admin', '')}
                </h2>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  INVOICE CODE: INV-{user.companyRegNum}-{new Date().getMonth() + 1}{new Date().getFullYear()}
                </span>
              </div>
              <button onClick={handlePrint} className="no-print" style={styles.printBtn} title="Print Invoice">
                <Printer size={16} />
                <span>Print Statement</span>
              </button>
            </div>

            <div style={styles.invoiceBody}>
              <div style={styles.invoiceRow}>
                <span style={styles.invLabel}>Billing Period:</span>
                <span style={styles.invVal}>{getBillingCycle()}</span>
              </div>
              <div style={styles.invoiceRow}>
                <span style={styles.invLabel}>Subscription Start:</span>
                <span style={styles.invVal}>{formatDate(subscriptionStart)}</span>
              </div>
              <div style={styles.invoiceRow}>
                <span style={styles.invLabel}>Subscription End:</span>
                <span style={{ ...styles.invVal, fontWeight: '700', color: '#6366f1' }}>{formatDate(subscriptionEnd)}</span>
              </div>
              <div style={styles.invoiceRow}>
                <span style={styles.invLabel}>Payment Status:</span>
                <span style={{ ...styles.invVal, color: '#10b981', fontWeight: '700' }}>Active Subscription</span>
              </div>
            </div>

            {/* Itemized Table */}
            <div style={{ marginTop: '1.5rem', borderTop: '1px solid var(--border-color)', paddingTop: '1.5rem' }}>
              <h3 style={{ fontSize: '0.95rem', fontWeight: '700', color: 'var(--text-primary)', marginBottom: '1rem' }}>Itemized Charges</h3>
              <table style={styles.table}>
                <thead>
                  <tr style={{ backgroundColor: 'var(--bg-primary)' }}>
                    <th style={styles.th}>Description</th>
                    <th style={styles.th}>Rate</th>
                    <th style={styles.th}>Quantity</th>
                    <th style={{ ...styles.th, textAlign: 'right' }}>Total</th>
                  </tr>
                </thead>
                <tbody>
                  <tr style={styles.tr}>
                    <td style={{ ...styles.td, fontWeight: '700', color: 'var(--text-primary)' }}>
                      {planType === 'annual' ? 'Starter Plan Telecaller Seats (Annual Billing — 1 Year)' : 'Growth Plan Telecaller Seats (Monthly Billing)'}
                    </td>
                    <td style={styles.td}>₹{pricePerTelecaller} / seat / {planType === 'annual' ? 'year' : 'month'}</td>
                    <td style={styles.td}>{noOfTelecallers} seats purchased</td>
                    <td style={{ ...styles.td, textAlign: 'right', fontWeight: '800', color: '#10b981' }}>
                      ₹{planType === 'annual' ? noOfTelecallers * pricePerTelecaller * 12 : noOfTelecallers * pricePerTelecaller}
                    </td>
                  </tr>
                  <tr style={styles.tr}>
                    <td style={{ ...styles.td, fontWeight: '700', color: 'var(--text-primary)' }}>
                      Telecaller Mobile Number Edits (after 3 free)
                    </td>
                    <td style={styles.td}>₹20 / edit</td>
                    <td style={styles.td}>{editCount} edits ({Math.max(0, editCount - 3)} billable)</td>
                    <td style={{ ...styles.td, textAlign: 'right', fontWeight: '800', color: '#10b981' }}>
                      ₹{Math.max(0, editCount - 3) * 20}
                    </td>
                  </tr>
                  <tr style={{ border: 'none' }}>
                    <td colSpan="3" style={{ ...styles.td, textAlign: 'right', fontWeight: '700', color: 'var(--text-secondary)', border: 'none', paddingTop: '1.5rem' }}>
                      Total Subscription Cost (including surcharges):
                    </td>
                    <td style={{ ...styles.td, textAlign: 'right', fontSize: '1.25rem', fontWeight: '900', color: '#10b981', border: 'none', paddingTop: '1.5rem' }}>
                      ₹{companyBill}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* List of active telecaller accounts charged */}
            <div style={{ marginTop: '2rem', borderTop: '1px solid var(--border-color)', paddingTop: '1.5rem' }}>
              <h3 style={{ fontSize: '0.95rem', fontWeight: '700', color: 'var(--text-primary)', marginBottom: '1rem' }}>Active Accounts Listing</h3>
              <div className="accounts-table-container" style={styles.accountsTableContainer}>
                <table style={styles.table}>
                  <thead>
                    <tr style={{ backgroundColor: 'var(--bg-primary)' }}>
                      <th style={styles.th}>Telecaller Name</th>
                      <th style={styles.th}>Registered Mobile</th>
                      <th style={styles.th}>Status</th>
                      <th style={styles.th}>Monthly Seat Charge</th>
                    </tr>
                  </thead>
                  <tbody>
                    {telecallers.length === 0 ? (
                      <tr>
                        <td colSpan="4" style={{ ...styles.td, textAlign: 'center', color: 'var(--text-secondary)' }}>
                          No registered telecallers. No active billing charges.
                        </td>
                      </tr>
                    ) : (
                      telecallers.map(tc => (
                        <tr key={tc.id} style={styles.tr}>
                          <td style={{ ...styles.td, fontWeight: '700', color: 'var(--text-primary)' }}>{tc.name}</td>
                          <td style={{ ...styles.td, fontFamily: 'monospace' }}>{tc.email}</td>
                          <td style={styles.td}>
                            <span style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                              fontSize: '0.7rem',
                              fontWeight: '700',
                              padding: '2px 6px',
                              borderRadius: '4px',
                              backgroundColor: tc.status === 'online' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(107, 114, 128, 0.08)',
                              color: tc.status === 'online' ? '#10b981' : '#6b7280',
                              textTransform: 'uppercase',
                            }}>
                              {tc.status}
                            </span>
                          </td>
                          <td style={{ ...styles.td, color: '#10b981', fontWeight: '700' }}>₹{pricePerTelecaller}.00</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      ) : (
        // ── SUPERADMIN BILLING VIEW ──────────────────────────────────────────────
        <>
          {/* Billing Overview stats */}
          <div className="grid-stats" style={{ marginBottom: '2rem' }}>
            <div className="glass-card stat-card" style={styles.statCardOrange}>
              <div style={{ width: '52px', height: '52px', borderRadius: '50%', backgroundColor: '#f59e0b', color: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <IndianRupee size={24} />
              </div>
              <div className="stat-info">
                <span className="stat-label" style={{ color: 'var(--text-muted)' }}>GRAND TOTAL MONTHLY REVENUE</span>
                <span className="stat-value" style={{ fontSize: '2rem', fontWeight: '900', color: '#f59e0b', marginTop: '2px' }}>
                  ₹{stats.totalCharge}
                </span>
              </div>
            </div>

            <div className="glass-card stat-card" style={styles.statCardBlue}>
              <div style={{ width: '52px', height: '52px', borderRadius: '50%', backgroundColor: '#6366f1', color: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Users size={24} />
              </div>
              <div className="stat-info">
                <span className="stat-label" style={{ color: 'var(--text-muted)' }}>TOTAL PLATFORM TELECALLERS</span>
                <span className="stat-value" style={{ fontSize: '2rem', fontWeight: '900', color: '#6366f1', marginTop: '2px' }}>
                  {stats.totalTelecallers} callers
                </span>
              </div>
            </div>
          </div>

          {/* Money Table */}
          <div className="glass-card" style={{ padding: '1.5rem', overflowX: 'auto' }}>
            <h2 style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '1.5rem', fontSize: '1.25rem', color: 'var(--text-primary)' }}>
              <div style={{ width: '6px', height: '24px', backgroundColor: '#f59e0b', borderRadius: '9999px' }}></div>
              Detailed Billing Breakdown
            </h2>

            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>Company Name</th>
                  <th style={styles.th}>Reg Code</th>
                  <th style={styles.th}>Nature</th>
                  <th style={styles.th}>Telecallers</th>
                  <th style={styles.th}>Price/Caller</th>
                  <th style={styles.th}>Edits Made</th>
                  <th style={styles.th}>Edit Charge</th>
                  <th style={styles.th}>Monthly Total</th>
                </tr>
              </thead>
              <tbody>
                {companies.map((comp) => {
                  const callerCount = comp.telecaller_count || 0;
                  const seats = comp.no_of_telecallers || 0;
                  const plan = comp.plan_type || 'monthly';
                  const rate = comp.price_per_telecaller || (plan === 'annual' ? 49 : 59);
                  const subscriptionCharge = plan === 'annual' ? seats * rate * 12 : seats * rate;

                  const edits = comp.edit_count || 0;
                  const editCharge = Math.max(0, edits - 3) * 20;
                  const total = subscriptionCharge + editCharge;

                  return (
                    <tr key={comp.id} style={styles.tr}>
                      <td style={styles.td}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <div style={styles.compAvatar}>
                            {comp.name.charAt(0).toUpperCase()}
                          </div>
                          <span style={{ fontWeight: '700', color: 'var(--text-primary)' }}>{comp.name}</span>
                        </div>
                      </td>
                      <td style={styles.td}>
                        <span style={styles.codeText}>{comp.reg_num}</span>
                      </td>
                      <td style={styles.td}>{comp.nature}</td>
                      <td style={{ ...styles.td, color: 'var(--text-primary)' }}>
                        <strong style={{ color: '#6366f1' }}>{callerCount}</strong>
                        <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginLeft: '4px' }}>/ {seats} seats</span>
                      </td>
                      <td style={styles.td}>
                        <div style={{ fontWeight: '700', textTransform: 'capitalize', color: 'var(--text-primary)' }}>₹{rate} <span style={{ fontSize: '0.75rem', fontWeight: 'normal', color: 'var(--text-secondary)' }}>/ mo</span></div>
                        <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>({plan})</div>
                      </td>
                      <td style={styles.td}>
                        {edits} <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>({Math.max(0, edits - 3)} billable)</span>
                      </td>
                      <td style={{ ...styles.td, color: editCharge > 0 ? 'var(--color-warning)' : 'var(--text-muted)' }}>
                        ₹{editCharge}
                      </td>
                      <td style={{ ...styles.td, fontWeight: '800', color: '#10b981' }}>
                        ₹{total}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}

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
    borderTopColor: '#6366f1',
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
  statCard: {
    backgroundColor: 'var(--bg-secondary)',
    border: '1px solid var(--border-color)',
    borderRadius: '16px',
    padding: '1.25rem',
    display: 'flex',
    alignItems: 'center',
    gap: '1.25rem',
    boxShadow: 'var(--shadow-sm)',
  },
  statCardOrange: {
    borderLeft: '4px solid #f59e0b',
  },
  statCardBlue: {
    borderLeft: '4px solid #6366f1',
  },
  invoiceCard: {
    backgroundColor: 'var(--bg-secondary)',
    border: '1px solid var(--border-color)',
    borderRadius: '16px',
    padding: '2rem',
    boxShadow: 'var(--shadow-md)',
  },
  invoiceHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    borderBottom: '1px solid var(--border-color)',
    paddingBottom: '1.25rem',
    flexWrap: 'wrap',
    gap: '1rem',
  },
  invoiceBadge: {
    display: 'inline-block',
    fontSize: '0.65rem',
    fontWeight: '800',
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    color: '#10b981',
    padding: '4px 10px',
    borderRadius: '99px',
    letterSpacing: '0.5px',
  },
  printBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    padding: '8px 16px',
    borderRadius: '8px',
    border: '1px solid var(--border-color)',
    background: 'var(--bg-primary)',
    color: 'var(--text-primary)',
    fontSize: '0.85rem',
    fontWeight: '600',
    cursor: 'pointer',
    transition: 'all 0.2s',
  },
  invoiceBody: {
    marginTop: '1.25rem',
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  invoiceRow: {
    display: 'flex',
    fontSize: '0.9rem',
    gap: '10px',
  },
  invLabel: {
    color: 'var(--text-muted)',
    width: '120px',
    fontWeight: '500',
  },
  invVal: {
    color: 'var(--text-primary)',
    fontWeight: '600',
  },
  accountsTableContainer: {
    border: '1px solid var(--border-color)',
    borderRadius: '10px',
    maxHeight: '200px',
    overflowY: 'auto',
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    textAlign: 'left',
  },
  th: {
    padding: '12px 16px',
    borderBottom: '1px solid var(--border-color)',
    color: 'var(--text-muted)',
    fontSize: '0.82rem',
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
  },
  tr: {
    borderBottom: '1px solid var(--border-color)',
    transition: 'background-color 0.2s',
  },
  td: {
    padding: '14px 16px',
    fontSize: '0.9rem',
    color: 'var(--text-secondary)',
  },
  compAvatar: {
    width: '32px',
    height: '32px',
    borderRadius: '8px',
    backgroundColor: 'rgba(99, 102, 241, 0.1)',
    color: '#6366f1',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontWeight: '700',
    fontSize: '0.9rem',
  },
  codeText: {
    fontFamily: 'monospace',
    backgroundColor: 'var(--bg-primary)',
    padding: '4px 8px',
    borderRadius: '6px',
    border: '1px solid var(--border-color)',
    color: '#6366f1',
    fontWeight: '700',
  },
};

export default BillingPage;
