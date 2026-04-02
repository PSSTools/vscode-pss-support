import {
  GlobalScope,
  Scope,
  ScopeChild,
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
  PackageScope,
  TypeScope,
  AnnotationDecl,
  TypedefDeclaration,
  FunctionDefinition,
  FunctionPrototype,
  Monitor,
  ExtendType,
  ExtendEnum,
  RootSymbolScope,
  SymbolScope,
  SymbolTypeScope,
  SymbolEnumScope,
  SymbolFunctionScope,
  SymbolExtendScope,
  SymbolChildrenScope,
  ExprId,
} from '../ast/generated';
import { Diagnostic, DiagnosticSeverity } from '../types/Diagnostic';
import { getNodeName } from '../ast/ASTUtils';

export interface SymbolTableResult {
  root: RootSymbolScope;
  diagnostics: Diagnostic[];
}

/**
 * Pass 1: Walk GlobalScope ASTs, register named declarations in a
 * RootSymbolScope, merge PackageScope nodes, detect duplicate symbols.
 */
export class SymbolTableBuilder {
  private root: RootSymbolScope;
  private diagnostics: Diagnostic[] = [];
  // Track packages by qualified name for merging
  private packageMap = new Map<string, SymbolScope>();

  constructor() {
    this.root = new RootSymbolScope();
  }

  public build(scopes: GlobalScope[]): SymbolTableResult {
    this.root.units = scopes;

    for (const gs of scopes) {
      this.root.filenames.set(gs.fileid, gs.filename);
      this.visitScope(gs, this.root);
    }

    return { root: this.root, diagnostics: this.diagnostics };
  }

  private visitScope(scope: Scope, parent: SymbolScope): void {
    for (const child of scope.children) {
      this.visitChild(child, parent);
    }
  }

  private visitChild(child: ScopeChild, parent: SymbolScope): void {
    if (child instanceof PackageScope) {
      this.visitPackage(child, parent);
    } else if (child instanceof Action) {
      this.registerTypeScope(child, parent, 'action');
    } else if (child instanceof Component) {
      this.registerTypeScope(child, parent, 'component');
    } else if (child instanceof Struct) {
      this.registerTypeScope(child, parent, 'struct');
    } else if (child instanceof Monitor) {
      this.registerTypeScope(child, parent, 'monitor');
    } else if (child instanceof AnnotationDecl) {
      this.registerTypeScope(child, parent, 'annotation');
    } else if (child instanceof EnumDecl) {
      this.registerEnum(child, parent);
    } else if (child instanceof FunctionDefinition) {
      this.registerFunction(child, parent);
    } else if (child instanceof TypedefDeclaration) {
      this.registerTypedef(child, parent);
    } else if (child instanceof ExtendType) {
      this.registerExtend(child, parent);
    } else if (child instanceof ExtendEnum) {
      this.registerExtendEnum(child, parent);
    }
    // Fields, imports, exec blocks, etc. are not registered in the symbol table
    // at this pass level - they'll be handled in later passes.
  }

  private visitPackage(pkg: PackageScope, parent: SymbolScope): void {
    const qname = pkg.id.map(e => e.id).join('::');
    let symScope = this.packageMap.get(qname);

    if (!symScope) {
      // First occurrence of this package - create a symbol scope
      symScope = new SymbolScope();
      symScope.name = qname;
      symScope.target = pkg;
      symScope.upper = parent;
      parent.children.push(symScope as any);
      const idx = parent.children.length - 1;
      parent.symtab.set(qname, idx);
      this.packageMap.set(qname, symScope);
    } else {
      // Merge: link sibling packages
      // The symScope already exists, just process children into it
    }

    // Visit package body items
    for (const child of pkg.children) {
      this.visitChild(child, symScope);
    }
  }

  private registerTypeScope(node: TypeScope, parent: SymbolScope, kind: string): void {
    const name = getNodeName(node);
    if (!name) return;

    // Check for duplicates
    if (parent.symtab.has(name)) {
      this.reportDuplicate(name, kind, node);
      return;
    }

    const sym = new SymbolTypeScope();
    sym.name = name;
    sym.target = node;
    sym.upper = parent;

    parent.children.push(sym as any);
    parent.symtab.set(name, parent.children.length - 1);

    // Recursively register children (nested types, etc.)
    if (node instanceof Scope) {
      for (const child of node.children) {
        this.visitChild(child, sym);
        // Also register fields in symtab for duplicate detection
        this.registerFieldIfNamed(child, sym);
      }
    }
  }

