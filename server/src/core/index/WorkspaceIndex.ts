import {
  GlobalScope,
  RootSymbolScope,
  SymbolScope,
  SymbolTypeScope,
  SymbolEnumScope,
  ScopeChild,
  Scope,
  NamedScope,
  NamedScopeChild,
  TypeScope,
} from '../ast/generated/index.js';
import { Diagnostic, DiagnosticSeverity } from '../types/Diagnostic.js';
import { SourcePosition } from '../types/SourcePosition.js';
import { newParser } from '../parser/ParserHost.js';
import { markerToDiagnostic } from '../parser/MarkerDiagnostics.js';
import { FileState } from './FileState.js';
import { findNodeAtPosition, getNodeName } from '../ast/ASTUtils.js';
import { lspChar } from '../ast/SourceLoc.js';

/**
 * The workspace's files, their trees, and the symbol table linking them.
 *
 * Everything here comes out of one `parse` + `link` over every file at once.
 * There used to be a second stage on top -- a symbol-table builder, extension
 * applicator, import resolver and reference resolver written in TypeScript --
 * which rebuilt from the AST what `link()` had already built in the core. Two
 * implementations of the same rules disagree eventually, and while both ran
 * every undefined type was reported twice, once in each vocabulary.
 */
export class WorkspaceIndex {
  private fileStates = new Map<string, FileState>();
  private parser = newParser();
  private uriToFileId = new Map<string, number>();
  private fileIdToUri = new Map<number, string>();

  /** The last link that produced user units. See `ensureParsed`. */
  private symbolRoot: RootSymbolScope | null = null;

  /**
   * Set when the parse is stale.
   *
   * Parsing is whole-workspace, not per-file: the parser links every unit
   * together in one pass, so there is no way to re-parse one file and splice
   * the result into an existing link. An edit therefore invalidates the whole
   * parse, and `ensureParsed` redoes it on the next read.
   *
   * This is affordable and was measured before being relied on: the full
   * 92-file corpus parses and links in ~136ms, roughly 1.5ms per file.
   * `ensureParsed` is lazy, so a burst of edits between two reads costs one
   * parse rather than one per edit.
   */
  private parseStale = true;

  /** Add a new file to the index. */
  public addFile(uri: string, content: string): void {
    const state = new FileState(uri);
    state.text = content;
    this.fileStates.set(uri, state);
    this.invalidate();
  }

  /** Update an existing file in the index. */
  public updateFile(uri: string, content: string): void {
    let state = this.fileStates.get(uri);
    if (!state) {
      state = new FileState(uri);
      this.fileStates.set(uri, state);
    }
    state.version++;
    state.text = content;
    this.invalidate();
  }

  /**
   * Release the WASM-side parser.
   *
   * The WASM heap is not reachable by the JavaScript garbage collector, so an
   * index that is dropped without this leaks it.
   */
  public dispose(): void {
    this.parser.dispose();
  }

  /** Remove a file from the index. */
  public removeFile(uri: string): void {
    this.fileStates.delete(uri);
    this.invalidate();
  }

  /** Get the AST for a file. */
  public getAST(uri: string): GlobalScope | undefined {
    this.ensureParsed();
    return this.fileStates.get(uri)?.ast ?? undefined;
  }

  /**
   * Get the source text the current AST was built from.
   * Services that need text (formatting, line-prefix completion) read it here
   * rather than being handed it separately, so text and AST cannot disagree.
   */
  public getText(uri: string): string | undefined {
    return this.fileStates.get(uri)?.text;
  }

  /** Get all diagnostics for a file (triggers a re-parse if needed). */
  public getDiagnostics(uri: string): Diagnostic[] {
    this.ensureParsed();
    return this.fileStates.get(uri)?.diagnostics ?? [];
  }

  /** Get all diagnostics for all files. */
  public getAllDiagnostics(): Map<string, Diagnostic[]> {
    this.ensureParsed();
    const result = new Map<string, Diagnostic[]>();
    for (const [uri, state] of this.fileStates) {
      result.set(uri, state.diagnostics);
    }
    return result;
  }

  /** Find a type by qualified name across the workspace. */
  public findType(qualifiedName: string): SymbolScope | null {
    const root = this.getSymbolRoot();
    if (!root) return null;

    const parts = qualifiedName.split('::');
    let current: SymbolScope = root;
    for (const part of parts) {
      if (!current.symtab.has(part)) return null;
      const idx = current.symtab.get(part)!;
      const child = current.children[idx];
      if (!(child instanceof SymbolScope)) return null;
      current = child;
    }
    return current;
  }

