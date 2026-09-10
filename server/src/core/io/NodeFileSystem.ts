import { readFileSync, readdirSync, existsSync, statSync } from 'fs';
import { IFileSystem } from './IFileSystem.js';

/**
 * Production IFileSystem backed by node's `fs`. Every method swallows errors and
 * reports "absent" instead, matching how the callers already behaved when they
 * used `fs` directly: an unreadable file is skipped, never fatal.
 */
export class NodeFileSystem implements IFileSystem {
  readFile(path: string): string | undefined {
    try {
      return readFileSync(path, 'utf-8');
    } catch {
      return undefined;
    }
  }

  readDir(path: string): string[] {
    try {
      return readdirSync(path);
    } catch {
      return [];
    }
  }

  exists(path: string): boolean {
    try {
      return existsSync(path);
    } catch {
      return false;
    }
  }

  isDirectory(path: string): boolean {
    try {
      return statSync(path).isDirectory();
    } catch {
      return false;
    }
  }
}

/** Shared default instance; avoids allocating one per consumer. */
export const nodeFileSystem = new NodeFileSystem();
