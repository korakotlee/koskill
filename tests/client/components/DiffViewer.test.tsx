/**
 * @vitest-environment jsdom
 */
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import { DiffViewer } from '../../../src/client/src/components/DiffViewer.js';
import { DiffSummary } from '../../../src/core/conflict/types.js';

describe('DiffViewer Component', () => {
  const sampleDiff: DiffSummary = {
    additions: 2,
    deletions: 1,
    unifiedDiff: '--- a/skill-1\n+++ b/skill-2\n@@ -1,2 +1,3 @@\n-old prompt line\n+new prompt line\n+added prompt instruction\n',
    chunks: [
      { type: 'removed', value: 'old prompt line', oldLineNumber: 1 },
      { type: 'added', value: 'new prompt line', newLineNumber: 1 },
      { type: 'added', value: 'added prompt instruction', newLineNumber: 2 },
    ],
  };

  it('renders similarity percentage pill when similarityScore is provided', () => {
    render(<DiffViewer diffSummary={sampleDiff} similarityScore={0.92} />);

    expect(screen.getByText('92% Match')).toBeDefined();
  });

  it('renders addition and deletion counters', () => {
    render(<DiffViewer diffSummary={sampleDiff} similarityScore={0.85} />);

    expect(screen.getByText('+2')).toBeDefined();
    expect(screen.getByText('-1')).toBeDefined();
  });

  it('renders diff lines with appropriate styling classes', () => {
    render(<DiffViewer diffSummary={sampleDiff} />);

    expect(screen.getByText('old prompt line')).toBeDefined();
    expect(screen.getByText('new prompt line')).toBeDefined();
    expect(screen.getByText('added prompt instruction')).toBeDefined();
  });

  it('handles empty diff summary gracefully', () => {
    render(<DiffViewer />);

    expect(screen.getByText('No diff available')).toBeDefined();
  });
});
