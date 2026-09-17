import React, { useState, useEffect } from 'react';
import { McpServerManifest } from '../../../core/types.js';
import { StorageStatusBadge } from './StorageStatusBadge.js';
import { McpConfigSidebar } from './McpConfigSidebar.js';

export interface McpDetailViewProps {
  server: McpServerManifest;
  onBack: () => void;
  onToggleEnabled?: (server: McpServerManifest, enabled: boolean) => Promise<void> | void;
  onCentralize?: (server: McpServerManifest) => Promise<void> | void;
  onQueryTools?: (server: McpServerManifest) => Promise<any> | void;
}

/**
 * Detailed view for an MCP Server, displaying configuration metadata and available tools.
 */
export const McpDetailView: React.FC<McpDetailViewProps> = ({
  server,
  onBack,
  onToggleEnabled,
  onCentralize,
  onQueryTools,
}) => {
  const [isUpdating, setIsUpdating] = useState(false);
  const [isQueryingTools, setIsQueryingTools] = useState(false);
  const [queryError, setQueryError] = useState<string | null>(null);

  const isEnabled = server.enabled !== false;
  const isCentralized = server.status === 'centralized';
  const tools = server.tools || [];

  // Auto-query tools if none are cached, server is active, and command is configured
  useEffect(() => {
    let active = true;
    if (onQueryTools && tools.length === 0 && isEnabled && server.command && !isQueryingTools) {
      setIsQueryingTools(true);
      setQueryError(null);
      Promise.resolve(onQueryTools(server))
        .catch((err: any) => {
          if (active) setQueryError(err.message || 'Failed to query MCP tools');
        })
        .finally(() => {
          if (active) setIsQueryingTools(false);
        });
    }
    return () => {
      active = false;
    };
  }, [server.id, server.name, tools.length, isEnabled, server.command]);

  const handleToggle = async () => {
    if (!onToggleEnabled) return;
    setIsUpdating(true);
    try {
      await onToggleEnabled(server, !isEnabled);
    } finally {
      setIsUpdating(false);
    }
  };

  const handleCentralize = async () => {
    if (!onCentralize) return;
    setIsUpdating(true);
    try {
      await onCentralize(server);
    } finally {
      setIsUpdating(false);
    }
  };

  const handleManualQuery = async () => {
    if (!onQueryTools) return;
    setIsQueryingTools(true);
    setQueryError(null);
    try {
      await onQueryTools(server);
    } catch (err: any) {
      setQueryError(err.message || 'Failed to query MCP tools');
    } finally {
      setIsQueryingTools(false);
    }
  };

  return (
    <div>
      {/* Breadcrumb Navigation & Top Actions */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
        <button
          type="button"
          onClick={onBack}
          className="Btn"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            color: 'var(--color-accent-fg)',
            fontWeight: 500,
          }}
        >
          &larr; Back to MCP Servers
        </button>

        <div style={{ display: 'flex', gap: '8px' }}>
          {onQueryTools && server.command && (
            <button
              type="button"
              className="Btn"
              onClick={handleManualQuery}
              disabled={isQueryingTools}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                fontWeight: 600,
              }}
            >
              {isQueryingTools ? 'Querying Tools...' : 'Refresh Tools'}
            </button>
          )}

          {!isCentralized && onCentralize && (
            <button
              type="button"
              className="Btn"
              onClick={handleCentralize}
              disabled={isUpdating}
              style={{
                backgroundColor: 'var(--color-accent-subtle)',
                color: 'var(--color-accent-fg)',
                borderColor: 'var(--color-accent-fg)',
                fontWeight: 600,
              }}
            >
              {isUpdating ? 'Saving...' : 'Centralize Server'}
            </button>
          )}

          {onToggleEnabled && (
            <button
              type="button"
              className="Btn"
              onClick={handleToggle}
              disabled={isUpdating}
              style={{
                backgroundColor: isEnabled ? 'var(--color-success-subtle)' : 'var(--color-canvas-subtle)',
                color: isEnabled ? 'var(--color-success-emphasis)' : 'var(--color-fg-muted)',
                borderColor: isEnabled ? 'var(--color-success-fg)' : 'var(--color-border-default)',
                fontWeight: 600,
              }}
            >
              {isUpdating ? 'Updating...' : isEnabled ? '✓ Server Enabled' : '○ Server Disabled'}
            </button>
          )}
        </div>
      </div>

      {/* Header Info */}
      <div style={{ display: 'flex', alignItems: 'baseline', gap: '12px', marginBottom: '16px', flexWrap: 'wrap' }}>
        <h2 style={{ fontSize: '24px', fontWeight: 600, margin: 0 }}>
          {server.name}
        </h2>
        <span className="Label Label--accent">{server.transport}</span>
        <StorageStatusBadge status={server.status || 'original'} />
        <span
          className="Label"
          style={{
            backgroundColor: isEnabled ? 'var(--color-success-subtle)' : 'var(--color-counter-bg)',
            color: isEnabled ? 'var(--color-success-emphasis)' : 'var(--color-fg-muted)',
          }}
        >
          {isEnabled ? 'Active' : 'Disabled'}
        </span>
      </div>

      <p style={{ color: 'var(--color-fg-muted)', marginBottom: '24px', fontSize: '15px' }}>
        Configured MCP server daemon exposing {server.declaredToolsCount} automated tool capabilities.
      </p>

      {/* Two-Column Responsive Layout */}
      <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap', alignItems: 'flex-start' }}>
        {/* Main Tools Panel (65%) */}
        <div style={{ flex: '1 1 600px', minWidth: '320px' }}>
          <div className="Box">
            <div className="Box-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span className="Box-title">Tools & Capabilities</span>
              <span style={{ fontSize: '12px', color: 'var(--color-fg-muted)' }}>
                {tools.length} declared tools
              </span>
            </div>

            {queryError && (
              <div
                style={{
                  margin: '12px 16px',
                  padding: '8px 12px',
                  borderRadius: '6px',
                  backgroundColor: 'rgba(218, 54, 51, 0.1)',
                  color: 'var(--color-danger-fg)',
                  fontSize: '13px',
                }}
              >
                <strong>Query Warning:</strong> {queryError}
              </div>
            )}

            {isQueryingTools ? (
              <div style={{ padding: '32px', textAlign: 'center', color: 'var(--color-fg-muted)' }}>
                Connecting to MCP server process and querying tool list...
              </div>
            ) : tools.length > 0 ? (
              <div>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', margin: 0 }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--color-border-muted)', backgroundColor: 'var(--color-canvas-subtle)' }}>
                      <th style={{ padding: '10px 16px', textAlign: 'left', fontWeight: 600, width: '220px' }}>Tool Name</th>
                      <th style={{ padding: '10px 16px', textAlign: 'left', fontWeight: 600 }}>Description</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tools.map((tool, idx) => (
                      <tr
                        key={tool.name + idx}
                        style={{
                          borderBottom: idx < tools.length - 1 ? '1px solid var(--color-border-muted)' : 'none',
                        }}
                      >
                        <td style={{ padding: '10px 16px', verticalAlign: 'top' }}>
                          <span style={{ fontWeight: 700, color: 'var(--color-fg-default)' }}>
                            {tool.name}
                          </span>
                        </td>
                        <td style={{ padding: '10px 16px', verticalAlign: 'top', color: 'var(--color-fg-default)', fontWeight: 400 }}>
                          {tool.description || (
                            <span style={{ color: 'var(--color-fg-muted)', fontStyle: 'italic' }}>
                              No description provided
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div style={{ padding: '24px', color: 'var(--color-fg-muted)', fontStyle: 'italic' }}>
                No tool declarations found for this server. Click "Refresh Tools" above to query the running server process.
              </div>
            )}
          </div>
        </div>

        {/* Metadata Sidebar (35%) */}
        <McpConfigSidebar server={server} />
      </div>
    </div>
  );
};
