import React, { useState, useMemo } from 'react';
import { SkillManifest } from '../../../core/types.js';

export interface DiscoveryTableProps {
  skills: SkillManifest[];
  onSelectSkill: (skill: SkillManifest) => void;
}

export const DiscoveryTable: React.FC<DiscoveryTableProps> = ({ skills, onSelectSkill }) => {
  const [query, setQuery] = useState('');

  const filteredSkills = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return skills;
    return skills.filter((s) =>
      s.name.toLowerCase().includes(q) ||
      (s.description && s.description.toLowerCase().includes(q)) ||
      s.targetEcosystem.toLowerCase().includes(q) ||
      (s.sourcePath && s.sourcePath.toLowerCase().includes(q))
    );
  }, [skills, query]);

  return (
    <div>
      {/* Search & Filter Bar */}
      <div style={{ marginBottom: '16px', display: 'flex', gap: '12px' }}>
        <input
          type="text"
          className="Form-input"
          placeholder="Filter skills by name, ecosystem, or path..."
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
          <span className="Box-title">Registered Skills Inventory</span>
          <span style={{ fontSize: '12px', color: 'var(--color-fg-muted)' }}>
            Showing {filteredSkills.length} of {skills.length}
          </span>
        </div>

        {filteredSkills.length === 0 ? (
          <div className="Box-row" style={{ color: 'var(--color-fg-muted)', fontStyle: 'italic' }}>
            No matching items found.
          </div>
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
                      onClick={() => onSelectSkill(skill)}
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
