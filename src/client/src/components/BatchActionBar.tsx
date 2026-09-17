import React from 'react';

export interface BatchActionBarProps {
  selectedCount: number;
  onCentralizeSelected: () => void;
  onRevertSelected: () => void;
  onClearSelection: () => void;
  disabled?: boolean;
}

/**
 * Sticky/floating multi-select toolbar conforming to GitHub Primer guidelines.
 */
export const BatchActionBar: React.FC<BatchActionBarProps> = ({
  selectedCount,
  onCentralizeSelected,
  onRevertSelected,
  onClearSelection,
  disabled = false,
}) => {
  if (selectedCount === 0) {
    return null;
  }

  return (
    <div
      role="toolbar"
      aria-label="Batch actions toolbar"
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 100,
        backgroundColor: 'var(--color-accent-subtle, #ddf4ff)',
        border: '1px solid var(--color-border-default, #d0d7de)',
        borderRadius: '6px',
        padding: '8px 16px',
        marginBottom: '12px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '12px',
        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <span
          className="Counter Counter--primary"
          style={{
            backgroundColor: 'var(--color-accent-fg, #0969da)',
            color: '#ffffff',
            borderRadius: '20px',
            padding: '2px 8px',
            fontSize: '12px',
            fontWeight: 600,
          }}
        >
          {selectedCount}
        </span>
        <span style={{ fontSize: '13px', fontWeight: 500, color: 'var(--color-fg-default)' }}>
          {selectedCount === 1 ? 'skill selected' : 'skills selected'}
        </span>
        <button
          type="button"
          onClick={onClearSelection}
          disabled={disabled}
          style={{
            background: 'none',
            border: 'none',
            color: 'var(--color-accent-fg, #0969da)',
            cursor: 'pointer',
            fontSize: '12px',
            textDecoration: 'underline',
            marginLeft: '8px',
            padding: 0,
          }}
        >
          Clear selection
        </button>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <button
          type="button"
          className="Btn Btn-primary"
          onClick={onCentralizeSelected}
          disabled={disabled}
          style={{
            padding: '4px 12px',
            fontSize: '12px',
            fontWeight: 600,
            borderRadius: '6px',
            border: '1px solid rgba(27, 31, 36, 0.15)',
            backgroundColor: 'var(--color-success-emphasis, #1f883d)',
            color: '#ffffff',
            cursor: disabled ? 'not-allowed' : 'pointer',
          }}
        >
          Centralize Selected ({selectedCount})
        </button>
        <button
          type="button"
          className="Btn"
          onClick={onRevertSelected}
          disabled={disabled}
          style={{
            padding: '4px 12px',
            fontSize: '12px',
            fontWeight: 500,
            borderRadius: '6px',
            border: '1px solid var(--color-border-default, #d0d7de)',
            backgroundColor: 'var(--color-canvas-default, #ffffff)',
            color: 'var(--color-fg-default)',
            cursor: disabled ? 'not-allowed' : 'pointer',
          }}
        >
          Revert Selected ({selectedCount})
        </button>
      </div>
    </div>
  );
};