  private registerEnum(node: EnumDecl, parent: SymbolScope): void {
    const name = getNodeName(node);
    if (!name) return;

    if (parent.symtab.has(name)) {
      this.reportDuplicate(name, 'enum', node);
      return;
    }

    const sym = new SymbolEnumScope();
    sym.name = name;
    sym.target = node;
    sym.upper = parent;

    // Register enum items in the scope's symtab
    for (const item of node.items) {
      const itemName = item.name?.id;
      if (itemName) {
        sym.children.push(item);
        sym.symtab.set(itemName, sym.children.length - 1);
      }
    }

    parent.children.push(sym as any);
    parent.symtab.set(name, parent.children.length - 1);
  }

  private registerFunction(node: FunctionDefinition, parent: SymbolScope): void {
    const name = node.proto?.name?.id;
    if (!name) return;

    // Functions can be overloaded, so we allow multiple registrations
    let sym: SymbolFunctionScope;
    if (parent.symtab.has(name)) {
      const idx = parent.symtab.get(name)!;
      const existing = parent.children[idx];
      if (existing instanceof SymbolFunctionScope) {
        sym = existing;
        if (node.proto) sym.prototypes.push(node.proto);
        return;
      }
      // Name collision with non-function
      this.reportDuplicate(name, 'function', node);
      return;
    }

    sym = new SymbolFunctionScope();
    sym.name = name;
    sym.target = node;
    sym.upper = parent;
    if (node.proto) sym.prototypes.push(node.proto);

    parent.children.push(sym as any);
    parent.symtab.set(name, parent.children.length - 1);
  }

  private registerTypedef(node: TypedefDeclaration, parent: SymbolScope): void {
    const name = getNodeName(node);
    if (!name) return;

    if (parent.symtab.has(name)) {
      this.reportDuplicate(name, 'typedef', node);
      return;
    }

    const sym = new SymbolScope();
    sym.name = name;
    sym.target = node;
    sym.upper = parent;

    parent.children.push(sym as any);
    parent.symtab.set(name, parent.children.length - 1);
  }

  private registerExtend(node: ExtendType, parent: SymbolScope): void {
    const sym = new SymbolExtendScope();
    sym.target = node;
    sym.upper = parent;

    // Extend scopes are added but not registered by name in symtab
    parent.children.push(sym as any);

    // Visit extend body
    for (const child of node.children) {
      this.visitChild(child, sym);
    }
  }

  private registerExtendEnum(node: ExtendEnum, parent: SymbolScope): void {
    const sym = new SymbolExtendScope();
    sym.target = node;
    sym.upper = parent;
    parent.children.push(sym as any);
  }

  private registerFieldIfNamed(child: ScopeChild, parent: SymbolScope): void {
    let fieldName: string | null = null;
    if (child instanceof Field) fieldName = child.name?.id ?? null;
    else if (child instanceof FieldCompRef) fieldName = child.name?.id ?? null;
    else if (child instanceof FieldRef) fieldName = child.name?.id ?? null;
    else if (child instanceof FieldClaim) fieldName = child.name?.id ?? null;
    else if (child instanceof ActionHandleField) fieldName = child.name?.id ?? null;

    if (fieldName && !parent.symtab.has(fieldName)) {
      parent.children.push(child);
      parent.symtab.set(fieldName, parent.children.length - 1);
    }
  }

  private reportDuplicate(name: string, kind: string, node: ScopeChild): void {
    const loc = node.location;
    if (loc.lineno < 0) return;
    this.diagnostics.push({
      range: {
        start: { line: loc.lineno - 1, character: loc.linepos },
        end: { line: loc.lineno - 1, character: loc.linepos + name.length },
      },
      severity: DiagnosticSeverity.Error,
      code: 'duplicate-symbol',
      source: 'pss',
      message: `Duplicate ${kind} declaration: '${name}'`,
      fileId: loc.fileid >= 0 ? loc.fileid : undefined,
    });
  }
}
