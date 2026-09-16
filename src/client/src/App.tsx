import React, { useState, useEffect } from 'react';
import './index.css';

type Tab = 'skills' | 'mcp' | 'conflicts' | 'settings';

interface SkillItem {
  id: string;
  name: string;
  ecosystem: string;
  status: string;
  description: string;
}

interface McpItem {
  id: string;
  name: string;
  transport: string;
  tools: number;
}

const sampleSkills: SkillItem[] = [
  { id: '1', name: 'gemini-coder', ecosystem: 'gemini', status: 'symlinked', description: 'Agent coding workflow and automation rules' },
  { id: '2', name: 'claude-architect', ecosystem: 'claude', status: 'original', description: 'Architectural analysis and system design skill' },
  { id: '3', name: 'codex-refactor', ecosystem: 'codex', status: 'symlinked', description: 'Clean code refactoring and test-driven development' }
];

const sampleMcp: McpItem[] = [
  { id: 'm1', name: 'github-tools', transport: 'stdio', tools: 14 },
  { id: 'm2', name: 'postgres-mcp', transport: 'stdio', tools: 8 }
];

export default function App(): React.ReactElement {
  const [activeTab, setActiveTab] = useState<Tab>('skills');
  const [colorMode, setColorMode] = useState<'light' | 'dark'>('light');

  useEffect(() => {
    document.documentElement.setAttribute('data-color-mode', colorMode);
  }, [colorMode]);

  const toggleTheme = () => {
    setColorMode((prev) => (prev === 'light' ? 'dark' : 'light'));
  };

  return (
    <div className="App">
      {/* Cockpit Header */}
      <header className="App-header">
        <div className="App-header-brand">
          <img
            src="/logo.png"
            alt="KoSkill Logo"
            style={{ width: '28px', height: '28px', objectFit: 'contain' }}
          />
          <span className="App-header-title">KoSkill</span>
          <span className="App-header-tag">v0.1.0</span>
        </div>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
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
        {/* Underline Navigation */}
        <nav className="UnderlineNav" aria-label="Dashboard Navigation">
          <button
            type="button"
            className={`UnderlineNav-item ${activeTab === 'skills' ? 'selected' : ''}`}
            onClick={() => setActiveTab('skills')}
          >
            Skills <span className="Counter">{sampleSkills.length}</span>
          </button>
          <button
            type="button"
            className={`UnderlineNav-item ${activeTab === 'mcp' ? 'selected' : ''}`}
            onClick={() => setActiveTab('mcp')}
          >
            MCP Servers <span className="Counter">{sampleMcp.length}</span>
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
          <div className="Box">
            <div className="Box-header">
              <span className="Box-title">Registered Skills Inventory</span>
              <span style={{ fontSize: '12px', color: 'var(--color-fg-muted)' }}>
                {sampleSkills.length} total active
              </span>
            </div>
            {sampleSkills.map((skill) => (
              <div key={skill.id} className="Box-row">
                <div>
                  <div style={{ fontWeight: 600, color: 'var(--color-accent-fg)', marginBottom: '4px' }}>
                    {skill.name}
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--color-fg-muted)' }}>
                    {skill.description}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <span className="Label Label--done">{skill.ecosystem}</span>
                  <span className="Label Label--success">{skill.status}</span>
                </div>
              </div>
            ))}
          </div>
        )}

        {activeTab === 'mcp' && (
          <div className="Box">
            <div className="Box-header">
              <span className="Box-title">Active Model Context Protocol Servers</span>
              <span style={{ fontSize: '12px', color: 'var(--color-fg-muted)' }}>
                {sampleMcp.length} servers configured
              </span>
            </div>
            {sampleMcp.map((mcp) => (
              <div key={mcp.id} className="Box-row">
                <div>
                  <div style={{ fontWeight: 600, color: 'var(--color-accent-fg)', marginBottom: '4px' }}>
                    {mcp.name}
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--color-fg-muted)' }}>
                    Transport: {mcp.transport}
                  </div>
                </div>
                <div>
                  <span className="Label Label--accent">{mcp.tools} tools</span>
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
      </main>
    </div>
  );
}