  /** Find the AST node and its enclosing symbol scope at a position. */
  public findSymbolAtPosition(
    uri: string,
    pos: SourcePosition,
  ): { node: ScopeChild; scope: SymbolScope } | null {
    this.ensureParsed();
    const state = this.fileStates.get(uri);
    if (!state?.ast) return null;

    const node = findNodeAtPosition(state.ast, pos);
    if (!node) return null;

    // Find the enclosing symbol scope
    const scope = this.findEnclosingSymbolScope(node, uri);

    return scope ? { node, scope } : null;
  }

  /** Search all symbols matching a query string. */
  public getAllSymbols(query: string): Array<{
    name: string;
    kind: string;
    uri: string;
    range: { start: SourcePosition; end: SourcePosition };
  }> {
    this.ensureParsed();
    const results: Array<{
      name: string;
      kind: string;
      uri: string;
      range: { start: SourcePosition; end: SourcePosition };
    }> = [];

    const lowerQuery = query.toLowerCase();

    for (const [uri, state] of this.fileStates) {
      if (!state.ast) continue;
      this.collectSymbols(state.ast, uri, lowerQuery, results);
    }

    return results;
  }

  /**
   * Files whose diagnostics may have changed because `uri` did.
   *
   * Every other file in the workspace. A dependency graph used to be built
   * here from references that resolved, which had a hole its own callers had
   * to work around: an edit that *breaks* a dependency also deletes the edge
   * pointing at the dependent, so the dependent never got re-diagnosed.
   * Linking is whole-workspace anyway -- one edit re-links everything -- so
   * the graph bought nothing but the hole. Every file is already diagnosed by
   * the time this is called; the caller is only choosing what to publish.
   */
  public getDependents(uri: string): string[] {
    return [...this.fileStates.keys()].filter(u => u !== uri);
  }

  /**
   * The linked symbol table for the whole workspace.
   *
   * Null until the parser has linked user code at least once. After that it
   * is never null again: a pass in which nothing links keeps the previous
   * root rather than dropping to a standard-library-only one.
   */
  public getSymbolRoot(): RootSymbolScope | null {
    this.ensureParsed();
    return this.symbolRoot;
  }

  /** Get all file URIs in the index. */
  public getFileUris(): string[] {
    return [...this.fileStates.keys()];
  }

  /** Get file URI from file ID. */
  public getUriForFileId(fileId: number): string | undefined {
    return this.fileIdToUri.get(fileId);
  }

  /** Get file ID from URI. */
  public getFileIdForUri(uri: string): number | undefined {
    return this.uriToFileId.get(uri);
  }

  // ── Private ────────────────────────────────────────────────────

