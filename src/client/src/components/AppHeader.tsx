import React from 'react';

export interface AppHeaderProps {
  isConnected: boolean;
  isRefreshing: boolean;
  colorMode: 'light' | 'dark';
  onRefresh: () => void;
  onToggleTheme: () => void;
  onOpenBackup?: () => void;
  onOpenVault?: () => void;
}

/**
 * Global application header displaying branding, server connectivity status,
 * refresh trigger, and color mode toggle.
 */
export function AppHeader({
  isConnected,
  isRefreshing,
  colorMode,
  onRefresh,
  onToggleTheme,
  onOpenBackup,
  onOpenVault,
}: AppHeaderProps): React.ReactElement {
  return (
    <header className="App-header">
      <div className="App-header-brand">
        <a href="/" className="App-header-brand-link">
          <img
            src="/logo.png"
            alt="KoSkill Logo"
            style={{ width: '28px', height: '28px', objectFit: 'contain' }}
          />
          <span className="App-header-title">KoSkill</span>
        </a>
        <span className="App-header-tag">v0.1.0</span>
        <span
          style={{
            fontSize: '12px',
            color: isConnected ? 'var(--color-success-fg)' : 'var(--color-danger-fg)',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '4px',
            marginLeft: '8px',
          }}
        >
          ● {isConnected ? 'Connected to 127.0.0.1:3900' : 'Offline'}
        </span>
      </div>

      <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
        <button
          type="button"
          className="Btn"
          onClick={onRefresh}
          disabled={isRefreshing}
          style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
        >
          {isRefreshing ? 'Scanning...' : 'Refresh Discovery'}
        </button>
        {onOpenBackup && (
          <button
            type="button"
            className="Btn"
            onClick={onOpenBackup}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
          >
            Backup
          </button>
        )}
        {onOpenVault && (
          <button
            type="button"
            className="Btn"
            onClick={onOpenVault}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
          >
            Vault
          </button>
        )}
        <button
          type="button"
          className="Theme-toggle"
          onClick={onToggleTheme}
          aria-label="Toggle Theme"
        >
          Theme: {colorMode === 'light' ? 'Light' : 'Dark'}
        </button>
      </div>
    </header>
  );
}
