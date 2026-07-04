import React from 'react';
import { useAuth } from '../context/AuthContext';
import { Video, LogOut, User, Activity } from 'lucide-react';

const Navbar = ({ onTabChange, activePage }) => {
  const { user, logout } = useAuth();

  return (
    <header className="glass-panel" style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '16px 24px',
      borderRadius: '0',
      borderLeft: 'none',
      borderRight: 'none',
      borderTop: 'none',
      height: '70px',
      zIndex: 50,
      position: 'relative'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }} onClick={() => onTabChange('dashboard')}>
        <Video size={28} style={{ color: 'var(--accent-primary)' }} />
        <span style={{ fontSize: '1.4rem', fontWeight: '700', letterSpacing: '-0.02em' }}>
          IntellMeet
        </span>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
        {/* Navigation Shortcut Controls */}
        <div style={{ display: 'flex', gap: '8px' }}>
          <button 
            className={`btn ${activePage === 'dashboard' ? 'btn-primary' : 'btn-secondary'}`}
            style={{ padding: '8px 16px', fontSize: '0.85rem' }}
            onClick={() => onTabChange('dashboard')}
          >
            Dashboard
          </button>
          <button 
            className={`btn ${activePage === 'workspace' ? 'btn-primary' : 'btn-secondary'}`}
            style={{ padding: '8px 16px', fontSize: '0.85rem' }}
            onClick={() => onTabChange('workspace')}
          >
            Workspaces
          </button>
        </div>

        {/* User Badge Info */}
        {user && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', borderLeft: '1px solid var(--border-glass)', paddingLeft: '20px' }}>
            <div style={{
              width: '36px',
              height: '36px',
              borderRadius: '50%',
              background: 'linear-gradient(135deg, var(--accent-primary) 0%, var(--accent-secondary) 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'white',
              fontWeight: '600',
              fontSize: '0.9rem'
            }}>
              {user.name ? user.name.charAt(0).toUpperCase() : <User size={16} />}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span style={{ fontSize: '0.875rem', fontWeight: '500' }}>{user.name}</span>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <Activity size={10} style={{ color: 'var(--accent-success)' }} />
                Online
              </span>
            </div>

            <button 
              className="btn btn-secondary btn-icon"
              style={{ width: '32px', height: '32px', border: 'none', background: 'transparent' }}
              title="Logout"
              onClick={logout}
            >
              <LogOut size={16} style={{ color: 'var(--text-secondary)' }} />
            </button>
          </div>
        )}
      </div>
    </header>
  );
};

export default Navbar;
