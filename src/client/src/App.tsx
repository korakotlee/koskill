import React, { useState, useEffect, useCallback } from 'react';
import './index.css';
import { SkillManifest, McpServerManifest, WorkflowManifest } from '../../core/types.js';
import { ConflictReport } from '../../core/conflict/types.js';
import { DiscoveryTable } from './components/DiscoveryTable.js';
import { FlashNotification } from './components/FlashNotification.js';
import { McpServerList } from './components/McpServerList.js';
import { AppHeader } from './components/AppHeader.js';
import { ConflictList } from './components/ConflictList.js';
import { ConflictModal } from './components/ConflictModal.js';
import { AppDetailViews } from './components/AppDetailViews.js';
import { BackupModal } from './components/BackupModal.js';
import { VaultDrawer } from './components/VaultDrawer.js';
import { SettingsView } from './components/SettingsView.js';
import { RouterLogView } from './components/RouterLogView.js';
import { AppTabNavigation, Tab } from './components/AppTabNavigation.js';
import { initialSkills, initialMcp, initialWorkflows } from './mockData.js';
import { useInventoryActions } from './hooks/useInventoryActions.js';
import { useBackupAndVault } from './hooks/useBackupAndVault.js';
import { useEntityToggles } from './hooks/useEntityToggles.js';
import { useConflictResolver } from './hooks/useConflictResolver.js';

