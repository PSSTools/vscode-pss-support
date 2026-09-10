import { IFileDiscovery } from './IFileDiscovery.js';
import { IFileSystem } from './IFileSystem.js';
import { nodeFileSystem } from './NodeFileSystem.js';
import { pathToUri, uriToPath, joinPath } from './UriUtils.js';

/** Directories never descended into, matching the behaviour server.ts had inline. */
const DEFAULT_EXCLUDES = ['node_modules'];

/**
 * Recursive .pss discovery over an IFileSystem.
 *
 * `pattern` is a filename **suffix** (e.g. '.pss'), not a glob -- that is all
 * any caller has ever needed, and a real glob engine would be a dependency
 * bought for nothing.
 */
export class FileSystemDiscovery implements IFileDiscovery {
  private fs: IFileSystem;
  private excludeDirs: Set<string>;

  constructor(fs: IFileSystem = nodeFileSystem, excludeDirs: string[] = DEFAULT_EXCLUDES) {
    this.fs = fs;
    this.excludeDirs = new Set(excludeDirs);
  }

  /** Returns file:// URIs, sorted, so indexing order is reproducible. */
  async discoverFiles(rootUri: string, pattern: string): Promise<string[]> {
    const root = uriToPath(rootUri);
    const found: string[] = [];
    this.walk(root, pattern, found, new Set());
    return found.sort().map(pathToUri);
  }

  private walk(dir: string, suffix: string, out: string[], seen: Set<string>): void {
    if (seen.has(dir)) return;   // guards against symlink cycles
    seen.add(dir);

    for (const name of this.fs.readDir(dir)) {
      const full = joinPath(dir, name);
      if (this.fs.isDirectory(full)) {
        if (name.startsWith('.') || this.excludeDirs.has(name)) continue;
        this.walk(full, suffix, out, seen);
      } else if (name.endsWith(suffix)) {
        out.push(full);
      }
    }
  }
}
