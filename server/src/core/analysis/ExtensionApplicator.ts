import {
  ScopeChild,
  Scope,
  ExtendType,
  ExtendEnum,
  EnumDecl,
  EnumItem,
  TypeScope,
  NamedScope,
  NamedScopeChild,
  Action,
  Component,
  Struct,
  Monitor,
  RootSymbolScope,
  SymbolScope,
  SymbolTypeScope,
  SymbolEnumScope,
  SymbolExtendScope,
  TypeIdentifier,
  enums,
} from '../ast/generated';
import { Diagnostic, DiagnosticSeverity } from '../types/Diagnostic';
import { getNodeName } from '../ast/ASTUtils';
import { collectAllSymbolNames, findBestMatch } from './SpellSuggest';

export interface ExtensionResult {
  diagnostics: Diagnostic[];
}

/**
 * Pass 2: Traverse the symbol tree looking for SymbolExtendScope entries.
 * For each, resolve the target TypeIdentifier, locate the target scope,
 * and merge extension children into the target.
 */
export class ExtensionApplicator {
  private diagnostics: Diagnostic[] = [];
  private root!: RootSymbolScope;

  public apply(root: RootSymbolScope): ExtensionResult {
    this.diagnostics = [];
    this.root = root;
    this.cachedSymbolNames = null;
    this.walkScope(root);
    return { diagnostics: this.diagnostics };
  }

  private walkScope(scope: SymbolScope): void {
    // Collect extend scopes first to avoid modifying while iterating
    const extendScopes: SymbolExtendScope[] = [];
    for (const child of scope.children) {
      if (child instanceof SymbolExtendScope) {
        extendScopes.push(child);
      } else if (child instanceof SymbolScope) {
        this.walkScope(child);
      }
    }

    for (const ext of extendScopes) {
      this.applyExtension(ext, scope);
    }
  }

  private applyExtension(ext: SymbolExtendScope, parentScope: SymbolScope): void {
    const target = ext.target;
    if (!target) return;

    if (target instanceof ExtendType) {
      this.applyExtendType(ext, target, parentScope);
    } else if (target instanceof ExtendEnum) {
      this.applyExtendEnum(target, parentScope);
    }
  }

  private applyExtendType(
    ext: SymbolExtendScope,
    node: ExtendType,
    parentScope: SymbolScope,
  ): void {
    const typeId = node.target;
    if (!typeId) {
      this.reportError(node, 'extend-missing-target', 'Type extension has no target type');
      return;
    }

    const targetName = this.resolveTypeIdentifierName(typeId);
    if (!targetName) {
      this.reportError(node, 'extend-missing-target', 'Type extension has no target type name');
      return;
    }

    const targetScope = this.findTypeScope(targetName, parentScope);
    if (!targetScope) {
      this.reportError(
        node,
        'unresolved-extend-target',
        `Cannot resolve extension target type '${targetName}'${this.suggestHint(targetName)}`,
      );
      return;
    }

    // Validate kind match
    if (targetScope.target instanceof TypeScope) {
      const targetKind = this.getTypeKind(targetScope.target);
      const extKind = this.extendTargetToKind(node.kind);
      if (targetKind && extKind && targetKind !== extKind) {
        this.reportError(
          node,
          'extend-kind-mismatch',
          `Cannot extend ${targetKind} '${targetName}' as ${extKind}`,
        );
        return;
      }
    }

    // Merge SymbolScope children from the extension scope (actions, structs,
    // etc.) so that qualified lookup (e.g. mycomp_c::A) finds a SymbolScope
    // rather than a raw AST node.
    for (const symChild of ext.children) {
      if (!(symChild instanceof SymbolScope)) continue;
      const childName = symChild.name;
      if (childName && targetScope.symtab.has(childName)) {
        this.reportError(
          (symChild.target ?? node) as ScopeChild,
          'extend-duplicate-member',
          `Extension adds duplicate member '${childName}' to type '${targetName}'`,
        );
        continue;
      }
      symChild.upper = targetScope;
      targetScope.children.push(symChild as any);
      if (childName) {
        targetScope.symtab.set(childName, targetScope.children.length - 1);
      }
    }

    // Merge non-type AST children (fields, exec blocks, etc.) that were not
    // registered as SymbolScope entries by the SymbolTableBuilder.
    for (const child of node.children) {
      const childName = this.getChildName(child);
      // Skip children already merged via SymbolScope above
      if (childName && ext.symtab.has(childName)) continue;
      if (childName && targetScope.symtab.has(childName)) {
        this.reportError(
          child,
          'extend-duplicate-member',
          `Extension adds duplicate member '${childName}' to type '${targetName}'`,
        );
        continue;
      }
      targetScope.children.push(child);
      if (childName) {
        targetScope.symtab.set(childName, targetScope.children.length - 1);
      }
    }
  }

