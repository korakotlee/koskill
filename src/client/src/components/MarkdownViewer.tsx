import React, { useMemo } from 'react';
import { marked } from 'marked';

export interface MarkdownViewerProps {
  content?: string;
}

export interface FrontmatterEntry {
  key: string;
  value: string;
}

export interface ParsedMarkdown {
  frontmatter: FrontmatterEntry[] | null;
  body: string;
}

export function parseFrontmatter(content: string): ParsedMarkdown {
  if (!content) return { frontmatter: null, body: '' };

  const trimmed = content.trimStart();
  if (!trimmed.startsWith('---')) {
    return { frontmatter: null, body: content };
  }

  const firstLineEnd = trimmed.indexOf('\n');
  if (firstLineEnd === -1) {
    return { frontmatter: null, body: content };
  }

  const firstLine = trimmed.slice(0, firstLineEnd).trim();
  if (firstLine !== '---') {
    return { frontmatter: null, body: content };
  }

  const closingIdx = trimmed.indexOf('\n---', firstLineEnd);
  if (closingIdx === -1) {
    return { frontmatter: null, body: content };
  }

  const afterClosing = trimmed.slice(closingIdx + 1);
  const closingLineEnd = afterClosing.indexOf('\n');
  const closingLine = closingLineEnd === -1 ? afterClosing.trim() : afterClosing.slice(0, closingLineEnd).trim();
  if (closingLine !== '---') {
    return { frontmatter: null, body: content };
  }

  const frontmatterRaw = trimmed.slice(firstLineEnd + 1, closingIdx);
  const body = closingLineEnd === -1 ? '' : afterClosing.slice(closingLineEnd + 1);

  const lines = frontmatterRaw.split('\n');
  const entries: FrontmatterEntry[] = [];
  let current: FrontmatterEntry | null = null;

  for (const line of lines) {
    const colonIdx = line.indexOf(':');
    if (colonIdx > 0 && !line.startsWith(' ') && !line.startsWith('\t')) {
      const key = line.slice(0, colonIdx).trim();
      let value = line.slice(colonIdx + 1).trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      current = { key, value };
      entries.push(current);
    } else if (current && line.trim()) {
      current.value += '\n' + line.trim();
    }
  }

  return {
    frontmatter: entries.length > 0 ? entries : null,
    body,
  };
}

export const MarkdownViewer: React.FC<MarkdownViewerProps> = ({ content }) => {
  const { frontmatter, body } = useMemo(() => {
    return parseFrontmatter(content || '');
  }, [content]);

  const renderedHtml = useMemo(() => {
    if (!body || !body.trim()) return '';
    try {
      return marked.parse(body.trim(), { gfm: true, breaks: true }) as string;
    } catch {
      return `<p>${body}</p>`;
    }
  }, [body]);

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
        fontSize: '14px',
      }}
    >
      {frontmatter && frontmatter.length > 0 && (
        <div
          data-testid="frontmatter-container"
          style={{
            marginBottom: '20px',
            border: '1px solid var(--color-border-default)',
            borderRadius: 'var(--border-radius-medium)',
            backgroundColor: 'var(--color-canvas-subtle)',
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              padding: '6px 14px',
              backgroundColor: 'var(--color-canvas-inset)',
              borderBottom: '1px solid var(--color-border-muted)',
              fontSize: '11px',
              fontWeight: 600,
              color: 'var(--color-fg-muted)',
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
            }}
          >
            Frontmatter
          </div>
          <table
            style={{
              width: '100%',
              borderCollapse: 'collapse',
              fontSize: '13px',
              margin: 0,
            }}
          >
            <tbody>
              {frontmatter.map((entry, idx) => (
                <tr
                  key={entry.key + idx}
                  style={{
                    borderBottom:
                      idx < frontmatter.length - 1 ? '1px solid var(--color-border-muted)' : 'none',
                  }}
                >
                  <td
                    style={{
                      padding: '8px 14px',
                      fontWeight: 700,
                      color: 'var(--color-fg-default)',
                      width: '140px',
                      verticalAlign: 'top',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {entry.key}
                  </td>
                  <td
                    style={{
                      padding: '8px 14px',
                      fontWeight: 400,
                      color: 'var(--color-fg-default)',
                      wordBreak: 'break-word',
                      whiteSpace: 'pre-wrap',
                    }}
                  >
                    {entry.value}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {renderedHtml && (
        <div dangerouslySetInnerHTML={{ __html: renderedHtml }} />
      )}
    </div>
  );
};

