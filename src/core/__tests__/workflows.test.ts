import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import {
  WorkflowManifest,
  isValidWorkflowManifest
} from '../types.js';
import {
  scanGeminiWorkflows,
  scanClaudeCommands,
  scanWorkflows
} from '../scanner/workflows.js';

describe('Workflow Types & Manifest Validation', () => {
  it('validates a well-formed WorkflowManifest', () => {
    const workflow: WorkflowManifest = {
      id: 'gemini:commit',
      name: 'commit',
      command: '/commit',
      description: 'Create a structured git commit',
      sourcePath: '/path/to/global_workflows/commit.md',
      targetEcosystem: 'gemini',
      scope: 'global',
      metadata: {
        argumentHint: '[scope]',
        allowedTools: ['run_command', 'view_file'],
        model: 'gemini-2.5-pro'
      },
      rawContent: '# Commit Workflow\nCommit changes with context.'
    };

    expect(isValidWorkflowManifest(workflow)).toBe(true);
    expect(workflow.command).toBe('/commit');
    expect(workflow.scope).toBe('global');
    expect(workflow.metadata?.argumentHint).toBe('[scope]');
  });

  it('rejects invalid WorkflowManifest objects', () => {
    expect(isValidWorkflowManifest(null)).toBe(false);
    expect(isValidWorkflowManifest({})).toBe(false);
    expect(isValidWorkflowManifest({ id: '', name: 'test' })).toBe(false);
    expect(isValidWorkflowManifest({
      id: 'gemini:test',
      name: 'test',
      command: 'test', // missing leading slash
      sourcePath: '/path',
      targetEcosystem: 'invalid',
      scope: 'global'
    })).toBe(false);
    expect(isValidWorkflowManifest({
      id: 'gemini:test',
      name: 'test',
      command: '/test',
      sourcePath: '/path',
      targetEcosystem: 'gemini',
      scope: 'invalid'
    })).toBe(false);
  });
});

describe('Workflow Discovery Scanner', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'koskill-workflows-test-'));
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  describe('scanGeminiWorkflows', () => {
    it('scans Gemini workflow markdown files with frontmatter', async () => {
      const workflowsDir = path.join(tempDir, 'global_workflows');
      await fs.mkdir(workflowsDir, { recursive: true });

      const content = `---
description: Automated multi-pass architectural audit
argument-hint: "[target-path]"
tools:
  - run_command
  - view_file
---
# Architecture Audit
Perform comprehensive architecture verification.`;

      await fs.writeFile(path.join(workflowsDir, 'audit.md'), content, 'utf-8');

      const workflows = await scanGeminiWorkflows(workflowsDir, 'global');
      expect(workflows).toHaveLength(1);
      expect(workflows[0]).toMatchObject({
        id: 'gemini:audit',
        name: 'audit',
        command: '/audit',
        description: 'Automated multi-pass architectural audit',
        targetEcosystem: 'gemini',
        scope: 'global',
        metadata: {
          argumentHint: '[target-path]',
          allowedTools: ['run_command', 'view_file']
        }
      });
      expect(workflows[0].rawContent).toContain('Architecture Audit');
    });

    it('falls back to filename and first markdown heading or text when frontmatter is missing', async () => {
      const workflowsDir = path.join(tempDir, 'agent_workflows');
      await fs.mkdir(workflowsDir, { recursive: true });

      const content = `# Code Review Workflow\nThorough review of current changes.`;
      await fs.writeFile(path.join(workflowsDir, 'review.md'), content, 'utf-8');

      const workflows = await scanGeminiWorkflows(workflowsDir, 'workspace');
      expect(workflows).toHaveLength(1);
      expect(workflows[0].name).toBe('review');
      expect(workflows[0].command).toBe('/review');
      expect(workflows[0].description).toBe('Thorough review of current changes.');
      expect(workflows[0].scope).toBe('workspace');
    });

    it('returns empty array when workflow directory does not exist', async () => {
      const nonExistent = path.join(tempDir, 'does-not-exist');
      const workflows = await scanGeminiWorkflows(nonExistent, 'global');
      expect(workflows).toEqual([]);
    });
  });

  describe('scanClaudeCommands', () => {
    it('scans Claude custom commands in commands directory', async () => {
      const commandsDir = path.join(tempDir, '.claude', 'commands');
      await fs.mkdir(commandsDir, { recursive: true });

      const content = `---
description: Deploy changes to staging
---
Deploy the current branch.`;

      await fs.writeFile(path.join(commandsDir, 'deploy.md'), content, 'utf-8');

      const workflows = await scanClaudeCommands(commandsDir, 'workspace');
      expect(workflows).toHaveLength(1);
      expect(workflows[0]).toMatchObject({
        id: 'claude:deploy',
        name: 'deploy',
        command: '/deploy',
        description: 'Deploy changes to staging',
        targetEcosystem: 'claude',
        scope: 'workspace'
      });
    });

    it('returns empty array when commands directory is missing', async () => {
      const missing = path.join(tempDir, 'missing-commands');
      const workflows = await scanClaudeCommands(missing, 'global');
      expect(workflows).toEqual([]);
    });
  });

  describe('scanWorkflows (unified coordinator)', () => {
    it('aggregates workflows across multiple directories and de-duplicates by id', async () => {
      const geminiGlobal = path.join(tempDir, 'gemini-global');
      const claudeWorkspace = path.join(tempDir, 'claude-ws');
      await fs.mkdir(geminiGlobal, { recursive: true });
      await fs.mkdir(claudeWorkspace, { recursive: true });

      await fs.writeFile(
        path.join(geminiGlobal, 'plan.md'),
        '---\ndescription: Planning workflow\n---\nPlan steps.',
        'utf-8'
      );
      await fs.writeFile(
        path.join(claudeWorkspace, 'lint.md'),
        '---\ndescription: Lint codebase\n---\nRun linter.',
        'utf-8'
      );

      const workflows = await scanWorkflows({
        geminiGlobalDirs: [geminiGlobal],
        geminiWorkspaceDirs: [],
        claudeGlobalDirs: [],
        claudeWorkspaceDirs: [claudeWorkspace]
      });

      expect(workflows).toHaveLength(2);
      expect(workflows.find((w) => w.command === '/plan')).toBeDefined();
      expect(workflows.find((w) => w.command === '/lint')).toBeDefined();
    });
  });
});
