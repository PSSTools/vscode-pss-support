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
  ActivityDecl,
  ExecBlock,
  PackageScope,
  PackageImportStmt,
  ExtendType,
  ExtendEnum,
  AnnotationDecl,
  Monitor,
  TypedefDeclaration,
  GlobalScope,
  flags,
  enums,
} from '../ast/generated';
import { TextEdit } from '../types/TextEdit';
import { SourceRange } from '../types/SourceRange';
import { IConfiguration } from '../io/IConfiguration';
import { getNodeName, getNodeSignature } from '../ast/ASTUtils';

export interface FormatOptions {
  indentSize: number;
  insertFinalNewline: boolean;
}

const DEFAULT_OPTIONS: FormatOptions = {
  indentSize: 4,
  insertFinalNewline: true,
};

/**
 * AST-driven formatter. Rebuilds the source text from the AST with
 * normalized indentation, brace placement, and blank lines.
 */
export function formatDocument(
  source: string,
  ast: GlobalScope,
  config?: IConfiguration,
): TextEdit[] {
  const opts = resolveOptions(config);
  const formatted = formatScope(ast, 0, opts);

  if (formatted === source) return [];

  return [{
    range: {
      start: { line: 0, character: 0 },
      end: { line: source.split('\n').length, character: 0 },
    },
    newText: formatted,
  }];
}

/**
 * Format a range within a document. Falls back to full document formatting.
 */
export function formatRange(
  source: string,
  range: SourceRange,
  ast: GlobalScope,
  config?: IConfiguration,
): TextEdit[] {
  // For now, format the full document
  return formatDocument(source, ast, config);
}

function resolveOptions(config?: IConfiguration): FormatOptions {
  if (!config) return DEFAULT_OPTIONS;
  return {
    indentSize: config.get('pss.format.indentSize', DEFAULT_OPTIONS.indentSize),
    insertFinalNewline: config.get('pss.format.insertFinalNewline', DEFAULT_OPTIONS.insertFinalNewline),
  };
}

function formatScope(scope: GlobalScope, depth: number, opts: FormatOptions): string {
  const lines: string[] = [];

  for (let i = 0; i < scope.children.length; i++) {
    const child = scope.children[i];
    const text = formatChild(child, depth, opts);
    if (text !== null) {
      // Add blank line between top-level declarations
      if (lines.length > 0 && isTopLevelDecl(child)) {
        lines.push('');
      }
      lines.push(text);
    }
  }

  let result = lines.join('\n');
  if (opts.insertFinalNewline && result.length > 0 && !result.endsWith('\n')) {
    result += '\n';
  }
  return result;
}

function formatChild(node: ScopeChild, depth: number, opts: FormatOptions): string | null {
  const indent = ' '.repeat(depth * opts.indentSize);
  const innerIndent = ' '.repeat((depth + 1) * opts.indentSize);

  if (node instanceof PackageScope) {
    return formatPackage(node, depth, opts);
  }

  if (node instanceof Action) {
    return formatAction(node, depth, opts);
  }

  if (node instanceof Component) {
    return formatTypeDecl('component', node, depth, opts);
  }

  if (node instanceof Struct) {
    const kind = enums.StructKind[node.kind]?.toLowerCase() ?? 'struct';
    return formatTypeDecl(kind, node, depth, opts);
  }

  if (node instanceof Monitor) {
    return formatTypeDecl('monitor', node, depth, opts);
  }

  if (node instanceof AnnotationDecl) {
    return formatTypeDecl('annotation', node, depth, opts);
  }

  if (node instanceof EnumDecl) {
    return formatEnum(node, depth, opts);
  }

  if (node instanceof Field) {
    return formatField(node, indent);
  }

  if (node instanceof FieldCompRef) {
    const name = node.name?.id ?? '?';
    const typeName = node.type?.type_id?.elems.map(e => e.id?.id).join('::') ?? '?';
    return `${indent}${typeName} ${name};`;
  }

  if (node instanceof FieldRef) {
    const name = node.name?.id ?? '?';
    const dir = node.is_input ? 'input' : 'output';
    const typeName = node.type?.type_id?.elems.map(e => e.id?.id).join('::') ?? '?';
    return `${indent}${dir} ${typeName} ${name};`;
  }

  if (node instanceof FieldClaim) {
    const name = node.name?.id ?? '?';
    const kind = node.is_lock ? 'lock' : 'share';
    const typeName = node.type?.type_id?.elems.map(e => e.id?.id).join('::') ?? '?';
    return `${indent}${kind} ${typeName} ${name};`;
  }

  if (node instanceof PackageImportStmt) {
    return formatImport(node, indent);
  }

  if (node instanceof ExtendType) {
    return formatExtendType(node, depth, opts);
  }

  if (node instanceof ExtendEnum) {
    return formatExtendEnum(node, depth, opts);
  }

  if (node instanceof TypedefDeclaration) {
    const name = getNodeName(node) ?? '?';
    return `${indent}typedef ${name};`;
  }

  if (node instanceof FunctionDefinition && node.proto) {
    const name = node.proto.name?.id ?? '?';
    return `${indent}function ${name}();`;
  }

  // Fallback: skip unknown nodes
  return null;
}

function formatPackage(pkg: PackageScope, depth: number, opts: FormatOptions): string {
  const indent = ' '.repeat(depth * opts.indentSize);
  const path = pkg.id.map(e => e.id).join('::');
  const lines = [`${indent}package ${path} {`];

  for (const child of pkg.children) {
    const text = formatChild(child, depth + 1, opts);
    if (text !== null) lines.push(text);
  }

  lines.push(`${indent}}`);
  return lines.join('\n');
}

