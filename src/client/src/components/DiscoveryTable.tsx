import React, { useState, useMemo } from 'react';
import { SkillManifest, WorkflowManifest } from '../../../core/types.js';
import { BatchActionBar } from './BatchActionBar.js';
import { CentralizeConfirmModal, ConfirmModalItem } from './CentralizeConfirmModal.js';
import { WorkflowTableRows } from './WorkflowTableRows.js';
import { SkillTableRows } from './SkillTableRows.js';

export interface DiscoveryTableProps {
  skills?: SkillManifest[];
  workflows?: WorkflowManifest[];
  onSelectSkill?: (skill: SkillManifest) => void;
  onSelectWorkflow?: (workflow: WorkflowManifest) => void;
  onCentralizeSkill?: (skill: SkillManifest) => Promise<void> | void;
  onRevertSkill?: (skill: SkillManifest) => Promise<void> | void;
  onCentralizeWorkflow?: (workflow: WorkflowManifest) => Promise<void> | void;
  onRevertWorkflow?: (workflow: WorkflowManifest) => Promise<void> | void;
  onBatchCentralize?: (skillIds: string[]) => Promise<void> | void;
  onBatchRevert?: (skillIds: string[]) => Promise<void> | void;
  onToggleSkill?: (skill: SkillManifest, enabled: boolean) => Promise<void> | void;
  onToggleWorkflow?: (workflow: WorkflowManifest, enabled: boolean) => Promise<void> | void;
}

