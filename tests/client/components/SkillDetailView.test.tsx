import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { SkillDetailView } from '../../../src/client/src/components/SkillDetailView.js';
import { SkillManifest } from '../../../src/core/types.js';

const sampleSkill: SkillManifest = {
  id: 'gemini:unit-testing',
  name: 'unit-testing',
  description: 'TDD and unit test automation skill',
  sourcePath: '/Users/dev/.gemini/config/skills/unit-testing/SKILL.md',
  targetEcosystem: 'gemini',
  status: 'original',
  rawContent: '# Unit Testing Skill\n\nRun your tests before writing code.'
};

describe('SkillDetailView Component', () => {
  it('renders breadcrumb back button and triggers onBack when clicked', () => {
    const onBack = vi.fn();
    render(<SkillDetailView skill={sampleSkill} onBack={onBack} />);

    const backBtn = screen.getByRole('button', { name: /Back to Discovery/i });
    expect(backBtn).toBeDefined();

    fireEvent.click(backBtn);
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it('renders skill name, ecosystem badge, and metadata sidebar', () => {
    render(<SkillDetailView skill={sampleSkill} onBack={vi.fn()} />);

    expect(screen.getByRole('heading', { level: 2, name: /unit-testing/i })).toBeDefined();
    expect(screen.getAllByText('gemini').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('/Users/dev/.gemini/config/skills/unit-testing/SKILL.md')).toBeDefined();
    expect(screen.getAllByText(/original/i).length).toBeGreaterThanOrEqual(1);
  });

  it('renders markdown documentation content', () => {
    render(<SkillDetailView skill={sampleSkill} onBack={vi.fn()} />);

    expect(screen.getByText('Unit Testing Skill')).toBeDefined();
    expect(screen.getByText(/Run your tests before writing code/i)).toBeDefined();
  });

  it('renders frontmatter attributes in sidebar with bold keys and normal values', () => {
    const skillWithFrontmatter: SkillManifest = {
      ...sampleSkill,
      metadata: {
        author: 'John Doe',
        difficulty: 'intermediate',
      },
    };
    render(<SkillDetailView skill={skillWithFrontmatter} onBack={vi.fn()} />);

    expect(screen.getByText('Frontmatter Attributes')).toBeDefined();
    const authorKey = screen.getByText('author');
    expect(authorKey.style.fontWeight).toBe('700');
    const authorVal = screen.getByText('John Doe');
    expect(authorVal.style.fontWeight).toBe('400');
  });
});
