import { IFileSystem } from '../io/IFileSystem';
import { nodeFileSystem } from '../io/NodeFileSystem';
import { joinPath } from '../io/UriUtils';
import { PSSParserFacade } from '../parser/PSSParserFacade';
import { PSSASTBuilder } from '../parser/PSSASTBuilder';
import { GlobalScope } from '../ast/generated';

// Bundled stdlib content - fallback if files not found on disk
const BUNDLED_STDLIB: Record<string, string> = {
  'std_pkg.pss': `
package std_pkg {
    struct packed_s {};
    function void print(string fmt);
    function bit[32] urandom();
    function bit[32] urandom_range(bit[32] min, bit[32] max);
}
`,
};

/**
 * Locate the directory holding the packaged stdlib .pss sources, if present.
 *
 * Returns undefined when the directory is absent, in which case StdlibLoader
 * falls back to BUNDLED_STDLIB. Note that as of today the build does not copy
 * the real stdlib into `out/stdlib`, so installed users always take the
 * fallback -- fixing that is packaging work, tracked separately. This function
 * exists so that server.ts has somewhere to ask, rather than passing nothing.
 */
export function resolveStdlibDir(
  serverOutDir: string = __dirname,
  fs: IFileSystem = nodeFileSystem,
): string | undefined {
  // __dirname is server/out/core/analysis at runtime; stdlib sits at out/stdlib.
  const candidates = [
    joinPath(serverOutDir, '../../stdlib'),
    joinPath(serverOutDir, '../stdlib'),
    joinPath(serverOutDir, 'stdlib'),
  ];
  for (const dir of candidates) {
    if (fs.isDirectory(dir)) return dir;
  }
  return undefined;
}

/**
 * Loads PSS standard library definitions and returns them as GlobalScope ASTs.
 * Tries to load from the filesystem first; falls back to bundled definitions.
 */
export class StdlibLoader {
  private parser = new PSSParserFacade();
  private stdlibDir: string | null;
  private fs: IFileSystem;

  constructor(stdlibDir?: string, fs: IFileSystem = nodeFileSystem) {
    this.stdlibDir = stdlibDir ?? null;
    this.fs = fs;
  }

  public load(): GlobalScope[] {
    const scopes: GlobalScope[] = [];
    let fileId = -1000; // Negative IDs for stdlib files

    // Try loading from disk
    if (this.stdlibDir && this.fs.exists(this.stdlibDir)) {
      const files = this.fs.readDir(this.stdlibDir).filter(f => f.endsWith('.pss')).sort();
      for (const file of files) {
        const content = this.fs.readFile(this.stdlibDir + '/' + file);
        if (content === undefined) continue;
        const gs = this.parseStdlib(content, fileId--, file);
        if (gs) scopes.push(gs);
      }
    }

    // If no stdlib loaded from disk, use bundled
    if (scopes.length === 0) {
      for (const [name, content] of Object.entries(BUNDLED_STDLIB)) {
        const gs = this.parseStdlib(content, fileId--, name);
        if (gs) scopes.push(gs);
      }
    }

    return scopes;
  }

  private parseStdlib(content: string, fileId: number, filename: string): GlobalScope | null {
    const result = this.parser.parse(content, fileId);
    if (result.errors.length > 0) {
      // Stdlib should parse cleanly - log but continue
      return null;
    }
    const builder = new PSSASTBuilder(fileId, result.tokens);
    const gs = builder.build(result.tree);
    gs.filename = filename;
    return gs;
  }
}
