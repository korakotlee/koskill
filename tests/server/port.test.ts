import { describe, it, expect } from 'vitest';
import net from 'net';
import { isPortAvailable, findAvailablePort } from '../../src/server/port.js';

describe('Port Discovery & Collision Fallback (src/server/port.ts)', () => {
  it('detects an available port', async () => {
    // Port 0 in net.Server lets the OS pick an available port
    const available = await isPortAvailable(0);
    expect(available).toBe(true);
  });

  it('detects a busy port when a server is already listening', async () => {
    const server = net.createServer();
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()));
    const address = server.address() as net.AddressInfo;
    const busyPort = address.port;

    try {
      const available = await isPortAvailable(busyPort, '127.0.0.1');
      expect(available).toBe(false);
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });

  it('finds the next available port when starting port is busy', async () => {
    const server = net.createServer();
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()));
    const address = server.address() as net.AddressInfo;
    const busyPort = address.port;

    try {
      const resolvedPort = await findAvailablePort(busyPort, 5, '127.0.0.1');
      expect(resolvedPort).toBeGreaterThan(busyPort);
      expect(resolvedPort).toBeLessThanOrEqual(busyPort + 5);
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });

  it('throws an error if no port is available within maxAttempts', async () => {
    const server = net.createServer();
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()));
    const address = server.address() as net.AddressInfo;
    const busyPort = address.port;

    try {
      await expect(findAvailablePort(busyPort, 1, '127.0.0.1')).rejects.toThrow(
        /No available port found/
      );
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });
});
