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
  FunctionDefinition,
  FunctionPrototype,
  FunctionParamDecl,
  ActivityDecl,
  ExecBlock,
  PackageScope,
  AnnotationDecl,
  Monitor,
  TypedefDeclaration,
  DataTypeUserDefined,
  Annotation,
  GlobalScope,
  flags,
  enums,
} from '../ast/generated';
import { SemanticToken } from '../types/SemanticToken';
import { getNodeName } from '../ast/ASTUtils';

// Token type indices (must match the legend registered with the LSP)
export enum TokenType {
  type = 0,
  class = 1,
  enum = 2,
  enumMember = 3,
  function = 4,
  variable = 5,
  parameter = 6,
  property = 7,
  keyword = 8,
  comment = 9,
  decorator = 10,
  namespace = 11,
}

// Token modifier bit flags
export enum TokenModifier {
  declaration = 1 << 0,
  definition = 1 << 1,
  readonly = 1 << 2,
  static = 1 << 3,
  abstract = 1 << 4,
  deprecated = 1 << 5,
  modification = 1 << 6, // rand
}

export const TOKEN_TYPES = [
  'type', 'class', 'enum', 'enumMember', 'function',
  'variable', 'parameter', 'property', 'keyword',
  'comment', 'decorator', 'namespace',
];

export const TOKEN_MODIFIERS = [
  'declaration', 'definition', 'readonly', 'static',
  'abstract', 'deprecated', 'modification',
];

/**
 * Walk the AST and produce semantic tokens for AST-aware syntax highlighting.
 */
export function getSemanticTokens(ast: GlobalScope): SemanticToken[] {
  const tokens: SemanticToken[] = [];
  collectTokens(ast, tokens);
  // Sort by position (line then character)
  tokens.sort((a, b) => a.line - b.line || a.startChar - b.startChar);
  return tokens;
}

function collectTokens(scope: Scope, tokens: SemanticToken[]): void {
  for (const child of scope.children) {
    emitTokensForNode(child, tokens);
    if (child instanceof Scope) {
      collectTokens(child, tokens);
    }
  }
}

