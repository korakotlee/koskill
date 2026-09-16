import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import App from '../App.js';

describe('KoSkill Primer Dashboard Shell', () => {
  beforeEach(() => {
    document.documentElement.removeAttribute('data-color-mode');
  });

  it('renders cockpit header with title and badges', () => {
    render(<App />);
    expect(screen.getByText('KoSkill')).toBeDefined();
    expect(screen.getByText('v0.1.0')).toBeDefined();
  });

  it('renders UnderlineNav tabs with counter pills', () => {
    render(<App />);
    const skillsTab = screen.getByRole('button', { name: /Skills/i });
    const mcpTab = screen.getByRole('button', { name: /MCP Servers/i });
    const conflictsTab = screen.getByRole('button', { name: /Conflicts/i });
    const settingsTab = screen.getByRole('button', { name: /Settings/i });

    expect(skillsTab).toBeDefined();
    expect(mcpTab).toBeDefined();
    expect(conflictsTab).toBeDefined();
    expect(settingsTab).toBeDefined();
  });

  it('switches active tab when clicked', () => {
    render(<App />);
    const mcpTab = screen.getByRole('button', { name: /MCP Servers/i });
    fireEvent.click(mcpTab);
    expect(mcpTab.classList.contains('selected')).toBe(true);
    expect(screen.getByText(/Active Model Context Protocol Servers/i)).toBeDefined();
  });

  it('toggles dark and light mode', () => {
    render(<App />);
    const themeBtn = screen.getByRole('button', { name: /Theme/i });
    expect(document.documentElement.getAttribute('data-color-mode')).toBe('light');

    fireEvent.click(themeBtn);
    expect(document.documentElement.getAttribute('data-color-mode')).toBe('dark');

    fireEvent.click(themeBtn);
    expect(document.documentElement.getAttribute('data-color-mode')).toBe('light');
  });

  it('renders Primer Box card layouts', () => {
    render(<App />);
    const boxHeaders = screen.getAllByText(/Registered Skills/i);
    expect(boxHeaders.length).toBeGreaterThan(0);
  });
});
