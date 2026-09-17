import React from 'react';
import { McpServerManifest } from '../../../core/types.js';
import { StorageStatusBadge } from './StorageStatusBadge.js';

export interface McpConfigSidebarProps {
  server: McpServerManifest;
}

export const McpConfigSidebar: React.FC<McpConfigSidebarProps> = ({ server }) => {
  return (
    <div style={{ flex: '0 1 340px', minWidth: '280px' }}>
      <div className="Box">
        <div className="Box-header">
          <span className="Box-title">Server Configuration</span>
        </div>

        <div className="Box-row" style={{ display: 'block' }}>
          <div style={{ fontSize: '12px', color: 'var(--color-fg-muted)', marginBottom: '4px' }}>
            Command
          </div>
          <div
            style={{
              fontFamily: 'monospace',
              fontSize: '12px',
              backgroundColor: 'var(--color-canvas-subtle)',
              padding: '6px 8px',
              borderRadius: 'var(--border-radius-small)',
              wordBreak: 'break-all',
            }}
          >
            {server.command || '<none>'}
          </div>
        </div>

        {server.args && server.args.length > 0 && (
          <div className="Box-row" style={{ display: 'block' }}>
            <div style={{ fontSize: '12px', color: 'var(--color-fg-muted)', marginBottom: '4px' }}>
              Arguments
            </div>
            <div
              style={{
                fontFamily: 'monospace',
                fontSize: '12px',
                backgroundColor: 'var(--color-canvas-subtle)',
                padding: '6px 8px',
                borderRadius: 'var(--border-radius-small)',
                wordBreak: 'break-all',
              }}
            >
              {server.args.join(' ')}
            </div>
          </div>
        )}

        {server.version && (
          <div className="Box-row">
            <span style={{ fontSize: '13px', color: 'var(--color-fg-muted)' }}>Version</span>
            <span style={{ fontWeight: 600 }}>{server.version}</span>
          </div>
        )}

        <div className="Box-row">
          <span style={{ fontSize: '13px', color: 'var(--color-fg-muted)' }}>Transport Protocol</span>
          <span style={{ fontWeight: 600 }}>{server.transport}</span>
        </div>

        <div className="Box-row">
          <span style={{ fontSize: '13px', color: 'var(--color-fg-muted)' }}>Protocol Support</span>
          <span style={{ fontWeight: 600 }}>server/discover, initialize</span>
        </div>

        <div className="Box-row">
          <span style={{ fontSize: '13px', color: 'var(--color-fg-muted)' }}>Declared Tools</span>
          <span style={{ fontWeight: 600 }}>{server.declaredToolsCount}</span>
        </div>

        {server.lastDiscoveredAt && (
          <div className="Box-row">
            <span style={{ fontSize: '13px', color: 'var(--color-fg-muted)' }}>Last Discovered</span>
            <span style={{ fontSize: '12px', color: 'var(--color-fg-muted)' }}>
              {new Date(server.lastDiscoveredAt).toLocaleDateString()}
            </span>
          </div>
        )}

        <div className="Box-row">
          <span style={{ fontSize: '13px', color: 'var(--color-fg-muted)' }}>Registry Status</span>
          <StorageStatusBadge status={server.status || 'original'} />
        </div>

        {server.env && Object.keys(server.env).length > 0 && (
          <div className="Box-row" style={{ display: 'block' }}>
            <div style={{ fontSize: '12px', color: 'var(--color-fg-muted)', marginBottom: '6px' }}>
              Environment Variables
            </div>
            <div style={{ fontSize: '12px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
              {Object.entries(server.env).map(([k, v]) => (
                <div key={k}>
                  <span style={{ fontWeight: 700 }}>{k}</span>: <span style={{ fontWeight: 400 }}>{String(v)}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
