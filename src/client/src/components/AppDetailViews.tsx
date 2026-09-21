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
  onToggleSkill?: (skill: SkillManifest, enabled: boolean) => void;
  onToggleWorkflow?: (workflow: WorkflowManifest, enabled: boolean) => void;
  onToggleMcp: (server: McpServerManifest, enabled: boolean) => void;
  onCentralizeMcp: (server: McpServerManifest) => void;
  onRevertMcp?: (server: McpServerManifest) => void;
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
  onToggleSkill,
  onToggleWorkflow,
  onToggleMcp,
  onCentralizeMcp,
  onRevertMcp,
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
        onToggleSkill={onToggleSkill}
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
        onToggleWorkflow={onToggleWorkflow}
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
        onRevert={onRevertMcp}
        onQueryTools={onQueryTools}
        onDiscoverServer={onDiscoverMcp}
      />
    );
  }

  return null;
};
