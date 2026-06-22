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
  LayoutGrid
} from 'lucide-react';

import Logo from './Logo';

const Sidebar = ({ activeTab, setActiveTab, user, onLogout, theme, toggleTheme }) => {
  const menuItems = [
    { id: 'dashboard',    label: 'Dashboard',      icon: LayoutDashboard },
    { id: 'telecallers',  label: 'Telecallers',    icon: Users },
    { id: 'monitor-grid', label: 'Monitor Grid',   icon: LayoutGrid },
    { id: 'accounts',    label: 'Accounts Info',   icon: Key },
    { id: 'campaigns',   label: 'Campaigns',       icon: PhoneOutgoing },
    { id: 'contacts',    label: 'Contacts',        icon: Contact2 },
    { id: 'call-logs',   label: 'Call Logs',       icon: History },
  ];

  return (
    <aside style={styles.sidebar}>
      {/* Brand Header */}
      <div style={styles.brand}>
        <Logo theme={theme} mode="sidebar" />
      </div>

      {/* Navigation Menu */}
      <nav style={styles.nav}>
        {menuItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              style={{
                ...styles.navItem,
                ...(isActive ? styles.navItemActive : {}),
              }}
            >
              <Icon size={20} color={isActive ? '#ffffff' : 'var(--text-secondary)'} />
              <span style={{ marginLeft: '12px' }}>{item.label}</span>
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
            <div style={styles.profileRole}>Administrator</div>
          </div>
          <button onClick={onLogout} style={styles.logoutBtn} title="Logout">
            <LogOut size={18} color="var(--text-secondary)" />
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
    backgroundColor: 'var(--bg-secondary)',
    borderRight: '1px solid var(--border-color)',
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
    color: 'var(--text-primary)',
  },
  brandSubtitle: {
    fontSize: '0.75rem',
    color: 'var(--text-muted)',
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
    color: 'var(--text-secondary)',
    fontSize: '0.95rem',
    fontWeight: '500',
    cursor: 'pointer',
    textAlign: 'left',
    transition: 'all 0.2s',
    width: '100%',
  },
  navItemActive: {
    background: 'var(--color-primary)',
    color: '#ffffff',
    boxShadow: '0 4px 12px var(--color-primary-glow)',
  },
  themeToggleContainer: {
    paddingTop: '1rem',
    borderTop: '1px solid var(--border-color)',
    marginBottom: '1rem',
  },
  themeToggleBtn: {
    display: 'flex',
    alignItems: 'center',
    width: '100%',
    padding: '0.75rem 1rem',
    borderRadius: '12px',
    background: 'var(--bg-primary)',
    border: '1px solid var(--border-color)',
    color: 'var(--text-primary)',
    fontSize: '0.9rem',
    fontWeight: '500',
    cursor: 'pointer',
    transition: 'all 0.2s',
  },
  profileFooter: {
    borderTop: '1px solid var(--border-color)',
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
    backgroundColor: 'var(--color-primary)',
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
    color: 'var(--text-primary)',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  profileRole: {
    fontSize: '0.75rem',
    color: 'var(--text-muted)',
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
