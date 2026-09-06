import { WorkspaceIndex } from './WorkspaceIndex';
import { IFileDiscovery } from '../io/IFileDiscovery';
import { IFileSystem } from '../io/IFileSystem';
import { nodeFileSystem } from '../io/NodeFileSystem';
import { FileSystemDiscovery } from '../io/FileSystemDiscovery';
import { uriToPath } from '../io/UriUtils';

export interface WorkspaceLoaderOptions {
  /** Filesystem to read through. Defaults to the real one. */
  fs?: IFileSystem;
  /** Discovery strategy. Defaults to a recursive walk of `fs`. */
  discovery?: IFileDiscovery;
  /** Filename suffix to index. */
  pattern?: string;
  /** Directory holding stdlib .pss sources, passed through to the index. */
  stdlibDir?: string;
}

/**
 * Turns a set of workspace roots into a populated WorkspaceIndex.
 *
 * This is the single definition of "what the extension considers to be the
 * project", shared by the language server, the CLI, and the tests. It used to
 * live as a private `scanDirectory()` inside server.ts, which meant no test
 * could load a project the way the extension actually loads one.
 */
export class WorkspaceLoader {
  private fs: IFileSystem;
  private discovery: IFileDiscovery;
  private pattern: string;

  constructor(options: WorkspaceLoaderOptions = {}) {
    this.fs = options.fs ?? nodeFileSystem;
    this.discovery = options.discovery ?? new FileSystemDiscovery(this.fs);
    this.pattern = options.pattern ?? '.pss';
  }

  /**
   * Discover and index every matching file under `rootUris`.
   * Files already present in the index are left alone -- an open, edited buffer
   * must not be clobbered by its stale on-disk copy.
   *
   * @returns the URIs newly added to the index.
   */
  async loadInto(index: WorkspaceIndex, rootUris: string[]): Promise<string[]> {
    const added: string[] = [];
    for (const rootUri of rootUris) {
      const uris = await this.discovery.discoverFiles(rootUri, this.pattern);
      for (const uri of uris) {
        if (index.getAST(uri)) continue;
        const content = this.fs.readFile(uriToPath(uri));
        if (content === undefined) continue;
        index.addFile(uri, content);
        added.push(uri);
      }
    }
    return added;
  }

  /** Convenience: build a fresh index over the given roots. */
  static async load(
    rootUris: string[],
    options: WorkspaceLoaderOptions = {},
  ): Promise<WorkspaceIndex> {
    const index = new WorkspaceIndex(options.stdlibDir, options.fs);
    await new WorkspaceLoader(options).loadInto(index, rootUris);
    return index;
  }
}
