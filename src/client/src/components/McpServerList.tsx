import React, { useState } from 'react';
import { McpServerManifest } from '../../../core/types.js';
import { StorageStatusBadge } from './StorageStatusBadge.js';

export interface McpServerListProps {
  servers: McpServerManifest[];
  onSelectServer?: (server: McpServerManifest) => void;
  onGenerateSubset?: () => Promise<void> | void;
  onToggleEnabled?: (server: McpServerManifest, enabled: boolean) => Promise<void> | void;
  onCentralizeServer?: (server: McpServerManifest) => Promise<void> | void;
  onDiscoverServer?: (server: McpServerManifest) => Promise<void> | void;
}

/**
 * Renders the Model Context Protocol (MCP) servers panel within a Primer Box.
 */
export const McpServerList: React.FC<McpServerListProps> = ({
  servers,
  onSelectServer,
  onGenerateSubset,
  onToggleEnabled,
  onCentralizeServer,
  onDiscoverServer,
}) => {
  const [isGenerating, setIsGenerating] = useState(false);
  const [discoveringMap, setDiscoveringMap] = useState<Record<string, boolean>>({});

  const handleDiscover = async (server: McpServerManifest) => {
    if (!onDiscoverServer) return;
    setDiscoveringMap((prev) => ({ ...prev, [server.name]: true }));
    try {
      await onDiscoverServer(server);
    } finally {
      setDiscoveringMap((prev) => ({ ...prev, [server.name]: false }));
    }
  };

  const handleGenerate = async () => {
    if (!onGenerateSubset) return;
    setIsGenerating(true);
    try {
      await onGenerateSubset();
    } finally {
      setIsGenerating(false);
    }
  };

  const enabledCount = servers.filter((s) => s.enabled !== false).length;

  return (
    <div>
      {/* Top Action Bar for MCP Management */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '16px',
          padding: '12px 16px',
          backgroundColor: 'var(--color-canvas-default)',
          border: '1px solid var(--color-border-default)',
          borderRadius: 'var(--border-radius-medium)',
        }}
      >
        <div>
          <span style={{ fontWeight: 600, fontSize: '14px' }}>MCP Registry Sync</span>
          <span style={{ fontSize: '12px', color: 'var(--color-fg-muted)', marginLeft: '8px' }}>
            {enabledCount} of {servers.length} servers enabled
          </span>
        </div>
        {onGenerateSubset && (
          <button
            type="button"
            className="Btn Btn-primary"
            onClick={handleGenerate}
            disabled={isGenerating}
            style={{ fontSize: '13px', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
          >
            {isGenerating ? 'Generating...' : '⚡ Generate agents_mcp/servers.json'}
          </button>
        )}
      </div>

      <div className="Box">
        <div className="Box-header">
          <span className="Box-title">Active Model Context Protocol Servers</span>
          <span style={{ fontSize: '12px', color: 'var(--color-fg-muted)' }}>
            {servers.length} servers configured
          </span>
        </div>
        {servers.map((mcp) => {
          const isEnabled = mcp.enabled !== false;
          return (
            <div
              key={mcp.id}
              className="Box-row"
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: '16px',
              }}
            >
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px', flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    onClick={() => onSelectServer?.(mcp)}
                    style={{
                      background: 'none',
                      border: 'none',
                      padding: 0,
                      fontWeight: 600,
                      color: 'var(--color-accent-fg)',
                      cursor: 'pointer',
                      fontSize: '14px',
                      textAlign: 'left',
                    }}
                  >
                    {mcp.title || mcp.name}
                  </button>
                  {mcp.title && mcp.title !== mcp.name && (
                    <span style={{ fontSize: '12px', color: 'var(--color-fg-muted)' }}>
                      ({mcp.name})
                    </span>
                  )}
                  {mcp.version && (
                    <span
                      className="Label Label--secondary"
                      style={{ fontSize: '11px' }}
                    >
                      v{mcp.version}
                    </span>
                  )}
                  <StorageStatusBadge status={mcp.status || 'original'} />
                  <span
                    className="Label"
                    style={{
                      fontSize: '11px',
                      backgroundColor: isEnabled ? 'var(--color-success-subtle)' : 'var(--color-counter-bg)',
                      color: isEnabled ? 'var(--color-success-emphasis)' : 'var(--color-fg-muted)',
                    }}
                  >
                    {isEnabled ? 'Enabled' : 'Disabled'}
                  </span>
                </div>
                {mcp.description && (
                  <div
                    style={{
                      fontSize: '12px',
                      color: 'var(--color-fg-muted)',
                      marginBottom: '4px',
                      lineHeight: 1.4,
                    }}
                  >
                    {mcp.description}
                  </div>
                )}
                <div style={{ fontSize: '12px', color: 'var(--color-fg-muted)' }}>
                  Transport: {mcp.transport} | Command: <code>{mcp.command}</code>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span className="Label Label--accent">{mcp.declaredToolsCount} tools</span>

                {onDiscoverServer && mcp.command && (
                  <button
                    type="button"
                    className="Btn"
                    style={{ fontSize: '12px', padding: '3px 8px' }}
                    onClick={() => handleDiscover(mcp)}
                    disabled={Boolean(discoveringMap[mcp.name])}
                  >
                    {discoveringMap[mcp.name] ? 'Discovering...' : 'Discover'}
                  </button>
                )}

                {onToggleEnabled && (
                  <button
                    type="button"
                    className="Btn"
                    style={{ fontSize: '12px', padding: '3px 8px' }}
                    onClick={() => onToggleEnabled(mcp, !isEnabled)}
                  >
                    {isEnabled ? 'Disable' : 'Enable'}
                  </button>
                )}

                {onCentralizeServer && mcp.status !== 'centralized' && (
                  <button
                    type="button"
                    className="Btn"
                    style={{
                      fontSize: '12px',
                      padding: '3px 8px',
                      backgroundColor: 'var(--color-accent-subtle)',
                      color: 'var(--color-accent-fg)',
                    }}
                    onClick={() => onCentralizeServer(mcp)}
                  >
                    Centralize
                  </button>
                )}

                {onSelectServer && (
                  <button
                    type="button"
                    className="Btn"
                    style={{ fontSize: '12px', padding: '3px 8px' }}
                    onClick={() => onSelectServer(mcp)}
                  >
                    Details →
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

