import { useState } from 'react';
import { SkillManifest, WorkflowManifest, McpServerManifest } from '../../../core/types.js';
import { useMcpActions } from './useMcpActions.js';

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

  const {
    handleCentralizeMcp,
    handleRevertMcp,
    handleToggleMcp,
    handleGenerateMcpSubset,
    handleQueryMcpTools,
    handleDiscoverMcp,
    handleDiscoverAllMcp,
  } = useMcpActions({
    setFlash,
    fetchInventory,
    setSelectedMcp: options?.setSelectedMcp,
  });

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
    handleRevertMcp,
    handleToggleMcp,
    handleGenerateMcpSubset,
    handleQueryMcpTools,
    handleDiscoverMcp,
    handleDiscoverAllMcp,
  };
}
