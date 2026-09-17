import React from 'react';

export interface SettingsViewProps {
  onOpenBackup: () => void;
  onOpenVault: () => void;
}

/**
 * Settings view rendering global workspace paths and trigger buttons for backup and vault.
 */
export const SettingsView: React.FC<SettingsViewProps> = ({
  onOpenBackup,
  onOpenVault,
}) => {
  return (
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
  );
};
