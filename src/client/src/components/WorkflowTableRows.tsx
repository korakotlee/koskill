import React from 'react';
import { WorkflowManifest } from '../../../core/types.js';
import { StorageStatusBadge } from './StorageStatusBadge.js';
import { SymlinkActions } from './SymlinkActions.js';
import { EntityToggleSwitch } from './EntityToggleSwitch.js';

export interface WorkflowTableRowsProps {
  workflows: WorkflowManifest[];
  onSelectWorkflow?: (workflow: WorkflowManifest) => void;
  onCentralizeWorkflow?: (workflow: WorkflowManifest) => void;
  onRevertWorkflow?: (workflow: WorkflowManifest) => void;
  onToggleWorkflow?: (workflow: WorkflowManifest, enabled: boolean) => void;
}

/**
 * Renders inventory table rows for discovered workflows and slash commands.
 */
export const WorkflowTableRows: React.FC<WorkflowTableRowsProps> = ({
  workflows,
  onSelectWorkflow,
  onCentralizeWorkflow,
  onRevertWorkflow,
  onToggleWorkflow,
}) => {
  return (
    <>
      {workflows.map((workflow) => {
        const isGemini = workflow.targetEcosystem === 'gemini';
        const badgeClass = isGemini ? 'Label Label--accent' : 'Label Label--done';

        return (
          <div
            key={workflow.id}
            className="Box-row"
            style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '16px' }}
          >
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                <button
                  type="button"
                  onClick={() => onSelectWorkflow?.(workflow)}
                  style={{
                    background: 'none',
                    border: 'none',
                    padding: 0,
                    font: 'inherit',
                    fontWeight: 600,
                    color: 'var(--color-accent-fg)',
                    cursor: 'pointer',
                  }}
                >
                  <code>{workflow.command}</code>
                </button>
                <span className={badgeClass}>{workflow.targetEcosystem}</span>
                <StorageStatusBadge status={workflow.status || 'original'} />
                <EntityToggleSwitch
                  entityType="workflows"
                  id={workflow.name}
                  enabled={workflow.status !== 'inactive'}
                  onToggle={(targetState) => onToggleWorkflow?.(workflow, targetState)}
                />
                <span className="Label Label--secondary">{workflow.scope}</span>
                {workflow.metadata?.argumentHint && (
                  <span style={{ fontSize: '12px', color: 'var(--color-fg-muted)', fontFamily: 'monospace' }}>
                    {workflow.metadata.argumentHint}
                  </span>
                )}
              </div>

              {workflow.description && (
                <div style={{ fontSize: '12px', color: 'var(--color-fg-muted)', marginBottom: '4px' }}>
                  {workflow.description}
                </div>
              )}

              <div style={{ fontFamily: 'monospace', fontSize: '11px', color: 'var(--color-fg-muted)' }}>
                {workflow.sourcePath}
              </div>
            </div>

            {(onCentralizeWorkflow || onRevertWorkflow) && (
              <SymlinkActions
                skill={workflow as any}
                onCentralize={() => onCentralizeWorkflow?.(workflow)}
                onRevert={() => onRevertWorkflow?.(workflow)}
                variant="row"
              />
            )}
          </div>
        );
      })}
    </>
  );
};
