import {
  ScopeChild,
  Scope,
  TypeScope,
  NamedScope,
  NamedScopeChild,
  Field,
  FieldCompRef,
  FieldRef,
  FieldClaim,
  ActionHandleField,
  DataTypeUserDefined,
  TypeIdentifier,
  GlobalScope,
  PackageScope,
  ExtendType,
  ActivityActionTypeTraversal,
  EnumDecl,
  FunctionDefinition,
} from '../ast/generated';
import { SourcePosition } from '../types/SourcePosition';
import { TextEdit } from '../types/TextEdit';
import { WorkspaceIndex } from '../index/WorkspaceIndex';
import { findNodeAtPosition, getNodeName, walkScope } from '../ast/ASTUtils';

export interface RenameResult {
  /** Map from URI to text edits for that file */
  edits: Map<string, TextEdit[]>;
}

export interface PrepareRenameResult {
  range: { start: SourcePosition; end: SourcePosition };
  placeholder: string;
}

/**
 * Validates cursor is on a renamable identifier and returns
 * its current range and text.
 */
export function prepareRename(
  uri: string,
  position: SourcePosition,
  index: WorkspaceIndex,
): PrepareRenameResult | null {
  const ast = index.getAST(uri);
  if (!ast) return null;

  const node = findNodeAtPosition(ast, position);
  if (!node) return null;

  const name = getDeclarationName(node);
  if (!name) return null;

  // Keywords and built-ins are not renamable
  if (isKeyword(name)) return null;

  const loc = node.location;
  if (loc.lineno < 0) return null;

  return {
    range: {
      start: { line: loc.lineno - 1, character: loc.linepos },
      end: { line: loc.lineno - 1, character: loc.linepos + (loc.extent > 0 ? loc.extent : name.length) },
    },
    placeholder: name,
  };
}

/**
 * Rename the symbol at position to newName. Collects all references
 * across the workspace and produces TextEdits per file.
 */
export function rename(
  uri: string,
  position: SourcePosition,
  newName: string,
  index: WorkspaceIndex,
): RenameResult {
  const edits = new Map<string, TextEdit[]>();
  const ast = index.getAST(uri);
  if (!ast) return { edits };

  const node = findNodeAtPosition(ast, position);
  if (!node) return { edits };

  const name = getDeclarationName(node);
  if (!name) return { edits };

  // Collect all references across files
  for (const fileUri of index.getFileUris()) {
    const fileAst = index.getAST(fileUri);
    if (!fileAst) continue;

    const fileEdits: TextEdit[] = [];
    collectRenameEdits(fileAst, name, newName, fileEdits);

    if (fileEdits.length > 0) {
      edits.set(fileUri, fileEdits);
    }
  }

  return { edits };
}

function getDeclarationName(node: ScopeChild): string | null {
  if (node instanceof NamedScope) return node.name?.id ?? null;
  if (node instanceof NamedScopeChild) return node.name?.id ?? null;
  if (node instanceof PackageScope) return node.id.map(e => e.id).join('::');
  return null;
}

function isKeyword(name: string): boolean {
  const keywords = new Set([
    'action', 'abstract', 'component', 'struct', 'buffer', 'resource',
    'stream', 'state', 'enum', 'package', 'import', 'extend', 'function',
    'rand', 'constraint', 'activity', 'exec', 'if', 'else', 'do',
    'parallel', 'schedule', 'select', 'repeat', 'foreach', 'forall',
    'bit', 'int', 'bool', 'string', 'void', 'true', 'false',
  ]);
  return keywords.has(name);
}

function collectRenameEdits(
  scope: Scope,
  oldName: string,
  newName: string,
  edits: TextEdit[],
): void {
  for (const child of scope.children) {
    // Check declaration names
    const declName = getDeclarationName(child);
    if (declName === oldName) {
      addEditForName(child, oldName, newName, edits);
    }

    // Check type references
    checkTypeReference(child, oldName, newName, edits);

    // Check super type
    if (child instanceof TypeScope && child.super_t) {
      checkTypeIdReference(child.super_t, oldName, newName, edits);
    }

    // Check extend targets
    if (child instanceof ExtendType && child.target) {
      checkTypeIdReference(child.target, oldName, newName, edits);
    }

    // Recurse
    if (child instanceof Scope) {
      collectRenameEdits(child, oldName, newName, edits);
    }
  }
}

function checkTypeReference(
  node: ScopeChild,
  oldName: string,
  newName: string,
  edits: TextEdit[],
): void {
  let typeId: TypeIdentifier | null = null;

  if (node instanceof Field && node.type instanceof DataTypeUserDefined) {
    typeId = node.type.type_id;
  } else if (node instanceof FieldCompRef && node.type) {
    typeId = node.type.type_id;
  } else if (node instanceof FieldRef && node.type) {
    typeId = node.type.type_id;
  } else if (node instanceof FieldClaim && node.type) {
    typeId = node.type.type_id;
  } else if (node instanceof ActionHandleField && node.type instanceof DataTypeUserDefined) {
    typeId = node.type.type_id;
  } else if (node instanceof ActivityActionTypeTraversal && node.target) {
    typeId = node.target.type_id;
  }

  if (typeId) {
    checkTypeIdReference(typeId, oldName, newName, edits);
  }
}

function checkTypeIdReference(
  typeId: TypeIdentifier,
  oldName: string,
  newName: string,
  edits: TextEdit[],
): void {
  for (const elem of typeId.elems) {
    if (elem.id?.id === oldName && elem.id.location.lineno >= 0) {
      edits.push({
        range: {
          start: { line: elem.id.location.lineno - 1, character: elem.id.location.linepos },
          end: {
            line: elem.id.location.lineno - 1,
            character: elem.id.location.linepos + (elem.id.location.extent > 0 ? elem.id.location.extent : oldName.length),
          },
        },
        newText: newName,
      });
    }
  }
}

function addEditForName(
  node: ScopeChild,
  oldName: string,
  newName: string,
  edits: TextEdit[],
): void {
  const loc = node.location;
  if (loc.lineno < 0) return;

  // For named nodes, the name is at a specific offset within the declaration.
  // Use the node's name ExprId location if available.
  let nameLoc = loc;
  if (node instanceof NamedScope && node.name?.location) {
    nameLoc = node.name.location;
  } else if (node instanceof NamedScopeChild && node.name?.location) {
    nameLoc = node.name.location;
  }

  if (nameLoc.lineno >= 0) {
    edits.push({
      range: {
        start: { line: nameLoc.lineno - 1, character: nameLoc.linepos },
        end: {
          line: nameLoc.lineno - 1,
          character: nameLoc.linepos + (nameLoc.extent > 0 ? nameLoc.extent : oldName.length),
        },
      },
      newText: newName,
    });
  }
}
