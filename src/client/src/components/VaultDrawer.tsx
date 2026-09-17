import React, { useState } from 'react';

export interface VaultDrawerProps {
  isOpen: boolean;
  secrets: Array<{ key: string; maskedValue: string }>;
  onClose: () => void;
  onSaveSecret: (key: string, value: string) => Promise<void> | void;
  isLoading?: boolean;
  errorMessage?: string;
  successMessage?: string;
}

/**
 * Slide-out drawer allowing secure management of local API keys and credentials.
 */
export const VaultDrawer: React.FC<VaultDrawerProps> = ({
  isOpen,
  secrets,
  onClose,
  onSaveSecret,
  isLoading = false,
  errorMessage,
  successMessage,
}) => {
  const [newKey, setNewKey] = useState('');
  const [newValue, setNewValue] = useState('');

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newKey.trim() && newValue.trim()) {
      await onSaveSecret(newKey.trim(), newValue.trim());
      setNewKey('');
      setNewValue('');
    }
  };

  return (
    <div
      className="drawer-backdrop"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.4)',
        display: 'flex',
        justifyContent: 'flex-end',
        zIndex: 1000,
      }}
    >
      <div
        className="drawer-panel Box"
        style={{
          width: '420px',
          maxWidth: '85vw',
          height: '100%',
          backgroundColor: 'var(--color-canvas-default, #ffffff)',
          borderRadius: 0,
          borderLeft: '1px solid var(--color-border-default, #d0d7de)',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '-4px 0 16px rgba(0, 0, 0, 0.1)',
        }}
      >
        <div
          className="Box-header"
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '16px',
            borderBottom: '1px solid var(--color-border-default, #d0d7de)',
          }}
        >
          <h3 className="Box-title" style={{ margin: 0, fontSize: '16px', fontWeight: 600 }}>
            Credential Vault
          </h3>
          <button
            type="button"
            className="Btn Btn-sm"
            onClick={onClose}
            aria-label="Close Vault"
            style={{ fontSize: '12px', padding: '3px 8px' }}
          >
            Close Vault
          </button>
        </div>

        <div className="Box-body" style={{ padding: '16px', flex: 1, overflowY: 'auto' }}>
          {errorMessage && (
            <div className="flash flash-error" style={{ padding: '8px', borderRadius: '6px', fontSize: '12px', marginBottom: '12px', background: '#ffebe9', color: '#cf222e' }}>
              {errorMessage}
            </div>
          )}
          {successMessage && (
            <div className="flash flash-success" style={{ padding: '8px', borderRadius: '6px', fontSize: '12px', marginBottom: '12px', background: '#dafbe1', color: '#1a7f37' }}>
              {successMessage}
            </div>
          )}

          <div style={{ marginBottom: '20px' }}>
            <h4 style={{ margin: '0 0 8px 0', fontSize: '13px', color: 'var(--color-fg-muted, #656d76)' }}>
              Stored API Keys ({secrets.length})
            </h4>
            {secrets.length === 0 ? (
              <p style={{ fontSize: '12px', color: 'var(--color-fg-subtle, #8c959f)', fontStyle: 'italic' }}>
                No credentials stored in local vault.
              </p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {secrets.map((item) => (
                  <div
                    key={item.key}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '8px 10px',
                      background: 'var(--color-canvas-subtle, #f6f8fa)',
                      borderRadius: '6px',
                      border: '1px solid var(--color-border-muted, #d8dee4)',
                    }}
                  >
                    <span style={{ fontSize: '12px', fontWeight: 600, fontFamily: 'monospace' }}>
                      {item.key}
                    </span>
                    <span style={{ fontSize: '12px', color: 'var(--color-fg-muted, #656d76)', fontFamily: 'monospace' }}>
                      {item.maskedValue}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <form onSubmit={handleSubmit} style={{ borderTop: '1px solid var(--color-border-muted, #d8dee4)', paddingTop: '16px' }}>
            <h4 style={{ margin: '0 0 10px 0', fontSize: '13px' }}>Add or Update Secret</h4>
            <div style={{ marginBottom: '10px' }}>
              <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, marginBottom: '4px' }}>
                Key Name
              </label>
              <input
                type="text"
                placeholder="KEY_NAME e.g. OPENAI_API_KEY"
                value={newKey}
                onChange={(e) => setNewKey(e.target.value)}
                className="form-control input-sm"
                style={{ width: '100%', padding: '6px', fontSize: '12px', boxSizing: 'border-box' }}
              />
            </div>
            <div style={{ marginBottom: '14px' }}>
              <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, marginBottom: '4px' }}>
                Secret Value
              </label>
              <input
                type="password"
                placeholder="Secret value"
                value={newValue}
                onChange={(e) => setNewValue(e.target.value)}
                className="form-control input-sm"
                style={{ width: '100%', padding: '6px', fontSize: '12px', boxSizing: 'border-box' }}
              />
            </div>
            <button
              type="submit"
              className="Btn Btn-primary"
              disabled={isLoading || !newKey.trim() || !newValue.trim()}
              style={{ width: '100%', padding: '6px 12px', fontSize: '12px' }}
            >
              {isLoading ? 'Saving...' : 'Save Secret'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
