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
  EnumDecl,
  PackageScope,
  TypeScope,
  AnnotationDecl,
  TypedefDeclaration,
  FunctionDefinition,
  ActivityDecl,
  ExecBlock,
  enums,
  flags,
} from '../ast/generated';
import {
  DocumentSymbol,
  SymbolKind,
} from '../types/DocumentSymbol';
import { SourceRange } from '../types/SourceRange';
import { getNodeName } from '../ast/ASTUtils';
import { Location } from '../ast/generated/structs';

function locationToRange(loc: Location, endLoc?: Location): SourceRange {
  const startLine = Math.max(0, loc.lineno - 1);
  const startChar = Math.max(0, loc.linepos);
  const endLine = endLoc ? Math.max(0, endLoc.lineno - 1) : startLine;
  const endChar = endLoc ? Math.max(0, endLoc.linepos) : startChar + Math.max(1, loc.extent);
  return {
    start: { line: startLine, character: startChar },
    end: { line: endLine, character: endChar },
  };
}

function getSymbolKind(node: ScopeChild): SymbolKind | null {
  if (node instanceof Action) return SymbolKind.Action;
  if (node instanceof Component) return SymbolKind.Component;
  if (node instanceof Struct) {
    switch (node.kind) {
      case enums.StructKind.Buffer: return SymbolKind.Buffer;
      case enums.StructKind.Stream: return SymbolKind.Stream;
      case enums.StructKind.State: return SymbolKind.State;
      case enums.StructKind.Resource: return SymbolKind.Resource;
      default: return SymbolKind.Struct;
    }
  }
  if (node instanceof EnumDecl) return SymbolKind.Enum;
  if (node instanceof PackageScope) return SymbolKind.Package;
  if (node instanceof Field) return SymbolKind.Field;
  if (node instanceof AnnotationDecl) return SymbolKind.Struct; // No specific kind
  if (node instanceof TypedefDeclaration) return SymbolKind.TypeDef;
  if (node instanceof FunctionDefinition) return SymbolKind.Function;
  if (node instanceof ActivityDecl) return SymbolKind.Activity;
  if (node instanceof ExecBlock) return SymbolKind.ExecBlock;
  return null;
}

function nodeToSymbol(node: ScopeChild): DocumentSymbol | null {
  const kind = getSymbolKind(node);
  if (kind === null) return null;

  const name = getNodeName(node);
  if (!name && !(node instanceof PackageScope)) return null;

  const loc = node.location;
  if (loc.lineno < 0) return null;

  let displayName = name ?? '(unnamed)';
  if (node instanceof PackageScope && node.id.length > 0) {
    displayName = node.id.map(e => e.id).join('::');
  }

  const range = locationToRange(loc);
  const sym: DocumentSymbol = {
    name: displayName,
    kind,
    range,
    selectionRange: range,
  };

  // Add detail
  if (node instanceof Action && node.is_abstract) {
    sym.detail = 'abstract';
  }
  if (node instanceof Field) {
    const rand = (node.attr & flags.FieldAttr.Rand) ? 'rand ' : '';
    sym.detail = rand ? 'rand' : undefined;
  }

  // Recursively add children
  if (node instanceof Scope) {
    const childSymbols: DocumentSymbol[] = [];
    for (const child of node.children) {
      const childSym = nodeToSymbol(child);
      if (childSym) childSymbols.push(childSym);
    }
    if (childSymbols.length > 0) {
      sym.children = childSymbols;
    }
  }

  return sym;
}

/**
 * Produces DocumentSymbol tree from an AST for the outline view.
 */
export function getDocumentSymbols(ast: GlobalScope): DocumentSymbol[] {
  const symbols: DocumentSymbol[] = [];
  for (const child of ast.children) {
    const sym = nodeToSymbol(child);
    if (sym) symbols.push(sym);
  }
  return symbols;
}

/**
 * Search workspace symbols matching a query string with fuzzy matching.
 */
export function getWorkspaceSymbols(
  query: string,
  allFileAsts: Map<string, GlobalScope>,
): DocumentSymbol[] {
  const results: DocumentSymbol[] = [];
  const lowerQuery = query.toLowerCase();

  for (const [, ast] of allFileAsts) {
    const symbols = getDocumentSymbols(ast);
    collectMatchingSymbols(symbols, lowerQuery, results);
  }

  return results;
}

function collectMatchingSymbols(
  symbols: DocumentSymbol[],
  query: string,
  results: DocumentSymbol[],
): void {
  for (const sym of symbols) {
    if (query === '' || sym.name.toLowerCase().includes(query)) {
      results.push(sym);
    }
    if (sym.children) {
      collectMatchingSymbols(sym.children, query, results);
    }
  }
}
