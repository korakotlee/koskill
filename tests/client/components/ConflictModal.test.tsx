/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { ConflictModal } from '../../../src/client/src/components/ConflictModal.js';
import { ConflictReport } from '../../../src/core/conflict/types.js';

describe('ConflictModal Component', () => {
  const sampleReport: ConflictReport = {
    id: 'conflict-test-1',
    conflictType: 'SEMANTIC_DUPLICATE',
    severity: 'WARNING',
    title: 'Semantic Duplicate: Git Commit Helper & Auto Commit',
    description: 'Skills exhibit 92% semantic similarity.',
    similarityScore: 0.92,
    matchedSnippet: '92% match',
    items: [
      {
        id: 'skill:gemini-1',
        name: 'Git Commit Helper',
        ecosystem: 'gemini',
        sourcePath: '/path/gemini/SKILL.md',
        contentHash: 'hash-1',
        content: '# Git Commit Helper\nPrompt instructions 1\n',
      },
      {
        id: 'skill:claude-2',
        name: 'Auto Commit',
        ecosystem: 'claude',
        sourcePath: '/path/claude/SKILL.md',
        contentHash: 'hash-2',
        content: '# Auto Commit\nPrompt instructions 2\n',
      },
    ],
    diffSummary: {
      additions: 1,
      deletions: 1,
      unifiedDiff: '--- gemini\n+++ claude\n-Prompt instructions 1\n+Prompt instructions 2\n',
      chunks: [
        { type: 'removed', value: 'Prompt instructions 1' },
        { type: 'added', value: 'Prompt instructions 2' },
      ],
    },
  };

  it('renders conflict details, severity badge, and DiffViewer', () => {
    render(<ConflictModal conflict={sampleReport} onClose={vi.fn()} onResolve={vi.fn()} />);

    expect(screen.getByText('Semantic Duplicate: Git Commit Helper & Auto Commit')).toBeDefined();
    expect(screen.getByText('WARNING')).toBeDefined();
    expect(screen.getByText('92% Match')).toBeDefined();
  });

  it('triggers PICK resolution when user selects a winner item', () => {
    const onResolve = vi.fn();
    render(<ConflictModal conflict={sampleReport} onClose={vi.fn()} onResolve={onResolve} />);

    const pickBtn = screen.getByRole('button', { name: /Keep Git Commit Helper/i });
    fireEvent.click(pickBtn);

    expect(onResolve).toHaveBeenCalledWith(
      expect.objectContaining({
        conflictId: 'conflict-test-1',
        action: 'PICK',
        winnerId: 'skill:gemini-1',
      })
    );
  });

  it('triggers ALIAS resolution when user submits a new alias', () => {
    const onResolve = vi.fn();
    render(<ConflictModal conflict={sampleReport} onClose={vi.fn()} onResolve={onResolve} />);

    const aliasInput = screen.getByPlaceholderText(/Enter new alias/i);
    fireEvent.change(aliasInput, { target: { value: 'auto-commit-aliased' } });

    const aliasBtn = screen.getByRole('button', { name: /Apply Alias/i });
    fireEvent.click(aliasBtn);

    expect(onResolve).toHaveBeenCalledWith(
      expect.objectContaining({
        conflictId: 'conflict-test-1',
        action: 'ALIAS',
        newAlias: 'auto-commit-aliased',
      })
    );
  });

  it('triggers MERGE resolution when user clicks Merge', () => {
    const onResolve = vi.fn();
    render(<ConflictModal conflict={sampleReport} onClose={vi.fn()} onResolve={onResolve} />);

    const mergeBtn = screen.getByRole('button', { name: /Merge Definitions/i });
    fireEvent.click(mergeBtn);

    expect(onResolve).toHaveBeenCalledWith(
      expect.objectContaining({
        conflictId: 'conflict-test-1',
        action: 'MERGE',
        winnerId: 'skill:gemini-1',
      })
    );
  });

  it('calls onClose when close button is clicked', () => {
    const onClose = vi.fn();
    render(<ConflictModal conflict={sampleReport} onClose={onClose} onResolve={vi.fn()} />);

    const closeBtn = screen.getByRole('button', { name: /^Cancel$/i });
    fireEvent.click(closeBtn);

    expect(onClose).toHaveBeenCalled();
  });
});
