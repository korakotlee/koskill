import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { RouterToggleManager } from '../../../src/core/router/toggle-router.js';

describe('RouterToggleManager', () => {
  let tmpDir: string;
  let skillsDir: string;
  let geminiFile: string;
  let stateFile: string;
  let toggleManager: RouterToggleManager;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'koskill-toggle-test-'));
    skillsDir = path.join(tmpDir, 'skills');
    fs.mkdirSync(skillsDir, { recursive: true });

    // Create a mock active skill symlink/dir
    const skillA = path.join(skillsDir, 'accessibility');
    fs.mkdirSync(skillA, { recursive: true });
    fs.writeFileSync(path.join(skillA, 'SKILL.md'), '# A11y');

    geminiFile = path.join(tmpDir, 'GEMINI.md');
    fs.writeFileSync(geminiFile, '# User Instructions\nAlways be concise.\n');

    stateFile = path.join(tmpDir, 'router_state.json');

    toggleManager = new RouterToggleManager({
      skillsDir,
      promptFiles: [geminiFile],
      stateFilePath: stateFile,
    });
  });

  afterEach(() => {
    if (fs.existsSync(tmpDir)) {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it('generates dry-run preview without altering filesystem', async () => {
    const preview = await toggleManager.previewEnable();

    expect(preview.operations.length).toBeGreaterThan(0);
    const renameOp = preview.operations.find((op) => op.type === 'RENAME');
    expect(renameOp).toBeDefined();
    expect(renameOp?.target).toContain('accessibility.disabled');

    const ruleOp = preview.operations.find((op) => op.type === 'INJECT_RULE');
    expect(ruleOp).toBeDefined();
    expect(ruleOp?.target).toContain('GEMINI.md');

    // Verify filesystem was untouched
    expect(fs.existsSync(path.join(skillsDir, 'accessibility'))).toBe(true);
    expect(fs.existsSync(path.join(skillsDir, 'accessibility.disabled'))).toBe(false);
    expect(fs.readFileSync(geminiFile, 'utf-8')).not.toContain('KOSKILL_ROUTER_START');
  });

  it('enables auto-router by renaming symlinks and injecting prompt instructions', async () => {
    const result = await toggleManager.enable();
    expect(result.success).toBe(true);

    // Skill should be renamed to .disabled
    expect(fs.existsSync(path.join(skillsDir, 'accessibility'))).toBe(false);
    expect(fs.existsSync(path.join(skillsDir, 'accessibility.disabled'))).toBe(true);

    // Prompt file should contain the fenced instructions
    const promptContent = fs.readFileSync(geminiFile, 'utf-8');
    expect(promptContent).toContain('<!-- KOSKILL_ROUTER_START -->');
    expect(promptContent).toContain('<!-- KOSKILL_ROUTER_END -->');
    expect(promptContent).toContain('discover_capabilities');

    // State should be marked enabled
    expect(toggleManager.isEnabled()).toBe(true);
  });

  it('disables auto-router by restoring symlinks and removing injected rules', async () => {
    await toggleManager.enable();
    expect(toggleManager.isEnabled()).toBe(true);

    const disableResult = await toggleManager.disable();
    expect(disableResult.success).toBe(true);

    // Skill should be restored
    expect(fs.existsSync(path.join(skillsDir, 'accessibility'))).toBe(true);
    expect(fs.existsSync(path.join(skillsDir, 'accessibility.disabled'))).toBe(false);

    // Prompt file should have rule removed
    const promptContent = fs.readFileSync(geminiFile, 'utf-8');
    expect(promptContent).not.toContain('KOSKILL_ROUTER_START');
    expect(promptContent).toContain('# User Instructions');

    // State should be marked disabled
    expect(toggleManager.isEnabled()).toBe(false);
  });

  it('automatically registers koskill-router in mcp_config.json and manages centralized vs normal MCPs', async () => {
    const mcpConfigFile = path.join(tmpDir, 'mcp_config.json');
    const initialMcpConfig = {
      mcpServers: {
        'chrome-devtools-mcp': {
          command: 'npx',
          args: ['-y', 'chrome-devtools-mcp@latest'],
        },
        'my-normal-server': {
          command: 'node',
          args: ['./custom.js'],
        },
      },
    };
    fs.writeFileSync(mcpConfigFile, JSON.stringify(initialMcpConfig, null, 2), 'utf-8');

    const managerWithMcp = new RouterToggleManager({
      skillsDir,
      promptFiles: [geminiFile],
      stateFilePath: stateFile,
      mcpConfigFiles: [mcpConfigFile],
      centralizedMcpNames: ['chrome-devtools-mcp'],
    });

    const preview = await managerWithMcp.previewEnable();
    const registerOp = preview.operations.find((op) => op.type === 'REGISTER_MCP');
    expect(registerOp).toBeDefined();

    // Enable router
    await managerWithMcp.enable();

    const enabledConfig = JSON.parse(fs.readFileSync(mcpConfigFile, 'utf-8'));
    // 1. koskill-router must be registered
    expect(enabledConfig.mcpServers['koskill-router']).toBeDefined();
    expect(enabledConfig.mcpServers['koskill-router'].command).toBe('koskill');
    expect(enabledConfig.mcpServers['koskill-router'].args).toEqual(['router', 'run']);

    // 2. Centralized server must be disabled and delegated downstream
    expect(enabledConfig.mcpServers['chrome-devtools-mcp'].disabled).toBe(true);
    expect(enabledConfig.mcpServers['chrome-devtools-mcp']._koskillDownstream).toBe(true);

    // 3. Normal server must remain active and unmodified
    expect(enabledConfig.mcpServers['my-normal-server'].disabled).toBeUndefined();

    // Disable router
    await managerWithMcp.disable();

    const disabledConfig = JSON.parse(fs.readFileSync(mcpConfigFile, 'utf-8'));
    // koskill-router should be removed
    expect(disabledConfig.mcpServers['koskill-router']).toBeUndefined();
    // Centralized server should be re-enabled
    expect(disabledConfig.mcpServers['chrome-devtools-mcp'].disabled).toBe(false);
    expect(disabledConfig.mcpServers['chrome-devtools-mcp']._koskillDownstream).toBeUndefined();
    // Normal server still untouched
    expect(disabledConfig.mcpServers['my-normal-server'].disabled).toBeUndefined();
  });
});
