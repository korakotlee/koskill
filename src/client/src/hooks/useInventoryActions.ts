import { useState } from 'react';
import { SkillManifest, WorkflowManifest, McpServerManifest } from '../../../core/types.js';

export interface FlashState {
  message: string;
  type: 'success' | 'warn' | 'danger';
}

export interface UseInventoryActionsOptions {
  setSelectedSkill?: React.Dispatch<React.SetStateAction<SkillManifest | null>>;
  setSelectedWorkflow?: React.Dispatch<React.SetStateAction<WorkflowManifest | null>>;
  setSelectedMcp?: React.Dispatch<React.SetStateAction<McpServerManifest | null>>;
}

export function useInventoryActions(
  fetchInventory: () => Promise<void>,
  options?: UseInventoryActionsOptions
) {
  const [flash, setFlash] = useState<FlashState | null>(null);

  const handleCentralizeSkill = async (skill: SkillManifest) => {
    try {
      const res = await fetch(`/api/skills/${encodeURIComponent(skill.id)}/centralize`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to centralize skill');
      setFlash({ message: `Skill ${skill.name} centralized successfully.`, type: 'success' });
      options?.setSelectedSkill?.((prev) =>
        prev && prev.id === skill.id
          ? {
              ...prev,
              status: 'centralized',
              targetPath: data.skill?.centralPath || prev.targetPath,
            }
          : prev
      );
      await fetchInventory();
    } catch (err: any) {
      setFlash({ message: err.message, type: 'danger' });
    }
  };

  const handleRevertSkill = async (skill: SkillManifest) => {
    try {
      const res = await fetch(`/api/skills/${encodeURIComponent(skill.id)}/revert`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to revert skill');
      setFlash({ message: `Skill ${skill.name} reverted to original location.`, type: 'success' });
      options?.setSelectedSkill?.((prev) =>
        prev && prev.id === skill.id
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

  const handleBatchCentralize = async (skillIds: string[]) => {
    try {
      const res = await fetch('/api/skills/batch/centralize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ skillIds }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Batch centralization failed');
      setFlash({
        message: `Batch centralize: ${data.succeeded} succeeded, ${data.failed} failed.`,
        type: data.failed > 0 ? 'warn' : 'success',
      });
      await fetchInventory();
    } catch (err: any) {
      setFlash({ message: err.message, type: 'danger' });
    }
  };

  const handleBatchRevert = async (skillIds: string[]) => {
    try {
      const res = await fetch('/api/skills/batch/revert', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ skillIds }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Batch revert failed');
      setFlash({
        message: `Batch revert: ${data.succeeded} succeeded, ${data.failed} failed.`,
        type: data.failed > 0 ? 'warn' : 'success',
      });
      await fetchInventory();
    } catch (err: any) {
      setFlash({ message: err.message, type: 'danger' });
    }
  };

  const handleCentralizeWorkflow = async (workflow: WorkflowManifest) => {
    try {
      const res = await fetch(`/api/workflows/${encodeURIComponent(workflow.id)}/centralize`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to centralize workflow');
      setFlash({ message: `Workflow ${workflow.name} centralized successfully.`, type: 'success' });
      options?.setSelectedWorkflow?.((prev) =>
        prev && prev.id === workflow.id
          ? {
              ...prev,
              status: 'centralized',
              targetPath: data.workflow?.centralPath || prev.targetPath,
            }
          : prev
      );
      await fetchInventory();
    } catch (err: any) {
      setFlash({ message: err.message, type: 'danger' });
    }
  };

  const handleRevertWorkflow = async (workflow: WorkflowManifest) => {
    try {
      const res = await fetch(`/api/workflows/${encodeURIComponent(workflow.id)}/revert`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to revert workflow');
      setFlash({ message: `Workflow ${workflow.name} reverted to original location.`, type: 'success' });
      options?.setSelectedWorkflow?.((prev) =>
        prev && prev.id === workflow.id
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

  const handleCentralizeMcp = async (server: McpServerManifest) => {
    try {
      const res = await fetch(`/api/mcp/${encodeURIComponent(server.name)}/centralize`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to centralize MCP server');
      setFlash({ message: `MCP server ${server.name} registered in central store.`, type: 'success' });
      options?.setSelectedMcp?.((prev) =>
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
      options?.setSelectedMcp?.((prev) =>
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
      options?.setSelectedMcp?.((prev) =>
        prev && (prev.id === server.id || prev.name === server.name)
          ? {
              ...prev,
              status: 'centralized',
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
        options?.setSelectedMcp?.((prev) =>
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
    flash,
    setFlash,
    handleCentralizeSkill,
    handleRevertSkill,
    handleBatchCentralize,
    handleBatchRevert,
    handleCentralizeWorkflow,
    handleRevertWorkflow,
    handleCentralizeMcp,
    handleToggleMcp,
    handleGenerateMcpSubset,
    handleQueryMcpTools,
    handleDiscoverMcp,
    handleDiscoverAllMcp,
  };
}
