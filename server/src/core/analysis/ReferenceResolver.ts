import {
  ScopeChild,
  Scope,
  TypeScope,
  NamedScope,
  NamedScopeChild,
  Action,
  Component,
  Struct,
  Field,
  FieldCompRef,
  FieldRef,
  FieldClaim,
  ActionHandleField,
  EnumDecl,
  EnumItem,
  DataType,
  DataTypeUserDefined,
  DataTypeEnum,
  DataTypeRef,
  TypeIdentifier,
  TypeIdentifierElem,
  ExprRefPath,
  ExprRefPathContext,
  ExprRefPathStatic,
  ExprRefPathStaticRooted,
  ExprRefPathSuper,
  ExprHierarchicalId,
  ExprMemberPathElem,
  ActivityActionHandleTraversal,
  ActivityActionTypeTraversal,
  RootSymbolScope,
  SymbolScope,
  SymbolTypeScope,
  SymbolEnumScope,
  SymbolFunctionScope,
  SymbolRefPath,
  SymbolImportSpec,
  PackageImportStmt,
  PackageScope,
  GlobalScope,
  FunctionDefinition,
} from '../ast/generated';
import { Diagnostic, DiagnosticSeverity } from '../types/Diagnostic';
import { getNodeName, walkScope } from '../ast/ASTUtils';
import { ImportResolver } from './ImportResolver';
import { collectAllSymbolNames, findBestMatch } from './SpellSuggest';

export interface ReferenceResolveResult {
  diagnostics: Diagnostic[];
  /** Map from file ID to set of file IDs it references */
  crossFileRefs: Map<number, Set<number>>;
}

/**
 * Pass 3: Resolve all type references, field types, expression ref paths,
 * super types, and activity traversal targets. Tracks cross-file references
 * for dependency graph construction.
 */
export class ReferenceResolver {
  private diagnostics: Diagnostic[] = [];
  private root!: RootSymbolScope;
  private importResolver: ImportResolver;
  private crossFileRefs = new Map<number, Set<number>>();

  constructor(importResolver?: ImportResolver) {
    this.importResolver = importResolver ?? new ImportResolver();
  }

  public resolve(root: RootSymbolScope): ReferenceResolveResult {
    this.diagnostics = [];
    this.root = root;
    this.crossFileRefs = new Map();

    // Walk each compilation unit
    for (const unit of root.units) {
      this.resolveGlobalScope(unit);
    }

    return {
      diagnostics: this.diagnostics,
      crossFileRefs: this.crossFileRefs,
    };
  }

  private resolveGlobalScope(gs: GlobalScope): void {
    for (const child of gs.children) {
      this.resolveNode(child, gs.fileid);
    }
  }

  private resolveNode(node: ScopeChild, fileId: number): void {
    if (node instanceof TypeScope) {
      this.resolveTypeScope(node, fileId);
    } else if (node instanceof PackageScope) {
      for (const child of node.children) {
        this.resolveNode(child, fileId);
      }
    } else if (node instanceof Field) {
      this.resolveFieldType(node, fileId);
    } else if (node instanceof FieldCompRef) {
      this.resolveUserDefinedType(node.type, node, fileId);
    } else if (node instanceof FieldRef) {
      this.resolveUserDefinedType(node.type, node, fileId);
    } else if (node instanceof FieldClaim) {
      this.resolveUserDefinedType(node.type, node, fileId);
    } else if (node instanceof ActionHandleField) {
      if (node.type instanceof DataTypeUserDefined) {
        this.resolveUserDefinedType(node.type, node, fileId);
      }
    } else if (node instanceof FunctionDefinition) {
      // Resolve return type and parameter types
      if (node.proto) {
        if (node.proto.rtype instanceof DataTypeUserDefined) {
          this.resolveUserDefinedType(node.proto.rtype, node, fileId);
        }
        for (const param of node.proto.parameters) {
          if (param.type instanceof DataTypeUserDefined) {
            this.resolveUserDefinedType(param.type, node, fileId);
          }
        }
      }
    }

    // Recurse into scopes
    if (node instanceof Scope) {
      for (const child of node.children) {
        this.resolveNode(child, fileId);
      }
    }
  }

  private resolveTypeScope(node: TypeScope, fileId: number): void {
    // Resolve super type
    if (node.super_t) {
      const resolved = this.resolveTypeIdentifier(node.super_t, fileId);
      if (!resolved) {
        const name = this.typeIdToString(node.super_t);
        const suggestion = this.suggestSimilar(name);
        const hint = suggestion ? `. Did you mean '${suggestion}'?` : '';
        this.reportError(
          node,
          'unresolved-base-type',
          `Cannot resolve base type '${name}'${hint}`,
          fileId,
        );
      } else {
        // Check for circular inheritance
        if (node.name?.id && this.detectCircularInheritance(node)) {
          this.reportError(
            node,
            'circular-inheritance',
            `Circular inheritance detected for type '${node.name.id}'`,
            fileId,
          );
        }
      }
    }
  }

