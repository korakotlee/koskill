import http from 'http';
import { scanAllInventory } from '../../core/scanner/index.js';
import { defaultLogger } from '../../core/logger.js';

/**
 * Handles incoming HTTP requests for discovery endpoints.
 *
 * @param req Incoming HTTP message
 * @param res Server response
 * @param url Parsed URL instance
 * @returns True if the route was handled; false otherwise.
 */
export async function handleDiscoveryRoutes(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  url: URL
): Promise<boolean> {
  if (req.method !== 'GET') {
    return false;
  }

  // GET /api/skills
  if (url.pathname === '/api/skills') {
    try {
      const inventory = await scanAllInventory();
      res.writeHead(200);
      res.end(JSON.stringify({
        skills: inventory.skills,
        total: inventory.totalSkills
      }));
      return true;
    } catch (err: any) {
      defaultLogger.error('Failed to handle /api/skills', { error: err.message });
      res.writeHead(500);
      res.end(JSON.stringify({ error: 'Internal Server Error', message: err.message }));
      return true;
    }
  }

  // GET /api/skills/:id
  if (url.pathname.startsWith('/api/skills/')) {
    const rawId = url.pathname.slice('/api/skills/'.length);
    const skillId = decodeURIComponent(rawId);

    if (!skillId) {
      res.writeHead(400);
      res.end(JSON.stringify({ error: 'Missing skill identifier' }));
      return true;
    }

    try {
      const inventory = await scanAllInventory();
      const skill = inventory.skills.find((s) => s.id === skillId);

      if (!skill) {
        res.writeHead(404);
        res.end(JSON.stringify({ error: 'Skill not found', id: skillId }));
        return true;
      }

      res.writeHead(200);
      res.end(JSON.stringify(skill));
      return true;
    } catch (err: any) {
      defaultLogger.error(`Failed to handle /api/skills/${skillId}`, { error: err.message });
      res.writeHead(500);
      res.end(JSON.stringify({ error: 'Internal Server Error', message: err.message }));
      return true;
    }
  }

  // GET /api/mcp
  if (url.pathname === '/api/mcp') {
    try {
      const inventory = await scanAllInventory();
      res.writeHead(200);
      res.end(JSON.stringify({
        servers: inventory.mcpServers,
        total: inventory.totalMcpServers
      }));
      return true;
    } catch (err: any) {
      defaultLogger.error('Failed to handle /api/mcp', { error: err.message });
      res.writeHead(500);
      res.end(JSON.stringify({ error: 'Internal Server Error', message: err.message }));
      return true;
    }
  }

  // GET /api/workflows
  if (url.pathname === '/api/workflows') {
    try {
      const inventory = await scanAllInventory();
      res.writeHead(200);
      res.end(JSON.stringify({
        workflows: inventory.workflows,
        total: inventory.totalWorkflows
      }));
      return true;
    } catch (err: any) {
      defaultLogger.error('Failed to handle /api/workflows', { error: err.message });
      res.writeHead(500);
      res.end(JSON.stringify({ error: 'Internal Server Error', message: err.message }));
      return true;
    }
  }

  // GET /api/workflows/:id
  if (url.pathname.startsWith('/api/workflows/')) {
    const rawId = url.pathname.slice('/api/workflows/'.length);
    const workflowId = decodeURIComponent(rawId);

    if (!workflowId) {
      res.writeHead(400);
      res.end(JSON.stringify({ error: 'Missing workflow identifier' }));
      return true;
    }

    try {
      const inventory = await scanAllInventory();
      const workflow = inventory.workflows.find((w) => w.id === workflowId);

      if (!workflow) {
        res.writeHead(404);
        res.end(JSON.stringify({ error: 'Workflow not found', id: workflowId }));
        return true;
      }

      res.writeHead(200);
      res.end(JSON.stringify(workflow));
      return true;
    } catch (err: any) {
      defaultLogger.error(`Failed to handle /api/workflows/${workflowId}`, { error: err.message });
      res.writeHead(500);
      res.end(JSON.stringify({ error: 'Internal Server Error', message: err.message }));
      return true;
    }
  }

  return false;
}

