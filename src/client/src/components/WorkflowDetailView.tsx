import React, { useState } from 'react';
import { WorkflowManifest } from '../../../core/types.js';
import { MarkdownViewer } from './MarkdownViewer.js';
import { StorageStatusBadge } from './StorageStatusBadge.js';
import { SymlinkActions } from './SymlinkActions.js';
import { CentralizeConfirmModal } from './CentralizeConfirmModal.js';
import { EntityToggleSwitch } from './EntityToggleSwitch.js';

export interface WorkflowDetailViewProps {
  workflow: WorkflowManifest;
  onBack: () => void;
  onCentralizeWorkflow?: (workflow: WorkflowManifest) => Promise<void> | void;
  onRevertWorkflow?: (workflow: WorkflowManifest) => Promise<void> | void;
  onToggleWorkflow?: (workflow: WorkflowManifest, enabled: boolean) => Promise<void> | void;
}

export const WorkflowDetailView: React.FC<WorkflowDetailViewProps> = ({
  workflow,
  onBack,
  onCentralizeWorkflow,
  onRevertWorkflow,
  onToggleWorkflow,
}) => {
  const [modalAction, setModalAction] = useState<'centralize' | 'revert' | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const lineCount = workflow.rawContent ? workflow.rawContent.split('\n').length : 0;
  const isGemini = workflow.targetEcosystem === 'gemini';
  const badgeClass = isGemini ? 'Label Label--accent' : 'Label Label--done';

  const invocationSyntax = workflow.metadata?.argumentHint
    ? `${workflow.command} ${workflow.metadata.argumentHint}`
    : workflow.command;

  const handleConfirmAction = async () => {
    if (!modalAction) return;
    setIsSubmitting(true);
    try {
      if (modalAction === 'centralize') {
        await onCentralizeWorkflow?.(workflow);
      } else if (modalAction === 'revert') {
        await onRevertWorkflow?.(workflow);
      }
      setModalAction(null);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div>
      {/* Top Breadcrumb & Action Bar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '20px',
        }}
      >
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
          &larr; Back to Discovery
        </button>

        {(onCentralizeWorkflow || onRevertWorkflow) && (
          <SymlinkActions
            skill={workflow as any}
            onCentralize={() => setModalAction('centralize')}
            onRevert={() => setModalAction('revert')}
            variant="detail"
          />
        )}
      </div>

      {/* Detail Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'baseline',
          gap: '12px',
          marginBottom: '16px',
          flexWrap: 'wrap',
        }}
      >
        <h2 style={{ fontSize: '24px', fontWeight: 600, margin: 0 }}>
          <code style={{ fontSize: '24px', fontWeight: 600 }}>{workflow.command}</code>
        </h2>
        <span className={badgeClass}>{workflow.targetEcosystem}</span>
        <StorageStatusBadge status={workflow.status || 'original'} />
        {onToggleWorkflow && (
          <EntityToggleSwitch
            entityType="workflows"
            id={workflow.name}
            enabled={workflow.status !== 'inactive'}
            onToggle={(targetState) => onToggleWorkflow(workflow, targetState)}
          />
        )}
        <span className="Label Label--secondary">{workflow.scope}</span>
      </div>

      {workflow.description && (
        <p style={{ color: 'var(--color-fg-muted)', marginBottom: '24px', fontSize: '15px' }}>
          {workflow.description}
        </p>
      )}

      {/* Two-Column Responsive Layout */}
      <div
        style={{
          display: 'flex',
          gap: '24px',
          flexWrap: 'wrap',
          alignItems: 'flex-start'
        }}
      >
        {/* Main Instructions Panel (65%) */}
        <div style={{ flex: '1 1 600px', minWidth: '320px' }}>
          <div className="Box">
            <div className="Box-header">
              <span className="Box-title">Workflow Instructions</span>
              <span style={{ fontSize: '12px', color: 'var(--color-fg-muted)' }}>
                {lineCount} lines
              </span>
            </div>
            {workflow.rawContent ? (
              <MarkdownViewer content={workflow.rawContent} />
            ) : (
              <div className="Box-row" style={{ color: 'var(--color-fg-muted)', fontStyle: 'italic' }}>
                No workflow instructions or prompts found.
              </div>
            )}
          </div>
        </div>

        {/* Metadata Sidebar (35%) */}
        <div style={{ flex: '0 1 340px', minWidth: '280px' }}>
          <div className="Box">
            <div className="Box-header">
              <span className="Box-title">Workflow Metadata</span>
            </div>

            <div className="Box-row" style={{ display: 'block' }}>
              <div style={{ fontSize: '12px', color: 'var(--color-fg-muted)', marginBottom: '4px' }}>
                Invocation Syntax
              </div>
              <div
                style={{
                  fontFamily: 'monospace',
                  fontSize: '13px',
                  fontWeight: 600,
                  backgroundColor: 'var(--color-canvas-subtle)',
                  padding: '6px 8px',
                  borderRadius: 'var(--border-radius-small)'
                }}
              >
                {invocationSyntax}
              </div>
            </div>

            {workflow.metadata?.argumentHint && (
              <div className="Box-row">
                <span style={{ fontSize: '13px', color: 'var(--color-fg-muted)' }}>Argument Hint</span>
                <code>{workflow.metadata.argumentHint}</code>
              </div>
            )}

            {workflow.metadata?.model && (
              <div className="Box-row">
                <span style={{ fontSize: '13px', color: 'var(--color-fg-muted)' }}>Model</span>
                <span style={{ fontWeight: 600 }}>{workflow.metadata.model}</span>
              </div>
            )}

            {workflow.metadata?.allowedTools && workflow.metadata.allowedTools.length > 0 && (
              <div className="Box-row" style={{ display: 'block' }}>
                <div style={{ fontSize: '12px', color: 'var(--color-fg-muted)', marginBottom: '6px' }}>
                  Allowed Tools
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                  {workflow.metadata.allowedTools.map((tool) => (
                    <span key={tool} className="Label Label--accent">
                      {tool}
                    </span>
                  ))}
                </div>
              </div>
            )}

            <div className="Box-row">
              <span style={{ fontSize: '13px', color: 'var(--color-fg-muted)' }}>Ecosystem</span>
              <span className={badgeClass}>{workflow.targetEcosystem}</span>
            </div>

            <div className="Box-row">
              <span style={{ fontSize: '13px', color: 'var(--color-fg-muted)' }}>Scope</span>
              <span className="Label Label--secondary">{workflow.scope}</span>
            </div>

            <div className="Box-row">
              <span style={{ fontSize: '13px', color: 'var(--color-fg-muted)' }}>Total Lines</span>
              <span style={{ fontWeight: 600 }}>{lineCount}</span>
            </div>

            <div className="Box-row" style={{ display: 'block' }}>
              <div style={{ fontSize: '12px', color: 'var(--color-fg-muted)', marginBottom: '4px' }}>
                Filesystem Path
              </div>
              <div
                style={{
                  fontFamily: 'monospace',
                  fontSize: '11px',
                  wordBreak: 'break-all',
                  backgroundColor: 'var(--color-canvas-subtle)',
                  padding: '6px 8px',
                  borderRadius: 'var(--border-radius-small)'
                }}
              >
                {workflow.sourcePath}
              </div>
            </div>
          </div>
        </div>
      </div>

      {modalAction && (
        <CentralizeConfirmModal
          isOpen={true}
          action={modalAction}
          items={[
            {
              skillId: workflow.id,
              skillName: workflow.name,
              sourcePath: workflow.sourcePath,
              targetCentralPath: workflow.targetPath,
            },
          ]}
          onConfirm={handleConfirmAction}
          onCancel={() => setModalAction(null)}
          isSubmitting={isSubmitting}
        />
      )}
    </div>
  );
};
