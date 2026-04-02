import { readFileSync, readdirSync, existsSync } from 'fs';
import { join } from 'path';
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
 * Loads PSS standard library definitions and returns them as GlobalScope ASTs.
 * Tries to load from the filesystem first; falls back to bundled definitions.
 */
export class StdlibLoader {
  private parser = new PSSParserFacade();
  private stdlibDir: string | null;

  constructor(stdlibDir?: string) {
    this.stdlibDir = stdlibDir ?? null;
  }

  public load(): GlobalScope[] {
    const scopes: GlobalScope[] = [];
    let fileId = -1000; // Negative IDs for stdlib files

    // Try loading from disk
    if (this.stdlibDir && existsSync(this.stdlibDir)) {
      const files = readdirSync(this.stdlibDir).filter(f => f.endsWith('.pss'));
      for (const file of files) {
        try {
          const content = readFileSync(join(this.stdlibDir, file), 'utf-8');
          const gs = this.parseStdlib(content, fileId--, file);
          if (gs) scopes.push(gs);
        } catch {
          // Skip files that fail to read
        }
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
