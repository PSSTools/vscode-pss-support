import { GlobalScope } from '../../src/core/ast/generated/index.js';
import { Diagnostic } from '../../src/core/types/Diagnostic.js';
import { SourcePosition } from '../../src/core/types/SourcePosition.js';
import { parseSources } from './ParseHelper.js';

/**
 * What a parse yields here.
 *
 * `tree` replaces the ANTLR parse tree the facade used to return. Nothing in
 * these tests inspected that tree -- they asserted it was defined and read
 * `errors` -- so it is the AST now, which is the thing a caller can actually
 * use.
 */
export interface ParseResult {
  tree: GlobalScope | undefined;
  errors: Diagnostic[];
}

export class TestWorkspace {
  private files = new Map<string, string>();

  addFile(name: string, content: string): void {
    this.files.set(name, content);
  }

  parseOne(content: string): ParseResult {
    const { scopes, diagnostics } = parseSources([content]);
    return { tree: scopes[0], errors: diagnostics };
  }

  parseFile(name: string): ParseResult {
    const content = this.files.get(name);
    if (!content) throw new Error(`File not found: ${name}`);
    return this.parseOne(content);
  }

  // Find position of a cursor marker (|) in the source text and return the position.
  cursorPosition(source: string): { cleanSource: string; position: SourcePosition } {
    const idx = source.indexOf('|');
    if (idx < 0) throw new Error('No cursor marker (|) found in source');
    const cleanSource = source.slice(0, idx) + source.slice(idx + 1);
    const lines = source.slice(0, idx).split('\n');
    return {
      cleanSource,
      position: {
        line: lines.length - 1,
        character: lines[lines.length - 1].length,
      },
    };
  }

  // Find position of a named marker in the source text.
  markerPosition(source: string, name: string): SourcePosition {
    const marker = '/*' + name + '*/';
    const idx = source.indexOf(marker);
    if (idx < 0) throw new Error('Marker ' + marker + ' not found in source');
    const lines = source.slice(0, idx).split('\n');
    return {
      line: lines.length - 1,
      character: lines[lines.length - 1].length,
    };
  }
}
