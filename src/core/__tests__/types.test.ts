import { describe, it, expect } from 'vitest';
import {
  SkillManifest,
  McpServerManifest,
  ConfigTarget,
  OperationResult,
  isValidSkillManifest,
  isValidMcpServerManifest
} from '../types.js';

describe('Domain Models & Type Contracts', () => {
  it('validates a well-formed SkillManifest', () => {
    const skill: SkillManifest = {
      id: 'skill-123',
      name: 'git-sync',
      description: 'Sync git branches across agents',
      sourcePath: '/path/to/skill',
      targetEcosystem: 'gemini',
      status: 'symlinked',
      metadata: { author: 'dev', version: '1.0.0' }
    };

    expect(isValidSkillManifest(skill)).toBe(true);
    expect(skill.targetEcosystem).toBe('gemini');
    expect(skill.status).toBe('symlinked');
  });

  it('rejects invalid skill manifest definitions', () => {
    const invalidSkill = {
      id: '',
      name: ''
    };
    expect(isValidSkillManifest(invalidSkill)).toBe(false);
  });

  it('validates a well-formed McpServerManifest', () => {
    const mcp: McpServerManifest = {
      id: 'mcp-456',
      name: 'github-tools',
      transport: 'stdio',
      command: 'npx',
      args: ['-y', '@modelcontextprotocol/server-github'],
      env: { GITHUB_TOKEN: 'test-token' },
      declaredToolsCount: 14
    };

    expect(isValidMcpServerManifest(mcp)).toBe(true);
    expect(mcp.transport).toBe('stdio');
    expect(mcp.declaredToolsCount).toBe(14);
  });

  it('rejects invalid McpServerManifest definitions', () => {
    const invalidMcp = {
      id: '',
      transport: 'invalid-transport'
    };
    expect(isValidMcpServerManifest(invalidMcp)).toBe(false);
  });

  it('correctly constructs an OperationResult', () => {
    const successResult: OperationResult<{ count: number }> = {
      success: true,
      data: { count: 42 }
    };
    expect(successResult.success).toBe(true);
    expect(successResult.data?.count).toBe(42);

    const errorResult: OperationResult<null> = {
      success: false,
      error: 'Permission denied'
    };
    expect(errorResult.success).toBe(false);
    expect(errorResult.error).toBe('Permission denied');
  });

  it('supports ConfigTarget values', () => {
    const targets: ConfigTarget[] = ['gemini', 'claude', 'codex'];
    expect(targets).toHaveLength(3);
  });
});
