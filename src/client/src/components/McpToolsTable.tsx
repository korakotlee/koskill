import React from 'react';
import { McpToolDefinition } from '../../../core/types.js';

export interface McpToolsTableProps {
  tools: McpToolDefinition[];
  isQuerying: boolean;
  queryError: string | null;
}

export const McpToolsTable: React.FC<McpToolsTableProps> = ({
  tools,
  isQuerying,
  queryError,
}) => {
  return (
    <div className="Box" style={{ marginBottom: '24px' }}>
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

      {isQuerying ? (
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
  );
};
