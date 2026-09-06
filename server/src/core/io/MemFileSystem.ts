import { IFileSystem } from './IFileSystem';

/**
 * In-memory IFileSystem. Ships in `src/` rather than `test/` because the test
 * harness is not its only consumer -- it is also how the CLI and any future
 * embedding can analyze sources that never touch the disk.
 *
 * Directories are implied by the file paths, so there is no mkdir: adding
 * '/ws/pkg/a.pss' makes '/ws' and '/ws/pkg' exist as directories.
 */
export class MemFileSystem implements IFileSystem {
  private files = new Map<string, string>();

  constructor(files?: Record<string, string>) {
    if (files) {
      for (const [path, content] of Object.entries(files)) {
        this.addFile(path, content);
      }
    }
  }

  /** Add or replace a file. */
  addFile(path: string, content: string): void {
    this.files.set(normalize(path), content);
  }

  /** Remove a file; no-op if absent. */
  removeFile(path: string): void {
    this.files.delete(normalize(path));
  }

  /** Every file path currently held, in insertion order. */
  listFiles(): string[] {
    return [...this.files.keys()];
  }

  readFile(path: string): string | undefined {
    return this.files.get(normalize(path));
  }

  readDir(path: string): string[] {
    const prefix = dirPrefix(normalize(path));
    const names = new Set<string>();
    for (const filePath of this.files.keys()) {
      if (!filePath.startsWith(prefix)) continue;
      const rest = filePath.slice(prefix.length);
      if (rest.length === 0) continue;
      const slash = rest.indexOf('/');
      names.add(slash < 0 ? rest : rest.slice(0, slash));
    }
    return [...names];
  }

  exists(path: string): boolean {
    const p = normalize(path);
    return this.files.has(p) || this.isDirectory(p);
  }

  isDirectory(path: string): boolean {
    const prefix = dirPrefix(normalize(path));
    for (const filePath of this.files.keys()) {
      if (filePath.startsWith(prefix) && filePath.length > prefix.length) return true;
    }
    return false;
  }
}

/** Collapse '\' to '/' and strip any trailing separator. */
function normalize(path: string): string {
  const slashed = path.replace(/\\/g, '/');
  return slashed.length > 1 && slashed.endsWith('/') ? slashed.slice(0, -1) : slashed;
}

/** The prefix every entry under `dir` shares. '/' stays '/', not '//'. */
function dirPrefix(dir: string): string {
  return dir.endsWith('/') ? dir : dir + '/';
}
