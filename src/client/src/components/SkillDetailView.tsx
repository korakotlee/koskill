import React from 'react';
import { SkillManifest } from '../../../core/types.js';
import { MarkdownViewer } from './MarkdownViewer.js';

export interface SkillDetailViewProps {
  skill: SkillManifest;
  onBack: () => void;
}

export const SkillDetailView: React.FC<SkillDetailViewProps> = ({ skill, onBack }) => {
  const lineCount = skill.rawContent ? skill.rawContent.split('\n').length : 0;
  const isGemini = skill.targetEcosystem === 'gemini';
  const badgeClass = isGemini ? 'Label Label--accent' : 'Label Label--done';

  return (
    <div>
      {/* Top Breadcrumb & Action Bar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '20px'
        }}
      >
        <button
          type="button"
          onClick={onBack}
          className="Btn"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            color: 'var(--color-accent-fg)',
            fontWeight: 500
          }}
        >
          &larr; Back to Discovery
        </button>
      </div>

      {/* Detail Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'baseline',
          gap: '12px',
          marginBottom: '16px',
          flexWrap: 'wrap'
        }}
      >
        <h2 style={{ fontSize: '24px', fontWeight: 600, margin: 0 }}>{skill.name}</h2>
        <span className={badgeClass}>{skill.targetEcosystem}</span>
        <span className="Label Label--success">{skill.status}</span>
      </div>

      {skill.description && (
        <p style={{ color: 'var(--color-fg-muted)', marginBottom: '24px', fontSize: '15px' }}>
          {skill.description}
        </p>
      )}

      {/* Two-Column Responsive Layout */}
      <div
        style={{
          display: 'flex',
          gap: '24px',
          flexWrap: 'wrap',
          alignItems: 'flex-start'
        }}
      >
        {/* Main Documentation Panel (65%) */}
        <div style={{ flex: '1 1 600px', minWidth: '320px' }}>
          <div className="Box">
            <div className="Box-header">
              <span className="Box-title">Documentation (SKILL.md)</span>
              <span style={{ fontSize: '12px', color: 'var(--color-fg-muted)' }}>
                {lineCount} lines
              </span>
            </div>
            <MarkdownViewer content={skill.rawContent} />
          </div>
        </div>

        {/* Metadata Sidebar (35%) */}
        <div style={{ flex: '0 1 340px', minWidth: '280px' }}>
          <div className="Box">
            <div className="Box-header">
              <span className="Box-title">Metadata Summary</span>
            </div>
            <div className="Box-row" style={{ display: 'block' }}>
              <div style={{ fontSize: '12px', color: 'var(--color-fg-muted)', marginBottom: '4px' }}>
                Filesystem Path
              </div>
              <div
                style={{
                  fontFamily: 'monospace',
                  fontSize: '12px',
                  wordBreak: 'break-all',
                  backgroundColor: 'var(--color-canvas-subtle)',
                  padding: '6px 8px',
                  borderRadius: 'var(--border-radius-small)'
                }}
              >
                {skill.sourcePath}
              </div>
            </div>
            <div className="Box-row">
              <span style={{ fontSize: '13px', color: 'var(--color-fg-muted)' }}>Ecosystem</span>
              <span className={badgeClass}>{skill.targetEcosystem}</span>
            </div>
            <div className="Box-row">
              <span style={{ fontSize: '13px', color: 'var(--color-fg-muted)' }}>Sync Status</span>
              <span className="Label Label--success">{skill.status}</span>
            </div>
            <div className="Box-row">
              <span style={{ fontSize: '13px', color: 'var(--color-fg-muted)' }}>Total Lines</span>
              <span style={{ fontWeight: 600 }}>{lineCount}</span>
            </div>
            {skill.metadata && Object.keys(skill.metadata).length > 0 && (
              <div className="Box-row" style={{ display: 'block' }}>
                <div style={{ fontSize: '12px', color: 'var(--color-fg-muted)', marginBottom: '6px' }}>
                  Frontmatter Attributes
                </div>
                <div style={{ fontSize: '12px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  {Object.entries(skill.metadata).map(([k, v]) => (
                    <div key={k}>
                      <code>{k}</code>: {String(v)}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
