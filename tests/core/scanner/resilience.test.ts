import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import { scanGeminiSkills, scanGeminiMcp } from '../../../src/core/scanner/gemini.js';
import { scanClaudeMcp, scanClaudeSkills } from '../../../src/core/scanner/claude.js';
import { scanAllInventory } from '../../../src/core/scanner/index.js';

describe('Scanner Resilience', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'koskill-resilience-test-'));
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  it('handles corrupted mcp_config.json gracefully', async () => {
    const corruptMcp = path.join(tempDir, 'mcp_config.json');
    await fs.writeFile(corruptMcp, '{ "mcpServers": { broken json ...', 'utf-8');

    const result = await scanGeminiMcp(corruptMcp);
    expect(result).toEqual([]);
  });

  it('handles corrupted Claude settings.json gracefully', async () => {
    const corruptSettings = path.join(tempDir, 'settings.json');
    await fs.writeFile(corruptSettings, '<<<corrupted content>>>', 'utf-8');

    const skills = await scanClaudeSkills(corruptSettings);
    const mcp = await scanClaudeMcp(corruptSettings);
    expect(skills).toEqual([]);
    expect(mcp).toEqual([]);
  });

  it('skips unreadable or permission-denied directories in scanAllInventory without crashing', async () => {
    const inventory = await scanAllInventory({
      geminiSkillsDirs: [path.join(tempDir, 'non-existent-skills')],
      geminiMcpFiles: [path.join(tempDir, 'non-existent-mcp.json')],
      claudeSettingsFiles: [path.join(tempDir, 'non-existent-settings.json')],
      claudeMcpFiles: [path.join(tempDir, 'non-existent-claude-mcp.json')]
    });

    expect(inventory.skills).toEqual([]);
    expect(inventory.mcpServers).toEqual([]);
    expect(inventory.totalSkills).toBe(0);
    expect(inventory.totalMcpServers).toBe(0);
  });
});
