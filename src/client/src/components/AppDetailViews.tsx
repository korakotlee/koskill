import React from 'react';
import { SkillManifest, WorkflowManifest, McpServerManifest } from '../../../core/types.js';
import { SkillDetailView } from './SkillDetailView.js';
import { WorkflowDetailView } from './WorkflowDetailView.js';
import { McpDetailView } from './McpDetailView.js';

export interface AppDetailViewsProps {
  selectedSkill: SkillManifest | null;
  selectedWorkflow: WorkflowManifest | null;
  selectedMcp: McpServerManifest | null;
  onClearSelection: () => void;
  onCentralizeSkill: (skill: SkillManifest) => void;
  onRevertSkill: (skill: SkillManifest) => void;
  onCentralizeWorkflow: (workflow: WorkflowManifest) => void;
  onRevertWorkflow: (workflow: WorkflowManifest) => void;
  onToggleMcp: (server: McpServerManifest, enabled: boolean) => void;
  onCentralizeMcp: (server: McpServerManifest) => void;
  onQueryTools: (server: McpServerManifest) => void;
  onDiscoverMcp: (server: McpServerManifest) => void;
}

/**
 * Renders appropriate item detail page when an item is selected from tables.
 */
export const AppDetailViews: React.FC<AppDetailViewsProps> = ({
  selectedSkill,
  selectedWorkflow,
  selectedMcp,
  onClearSelection,
  onCentralizeSkill,
  onRevertSkill,
  onCentralizeWorkflow,
  onRevertWorkflow,
  onToggleMcp,
  onCentralizeMcp,
  onQueryTools,
  onDiscoverMcp,
}) => {
  if (selectedSkill) {
    return (
      <SkillDetailView
        skill={selectedSkill}
        onBack={onClearSelection}
        onCentralizeSkill={onCentralizeSkill}
        onRevertSkill={onRevertSkill}
      />
    );
  }

  if (selectedWorkflow) {
    return (
      <WorkflowDetailView
        workflow={selectedWorkflow}
        onBack={onClearSelection}
        onCentralizeWorkflow={onCentralizeWorkflow}
        onRevertWorkflow={onRevertWorkflow}
      />
    );
  }

  if (selectedMcp) {
    return (
      <McpDetailView
        server={selectedMcp}
        onBack={onClearSelection}
        onToggleEnabled={onToggleMcp}
        onCentralize={onCentralizeMcp}
        onQueryTools={onQueryTools}
        onDiscoverServer={onDiscoverMcp}
      />
    );
  }

  return null;
};
