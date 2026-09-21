import React from 'react';
import { McpServerManifest } from '../../../core/types.js';

export interface UseMcpActionsOptions {
  setFlash: (flash: { message: string; type: 'success' | 'danger' } | null) => void;
  fetchInventory: () => Promise<void>;
  setSelectedMcp?: React.Dispatch<React.SetStateAction<McpServerManifest | null>>;
}

export function useMcpActions({
  setFlash,
  fetchInventory,
  setSelectedMcp,
}: UseMcpActionsOptions) {
  const handleCentralizeMcp = async (server: McpServerManifest) => {
    try {
      const res = await fetch(`/api/mcp/${encodeURIComponent(server.name)}/centralize`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to centralize MCP server');
      setFlash({ message: `MCP server ${server.name} registered in central store.`, type: 'success' });
      setSelectedMcp?.((prev) =>
        prev && (prev.id === server.id || prev.name === server.name)
          ? {
              ...prev,
              status: 'centralized',
              enabled: data.server?.enabled !== undefined ? data.server.enabled : prev.enabled,
            }
          : prev
      );
      await fetchInventory();
    } catch (err: any) {
      setFlash({ message: err.message, type: 'danger' });
    }
  };

  const handleRevertMcp = async (server: McpServerManifest) => {
    try {
      const res = await fetch(`/api/mcp/${encodeURIComponent(server.name)}/revert`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to revert MCP server');
      setFlash({ message: `MCP server ${server.name} reverted to original state.`, type: 'success' });
      setSelectedMcp?.((prev) =>
        prev && (prev.id === server.id || prev.name === server.name)
          ? {
              ...prev,
              status: 'original',
            }
          : prev
      );
      await fetchInventory();
    } catch (err: any) {
      setFlash({ message: err.message, type: 'danger' });
    }
  };

  const handleToggleMcp = async (server: McpServerManifest, enabled: boolean) => {
    try {
      const res = await fetch(`/api/mcp/${encodeURIComponent(server.name)}/toggle`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to toggle MCP server');
      setFlash({
        message: `MCP server ${server.name} ${enabled ? 'enabled' : 'disabled'}.`,
        type: 'success',
      });
      setSelectedMcp?.((prev) =>
        prev && (prev.id === server.id || prev.name === server.name)
          ? {
              ...prev,
              disabled: !enabled,
            }
          : prev
      );
      await fetchInventory();
    } catch (err: any) {
      setFlash({ message: err.message, type: 'danger' });
    }
  };

  const handleGenerateMcpSubset = async () => {
    try {
      const res = await fetch('/api/mcp/generate-subset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to generate MCP subset');
      setFlash({
        message: `Exported ${data.count} enabled MCP servers to agents_mcp/servers.json`,
        type: 'success',
      });
    } catch (err: any) {
      setFlash({ message: err.message, type: 'danger' });
    }
  };

  const handleQueryMcpTools = async (server: McpServerManifest) => {
    try {
      const res = await fetch(`/api/mcp/${encodeURIComponent(server.name)}/query-tools`, {
        method: 'POST',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to query MCP tools');
      setFlash({
        message: `Discovered ${data.count} tools from ${server.name}.`,
        type: 'success',
      });
      setSelectedMcp?.((prev) =>
        prev && (prev.id === server.id || prev.name === server.name)
          ? {
              ...prev,
              tools: data.tools || [],
              declaredToolsCount: data.count || 0,
            }
          : prev
      );
      await fetchInventory();
      return data.tools || [];
    } catch (err: any) {
      setFlash({ message: `MCP Query failed: ${err.message}`, type: 'danger' });
      throw err;
    }
  };

  const handleDiscoverMcp = async (server: McpServerManifest) => {
    try {
      const res = await fetch(`/api/mcp/${encodeURIComponent(server.name)}/discover`, {
        method: 'POST',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to discover MCP server metadata');
      setFlash({
        message: `Discovered metadata for ${data.server?.title || server.name}.`,
        type: 'success',
      });
      if (data.server) {
        setSelectedMcp?.((prev) =>
          prev && (prev.id === server.id || prev.name === server.name)
            ? { ...prev, ...data.server }
            : prev
        );
      }
      await fetchInventory();
      return data.server;
    } catch (err: any) {
      setFlash({ message: `MCP Discovery failed: ${err.message}`, type: 'danger' });
      throw err;
    }
  };

  const handleDiscoverAllMcp = async () => {
    try {
      const res = await fetch('/api/mcp/discover-all', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to discover all MCP servers');
      setFlash({
        message: `Discovered metadata for ${data.total || 0} MCP servers.`,
        type: 'success',
      });
      await fetchInventory();
      return data.results || [];
    } catch (err: any) {
      setFlash({ message: `Batch discovery failed: ${err.message}`, type: 'danger' });
      throw err;
    }
  };

  return {
    handleCentralizeMcp,
    handleRevertMcp,
    handleToggleMcp,
    handleGenerateMcpSubset,
    handleQueryMcpTools,
    handleDiscoverMcp,
    handleDiscoverAllMcp,
  };
}
