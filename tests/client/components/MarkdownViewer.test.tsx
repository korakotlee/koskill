import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import { MarkdownViewer, parseFrontmatter } from '../../../src/client/src/components/MarkdownViewer.js';

describe('MarkdownViewer Component', () => {
  it('parses frontmatter correctly and separates it from the body', () => {
    const raw = `---
name: my-cool-skill
description: "A skill for automated testing"
version: 1.0.0
---
# Welcome

This is regular markdown body.`;

    const { frontmatter, body } = parseFrontmatter(raw);
    expect(frontmatter).toEqual([
      { key: 'name', value: 'my-cool-skill' },
      { key: 'description', value: 'A skill for automated testing' },
      { key: 'version', value: '1.0.0' }
    ]);
    expect(body).toContain('# Welcome');
    expect(body).toContain('This is regular markdown body.');
  });

  it('renders frontmatter with bold keys and normal text values', () => {
    const raw = `---
name: awesome-skill
description: Skill description text
---
# Main Heading

Content paragraph.`;

    render(<MarkdownViewer content={raw} />);

    const frontmatterBox = screen.getByTestId('frontmatter-container');
    expect(frontmatterBox).toBeDefined();

    const nameKey = screen.getByText('name');
    expect(nameKey).toBeDefined();
    expect(nameKey.style.fontWeight).toBe('700');

    const nameValue = screen.getByText('awesome-skill');
    expect(nameValue).toBeDefined();
    expect(nameValue.style.fontWeight).toBe('400');

    const descKey = screen.getByText('description');
    expect(descKey.style.fontWeight).toBe('700');

    const descValue = screen.getByText('Skill description text');
    expect(descValue.style.fontWeight).toBe('400');

    // Ensure markdown body still renders correctly
    expect(screen.getByRole('heading', { level: 1, name: /Main Heading/i })).toBeDefined();
    expect(screen.getByText('Content paragraph.')).toBeDefined();
  });

  it('renders fallback when content is empty', () => {
    render(<MarkdownViewer content="" />);
    expect(screen.getByText(/No documentation available/i)).toBeDefined();
  });

  it('handles markdown without frontmatter cleanly', () => {
    const raw = '# Only Markdown\n\nNo frontmatter here.';
    render(<MarkdownViewer content={raw} />);
    expect(screen.queryByTestId('frontmatter-container')).toBeNull();
    expect(screen.getByRole('heading', { level: 1, name: /Only Markdown/i })).toBeDefined();
  });
});
