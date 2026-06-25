import React, { useEffect, useState } from 'react';
import API_BASE_URL from '../config/api';
import {
  HeadphonesIcon, CheckCircle2, Clock, Building2, Mail,
  AlertCircle, RefreshCw, Search, Filter, ChevronDown, ChevronUp
} from 'lucide-react';

const SupportTickets = () => {
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [resolving, setResolving] = useState(null);
  const [filterStatus, setFilterStatus] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedTicket, setExpandedTicket] = useState(null);
  const [error, setError] = useState('');

  const fetchTickets = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${API_BASE_URL}/api/support/tickets`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load tickets.');
      setTickets(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTickets();
  }, []);

  const handleResolve = async (ticketId) => {
    setResolving(ticketId);
    try {
      const res = await fetch(`${API_BASE_URL}/api/support/tickets/${ticketId}/resolve`, {
        method: 'PUT',
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to resolve.');
      fetchTickets();
    } catch (err) {
      alert(err.message);
    } finally {
      setResolving(null);
    }
  };

  const parseDate = (dateStr) => {
    if (!dateStr) return null;
    if (typeof dateStr === 'string' && !dateStr.endsWith('Z') && !dateStr.includes('T')) {
      return new Date(dateStr.replace(' ', 'T') + 'Z');
    }
    return new Date(dateStr);
  };

  const filteredTickets = tickets.filter(t => {
    const matchStatus = filterStatus === 'all' || t.status === filterStatus;
    const term = searchTerm.toLowerCase();
    const matchSearch = !term ||
      t.company_name?.toLowerCase().includes(term) ||
      t.admin_email?.toLowerCase().includes(term) ||
      t.subject?.toLowerCase().includes(term) ||
      t.company_reg_num?.toLowerCase().includes(term);
    return matchStatus && matchSearch;
  });

  const openCount = tickets.filter(t => t.status === 'open').length;
  const resolvedCount = tickets.filter(t => t.status === 'resolved').length;

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '6px' }}>
            <div style={{
              width: '44px', height: '44px', borderRadius: '12px',
              background: 'linear-gradient(135deg, #f59e0b, #ef4444)',
              display: 'flex', alignItems: 'center', justifyContent: 'center'
            }}>
              <HeadphonesIcon size={22} color="#fff" />
            </div>
            <div>
              <h1 style={{ margin: 0, fontSize: '1.6rem', fontWeight: '800' }}>Support Tickets</h1>
              <p className="subtitle" style={{ margin: 0, marginTop: '2px' }}>Manage company admin complaints and queries.</p>
            </div>
          </div>
          <button
            className="btn btn-secondary"
            onClick={fetchTickets}
            style={{ display: 'flex', alignItems: 'center', gap: '6px', height: '40px', padding: '0 16px', fontSize: '0.88rem' }}
          >
            <RefreshCw size={15} />
            Refresh
          </button>
        </div>
      </div>

      {/* Stats Row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem', marginBottom: '1.5rem' }}>
        <div className="glass-card" style={{ padding: '1.25rem', display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{
            width: '44px', height: '44px', borderRadius: '10px', flexShrink: 0,
            background: 'var(--color-primary-glow)', border: '1px solid var(--color-primary-glow)',
            display: 'flex', alignItems: 'center', justifyContent: 'center'
          }}>
            <Filter size={20} color="var(--color-primary)" />
          </div>
          <div>
            <div style={{ fontSize: '1.5rem', fontWeight: '800' }}>{tickets.length}</div>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', fontWeight: '500' }}>Total Tickets</div>
          </div>
        </div>
        <div className="glass-card" style={{ padding: '1.25rem', display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{
            width: '44px', height: '44px', borderRadius: '10px', flexShrink: 0,
            background: 'rgba(251,191,36,0.12)', border: '1px solid rgba(251,191,36,0.2)',
            display: 'flex', alignItems: 'center', justifyContent: 'center'
          }}>
            <Clock size={20} color="#f59e0b" />
          </div>
          <div>
            <div style={{ fontSize: '1.5rem', fontWeight: '800', color: openCount > 0 ? '#f59e0b' : 'var(--text-primary)' }}>{openCount}</div>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', fontWeight: '500' }}>Awaiting Response</div>
          </div>
        </div>
        <div className="glass-card" style={{ padding: '1.25rem', display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{
            width: '44px', height: '44px', borderRadius: '10px', flexShrink: 0,
            background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.2)',
            display: 'flex', alignItems: 'center', justifyContent: 'center'
          }}>
            <CheckCircle2 size={20} color="#10b981" />
          </div>
          <div>
            <div style={{ fontSize: '1.5rem', fontWeight: '800' }}>{resolvedCount}</div>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', fontWeight: '500' }}>Resolved</div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="glass-card" style={{ marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
          {/* Search */}
          <div style={{ position: 'relative', flex: '1', minWidth: '220px' }}>
            <Search size={16} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input
              type="text"
              placeholder="Search by company, email, or subject..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{ paddingLeft: '40px', height: '42px', fontSize: '0.88rem', width: '100%', boxSizing: 'border-box' }}
            />
          </div>
          {/* Status Filter */}
          <div style={{ display: 'flex', gap: '6px' }}>
            {['all', 'open', 'resolved'].map(s => (
              <button
                key={s}
                onClick={() => setFilterStatus(s)}
                style={{
                  padding: '8px 16px', borderRadius: '8px', fontSize: '0.82rem', fontWeight: '600',
                  border: filterStatus === s ? '2px solid var(--color-primary)' : '1px solid var(--border-color)',
                  background: filterStatus === s ? 'var(--color-primary)' : 'transparent',
                  color: filterStatus === s ? '#fff' : 'var(--text-secondary)',
                  cursor: 'pointer', transition: 'all 0.2s', textTransform: 'capitalize'
                }}
              >
                {s} {s !== 'all' && `(${s === 'open' ? openCount : resolvedCount})`}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Ticket List */}
      <div className="glass-card">
        {error && (
          <div style={{
            background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)',
            color: '#ef4444', borderRadius: '10px', padding: '0.75rem 1rem',
            marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.88rem'
          }}>
            <AlertCircle size={16} style={{ flexShrink: 0 }} />
            {error}
          </div>
        )}

        {loading ? (
          <div style={{ textAlign: 'center', padding: '2.5rem', color: 'var(--text-secondary)' }}>
            <RefreshCw size={24} style={{ animation: 'spin 1s linear infinite', marginBottom: '10px', display: 'block', margin: '0 auto 10px auto' }} />
            Loading tickets...
          </div>
        ) : filteredTickets.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '3rem 1rem' }}>
            <HeadphonesIcon size={48} color="var(--text-muted)" style={{ marginBottom: '16px' }} />
            <p style={{ color: 'var(--text-muted)', fontSize: '1rem', fontWeight: '500' }}>
              {searchTerm || filterStatus !== 'all' ? 'No tickets match your filters.' : 'No support tickets yet.'}
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
                    borderLeft: ticket.status === 'open' ? '4px solid #f59e0b' : '4px solid #10b981',
                    borderRadius: '12px',
                    background: 'var(--bg-secondary)',
                    overflow: 'hidden'
                  }}
                >
                  {/* Ticket Header */}
                  <div
                    style={{ padding: '14px 16px', cursor: 'pointer' }}
                    onClick={() => setExpandedTicket(isExpanded ? null : ticket.id)}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px' }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        {/* Subject + Badge */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap', marginBottom: '6px' }}>
                          <span style={{ fontWeight: '700', fontSize: '0.95rem', color: 'var(--text-primary)' }}>
                            {ticket.subject}
                          </span>
                          <span style={{
                            fontSize: '0.7rem', fontWeight: '700', padding: '2px 8px',
                            borderRadius: '20px', textTransform: 'uppercase', letterSpacing: '0.5px',
                            background: ticket.status === 'open' ? 'rgba(251,191,36,0.15)' : 'rgba(16,185,129,0.15)',
                            color: ticket.status === 'open' ? '#f59e0b' : '#10b981',
                            border: ticket.status === 'open' ? '1px solid rgba(251,191,36,0.3)' : '1px solid rgba(16,185,129,0.3)',
                            flexShrink: 0
                          }}>
                            {ticket.status === 'open' ? '⏳ Open' : '✅ Resolved'}
                          </span>
                        </div>

                        {/* Company Info Row */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
                          <span style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                            <Building2 size={13} />
                            <strong style={{ color: 'var(--text-primary)' }}>{ticket.company_name}</strong>
                            <span style={{ color: 'var(--text-muted)' }}>({ticket.company_reg_num})</span>
                          </span>
                          <span style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                            <Mail size={13} />
                            {ticket.admin_email}
                          </span>
                          <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                            {createdAt ? createdAt.toLocaleString() : 'N/A'}
                          </span>
                          {resolvedAt && ticket.status === 'resolved' && (
                            <span style={{ fontSize: '0.78rem', color: '#10b981' }}>
                              Resolved: {resolvedAt.toLocaleString()}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Actions */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                        {ticket.status === 'open' && (
                          <button
                            className="btn btn-primary"
                            style={{
                              height: '36px', padding: '0 14px', fontSize: '0.82rem',
                              display: 'flex', alignItems: 'center', gap: '6px',
                              background: 'linear-gradient(135deg, #10b981, #059669)'
                            }}
                            disabled={resolving === ticket.id}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleResolve(ticket.id);
                            }}
                          >
                            {resolving === ticket.id ? (
                              <div style={{ width: '14px', height: '14px', border: '2px solid rgba(255,255,255,0.4)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
                            ) : (
                              <CheckCircle2 size={14} />
                            )}
                            {resolving === ticket.id ? 'Resolving...' : 'Mark Resolved'}
                          </button>
                        )}
                        <div style={{ color: 'var(--text-muted)' }}>
                          {isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Expanded Message */}
                  {isExpanded && (
                    <div style={{
                      borderTop: '1px solid var(--border-color)',
                      padding: '14px 16px',
                      background: 'var(--bg-card)'
                    }}>
                      <div style={{ fontSize: '0.8rem', fontWeight: '600', color: 'var(--text-muted)', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                        Message
                      </div>
                      <p style={{
                        fontSize: '0.92rem', color: 'var(--text-secondary)',
                        lineHeight: '1.7', margin: 0, whiteSpace: 'pre-wrap'
                      }}>
                        {ticket.message}
                      </p>
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

export default SupportTickets;
