import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { DiscoveryTable } from '../../../src/client/src/components/DiscoveryTable.js';
import { SkillDetailView } from '../../../src/client/src/components/SkillDetailView.js';
import { SkillManifest } from '../../../src/core/types.js';

const mockSkills: SkillManifest[] = [
  {
    id: 'gemini:web-search',
    name: 'web-search',
    description: 'Web search tool',
    sourcePath: '/path/to/gemini/skills/web-search/SKILL.md',
    targetEcosystem: 'gemini',
    status: 'original',
  },
  {
    id: 'gemini:code-review',
    name: 'code-review',
    description: 'Code review tool',
    sourcePath: '/path/to/gemini/skills/code-review/SKILL.md',
    targetEcosystem: 'gemini',
    status: 'symlinked',
    targetPath: '/Users/test/.koskill/skills/code-review',
  },
];

describe('Storage UI Integration', () => {
  describe('DiscoveryTable with Multi-Select and Storage Badges', () => {
    it('renders StorageStatusBadge for each skill', () => {
      render(<DiscoveryTable skills={mockSkills} onSelectSkill={vi.fn()} />);
      expect(screen.getByText('Original')).toBeDefined();
      expect(screen.getByText('Symlinked')).toBeDefined();
    });

    it('toggles row selection and displays BatchActionBar', () => {
      render(<DiscoveryTable skills={mockSkills} onSelectSkill={vi.fn()} />);

      const checkboxes = screen.getAllByRole('checkbox');
      // checkboxes[0] is header select-all, checkboxes[1] is row 1
      fireEvent.click(checkboxes[1]);

      expect(screen.getByRole('toolbar', { name: /batch actions toolbar/i })).toBeDefined();
      expect(screen.getByText(/skill selected/i)).toBeDefined();
      expect(screen.getByText('1')).toBeDefined();
    });

    it('toggles select all rows via header checkbox', () => {
      render(<DiscoveryTable skills={mockSkills} onSelectSkill={vi.fn()} />);

      const checkboxes = screen.getAllByRole('checkbox');
      const headerCheckbox = checkboxes[0];

      fireEvent.click(headerCheckbox);
      expect(screen.getByText(/skills selected/i)).toBeDefined();
      expect(screen.getByText('2')).toBeDefined();

      fireEvent.click(headerCheckbox);
      expect(screen.queryByRole('toolbar', { name: /batch actions toolbar/i })).toBeNull();
    });
  });

  describe('SkillDetailView Storage Actions and Badges', () => {
    it('renders StorageStatusBadge and Centralize & Symlink button for original skill', () => {
      const onCentralize = vi.fn();
      render(
        <SkillDetailView
          skill={mockSkills[0]}
          onBack={vi.fn()}
          onCentralizeSkill={onCentralize}
          onRevertSkill={vi.fn()}
        />
      );

      expect(screen.getAllByText('Original').length).toBeGreaterThanOrEqual(1);
      const actionBtn = screen.getByRole('button', { name: /centralize & symlink/i });
      expect(actionBtn).toBeDefined();
    });

    it('renders Revert to Original button for symlinked skill', () => {
      const onRevert = vi.fn();
      render(
        <SkillDetailView
          skill={mockSkills[1]}
          onBack={vi.fn()}
          onCentralizeSkill={vi.fn()}
          onRevertSkill={onRevert}
        />
      );

      expect(screen.getAllByText('Symlinked').length).toBeGreaterThanOrEqual(1);
      const actionBtn = screen.getByRole('button', { name: /revert to original/i });
      expect(actionBtn).toBeDefined();
    });
  });
});
