import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { DiscoveryTable } from '../../../src/client/src/components/DiscoveryTable.js';
import { SkillManifest } from '../../../src/core/types.js';

const mockSkills: SkillManifest[] = [
  {
    id: 'gemini:agentic-coder',
    name: 'agentic-coder',
    description: 'Expert coding skill for Gemini',
    sourcePath: '/Users/test/.gemini/config/skills/agentic-coder/SKILL.md',
    targetEcosystem: 'gemini',
    status: 'original'
  },
  {
    id: 'claude:arch-designer',
    name: 'arch-designer',
    description: 'Architecture design tools',
    sourcePath: '/Users/test/.claude/settings.json',
    targetEcosystem: 'claude',
    status: 'original'
  }
];

describe('DiscoveryTable Component', () => {
  it('renders table headers and skill rows', () => {
    render(<DiscoveryTable skills={mockSkills} onSelectSkill={vi.fn()} />);

    expect(screen.getByText('agentic-coder')).toBeDefined();
    expect(screen.getByText('arch-designer')).toBeDefined();
    expect(screen.getByText('gemini')).toBeDefined();
    expect(screen.getByText('claude')).toBeDefined();
  });

  it('filters items instantly when typing in search input', () => {
    render(<DiscoveryTable skills={mockSkills} onSelectSkill={vi.fn()} />);

    const searchInput = screen.getByPlaceholderText(/filter/i);
    fireEvent.change(searchInput, { target: { value: 'arch' } });

    expect(screen.queryByText('agentic-coder')).toBeNull();
    expect(screen.getByText('arch-designer')).toBeDefined();
  });

  it('triggers onSelectSkill when clicking a skill item', () => {
    const onSelect = vi.fn();
    render(<DiscoveryTable skills={mockSkills} onSelectSkill={onSelect} />);

    const skillItem = screen.getByText('agentic-coder');
    fireEvent.click(skillItem);

    expect(onSelect).toHaveBeenCalledWith(mockSkills[0]);
  });

  it('renders empty state message when no items match query', () => {
    render(<DiscoveryTable skills={mockSkills} onSelectSkill={vi.fn()} />);

    const searchInput = screen.getByPlaceholderText(/filter/i);
    fireEvent.change(searchInput, { target: { value: 'non-existent-query' } });

    expect(screen.getByText(/no matching items found/i)).toBeDefined();
  });
});
