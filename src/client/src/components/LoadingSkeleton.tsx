import React from 'react';

export interface SkeletonProps {
  width?: string | number;
  height?: string | number;
  borderRadius?: string | number;
  className?: string;
  style?: React.CSSProperties;
}

/**
 * Basic pulsing skeleton bar element.
 */
export function Skeleton({
  width = '100%',
  height = '16px',
  borderRadius = '4px',
  className = '',
  style = {}
}: SkeletonProps): React.ReactElement {
  return (
    <div
      className={`skeleton-pulse ${className}`}
      style={{
        width,
        height,
        borderRadius,
        backgroundColor: 'var(--color-neutral-muted, rgba(128, 128, 128, 0.2))',
        ...style
      }}
    />
  );
}

/**
 * Table row skeleton with configurable column counts.
 */
export function SkeletonRow({ columns = 4 }: { columns?: number }): React.ReactElement {
  return (
    <tr className="skeleton-row">
      {Array.from({ length: columns }).map((_, i) => (
        <td key={i} style={{ padding: '12px 16px' }}>
          <Skeleton height="14px" width={i === 0 ? '40%' : i === columns - 1 ? '60px' : '75%'} />
        </td>
      ))}
    </tr>
  );
}

/**
 * Skeleton placeholder for card metrics and overview boxes.
 */
export function SkeletonCard(): React.ReactElement {
  return (
    <div className="Box p-3 skeleton-card" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      <Skeleton width="40%" height="18px" />
      <Skeleton width="80%" height="12px" />
      <Skeleton width="60%" height="12px" />
    </div>
  );
}

/**
 * Skeleton placeholder for inventory tables during loading/refreshing.
 */
export function SkeletonTable({ rows = 5, columns = 4 }: { rows?: number; columns?: number }): React.ReactElement {
  return (
    <tbody className="skeleton-table-body">
      {Array.from({ length: rows }).map((_, i) => (
        <SkeletonRow key={i} columns={columns} />
      ))}
    </tbody>
  );
}
