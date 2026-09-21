import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { AppHeader } from '../../src/client/src/components/AppHeader.js';

describe('AppHeader UI Component & Emoji Theme Switcher', () => {
  it('renders emoji theme toggle button with accessible label', () => {
    const onToggleTheme = vi.fn();
    render(
      <AppHeader
        isConnected={true}
        isRefreshing={false}
        colorMode="light"
        onRefresh={() => {}}
        onToggleTheme={onToggleTheme}
      />
    );

    const themeBtn = screen.getByRole('button', { name: /Toggle Theme/i });
    expect(themeBtn).toBeDefined();
    // Light mode shows moon emoji to switch to dark
    expect(themeBtn.textContent).toContain('🌙');

    fireEvent.click(themeBtn);
    expect(onToggleTheme).toHaveBeenCalledTimes(1);
  });

  it('renders sun emoji when dark mode is active', () => {
    render(
      <AppHeader
        isConnected={true}
        isRefreshing={false}
        colorMode="dark"
        onRefresh={() => {}}
        onToggleTheme={() => {}}
      />
    );

    const themeBtn = screen.getByRole('button', { name: /Toggle Theme/i });
    expect(themeBtn.textContent).toContain('☀️');
  });

  it('displays connection status badge properly', () => {
    const { rerender } = render(
      <AppHeader
        isConnected={true}
        isRefreshing={false}
        colorMode="light"
        onRefresh={() => {}}
        onToggleTheme={() => {}}
      />
    );

    expect(screen.getByText(/Connected to 127.0.0.1:3900/i)).toBeDefined();

    rerender(
      <AppHeader
        isConnected={false}
        isRefreshing={false}
        colorMode="light"
        onRefresh={() => {}}
        onToggleTheme={() => {}}
      />
    );

    expect(screen.getByText(/Offline/i)).toBeDefined();
  });
});
