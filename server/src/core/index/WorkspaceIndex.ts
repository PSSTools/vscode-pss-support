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
import { SemanticAnalyzer, AnalysisResult } from '../analysis/SemanticAnalyzer.js';
import { FileState } from './FileState.js';
import { findNodeAtPosition, getNodeName } from '../ast/ASTUtils.js';
import { IFileSystem } from '../io/IFileSystem.js';

/**
 * Cross-file symbol table and dependency graph.
 * Manages file states, triggers parsing and analysis,
 * and provides query APIs for LSP services.
 */
export class WorkspaceIndex {
  private fileStates = new Map<string, FileState>();
  private parser = newParser();
  private analyzer: SemanticAnalyzer;
  private analysisResult: AnalysisResult | null = null;
  private uriToFileId = new Map<string, number>();
  private fileIdToUri = new Map<number, string>();

  /**
   * Set when the parse is stale.
   *
   * Parsing is whole-workspace, not per-file: the parser links every unit
   * together in one pass, so there is no way to re-parse one file and splice
   * the result into an existing link. An edit therefore invalidates the whole
   * parse, and `ensureParsed` redoes it on the next read.
   *
   * This is affordable and was measured before being relied on: the full
   * 92-file corpus parses and links in ~136ms, roughly 1.5ms per file. Both
   * `ensureParsed` and `ensureAnalyzed` are lazy, so a burst of edits between
   * two reads costs one parse rather than one per edit.
   */
  private parseStale = true;

  constructor(stdlibDir?: string, fs?: IFileSystem) {
    this.analyzer = new SemanticAnalyzer(stdlibDir, fs);
  }

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
    const state = this.fileStates.get(uri);
    if (state) {
      // Clean up dependency tracking
      for (const dep of state.dependencies) {
        const depState = this.fileStates.get(dep);
        if (depState) depState.dependents.delete(uri);
      }
    }
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

  /** Get all diagnostics for a file (triggers re-analysis if needed). */
  public getDiagnostics(uri: string): Diagnostic[] {
    this.ensureAnalyzed();
    return this.fileStates.get(uri)?.diagnostics ?? [];
  }

  /** Get all diagnostics for all files. */
  public getAllDiagnostics(): Map<string, Diagnostic[]> {
    this.ensureAnalyzed();
    const result = new Map<string, Diagnostic[]>();
    for (const [uri, state] of this.fileStates) {
      result.set(uri, state.diagnostics);
    }
    return result;
  }

  /** Find a type by qualified name across the workspace. */
  public findType(qualifiedName: string): SymbolScope | null {
    this.ensureAnalyzed();
    if (!this.analysisResult) return null;

    const parts = qualifiedName.split('::');
    let current: SymbolScope = this.analysisResult.root;
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
    const state = this.fileStates.get(uri);
    if (!state?.ast) return null;

    const node = findNodeAtPosition(state.ast, pos);
    if (!node) return null;

    this.ensureAnalyzed();

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
    this.ensureAnalyzed();
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

  /** Get files that depend on the given file. */
  public getDependents(uri: string): string[] {
    const state = this.fileStates.get(uri);
    return state ? [...state.dependents] : [];
  }

  /** Get the analysis result (triggers analysis if needed). */
  public getAnalysisResult(): AnalysisResult | null {
    this.ensureAnalyzed();
    return this.analysisResult;
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
   */
  private ensureParsed(): void {
    if (!this.parseStale) return;
    this.parseStale = false;

    this.uriToFileId.clear();
    this.fileIdToUri.clear();
    for (const state of this.fileStates.values()) {
      state.ast = null;
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

    for (const unit of this.parser.userUnits()) {
      const uri = this.fileIdToUri.get(unit.fileid);
      if (uri === undefined) continue;
      const state = this.fileStates.get(uri);
      if (!state) continue;
      unit.filename = uri;
      state.ast = unit;
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
    this.invalidateAnalysis();
  }

  private invalidateAnalysis(): void {
    this.analysisResult = null;
    // Clear semantic diagnostics
    for (const state of this.fileStates.values()) {
      state.semanticDiagnostics = [];
    }
  }

  private ensureAnalyzed(): void {
    this.ensureParsed();
    if (this.analysisResult) return;

    // The standard library comes out of the parser, which links it into every
    // parse from its own built-in copy. `userUnits()` filters it out, so the
    // stdlib units are the ones the root holds that no user file claims.
    const userIds = new Set(this.parser.userUnits().map(u => u.fileid));
    this.analyzer.setStdlibScopes(
      (this.parser.root?.units ?? []).filter(u => !userIds.has(u.fileid)),
    );

    const scopes: GlobalScope[] = [];
    for (const state of this.fileStates.values()) {
      if (state.ast) scopes.push(state.ast);
    }

    if (scopes.length === 0) return;

    this.analysisResult = this.analyzer.analyze(scopes);

    // Distribute semantic diagnostics to files
    for (const [fileId, diags] of this.analysisResult.diagnostics) {
      const uri = this.fileIdToUri.get(fileId);
      if (uri) {
        const state = this.fileStates.get(uri);
        if (state) {
          state.semanticDiagnostics = diags;
        }
      }
    }

    // Update dependency graph from cross-file refs
    this.updateDependencyGraph(this.analysisResult.crossFileRefs);
  }

  private updateDependencyGraph(crossFileRefs: Map<number, Set<number>>): void {
    // Clear old deps
    for (const state of this.fileStates.values()) {
      state.dependencies.clear();
      state.dependents.clear();
    }

    for (const [sourceFileId, targetFileIds] of crossFileRefs) {
      const sourceUri = this.fileIdToUri.get(sourceFileId);
      if (!sourceUri) continue;
      const sourceState = this.fileStates.get(sourceUri);
      if (!sourceState) continue;

      for (const targetFileId of targetFileIds) {
        const targetUri = this.fileIdToUri.get(targetFileId);
        if (!targetUri) continue;
        const targetState = this.fileStates.get(targetUri);
        if (!targetState) continue;

        sourceState.dependencies.add(targetUri);
        targetState.dependents.add(sourceUri);
      }
    }
  }

  private findEnclosingSymbolScope(node: ScopeChild, uri: string): SymbolScope | null {
    if (!this.analysisResult) return null;
    const root = this.analysisResult.root;

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
              start: { line: loc.lineno - 1, character: loc.linepos },
              end: { line: loc.lineno - 1, character: loc.linepos + (loc.extent > 0 ? loc.extent : name.length) },
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
