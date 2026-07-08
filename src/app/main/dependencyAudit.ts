import fs from 'node:fs';
import path from 'node:path';
import type { ExecFileException } from 'node:child_process';

export const DEPENDENCY_LOCKFILES = ['package-lock.json', 'npm-shrinkwrap.json', 'yarn.lock', 'pnpm-lock.yaml'] as const;
export const DEPENDENCY_PACKAGE_FILES = ['package.json', ...DEPENDENCY_LOCKFILES] as const;

const SKIP_DIRS = new Set(['node_modules', '.git', 'dist', 'build', 'out', '.vite', '__pycache__', 'venv', '.venv']);

export interface NodeProjectCandidate {
  dir: string;
  lockfiles: string[];
}

export interface DependencyAuditCounts {
  critical: number;
  high: number;
  moderate: number;
  low: number;
  info: number;
  total: number;
}

export interface DependencyAuditRun {
  vulns: any[];
  counts: DependencyAuditCounts;
  error?: string;
}

export type DependencyAuditLogger = (message: string) => void;
export type ExecFileLike = (
  file: string,
  args: string[],
  options: { cwd: string; timeout: number },
  callback: (error: ExecFileException | null, stdout: string | Buffer, stderr: string | Buffer) => void,
) => void;

const EMPTY_COUNTS: DependencyAuditCounts = { critical: 0, high: 0, moderate: 0, low: 0, info: 0, total: 0 };

function toText(value: string | Buffer | undefined): string {
  return Buffer.isBuffer(value) ? value.toString('utf-8') : value ?? '';
}

function shortError(error: ExecFileException | null, stderr: string): string {
  const errParts = [
    error?.code ? `code=${error.code}` : '',
    error?.signal ? `signal=${error.signal}` : '',
    error?.message ? error.message : '',
    stderr.trim() ? stderr.trim().split('\n')[0] : '',
  ].filter(Boolean);
  return errParts.join(' · ') || 'npm audit failed without details';
}

export function findNodeProjects(projectPath: string, logger: DependencyAuditLogger = () => {}): NodeProjectCandidate[] {
  logger(`[Cortex] Dependency audit — searching from ${projectPath}`);

  function visit(dir: string, depth = 0): NodeProjectCandidate[] {
    if (depth > 4) return [];
    const found: NodeProjectCandidate[] = [];

    try {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      const files = new Set(entries.filter(e => e.isFile()).map(e => e.name));
      const hasPkg = files.has('package.json');
      const lockfiles = DEPENDENCY_LOCKFILES.filter(lockfile => files.has(lockfile));

      if (hasPkg) logger(`[Cortex] Dependency audit — found package.json at ${dir}`);
      for (const lockfile of lockfiles) {
        logger(`[Cortex] Dependency audit — found lockfile ${lockfile} at ${dir}`);
      }

      if (hasPkg && lockfiles.length > 0) {
        found.push({ dir, lockfiles: [...lockfiles] });
        return found;
      }

      for (const entry of entries) {
        if (!entry.isDirectory() || SKIP_DIRS.has(entry.name)) continue;
        found.push(...visit(path.join(dir, entry.name), depth + 1));
      }
    } catch {
      // Dossier inaccessible: on poursuit l'exploration ailleurs.
    }

    return found;
  }

  return visit(projectPath);
}

export function hasPackageJsonAnywhere(projectPath: string): boolean {
  function visit(dir: string, depth = 0): boolean {
    if (depth > 4) return false;

    try {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      if (entries.some(e => e.isFile() && e.name === 'package.json')) return true;
      return entries
        .filter(e => e.isDirectory() && !SKIP_DIRS.has(e.name))
        .some(e => visit(path.join(dir, e.name), depth + 1));
    } catch {
      return false;
    }
  }

  return visit(projectPath);
}

export async function runNpmAuditIn(
  dir: string,
  execFileImpl: ExecFileLike,
  logger: DependencyAuditLogger = () => {},
): Promise<DependencyAuditRun> {
  logger(`[Cortex] Dependency audit — running npm audit in ${dir}`);

  return new Promise(resolve => {
    execFileImpl('npm', ['audit', '--json'], { cwd: dir, timeout: 30_000 }, (error, stdoutRaw, stderrRaw) => {
      const stdout = toText(stdoutRaw);
      const stderr = toText(stderrRaw);
      logger(`[Cortex] Dependency audit — npm exit/error ${error ? shortError(error, stderr) : 'ok'}`);

      if (!stdout.trim()) {
        resolve({ vulns: [], counts: { ...EMPTY_COUNTS }, error: shortError(error, stderr) || 'npm audit returned no JSON output' });
        return;
      }

      try {
        const json = JSON.parse(stdout) as any;
        const vulns = Object.values(json.vulnerabilities ?? {}) as any[];
        const counts = json.metadata?.vulnerabilities ?? { ...EMPTY_COUNTS };
        logger(`[Cortex] Dependency audit — parsed vulnerabilities=${counts.total ?? vulns.length}`);
        resolve({ vulns, counts });
      } catch (parseError) {
        resolve({
          vulns: [],
          counts: { ...EMPTY_COUNTS },
          error: `Invalid npm audit JSON: ${String(parseError)}${error ? ` · ${shortError(error, stderr)}` : ''}`,
        });
      }
    });
  });
}
