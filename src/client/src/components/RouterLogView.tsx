import React, { useState, useEffect } from 'react';
import { RouterTransaction, RouterMetrics } from '../../../core/router/types.js';

export interface RouterLogViewProps {
  initialLogs?: RouterTransaction[];
  initialMetrics?: RouterMetrics;
}

export const RouterLogView: React.FC<RouterLogViewProps> = ({
  initialLogs = [],
  initialMetrics = { activeServersCount: 0, totalTransactions: 0, estimatedTokensSaved: 0 },
}) => {
  const [logs, setLogs] = useState<RouterTransaction[]>(initialLogs);
  const [metrics, setMetrics] = useState<RouterMetrics>(initialMetrics);
  const [filterText, setFilterText] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<'ALL' | 'DISCOVER' | 'INVOKE_TOOL' | 'LOAD_SKILL'>('ALL');
  const [autoScroll, setAutoScroll] = useState(true);
  const [selectedTx, setSelectedTx] = useState<RouterTransaction | null>(null);

  useEffect(() => {
    // If running in browser environment with EventSource support
    if (typeof window !== 'undefined' && window.EventSource) {
      const es = new EventSource('/api/router/stream');
      es.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.logs) setLogs(data.logs);
          if (data.metrics) setMetrics(data.metrics);
        } catch {
          // ignore stream parse errors
        }
      };
      return () => {
        es.close();
      };
    }
  }, []);

  const filteredLogs = logs.filter((tx) => {
    if (categoryFilter !== 'ALL' && tx.action !== categoryFilter) return false;
    if (!filterText) return true;
    const q = filterText.toLowerCase();
    return (
      tx.id.toLowerCase().includes(q) ||
      tx.action.toLowerCase().includes(q) ||
      tx.query?.toLowerCase().includes(q) ||
      tx.targetServer?.toLowerCase().includes(q) ||
      tx.targetTool?.toLowerCase().includes(q) ||
      tx.skillName?.toLowerCase().includes(q) ||
      tx.error?.toLowerCase().includes(q)
    );
  });

  const getActionBadgeClass = (action: string) => {
    switch (action) {
      case 'DISCOVER':
        return 'badge-action badge-discover';
      case 'INVOKE_TOOL':
        return 'badge-action badge-invoke';
      case 'LOAD_SKILL':
        return 'badge-action badge-load';
      default:
        return 'badge-action';
    }
  };

  return (
    <div className="router-log-view">
      <div className="metrics-grid">
        <div className="metric-card">
          <div className="metric-label">Active Child Servers</div>
          <div className="metric-value">
            {metrics.activeServersCount} <span className="metric-sub">/ 5 max pool</span>
          </div>
        </div>
        <div className="metric-card">
          <div className="metric-label">Total Invocations</div>
          <div className="metric-value">
            {metrics.totalTransactions.toLocaleString()} <span className="metric-sub">100% routed</span>
          </div>
        </div>
        <div className="metric-card">
          <div className="metric-label">Estimated Tokens Saved</div>
          <div className="metric-value">
            {metrics.estimatedTokensSaved.toLocaleString()}{' '}
            <span className="metric-sub">context spared</span>
          </div>
        </div>
      </div>

      <div className="filter-bar">
        <input
          type="text"
          className="search-input"
          placeholder="Filter by action, target tool, query, or payload..."
          value={filterText}
          onChange={(e) => setFilterText(e.target.value)}
        />
        <button
          type="button"
          className="btn-sm"
          onClick={() => {
            const sequence: Array<'ALL' | 'DISCOVER' | 'INVOKE_TOOL' | 'LOAD_SKILL'> = [
              'ALL',
              'DISCOVER',
              'INVOKE_TOOL',
              'LOAD_SKILL',
            ];
            const nextIdx = (sequence.indexOf(categoryFilter) + 1) % sequence.length;
            setCategoryFilter(sequence[nextIdx]);
          }}
        >
          Category: {categoryFilter}
        </button>
        <button
          type="button"
          className="btn-sm"
          onClick={() => setAutoScroll((prev) => !prev)}
        >
          Auto-scroll: {autoScroll ? 'ON' : 'OFF'}
        </button>
        <button
          type="button"
          className="btn-sm"
          onClick={() => {
            setFilterText('');
            setCategoryFilter('ALL');
          }}
        >
          Clear
        </button>
        <span className="live-badge">
          <span className="pulse-dot" /> Live SSE Stream
        </span>
      </div>

      <div className="table-card">
        <table>
          <thead>
            <tr>
              <th>Time</th>
              <th>Action</th>
              <th>Target / Query</th>
              <th>Latency</th>
              <th>Tokens Saved</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {filteredLogs.length === 0 ? (
              <tr>
                <td colSpan={6} style={{ textAlign: 'center', padding: '24px' }}>
                  No transactions recorded yet.
                </td>
              </tr>
            ) : (
              filteredLogs.map((tx) => (
                <tr
                  key={tx.id}
                  onClick={() => setSelectedTx(tx)}
                  style={{ cursor: 'pointer' }}
                >
                  <td>
                    {new Date(tx.timestamp).toLocaleTimeString()}
                  </td>
                  <td>
                    <span className={getActionBadgeClass(tx.action)}>{tx.action}</span>
                  </td>
                  <td>
                    {tx.query && (
                      <span>
                        <strong>query:</strong> "{tx.query}"
                      </span>
                    )}
                    {tx.targetServer && (
                      <span>
                        <strong>{tx.targetServer}:</strong> {tx.targetTool}()
                      </span>
                    )}
                    {tx.skillName && (
                      <span>
                        <strong>skill:</strong> "{tx.skillName}"
                      </span>
                    )}
                  </td>
                  <td>
                    <span className="chip-ms">{tx.durationMs}ms</span>
                  </td>
                  <td>
                    <span className="chip-tokens">
                      +{tx.tokensSavedEstimate.toLocaleString()} tok
                    </span>
                  </td>
                  <td>
                    <span className="settled-tag">{tx.status}</span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {selectedTx && (
        <div className="drawer" role="dialog" aria-modal="true">
          <div className="drawer-header">
            <span className="drawer-title">Transaction Details</span>
            <button
              type="button"
              className="close-btn"
              aria-label="Close drawer"
              onClick={() => setSelectedTx(null)}
            >
              &times;
            </button>
          </div>
          <div style={{ marginBottom: '12px' }}>
            <div style={{ fontSize: '11px', color: 'var(--color-fg-muted)', marginBottom: '4px' }}>
              TRANSACTION ID
            </div>
            <div style={{ fontFamily: 'monospace', fontSize: '12px' }}>{selectedTx.id}</div>
          </div>
          <div style={{ marginBottom: '12px' }}>
            <div style={{ fontSize: '11px', color: 'var(--color-fg-muted)', marginBottom: '4px' }}>
              PAYLOAD & ARGUMENTS
            </div>
            <pre className="code-block">
              {JSON.stringify(selectedTx.payload || {}, null, 2)}
            </pre>
          </div>
          <div>
            <div style={{ fontSize: '11px', color: 'var(--color-fg-muted)', marginBottom: '4px' }}>
              RESULT / RETURNED CAPABILITIES
            </div>
            <pre className="code-block">
              {JSON.stringify(selectedTx.result || selectedTx.error || {}, null, 2)}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
};
