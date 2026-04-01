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
} from '../ast/generated';
import { Diagnostic } from '../types/Diagnostic';
import { SourcePosition } from '../types/SourcePosition';
import { PSSParserFacade } from '../parser/PSSParserFacade';
import { PSSASTBuilder } from '../parser/PSSASTBuilder';
import { SemanticAnalyzer, AnalysisResult } from '../analysis/SemanticAnalyzer';
import { FileState } from './FileState';
import { findNodeAtPosition, getNodeName } from '../ast/ASTUtils';

/**
 * Cross-file symbol table and dependency graph.
 * Manages file states, triggers parsing and analysis,
 * and provides query APIs for LSP services.
 */
export class WorkspaceIndex {
  private fileStates = new Map<string, FileState>();
  private parser = new PSSParserFacade();
  private analyzer: SemanticAnalyzer;
  private analysisResult: AnalysisResult | null = null;
  private nextFileId = 1;
  private uriToFileId = new Map<string, number>();
  private fileIdToUri = new Map<number, string>();

  constructor(stdlibDir?: string) {
    this.analyzer = new SemanticAnalyzer(stdlibDir);
  }

  /** Add a new file to the index. */
  public addFile(uri: string, content: string): void {
    const fileId = this.getOrCreateFileId(uri);
    const state = new FileState(uri);
    this.fileStates.set(uri, state);
    this.parseFile(uri, content, fileId);
    this.invalidateAnalysis();
  }

  /** Update an existing file in the index. */
  public updateFile(uri: string, content: string): void {
    const fileId = this.getOrCreateFileId(uri);
    let state = this.fileStates.get(uri);
    if (!state) {
      state = new FileState(uri);
      this.fileStates.set(uri, state);
    }
    state.version++;
    this.parseFile(uri, content, fileId);
    this.invalidateAnalysis();
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
    const fileId = this.uriToFileId.get(uri);
    if (fileId !== undefined) {
      this.uriToFileId.delete(uri);
      this.fileIdToUri.delete(fileId);
    }
    this.invalidateAnalysis();
  }

  /** Get the AST for a file. */
  public getAST(uri: string): GlobalScope | undefined {
    return this.fileStates.get(uri)?.ast ?? undefined;
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

  private getOrCreateFileId(uri: string): number {
    let fileId = this.uriToFileId.get(uri);
    if (fileId === undefined) {
      fileId = this.nextFileId++;
      this.uriToFileId.set(uri, fileId);
      this.fileIdToUri.set(fileId, uri);
    }
    return fileId;
  }

  private parseFile(uri: string, content: string, fileId: number): void {
    const state = this.fileStates.get(uri);
    if (!state) return;

    const result = this.parser.parse(content, fileId);
    const builder = new PSSASTBuilder(fileId, result.tokens);
    const ast = builder.build(result.tree);
    ast.filename = uri;

    state.ast = ast;
    state.syntaxDiagnostics = result.errors;
  }

  private invalidateAnalysis(): void {
    this.analysisResult = null;
    // Clear semantic diagnostics
    for (const state of this.fileStates.values()) {
      state.semanticDiagnostics = [];
    }
  }

  private ensureAnalyzed(): void {
    if (this.analysisResult) return;

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
