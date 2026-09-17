import React from 'react';

export interface EntityToggleSwitchProps {
  entityType: 'skills' | 'workflows' | 'mcp-servers';
  id: string;
  enabled: boolean;
  isLoading?: boolean;
  onToggle: (targetState: boolean) => void;
  className?: string;
}

/**
 * Accessible toggle switch reflecting active/inactive status for an entity.
 */
export const EntityToggleSwitch: React.FC<EntityToggleSwitchProps> = ({
  id,
  enabled,
  isLoading = false,
  onToggle,
  className = '',
}) => {
  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!isLoading) {
      onToggle(!enabled);
    }
  };

  return (
    <button
      id={`toggle-btn-${id}`}
      data-testid={`toggle-${id}`}
      type="button"
      role="button"
      aria-pressed={enabled}
      aria-label={`${enabled ? 'Active' : 'Inactive'} toggle`}
      disabled={isLoading}
      onClick={handleClick}
      className={`btn-toggle-switch ${enabled ? 'active' : 'inactive'} ${className}`}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '6px',
        padding: '3px 8px',
        borderRadius: '12px',
        border: '1px solid var(--color-border-default, #d0d7de)',
        background: enabled
          ? 'var(--color-success-subtle, #dafbe1)'
          : 'var(--color-canvas-subtle, #f6f8fa)',
        color: enabled
          ? 'var(--color-success-fg, #1a7f37)'
          : 'var(--color-fg-muted, #656d76)',
        fontSize: '12px',
        fontWeight: 600,
        cursor: isLoading ? 'not-allowed' : 'pointer',
        opacity: isLoading ? 0.6 : 1,
        transition: 'all 0.15s ease-in-out',
      }}
    >
      <span
        style={{
          width: '8px',
          height: '8px',
          borderRadius: '50%',
          backgroundColor: enabled
            ? 'var(--color-success-emphasis, #1f883d)'
            : 'var(--color-fg-subtle, #8c959f)',
          display: 'inline-block',
        }}
      />
      <span>{isLoading ? '...' : enabled ? 'Active' : 'Inactive'}</span>
    </button>
  );
};
