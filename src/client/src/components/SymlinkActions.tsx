import React from 'react';
import { SkillManifest } from '../../../core/types.js';

export interface SymlinkActionsProps {
  skill: SkillManifest;
  onCentralize: (skill: SkillManifest) => void;
  onRevert: (skill: SkillManifest) => void;
  variant?: 'row' | 'detail';
  disabled?: boolean;
}

/**
 * Action button group for centralizing or reverting individual skills.
 */
export const SymlinkActions: React.FC<SymlinkActionsProps> = ({
  skill,
  onCentralize,
  onRevert,
  variant = 'row',
  disabled = false,
}) => {
  const isRow = variant === 'row';
  const isOriginal = skill.status === 'original' || !skill.status;
  const isSymlinked = skill.status === 'symlinked' || skill.status === 'centralized';
  const isBroken = skill.status === 'broken-link';

  if (isOriginal) {
    return (
      <button
        type="button"
        className={isRow ? 'Btn Btn-sm' : 'Btn Btn-primary'}
        onClick={(e) => {
          e.stopPropagation();
          onCentralize(skill);
        }}
        disabled={disabled}
        style={{
          padding: isRow ? '2px 8px' : '6px 14px',
          fontSize: isRow ? '12px' : '13px',
          borderRadius: '6px',
          border: '1px solid rgba(27, 31, 36, 0.15)',
          backgroundColor: 'var(--color-success-emphasis, #1f883d)',
          color: '#ffffff',
          fontWeight: 500,
          cursor: disabled ? 'not-allowed' : 'pointer',
        }}
      >
        {isRow ? 'Centralize' : 'Centralize & Symlink'}
      </button>
    );
  }

  if (isSymlinked || isBroken) {
    return (
      <button
        type="button"
        className={isRow ? 'Btn Btn-sm' : 'Btn'}
        onClick={(e) => {
          e.stopPropagation();
          onRevert(skill);
        }}
        disabled={disabled}
        style={{
          padding: isRow ? '2px 8px' : '6px 14px',
          fontSize: isRow ? '12px' : '13px',
          borderRadius: '6px',
          border: '1px solid var(--color-border-default, #d0d7de)',
          backgroundColor: 'var(--color-canvas-default, #ffffff)',
          color: isBroken ? 'var(--color-danger-fg, #cf222e)' : 'var(--color-fg-default)',
          fontWeight: 500,
          cursor: disabled ? 'not-allowed' : 'pointer',
        }}
      >
        {isRow ? 'Revert' : 'Revert to Original'}
      </button>
    );
  }

  return null;
};
