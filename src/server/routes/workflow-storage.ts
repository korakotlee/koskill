import http from 'http';
import { scanWorkflows } from '../../core/scanner/workflows.js';
import {
  centralizeWorkflow,
  revertWorkflow,
  CentralizeWorkflowResult,
} from '../../core/storage/workflow-symlink-manager.js';
import { defaultLogger } from '../../core/logger.js';

async function parseJsonBody<T = any>(req: http.IncomingMessage): Promise<T> {
  return new Promise((resolve, reject) => {
    let raw = '';
    req.on('data', (chunk) => {
      raw += chunk;
      if (raw.length > 1e6) reject(new Error('Payload too large'));
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
 * Handles incoming HTTP requests for workflow centralization and revert operations.
 */
export async function handleWorkflowStorageRoutes(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  url: URL
): Promise<boolean> {
  if (req.method !== 'POST') {
    return false;
  }

  // POST /api/workflows/batch/centralize
  if (url.pathname === '/api/workflows/batch/centralize') {
    try {
      const body = await parseJsonBody<{ workflowIds?: string[] }>(req);
      if (!body || !Array.isArray(body.workflowIds)) {
        res.writeHead(400);
        res.end(JSON.stringify({ error: 'workflowIds array is required' }));
        return true;
      }

      const workflows = await scanWorkflows();
      const results: Array<{
        workflowId: string;
        success: boolean;
        result?: CentralizeWorkflowResult;
        error?: string;
      }> = [];

      for (const workflowId of body.workflowIds) {
        const wf = workflows.find((w) => w.id === workflowId);
        if (!wf) {
          results.push({ workflowId, success: false, error: 'Workflow not found in inventory' });
          continue;
        }

        try {
          const mutation = await centralizeWorkflow({
            workflowId: wf.id,
            workflowName: wf.name,
            sourcePath: wf.sourcePath,
          });
          results.push({ workflowId, success: true, result: mutation });
        } catch (err: any) {
          results.push({ workflowId, success: false, error: err.message });
        }
      }

      res.writeHead(200);
      res.end(JSON.stringify({ results, total: results.length }));
      return true;
    } catch (err: any) {
      res.writeHead(500);
      res.end(JSON.stringify({ error: err.message }));
      return true;
    }
  }

  // POST /api/workflows/:id/centralize
  if (url.pathname.startsWith('/api/workflows/') && url.pathname.endsWith('/centralize')) {
    const rawId = url.pathname.slice('/api/workflows/'.length, -('/centralize'.length));
    const workflowId = decodeURIComponent(rawId);

    try {
      const workflows = await scanWorkflows();
      const wf = workflows.find((w) => w.id === workflowId);
      if (!wf) {
        res.writeHead(404);
        res.end(JSON.stringify({ error: `Workflow with id '${workflowId}' not found` }));
        return true;
      }

      const mutation = await centralizeWorkflow({
        workflowId: wf.id,
        workflowName: wf.name,
        sourcePath: wf.sourcePath,
      });

      res.writeHead(200);
      res.end(JSON.stringify({ success: true, workflow: mutation }));
      return true;
    } catch (err: any) {
      defaultLogger.error('Failed to centralize workflow via API', { workflowId, error: err.message });
      res.writeHead(500);
      res.end(JSON.stringify({ error: err.message }));
      return true;
    }
  }

  // POST /api/workflows/:id/revert
  if (url.pathname.startsWith('/api/workflows/') && url.pathname.endsWith('/revert')) {
    const rawId = url.pathname.slice('/api/workflows/'.length, -('/revert'.length));
    const workflowId = decodeURIComponent(rawId);

    try {
      const workflows = await scanWorkflows();
      const wf = workflows.find((w) => w.id === workflowId);
      if (!wf) {
        res.writeHead(404);
        res.end(JSON.stringify({ error: `Workflow with id '${workflowId}' not found` }));
        return true;
      }

      const mutation = await revertWorkflow({
        workflowId: wf.id,
        workflowName: wf.name,
        sourcePath: wf.sourcePath,
      });

      res.writeHead(200);
      res.end(JSON.stringify({ success: true, workflow: mutation }));
      return true;
    } catch (err: any) {
      defaultLogger.error('Failed to revert workflow via API', { workflowId, error: err.message });
      res.writeHead(500);
      res.end(JSON.stringify({ error: err.message }));
      return true;
    }
  }

  return false;
}
