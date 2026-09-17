import React, { useState, useEffect, useCallback } from 'react';
import './index.css';
import { SkillManifest, McpServerManifest, WorkflowManifest } from '../../core/types.js';
import { DiscoveryTable } from './components/DiscoveryTable.js';
import { SkillDetailView } from './components/SkillDetailView.js';
import { WorkflowDetailView } from './components/WorkflowDetailView.js';
import { McpDetailView } from './components/McpDetailView.js';
import { FlashNotification } from './components/FlashNotification.js';
import { McpServerList } from './components/McpServerList.js';
import { initialSkills, initialMcp, initialWorkflows } from './mockData.js';
import { useInventoryActions } from './hooks/useInventoryActions.js';

type Tab = 'skills' | 'workflows' | 'mcp' | 'conflicts' | 'settings';

export default function App(): React.ReactElement {
  const [activeTab, setActiveTab] = useState<Tab>('skills');
  const [colorMode, setColorMode] = useState<'light' | 'dark'>('light');
  const [skills, setSkills] = useState<SkillManifest[]>(initialSkills);
  const [mcpServers, setMcpServers] = useState<McpServerManifest[]>(initialMcp);
  const [workflows, setWorkflows] = useState<WorkflowManifest[]>(initialWorkflows);
  const [selectedSkill, setSelectedSkill] = useState<SkillManifest | null>(null);
  const [selectedWorkflow, setSelectedWorkflow] = useState<WorkflowManifest | null>(null);
  const [selectedMcp, setSelectedMcp] = useState<McpServerManifest | null>(null);
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
      const [skillsRes, mcpRes, workflowsRes] = await Promise.all([
        fetch('/api/skills'),
        fetch('/api/mcp'),
        fetch('/api/workflows'),
      ]);

      if (skillsRes.ok) {
        const skillsData = await skillsRes.json();
        if (Array.isArray(skillsData.skills)) {
          setSkills(skillsData.skills);
          setSelectedSkill((prev) => (prev ? skillsData.skills.find((s: SkillManifest) => s.id === prev.id) || prev : null));
        }
      }
      if (mcpRes.ok) {
        const mcpData = await mcpRes.json();
        if (Array.isArray(mcpData.servers)) {
          setMcpServers(mcpData.servers);
          setSelectedMcp((prev) => (prev ? mcpData.servers.find((s: McpServerManifest) => s.id === prev.id || s.name === prev.name) || prev : null));
        }
      }
      if (workflowsRes.ok) {
        const workflowsData = await workflowsRes.json();
        if (Array.isArray(workflowsData.workflows)) {
          setWorkflows(workflowsData.workflows);
          setSelectedWorkflow((prev) => (prev ? workflowsData.workflows.find((w: WorkflowManifest) => w.id === prev.id) || prev : null));
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

  const {
    flash,
    setFlash,
    handleCentralizeSkill,
    handleRevertSkill,
    handleBatchCentralize,
    handleBatchRevert,
    handleCentralizeWorkflow,
    handleRevertWorkflow,
    handleCentralizeMcp,
    handleToggleMcp,
    handleGenerateMcpSubset,
    handleQueryMcpTools,
  } = useInventoryActions(fetchInventory, {
    setSelectedSkill,
    setSelectedWorkflow,
    setSelectedMcp,
  });

  return (
    <div className="App">
      <header className="App-header">
        <div className="App-header-brand">
          <a href="/" className="App-header-brand-link">
            <img src="/logo.png" alt="KoSkill Logo" style={{ width: '28px', height: '28px', objectFit: 'contain' }} />
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
              marginLeft: '8px',
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
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
          >
            {isRefreshing ? 'Scanning...' : 'Refresh Discovery'}
          </button>
          <button
            type="button"
            className="Theme-toggle"
            onClick={toggleTheme}
            aria-label="Toggle Theme"
          >
            Theme: {colorMode === 'light' ? 'Light' : 'Dark'}
          </button>
        </div>
      </header>

      <main className="App-main" style={{ maxWidth: '1200px', margin: '0 auto', padding: '24px 16px' }}>
        {flash && (
          <FlashNotification
            message={flash.message}
            type={flash.type}
            onDismiss={() => setFlash(null)}
            autoCloseMs={5000}
          />
        )}

        {selectedSkill ? (
          <SkillDetailView
            skill={selectedSkill}
            onBack={() => setSelectedSkill(null)}
            onCentralizeSkill={handleCentralizeSkill}
            onRevertSkill={handleRevertSkill}
          />
        ) : selectedWorkflow ? (
          <WorkflowDetailView
            workflow={selectedWorkflow}
            onBack={() => setSelectedWorkflow(null)}
            onCentralizeWorkflow={handleCentralizeWorkflow}
            onRevertWorkflow={handleRevertWorkflow}
          />
        ) : selectedMcp ? (
          <McpDetailView
            server={selectedMcp}
            onBack={() => setSelectedMcp(null)}
            onToggleEnabled={handleToggleMcp}
            onCentralize={handleCentralizeMcp}
            onQueryTools={handleQueryMcpTools}
          />
        ) : (
          <>
            <nav className="UnderlineNav" aria-label="Ecosystem Views" style={{ marginBottom: '20px' }}>
              <button
                type="button"
                className={`UnderlineNav-item ${activeTab === 'skills' ? 'selected' : ''}`}
                onClick={() => setActiveTab('skills')}
              >
                Skills <span className="Counter">{skills.length}</span>
              </button>
              <button
                type="button"
                className={`UnderlineNav-item ${activeTab === 'workflows' ? 'selected' : ''}`}
                onClick={() => setActiveTab('workflows')}
              >
                Workflows <span className="Counter">{workflows.length}</span>
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

            {activeTab === 'skills' && (
              <DiscoveryTable
                skills={skills}
                onSelectSkill={(skill) => setSelectedSkill(skill)}
                onCentralizeSkill={handleCentralizeSkill}
                onRevertSkill={handleRevertSkill}
                onBatchCentralize={handleBatchCentralize}
                onBatchRevert={handleBatchRevert}
              />
            )}
            {activeTab === 'workflows' && (
              <DiscoveryTable
                workflows={workflows}
                onSelectWorkflow={(wf) => setSelectedWorkflow(wf)}
                onCentralizeWorkflow={handleCentralizeWorkflow}
                onRevertWorkflow={handleRevertWorkflow}
              />
            )}
            {activeTab === 'mcp' && (
              <McpServerList
                servers={mcpServers}
                onSelectServer={(server) => setSelectedMcp(server)}
                onGenerateSubset={handleGenerateMcpSubset}
                onToggleEnabled={handleToggleMcp}
                onCentralizeServer={handleCentralizeMcp}
              />
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
                  <div><strong>Global Config Root:</strong> <code>~/.gemini/config</code></div>
                </div>
                <div className="Box-row">
                  <div><strong>Storage Root:</strong> <code>~/.koskill/skills</code></div>
                </div>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
