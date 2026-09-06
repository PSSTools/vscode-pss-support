import { GlobalScope } from '../ast/generated';
import { Diagnostic } from '../types/Diagnostic';

/**
 * Per-file state: holds the AST, diagnostics, and dependency information
 * for a single PSS source file.
 */
export class FileState {
  public readonly uri: string;
  public version: number;
  /** The source text the current AST was built from. */
  public text: string;
  public ast: GlobalScope | null;
  public syntaxDiagnostics: Diagnostic[];
  public semanticDiagnostics: Diagnostic[];
  /** URIs of files this file depends on (imports, type references) */
  public dependencies: Set<string>;
  /** URIs of files that depend on this file */
  public dependents: Set<string>;

  constructor(uri: string, version: number = 0) {
    this.uri = uri;
    this.version = version;
    this.text = '';
    this.ast = null;
    this.syntaxDiagnostics = [];
    this.semanticDiagnostics = [];
    this.dependencies = new Set();
    this.dependents = new Set();
  }

  /** All diagnostics (syntax + semantic) for this file. */
  public get diagnostics(): Diagnostic[] {
    return [...this.syntaxDiagnostics, ...this.semanticDiagnostics];
  }
}
