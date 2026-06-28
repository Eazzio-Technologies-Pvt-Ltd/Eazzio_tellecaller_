import React, { useEffect, useState } from 'react';
import API_BASE_URL from '../config/api';
import { LifeBuoy, Send, Clock, CheckCircle2, AlertCircle, MessageSquare, ChevronDown, ChevronUp } from 'lucide-react';

const HelpDesk = ({ user }) => {
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [submitSuccess, setSubmitSuccess] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [expandedTicket, setExpandedTicket] = useState(null);
  const [imageFile, setImageFile] = useState(null);
  const [fileInputKey, setFileInputKey] = useState(Date.now());

  const fetchTickets = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/support/tickets`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      if (res.ok) {
        const data = await res.json();
        setTickets(data);
      }
    } catch (err) {
      console.error('Error fetching tickets:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTickets();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitError('');
    setSubmitSuccess('');

    if (!subject.trim() || !message.trim()) {
      setSubmitError('Please fill in both subject and message.');
      return;
    }

    setSubmitting(true);
    try {
      const formData = new FormData();
      formData.append('subject', subject.trim());
      formData.append('message', message.trim());
      if (imageFile) {
        formData.append('image', imageFile);
      }

      const res = await fetch(`${API_BASE_URL}/api/support/tickets`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: formData
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to submit ticket.');

      setSubmitSuccess('Your support ticket has been submitted successfully! Our team will review it shortly.');
      setSubject('');
      setMessage('');
      setImageFile(null);
      setFileInputKey(Date.now());
      fetchTickets();
    } catch (err) {
      setSubmitError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const parseDate = (dateStr) => {
    if (!dateStr) return null;
    if (typeof dateStr === 'string' && !dateStr.endsWith('Z') && !dateStr.includes('T')) {
      return new Date(dateStr.replace(' ', 'T') + 'Z');
    }
    return new Date(dateStr);
  };

  const filteredTickets = tickets.filter(t =>
    filterStatus === 'all' || t.status === filterStatus
  );

  const openCount = tickets.filter(t => t.status === 'open').length;
  const resolvedCount = tickets.filter(t => t.status === 'resolved').length;

  return (
    <div>
      {/* Page Header */}
      <div style={{ marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '6px' }}>
          <div style={{
            width: '44px', height: '44px', borderRadius: '12px',
            background: 'linear-gradient(135deg, #6366f1, #a855f7)',
            display: 'flex', alignItems: 'center', justifyContent: 'center'
          }}>
            <LifeBuoy size={22} color="#fff" />
          </div>
          <div>
            <h1 style={{ margin: 0, fontSize: '1.6rem', fontWeight: '800' }}>Help Desk</h1>
            <p className="subtitle" style={{ margin: 0, marginTop: '2px' }}>Submit complaints or queries to the Eazzio support team.</p>
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginBottom: '1.5rem' }}>
        {/* Stats */}
        <div className="glass-card" style={{ padding: '1.25rem', display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{
            width: '48px', height: '48px', borderRadius: '12px',
            background: 'rgba(251, 191, 36, 0.12)', border: '1px solid rgba(251, 191, 36, 0.2)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
          }}>
            <Clock size={22} color="#fbbf24" />
          </div>
          <div>
            <div style={{ fontSize: '1.6rem', fontWeight: '800', color: 'var(--text-primary)' }}>{openCount}</div>
            <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', fontWeight: '500' }}>Open Tickets</div>
          </div>
        </div>
        <div className="glass-card" style={{ padding: '1.25rem', display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{
            width: '48px', height: '48px', borderRadius: '12px',
            background: 'rgba(16, 185, 129, 0.12)', border: '1px solid rgba(16, 185, 129, 0.2)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
          }}>
            <CheckCircle2 size={22} color="#10b981" />
          </div>
          <div>
            <div style={{ fontSize: '1.6rem', fontWeight: '800', color: 'var(--text-primary)' }}>{resolvedCount}</div>
            <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', fontWeight: '500' }}>Resolved Tickets</div>
          </div>
        </div>
      </div>

      {/* Submit New Ticket */}
      <div className="glass-card" style={{ marginBottom: '1.5rem' }}>
        <h2 style={{ fontSize: '1.1rem', fontWeight: '700', marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <MessageSquare size={18} color="var(--color-primary)" />
          Submit a New Ticket
        </h2>

        {submitError && (
          <div style={{
            background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)',
            color: '#ef4444', borderRadius: '10px', padding: '0.75rem 1rem',
            marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.88rem'
          }}>
            <AlertCircle size={16} style={{ flexShrink: 0 }} />
            {submitError}
          </div>
        )}

        {submitSuccess && (
          <div style={{
            background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.25)',
            color: '#10b981', borderRadius: '10px', padding: '0.75rem 1rem',
            marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.88rem'
          }}>
            <CheckCircle2 size={16} style={{ flexShrink: 0 }} />
            {submitSuccess}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label style={{ fontSize: '0.88rem', fontWeight: '600', color: 'var(--text-secondary)', marginBottom: '6px', display: 'block' }}>
              Subject
            </label>
            <input
              type="text"
              placeholder="Brief description of your issue..."
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              style={{ height: '48px', fontSize: '0.95rem' }}
              maxLength={200}
            />
          </div>

          <div className="form-group" style={{ marginBottom: 0 }}>
            <label style={{ fontSize: '0.88rem', fontWeight: '600', color: 'var(--text-secondary)', marginBottom: '6px', display: 'block' }}>
              Message
            </label>
            <textarea
              placeholder="Describe your complaint or query in detail..."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={5}
              style={{ fontSize: '0.95rem', resize: 'vertical', minHeight: '120px' }}
              maxLength={2000}
            />
            <div style={{ textAlign: 'right', fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>
              {message.length}/2000
            </div>
          </div>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label style={{ fontSize: '0.88rem', fontWeight: '600', color: 'var(--text-secondary)', marginBottom: '6px', display: 'block' }}>
              Upload Screenshot / Image (Optional)
            </label>
            <input
              key={fileInputKey}
              type="file"
              accept="image/*"
              onChange={(e) => setImageFile(e.target.files[0] || null)}
              style={{
                padding: '8px 12px',
                height: 'auto',
                fontSize: '0.9rem',
                border: '1px dashed var(--border-color)',
                backgroundColor: 'rgba(255,255,255,0.02)',
                borderRadius: '8px',
                width: '100%',
                boxSizing: 'border-box',
                cursor: 'pointer'
              }}
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={submitting}
              style={{ height: '48px', padding: '0 28px', fontSize: '0.95rem', display: 'flex', alignItems: 'center', gap: '8px' }}
            >
              {submitting ? (
                <>
                  <div style={{ width: '16px', height: '16px', border: '2px solid rgba(255,255,255,0.4)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
                  Submitting...
                </>
              ) : (
                <>
                  <Send size={16} />
                  Submit Ticket
                </>
              )}
            </button>
          </div>
        </form>
      </div>

      {/* Ticket History */}
      <div className="glass-card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
          <h2 style={{ fontSize: '1.1rem', fontWeight: '700', margin: 0 }}>My Ticket History</h2>
          <div style={{ display: 'flex', gap: '6px' }}>
            {['all', 'open', 'resolved'].map(s => (
              <button
                key={s}
                onClick={() => setFilterStatus(s)}
                style={{
                  padding: '6px 14px', borderRadius: '8px', fontSize: '0.8rem', fontWeight: '600',
                  border: filterStatus === s ? '2px solid var(--color-primary)' : '1px solid var(--border-color)',
                  background: filterStatus === s ? 'var(--color-primary)' : 'transparent',
                  color: filterStatus === s ? '#fff' : 'var(--text-secondary)',
                  cursor: 'pointer', transition: 'all 0.2s',
                  textTransform: 'capitalize'
                }}
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-secondary)' }}>Loading tickets...</div>
        ) : filteredTickets.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '2.5rem 1rem' }}>
            <LifeBuoy size={40} color="var(--text-muted)" style={{ marginBottom: '12px' }} />
            <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem' }}>
              {filterStatus === 'all' ? 'No tickets submitted yet.' : `No ${filterStatus} tickets.`}
            </p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {filteredTickets.map(ticket => {
              const isExpanded = expandedTicket === ticket.id;
              const createdAt = parseDate(ticket.created_at);
              const resolvedAt = parseDate(ticket.resolved_at);
              return (
                <div
                  key={ticket.id}
                  style={{
                    border: '1px solid var(--border-color)',
                    borderRadius: '12px',
                    overflow: 'hidden',
                    background: 'var(--bg-card)',
                    transition: 'border-color 0.2s',
                    ...(ticket.status === 'open' ? { borderLeft: '3px solid #fbbf24' } : { borderLeft: '3px solid #10b981' })
                  }}
                >
                  <div
                    style={{ padding: '14px 16px', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}
                    onClick={() => setExpandedTicket(isExpanded ? null : ticket.id)}
                  >
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                        <span style={{ fontWeight: '700', fontSize: '0.95rem', color: 'var(--text-primary)' }}>
                          {ticket.subject}
                        </span>
                        <span style={{
                          fontSize: '0.72rem', fontWeight: '700', padding: '2px 8px',
                          borderRadius: '20px', textTransform: 'uppercase', letterSpacing: '0.5px',
                          background: ticket.status === 'open' ? 'rgba(251,191,36,0.15)' : 'rgba(16,185,129,0.15)',
                          color: ticket.status === 'open' ? '#f59e0b' : '#10b981',
                          border: ticket.status === 'open' ? '1px solid rgba(251,191,36,0.3)' : '1px solid rgba(16,185,129,0.3)'
                        }}>
                          {ticket.status === 'open' ? '🟡 Open' : '✅ Resolved'}
                        </span>
                      </div>
                      <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                        Submitted {createdAt ? createdAt.toLocaleString() : 'N/A'}
                        {resolvedAt && ticket.status === 'resolved' && ` · Resolved ${resolvedAt.toLocaleString()}`}
                      </div>
                    </div>
                    <div style={{ marginLeft: '12px', flexShrink: 0, color: 'var(--text-muted)' }}>
                      {isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                    </div>
                  </div>
                  {isExpanded && (
                    <div style={{
                      padding: '0 16px 14px 16px', borderTop: '1px solid var(--border-color)',
                      marginTop: '0', paddingTop: '14px'
                    }}>
                      <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', lineHeight: '1.6', margin: '0 0 12px 0', whiteSpace: 'pre-wrap' }}>
                        {ticket.message}
                      </p>
                      {ticket.image_url && (
                        <div style={{ marginTop: '14px', borderTop: '1px dashed var(--border-color)', paddingTop: '10px' }}>
                          <div style={{ fontSize: '0.8rem', fontWeight: '700', color: 'var(--text-muted)', marginBottom: '6px' }}>Attachment:</div>
                          <a href={`${API_BASE_URL}${ticket.image_url}`} target="_blank" rel="noopener noreferrer">
                            <img 
                              src={`${API_BASE_URL}${ticket.image_url}`} 
                              alt="Screenshot" 
                              style={{ maxWidth: '100%', maxHeight: '250px', borderRadius: '8px', border: '1px solid var(--border-color)', cursor: 'pointer' }}
                            />
                          </a>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
};

export default HelpDesk;
