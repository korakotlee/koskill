import http from 'http';
import { defaultLogger } from '../core/logger.js';
import { handleDiscoveryRoutes } from './routes/discovery.js';

export interface AppServer {
  server: http.Server;
  port: number;
  close: () => Promise<void>;
}

/**
 * Creates and starts the KoSkill HTTP daemon.
 *
 * @param preferredPort Port number to listen on (defaults to 3900 or PORT env var)
 */
export async function startServer(preferredPort?: number): Promise<AppServer> {
  const port = preferredPort !== undefined ? preferredPort : (Number(process.env.PORT) || 3900);

  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url || '/', `http://${req.headers.host || '127.0.0.1'}`);

    // Standard headers
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    // Health check route
    if (req.method === 'GET' && url.pathname === '/api/health') {
      res.writeHead(200);
      res.end(JSON.stringify({
        status: 'ok',
        service: 'koskill-daemon',
        version: '0.1.0',
        timestamp: new Date().toISOString()
      }));
      return;
    }

    // Discovery routes
    try {
      const handled = await handleDiscoveryRoutes(req, res, url);
      if (handled) return;
    } catch (err: any) {
      defaultLogger.error('Unhandled router error', { error: err.message, path: url.pathname });
      res.writeHead(500);
      res.end(JSON.stringify({ error: 'Internal Server Error' }));
      return;
    }

    // 404 Not Found fallback
    res.writeHead(404);
    res.end(JSON.stringify({
      error: 'Not Found',
      path: url.pathname
    }));
  });

  return new Promise((resolve, reject) => {
    server.listen(port, '127.0.0.1', () => {
      const address = server.address();
      const boundPort = typeof address === 'object' && address ? address.port : port;
      defaultLogger.info(`KoSkill server daemon listening on port ${boundPort}`, { port: boundPort });
      resolve({
        server,
        port: boundPort,
        close: () => new Promise<void>((closeResolve) => {
          server.close(() => {
            defaultLogger.info(`KoSkill server daemon stopped`, { port: boundPort });
            closeResolve();
          });
        })
      });
    });

    server.on('error', (err) => {
      defaultLogger.error(`Server failed to start on port ${port}`, { error: err.message });
      reject(err);
    });
  });
}

// Auto-run if executed directly
const isDirectRun = process.argv[1]?.endsWith('src/server/index.ts');
if (isDirectRun) {
  startServer().catch((err) => {
    console.error('Fatal error starting server:', err);
    process.exit(1);
  });
}