  private resolveFieldType(field: Field, fileId: number): void {
    if (!field.type) return;

    if (field.type instanceof DataTypeUserDefined) {
      this.resolveUserDefinedType(field.type, field, fileId);
    } else if (field.type instanceof DataTypeEnum) {
      if (field.type.tid) {
        this.resolveUserDefinedType(field.type.tid, field, fileId);
      }
    } else if (field.type instanceof DataTypeRef) {
      if (field.type.type) {
        this.resolveUserDefinedType(field.type.type, field, fileId);
      }
    }
  }

  private resolveUserDefinedType(
    udt: DataTypeUserDefined | null,
    context: ScopeChild,
    fileId: number,
  ): void {
    if (!udt?.type_id) return;

    const resolved = this.resolveTypeIdentifier(udt.type_id, fileId);
    if (!resolved) {
      const name = this.typeIdToString(udt.type_id);
      const suggestion = this.suggestSimilar(name);
      const hint = suggestion ? `. Did you mean '${suggestion}'?` : '';
      this.reportError(
        context,
        'undefined-type',
        `Undefined type '${name}'${hint}`,
        fileId,
      );
    }
  }

  /**
   * Resolve a TypeIdentifier to a SymbolScope in the symbol tree.
   * Returns the resolved scope or null if not found.
   */
  public resolveTypeIdentifier(typeId: TypeIdentifier, fileId: number): SymbolScope | null {
    if (typeId.elems.length === 0) return null;

    const name = typeId.elems.map(e => e.id?.id ?? '').join('::');
    const parts = name.split('::');

    // Try lookup from root
    let found = this.lookupQualified(parts, this.root);
    if (found) {
      this.trackCrossFileRef(fileId, found);
      return found;
    }

    // Try each package scope
    for (const [, idx] of this.root.symtab) {
      const pkg = this.root.children[idx];
      if (pkg instanceof SymbolScope) {
        // Try direct lookup
        if (parts.length === 1 && pkg.symtab.has(parts[0])) {
          const childIdx = pkg.symtab.get(parts[0])!;
          const child = pkg.children[childIdx];
          if (child instanceof SymbolScope) {
            this.trackCrossFileRef(fileId, child);
            return child;
          }
        }
        // Try qualified in package
        found = this.lookupQualified(parts, pkg);
        if (found) {
          this.trackCrossFileRef(fileId, found);
          return found;
        }
      }
    }

    return null;
  }

  private lookupQualified(parts: string[], scope: SymbolScope): SymbolScope | null {
    let current: SymbolScope = scope;
    for (const part of parts) {
      if (!current.symtab.has(part)) return null;
      const idx = current.symtab.get(part)!;
      const child = current.children[idx];
      if (!(child instanceof SymbolScope)) return null;
      current = child;
    }
    return current;
  }

  private detectCircularInheritance(node: TypeScope): boolean {
    const visited = new Set<string>();
    let current: TypeScope | null = node;
    const nodeName = node.name?.id;
    if (!nodeName) return false;

    visited.add(nodeName);

    // Follow super_t chain
    while (current?.super_t) {
      const superName = this.typeIdToString(current.super_t);
      if (visited.has(superName)) return true;
      visited.add(superName);

      // Find the super type scope
      const superScope = this.resolveTypeIdentifier(current.super_t, -1);
      if (!superScope?.target || !(superScope.target instanceof TypeScope)) break;
      current = superScope.target;
    }

    return false;
  }

  private trackCrossFileRef(sourceFileId: number, targetScope: SymbolScope): void {
    if (!targetScope.target) return;
    const targetLoc = (targetScope.target as ScopeChild).location;
    if (!targetLoc || targetLoc.fileid < 0) return;

    const targetFileId = targetLoc.fileid;
    if (targetFileId === sourceFileId) return;

    let refs = this.crossFileRefs.get(sourceFileId);
    if (!refs) {
      refs = new Set();
      this.crossFileRefs.set(sourceFileId, refs);
    }
    refs.add(targetFileId);
  }

  private typeIdToString(typeId: TypeIdentifier): string {
    return typeId.elems.map(e => e.id?.id ?? '?').join('::');
  }

  private cachedSymbolNames: string[] | null = null;

  /** Suggest a similar symbol name for an unresolved reference. */
  private suggestSimilar(name: string): string | null {
    if (!this.cachedSymbolNames) {
      this.cachedSymbolNames = collectAllSymbolNames(this.root);
    }
    return findBestMatch(name, this.cachedSymbolNames);
  }

  private reportError(node: ScopeChild, code: string, message: string, fileId: number): void {
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
      fileId,
    });
  }
}
