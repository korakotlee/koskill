/**
 * @vitest-environment node
 */
import { describe, it, expect } from 'vitest';
import {
  detectExactSkillConflicts,
  detectMcpToolCollisions,
  detectTier1Conflicts,
} from './detector.js';
import { SkillManifest, McpServerManifest } from '../types.js';

describe('Tier 1 Exact and MCP Collision Detector', () => {
  const baseSkill: SkillManifest = {
    id: 'skill-gemini-1',
    name: 'Git Helper',
    description: 'Assists with git commits',
    sourcePath: '/path/gemini/git-helper',
    targetEcosystem: 'gemini',
    status: 'centralized',
    rawContent: '# Git Helper\n\nPrompt instructions.\n',
  };

  it('flags exact name collisions across ecosystems with severity ERROR', () => {
    const skills: SkillManifest[] = [
      baseSkill,
      {
        ...baseSkill,
        id: 'skill-claude-1',
        targetEcosystem: 'claude',
        sourcePath: '/path/claude/git-helper',
        rawContent: '# Git Helper\n\nDifferent instructions.\n',
      },
    ];

    const reports = detectExactSkillConflicts(skills);
    expect(reports.length).toBe(1);
    expect(reports[0].conflictType).toBe('DUPLICATE_NAME');
    expect(reports[0].severity).toBe('ERROR');
    expect(reports[0].items.length).toBe(2);
    expect(reports[0].diffSummary).toBeDefined();
    expect(reports[0].diffSummary?.unifiedDiff).toContain('-Prompt instructions.');
    expect(reports[0].diffSummary?.unifiedDiff).toContain('+Different instructions.');
  });

  it('identifies identical content hash collisions across ecosystems', () => {
    const skills: SkillManifest[] = [
      baseSkill,
      {
        ...baseSkill,
        id: 'skill-claude-copy',
        name: 'Git Helper Clone',
        targetEcosystem: 'claude',
        sourcePath: '/path/claude/git-helper-clone',
        rawContent: '# Git Helper\n\nPrompt instructions.\n',
      },
    ];

    const reports = detectExactSkillConflicts(skills);
    expect(reports.length).toBe(1);
    expect(reports[0].similarityScore).toBe(1.0);
    expect(reports[0].items.map((i) => i.id)).toContain('skill-gemini-1');
    expect(reports[0].items.map((i) => i.id)).toContain('skill-claude-copy');
  });

  it('detects colliding MCP tool names exposed by multiple servers', () => {
    const servers: McpServerManifest[] = [
      {
        id: 'server-github',
        name: 'GitHub MCP Server',
        transport: 'stdio',
        command: 'npx',
        args: ['-y', '@modelcontextprotocol/server-github'],
        declaredToolsCount: 2,
        tools: [
          { name: 'search_repositories', description: 'Search GitHub repos' },
          { name: 'create_issue', description: 'Create issue' },
        ],
      },
      {
        id: 'server-custom-git',
        name: 'Custom Git Server',
        transport: 'stdio',
        command: 'node',
        args: ['./git-server.js'],
        declaredToolsCount: 1,
        tools: [
          { name: 'create_issue', description: 'Create an issue in tracking system' },
        ],
      },
    ];

    const reports = detectMcpToolCollisions(servers);
    expect(reports.length).toBe(1);
    expect(reports[0].conflictType).toBe('MCP_TOOL_COLLISION');
    expect(reports[0].severity).toBe('ERROR');
    expect(reports[0].matchedSnippet).toBe('create_issue');
    expect(reports[0].items.length).toBe(2);
    expect(reports[0].items.map((i) => i.name)).toContain('GitHub MCP Server');
    expect(reports[0].items.map((i) => i.name)).toContain('Custom Git Server');
  });

  it('returns empty reports when no collisions are present', () => {
    const skills: SkillManifest[] = [
      baseSkill,
      {
        id: 'skill-gemini-2',
        name: 'Weather Reporter',
        description: 'Reports current weather',
        sourcePath: '/path/gemini/weather',
        targetEcosystem: 'gemini',
        status: 'centralized',
        rawContent: '# Weather\n\nShow weather.\n',
      },
    ];

    const combined = detectTier1Conflicts(skills, []);
    expect(combined.length).toBe(0);
  });
});
