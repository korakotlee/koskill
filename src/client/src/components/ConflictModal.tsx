import React, { useState } from 'react';
import { ConflictReport, ResolutionPayload, ConflictItem } from '../../../core/conflict/types.js';
import { DiffViewer } from './DiffViewer.js';

export interface ConflictModalProps {
  conflict: ConflictReport;
  onClose: () => void;
  onResolve: (payload: ResolutionPayload) => Promise<void> | void;
}

/**
 * Side-by-side interactive conflict review modal offering PICK, ALIAS, and MERGE actions.
 */
export function ConflictModal({
  conflict,
  onClose,
  onResolve,
}: ConflictModalProps): React.ReactElement {
  const [aliasInput, setAliasInput] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const expectedHashes: Record<string, string> = {};
  for (const item of conflict.items) {
    if (item.contentHash) {
      expectedHashes[item.id] = item.contentHash;
    }
  }

  const handlePick = async (winnerId: string) => {
    setIsSubmitting(true);
    try {
      await onResolve({
        conflictId: conflict.id,
        action: 'PICK',
        winnerId,
        expectedHashes,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAlias = async () => {
    if (!aliasInput.trim() || conflict.items.length === 0) return;
    setIsSubmitting(true);
    try {
      const targetItem = conflict.items[1] || conflict.items[0];
      await onResolve({
        conflictId: conflict.id,
        action: 'ALIAS',
        winnerId: targetItem.id,
        newAlias: aliasInput.trim(),
        expectedHashes,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleMerge = async () => {
    if (conflict.items.length === 0) return;
    setIsSubmitting(true);
    try {
      const winner = conflict.items[0];
      const mergedContent = conflict.items.map((i: ConflictItem) => i.content || '').join('\n\n');
      await onResolve({
        conflictId: conflict.id,
        action: 'MERGE',
        winnerId: winner.id,
        mergedContent,
        expectedHashes,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const isError = conflict.severity === 'ERROR';

  return (
    <div
      className="Modal-backdrop"
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
        zIndex: 100,
        padding: '16px',
      }}
    >
      <div
        className="Box"
        style={{
          width: '100%',
          maxWidth: '750px',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          backgroundColor: 'var(--color-canvas-default)',
          borderRadius: '8px',
          boxShadow: '0 8px 24px rgba(0,0,0,0.2)',
          overflow: 'hidden',
        }}
      >
        <div
          className="Box-header"
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '16px',
            borderBottom: '1px solid var(--color-border-default)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span
              style={{
                padding: '2px 8px',
                borderRadius: '12px',
                fontSize: '11px',
                fontWeight: 700,
                backgroundColor: isError
                  ? 'rgba(218, 54, 51, 0.15)'
                  : 'rgba(210, 153, 34, 0.15)',
                color: isError
                  ? 'var(--color-danger-fg)'
                  : 'var(--color-attention-fg)',
                border: `1px solid ${
                  isError
                    ? 'var(--color-danger-fg)'
                    : 'var(--color-attention-fg)'
                }`,
              }}
            >
              {conflict.severity}
            </span>
            <span className="Box-title" style={{ fontSize: '16px', fontWeight: 600 }}>
              {conflict.title}
            </span>
          </div>

          <button
            type="button"
            className="Btn Btn-subtle"
            onClick={onClose}
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        <div style={{ padding: '16px', overflowY: 'auto', flex: 1 }}>
          <p style={{ color: 'var(--color-fg-muted)', marginBottom: '16px', fontSize: '13px' }}>
            {conflict.description}
          </p>

          <div style={{ marginBottom: '16px' }}>
            <h4 style={{ fontSize: '13px', marginBottom: '8px', color: 'var(--color-fg-default)' }}>
              Content Diff Comparison
            </h4>
            <DiffViewer
              diffSummary={conflict.diffSummary}
              similarityScore={conflict.similarityScore}
            />
          </div>

          <div
            style={{
              padding: '12px',
              backgroundColor: 'var(--color-canvas-subtle)',
              borderRadius: '6px',
              border: '1px solid var(--color-border-default)',
            }}
          >
            <h4 style={{ fontSize: '13px', marginBottom: '8px', color: 'var(--color-fg-default)' }}>
              Resolution Options
            </h4>

            {/* PICK Option */}
            <div style={{ marginBottom: '12px' }}>
              <div style={{ fontSize: '12px', color: 'var(--color-fg-muted)', marginBottom: '4px' }}>
                Option 1: Pick preferred version (archives alternatives)
              </div>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                {conflict.items.map((item: ConflictItem) => (
                  <button
                    key={item.id}
                    type="button"
                    className="Btn Btn-primary"
                    disabled={isSubmitting}
                    onClick={() => handlePick(item.id)}
                    style={{ fontSize: '12px' }}
                  >
                    Keep {item.name} ({item.ecosystem})
                  </button>
                ))}
              </div>
            </div>

            {/* ALIAS Option */}
            <div style={{ marginBottom: '12px' }}>
              <div style={{ fontSize: '12px', color: 'var(--color-fg-muted)', marginBottom: '4px' }}>
                Option 2: Rename conflicting item to an alias
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <input
                  type="text"
                  placeholder="Enter new alias..."
                  value={aliasInput}
                  onChange={(e) => setAliasInput(e.target.value)}
                  style={{
                    flex: 1,
                    padding: '4px 8px',
                    borderRadius: '4px',
                    border: '1px solid var(--color-border-default)',
                    fontSize: '12px',
                    backgroundColor: 'var(--color-canvas-default)',
                    color: 'var(--color-fg-default)',
                  }}
                />
                <button
                  type="button"
                  className="Btn"
                  disabled={isSubmitting || !aliasInput.trim()}
                  onClick={handleAlias}
                  style={{ fontSize: '12px' }}
                >
                  Apply Alias
                </button>
              </div>
            </div>

            {/* MERGE Option */}
            <div>
              <div style={{ fontSize: '12px', color: 'var(--color-fg-muted)', marginBottom: '4px' }}>
                Option 3: Combine definitions into single unified skill
              </div>
              <button
                type="button"
                className="Btn"
                disabled={isSubmitting}
                onClick={handleMerge}
                style={{ fontSize: '12px' }}
              >
                Merge Definitions
              </button>
            </div>
          </div>
        </div>

        <div
          style={{
            padding: '12px 16px',
            borderTop: '1px solid var(--color-border-default)',
            display: 'flex',
            justifyContent: 'flex-end',
            gap: '8px',
            backgroundColor: 'var(--color-canvas-subtle)',
          }}
        >
          <button type="button" className="Btn" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
