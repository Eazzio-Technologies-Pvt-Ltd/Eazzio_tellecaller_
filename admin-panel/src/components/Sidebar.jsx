import React from 'react';
import { 
  LayoutDashboard, 
  Users, 
  PhoneCall, 
  Contact2, 
  History, 
  LogOut, 
  PhoneOutgoing,
  Sun,
  Moon,
  Key,
  LayoutGrid,
  IndianRupee,
  LifeBuoy,
  Headphones
} from 'lucide-react';

import Logo from './Logo';

const Sidebar = ({ activeTab, setActiveTab, user, onLogout, theme, toggleTheme, isOpen, onClose, showDemoBanner }) => {
  const isSuperadmin = user && (user.companyRegNum === null || user.email === 'tellecaller111@eazzio.com');
  const isDemoUser = user && user.companyRegNum && user.companyRegNum.startsWith('EAZ-DEMO-') && user.planType === 'demo';

  const rawMenuItems = isSuperadmin
    ? [
        { id: 'dashboard',        label: 'Dashboard',           icon: LayoutDashboard },
        { id: 'monitor-grid',     label: 'Monitor Grid',         icon: LayoutGrid },
        { id: 'support',          label: 'Support',              icon: Headphones },
        { id: 'billing',          label: 'Money',                icon: IndianRupee },
      ]
    : [
        { id: 'dashboard',    label: 'Dashboard',      icon: LayoutDashboard },
        { id: 'telecallers',  label: 'Telecallers',    icon: Users },
        { id: 'monitor-grid', label: 'Monitor Grid',   icon: LayoutGrid },
        { id: 'accounts',    label: 'Accounts Info',   icon: Key },
        // Only show billing tab for demo users (they need to subscribe to upgrade)
        ...(isDemoUser ? [{ id: 'billing', label: 'Subscribe', icon: IndianRupee }] : []),
        { id: 'campaigns',   label: 'Campaigns',       icon: PhoneOutgoing },
        { id: 'contacts',    label: 'Contacts',        icon: Contact2 },
        { id: 'call-logs',   label: 'Call Logs',       icon: History },
        { id: 'help-desk',   label: 'Help Desk',       icon: LifeBuoy },
      ];

  const menuItems = rawMenuItems;

  return (
    <aside style={{
      ...styles.sidebar,
      ...(isDemoUser && showDemoBanner ? { top: '38px', height: 'calc(100vh - 38px)' } : {})
    }} className={isOpen ? 'open' : ''}>
      {/* Brand Header */}
      <div style={styles.brand}>
        <Logo theme="dark" mode="sidebar" />
      </div>

      {/* Navigation Menu */}
      <nav style={styles.nav}>
        {menuItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => {
                setActiveTab(item.id);
                if (onClose) onClose();
              }}
              style={{
                ...styles.navItem,
                ...(isActive ? styles.navItemActive : {}),
              }}
              onMouseEnter={(e) => {
                if (!isActive) {
                  e.currentTarget.style.color = '#ffffff';
                  e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.05)';
                }
              }}
              onMouseLeave={(e) => {
                if (!isActive) {
                  e.currentTarget.style.color = '#94a3b8';
                  e.currentTarget.style.backgroundColor = 'transparent';
                }
              }}
            >
              <Icon size={20} color={isActive ? '#ffffff' : '#94a3b8'} />
              <span style={{ marginLeft: '12px', flex: 1 }}>{item.label}</span>
              {isActive && (
                <div style={{
                  width: '6px',
                  height: '6px',
                  borderRadius: '50%',
                  backgroundColor: '#ffffff',
                  marginLeft: 'auto'
                }}></div>
              )}
            </button>
          );
        })}
      </nav>

      {/* Theme Toggler */}
      <div style={styles.themeToggleContainer}>
        <button onClick={toggleTheme} style={styles.themeToggleBtn}>
          {theme === 'dark' ? (
            <>
              <Sun size={18} color="#fbbf24" />
              <span style={{ marginLeft: '8px' }}>Light Mode</span>
            </>
          ) : (
            <>
              <Moon size={18} color="#6366f1" />
              <span style={{ marginLeft: '8px' }}>Dark Mode</span>
            </>
          )}
        </button>
      </div>

      {/* User profile footer */}
      {user && (
        <div style={styles.profileFooter}>
          <div style={styles.avatar}>
            {user.name ? user.name.charAt(0).toUpperCase() : 'A'}
          </div>
          <div style={styles.profileInfo}>
            <div style={styles.profileName}>{user.name}</div>
            <div style={styles.profileRole} title={isSuperadmin ? 'Super Administrator' : `Company Registration Code: ${user.companyRegNum}`}>
              {isSuperadmin ? 'Super Admin' : `Code: ${user.companyRegNum}`}
            </div>
          </div>
          <button 
            onClick={onLogout} 
            style={styles.logoutBtn} 
            title="Logout"
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.08)'}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
          >
            <LogOut size={18} color="#94a3b8" />
          </button>
        </div>
      )}
    </aside>
  );
};

