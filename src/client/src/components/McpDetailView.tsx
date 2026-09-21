import React, { useState, useEffect } from 'react';
import { McpServerManifest } from '../../../core/types.js';
import { StorageStatusBadge } from './StorageStatusBadge.js';
import { McpConfigSidebar } from './McpConfigSidebar.js';
import { McpToolsTable } from './McpToolsTable.js';
import { MarkdownViewer } from './MarkdownViewer.js';
import { EntityToggleSwitch } from './EntityToggleSwitch.js';

export interface McpDetailViewProps {
  server: McpServerManifest;
  onBack: () => void;
  onToggleEnabled?: (server: McpServerManifest, enabled: boolean) => Promise<void> | void;
  onCentralize?: (server: McpServerManifest) => Promise<void> | void;
  onRevert?: (server: McpServerManifest) => Promise<void> | void;
  onQueryTools?: (server: McpServerManifest) => Promise<any> | void;
  onDiscoverServer?: (server: McpServerManifest) => Promise<any> | void;
}

/**
 * Detailed view for an MCP Server, displaying overview, instructions, metadata, and tools.
 */
export const McpDetailView: React.FC<McpDetailViewProps> = ({
  server,
  onBack,
  onToggleEnabled,
  onCentralize,
  onRevert,
  onQueryTools,
  onDiscoverServer,
}) => {
  const [isUpdating, setIsUpdating] = useState(false);
  const [isQueryingTools, setIsQueryingTools] = useState(false);
  const [isDiscovering, setIsDiscovering] = useState(false);
  const [queryError, setQueryError] = useState<string | null>(null);

  const isEnabled = server.enabled !== false;
  const isCentralized = server.status === 'centralized';
  const tools = server.tools || [];
  const displayName = server.title || server.name;

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

  const handleRevert = async () => {
    if (!onRevert) return;
    setIsUpdating(true);
    try {
      await onRevert(server);
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

  const handleDiscover = async () => {
    if (!onDiscoverServer) return;
    setIsDiscovering(true);
    setQueryError(null);
    try {
      await onDiscoverServer(server);
    } catch (err: any) {
      setQueryError(err.message || 'Failed to discover MCP server metadata');
    } finally {
      setIsDiscovering(false);
    }
  };

  return (
    <div>
      {/* Breadcrumb Navigation & Top Actions */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px', flexWrap: 'wrap', gap: '8px' }}>
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

        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          {onDiscoverServer && server.command && (
            <button
              type="button"
              className="Btn"
              onClick={handleDiscover}
              disabled={isDiscovering}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                fontWeight: 600,
              }}
            >
              {isDiscovering ? 'Discovering...' : 'Discover Server'}
            </button>
          )}

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

          {isCentralized && onRevert && (
            <button
              type="button"
              className="Btn"
              onClick={handleRevert}
              disabled={isUpdating}
              style={{
                fontSize: '13px',
                fontWeight: 600,
              }}
            >
              {isUpdating ? 'Reverting...' : 'Revert to Original'}
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
      <div style={{ display: 'flex', alignItems: 'baseline', gap: '12px', marginBottom: '12px', flexWrap: 'wrap' }}>
        <h2 style={{ fontSize: '24px', fontWeight: 600, margin: 0 }}>
          {displayName}
        </h2>
        {server.title && server.title !== server.name && (
          <span style={{ fontSize: '14px', color: 'var(--color-fg-muted)' }}>
            ({server.name})
          </span>
        )}
        {server.version && (
          <span className="Label Label--secondary" style={{ fontSize: '12px' }}>
            v{server.version}
          </span>
        )}
        <span className="Label Label--accent">{server.transport}</span>
        <StorageStatusBadge status={server.status || 'original'} />
        {onToggleEnabled && (
          <EntityToggleSwitch
            entityType="mcp-servers"
            id={server.name}
            enabled={isEnabled}
            isLoading={isUpdating}
            onToggle={(targetState) => onToggleEnabled(server, targetState)}
          />
        )}
      </div>

      {/* Two-Column Responsive Layout */}
      <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap', alignItems: 'flex-start' }}>
        {/* Left Column (65%) */}
        <div style={{ flex: '1 1 600px', minWidth: '320px' }}>
          {/* Server Overview Card */}
          <div className="Box" style={{ marginBottom: '20px' }}>
            <div className="Box-header">
              <span className="Box-title">Server Overview</span>
            </div>
            <div className="Box-body" style={{ padding: '16px', lineHeight: 1.6, fontSize: '14px' }}>
              {server.description ? (
                <p style={{ margin: 0, color: 'var(--color-fg-default)' }}>{server.description}</p>
              ) : (
                <p style={{ margin: 0, color: 'var(--color-fg-muted)', fontStyle: 'italic' }}>
                  No description discovered yet. Click "Discover Server" to probe server metadata.
                </p>
              )}
            </div>
          </div>

          {/* Agent Instructions Card */}
          <div className="Box" style={{ marginBottom: '20px' }}>
            <div className="Box-header">
              <span className="Box-title">Agent Instructions</span>
            </div>
            <div className="Box-body" style={{ padding: '16px' }}>
              {server.instructions ? (
                <MarkdownViewer content={server.instructions} />
              ) : (
                <p style={{ margin: 0, color: 'var(--color-fg-muted)', fontStyle: 'italic', fontSize: '13px' }}>
                  No prompt instructions reported by this server. Instructions provide agents with tool-calling conventions and guidelines.
                </p>
              )}
            </div>
          </div>

          {/* Tools & Capabilities Table */}
          <McpToolsTable
            tools={tools}
            isQuerying={isQueryingTools}
            queryError={queryError}
          />
        </div>

        {/* Metadata Sidebar (35%) */}
        <McpConfigSidebar server={server} />
      </div>
    </div>
  );
};
