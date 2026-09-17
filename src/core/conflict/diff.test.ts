/**
 * @vitest-environment node
 */
import { describe, it, expect } from 'vitest';
import { generateDiff } from './diff.js';

describe('Unified Text Diff Generator', () => {
  it('returns zero additions and deletions for identical content', () => {
    const text = '# Skill Title\n\nThis is a prompt description.\n';
    const result = generateDiff(text, text, { oldHeader: 'a/skill-1', newHeader: 'b/skill-2' });

    expect(result.additions).toBe(0);
    expect(result.deletions).toBe(0);
    expect(result.unifiedDiff).toContain('--- a/skill-1');
    expect(result.unifiedDiff).toContain('+++ b/skill-2');
    expect(result.chunks.every((c) => c.type === 'unchanged')).toBe(true);
  });

  it('detects line additions correctly', () => {
    const oldText = 'Line 1\nLine 2';
    const newText = 'Line 1\nLine 2\nLine 3 added';
    const result = generateDiff(oldText, newText);

    expect(result.additions).toBe(1);
    expect(result.deletions).toBe(0);
    expect(result.unifiedDiff).toContain('+Line 3 added');
  });

  it('detects line deletions correctly', () => {
    const oldText = 'Line 1\nLine 2 to remove\nLine 3';
    const newText = 'Line 1\nLine 3';
    const result = generateDiff(oldText, newText);

    expect(result.additions).toBe(0);
    expect(result.deletions).toBe(1);
    expect(result.unifiedDiff).toContain('-Line 2 to remove');
  });

  it('detects mixed modifications and formats standard unified diff blocks', () => {
    const skillA = `# Git Commit Assistant

Analyze git status and write conventional commits.
Prompt:
- Analyze diff
- Output type(scope): message
`;

    const skillB = `# Automated Conventional Commits

Analyze git staged diff and formulate conventional commit messages.
Prompt:
- Analyze diff
- Output type: message
- Keep it under 50 chars
`;

    const result = generateDiff(skillA, skillB, { oldHeader: 'gemini/commit', newHeader: 'claude/commit' });

    expect(result.additions).toBeGreaterThan(0);
    expect(result.deletions).toBeGreaterThan(0);
    expect(result.unifiedDiff).toContain('--- gemini/commit');
    expect(result.unifiedDiff).toContain('+++ claude/commit');
    expect(result.unifiedDiff).toMatch(/^@@ -\d+,\d+ \+\d+,\d+ @@/m);
  });

  it('handles empty strings and nullish inputs gracefully without crashing', () => {
    const result = generateDiff('', 'Single line');
    expect(result.additions).toBe(1);
    expect(result.deletions).toBe(0);

    const emptyResult = generateDiff('', '');
    expect(emptyResult.additions).toBe(0);
    expect(emptyResult.deletions).toBe(0);
  });
});
