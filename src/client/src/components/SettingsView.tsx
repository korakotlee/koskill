import React, { useState, useEffect } from 'react';

export interface SettingsViewProps {
  onOpenBackup: () => void;
  onOpenVault: () => void;
}

interface ToggleOperation {
  type: string;
  original?: string;
  target: string;
  description: string;
}

/**
 * Settings view rendering global workspace paths, Auto-Router configuration,
 * dry-run preview modal, and trigger buttons for backup and vault.
 */
export const SettingsView: React.FC<SettingsViewProps> = ({
  onOpenBackup,
  onOpenVault,
}) => {
  const [routerEnabled, setRouterEnabled] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showDryRunModal, setShowDryRunModal] = useState(false);
  const [previewOps, setPreviewOps] = useState<ToggleOperation[]>([]);
  const [showRestartGuidance, setShowRestartGuidance] = useState(false);

  useEffect(() => {
    fetch('/api/router/status')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data) {
          setRouterEnabled(Boolean(data.isEnabled));
        }
      })
      .catch(() => {});
  }, []);

  const handleToggleClick = async () => {
    if (!routerEnabled) {
      // Trigger dry-run preview first
      setLoading(true);
      try {
        const res = await fetch('/api/router/toggle', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ dryRun: true }),
        });
        if (res.ok) {
          const data = await res.json();
          setPreviewOps(data.preview?.operations || []);
          setShowDryRunModal(true);
        }
      } catch {
        // Fallback
      } finally {
        setLoading(false);
      }
    } else {
      // Disabling router
      setLoading(true);
      try {
        const res = await fetch('/api/router/toggle', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ enabled: false }),
        });
        if (res.ok) {
          setRouterEnabled(false);
          setShowRestartGuidance(true);
        }
      } finally {
        setLoading(false);
      }
    }
  };

  const handleConfirmEnable = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/router/toggle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: true }),
      });
      if (res.ok) {
        setRouterEnabled(true);
        setShowDryRunModal(false);
        setShowRestartGuidance(true);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Auto-Router Settings Card */}
      <div className="Box">
        <div className="Box-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h3 className="Box-title" style={{ fontSize: '15px' }}>
              KoSkill Auto-Router &amp; Meta-MCP Server
            </h3>
            <div style={{ fontSize: '12px', color: 'var(--color-fg-muted)', marginTop: '2px' }}>
              Replaces manual skill symlinks with on-demand hybrid capability routing. Prevents context window exhaustion.
            </div>
          </div>
          <div>
            <button
              type="button"
              className={`Btn ${routerEnabled ? 'Btn-danger' : 'Btn-primary'}`}
              disabled={loading}
              onClick={handleToggleClick}
            >
              {routerEnabled ? 'Disable Auto-Router' : 'Enable Auto-Router'}
            </button>
          </div>
        </div>

        <div className="Box-row">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <strong>Current Status:</strong>{' '}
              <span className={`settled-tag ${routerEnabled ? '' : 'settled-tag-disabled'}`}>
                {routerEnabled ? 'ACTIVE (Meta-MCP Server)' : 'INACTIVE (Direct Symlinks)'}
              </span>
            </div>
            <button
              type="button"
              className="btn-sm"
              onClick={async () => {
                const res = await fetch('/api/router/toggle', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ dryRun: true }),
                });
                if (res.ok) {
                  const data = await res.json();
                  setPreviewOps(data.preview?.operations || []);
                  setShowDryRunModal(true);
                }
              }}
            >
              Dry-Run Preview
            </button>
          </div>
        </div>

        {showRestartGuidance && (
          <div className="Box-row" style={{ backgroundColor: 'var(--color-accent-subtle)' }}>
            <strong>Agent Restart Guidance</strong>
            <p style={{ marginTop: '4px', fontSize: '12px', color: 'var(--color-fg-default)' }}>
              Configuration applied successfully. Because running IDE processes do not reload MCP pipes mid-session, please reload your agent:
              <br />
              <strong>Antigravity / Gemini:</strong> Restart active IDE task / session.
              <br />
              <strong>Claude Code:</strong> Run <code>/compact</code> or restart terminal session.
            </p>
          </div>
        )}
      </div>

      {/* Dry Run Modal */}
      {showDryRunModal && (
        <div className="modal-backdrop" style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }}>
          <div className="Box" style={{ width: '600px', maxWidth: '90vw', backgroundColor: 'var(--color-canvas-default)' }}>
            <div className="Box-header" style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span className="Box-title">Dry-Run Preview &amp; Active Changes</span>
              <button
                type="button"
                className="close-btn"
                onClick={() => setShowDryRunModal(false)}
              >
                &times;
              </button>
            </div>
            <div className="Box-body" style={{ maxHeight: '300px', overflowY: 'auto' }}>
              {previewOps.length === 0 ? (
                <p style={{ fontSize: '13px', color: 'var(--color-fg-muted)' }}>
                  No active skill symlinks to rename or rules to inject.
                </p>
              ) : (
                <table style={{ width: '100%', fontSize: '12px' }}>
                  <tbody>
                    {previewOps.map((op, idx) => (
                      <tr key={idx}>
                        <td style={{ padding: '6px', fontWeight: 600, color: 'var(--color-accent-fg)' }}>
                          {op.type}
                        </td>
                        <td style={{ padding: '6px' }}>{op.description}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
            <div className="Box-footer" style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
              <button
                type="button"
                className="Btn"
                onClick={() => setShowDryRunModal(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="Btn Btn-primary"
                disabled={loading}
                onClick={handleConfirmEnable}
              >
                Confirm &amp; Apply
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Workspace Configuration Card */}
      <div className="Box">
        <div className="Box-header">
          <span className="Box-title">Workspace Configuration</span>
        </div>
        <div className="Box-row">
          <div>
            <strong>Global Config Root:</strong> <code>~/.gemini/config</code>
          </div>
        </div>
        <div className="Box-row">
          <div>
            <strong>Storage Root:</strong> <code>~/.koskill/skills</code>
          </div>
        </div>
        <div className="Box-row" style={{ display: 'flex', gap: '12px' }}>
          <button
            type="button"
            className="Btn"
            onClick={onOpenBackup}
          >
            Backup &amp; Restore
          </button>
          <button
            type="button"
            className="Btn Btn-outline"
            onClick={onOpenVault}
          >
            Credential Vault
          </button>
        </div>
      </div>
    </div>
  );
};