  /**
   * Re-parse and re-link every file, if anything has changed since the last one.
   *
   * Files are fed to the parser one at a time rather than as a single batch,
   * and that is the whole point of this loop. `parseSources` throws on the
   * first file with a syntax error and does not parse the rest, so a single
   * unbalanced brace -- the normal state of a buffer being typed into -- would
   * make every file after it invisible: no symbols, no completion, no
   * go-to-definition, anywhere in the workspace. One call per file confines
   * the damage to the file that is actually broken.
   *
   * The cost of that resilience was measured: 136ms for the 92-file corpus
   * against 34ms for a single batched call. Correctness is worth the 4x here,
   * and both are lazy.
   *
   * A file that fails keeps the tree from its last successful parse. The
   * parser has no error recovery -- a failed parse yields no unit at all, not
   * a partial one -- and a buffer mid-edit is syntactically invalid most of
   * the time it is being looked at. Dropping the tree would make every
   * identifier in the file stop resolving the moment a brace was opened,
   * which is exactly when completion is wanted. The stale tree is wrong only
   * about the edit in progress; it is right about everything else in the file.
   */
  private ensureParsed(): void {
    if (!this.parseStale) return;
    this.parseStale = false;

    this.uriToFileId.clear();
    this.fileIdToUri.clear();
    for (const state of this.fileStates.values()) {
      state.syntaxDiagnostics = [];
    }

    this.parser.clearMarkers();

    const broken = new Set<string>();
    for (const [uri, state] of this.fileStates) {
      try {
        this.parser.parseSources([{ name: uri, content: state.text ?? '' }]);
      } catch {
        // The markers carry the detail; they are read back below. A file that
        // fails here simply contributes no unit.
        broken.add(uri);
      }
    }

    try {
      this.parser.link();
    } catch {
      // A link failure is reported through markers like any other. The root is
      // still recorded, and the units that did link are still usable.
    }

    // File ids come from the parser, not from a counter here. The AST nodes
    // carry them and the analyzer keys diagnostics by them, so any id this
    // class invented would fail to line up with the tree it is indexing.
    for (const [fileid, name] of this.parser.fileMap()) {
      this.uriToFileId.set(name, fileid);
      this.fileIdToUri.set(fileid, name);
    }

    const reparsed = new Set<string>();
    const units = this.parser.userUnits();

    // Hold on to the last root that had any user code in it, for the same
    // reason the trees above are held: a file being typed into does not link,
    // and a root containing nothing but the standard library would make every
    // symbol the user has written disappear from completion and go-to-
    // definition at exactly the moment they are asking for it. A root that
    // still has user units in it is this pass's; it supersedes the old one.
    if (units.length > 0 || this.fileStates.size === 0) {
      this.symbolRoot = this.parser.root;
    }

    for (const unit of units) {
      const uri = this.fileIdToUri.get(unit.fileid);
      if (uri === undefined) continue;
      const state = this.fileStates.get(uri);
      if (!state) continue;
      unit.filename = uri;
      state.ast = unit;
      reparsed.add(uri);
    }

    // A file holding a stale tree still needs its id in the maps: the tree's
    // nodes carry that id, and callers translate node to URI through it.
    for (const [uri, state] of this.fileStates) {
      if (reparsed.has(uri) || !state.ast) continue;
      this.uriToFileId.set(uri, state.ast.fileid);
      if (!this.fileIdToUri.has(state.ast.fileid)) {
        this.fileIdToUri.set(state.ast.fileid, uri);
      }
    }

    for (const marker of this.parser.markers) {
      const uri = marker.file;
      if (uri === undefined) continue;
      const state = this.fileStates.get(uri);
      if (!state) continue;
      state.syntaxDiagnostics.push(markerToDiagnostic(marker));
    }

    // A file that failed to parse and produced no marker would otherwise look
    // clean. That should not happen, but "no diagnostic" is the one outcome
    // that must not be reachable from a failed parse.
    for (const uri of broken) {
      const state = this.fileStates.get(uri);
      if (state && state.syntaxDiagnostics.length === 0) {
        state.syntaxDiagnostics.push({
          range: { start: { line: 0, character: 0 }, end: { line: 0, character: 1 } },
          severity: DiagnosticSeverity.Error,
          code: 'parse-failed',
          source: 'pss',
          message: 'Failed to parse file',
        });
      }
    }
  }

  private invalidate(): void {
    this.parseStale = true;
  }

  private findEnclosingSymbolScope(node: ScopeChild, uri: string): SymbolScope | null {
    const root = this.getSymbolRoot();
    if (!root) return null;

    // Walk the symbol tree to find the scope containing this node
    const name = getNodeName(node);
    if (name) {
      return this.findSymbolScopeByName(name, root);
    }

    return root;
  }

  private findSymbolScopeByName(name: string, scope: SymbolScope): SymbolScope | null {
    if (scope.symtab.has(name)) {
      const idx = scope.symtab.get(name)!;
      const child = scope.children[idx];
      if (child instanceof SymbolScope) return child;
    }

    for (const child of scope.children) {
      if (child instanceof SymbolScope) {
        const found = this.findSymbolScopeByName(name, child);
        if (found) return found;
      }
    }

    return null;
  }

  private collectSymbols(
    scope: Scope,
    uri: string,
    lowerQuery: string,
    results: Array<{
      name: string;
      kind: string;
      uri: string;
      range: { start: SourcePosition; end: SourcePosition };
    }>,
  ): void {
    for (const child of scope.children) {
      const name = getNodeName(child);
      if (name && name.toLowerCase().includes(lowerQuery)) {
        const loc = child.location;
        if (loc.lineno >= 0) {
          results.push({
            name,
            kind: child.constructor.name,
            uri,
            range: {
              start: { line: loc.lineno - 1, character: lspChar(loc) },
              end: { line: loc.lineno - 1, character: lspChar(loc) + (loc.extent > 0 ? loc.extent : name.length) },
            },
          });
        }
      }

      if (child instanceof Scope) {
        this.collectSymbols(child, uri, lowerQuery, results);
      }
    }
  }
}
