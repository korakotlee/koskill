import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as os from 'node:os';
import {
  centralizeWorkflow,
  revertWorkflow,
  inspectWorkflowStorage,
} from '../../../src/core/storage/workflow-symlink-manager.js';
import { getWorkflowCentralPath } from '../../../src/core/storage/store.js';

describe('Workflow Symlink Manager', () => {
  let tempDir: string;
  let customHome: string;
  let workflowSourceDir: string;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'koskill-wf-test-'));
    customHome = path.join(tempDir, 'home');
    workflowSourceDir = path.join(tempDir, 'gemini_workflows');
    await fs.mkdir(workflowSourceDir, { recursive: true });
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  it('centralizes a standalone workflow markdown file into central store and creates symlink', async () => {
    const sourcePath = path.join(workflowSourceDir, 'commit.md');
    const content = '# Git Commit Workflow\nRun tests and commit.';
    await fs.writeFile(sourcePath, content, 'utf-8');

    const result = await centralizeWorkflow({
      workflowId: 'gemini:commit',
      workflowName: 'commit',
      sourcePath,
      customHome,
    });

    expect(result.success).toBe(true);
    expect(result.status).toBe('centralized');

    // Source is now a symlink
    const lstat = await fs.lstat(sourcePath);
    expect(lstat.isSymbolicLink()).toBe(true);

    // Central file exists with identical content
    const centralPath = getWorkflowCentralPath('commit', customHome);
    const centralContent = await fs.readFile(centralPath, 'utf-8');
    expect(centralContent).toBe(content);

    // Storage inspection confirms centralized
    const inspection = await inspectWorkflowStorage(sourcePath, customHome);
    expect(inspection.status).toBe('centralized');
    expect(inspection.targetPath).toBe(centralPath);
  });

  it('reverts a centralized workflow back to a regular physical markdown file', async () => {
    const sourcePath = path.join(workflowSourceDir, 'review.md');
    const content = '# Code Review Workflow\nAnalyze architecture.';
    await fs.writeFile(sourcePath, content, 'utf-8');

    await centralizeWorkflow({
      workflowId: 'gemini:review',
      workflowName: 'review',
      sourcePath,
      customHome,
    });

    // Revert
    const revertResult = await revertWorkflow({
      workflowId: 'gemini:review',
      workflowName: 'review',
      sourcePath,
      customHome,
    });

    expect(revertResult.success).toBe(true);
    expect(revertResult.status).toBe('original');

    // Source is now a regular file, not a symlink
    const lstat = await fs.lstat(sourcePath);
    expect(lstat.isSymbolicLink()).toBe(false);
    expect(lstat.isFile()).toBe(true);

    const revertedContent = await fs.readFile(sourcePath, 'utf-8');
    expect(revertedContent).toBe(content);
  });
});
