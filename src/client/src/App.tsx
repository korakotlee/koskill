import React, { useState, useEffect, useCallback } from 'react';
import './index.css';
import { SkillManifest, McpServerManifest } from '../../core/types.js';
import { DiscoveryTable } from './components/DiscoveryTable.js';
import { SkillDetailView } from './components/SkillDetailView.js';

type Tab = 'skills' | 'mcp' | 'conflicts' | 'settings';

const initialSkills: SkillManifest[] = [
  {
    id: 'gemini:gemini-coder',
    name: 'gemini-coder',
    description: 'Agent coding workflow and automation rules',
    sourcePath: '~/.gemini/config/skills/gemini-coder/SKILL.md',
    targetEcosystem: 'gemini',
    status: 'symlinked',
    rawContent: '# Gemini Coder\n\nAgent coding workflow and automation rules.'
  },
  {
    id: 'claude:claude-architect',
    name: 'claude-architect',
    description: 'Architectural analysis and system design skill',
    sourcePath: '~/.claude/settings.json',
    targetEcosystem: 'claude',
    status: 'original',
    rawContent: '# Claude Architect\n\nArchitectural analysis and system design skill.'
  },
  {
    id: 'codex:codex-refactor',
    name: 'codex-refactor',
    description: 'Clean code refactoring and test-driven development',
    sourcePath: '~/.config/codex/skills/codex-refactor',
    targetEcosystem: 'codex',
    status: 'symlinked',
    rawContent: '# Codex Refactor\n\nClean code refactoring and test-driven development.'
  }
];

const initialMcp: McpServerManifest[] = [
  {
    id: 'gemini:github-tools',
    name: 'github-tools',
    transport: 'stdio',
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-github'],
    declaredToolsCount: 14
  },
  {
    id: 'claude:postgres-mcp',
    name: 'postgres-mcp',
    transport: 'stdio',
    command: 'docker',
    args: ['run', '-i', 'mcp/postgres'],
    declaredToolsCount: 8
  }
];

