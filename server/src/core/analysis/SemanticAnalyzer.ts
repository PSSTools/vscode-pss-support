import { GlobalScope, RootSymbolScope } from '../ast/generated';
import { Diagnostic } from '../types/Diagnostic';
import { SymbolTableBuilder, SymbolTableResult } from './SymbolTableBuilder';
import { ExtensionApplicator } from './ExtensionApplicator';
import { ImportResolver } from './ImportResolver';
import { ReferenceResolver } from './ReferenceResolver';
import { StdlibLoader } from './StdlibLoader';

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
  private stdlibScopes: GlobalScope[] | null = null;

  constructor(stdlibDir?: string) {
    this.stdlibDir = stdlibDir;
  }

  public analyze(scopes: GlobalScope[]): AnalysisResult {
    const allDiagnostics = new Map<number, Diagnostic[]>();

    // Load stdlib if not already loaded
    if (!this.stdlibScopes) {
      const loader = new StdlibLoader(this.stdlibDir);
      this.stdlibScopes = loader.load();
    }

    // Prepend stdlib scopes
    const allScopes = [...this.stdlibScopes, ...scopes];

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
