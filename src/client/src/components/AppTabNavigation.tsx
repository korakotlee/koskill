import React from 'react';

export type Tab = 'skills' | 'workflows' | 'mcp' | 'conflicts' | 'logs' | 'settings';

export interface AppTabNavigationProps {
  activeTab: Tab;
  onSelectTab: (tab: Tab) => void;
  skillsCount: number;
  workflowsCount: number;
  mcpCount: number;
  conflictsCount: number;
  logsCount?: number;
}

/**
 * Navigation bar for switching between entity catalog tabs and workspace settings.
 */
export const AppTabNavigation: React.FC<AppTabNavigationProps> = ({
  activeTab,
  onSelectTab,
  skillsCount,
  workflowsCount,
  mcpCount,
  conflictsCount,
  logsCount = 0,
}) => {
  return (
    <nav className="UnderlineNav" aria-label="Ecosystem Views" style={{ marginBottom: '20px' }}>
      <button
        type="button"
        className={`UnderlineNav-item ${activeTab === 'skills' ? 'selected' : ''}`}
        onClick={() => onSelectTab('skills')}
      >
        Skills <span className="Counter">{skillsCount}</span>
      </button>
      <button
        type="button"
        className={`UnderlineNav-item ${activeTab === 'workflows' ? 'selected' : ''}`}
        onClick={() => onSelectTab('workflows')}
      >
        Workflows <span className="Counter">{workflowsCount}</span>
      </button>
      <button
        type="button"
        className={`UnderlineNav-item ${activeTab === 'mcp' ? 'selected' : ''}`}
        onClick={() => onSelectTab('mcp')}
      >
        MCP Servers <span className="Counter">{mcpCount}</span>
      </button>
      <button
        type="button"
        className={`UnderlineNav-item ${activeTab === 'conflicts' ? 'selected' : ''}`}
        onClick={() => onSelectTab('conflicts')}
      >
        Conflicts{' '}
        <span
          className="Counter"
          style={
            conflictsCount > 0
              ? { backgroundColor: 'var(--color-danger-fg)', color: '#fff' }
              : undefined
          }
        >
          {conflictsCount}
        </span>
      </button>
      <button
        type="button"
        className={`UnderlineNav-item ${activeTab === 'logs' ? 'selected' : ''}`}
        onClick={() => onSelectTab('logs')}
      >
        Logs <span className={`Counter ${logsCount ? 'active' : ''}`}>{logsCount ?? 0}</span>
      </button>
      <button
        type="button"
        className={`UnderlineNav-item ${activeTab === 'settings' ? 'selected' : ''}`}
        onClick={() => onSelectTab('settings')}
      >
        Settings
      </button>
    </nav>
  );
};
