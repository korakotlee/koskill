import React from 'react';
import { DiffSummary, DiffLine } from '../../../core/conflict/types.js';

export interface DiffViewerProps {
  diffSummary?: DiffSummary;
  similarityScore?: number | null;
}

/**
 * Visual diff viewer component rendering line additions, deletions,
 * and semantic similarity score badges.
 */
export function DiffViewer({ diffSummary, similarityScore }: DiffViewerProps): React.ReactElement {
  if (!diffSummary || !diffSummary.chunks || diffSummary.chunks.length === 0) {
    return (
      <div
        style={{
          padding: '16px',
          color: 'var(--color-fg-muted)',
          backgroundColor: 'var(--color-canvas-subtle)',
          borderRadius: '6px',
          textAlign: 'center',
        }}
      >
        No diff available
      </div>
    );
  }

  const similarityPercent =
    similarityScore !== undefined && similarityScore !== null
      ? Math.round(similarityScore * 100)
      : null;

  return (
    <div
      className="DiffViewer"
      style={{
        border: '1px solid var(--color-border-default)',
        borderRadius: '6px',
        overflow: 'hidden',
        fontFamily: 'monospace',
        fontSize: '12px',
        backgroundColor: 'var(--color-canvas-default)',
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '8px 12px',
          backgroundColor: 'var(--color-canvas-subtle)',
          borderBottom: '1px solid var(--color-border-default)',
        }}
      >
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <span style={{ color: 'var(--color-success-fg)', fontWeight: 600 }}>
            +{diffSummary.additions}
          </span>
          <span style={{ color: 'var(--color-danger-fg)', fontWeight: 600 }}>
            -{diffSummary.deletions}
          </span>
        </div>

        {similarityPercent !== null && (
          <span
            style={{
              padding: '2px 8px',
              borderRadius: '12px',
              fontSize: '11px',
              fontWeight: 600,
              backgroundColor:
                similarityPercent >= 90
                  ? 'rgba(218, 54, 51, 0.15)'
                  : 'rgba(210, 153, 34, 0.15)',
              color:
                similarityPercent >= 90
                  ? 'var(--color-danger-fg)'
                  : 'var(--color-attention-fg)',
              border: `1px solid ${
                similarityPercent >= 90
                  ? 'var(--color-danger-fg)'
                  : 'var(--color-attention-fg)'
              }`,
            }}
          >
            {similarityPercent}% Match
          </span>
        )}
      </div>

      <div
        style={{
          maxHeight: '320px',
          overflowY: 'auto',
          lineHeight: '1.45',
        }}
      >
        {diffSummary.chunks.map((line: DiffLine, idx: number) => {
          const isAdded = line.type === 'added';
          const isRemoved = line.type === 'removed';

          const bgColor = isAdded
            ? 'rgba(46, 160, 67, 0.15)'
            : isRemoved
            ? 'rgba(248, 81, 73, 0.15)'
            : 'transparent';

          const textColor = isAdded
            ? 'var(--color-success-fg)'
            : isRemoved
            ? 'var(--color-danger-fg)'
            : 'var(--color-fg-default)';

          const prefix = isAdded ? '+' : isRemoved ? '-' : ' ';

          return (
            <div
              key={idx}
              style={{
                display: 'flex',
                padding: '2px 8px',
                backgroundColor: bgColor,
                color: textColor,
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-all',
              }}
            >
              <span
                style={{
                  userSelect: 'none',
                  width: '16px',
                  display: 'inline-block',
                  color: 'var(--color-fg-muted)',
                }}
              >
                {prefix}
              </span>
              <span>{line.value}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
