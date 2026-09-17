import React, { useState } from 'react';

export interface BackupModalProps {
  isOpen: boolean;
  onClose: () => void;
  onExport: (includeSecrets: boolean) => Promise<void> | void;
  onImport: (archivePath: string, overwrite: boolean) => Promise<void> | void;
  isProcessing?: boolean;
  errorMessage?: string;
  successMessage?: string;
}

/**
 * Modal dialog facilitating backup export and archive restoration.
 */
export const BackupModal: React.FC<BackupModalProps> = ({
  isOpen,
  onClose,
  onExport,
  onImport,
  isProcessing = false,
  errorMessage,
  successMessage,
}) => {
  const [includeSecrets, setIncludeSecrets] = useState(false);
  const [archivePath, setArchivePath] = useState('');
  const [overwrite, setOverwrite] = useState(false);

  if (!isOpen) return null;

  return (
    <div
      className="modal-backdrop"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
      }}
    >
      <div
        className="Box Box--overlay"
        style={{
          width: '560px',
          maxWidth: '90vw',
          backgroundColor: 'var(--color-canvas-default, #ffffff)',
          borderRadius: '6px',
          boxShadow: '0 8px 24px rgba(140, 149, 159, 0.2)',
          overflow: 'hidden',
        }}
      >
        <div className="Box-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px' }}>
          <h3 className="Box-title" style={{ margin: 0, fontSize: '16px', fontWeight: 600 }}>
            Backup &amp; Restore
          </h3>
          <button
            type="button"
            className="btn-octicon"
            onClick={onClose}
            aria-label="Close"
            style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '18px' }}
          >
            &times;
          </button>
        </div>

        <div className="Box-body" style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {errorMessage && (
            <div className="flash flash-error" style={{ padding: '8px 12px', borderRadius: '6px', fontSize: '13px', background: '#ffebe9', color: '#cf222e', border: '1px solid #ff8182' }}>
              {errorMessage}
            </div>
          )}
          {successMessage && (
            <div className="flash flash-success" style={{ padding: '8px 12px', borderRadius: '6px', fontSize: '13px', background: '#dafbe1', color: '#1a7f37', border: '1px solid #4ac26b' }}>
              {successMessage}
            </div>
          )}

          {/* Export Section */}
          <div className="Box-section" style={{ border: '1px solid var(--color-border-default, #d0d7de)', borderRadius: '6px', padding: '12px' }}>
            <h4 style={{ margin: '0 0 8px 0', fontSize: '14px' }}>Export Machine Backup</h4>
            <p style={{ margin: '0 0 12px 0', fontSize: '12px', color: 'var(--color-fg-muted, #656d76)' }}>
              Package all centralized skills, workflows, MCP servers, and transaction history into a compressed gzip tarball.
            </p>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', marginBottom: '12px', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={includeSecrets}
                onChange={(e) => setIncludeSecrets(e.target.checked)}
              />
              Include sensitive credentials from local vault
            </label>
            <button
              type="button"
              className="Btn Btn-primary"
              disabled={isProcessing}
              onClick={() => onExport(includeSecrets)}
              style={{ padding: '5px 12px', fontSize: '12px' }}
            >
              {isProcessing ? 'Packaging...' : 'Export Backup'}
            </button>
          </div>

          {/* Import Section */}
          <div className="Box-section" style={{ border: '1px solid var(--color-border-default, #d0d7de)', borderRadius: '6px', padding: '12px' }}>
            <h4 style={{ margin: '0 0 8px 0', fontSize: '14px' }}>Restore Backup Archive</h4>
            <p style={{ margin: '0 0 12px 0', fontSize: '12px', color: 'var(--color-fg-muted, #656d76)' }}>
              Extract an exported archive into ~/.koskill with path traversal protection.
            </p>
            <input
              type="text"
              placeholder="Archive path e.g. /tmp/backup.tar.gz"
              value={archivePath}
              onChange={(e) => setArchivePath(e.target.value)}
              className="form-control input-sm"
              style={{ width: '100%', padding: '6px 8px', marginBottom: '8px', boxSizing: 'border-box' }}
            />
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', marginBottom: '12px', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={overwrite}
                onChange={(e) => setOverwrite(e.target.checked)}
              />
              Overwrite existing items if collisions occur
            </label>
            <button
              type="button"
              className="Btn Btn-outline"
              disabled={isProcessing || !archivePath.trim()}
              onClick={() => onImport(archivePath.trim(), overwrite)}
              style={{ padding: '5px 12px', fontSize: '12px' }}
            >
              {isProcessing ? 'Extracting...' : 'Import Archive'}
            </button>
          </div>
        </div>

        <div className="Box-footer" style={{ display: 'flex', justifyContent: 'flex-end', padding: '12px 16px', borderTop: '1px solid var(--color-border-default, #d0d7de)' }}>
          <button type="button" className="Btn" onClick={onClose} style={{ padding: '5px 12px', fontSize: '12px' }}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