function emitTokensForNode(node: ScopeChild, tokens: SemanticToken[]): void {
  const loc = node.location;
  if (loc.lineno < 0) return;

  const line = loc.lineno - 1;
  const char = loc.linepos;
  const name = getNodeName(node);

  // Type declarations
  if (node instanceof Action) {
    if (name) {
      let mods = TokenModifier.declaration;
      if (node.is_abstract) mods |= TokenModifier.abstract;
      tokens.push({ line, startChar: char, length: loc.extent > 0 ? loc.extent : name.length, tokenType: TokenType.class, tokenModifiers: mods });
    }
    // Super type reference
    if (node.super_t) {
      emitTypeIdToken(node.super_t, tokens, TokenType.type);
    }
    return;
  }

  if (node instanceof Component) {
    if (name) {
      tokens.push({ line, startChar: char, length: loc.extent > 0 ? loc.extent : name.length, tokenType: TokenType.class, tokenModifiers: TokenModifier.declaration });
    }
    return;
  }

  if (node instanceof Struct) {
    if (name) {
      tokens.push({ line, startChar: char, length: loc.extent > 0 ? loc.extent : name.length, tokenType: TokenType.class, tokenModifiers: TokenModifier.declaration });
    }
    return;
  }

  if (node instanceof Monitor) {
    if (name) {
      tokens.push({ line, startChar: char, length: loc.extent > 0 ? loc.extent : name.length, tokenType: TokenType.class, tokenModifiers: TokenModifier.declaration });
    }
    return;
  }

  if (node instanceof AnnotationDecl) {
    if (name) {
      tokens.push({ line, startChar: char, length: loc.extent > 0 ? loc.extent : name.length, tokenType: TokenType.decorator, tokenModifiers: TokenModifier.declaration });
    }
    return;
  }

  // Enum declarations
  if (node instanceof EnumDecl) {
    if (name) {
      tokens.push({ line, startChar: char, length: loc.extent > 0 ? loc.extent : name.length, tokenType: TokenType.enum, tokenModifiers: TokenModifier.declaration });
    }
    // Enum items
    for (const item of node.items) {
      const itemName = item.name?.id;
      const itemLoc = item.location;
      if (itemName && itemLoc.lineno >= 0) {
        tokens.push({
          line: itemLoc.lineno - 1,
          startChar: itemLoc.linepos,
          length: itemLoc.extent > 0 ? itemLoc.extent : itemName.length,
          tokenType: TokenType.enumMember,
          tokenModifiers: TokenModifier.declaration,
        });
      }
    }
    return;
  }

  // Fields
  if (node instanceof Field) {
    if (name) {
      let mods = TokenModifier.declaration;
      if (node.attr & flags.FieldAttr.Rand) mods |= TokenModifier.modification;
      if (node.attr & flags.FieldAttr.Const) mods |= TokenModifier.readonly;
      if (node.attr & flags.FieldAttr.Static) mods |= TokenModifier.static;
      tokens.push({ line, startChar: char, length: loc.extent > 0 ? loc.extent : name.length, tokenType: TokenType.variable, tokenModifiers: mods });
    }
    // Type reference
    if (node.type instanceof DataTypeUserDefined) {
      emitTypeIdToken(node.type.type_id, tokens, TokenType.type);
    }
    return;
  }

  if (node instanceof FieldCompRef || node instanceof FieldRef ||
      node instanceof FieldClaim || node instanceof ActionHandleField) {
    if (name) {
      tokens.push({ line, startChar: char, length: loc.extent > 0 ? loc.extent : name.length, tokenType: TokenType.variable, tokenModifiers: TokenModifier.declaration });
    }
    return;
  }

  // Functions
  if (node instanceof FunctionDefinition && node.proto) {
    const funcName = node.proto.name?.id;
    if (funcName) {
      const funcLoc = node.proto.location ?? loc;
      tokens.push({
        line: funcLoc.lineno >= 0 ? funcLoc.lineno - 1 : line,
        startChar: funcLoc.linepos >= 0 ? funcLoc.linepos : char,
        length: funcLoc.extent > 0 ? funcLoc.extent : funcName.length,
        tokenType: TokenType.function,
        tokenModifiers: TokenModifier.declaration | TokenModifier.definition,
      });
    }
    // Parameters
    for (const param of node.proto.parameters) {
      const paramName = param.name?.id;
      const paramLoc = param.location;
      if (paramName && paramLoc.lineno >= 0) {
        tokens.push({
          line: paramLoc.lineno - 1,
          startChar: paramLoc.linepos,
          length: paramLoc.extent > 0 ? paramLoc.extent : paramName.length,
          tokenType: TokenType.parameter,
          tokenModifiers: TokenModifier.declaration,
        });
      }
    }
    return;
  }

  // Annotations
  if (node instanceof Annotation && node.type) {
    emitTypeIdToken(node.type, tokens, TokenType.decorator);
    return;
  }

  // Package
  if (node instanceof PackageScope) {
    tokens.push({ line, startChar: char, length: loc.extent > 0 ? loc.extent : 7, tokenType: TokenType.namespace, tokenModifiers: TokenModifier.declaration });
    return;
  }
}

function emitTypeIdToken(
  typeId: { elems: Array<{ id: { id: string; location: { lineno: number; linepos: number; extent: number } } | null }> } | null,
  tokens: SemanticToken[],
  tokenType: TokenType,
): void {
  if (!typeId) return;
  for (const elem of typeId.elems) {
    if (elem.id && elem.id.location.lineno >= 0) {
      tokens.push({
        line: elem.id.location.lineno - 1,
        startChar: elem.id.location.linepos,
        length: elem.id.location.extent > 0 ? elem.id.location.extent : elem.id.id.length,
        tokenType,
        tokenModifiers: 0,
      });
    }
  }
}
