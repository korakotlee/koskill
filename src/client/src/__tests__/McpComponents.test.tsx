import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { McpServerList } from '../components/McpServerList.js';
import { McpDetailView } from '../components/McpDetailView.js';
import { McpConfigSidebar } from '../components/McpConfigSidebar.js';
import { McpServerManifest } from '../../../core/types.js';

const mockDiscoveredServer: McpServerManifest = {
  id: 'gemini:github',
  name: 'github',
  title: 'GitHub MCP Server',
  version: '1.2.0',
  description: 'Provides GitHub repository and issue management capabilities.',
  instructions: '# GitHub Guidelines\nAlways ask before deleting issues.',
  serverInfo: {
    name: 'github',
    title: 'GitHub MCP Server',
    version: '1.2.0',
    description: 'Provides GitHub repository and issue management capabilities.',
  },
  transport: 'stdio',
  command: 'npx',
  args: ['-y', '@modelcontextprotocol/server-github'],
  declaredToolsCount: 4,
  enabled: true,
  status: 'centralized',
  lastDiscoveredAt: '2026-09-17T15:00:00.000Z',
  tools: [
    { name: 'create_issue', description: 'Create a new GitHub issue' },
    { name: 'list_prs', description: 'List pull requests' },
  ],
};

describe('McpServerList Component Discovery Enrichment', () => {
  it('renders server title, version badge, and description snippet', () => {
    render(<McpServerList servers={[mockDiscoveredServer]} />);

    expect(screen.getByText('GitHub MCP Server')).toBeDefined();
    expect(screen.getByText('v1.2.0')).toBeDefined();
    expect(screen.getByText(/Provides GitHub repository and issue management capabilities/i)).toBeDefined();
  });

  it('triggers onDiscoverServer callback when Discover button is clicked', () => {
    const onDiscover = vi.fn();
    render(<McpServerList servers={[mockDiscoveredServer]} onDiscoverServer={onDiscover} />);

    const discoverBtn = screen.getByRole('button', { name: /Discover/i });
    expect(discoverBtn).toBeDefined();

    fireEvent.click(discoverBtn);
    expect(onDiscover).toHaveBeenCalledWith(mockDiscoveredServer);
  });
});

describe('McpDetailView Component Discovery Enrichment', () => {
  it('renders Server Overview card and Agent Instructions markdown card', () => {
    render(<McpDetailView server={mockDiscoveredServer} onBack={vi.fn()} />);

    expect(screen.getByText('Server Overview')).toBeDefined();
    expect(screen.getByText('Agent Instructions')).toBeDefined();
    expect(screen.getByText(/Always ask before deleting issues/i)).toBeDefined();
    expect(screen.getByText('v1.2.0')).toBeDefined();
  });

  it('triggers onDiscoverServer when clicking Discover Server button', () => {
    const onDiscover = vi.fn();
    render(<McpDetailView server={mockDiscoveredServer} onBack={vi.fn()} onDiscoverServer={onDiscover} />);

    const discoverBtn = screen.getByRole('button', { name: /Discover Server/i });
    expect(discoverBtn).toBeDefined();

    fireEvent.click(discoverBtn);
    expect(onDiscover).toHaveBeenCalledWith(mockDiscoveredServer);
  });
});

describe('McpConfigSidebar Discovery Rows', () => {
  it('displays version, protocol support, and discovery timestamp rows', () => {
    render(<McpConfigSidebar server={mockDiscoveredServer} />);

    expect(screen.getByText('Version')).toBeDefined();
    expect(screen.getByText('1.2.0')).toBeDefined();
    expect(screen.getByText('Last Discovered')).toBeDefined();
  });
});
