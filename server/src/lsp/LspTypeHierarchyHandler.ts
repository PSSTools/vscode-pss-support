import {
  TypeHierarchyPrepareParams,
  TypeHierarchySupertypesParams,
  TypeHierarchySubtypesParams,
  TypeHierarchyItem as LspTypeHierarchyItem,
  SymbolKind,
} from 'vscode-languageserver/node';
import {
  prepareTypeHierarchy,
  getSupertypes,
  getSubtypes,
  TypeHierarchyItem,
} from '../core/services/TypeHierarchyService';
import { WorkspaceIndex } from '../core/index/WorkspaceIndex';

function toLspItem(item: TypeHierarchyItem): LspTypeHierarchyItem {
  return {
    name: item.name,
    kind: SymbolKind.Class,
    uri: item.uri,
    range: item.range,
    selectionRange: item.selectionRange,
    detail: item.detail,
  };
}

function toModelItem(lsp: LspTypeHierarchyItem): TypeHierarchyItem {
  return {
    name: lsp.name,
    kind: 'type',
    uri: lsp.uri,
    range: lsp.range,
    selectionRange: lsp.selectionRange,
    detail: lsp.detail,
  };
}

export function handlePrepareTypeHierarchy(
  params: TypeHierarchyPrepareParams,
  index: WorkspaceIndex,
): LspTypeHierarchyItem[] | null {
  const result = prepareTypeHierarchy(
    params.textDocument.uri,
    { line: params.position.line, character: params.position.character },
    index,
  );
  return result ? [toLspItem(result)] : null;
}

export function handleSupertypes(
  params: TypeHierarchySupertypesParams,
  index: WorkspaceIndex,
): LspTypeHierarchyItem[] {
  return getSupertypes(toModelItem(params.item), index).map(toLspItem);
}

export function handleSubtypes(
  params: TypeHierarchySubtypesParams,
  index: WorkspaceIndex,
): LspTypeHierarchyItem[] {
  return getSubtypes(toModelItem(params.item), index).map(toLspItem);
}