const styles = {
  sidebar: {
    width: '260px',
    height: '100vh',
    position: 'fixed',
    top: 0,
    left: 0,
    backgroundColor: '#15132c',
    borderRight: '1px solid #232244',
    display: 'flex',
    flexDirection: 'column',
    padding: '1.5rem',
    zIndex: 100,
    transition: 'background-color 0.3s ease, border-color 0.3s ease',
  },
  brand: {
    display: 'flex',
    alignItems: 'center',
    marginBottom: '2.5rem',
    paddingLeft: '0.2rem',
  },
  brandIcon: {
    fontSize: '24px',
  },
  brandText: {
    display: 'flex',
    flexDirection: 'column',
  },
  brandTitle: {
    fontSize: '1.2rem',
    fontWeight: '800',
    letterSpacing: '1px',
    color: '#ffffff',
  },
  brandSubtitle: {
    fontSize: '0.75rem',
    color: '#a78bfa',
    fontWeight: '500',
  },
  nav: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
    flex: 1,
  },
  navItem: {
    display: 'flex',
    alignItems: 'center',
    padding: '0.85rem 1rem',
    borderRadius: '12px',
    background: 'transparent',
    border: 'none',
    color: '#94a3b8',
    fontSize: '0.95rem',
    fontWeight: '500',
    cursor: 'pointer',
    textAlign: 'left',
    transition: 'all 0.2s',
    width: '100%',
  },
  navItemActive: {
    background: '#7c3aed',
    color: '#ffffff',
    boxShadow: '0 4px 12px rgba(124, 58, 237, 0.3)',
  },
  themeToggleContainer: {
    paddingTop: '1rem',
    borderTop: '1px solid #232244',
    marginBottom: '1rem',
  },
  themeToggleBtn: {
    display: 'flex',
    alignItems: 'center',
    width: '100%',
    padding: '0.75rem 1rem',
    borderRadius: '12px',
    background: '#1d1b3e',
    border: '1px solid #232244',
    color: '#ffffff',
    fontSize: '0.9rem',
    fontWeight: '500',
    cursor: 'pointer',
    transition: 'all 0.2s',
  },
  profileFooter: {
    borderTop: '1px solid #232244',
    paddingTop: '1rem',
    marginTop: 'auto',
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  },
  avatar: {
    width: '40px',
    height: '40px',
    borderRadius: '50%',
    backgroundColor: '#7c3aed',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#ffffff',
    fontWeight: 'bold',
    fontSize: '16px',
  },
  profileInfo: {
    display: 'flex',
    flexDirection: 'column',
    flex: 1,
    minWidth: 0,
  },
  profileName: {
    fontSize: '0.9rem',
    fontWeight: '600',
    color: '#ffffff',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  profileRole: {
    fontSize: '0.75rem',
    color: '#94a3b8',
  },
  logoutBtn: {
    background: 'transparent',
    border: 'none',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '6px',
    borderRadius: '8px',
    transition: 'background-color 0.2s',
  },
};

export default Sidebar;
