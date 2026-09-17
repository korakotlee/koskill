import http from 'http';
import { toggleEntity } from '../../core/toggle/toggle-manager.js';
import { ToggleEntityType } from '../../core/toggle/types.js';
import { defaultLogger } from '../../core/logger.js';

/**
 * Parses JSON request payload safely.
 */
async function parseJsonBody(req: http.IncomingMessage): Promise<any> {
  return new Promise((resolve) => {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
    });
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch {
        resolve({});
      }
    });
  });
}

/**
 * Handles unified entity toggle endpoints: POST /api/:entityType/:id/toggle
 */
export async function handleToggleRoutes(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  url: URL
): Promise<boolean> {
  // Check for /api/:entityType/:id/toggle pattern
  const toggleMatch = url.pathname.match(/^\/api\/([^/]+)\/([^/]+)\/toggle$/);
  if (!toggleMatch) {
    return false;
  }

  if (req.method !== 'POST') {
    res.writeHead(405);
    res.end(JSON.stringify({ error: 'Method Not Allowed' }));
    return true;
  }

  const [, rawEntityType, rawId] = toggleMatch;
  const entityType = decodeURIComponent(rawEntityType);
  const id = decodeURIComponent(rawId);

  const supportedTypes: ToggleEntityType[] = ['skills', 'workflows', 'mcp-servers'];
  if (!supportedTypes.includes(entityType as ToggleEntityType)) {
    res.writeHead(400);
    res.end(
      JSON.stringify({
        error: `Unsupported entity type: ${entityType}. Must be one of: skills, workflows, mcp-servers.`,
      })
    );
    return true;
  }

  try {
    const body = await parseJsonBody(req);
    const result = await toggleEntity({
      entityType: entityType as ToggleEntityType,
      id,
      enabled: body?.enabled !== undefined ? Boolean(body.enabled) : undefined,
      targetPath: body?.targetPath,
      customHome: process.env.KOSKILL_HOME,
    });

    if (!result.success) {
      res.writeHead(404);
      res.end(JSON.stringify({ error: result.message || 'Entity toggle failed', result }));
      return true;
    }

    res.writeHead(200);
    res.end(JSON.stringify(result));
    return true;
  } catch (err: any) {
    defaultLogger.error('Toggle route error', { entityType, id, error: err.message });
    res.writeHead(500);
    res.end(JSON.stringify({ error: err.message || 'Internal server error' }));
    return true;
  }
}
