import React from 'react';
import { ConflictReport, ConflictItem } from '../../../core/conflict/types.js';

export interface ConflictListProps {
  conflicts: ConflictReport[];
  onSelectConflict: (conflict: ConflictReport) => void;
}

/**
 * Renders the active conflict queue with severity indicators,
 * similarity score tags, and review action buttons.
 */
export function ConflictList({
  conflicts,
  onSelectConflict,
}: ConflictListProps): React.ReactElement {
  if (conflicts.length === 0) {
    return (
      <div className="Box">
        <div className="Box-header">
          <span className="Box-title">Conflict Resolution Queue</span>
        </div>
        <div className="Box-row" style={{ color: 'var(--color-success-fg)' }}>
          No synchronization conflicts detected across registered agents.
        </div>
      </div>
    );
  }

  return (
    <div className="Box">
      <div
        className="Box-header"
        style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span className="Box-title">Active Synchronization Conflicts</span>
          <span
            style={{
              padding: '2px 8px',
              borderRadius: '12px',
              fontSize: '11px',
              fontWeight: 700,
              backgroundColor: 'rgba(218, 54, 51, 0.15)',
              color: 'var(--color-danger-fg)',
              border: '1px solid var(--color-danger-fg)',
            }}
          >
            {conflicts.length} Pending
          </span>
        </div>
      </div>

      {conflicts.map((conflict) => {
        const isError = conflict.severity === 'ERROR';
        const percent =
          conflict.similarityScore !== null && conflict.similarityScore !== undefined
            ? Math.round(conflict.similarityScore * 100)
            : null;

        return (
          <div
            key={conflict.id}
            className="Box-row"
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: '16px',
            }}
          >
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                <span
                  style={{
                    padding: '2px 6px',
                    borderRadius: '10px',
                    fontSize: '10px',
                    fontWeight: 700,
                    backgroundColor: isError
                      ? 'rgba(218, 54, 51, 0.15)'
                      : 'rgba(210, 153, 34, 0.15)',
                    color: isError
                      ? 'var(--color-danger-fg)'
                      : 'var(--color-attention-fg)',
                  }}
                >
                  {conflict.severity}
                </span>

                <span style={{ fontSize: '11px', color: 'var(--color-fg-muted)', fontWeight: 600 }}>
                  {conflict.conflictType.replace(/_/g, ' ')}
                </span>

                {percent !== null && (
                  <span
                    style={{
                      padding: '1px 6px',
                      borderRadius: '8px',
                      fontSize: '10px',
                      fontWeight: 600,
                      backgroundColor: 'rgba(56, 139, 253, 0.15)',
                      color: 'var(--color-accent-fg)',
                    }}
                  >
                    {percent}% Match
                  </span>
                )}
              </div>

              <div style={{ fontWeight: 600, fontSize: '14px', marginBottom: '2px' }}>
                {conflict.title}
              </div>

              <div style={{ fontSize: '12px', color: 'var(--color-fg-muted)' }}>
                {conflict.description}
              </div>

              <div style={{ fontSize: '11px', color: 'var(--color-fg-muted)', marginTop: '4px' }}>
                Participating items: {conflict.items.map((i: ConflictItem) => `${i.name} (${i.ecosystem})`).join(' vs ')}
              </div>
            </div>

            <button
              type="button"
              className="Btn Btn-primary"
              onClick={() => onSelectConflict(conflict)}
              style={{ whiteSpace: 'nowrap', fontSize: '12px' }}
            >
              Review & Resolve
            </button>
          </div>
        );
      })}
    </div>
  );
}
