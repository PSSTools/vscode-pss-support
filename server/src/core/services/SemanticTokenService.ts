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
} from '../ast/generated/index.js';
import { SemanticToken } from '../types/SemanticToken.js';
import { getNodeName } from '../ast/ASTUtils.js';
import { Location } from '../ast/generated/index.js';

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
      pushNameToken(tokens, node, name, TokenType.class, mods);
    }
    // Super type reference
    if (node.super_t) {
      emitTypeIdToken(node.super_t, tokens, TokenType.type);
    }
    return;
  }

  if (node instanceof Component) {
    if (name) {
      pushNameToken(tokens, node, name, TokenType.class, TokenModifier.declaration);
    }
    return;
  }

  if (node instanceof Struct) {
    if (name) {
      pushNameToken(tokens, node, name, TokenType.class, TokenModifier.declaration);
    }
    return;
  }

  if (node instanceof Monitor) {
    if (name) {
      pushNameToken(tokens, node, name, TokenType.class, TokenModifier.declaration);
    }
    return;
  }

  if (node instanceof AnnotationDecl) {
    if (name) {
      pushNameToken(tokens, node, name, TokenType.decorator, TokenModifier.declaration);
    }
    return;
  }

  // Enum declarations
  if (node instanceof EnumDecl) {
    if (name) {
      pushNameToken(tokens, node, name, TokenType.enum, TokenModifier.declaration);
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
      pushNameToken(tokens, node, name, TokenType.variable, mods);
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
      pushNameToken(tokens, node, name, TokenType.variable, TokenModifier.declaration);
    }
    return;
  }

  // Functions
  if (node instanceof FunctionDefinition && node.proto) {
    const funcName = node.proto.name?.id;
    if (funcName) {
      // The prototype's own extent covers the signature; the name node is what
      // should be coloured.
      pushNameToken(
        tokens, node.proto, funcName,
        TokenType.function,
        TokenModifier.declaration | TokenModifier.definition,
      );
    }
    // Parameters. A parameter's own extent covers `int arg_a`, type and all,
    // so colouring it would swallow the type keyword and violate the
    // one-token-one-identifier rule; pushNameToken picks the identifier.
    for (const param of node.proto.parameters) {
      const paramName = param.name?.id;
      if (paramName) {
        pushNameToken(
          tokens, param, paramName,
          TokenType.parameter,
          TokenModifier.declaration,
        );
      }
    }
    return;
  }

  // Annotations
  if (node instanceof Annotation && node.type) {
    emitTypeIdToken(node.type, tokens, TokenType.decorator);
    return;
  }

  // Package. The name is a qualified path (`id: ExprId[]`), not a single
  // `name` node, so each segment of `a::b::c` gets its own token.
  if (node instanceof PackageScope) {
    for (const segment of node.id) {
      if (segment.location.lineno < 0) continue;
      tokens.push({
        line: segment.location.lineno - 1,
        startChar: segment.location.linepos,
        length: segment.location.extent > 0 ? segment.location.extent : segment.id.length,
        tokenType: TokenType.namespace,
        tokenModifiers: TokenModifier.declaration,
      });
    }
    return;
  }
}

/**
 * Emit a token covering a declaration's *name*, not its whole declaration.
 *
 * `node.location.extent` spans the entire declaration including its body, so
 * using it produced tokens hundreds of characters long -- one `namespace` token
 * covering a whole package, swallowing every token inside it. The LSP also
 * forbids a token from spanning lines, which such a token always does.
 *
 * Named nodes carry an accurate location on `name`; when that is missing the
 * length falls back to the identifier's own length, never to the node extent.
 */
function pushNameToken(
  tokens: SemanticToken[],
  node: { location: Location; name?: { location?: Location } | null },
  name: string,
  tokenType: TokenType,
  tokenModifiers: number,
): void {
  const nameLoc = node.name?.location;

  if (nameLoc && nameLoc.lineno >= 0) {
    tokens.push({
      line: nameLoc.lineno - 1,
      startChar: nameLoc.linepos,
      length: nameLoc.extent > 0 ? nameLoc.extent : name.length,
      tokenType,
      tokenModifiers,
    });
    return;
  }

  const loc = node.location;
  if (loc.lineno < 0) return;
  tokens.push({
    line: loc.lineno - 1,
    startChar: loc.linepos,
    length: name.length,
    tokenType,
    tokenModifiers,
  });
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
