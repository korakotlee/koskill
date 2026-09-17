import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { ToggleOptions, ToggleStatusInfo } from './types.js';
import { getKoskillSkillsDir, getKoskillWorkflowsDir } from '../storage/store.js';
import { loadMcpRegistry } from '../storage/mcp-store.js';

/**
 * Checks whether a given filesystem path exists.
 */
export async function pathExists(p: string): Promise<boolean> {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

/**
 * Inspects the current toggle status of an entity without mutating state.
 */
export async function getEntityToggleStatus(options: ToggleOptions): Promise<ToggleStatusInfo> {
  const { entityType, id, customHome } = options;

  if (entityType === 'skills') {
    const baseDir = options.targetPath ? path.dirname(options.targetPath) : getKoskillSkillsDir(customHome);
    const baseName = options.targetPath ? path.basename(options.targetPath).replace(/\.disabled$/, '') : id;
    const activePath = path.join(baseDir, baseName);
    const disabledPath = `${activePath}.disabled`;

    const activeExists = await pathExists(activePath);
    const disabledExists = await pathExists(disabledPath);

    if (!activeExists && !disabledExists) {
      return { id, entityType, enabled: false, status: 'inactive', path: activePath };
    }

    const isEnabled = activeExists;
    return {
      id,
      entityType,
      enabled: isEnabled,
      path: isEnabled ? activePath : disabledPath,
      status: isEnabled ? 'original' : 'inactive',
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
      return { id, entityType, enabled: false, status: 'inactive', path: activePath };
    }

    const isEnabled = activeExists;
    return {
      id,
      entityType,
      enabled: isEnabled,
      path: isEnabled ? activePath : disabledPath,
      status: isEnabled ? 'original' : 'inactive',
    };
  }

  if (entityType === 'mcp-servers') {
    const registry = await loadMcpRegistry(customHome);
    const server = registry[id];
    if (!server) {
      return { id, entityType, enabled: false, status: 'inactive' };
    }
    const isEnabled = server.enabled !== false;
    return {
      id,
      entityType,
      enabled: isEnabled,
      status: isEnabled ? (server.status || 'centralized') : 'inactive',
    };
  }

  throw new Error(`Unsupported entity type: ${entityType}`);
}