export const DiscoveryTable: React.FC<DiscoveryTableProps> = ({
  skills,
  workflows,
  onSelectSkill,
  onSelectWorkflow,
  onCentralizeSkill,
  onRevertSkill,
  onCentralizeWorkflow,
  onRevertWorkflow,
  onBatchCentralize,
  onBatchRevert,
  onToggleSkill,
  onToggleWorkflow,
}) => {
  const [query, setQuery] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [modalConfig, setModalConfig] = useState<{
    isOpen: boolean;
    action: 'centralize' | 'revert';
    items: ConfirmModalItem[];
  } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isWorkflowMode = Boolean(workflows);

  const filteredSkills = useMemo(() => {
    if (!skills) return [];
    const q = query.trim().toLowerCase();
    if (!q) return skills;
    return skills.filter((s) =>
      s.name.toLowerCase().includes(q) ||
      (s.description && s.description.toLowerCase().includes(q)) ||
      s.targetEcosystem.toLowerCase().includes(q) ||
      (s.sourcePath && s.sourcePath.toLowerCase().includes(q))
    );
  }, [skills, query]);

  const filteredWorkflows = useMemo(() => {
    if (!workflows) return [];
    const q = query.trim().toLowerCase();
    if (!q) return workflows;
    return workflows.filter((w) =>
      w.name.toLowerCase().includes(q) ||
      w.command.toLowerCase().includes(q) ||
      (w.description && w.description.toLowerCase().includes(q)) ||
      w.targetEcosystem.toLowerCase().includes(q) ||
      w.scope.toLowerCase().includes(q) ||
      (w.sourcePath && w.sourcePath.toLowerCase().includes(q))
    );
  }, [workflows, query]);

  const allVisibleSelected =
    !isWorkflowMode &&
    filteredSkills.length > 0 &&
    filteredSkills.every((s) => selectedIds.has(s.id));

  const toggleSelectAll = () => {
    if (allVisibleSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredSkills.map((s) => s.id)));
    }
  };

  const toggleRow = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const openSingleAction = (item: SkillManifest | WorkflowManifest, action: 'centralize' | 'revert') => {
    setModalConfig({
      isOpen: true,
      action,
      items: [{
        skillId: item.id,
        skillName: item.name,
        sourcePath: item.sourcePath,
        targetCentralPath: item.targetPath,
      }],
    });
  };

  const openBatchAction = (action: 'centralize' | 'revert') => {
    const selectedSkills = (skills || []).filter((s) => selectedIds.has(s.id));
    setModalConfig({
      isOpen: true,
      action,
      items: selectedSkills.map((s) => ({
        skillId: s.id,
        skillName: s.name,
        sourcePath: s.sourcePath,
        targetCentralPath: s.targetPath,
      })),
    });
  };

  const handleConfirmModal = async () => {
    if (!modalConfig) return;
    setIsSubmitting(true);
    try {
      if (modalConfig.items.length === 1 && modalConfig.items[0]) {
        const item = modalConfig.items[0];
        if (isWorkflowMode) {
          const wf = (workflows || []).find((w) => w.id === item.skillId);
          if (wf) {
            if (modalConfig.action === 'centralize') await onCentralizeWorkflow?.(wf);
            else await onRevertWorkflow?.(wf);
          }
        } else {
          const skill = (skills || []).find((s) => s.id === item.skillId);
          if (skill) {
            if (modalConfig.action === 'centralize') await onCentralizeSkill?.(skill);
            else await onRevertSkill?.(skill);
          }
        }
      } else {
        const ids = modalConfig.items.map((i) => i.skillId);
        if (modalConfig.action === 'centralize') await onBatchCentralize?.(ids);
        else await onBatchRevert?.(ids);
        setSelectedIds(new Set());
      }
      setModalConfig(null);
    } finally {
      setIsSubmitting(false);
    }
  };

  const itemsCount = isWorkflowMode ? (workflows?.length ?? 0) : (skills?.length ?? 0);
  const filteredCount = isWorkflowMode ? filteredWorkflows.length : filteredSkills.length;
  const placeholderText = isWorkflowMode
    ? 'Filter workflows by command, ecosystem, or path...'
    : 'Filter skills by name, ecosystem, or path...';

  return (
    <div>
      <div style={{ marginBottom: '16px', display: 'flex', gap: '12px' }}>
        <input
          type="text"
          className="Form-input"
          placeholder={placeholderText}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          style={{
            width: '100%',
            maxWidth: '480px',
            padding: '6px 12px',
            fontSize: '14px',
            borderRadius: 'var(--border-radius-small)',
            border: '1px solid var(--color-border-default)',
            backgroundColor: 'var(--color-canvas-default)',
            color: 'var(--color-fg-default)',
          }}
        />
      </div>

      {!isWorkflowMode && (
        <BatchActionBar
          selectedCount={selectedIds.size}
          onCentralizeSelected={() => openBatchAction('centralize')}
          onRevertSelected={() => openBatchAction('revert')}
          onClearSelection={() => setSelectedIds(new Set())}
          disabled={isSubmitting}
        />
      )}

      <div className="Box">
        <div
          className="Box-header"
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {!isWorkflowMode && filteredSkills.length > 0 && (
              <input
                type="checkbox"
                aria-label="Select all skills"
                checked={allVisibleSelected}
                onChange={toggleSelectAll}
                className="form-checkbox"
                style={{ cursor: 'pointer' }}
              />
            )}
            <span className="Box-title">
              {isWorkflowMode ? 'Discovered Workflows' : 'Registered Skills Inventory'}
            </span>
          </div>
          <span style={{ fontSize: '12px', color: 'var(--color-fg-muted)' }}>
            Showing {filteredCount} of {itemsCount}
          </span>
        </div>

        {filteredCount === 0 ? (
          <div className="Box-row" style={{ color: 'var(--color-fg-muted)', fontStyle: 'italic' }}>
            No matching items found.
          </div>
        ) : isWorkflowMode ? (
          <WorkflowTableRows
            workflows={filteredWorkflows}
            onSelectWorkflow={onSelectWorkflow}
            onCentralizeWorkflow={(wf) => openSingleAction(wf, 'centralize')}
            onRevertWorkflow={(wf) => openSingleAction(wf, 'revert')}
            onToggleWorkflow={onToggleWorkflow}
          />
        ) : (
          <SkillTableRows
            skills={filteredSkills}
            selectedIds={selectedIds}
            toggleRow={toggleRow}
            onSelectSkill={onSelectSkill}
            openSingleAction={openSingleAction}
            isSubmitting={isSubmitting}
            onToggleSkill={onToggleSkill}
          />
        )}
      </div>

      {modalConfig && (
        <CentralizeConfirmModal
          isOpen={modalConfig.isOpen}
          action={modalConfig.action}
          items={modalConfig.items}
          onConfirm={handleConfirmModal}
          onCancel={() => setModalConfig(null)}
          isSubmitting={isSubmitting}
        />
      )}
    </div>
  );
};
