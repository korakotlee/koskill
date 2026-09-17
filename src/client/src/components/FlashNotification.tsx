import React, { useEffect } from 'react';

export interface FlashNotificationProps {
  message: string;
  type?: 'success' | 'warn' | 'danger';
  onDismiss?: () => void;
  autoCloseMs?: number;
}

/**
 * Renders non-blocking toast/flash alerts styled with GitHub Primer tokens.
 */
export const FlashNotification: React.FC<FlashNotificationProps> = ({
  message,
  type = 'success',
  onDismiss,
  autoCloseMs,
}) => {
  useEffect(() => {
    if (!autoCloseMs || !onDismiss) return;
    const timer = setTimeout(() => {
      onDismiss();
    }, autoCloseMs);
    return () => clearTimeout(timer);
  }, [autoCloseMs, onDismiss]);

  const flashClass = `flash flash-${type}`;

  return (
    <div
      role="alert"
      className={flashClass}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '12px 16px',
        marginBottom: '16px',
        borderRadius: '6px',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <span>{message}</span>
      </div>
      {onDismiss && (
        <button
          type="button"
          aria-label="Dismiss notification"
          onClick={onDismiss}
          style={{
            background: 'transparent',
            border: 'none',
            cursor: 'pointer',
            color: 'inherit',
            fontSize: '16px',
            lineHeight: 1,
            padding: '4px 8px',
          }}
        >
          &times;
        </button>
      )}
    </div>
  );
};
