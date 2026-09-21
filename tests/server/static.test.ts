import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import http from 'http';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { handleStaticRoutes, getMimeType } from '../../src/server/static.js';

describe('Static Asset Serving (src/server/static.ts)', () => {
  let tempDir: string;
  let clientDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'koskill-static-test-'));
    clientDir = path.join(tempDir, 'dist', 'client');
    fs.mkdirSync(clientDir, { recursive: true });
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('correctly maps file extensions to standard MIME types', () => {
    expect(getMimeType('app.js')).toBe('application/javascript');
    expect(getMimeType('style.css')).toBe('text/css');
    expect(getMimeType('index.html')).toBe('text/html');
    expect(getMimeType('icon.svg')).toBe('image/svg+xml');
    expect(getMimeType('logo.png')).toBe('image/png');
    expect(getMimeType('favicon.ico')).toBe('image/x-icon');
    expect(getMimeType('data.json')).toBe('application/json');
    expect(getMimeType('unknown.xyz')).toBe('application/octet-stream');
  });

  it('bypasses API routes returning false', async () => {
    const req = { method: 'GET' } as http.IncomingMessage;
    let written = false;
    const res = {
      writeHead: () => {},
      end: () => { written = true; },
      setHeader: () => {}
    } as unknown as http.ServerResponse;

    const url = new URL('http://127.0.0.1:3900/api/health');
    const handled = await handleStaticRoutes(req, res, url, clientDir);
    expect(handled).toBe(false);
    expect(written).toBe(false);
  });

  it('serves static files from client directory with correct MIME type', async () => {
    fs.writeFileSync(path.join(clientDir, 'test.css'), 'body { background: black; }');

    let statusCode = 0;
    const headers: Record<string, string> = {};
    let responseBody = '';

    const req = { method: 'GET' } as http.IncomingMessage;
    const res = {
      writeHead: (status: number, hdrs?: Record<string, string>) => {
        statusCode = status;
        if (hdrs) {
          for (const [k, v] of Object.entries(hdrs)) {
            headers[k.toLowerCase()] = v;
          }
        }
      },
      end: (data?: string | Buffer) => {
        if (data) responseBody = data.toString();
      },
      setHeader: (name: string, value: string) => {
        headers[name.toLowerCase()] = value;
      }
    } as unknown as http.ServerResponse;

    const url = new URL('http://127.0.0.1:3900/test.css');
    const handled = await handleStaticRoutes(req, res, url, clientDir);

    expect(handled).toBe(true);
    expect(statusCode).toBe(200);
    expect(headers['content-type']).toBe('text/css');
    expect(responseBody).toBe('body { background: black; }');
  });

  it('serves index.html for root path /', async () => {
    fs.writeFileSync(path.join(clientDir, 'index.html'), '<html><body>KoSkill Cockpit</body></html>');

    let statusCode = 0;
    let responseBody = '';

    const req = { method: 'GET' } as http.IncomingMessage;
    const res = {
      writeHead: (status: number) => { statusCode = status; },
      end: (data?: string | Buffer) => { if (data) responseBody = data.toString(); },
      setHeader: () => {}
    } as unknown as http.ServerResponse;

    const url = new URL('http://127.0.0.1:3900/');
    const handled = await handleStaticRoutes(req, res, url, clientDir);

    expect(handled).toBe(true);
    expect(statusCode).toBe(200);
    expect(responseBody).toContain('KoSkill Cockpit');
  });

  it('falls back to index.html for SPA routes without extensions', async () => {
    fs.writeFileSync(path.join(clientDir, 'index.html'), '<html><body>SPA Root</body></html>');

    let statusCode = 0;
    let responseBody = '';

    const req = { method: 'GET' } as http.IncomingMessage;
    const res = {
      writeHead: (status: number) => { statusCode = status; },
      end: (data?: string | Buffer) => { if (data) responseBody = data.toString(); },
      setHeader: () => {}
    } as unknown as http.ServerResponse;

    const url = new URL('http://127.0.0.1:3900/workflows');
    const handled = await handleStaticRoutes(req, res, url, clientDir);

    expect(handled).toBe(true);
    expect(statusCode).toBe(200);
    expect(responseBody).toContain('SPA Root');
  });

  it('renders helpful fallback HTML if client assets are not built', async () => {
    // Empty clientDir without index.html
    let statusCode = 0;
    let responseBody = '';

    const req = { method: 'GET' } as http.IncomingMessage;
    const res = {
      writeHead: (status: number) => { statusCode = status; },
      end: (data?: string | Buffer) => { if (data) responseBody = data.toString(); },
      setHeader: () => {}
    } as unknown as http.ServerResponse;

    const url = new URL('http://127.0.0.1:3900/');
    const handled = await handleStaticRoutes(req, res, url, clientDir);

    expect(handled).toBe(true);
    expect(statusCode).toBe(200);
    expect(responseBody).toContain('npm run build');
  });
});