export default function App(): React.ReactElement {
  const [activeTab, setActiveTab] = useState<Tab>('skills');
  const [colorMode, setColorMode] = useState<'light' | 'dark'>('light');
  const [skills, setSkills] = useState<SkillManifest[]>(initialSkills);
  const [mcpServers, setMcpServers] = useState<McpServerManifest[]>(initialMcp);
  const [selectedSkill, setSelectedSkill] = useState<SkillManifest | null>(null);
  const [isConnected, setIsConnected] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);

  useEffect(() => {
    document.documentElement.setAttribute('data-color-mode', colorMode);
  }, [colorMode]);

  const toggleTheme = () => {
    setColorMode((prev) => (prev === 'light' ? 'dark' : 'light'));
  };

  const fetchInventory = useCallback(async () => {
    setIsRefreshing(true);
    try {
      const [skillsRes, mcpRes] = await Promise.all([
        fetch('/api/skills'),
        fetch('/api/mcp')
      ]);

      if (skillsRes.ok) {
        const skillsData = await skillsRes.json();
        if (Array.isArray(skillsData.skills)) {
          setSkills(skillsData.skills);
        }
      }

      if (mcpRes.ok) {
        const mcpData = await mcpRes.json();
        if (Array.isArray(mcpData.servers)) {
          setMcpServers(mcpData.servers);
        }
      }

      setIsConnected(true);
    } catch {
      setIsConnected(false);
    } finally {
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchInventory();
  }, [fetchInventory]);

  return (
    <div className="App">
      {/* Cockpit Header */}
      <header className="App-header">
        <div className="App-header-brand">
          <a href="/" className="App-header-brand-link">
            <img
              src="/logo.png"
              alt="KoSkill Logo"
              style={{ width: '28px', height: '28px', objectFit: 'contain' }}
            />
            <span className="App-header-title">KoSkill</span>
          </a>
          <span className="App-header-tag">v0.1.0</span>
          <span
            style={{
              fontSize: '12px',
              color: isConnected ? 'var(--color-success-fg)' : 'var(--color-danger-fg)',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              marginLeft: '8px'
            }}
          >
            ● {isConnected ? 'Connected to 127.0.0.1:3900' : 'Offline'}
          </span>
        </div>

        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <button
            type="button"
            className="Btn"
            onClick={fetchInventory}
            disabled={isRefreshing}
            aria-label="Refresh inventory"
          >
            {isRefreshing ? 'Refreshing...' : 'Refresh'}
          </button>
          <button
            type="button"
            className="Btn"
            onClick={toggleTheme}
            aria-label="Theme toggle"
          >
            Theme: {colorMode === 'light' ? 'Light' : 'Dark'}
          </button>
          <button type="button" className="Btn Btn-primary">
            + Add Skill
          </button>
        </div>
      </header>

      {/* Main Container */}
      <main className="Container">
        {selectedSkill ? (
          <SkillDetailView
            skill={selectedSkill}
            onBack={() => setSelectedSkill(null)}
          />
        ) : (
          <>
            {/* Underline Navigation */}
            <nav className="UnderlineNav" aria-label="Dashboard Navigation">
              <button
                type="button"
                className={`UnderlineNav-item ${activeTab === 'skills' ? 'selected' : ''}`}
                onClick={() => setActiveTab('skills')}
              >
                Skills <span className="Counter">{skills.length}</span>
              </button>
              <button
                type="button"
                className={`UnderlineNav-item ${activeTab === 'mcp' ? 'selected' : ''}`}
                onClick={() => setActiveTab('mcp')}
              >
                MCP Servers <span className="Counter">{mcpServers.length}</span>
              </button>
              <button
                type="button"
                className={`UnderlineNav-item ${activeTab === 'conflicts' ? 'selected' : ''}`}
                onClick={() => setActiveTab('conflicts')}
              >
                Conflicts <span className="Counter">0</span>
              </button>
              <button
                type="button"
                className={`UnderlineNav-item ${activeTab === 'settings' ? 'selected' : ''}`}
                onClick={() => setActiveTab('settings')}
              >
                Settings
              </button>
            </nav>

            {/* Tab Panels */}
            {activeTab === 'skills' && (
              <DiscoveryTable
                skills={skills}
                onSelectSkill={(skill) => setSelectedSkill(skill)}
              />
            )}

            {activeTab === 'mcp' && (
              <div className="Box">
                <div className="Box-header">
                  <span className="Box-title">Active Model Context Protocol Servers</span>
                  <span style={{ fontSize: '12px', color: 'var(--color-fg-muted)' }}>
                    {mcpServers.length} servers configured
                  </span>
                </div>
                {mcpServers.map((mcp) => (
                  <div key={mcp.id} className="Box-row">
                    <div>
                      <div style={{ fontWeight: 600, color: 'var(--color-accent-fg)', marginBottom: '4px' }}>
                        {mcp.name}
                      </div>
                      <div style={{ fontSize: '12px', color: 'var(--color-fg-muted)' }}>
                        Transport: {mcp.transport} | Command: <code>{mcp.command}</code>
                      </div>
                    </div>
                    <div>
                      <span className="Label Label--accent">{mcp.declaredToolsCount} tools</span>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {activeTab === 'conflicts' && (
              <div className="Box">
                <div className="Box-header">
                  <span className="Box-title">Conflict Resolution Queue</span>
                </div>
                <div className="Box-row" style={{ color: 'var(--color-success-fg)' }}>
                  No synchronization conflicts detected across registered agents.
                </div>
              </div>
            )}

            {activeTab === 'settings' && (
              <div className="Box">
                <div className="Box-header">
                  <span className="Box-title">Workspace Configuration</span>
                </div>
                <div className="Box-row">
                  <div>
                    <strong>Global Config Root:</strong> <code>~/.gemini/config</code>
                  </div>
                </div>
                <div className="Box-row">
                  <div>
                    <strong>Storage Root:</strong> <code>~/.koskill/storage</code>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
