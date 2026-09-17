import http from 'http';
import path from 'path';
import { scanAllInventory } from '../../core/scanner/index.js';
import {
  centralizeSkill,
  revertSkill,
  CentralizeResult,
  RevertResult,
} from '../../core/storage/symlink-manager.js';
import { defaultLogger } from '../../core/logger.js';

/**
 * Safely parses JSON request body with max size cap.
 */
async function parseJsonBody<T = any>(req: http.IncomingMessage): Promise<T> {
  return new Promise((resolve, reject) => {
    let raw = '';
    req.on('data', (chunk) => {
      raw += chunk;
      if (raw.length > 1e6) {
        reject(new Error('Payload too large'));
      }
    });
    req.on('end', () => {
      if (!raw.trim()) {
        resolve({} as T);
        return;
      }
      try {
        resolve(JSON.parse(raw));
      } catch {
        reject(new Error('Invalid JSON payload'));
      }
    });
    req.on('error', reject);
  });
}

/**
 * Handles incoming HTTP requests for skill storage centralization and revert operations.
 *
 * @param req Incoming HTTP message
 * @param res Server response
 * @param url Parsed URL instance
 * @returns True if the route was handled; false otherwise.
 */
export async function handleStorageRoutes(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  url: URL
): Promise<boolean> {
  if (req.method !== 'POST') {
    return false;
  }

  // POST /api/skills/batch/centralize
  if (url.pathname === '/api/skills/batch/centralize') {
    try {
      const body = await parseJsonBody<{ skillIds?: string[] }>(req);
      if (!body || !Array.isArray(body.skillIds)) {
        res.writeHead(400);
        res.end(JSON.stringify({ error: 'skillIds array is required' }));
        return true;
      }

      const inventory = await scanAllInventory();
      const results: Array<{ skillId: string; success: boolean; result?: CentralizeResult; error?: string }> = [];

      for (const skillId of body.skillIds) {
        const skill = inventory.skills.find((s) => s.id === skillId);
        if (!skill) {
          results.push({ skillId, success: false, error: `Skill not found: ${skillId}` });
          continue;
        }

        try {
          const folderPath = path.dirname(skill.sourcePath);
          const mutation = await centralizeSkill({
            skillId: skill.id,
            skillName: skill.name,
            sourcePath: folderPath,
          });
          results.push({ skillId, success: true, result: mutation });
        } catch (err: any) {
          results.push({ skillId, success: false, error: err.message });
        }
      }

      const succeeded = results.filter((r) => r.success).length;
      res.writeHead(200);
      res.end(JSON.stringify({
        total: results.length,
        succeeded,
        failed: results.length - succeeded,
        results,
      }));
      return true;
    } catch (err: any) {
      defaultLogger.error('Failed to execute batch centralization', { error: err.message });
      res.writeHead(400);
      res.end(JSON.stringify({ error: err.message || 'Batch centralization failed' }));
      return true;
    }
  }

  // POST /api/skills/batch/revert
  if (url.pathname === '/api/skills/batch/revert') {
    try {
      const body = await parseJsonBody<{ skillIds?: string[] }>(req);
      if (!body || !Array.isArray(body.skillIds)) {
        res.writeHead(400);
        res.end(JSON.stringify({ error: 'skillIds array is required' }));
        return true;
      }

      const inventory = await scanAllInventory();
      const results: Array<{ skillId: string; success: boolean; result?: RevertResult; error?: string }> = [];

      for (const skillId of body.skillIds) {
        const skill = inventory.skills.find((s) => s.id === skillId);
        if (!skill) {
          results.push({ skillId, success: false, error: `Skill not found: ${skillId}` });
          continue;
        }

        try {
          const folderPath = path.dirname(skill.sourcePath);
          const mutation = await revertSkill({
            skillId: skill.id,
            skillName: skill.name,
            sourcePath: folderPath,
          });
          results.push({ skillId, success: true, result: mutation });
        } catch (err: any) {
          results.push({ skillId, success: false, error: err.message });
        }
      }

      const succeeded = results.filter((r) => r.success).length;
      res.writeHead(200);
      res.end(JSON.stringify({
        total: results.length,
        succeeded,
        failed: results.length - succeeded,
        results,
      }));
      return true;
    } catch (err: any) {
      defaultLogger.error('Failed to execute batch reversion', { error: err.message });
      res.writeHead(400);
      res.end(JSON.stringify({ error: err.message || 'Batch reversion failed' }));
      return true;
    }
  }

  // POST /api/skills/:id/centralize
  if (url.pathname.startsWith('/api/skills/') && url.pathname.endsWith('/centralize')) {
    const rawId = url.pathname.slice('/api/skills/'.length, -('/centralize'.length));
    const skillId = decodeURIComponent(rawId);

    try {
      const inventory = await scanAllInventory();
      const skill = inventory.skills.find((s) => s.id === skillId);
      if (!skill) {
        res.writeHead(404);
        res.end(JSON.stringify({ error: 'Skill not found', id: skillId }));
        return true;
      }

      const folderPath = path.dirname(skill.sourcePath);
      const result = await centralizeSkill({
        skillId: skill.id,
        skillName: skill.name,
        sourcePath: folderPath,
      });

      res.writeHead(200);
      res.end(JSON.stringify({ success: true, data: result }));
      return true;
    } catch (err: any) {
      const isConflict = /already exists|already symlinked/i.test(err.message);
      res.writeHead(isConflict ? 409 : 500);
      res.end(JSON.stringify({ error: err.message }));
      return true;
    }
  }

  // POST /api/skills/:id/revert
  if (url.pathname.startsWith('/api/skills/') && url.pathname.endsWith('/revert')) {
    const rawId = url.pathname.slice('/api/skills/'.length, -('/revert'.length));
    const skillId = decodeURIComponent(rawId);

    try {
      const inventory = await scanAllInventory();
      const skill = inventory.skills.find((s) => s.id === skillId);
      if (!skill) {
        res.writeHead(404);
        res.end(JSON.stringify({ error: 'Skill not found', id: skillId }));
        return true;
      }

      const folderPath = path.dirname(skill.sourcePath);
      const result = await revertSkill({
        skillId: skill.id,
        skillName: skill.name,
        sourcePath: folderPath,
      });

      res.writeHead(200);
      res.end(JSON.stringify({ success: true, data: result }));
      return true;
    } catch (err: any) {
      const isBadRequest = /not a symbolic link/i.test(err.message);
      res.writeHead(isBadRequest ? 400 : 500);
      res.end(JSON.stringify({ error: err.message }));
      return true;
    }
  }

  return false;
}
