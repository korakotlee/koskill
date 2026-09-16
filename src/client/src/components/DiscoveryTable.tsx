import React, { useState, useMemo } from 'react';
import { SkillManifest, WorkflowManifest } from '../../../core/types.js';

export interface DiscoveryTableProps {
  skills?: SkillManifest[];
  workflows?: WorkflowManifest[];
  onSelectSkill?: (skill: SkillManifest) => void;
  onSelectWorkflow?: (workflow: WorkflowManifest) => void;
}

export const DiscoveryTable: React.FC<DiscoveryTableProps> = ({
  skills,
  workflows,
  onSelectSkill,
  onSelectWorkflow
}) => {
  const [query, setQuery] = useState('');

  const isWorkflowMode = Boolean(workflows);

  const filteredSkills = useMemo(() => {
    if (!skills) return [];
    const q = query.trim().toLowerCase();
    if (!q) return skills;
    return skills.filter((s) =>
      s.name.toLowerCase().includes(q) ||
      (s.description && s.description.toLowerCase().includes(q)) ||
      s.targetEcosystem.toLowerCase().includes(q) ||
      (s.sourcePath && s.sourcePath.toLowerCase().includes(q))
    );
  }, [skills, query]);

  const filteredWorkflows = useMemo(() => {
    if (!workflows) return [];
    const q = query.trim().toLowerCase();
    if (!q) return workflows;
    return workflows.filter((w) =>
      w.name.toLowerCase().includes(q) ||
      w.command.toLowerCase().includes(q) ||
      (w.description && w.description.toLowerCase().includes(q)) ||
      w.targetEcosystem.toLowerCase().includes(q) ||
      w.scope.toLowerCase().includes(q) ||
      (w.sourcePath && w.sourcePath.toLowerCase().includes(q))
    );
  }, [workflows, query]);

  const itemsCount = isWorkflowMode ? (workflows?.length ?? 0) : (skills?.length ?? 0);
  const filteredCount = isWorkflowMode ? filteredWorkflows.length : filteredSkills.length;
  const placeholderText = isWorkflowMode
    ? 'Filter workflows by command, ecosystem, or path...'
    : 'Filter skills by name, ecosystem, or path...';
  const tableTitle = isWorkflowMode
    ? 'Discovered Workflows & Slash Commands'
    : 'Registered Skills Inventory';

  return (
    <div>
      {/* Search & Filter Bar */}
      <div style={{ marginBottom: '16px', display: 'flex', gap: '12px' }}>
        <input
          type="text"
          className="Form-input"
          placeholder={placeholderText}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          style={{
            width: '100%',
            maxWidth: '480px',
            padding: '6px 12px',
            fontSize: '14px',
            borderRadius: 'var(--border-radius-small)',
            border: '1px solid var(--color-border-default)',
            backgroundColor: 'var(--color-canvas-default)',
            color: 'var(--color-fg-default)'
          }}
        />
      </div>

      {/* Primer Box Table */}
      <div className="Box">
        <div className="Box-header">
          <span className="Box-title">{tableTitle}</span>
          <span style={{ fontSize: '12px', color: 'var(--color-fg-muted)' }}>
            Showing {filteredCount} of {itemsCount}
          </span>
        </div>

        {filteredCount === 0 ? (
          <div className="Box-row" style={{ color: 'var(--color-fg-muted)', fontStyle: 'italic' }}>
            No matching items found.
          </div>
        ) : isWorkflowMode ? (
          filteredWorkflows.map((workflow) => {
            const isGemini = workflow.targetEcosystem === 'gemini';
            const badgeClass = isGemini ? 'Label Label--accent' : 'Label Label--done';

            return (
              <div key={workflow.id} className="Box-row" style={{ cursor: 'pointer' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                    <button
                      type="button"
                      onClick={() => onSelectWorkflow?.(workflow)}
                      style={{
                        background: 'none',
                        border: 'none',
                        padding: 0,
                        font: 'inherit',
                        fontWeight: 600,
                        color: 'var(--color-accent-fg)',
                        cursor: 'pointer',
                        textAlign: 'left'
                      }}
                    >
                      <code style={{ fontSize: '14px', fontWeight: 600 }}>{workflow.command}</code>
                    </button>
                    <span className={badgeClass}>{workflow.targetEcosystem}</span>
                    <span className="Label Label--secondary">{workflow.scope}</span>
                    {workflow.metadata?.argumentHint && (
                      <span style={{ fontSize: '12px', color: 'var(--color-fg-muted)', fontFamily: 'monospace' }}>
                        {workflow.metadata.argumentHint}
                      </span>
                    )}
                  </div>

                  {workflow.description && (
                    <div style={{ fontSize: '12px', color: 'var(--color-fg-muted)', marginBottom: '4px' }}>
                      {workflow.description}
                    </div>
                  )}

                  <div
                    style={{
                      fontFamily: 'monospace',
                      fontSize: '11px',
                      color: 'var(--color-fg-muted)',
                      wordBreak: 'break-all'
                    }}
                  >
                    {workflow.sourcePath}
                  </div>
                </div>
              </div>
            );
          })
        ) : (
          filteredSkills.map((skill) => {
            const isGemini = skill.targetEcosystem === 'gemini';
            const badgeClass = isGemini ? 'Label Label--accent' : 'Label Label--done';

            return (
              <div key={skill.id} className="Box-row" style={{ cursor: 'pointer' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                    <button
                      type="button"
                      onClick={() => onSelectSkill?.(skill)}
                      style={{
                        background: 'none',
                        border: 'none',
                        padding: 0,
                        font: 'inherit',
                        fontWeight: 600,
                        color: 'var(--color-accent-fg)',
                        cursor: 'pointer',
                        textAlign: 'left'
                      }}
                    >
                      {skill.name}
                    </button>
                    <span className={badgeClass}>{skill.targetEcosystem}</span>
                    <span className="Label Label--success">{skill.status}</span>
                  </div>

                  {skill.description && (
                    <div style={{ fontSize: '12px', color: 'var(--color-fg-muted)', marginBottom: '4px' }}>
                      {skill.description}
                    </div>
                  )}

                  <div
                    style={{
                      fontFamily: 'monospace',
                      fontSize: '11px',
                      color: 'var(--color-fg-muted)',
                      wordBreak: 'break-all'
                    }}
                  >
                    {skill.sourcePath}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
