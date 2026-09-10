/**
 * Parse PSS source into ASTs for tests, the way the server does.
 *
 * Replaces the `new PSSParserFacade()` / `new PSSASTBuilder(...)` pair that
 * every analysis and service test used to open with. That pair is gone with
 * the ANTLR front end, and it was never really two steps for a test's
 * purposes -- the parser materialises the tree during `link()`.
 */
import { GlobalScope, RootSymbolScope } from '../../src/core/ast/generated/index.js';
import { markerToDiagnostic } from '../../src/core/parser/MarkerDiagnostics.js';
import { newParser } from '../../src/core/parser/ParserHost.js';
import { Diagnostic } from '../../src/core/types/Diagnostic.js';

export interface ParsedSources {
  /** One GlobalScope per input, in order, with `filename` set. */
  scopes: GlobalScope[];
  /** The linked root, including the built-in standard library units. */
  root: RootSymbolScope | null;
  /** Units the parser links in itself -- the standard library. */
  stdlibScopes: GlobalScope[];
  /**
   * Everything the parser reported, as LSP-shaped diagnostics.
   *
   * Includes link-time findings as well as syntax errors: the parser appends
   * the two, and a test asserting "this source is clean" wants both.
   */
  diagnostics: Diagnostic[];
}

/**
 * Parse each source independently, then link them together.
 *
 * One `parseSources` call per input rather than one call with all of them:
 * a single call abandons the whole batch at the first syntax error, and a
 * good many tests here deliberately feed in malformed source. Per-file, a bad
 * input costs only its own scope.
 *
 * Names default to `file_0.pss`, `file_1.pss`, ... Pass an object to choose
 * them, which matters for tests asserting on cross-file behaviour.
 */
export function parseSources(sources: string[] | Record<string, string>): ParsedSources {
  const entries: Array<[string, string]> = Array.isArray(sources)
    ? sources.map((content, i) => [`file_${i}.pss`, content])
    : Object.entries(sources);

  const parser = newParser();
  try {
    for (const [name, content] of entries) {
      try {
        parser.parseSources([{ name, content }]);
      } catch {
        // Deliberately-malformed input: the scope is simply absent.
      }
    }
    try {
      parser.link();
    } catch {
      // Unresolved references are the subject of several of these tests.
    }

    const names = parser.fileMap();
    const scopes = parser.userUnits();
    for (const gs of scopes) {
      gs.filename = names.get(gs.fileid) ?? '';
    }

    const userIds = new Set(scopes.map((u) => u.fileid));
    const root = parser.root;
    const stdlibScopes = (root?.units ?? []).filter((u) => !userIds.has(u.fileid));

    // The AST survives dispose() -- it is plain JavaScript, not a view over
    // WASM memory -- so the caller keeps everything returned here.
    const diagnostics = parser.markers.map(markerToDiagnostic);

    return { scopes, root, stdlibScopes, diagnostics };
  } finally {
    parser.dispose();
  }
}

/** The single-source case, which is most of them. */
export function parseSource(source: string, name = 'file_0.pss'): GlobalScope | undefined {
  return parseSources({ [name]: source }).scopes[0];
}
