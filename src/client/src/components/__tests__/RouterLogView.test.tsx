import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { RouterLogView } from '../RouterLogView.js';
import { RouterTransaction, RouterMetrics } from '../../../../core/router/types.js';

describe('RouterLogView Component', () => {
  const mockMetrics: RouterMetrics = {
    activeServersCount: 2,
    totalTransactions: 1048,
    estimatedTokensSaved: 482150,
  };

  const mockLogs: RouterTransaction[] = [
    {
      id: 'tx-1',
      timestamp: Date.now(),
      action: 'DISCOVER',
      query: 'audit web accessibility guidelines',
      durationMs: 18,
      status: 'SUCCESS',
      tokensSavedEstimate: 14200,
      payload: { query: 'audit web accessibility guidelines' },
      result: { candidates: [{ id: 'accessibility', score: 0.95 }] },
    },
    {
      id: 'tx-2',
      timestamp: Date.now() + 1000,
      action: 'LOAD_SKILL',
      skillName: 'accessibility',
      durationMs: 4,
      status: 'SUCCESS',
      tokensSavedEstimate: 8600,
    },
    {
      id: 'tx-3',
      timestamp: Date.now() + 2000,
      action: 'INVOKE_TOOL',
      targetServer: 'chrome-devtools',
      targetTool: 'click',
      durationMs: 84,
      status: 'SUCCESS',
      tokensSavedEstimate: 32100,
      payload: { selector: '#submit-btn' },
    },
  ];

  it('renders metric header cards with active child servers and token savings', () => {
    render(<RouterLogView initialLogs={mockLogs} initialMetrics={mockMetrics} />);

    expect(screen.getByText('Active Child Servers')).toBeDefined();
    expect(screen.getByText('2')).toBeDefined();
    expect(screen.getByText('Total Invocations')).toBeDefined();
    expect(screen.getByText('1,048')).toBeDefined();
    expect(screen.getByText('Estimated Tokens Saved')).toBeDefined();
    expect(screen.getByText('482,150')).toBeDefined();
  });

  it('renders transactions in table with action badges and latencies', () => {
    render(<RouterLogView initialLogs={mockLogs} initialMetrics={mockMetrics} />);

    expect(screen.getByText('DISCOVER')).toBeDefined();
    expect(screen.getByText('LOAD_SKILL')).toBeDefined();
    expect(screen.getByText('INVOKE_TOOL')).toBeDefined();
    expect(screen.getByText(/audit web accessibility guidelines/i)).toBeDefined();
    expect(screen.getByText('18ms')).toBeDefined();
    expect(screen.getByText('+14,200 tok')).toBeDefined();
  });

  it('filters transactions when text is entered into search filter', () => {
    render(<RouterLogView initialLogs={mockLogs} initialMetrics={mockMetrics} />);

    const searchInput = screen.getByPlaceholderText(/filter by action/i);
    fireEvent.change(searchInput, { target: { value: 'chrome-devtools' } });

    expect(screen.getByText('INVOKE_TOOL')).toBeDefined();
    expect(screen.queryByText('LOAD_SKILL')).toBeNull();
  });

  it('opens inspector drawer on row click displaying payload and result', () => {
    render(<RouterLogView initialLogs={mockLogs} initialMetrics={mockMetrics} />);

    const row = screen.getByText(/audit web accessibility guidelines/i);
    fireEvent.click(row);

    expect(screen.getByText(/Transaction Details/i)).toBeDefined();
    expect(screen.getByText(/candidates/i)).toBeDefined();

    // Close button works
    const closeBtn = screen.getByRole('button', { name: /close drawer/i });
    fireEvent.click(closeBtn);
    expect(screen.queryByText(/Transaction Details/i)).toBeNull();
  });
});