export default function App(): React.ReactElement {
  const [activeTab, setActiveTab] = useState<Tab>('skills');
  const [colorMode, setColorMode] = useState<'light' | 'dark'>('light');
  const [skills, setSkills] = useState<SkillManifest[]>(initialSkills);
  const [mcpServers, setMcpServers] = useState<McpServerManifest[]>(initialMcp);
  const [workflows, setWorkflows] = useState<WorkflowManifest[]>(initialWorkflows);
  const [conflicts, setConflicts] = useState<ConflictReport[]>([]);
  const [logsCount, setLogsCount] = useState<number>(0);
  const [selectedConflict, setSelectedConflict] = useState<ConflictReport | null>(null);
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
      const [skillsRes, mcpRes, workflowsRes, conflictsRes] = await Promise.all([
        fetch('/api/skills'),
        fetch('/api/mcp'),
        fetch('/api/workflows'),
        fetch('/api/conflicts'),
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
      if (conflictsRes.ok) {
        const confData = await conflictsRes.json();
        if (Array.isArray(confData.conflicts)) {
          setConflicts(confData.conflicts);
          setSelectedConflict((prev) => (prev ? confData.conflicts.find((c: ConflictReport) => c.id === prev.id) || null : null));
        }
      }
      fetch('/api/router/status')
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => {
          if (d?.metrics?.totalTransactions !== undefined) {
            setLogsCount(d.metrics.totalTransactions);
          }
        })
        .catch(() => {});
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
    handleRevertMcp,
    handleToggleMcp,
    handleGenerateMcpSubset,
    handleQueryMcpTools,
    handleDiscoverMcp,
  } = useInventoryActions(fetchInventory, {
    setSelectedSkill,
    setSelectedWorkflow,
    setSelectedMcp,
  });

  const { handleToggleSkill, handleToggleWorkflow } = useEntityToggles({
    fetchInventory,
    setFlash,
    setSelectedSkill,
    setSelectedWorkflow,
  });

  const {
    isBackupOpen,
    setIsBackupOpen,
    isVaultOpen,
    setIsVaultOpen,
    vaultSecrets,
    fetchSecrets,
    isProcessing: isBackupProcessing,
    backupError,
    backupSuccess,
    vaultError,
    vaultSuccess,
    handleExportBackup,
    handleImportBackup,
    handleSaveSecret,
  } = useBackupAndVault(fetchInventory);

  const { handleResolveConflict } = useConflictResolver({
    setFlash,
    setSelectedConflict,
    fetchInventory,
  });

  const hasDetailSelected = Boolean(selectedSkill || selectedWorkflow || selectedMcp);

  return (
    <div className="App">
      <AppHeader
        isConnected={isConnected}
        isRefreshing={isRefreshing}
        colorMode={colorMode}
        onRefresh={fetchInventory}
        onToggleTheme={toggleTheme}
        onOpenBackup={() => setIsBackupOpen(true)}
        onOpenVault={() => {
          setIsVaultOpen(true);
          fetchSecrets();
        }}
      />

      <main className="App-main" style={{ maxWidth: '1200px', margin: '0 auto', padding: '24px 16px' }}>
        {flash && (
          <FlashNotification
            message={flash.message}
            type={flash.type}
            onDismiss={() => setFlash(null)}
            autoCloseMs={5000}
          />
        )}

        {hasDetailSelected ? (
          <AppDetailViews
            selectedSkill={selectedSkill}
            selectedWorkflow={selectedWorkflow}
            selectedMcp={selectedMcp}
            onClearSelection={() => {
              setSelectedSkill(null);
              setSelectedWorkflow(null);
              setSelectedMcp(null);
            }}
            onCentralizeSkill={handleCentralizeSkill}
            onRevertSkill={handleRevertSkill}
            onCentralizeWorkflow={handleCentralizeWorkflow}
            onRevertWorkflow={handleRevertWorkflow}
            onToggleSkill={handleToggleSkill}
            onToggleWorkflow={handleToggleWorkflow}
            onToggleMcp={handleToggleMcp}
            onCentralizeMcp={handleCentralizeMcp}
            onRevertMcp={handleRevertMcp}
            onQueryTools={handleQueryMcpTools}
            onDiscoverMcp={handleDiscoverMcp}
          />
        ) : (
          <>
            <AppTabNavigation
              activeTab={activeTab}
              onSelectTab={setActiveTab}
              skillsCount={skills.length}
              workflowsCount={workflows.length}
              mcpCount={mcpServers.length}
              conflictsCount={conflicts.length}
              logsCount={logsCount}
            />

            {activeTab === 'skills' && (
              <DiscoveryTable
                skills={skills}
                onSelectSkill={(skill) => setSelectedSkill(skill)}
                onCentralizeSkill={handleCentralizeSkill}
                onRevertSkill={handleRevertSkill}
                onBatchCentralize={handleBatchCentralize}
                onBatchRevert={handleBatchRevert}
                onToggleSkill={handleToggleSkill}
              />
            )}
            {activeTab === 'workflows' && (
              <DiscoveryTable
                workflows={workflows}
                onSelectWorkflow={(wf) => setSelectedWorkflow(wf)}
                onCentralizeWorkflow={handleCentralizeWorkflow}
                onRevertWorkflow={handleRevertWorkflow}
                onToggleWorkflow={handleToggleWorkflow}
              />
            )}
            {activeTab === 'mcp' && (
              <McpServerList
                servers={mcpServers}
                onSelectServer={(server) => setSelectedMcp(server)}
                onGenerateSubset={handleGenerateMcpSubset}
                onToggleEnabled={handleToggleMcp}
                onCentralizeServer={handleCentralizeMcp}
                onRevertServer={handleRevertMcp}
                onDiscoverServer={handleDiscoverMcp}
              />
            )}
            {activeTab === 'conflicts' && (
              <ConflictList
                conflicts={conflicts}
                onSelectConflict={(conflict) => setSelectedConflict(conflict)}
              />
            )}
            {activeTab === 'logs' && <RouterLogView />}
            {activeTab === 'settings' && (
              <SettingsView
                onOpenBackup={() => setIsBackupOpen(true)}
                onOpenVault={() => {
                  setIsVaultOpen(true);
                  fetchSecrets();
                }}
              />
            )}
          </>
        )}

        {selectedConflict && (
          <ConflictModal
            conflict={selectedConflict}
            onClose={() => setSelectedConflict(null)}
            onResolve={handleResolveConflict}
          />
        )}

        <BackupModal
          isOpen={isBackupOpen}
          onClose={() => setIsBackupOpen(false)}
          onExport={handleExportBackup}
          onImport={handleImportBackup}
          isProcessing={isBackupProcessing}
          errorMessage={backupError}
          successMessage={backupSuccess}
        />

        <VaultDrawer
          isOpen={isVaultOpen}
          secrets={vaultSecrets}
          onClose={() => setIsVaultOpen(false)}
          onSaveSecret={handleSaveSecret}
          errorMessage={vaultError}
          successMessage={vaultSuccess}
        />
      </main>
    </div>
  );
}
