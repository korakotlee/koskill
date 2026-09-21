import http from 'http';
import { defaultRouterLogger } from '../../core/router/logger.js';
import { defaultMcpProxy } from '../../core/router/mcp-proxy.js';
import { defaultRouterToggleManager } from '../../core/router/toggle-router.js';
import { RouterActionType } from '../../core/router/types.js';

function readJsonBody(req: http.IncomingMessage): Promise<any> {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
    });
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (err) {
        reject(err);
      }
    });
    req.on('error', reject);
  });
}

/**
 * Handles HTTP routes for the KoSkill Auto-Router and Telemetry.
 */
export async function handleRouterRoutes(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  url: URL
): Promise<boolean> {
  // GET /api/router/logs
  if (req.method === 'GET' && url.pathname === '/api/router/logs') {
    const limit = url.searchParams.get('limit') ? Number(url.searchParams.get('limit')) : undefined;
    const search = url.searchParams.get('search') || undefined;
    const action = (url.searchParams.get('action') as RouterActionType) || undefined;

    const logs = defaultRouterLogger.getTransactions({ limit, search, action });
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ logs, total: logs.length }));
    return true;
  }

  // GET /api/router/status
  if (req.method === 'GET' && url.pathname === '/api/router/status') {
    const isEnabled = defaultRouterToggleManager.isEnabled();
    const activeServersCount = defaultMcpProxy.getActiveServersCount();
    const metrics = defaultRouterLogger.getMetrics(activeServersCount);

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ isEnabled, metrics }));
    return true;
  }

  // POST /api/router/toggle
  if (req.method === 'POST' && url.pathname === '/api/router/toggle') {
    try {
      const body = await readJsonBody(req);
      if (body.dryRun) {
        const preview = await defaultRouterToggleManager.previewEnable();
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ preview }));
        return true;
      }

      if (body.enabled === false) {
        const result = await defaultRouterToggleManager.disable();
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(result));
        return true;
      }

      const result = await defaultRouterToggleManager.enable();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(result));
      return true;
    } catch (err: any) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: err.message }));
      return true;
    }
  }

  // GET /api/router/stream (Server-Sent Events)
  if (req.method === 'GET' && url.pathname === '/api/router/stream') {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
      'Access-Control-Allow-Origin': '*',
    });

    const activeServers = defaultMcpProxy.getActiveServersCount();
    const initialPayload = {
      type: 'init',
      logs: defaultRouterLogger.getTransactions({ limit: 50 }),
      metrics: defaultRouterLogger.getMetrics(activeServers),
    };
    res.write(`data: ${JSON.stringify(initialPayload)}\n\n`);

    const interval = setInterval(() => {
      const active = defaultMcpProxy.getActiveServersCount();
      const payload = {
        type: 'heartbeat',
        logs: defaultRouterLogger.getTransactions({ limit: 50 }),
        metrics: defaultRouterLogger.getMetrics(active),
      };
      res.write(`data: ${JSON.stringify(payload)}\n\n`);
    }, 2000);

    req.on('close', () => {
      clearInterval(interval);
    });

    return true;
  }

  return false;
}
