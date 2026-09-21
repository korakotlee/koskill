import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';

/**
 * Tracks and manages child process IDs to prevent orphan/zombie processes.
 */
export class PidTracker {
  private readonly pidsFilePath: string;

  constructor(pidsFilePath?: string) {
    this.pidsFilePath =
      pidsFilePath ?? path.join(os.homedir(), '.koskill', 'cache', 'pids.json');
    this.ensureCacheDir();
  }

  private ensureCacheDir(): void {
    try {
      const dir = path.dirname(this.pidsFilePath);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    } catch {
      // Ignore directory check failures
    }
  }

  public sweepOrphanPids(): void {
    try {
      if (fs.existsSync(this.pidsFilePath)) {
        fs.writeFileSync(this.pidsFilePath, JSON.stringify([]), 'utf-8');
      }
    } catch {
      // Ignore PID file errors
    }
  }

  public recordPid(pid?: number): void {
    if (!pid) return;
    try {
      let pids: number[] = [];
      if (fs.existsSync(this.pidsFilePath)) {
        pids = JSON.parse(fs.readFileSync(this.pidsFilePath, 'utf-8'));
      }
      pids.push(pid);
      fs.writeFileSync(this.pidsFilePath, JSON.stringify(pids), 'utf-8');
    } catch {
      // Ignore file write errors
    }
  }

  public removePid(pid?: number): void {
    if (!pid) return;
    try {
      if (fs.existsSync(this.pidsFilePath)) {
        const pids: number[] = JSON.parse(fs.readFileSync(this.pidsFilePath, 'utf-8'));
        const filtered = pids.filter((p) => p !== pid);
        fs.writeFileSync(this.pidsFilePath, JSON.stringify(filtered), 'utf-8');
      }
    } catch {
      // Ignore file remove errors
    }
  }

  public getFilePath(): string {
    return this.pidsFilePath;
  }
}
