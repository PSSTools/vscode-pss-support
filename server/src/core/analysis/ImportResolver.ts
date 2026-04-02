import {
  PackageImportStmt,
  PackageScope,
  GlobalScope,
  Scope,
  ScopeChild,
  RootSymbolScope,
  SymbolScope,
  SymbolImportSpec,
  SymbolRefPath,
  TypeIdentifier,
} from '../ast/generated';
import { Diagnostic, DiagnosticSeverity } from '../types/Diagnostic';

export interface ImportResolveResult {
  diagnostics: Diagnostic[];
}

/**
 * Resolves PackageImportStmt targets (wildcard and specific).
 * Scans the ASTs for import statements and resolves them against
 * the symbol table.
 */
export class ImportResolver {
  private diagnostics: Diagnostic[] = [];

  public resolve(root: RootSymbolScope): ImportResolveResult {
    this.diagnostics = [];

    // Scan all compilation units for import statements
    for (const unit of root.units) {
      this.scanForImports(unit, root);
    }

    return { diagnostics: this.diagnostics };
  }

  private scanForImports(scope: Scope, root: RootSymbolScope): void {
    for (const child of scope.children) {
      if (child instanceof PackageImportStmt) {
        this.resolveImport(child, root);
      }
      if (child instanceof Scope) {
        this.scanForImports(child, root);
      }
    }
  }

  private resolveImport(imp: PackageImportStmt, root: RootSymbolScope): void {
    const path = imp.path;
    if (!path) return;

    const pathName = this.resolveTypeIdentifierName(path);
    if (!pathName) return;

    if (imp.wildcard) {
      // Wildcard import: check that the package exists
      const targetScope = this.findScope(pathName, root);
      if (!targetScope) {
        this.reportError(imp, 'unresolved-import', `Cannot resolve import '${pathName}'`);
      }
    } else {
      // Specific import: the path includes the symbol name
      // For "import pkg::sym", check that pkg exists and contains sym
      const parts = pathName.split('::');
      if (parts.length >= 2) {
        const pkgPath = parts.slice(0, -1).join('::');
        const symbolName = parts[parts.length - 1];
        const pkgScope = this.findScope(pkgPath, root);
        if (!pkgScope) {
          this.reportError(imp, 'unresolved-import', `Cannot resolve import package '${pkgPath}'`);
        } else if (!pkgScope.symtab.has(symbolName)) {
          this.reportError(
            imp,
            'unresolved-import',
            `Cannot resolve import symbol '${symbolName}' in package '${pkgPath}'`,
          );
        }
      } else {
        // Single name import
        const targetScope = this.findScope(pathName, root);
        if (!targetScope) {
          this.reportError(imp, 'unresolved-import', `Cannot resolve import '${pathName}'`);
        }
      }
    }
  }

  private resolveTypeIdentifierName(typeId: TypeIdentifier): string | null {
    if (typeId.elems.length === 0) return null;
    return typeId.elems.map(e => e.id?.id ?? '').join('::');
  }

  /** Find a scope by qualified name from root. */
  private findScope(name: string, root: RootSymbolScope): SymbolScope | null {
    const parts = name.split('::');
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

  /** Look up a symbol name considering the scope hierarchy. */
  public lookupSymbol(name: string, scope: SymbolScope, root: RootSymbolScope): SymbolScope | null {
    let current: SymbolScope | null = scope;
    while (current) {
      if (current.symtab.has(name)) {
        const idx = current.symtab.get(name)!;
        const child = current.children[idx];
        if (child instanceof SymbolScope) return child;
      }
      current = current.upper ?? null;
    }

    // Try all packages at root level
    for (const [, idx] of root.symtab) {
      const pkg = root.children[idx];
      if (pkg instanceof SymbolScope && pkg.symtab.has(name)) {
        const childIdx = pkg.symtab.get(name)!;
        const child = pkg.children[childIdx];
        if (child instanceof SymbolScope) return child;
      }
    }

    return null;
  }

  private reportError(node: ScopeChild, code: string, message: string): void {
    const loc = node.location;
    this.diagnostics.push({
      range: {
        start: { line: Math.max(0, loc.lineno - 1), character: Math.max(0, loc.linepos) },
        end: { line: Math.max(0, loc.lineno - 1), character: Math.max(0, loc.linepos + (loc.extent > 0 ? loc.extent : 1)) },
      },
      severity: DiagnosticSeverity.Error,
      code,
      source: 'pss',
      message,
      fileId: loc.fileid >= 0 ? loc.fileid : undefined,
    });
  }
}