function formatAction(action: Action, depth: number, opts: FormatOptions): string {
  const indent = ' '.repeat(depth * opts.indentSize);
  const abs = action.is_abstract ? 'abstract ' : '';
  const name = action.name?.id ?? '?';
  const superPart = action.super_t
    ? ' : ' + action.super_t.elems.map(e => e.id?.id).join('::')
    : '';
  const lines = [`${indent}${abs}action ${name}${superPart} {`];

  for (const child of action.children) {
    const text = formatChild(child, depth + 1, opts);
    if (text !== null) lines.push(text);
  }

  lines.push(`${indent}}`);
  return lines.join('\n');
}

function formatTypeDecl(keyword: string, node: TypeScope, depth: number, opts: FormatOptions): string {
  const indent = ' '.repeat(depth * opts.indentSize);
  const name = node.name?.id ?? '?';
  const superPart = node.super_t
    ? ' : ' + node.super_t.elems.map(e => e.id?.id).join('::')
    : '';
  const lines = [`${indent}${keyword} ${name}${superPart} {`];

  if (node instanceof Scope) {
    for (const child of node.children) {
      const text = formatChild(child, depth + 1, opts);
      if (text !== null) lines.push(text);
    }
  }

  lines.push(`${indent}}`);
  return lines.join('\n');
}

function formatEnum(node: EnumDecl, depth: number, opts: FormatOptions): string {
  const indent = ' '.repeat(depth * opts.indentSize);
  const innerIndent = ' '.repeat((depth + 1) * opts.indentSize);
  const name = node.name?.id ?? '?';

  if (node.items.length === 0) {
    return `${indent}enum ${name} { }`;
  }

  const itemLines = node.items.map(item => {
    return `${innerIndent}${item.name?.id ?? '?'}`;
  });

  return `${indent}enum ${name} {\n${itemLines.join(',\n')}\n${indent}}`;
}

function formatField(field: Field, indent: string): string {
  const name = field.name?.id ?? '?';
  const rand = (field.attr & flags.FieldAttr.Rand) ? 'rand ' : '';
  const constMod = (field.attr & flags.FieldAttr.Const) ? 'const ' : '';
  const staticMod = (field.attr & flags.FieldAttr.Static) ? 'static ' : '';
  const typeName = getFieldTypeName(field);
  return `${indent}${staticMod}${constMod}${rand}${typeName} ${name};`;
}

function getFieldTypeName(field: Field): string {
  const dt = field.type;
  if (!dt) return '?';
  const ctor = dt.constructor.name;
  if (ctor === 'DataTypeBool') return 'bool';
  if (ctor === 'DataTypeString') return 'string';
  if (ctor === 'DataTypeChandle') return 'chandle';
  if (ctor === 'DataTypeInt') {
    const idt = dt as any;
    return idt.is_signed ? 'int' : 'bit';
  }
  if (ctor === 'DataTypeUserDefined') {
    const udt = dt as any;
    return udt.type_id?.elems?.map((e: any) => e.id?.id).join('::') ?? '?';
  }
  return '?';
}

function formatImport(imp: PackageImportStmt, indent: string): string {
  const path = imp.path?.elems.map(e => e.id?.id).join('::') ?? '?';
  const suffix = imp.wildcard ? '::*' : '';
  return `${indent}import ${path}${suffix};`;
}

function formatExtendType(node: ExtendType, depth: number, opts: FormatOptions): string {
  const indent = ' '.repeat(depth * opts.indentSize);
  const kindMap: Record<number, string> = {
    [enums.ExtendTargetE.Action]: 'action',
    [enums.ExtendTargetE.Component]: 'component',
    [enums.ExtendTargetE.Struct]: 'struct',
    [enums.ExtendTargetE.Buffer]: 'buffer',
    [enums.ExtendTargetE.Resource]: 'resource',
    [enums.ExtendTargetE.State]: 'state',
    [enums.ExtendTargetE.Stream]: 'stream',
  };
  const kind = kindMap[node.kind] ?? 'struct';
  const target = node.target?.elems.map(e => e.id?.id).join('::') ?? '?';
  const lines = [`${indent}extend ${kind} ${target} {`];

  for (const child of node.children) {
    const text = formatChild(child, depth + 1, opts);
    if (text !== null) lines.push(text);
  }

  lines.push(`${indent}}`);
  return lines.join('\n');
}

function formatExtendEnum(node: ExtendEnum, depth: number, opts: FormatOptions): string {
  const indent = ' '.repeat(depth * opts.indentSize);
  const innerIndent = ' '.repeat((depth + 1) * opts.indentSize);
  const target = node.target?.elems.map(e => e.id?.id).join('::') ?? '?';

  if (node.items.length === 0) {
    return `${indent}extend enum ${target} { }`;
  }

  const itemLines = node.items.map(item => `${innerIndent}${item.name?.id ?? '?'}`);
  return `${indent}extend enum ${target} {\n${itemLines.join(',\n')}\n${indent}}`;
}

function isTopLevelDecl(node: ScopeChild): boolean {
  return (
    node instanceof TypeScope ||
    node instanceof PackageScope ||
    node instanceof EnumDecl ||
    node instanceof ExtendType ||
    node instanceof ExtendEnum ||
    node instanceof FunctionDefinition
  );
}