  private applyExtendEnum(node: ExtendEnum, parentScope: SymbolScope): void {
    const typeId = node.target;
    if (!typeId) {
      this.reportError(node, 'extend-missing-target', 'Enum extension has no target enum');
      return;
    }

    const targetName = this.resolveTypeIdentifierName(typeId);
    if (!targetName) {
      this.reportError(node, 'extend-missing-target', 'Enum extension has no target enum name');
      return;
    }

    const targetScope = this.findTypeScope(targetName, parentScope);
    if (!targetScope) {
      this.reportError(
        node,
        'unresolved-extend-target',
        `Cannot resolve extension target enum '${targetName}'${this.suggestHint(targetName)}`,
      );
      return;
    }

    if (!(targetScope instanceof SymbolEnumScope)) {
      this.reportError(
        node,
        'extend-kind-mismatch',
        `'${targetName}' is not an enum and cannot be extended with enum items`,
      );
      return;
    }

    for (const item of node.items) {
      const itemName = item.name?.id;
      if (itemName && targetScope.symtab.has(itemName)) {
        this.reportError(
          item,
          'extend-duplicate-member',
          `Extension adds duplicate enum item '${itemName}' to enum '${targetName}'`,
        );
        continue;
      }

      targetScope.children.push(item);
      if (itemName) {
        targetScope.symtab.set(itemName, targetScope.children.length - 1);
      }
    }
  }

  private resolveTypeIdentifierName(typeId: TypeIdentifier): string | null {
    if (typeId.elems.length === 0) return null;
    return typeId.elems.map(e => e.id?.id ?? '').join('::');
  }

  /** Walk up the scope hierarchy to find a named type scope. */
  private findTypeScope(name: string, scope: SymbolScope): SymbolScope | null {
    const parts = name.split('::');
    let current: SymbolScope | null = scope;
    while (current) {
      const found = this.lookupPath(parts, current);
      if (found) return found;
      current = current.upper ?? null;
    }
    return null;
  }

  private lookupPath(parts: string[], scope: SymbolScope): SymbolScope | null {
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

  private getTypeKind(node: TypeScope): string | null {
    if (node instanceof Action) return 'action';
    if (node instanceof Component) return 'component';
    if (node instanceof Monitor) return 'monitor';
    if (node instanceof Struct) {
      switch (node.kind) {
        case enums.StructKind.Buffer: return 'buffer';
        case enums.StructKind.Resource: return 'resource';
        case enums.StructKind.State: return 'state';
        case enums.StructKind.Stream: return 'stream';
        default: return 'struct';
      }
    }
    return null;
  }

  private extendTargetToKind(kind: enums.ExtendTargetE): string | null {
    const map: Record<number, string> = {
      [enums.ExtendTargetE.Action]: 'action',
      [enums.ExtendTargetE.Component]: 'component',
      [enums.ExtendTargetE.Struct]: 'struct',
      [enums.ExtendTargetE.Buffer]: 'buffer',
      [enums.ExtendTargetE.Resource]: 'resource',
      [enums.ExtendTargetE.State]: 'state',
      [enums.ExtendTargetE.Stream]: 'stream',
    };
    return map[kind] ?? null;
  }

  private getChildName(child: ScopeChild | unknown): string | null {
    if (child instanceof NamedScopeChild) return child.name?.id ?? null;
    if (child instanceof NamedScope) return child.name?.id ?? null;
    return null;
  }

  private cachedSymbolNames: string[] | null = null;

  private suggestHint(name: string): string {
    const suggestion = this.suggestSimilar(name);
    return suggestion ? `. Did you mean '${suggestion}'?` : '';
  }

  private suggestSimilar(name: string): string | null {
    if (!this.cachedSymbolNames) {
      this.cachedSymbolNames = collectAllSymbolNames(this.root);
    }
    return findBestMatch(name, this.cachedSymbolNames);
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
