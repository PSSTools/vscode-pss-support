import { GlobalScope, RootSymbolScope } from '../ast/generated/index.js';
import { Diagnostic } from '../types/Diagnostic.js';
import { SymbolTableBuilder, SymbolTableResult } from './SymbolTableBuilder.js';
import { ExtensionApplicator } from './ExtensionApplicator.js';
import { ImportResolver } from './ImportResolver.js';
import { ReferenceResolver } from './ReferenceResolver.js';
import { IFileSystem } from '../io/IFileSystem.js';
import { nodeFileSystem } from '../io/NodeFileSystem.js';

export interface AnalysisResult {
  root: RootSymbolScope;
  diagnostics: Map<number, Diagnostic[]>;
  /** Map from file ID to set of file IDs it references */
  crossFileRefs: Map<number, Set<number>>;
}

/**
 * Orchestrates all semantic analysis passes in sequence:
 *   Pass 1: SymbolTableBuilder
 *   Pass 2: ExtensionApplicator (+ ImportResolver)
 *   Pass 3: ReferenceResolver
 */
export class SemanticAnalyzer {
  private stdlibDir?: string;
  private fs: IFileSystem;
  private stdlibScopes: GlobalScope[] | null = null;

  constructor(stdlibDir?: string, fs: IFileSystem = nodeFileSystem) {
    this.stdlibDir = stdlibDir;
    this.fs = fs;
  }

  /**
   * Supply the standard-library scopes to analyse alongside the user's files.
   *
   * These used to be found on disk and parsed here. The parser now links its
   * own built-in copy into every parse, so the caller already holds them and
   * re-reading them would be both redundant and a second source of truth.
   */
  public setStdlibScopes(scopes: GlobalScope[]): void {
    this.stdlibScopes = scopes;
  }

  public analyze(scopes: GlobalScope[]): AnalysisResult {
    const allDiagnostics = new Map<number, Diagnostic[]>();

    // Prepend stdlib scopes
    const allScopes = [...(this.stdlibScopes ?? []), ...scopes];

    // Pass 1: Build symbol table
    const symBuilder = new SymbolTableBuilder();
    const symResult = symBuilder.build(allScopes);
    this.collectDiagnostics(allDiagnostics, symResult.diagnostics, scopes);

    // Pass 2: Apply extensions
    const importResolver = new ImportResolver();
    const importResult = importResolver.resolve(symResult.root);
    this.collectDiagnostics(allDiagnostics, importResult.diagnostics, scopes);

    const extApplicator = new ExtensionApplicator();
    const extResult = extApplicator.apply(symResult.root);
    this.collectDiagnostics(allDiagnostics, extResult.diagnostics, scopes);

    // Pass 3: Resolve references
    const refResolver = new ReferenceResolver(importResolver);
    const refResult = refResolver.resolve(symResult.root);
    this.collectDiagnostics(allDiagnostics, refResult.diagnostics, scopes);

    return {
      root: symResult.root,
      diagnostics: allDiagnostics,
      crossFileRefs: refResult.crossFileRefs,
    };
  }

  /** Distribute diagnostics to their respective file IDs. */
  private collectDiagnostics(
    target: Map<number, Diagnostic[]>,
    diagnostics: Diagnostic[],
    scopes: GlobalScope[],
  ): void {
    // Build a set of user file IDs (exclude stdlib) for fallback routing
    const userFileIds = new Set(scopes.map(s => s.fileid));

    for (const diag of diagnostics) {
      // Use the fileId attached to the diagnostic if available
      let fileId = diag.fileId;
      if (fileId === undefined || fileId < 0) {
        // Fallback: assign to the first user file
        fileId = userFileIds.size > 0 ? userFileIds.values().next().value! : 0;
      }
      // Skip diagnostics from stdlib files
      if (!userFileIds.has(fileId)) continue;

      if (!target.has(fileId)) {
        target.set(fileId, []);
      }
      target.get(fileId)!.push(diag);
    }
  }
}
