import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const MIME_MAP: Record<string, string> = {
  '.html': 'text/html',
  '.js': 'application/javascript',
  '.mjs': 'application/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf'
};

/**
 * Returns the MIME type corresponding to a given filename or file extension.
 */
export function getMimeType(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  return MIME_MAP[ext] || 'application/octet-stream';
}

/**
 * Resolves the default distribution client directory relative to package module root.
 */
export function getDefaultClientDir(): string {
  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  return path.resolve(__dirname, '..', '..', 'dist', 'client');
}

/**
 * Renders fallback HTML when production assets are not built yet.
 */
function getUnbuiltFallbackHtml(): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>KoSkill - Build Required</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      background-color: #0d1117;
      color: #c9d1d9;
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      margin: 0;
      padding: 24px;
      box-sizing: border-box;
    }
    .card {
      background-color: #161b22;
      border: 1px solid #30363d;
      border-radius: 8px;
      padding: 32px;
      max-width: 520px;
      box-shadow: 0 8px 24px rgba(0,0,0,0.4);
      text-align: center;
    }
    h1 {
      font-size: 20px;
      margin-top: 0;
      color: #58a6ff;
    }
    p {
      font-size: 14px;
      line-height: 1.6;
      color: #8b949e;
    }
    code {
      background-color: #21262d;
      color: #f0883e;
      padding: 4px 8px;
      border-radius: 6px;
      font-family: ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace;
      font-size: 13px;
    }
  </style>
</head>
<body>
  <div class="card">
    <h1>KoSkill Web Dashboard</h1>
    <p>The client application bundle has not been built yet.</p>
    <p>Please build the production frontend by running:</p>
    <p><code>npm run build</code></p>
  </div>
</body>
</html>`;
}

/**
 * Handles static asset serving for production web client with SPA fallback.
 */
export async function handleStaticRoutes(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  url: URL,
  clientDir: string = getDefaultClientDir()
): Promise<boolean> {
  // Never intercept API routes
  if (url.pathname.startsWith('/api/')) {
    return false;
  }

  // Only handle GET and HEAD
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    return false;
  }

  const cleanPath = path.normalize(url.pathname).replace(/^(\.\.[/\\])+/, '');
  let filePath = path.join(clientDir, cleanPath);

  // Check if requested file directly exists
  let isFile = false;
  try {
    const stat = fs.statSync(filePath);
    if (stat.isFile()) {
      isFile = true;
    }
  } catch {
    isFile = false;
  }

  // SPA fallback for root or client routes without extensions
  if (!isFile) {
    const indexPath = path.join(clientDir, 'index.html');
    if (fs.existsSync(indexPath)) {
      filePath = indexPath;
      isFile = true;
    } else {
      // Assets unbuilt fallback
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(getUnbuiltFallbackHtml());
      return true;
    }
  }

  try {
    const mime = getMimeType(filePath);
    const content = fs.readFileSync(filePath);
    res.writeHead(200, {
      'Content-Type': mime,
      'Content-Length': Buffer.byteLength(content).toString()
    });
    if (req.method === 'HEAD') {
      res.end();
    } else {
      res.end(content);
    }
    return true;
  } catch {
    return false;
  }
}
