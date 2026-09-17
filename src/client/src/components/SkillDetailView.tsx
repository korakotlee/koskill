import React, { useState } from 'react';
import { SkillManifest } from '../../../core/types.js';
import { MarkdownViewer } from './MarkdownViewer.js';
import { StorageStatusBadge } from './StorageStatusBadge.js';
import { SymlinkActions } from './SymlinkActions.js';
import { CentralizeConfirmModal } from './CentralizeConfirmModal.js';
import { EntityToggleSwitch } from './EntityToggleSwitch.js';

export interface SkillDetailViewProps {
  skill: SkillManifest;
  onBack: () => void;
  onCentralizeSkill?: (skill: SkillManifest) => Promise<void> | void;
  onRevertSkill?: (skill: SkillManifest) => Promise<void> | void;
  onToggleSkill?: (skill: SkillManifest, enabled: boolean) => Promise<void> | void;
}

export const SkillDetailView: React.FC<SkillDetailViewProps> = ({
  skill,
  onBack,
  onCentralizeSkill,
  onRevertSkill,
  onToggleSkill,
}) => {
  const [modalAction, setModalAction] = useState<'centralize' | 'revert' | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const lineCount = skill.rawContent ? skill.rawContent.split('\n').length : 0;
  const isGemini = skill.targetEcosystem === 'gemini';
  const badgeClass = isGemini ? 'Label Label--accent' : 'Label Label--done';

  const handleConfirmAction = async () => {
    if (!modalAction) return;
    setIsSubmitting(true);
    try {
      if (modalAction === 'centralize') {
        await onCentralizeSkill?.(skill);
      } else {
        await onRevertSkill?.(skill);
      }
      setModalAction(null);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div>
      {/* Top Breadcrumb & Header Actions */}
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

        {(onCentralizeSkill || onRevertSkill) && (
          <SymlinkActions
            skill={skill}
            variant="detail"
            onCentralize={() => setModalAction('centralize')}
            onRevert={() => setModalAction('revert')}
            disabled={isSubmitting}
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
        <h2 style={{ fontSize: '24px', fontWeight: 600, margin: 0 }}>{skill.name}</h2>
        <span className={badgeClass}>{skill.targetEcosystem}</span>
        <StorageStatusBadge status={skill.status} />
        {onToggleSkill && (
          <EntityToggleSwitch
            entityType="skills"
            id={skill.name}
            enabled={skill.status !== 'inactive'}
            onToggle={(targetState) => onToggleSkill(skill, targetState)}
          />
        )}
      </div>

      {skill.description && (
        <p style={{ color: 'var(--color-fg-muted)', marginBottom: '24px', fontSize: '15px' }}>
          {skill.description}
        </p>
      )}

      {/* Two-Column Responsive Layout */}
      <div
        style={{
          display: 'flex',
          gap: '24px',
          flexWrap: 'wrap',
          alignItems: 'flex-start',
        }}
      >
        {/* Main Documentation Panel (65%) */}
        <div style={{ flex: '1 1 600px', minWidth: '320px' }}>
          <div className="Box">
            <div className="Box-header">
              <span className="Box-title">Documentation (SKILL.md)</span>
              <span style={{ fontSize: '12px', color: 'var(--color-fg-muted)' }}>
                {lineCount} lines
              </span>
            </div>
            <MarkdownViewer content={skill.rawContent} />
          </div>
        </div>

        {/* Metadata Sidebar (35%) */}
        <div style={{ flex: '0 1 340px', minWidth: '280px' }}>
          <div className="Box">
            <div className="Box-header">
              <span className="Box-title">Metadata Summary</span>
            </div>
            <div className="Box-row" style={{ display: 'block' }}>
              <div style={{ fontSize: '12px', color: 'var(--color-fg-muted)', marginBottom: '4px' }}>
                Filesystem Path
              </div>
              <div
                style={{
                  fontFamily: 'monospace',
                  fontSize: '12px',
                  wordBreak: 'break-all',
                  backgroundColor: 'var(--color-canvas-subtle)',
                  padding: '6px 8px',
                  borderRadius: 'var(--border-radius-small)',
                }}
              >
                {skill.sourcePath}
              </div>
            </div>

            {skill.targetPath && (
              <div className="Box-row" style={{ display: 'block' }}>
                <div style={{ fontSize: '12px', color: 'var(--color-fg-muted)', marginBottom: '4px' }}>
                  Canonical Central Target
                </div>
                <div
                  style={{
                    fontFamily: 'monospace',
                    fontSize: '12px',
                    wordBreak: 'break-all',
                    backgroundColor: 'var(--color-canvas-subtle)',
                    padding: '6px 8px',
                    borderRadius: 'var(--border-radius-small)',
                    color: 'var(--color-accent-fg)',
                  }}
                >
                  {skill.targetPath}
                </div>
              </div>
            )}

            <div className="Box-row">
              <span style={{ fontSize: '13px', color: 'var(--color-fg-muted)' }}>Ecosystem</span>
              <span className={badgeClass}>{skill.targetEcosystem}</span>
            </div>
            <div className="Box-row">
              <span style={{ fontSize: '13px', color: 'var(--color-fg-muted)' }}>Storage State</span>
              <StorageStatusBadge status={skill.status} />
            </div>
            <div className="Box-row">
              <span style={{ fontSize: '13px', color: 'var(--color-fg-muted)' }}>Total Lines</span>
              <span style={{ fontWeight: 600 }}>{lineCount}</span>
            </div>
            {skill.metadata && Object.keys(skill.metadata).length > 0 && (
              <div className="Box-row" style={{ display: 'block' }}>
                <div style={{ fontSize: '12px', color: 'var(--color-fg-muted)', marginBottom: '6px' }}>
                  Frontmatter Attributes
                </div>
                <div style={{ fontSize: '12px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {Object.entries(skill.metadata).map(([k, v]) => (
                    <div key={k}>
                      <code style={{ fontWeight: 700 }}>{k}</code>:{' '}
                      <span style={{ fontWeight: 400 }}>{String(v)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {modalAction && (
        <CentralizeConfirmModal
          isOpen={true}
          action={modalAction}
          items={[
            {
              skillId: skill.id,
              skillName: skill.name,
              sourcePath: skill.sourcePath,
              targetCentralPath: skill.targetPath,
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
