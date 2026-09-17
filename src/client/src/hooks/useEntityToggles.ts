import { SkillManifest, WorkflowManifest, McpServerManifest } from '../../../core/types.js';
import { FlashState } from './useInventoryActions.js';

export interface UseEntityTogglesOptions {
  fetchInventory: () => Promise<void>;
  setFlash: (flash: FlashState | null) => void;
  setSelectedSkill?: React.Dispatch<React.SetStateAction<SkillManifest | null>>;
  setSelectedWorkflow?: React.Dispatch<React.SetStateAction<WorkflowManifest | null>>;
  setSelectedMcp?: React.Dispatch<React.SetStateAction<McpServerManifest | null>>;
}

export function useEntityToggles({
  fetchInventory,
  setFlash,
  setSelectedSkill,
  setSelectedWorkflow,
}: UseEntityTogglesOptions) {
  const handleToggleSkill = async (skill: SkillManifest, enabled: boolean) => {
    try {
      const res = await fetch(`/api/skills/${encodeURIComponent(skill.name)}/toggle`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          enabled,
          targetPath: skill.targetPath || skill.sourcePath,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to toggle skill');
      setFlash({
        message: `Skill ${skill.name} ${enabled ? 'enabled' : 'disabled'}.`,
        type: 'success',
      });
      setSelectedSkill?.((prev) =>
        prev && (prev.id === skill.id || prev.name === skill.name)
          ? {
              ...prev,
              status: enabled ? (prev.status === 'inactive' ? 'original' : prev.status) : 'inactive',
            }
          : prev
      );
      await fetchInventory();
    } catch (err: any) {
      setFlash({ message: err.message, type: 'danger' });
    }
  };

  const handleToggleWorkflow = async (workflow: WorkflowManifest, enabled: boolean) => {
    try {
      const res = await fetch(`/api/workflows/${encodeURIComponent(workflow.name)}/toggle`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          enabled,
          targetPath: workflow.targetPath || workflow.sourcePath,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to toggle workflow');
      setFlash({
        message: `Workflow ${workflow.name} ${enabled ? 'enabled' : 'disabled'}.`,
        type: 'success',
      });
      setSelectedWorkflow?.((prev) =>
        prev && (prev.id === workflow.id || prev.name === workflow.name)
          ? {
              ...prev,
              status: enabled ? (prev.status === 'inactive' ? 'original' : prev.status) : 'inactive',
            }
          : prev
      );
      await fetchInventory();
    } catch (err: any) {
      setFlash({ message: err.message, type: 'danger' });
    }
  };

  return {
    handleToggleSkill,
    handleToggleWorkflow,
  };
}
