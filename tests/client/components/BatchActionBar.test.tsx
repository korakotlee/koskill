import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { BatchActionBar } from '../../../src/client/src/components/BatchActionBar.js';
import { SymlinkActions } from '../../../src/client/src/components/SymlinkActions.js';
import { SkillManifest } from '../../../src/core/types.js';

describe('Batch and Symlink Actions Components', () => {
  describe('BatchActionBar', () => {
    it('renders null when selectedCount is 0', () => {
      const { container } = render(
        <BatchActionBar
          selectedCount={0}
          onCentralizeSelected={vi.fn()}
          onRevertSelected={vi.fn()}
          onClearSelection={vi.fn()}
        />
      );
      expect(container.firstChild).toBeNull();
    });

    it('renders selected counter and action buttons when items are selected', () => {
      const onCentralize = vi.fn();
      const onRevert = vi.fn();
      const onClear = vi.fn();

      render(
        <BatchActionBar
          selectedCount={3}
          onCentralizeSelected={onCentralize}
          onRevertSelected={onRevert}
          onClearSelection={onClear}
        />
      );

      expect(screen.getByText('3')).toBeDefined();
      expect(screen.getByRole('button', { name: /centralize selected/i })).toBeDefined();
      expect(screen.getByRole('button', { name: /revert selected/i })).toBeDefined();

      fireEvent.click(screen.getByRole('button', { name: /centralize selected/i }));
      expect(onCentralize).toHaveBeenCalled();

      fireEvent.click(screen.getByRole('button', { name: /revert selected/i }));
      expect(onRevert).toHaveBeenCalled();

      fireEvent.click(screen.getByRole('button', { name: /clear selection/i }));
      expect(onClear).toHaveBeenCalled();
    });
  });

  describe('SymlinkActions', () => {
    const originalSkill: SkillManifest = {
      id: 'gemini:orig',
      name: 'orig',
      description: 'Original skill',
      sourcePath: '/path/orig',
      targetEcosystem: 'gemini',
      status: 'original',
    };

    const symlinkedSkill: SkillManifest = {
      id: 'gemini:sym',
      name: 'sym',
      description: 'Symlinked skill',
      sourcePath: '/path/sym',
      targetEcosystem: 'gemini',
      status: 'symlinked',
    };

    it('shows Centralize button for original skill in row view', () => {
      const onCentralize = vi.fn();
      render(
        <SymlinkActions
          skill={originalSkill}
          onCentralize={onCentralize}
          onRevert={vi.fn()}
          variant="row"
        />
      );

      const btn = screen.getByRole('button', { name: /centralize/i });
      expect(btn).toBeDefined();
      fireEvent.click(btn);
      expect(onCentralize).toHaveBeenCalledWith(originalSkill);
    });

    it('shows Revert button for symlinked skill in detail view', () => {
      const onRevert = vi.fn();
      render(
        <SymlinkActions
          skill={symlinkedSkill}
          onCentralize={vi.fn()}
          onRevert={onRevert}
          variant="detail"
        />
      );

      const btn = screen.getByRole('button', { name: /revert to original/i });
      expect(btn).toBeDefined();
      fireEvent.click(btn);
      expect(onRevert).toHaveBeenCalledWith(symlinkedSkill);
    });

    it('shows Revert button for centralized skill in detail and row view', () => {
      const centralizedSkill: SkillManifest = {
        ...originalSkill,
        status: 'centralized',
      };
      const onRevert = vi.fn();

      const { unmount } = render(
        <SymlinkActions
          skill={centralizedSkill}
          onCentralize={vi.fn()}
          onRevert={onRevert}
          variant="detail"
        />
      );

      const detailBtn = screen.getByRole('button', { name: /revert to original/i });
      expect(detailBtn).toBeDefined();
      fireEvent.click(detailBtn);
      expect(onRevert).toHaveBeenCalledWith(centralizedSkill);

      unmount();

      render(
        <SymlinkActions
          skill={centralizedSkill}
          onCentralize={vi.fn()}
          onRevert={onRevert}
          variant="row"
        />
      );

      const rowBtn = screen.getByRole('button', { name: /^revert$/i });
      expect(rowBtn).toBeDefined();
    });
  });
});
