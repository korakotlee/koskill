import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { McpDetailView } from '../../../src/client/src/components/McpDetailView.js';
import { McpServerManifest } from '../../../src/core/types.js';

const sampleMcp: McpServerManifest = {
  id: 'gemini:chrome-devtools-mcp',
  name: 'chrome-devtools-mcp',
  transport: 'stdio',
  command: 'node',
  args: ['/path/to/server.js'],
  declaredToolsCount: 3,
  enabled: true,
  status: 'original',
  tools: [
    { name: 'click', description: 'Clicks on the specified DOM element' },
    { name: 'navigate_page', description: 'Navigates browser to URL' },
    { name: 'take_screenshot', description: 'Captures full page or element screenshot' },
  ],
  env: {
    NODE_ENV: 'production',
  },
};

describe('McpDetailView Component', () => {
  it('renders server header, transport, and back button', () => {
    const onBack = vi.fn();
    render(<McpDetailView server={sampleMcp} onBack={onBack} />);

    expect(screen.getByRole('heading', { level: 2, name: /chrome-devtools-mcp/i })).toBeDefined();
    expect(screen.getAllByText('stdio').length).toBeGreaterThanOrEqual(1);

    const backBtn = screen.getByRole('button', { name: /Back to MCP Servers/i });
    expect(backBtn).toBeDefined();
    fireEvent.click(backBtn);
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it('renders all declared tools with bold names and normal descriptions', () => {
    render(<McpDetailView server={sampleMcp} onBack={vi.fn()} />);

    expect(screen.getByText('Tools & Capabilities')).toBeDefined();
    expect(screen.getByText('3 declared tools')).toBeDefined();

    const clickTool = screen.getByText('click');
    expect(clickTool.style.fontWeight).toBe('700');

    const clickDesc = screen.getByText('Clicks on the specified DOM element');
    expect(clickDesc.style.fontWeight).toBe('400');

    expect(screen.getByText('navigate_page')).toBeDefined();
    expect(screen.getByText('take_screenshot')).toBeDefined();
  });

  it('handles toggle enabled button trigger', async () => {
    const onToggle = vi.fn();
    render(<McpDetailView server={sampleMcp} onBack={vi.fn()} onToggleEnabled={onToggle} />);

    const toggleBtn = screen.getByRole('button', { name: /Server Enabled/i });
    expect(toggleBtn).toBeDefined();

    fireEvent.click(toggleBtn);
    expect(onToggle).toHaveBeenCalledWith(sampleMcp, false);
  });

  it('handles centralize button trigger', async () => {
    const onCentralize = vi.fn();
    render(<McpDetailView server={sampleMcp} onBack={vi.fn()} onCentralize={onCentralize} />);

    const centralizeBtn = screen.getByRole('button', { name: /Centralize Server/i });
    expect(centralizeBtn).toBeDefined();

    fireEvent.click(centralizeBtn);
    expect(onCentralize).toHaveBeenCalledWith(sampleMcp);
  });

  it('automatically triggers onQueryTools when server has 0 tools', async () => {
    const emptyServer: McpServerManifest = {
      ...sampleMcp,
      tools: [],
      declaredToolsCount: 0,
    };
    const onQueryTools = vi.fn().mockResolvedValue([]);

    render(<McpDetailView server={emptyServer} onBack={vi.fn()} onQueryTools={onQueryTools} />);

    expect(onQueryTools).toHaveBeenCalledWith(emptyServer);
  });

  it('triggers onQueryTools when clicking Refresh Tools button', async () => {
    const onQueryTools = vi.fn().mockResolvedValue([]);
    render(<McpDetailView server={sampleMcp} onBack={vi.fn()} onQueryTools={onQueryTools} />);

    const refreshBtn = screen.getByRole('button', { name: /Refresh Tools/i });
    expect(refreshBtn).toBeDefined();

    fireEvent.click(refreshBtn);
    expect(onQueryTools).toHaveBeenCalledWith(sampleMcp);
  });
});

