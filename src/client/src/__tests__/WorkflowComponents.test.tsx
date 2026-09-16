import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { DiscoveryTable } from '../components/DiscoveryTable.js';
import { WorkflowDetailView } from '../components/WorkflowDetailView.js';
import App from '../App.js';
import { WorkflowManifest } from '../../../core/types.js';

const mockWorkflows: WorkflowManifest[] = [
  {
    id: 'gemini:commit',
    name: 'commit',
    command: '/commit',
    description: 'Create a structured git commit',
    sourcePath: '/Users/test/.gemini/config/global_workflows/commit.md',
    targetEcosystem: 'gemini',
    scope: 'global',
    metadata: {
      argumentHint: '[scope]',
      allowedTools: ['run_command', 'view_file'],
      model: 'gemini-2.5-pro'
    },
    rawContent: '# Commit Workflow\nInstructions for commit.'
  },
  {
    id: 'claude:review',
    name: 'review',
    command: '/review',
    description: 'Review pending code changes',
    sourcePath: '/Users/test/.claude/commands/review.md',
    targetEcosystem: 'claude',
    scope: 'workspace',
    metadata: {
      argumentHint: '<pr-number>'
    },
    rawContent: '# Review Command\nInstructions for review.'
  }
];

describe('Workflow Components', () => {
  describe('DiscoveryTable with Workflows', () => {
    it('renders workflow rows with command badges, ecosystem, and scope', () => {
      render(
        <DiscoveryTable
          workflows={mockWorkflows}
          onSelectWorkflow={vi.fn()}
        />
      );

      expect(screen.getByText('/commit')).toBeDefined();
      expect(screen.getByText('/review')).toBeDefined();
      expect(screen.getByText('Create a structured git commit')).toBeDefined();
      expect(screen.getByText('global')).toBeDefined();
      expect(screen.getByText('workspace')).toBeDefined();
    });

    it('filters workflows by command name and description', () => {
      render(
        <DiscoveryTable
          workflows={mockWorkflows}
          onSelectWorkflow={vi.fn()}
        />
      );

      const searchInput = screen.getByPlaceholderText(/filter/i);
      fireEvent.change(searchInput, { target: { value: 'commit' } });

      expect(screen.getByText('/commit')).toBeDefined();
      expect(screen.queryByText('/review')).toBeNull();
    });

    it('invokes onSelectWorkflow callback when a workflow command is clicked', () => {
      const onSelect = vi.fn();
      render(
        <DiscoveryTable
          workflows={mockWorkflows}
          onSelectWorkflow={onSelect}
        />
      );

      const commandBtn = screen.getByText('/commit');
      fireEvent.click(commandBtn);

      expect(onSelect).toHaveBeenCalledWith(mockWorkflows[0]);
    });
  });

  describe('WorkflowDetailView', () => {
    it('renders workflow invocation syntax, argument hint, tools, and markdown', () => {
      const onBack = vi.fn();
      render(
        <WorkflowDetailView
          workflow={mockWorkflows[0]}
          onBack={onBack}
        />
      );

      expect(screen.getByText('/commit')).toBeDefined();
      expect(screen.getByText('/commit [scope]')).toBeDefined();
      expect(screen.getByText('gemini-2.5-pro')).toBeDefined();
      expect(screen.getByText('run_command')).toBeDefined();
      expect(screen.getByText('view_file')).toBeDefined();
      expect(screen.getByText(/Commit Workflow/)).toBeDefined();

      const backBtn = screen.getByRole('button', { name: /back to discovery/i });
      fireEvent.click(backBtn);
      expect(onBack).toHaveBeenCalledTimes(1);
    });
  });

  describe('App Workflows Tab Integration', () => {
    beforeEach(() => {
      vi.stubGlobal('fetch', vi.fn((url: string) => {
        if (url === '/api/skills') {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ skills: [], total: 0 })
          });
        }
        if (url === '/api/mcp') {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ servers: [], total: 0 })
          });
        }
        if (url === '/api/workflows') {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ workflows: mockWorkflows, total: 2 })
          });
        }
        return Promise.resolve({ ok: false });
      }));
    });

    it('renders Workflows tab with count badge and switches to workflows panel', async () => {
      render(<App />);

      const workflowsTab = screen.getByRole('button', { name: /workflows/i });
      expect(workflowsTab).toBeDefined();

      fireEvent.click(workflowsTab);

      await waitFor(() => {
        expect(screen.getByText('/commit')).toBeDefined();
      });
    });
  });
});
