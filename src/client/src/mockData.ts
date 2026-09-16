import { SkillManifest, McpServerManifest, WorkflowManifest } from '../../core/types.js';

export const initialSkills: SkillManifest[] = [
  {
    id: 'gemini:gemini-coder',
    name: 'gemini-coder',
    description: 'Agent coding workflow and automation rules',
    sourcePath: '~/.gemini/config/skills/gemini-coder/SKILL.md',
    targetEcosystem: 'gemini',
    status: 'symlinked',
    rawContent: '# Gemini Coder\n\nAgent coding workflow and automation rules.'
  },
  {
    id: 'claude:claude-architect',
    name: 'claude-architect',
    description: 'Architectural analysis and system design skill',
    sourcePath: '~/.claude/settings.json',
    targetEcosystem: 'claude',
    status: 'original',
    rawContent: '# Claude Architect\n\nArchitectural analysis and system design skill.'
  },
  {
    id: 'codex:codex-refactor',
    name: 'codex-refactor',
    description: 'Clean code refactoring and test-driven development',
    sourcePath: '~/.config/codex/skills/codex-refactor',
    targetEcosystem: 'codex',
    status: 'symlinked',
    rawContent: '# Codex Refactor\n\nClean code refactoring and test-driven development.'
  }
];

export const initialMcp: McpServerManifest[] = [
  {
    id: 'gemini:github-tools',
    name: 'github-tools',
    transport: 'stdio',
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-github'],
    declaredToolsCount: 14
  },
  {
    id: 'claude:postgres-mcp',
    name: 'postgres-mcp',
    transport: 'stdio',
    command: 'docker',
    args: ['run', '-i', 'mcp/postgres'],
    declaredToolsCount: 8
  }
];

export const initialWorkflows: WorkflowManifest[] = [
  {
    id: 'gemini:commit',
    name: 'commit',
    command: '/commit',
    description: 'Create a structured git commit with context',
    sourcePath: '~/.gemini/config/global_workflows/commit.md',
    targetEcosystem: 'gemini',
    scope: 'global',
    metadata: {
      argumentHint: '[scope]',
      allowedTools: ['run_command', 'view_file']
    },
    rawContent: '# Commit Workflow\nAutomate structured conventional commit generation.'
  },
  {
    id: 'claude:review',
    name: 'review',
    command: '/review',
    description: 'Perform senior engineer code review on diff',
    sourcePath: '~/.claude/commands/review.md',
    targetEcosystem: 'claude',
    scope: 'workspace',
    metadata: {
      argumentHint: '[target-branch]'
    },
    rawContent: '# Review Command\nReview pending diffs against engineering standards.'
  }
];
