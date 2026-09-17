import React from 'react';
import { SkillManifest } from '../../../core/types.js';
import { StorageStatusBadge } from './StorageStatusBadge.js';
import { SymlinkActions } from './SymlinkActions.js';

export interface SkillTableRowsProps {
  skills: SkillManifest[];
  selectedIds: Set<string>;
  toggleRow: (id: string) => void;
  onSelectSkill?: (skill: SkillManifest) => void;
  openSingleAction: (skill: SkillManifest, action: 'centralize' | 'revert') => void;
  isSubmitting: boolean;
}

export const SkillTableRows: React.FC<SkillTableRowsProps> = ({
  skills,
  selectedIds,
  toggleRow,
  onSelectSkill,
  openSingleAction,
  isSubmitting,
}) => {
  return (
    <>
      {skills.map((skill) => {
        const isSelected = selectedIds.has(skill.id);
        const isGemini = skill.targetEcosystem === 'gemini';
        const badgeClass = isGemini ? 'Label Label--accent' : 'Label Label--done';

        return (
          <div
            key={skill.id}
            className="Box-row"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              backgroundColor: isSelected ? 'var(--color-accent-subtle, #ddf4ff)' : undefined,
            }}
          >
            <input
              type="checkbox"
              aria-label={`Select ${skill.name}`}
              checked={isSelected}
              onChange={() => toggleRow(skill.id)}
              className="form-checkbox"
              style={{ cursor: 'pointer' }}
            />

            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                <button
                  type="button"
                  onClick={() => onSelectSkill?.(skill)}
                  style={{
                    background: 'none',
                    border: 'none',
                    padding: 0,
                    font: 'inherit',
                    fontWeight: 600,
                    color: 'var(--color-accent-fg)',
                    cursor: 'pointer',
                    textAlign: 'left',
                  }}
                >
                  {skill.name}
                </button>
                <span className={badgeClass}>{skill.targetEcosystem}</span>
                <StorageStatusBadge status={skill.status} />
              </div>

              {skill.description && (
                <div style={{ fontSize: '12px', color: 'var(--color-fg-muted)', marginBottom: '4px' }}>
                  {skill.description}
                </div>
              )}

              <div style={{ fontFamily: 'monospace', fontSize: '11px', color: 'var(--color-fg-muted)' }}>
                {skill.sourcePath}
              </div>
            </div>

            <div>
              <SymlinkActions
                skill={skill}
                variant="row"
                onCentralize={() => openSingleAction(skill, 'centralize')}
                onRevert={() => openSingleAction(skill, 'revert')}
                disabled={isSubmitting}
              />
            </div>
          </div>
        );
      })}
    </>
  );
};
