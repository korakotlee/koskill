import React, { useMemo } from 'react';
import { marked } from 'marked';

export interface MarkdownViewerProps {
  content?: string;
}

export const MarkdownViewer: React.FC<MarkdownViewerProps> = ({ content }) => {
  const renderedHtml = useMemo(() => {
    if (!content || !content.trim()) return '';
    try {
      return marked.parse(content, { gfm: true, breaks: true }) as string;
    } catch {
      return `<p>${content}</p>`;
    }
  }, [content]);

  if (!content || !content.trim()) {
    return (
      <div style={{ padding: '24px', color: 'var(--color-fg-muted)', fontStyle: 'italic' }}>
        No documentation available for this skill.
      </div>
    );
  }

  return (
    <div
      className="markdown-body"
      style={{
        padding: '24px',
        color: 'var(--color-fg-default)',
        lineHeight: 1.6,
        fontSize: '14px'
      }}
      dangerouslySetInnerHTML={{ __html: renderedHtml }}
    />
  );
};
