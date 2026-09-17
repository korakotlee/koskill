import React from 'react';

export interface ConfirmModalItem {
  skillId: string;
  skillName: string;
  sourcePath: string;
  targetCentralPath?: string;
}

export interface CentralizeConfirmModalProps {
  isOpen: boolean;
  action: 'centralize' | 'revert';
  items: ConfirmModalItem[];
  onConfirm: () => void;
  onCancel: () => void;
  isSubmitting?: boolean;
}

/**
 * Primer-styled overlay dialog confirming filesystem paths before applying mutations.
 */
export const CentralizeConfirmModal: React.FC<CentralizeConfirmModalProps> = ({
  isOpen,
  action,
  items,
  onConfirm,
  onCancel,
  isSubmitting = false,
}) => {
  if (!isOpen) return null;

  const isCentralize = action === 'centralize';
  const title = isCentralize
    ? `Confirm Centralization (${items.length} ${items.length === 1 ? 'skill' : 'skills'})`
    : `Confirm Reversion (${items.length} ${items.length === 1 ? 'skill' : 'skills'})`;

  return (
    <div
      role="dialog"
      aria-modal="true"
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(27, 31, 36, 0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999,
        padding: '16px',
      }}
    >
      <div
        className="Box Box--overlay"
        style={{
          width: '100%',
          maxWidth: '640px',
          backgroundColor: 'var(--color-canvas-default)',
          borderRadius: '8px',
          boxShadow: '0 8px 24px rgba(140, 149, 159, 0.2)',
          display: 'flex',
          flexDirection: 'column',
          maxHeight: '90vh',
        }}
      >
        <div
          className="Box-header"
          style={{
            padding: '16px',
            borderBottom: '1px solid var(--color-border-default)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 600 }}>{title}</h3>
          <button
            type="button"
            aria-label="Close"
            onClick={onCancel}
            disabled={isSubmitting}
            style={{
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              fontSize: '18px',
              color: 'var(--color-fg-muted)',
            }}
          >
            &times;
          </button>
        </div>

        <div
          className="Box-body"
          style={{
            padding: '16px',
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
          }}
        >
          <p style={{ margin: 0, fontSize: '13px', color: 'var(--color-fg-muted)' }}>
            {isCentralize
              ? 'Files will be safely transferred to ~/.koskill/skills/ and replaced with symbolic links.'
              : 'Symbolic links will be removed and original physical files restored from ~/.koskill/skills/.'}
          </p>

          <div
            style={{
              border: '1px solid var(--color-border-muted)',
              borderRadius: '6px',
              padding: '8px 12px',
              maxHeight: '240px',
              overflowY: 'auto',
              backgroundColor: 'var(--color-canvas-subtle)',
            }}
          >
            {items.map((item) => (
              <div
                key={item.skillId}
                style={{
                  padding: '8px 0',
                  borderBottom: '1px solid var(--color-border-muted)',
                  fontSize: '12px',
                }}
              >
                <div style={{ fontWeight: 600, color: 'var(--color-fg-default)' }}>
                  {item.skillName}
                </div>
                <div style={{ color: 'var(--color-fg-muted)', fontFamily: 'monospace' }}>
                  Source: {item.sourcePath}
                </div>
                {item.targetCentralPath && (
                  <div style={{ color: 'var(--color-accent-fg)', fontFamily: 'monospace' }}>
                    Target: {item.targetCentralPath}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        <div
          className="Box-footer"
          style={{
            padding: '16px',
            borderTop: '1px solid var(--color-border-default)',
            display: 'flex',
            justifyContent: 'flex-end',
            gap: '8px',
          }}
        >
          <button
            type="button"
            className="Btn"
            onClick={onCancel}
            disabled={isSubmitting}
            style={{
              padding: '6px 12px',
              borderRadius: '6px',
              border: '1px solid var(--color-border-default)',
              backgroundColor: 'var(--color-canvas-subtle)',
              cursor: 'pointer',
            }}
          >
            Cancel
          </button>
          <button
            type="button"
            className={isCentralize ? 'Btn-primary' : 'Btn-danger'}
            onClick={onConfirm}
            disabled={isSubmitting}
            style={{
              padding: '6px 16px',
              borderRadius: '6px',
              border: 'none',
              backgroundColor: isCentralize
                ? 'var(--color-success-emphasis, #1f883d)'
                : 'var(--color-danger-fg, #cf222e)',
              color: '#ffffff',
              fontWeight: 600,
              cursor: isSubmitting ? 'not-allowed' : 'pointer',
            }}
          >
            {isSubmitting ? 'Applying...' : isCentralize ? 'Confirm & Centralize' : 'Confirm & Revert'}
          </button>
        </div>
      </div>
    </div>
  );
};
