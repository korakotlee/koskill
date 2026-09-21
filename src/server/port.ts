import net from 'net';

/**
 * Checks whether a given port is available for binding on the specified host.
 *
 * @param port Port number to test
 * @param host Hostname or IP address (defaults to 127.0.0.1)
 */
export function isPortAvailable(port: number, host: string = '127.0.0.1'): Promise<boolean> {
  return new Promise((resolve) => {
    const tester = net.createServer();

    tester.once('error', (err: any) => {
      if (err.code === 'EADDRINUSE' || err.code === 'EACCES') {
        resolve(false);
      } else {
        resolve(false);
      }
    });

    tester.once('listening', () => {
      tester.close(() => {
        resolve(true);
      });
    });

    tester.listen(port, host);
  });
}

/**
 * Scans starting from startPort up to maxAttempts to discover an open port.
 *
 * @param startPort Initial port to probe
 * @param maxAttempts Maximum consecutive ports to check
 * @param host Hostname or IP address
 */
export async function findAvailablePort(
  startPort: number,
  maxAttempts: number = 10,
  host: string = '127.0.0.1'
): Promise<number> {
  for (let offset = 0; offset < maxAttempts; offset++) {
    const candidate = startPort + offset;
    const available = await isPortAvailable(candidate, host);
    if (available) {
      return candidate;
    }
  }

  throw new Error(
    `No available port found in range ${startPort} to ${startPort + maxAttempts - 1} on ${host}`
  );
}
