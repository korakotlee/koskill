import React from 'react';
import { SkillStatus } from '../../../core/types.js';

export interface StorageStatusBadgeProps {
  status?: SkillStatus;
  className?: string;
}

/**
 * Renders a GitHub Primer-styled badge representing the storage state of a skill.
 */
export const StorageStatusBadge: React.FC<StorageStatusBadgeProps> = ({ status = 'original', className = '' }) => {
  let labelClass = 'Label';
  let labelText = 'Original';

  switch (status) {
    case 'centralized':
      labelClass = 'Label Label--success';
      labelText = 'Centralized';
      break;
    case 'symlinked':
      labelClass = 'Label Label--done';
      labelText = 'Symlinked';
      break;
    case 'broken-link':
      labelClass = 'Label Label--danger';
      labelText = 'Broken Link';
      break;
    case 'inactive':
      labelClass = 'Label';
      labelText = 'Inactive';
      break;
    case 'original':
    default:
      labelClass = 'Label Label--accent';
      labelText = 'Original';
      break;
  }

  return (
    <span className={`${labelClass} ${className}`.trim()}>
      {labelText}
    </span>
  );
};
