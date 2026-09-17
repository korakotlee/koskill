import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { ToggleOptions, ToggleResult } from './types.js';
import { defaultLogger } from '../logger.js';
import { appendJournalEntry } from '../storage/journal.js';
import { getKoskillSkillsDir, getKoskillWorkflowsDir, getKoskillJournalPath } from '../storage/store.js';
import { loadMcpRegistry, saveMcpRegistry } from '../storage/mcp-store.js';
import { pathExists, getEntityToggleStatus } from './status.js';

export { getEntityToggleStatus };

/**
 * Toggles an entity between active and inactive states using filesystem operations or registry flags.
 */
export async function toggleEntity(options: ToggleOptions): Promise<ToggleResult> {
  const { entityType, id, customHome } = options;
  const journalPath = getKoskillJournalPath(customHome);

  try {
    if (entityType === 'skills') {
      // Resolve the skill directory: targetPath may be the dir itself or point to SKILL.md inside it
      const rawTarget = options.targetPath || '';
      const isSkillFile = path.basename(rawTarget).replace(/\.disabled$/, '') === 'SKILL.md';
      const skillDir = isSkillFile ? path.dirname(rawTarget) : rawTarget;
      const baseDir = skillDir ? path.dirname(skillDir) : getKoskillSkillsDir(customHome);
      const baseName = skillDir ? path.basename(skillDir).replace(/\.disabled$/, '') : id;
      const activePath = path.join(baseDir, baseName);
      const disabledPath = `${activePath}.disabled`;

      const activeExists = await pathExists(activePath);
      const disabledExists = await pathExists(disabledPath);

      if (!activeExists && !disabledExists) {
        return {
          success: false,
          entityType,
          id,
          enabled: false,
          previousState: false,
          status: 'inactive',
          message: `Skill not found at ${activePath} or ${disabledPath}`,
        };
      }

      const currentState = activeExists;
      const targetState = options.enabled !== undefined ? options.enabled : !currentState;

      if (currentState === targetState) {
        return {
          success: true,
          entityType,
          id,
          enabled: targetState,
          previousState: currentState,
          path: targetState ? activePath : disabledPath,
          status: targetState ? 'original' : 'inactive',
          message: `Skill is already ${targetState ? 'enabled' : 'disabled'}`,
        };
      }

      if (targetState) {
        await fs.rename(disabledPath, activePath);
      } else {
        await fs.rename(activePath, disabledPath);
      }

      await appendJournalEntry(
        {
          action: 'TOGGLE',
          entityType: 'skills',
          entityId: id,
          skillId: id,
          skillName: baseName,
          originalPath: activePath,
          centralPath: targetState ? activePath : disabledPath,
          symlinkPath: '',
          status: 'COMPLETED',
          metadata: { enabled: targetState, previousState: currentState },
        },
        journalPath
      );

      defaultLogger.info(`Skill toggled: ${id} -> ${targetState ? 'enabled' : 'disabled'}`);

      return {
        success: true,
        entityType,
        id,
        enabled: targetState,
        previousState: currentState,
        path: targetState ? activePath : disabledPath,
        status: targetState ? 'original' : 'inactive',
      };
    }

    if (entityType === 'workflows') {
      let activePath = options.targetPath;
      if (!activePath) {
        const fileName = id.endsWith('.md') ? id : `${id}.md`;
        activePath = path.join(getKoskillWorkflowsDir(customHome), fileName);
      }
      activePath = activePath.replace(/\.disabled$/, '');
      const disabledPath = `${activePath}.disabled`;

      const activeExists = await pathExists(activePath);
      const disabledExists = await pathExists(disabledPath);

      if (!activeExists && !disabledExists) {
        return {
          success: false,
          entityType,
          id,
          enabled: false,
          previousState: false,
          status: 'inactive',
          message: `Workflow not found at ${activePath} or ${disabledPath}`,
        };
      }

      const currentState = activeExists;
      const targetState = options.enabled !== undefined ? options.enabled : !currentState;

      if (currentState === targetState) {
        return {
          success: true,
          entityType,
          id,
          enabled: targetState,
          previousState: currentState,
          path: targetState ? activePath : disabledPath,
          status: targetState ? 'original' : 'inactive',
          message: `Workflow is already ${targetState ? 'enabled' : 'disabled'}`,
        };
      }

      if (targetState) {
        await fs.rename(disabledPath, activePath);
      } else {
        await fs.rename(activePath, disabledPath);
      }

      await appendJournalEntry(
        {
          action: 'TOGGLE',
          entityType: 'workflows',
          entityId: id,
          skillId: id,
          skillName: id,
          originalPath: activePath,
          centralPath: targetState ? activePath : disabledPath,
          symlinkPath: '',
          status: 'COMPLETED',
          metadata: { enabled: targetState, previousState: currentState },
        },
        journalPath
      );

      defaultLogger.info(`Workflow toggled: ${id} -> ${targetState ? 'enabled' : 'disabled'}`);

      return {
        success: true,
        entityType,
        id,
        enabled: targetState,
        previousState: currentState,
        path: targetState ? activePath : disabledPath,
        status: targetState ? 'original' : 'inactive',
      };
    }

    if (entityType === 'mcp-servers') {
      const registry = await loadMcpRegistry(customHome);
      const server = registry[id];

      if (!server) {
        return {
          success: false,
          entityType,
          id,
          enabled: false,
          previousState: false,
          status: 'inactive',
          message: `MCP server not found in registry: ${id}`,
        };
      }

      const currentState = server.enabled !== false;
      const targetState = options.enabled !== undefined ? options.enabled : !currentState;

      server.enabled = targetState;
      server.status = targetState ? (server.status === 'inactive' ? 'centralized' : server.status) : 'inactive';

      await saveMcpRegistry(registry, customHome);

      await appendJournalEntry(
        {
          action: 'TOGGLE',
          entityType: 'mcp-servers',
          entityId: id,
          skillId: id,
          skillName: id,
          originalPath: '',
          centralPath: '',
          symlinkPath: '',
          status: 'COMPLETED',
          metadata: { enabled: targetState, previousState: currentState },
        },
        journalPath
      );

      defaultLogger.info(`MCP server toggled: ${id} -> ${targetState ? 'enabled' : 'disabled'}`);

      return {
        success: true,
        entityType,
        id,
        enabled: targetState,
        previousState: currentState,
        status: server.status || 'original',
      };
    }

    return {
      success: false,
      entityType,
      id,
      enabled: false,
      previousState: false,
      status: 'inactive',
      message: `Invalid entity type: ${entityType}`,
    };
  } catch (err: any) {
    defaultLogger.error(`Error toggling entity ${entityType}:${id}`, { error: err.message });
    return {
      success: false,
      entityType,
      id,
      enabled: false,
      previousState: false,
      status: 'inactive',
      message: err.message,
    };
  }
}
