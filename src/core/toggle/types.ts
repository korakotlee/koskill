import { SkillStatus } from '../types.js';

/**
 * Supported entity categories that can be activated or deactivated.
 */
export type ToggleEntityType = 'skills' | 'workflows' | 'mcp-servers';

/**
 * Input arguments for querying or modifying entity active state.
 */
export interface ToggleOptions {
  entityType: ToggleEntityType;
  id: string;
  targetPath?: string;
  enabled?: boolean;
  customHome?: string;
}

/**
 * Result structure returned after an entity activation toggle operation.
 */
export interface ToggleResult {
  success: boolean;
  entityType: ToggleEntityType;
  id: string;
  enabled: boolean;
  previousState: boolean;
  path?: string;
  status: SkillStatus;
  message?: string;
}

/**
 * Lightweight entity inspection status.
 */
export interface ToggleStatusInfo {
  id: string;
  entityType: ToggleEntityType;
  enabled: boolean;
  path?: string;
  status: SkillStatus;
}
