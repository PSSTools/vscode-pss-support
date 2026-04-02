import {
  CallHierarchyPrepareParams,
  CallHierarchyIncomingCallsParams,
  CallHierarchyOutgoingCallsParams,
  CallHierarchyItem as LspCallHierarchyItem,
  CallHierarchyIncomingCall,
  CallHierarchyOutgoingCall,
  SymbolKind,
} from 'vscode-languageserver/node';
import {
  prepareCallHierarchy,
  getIncomingCalls,
  getOutgoingCalls,
  CallHierarchyItem,
} from '../core/services/CallHierarchyService';
import { WorkspaceIndex } from '../core/index/WorkspaceIndex';

function toLspItem(item: CallHierarchyItem): LspCallHierarchyItem {
  return {
    name: item.name,
    kind: SymbolKind.Method,
    uri: item.uri,
    range: item.range,
    selectionRange: item.selectionRange,
  };
}

export function handlePrepareCallHierarchy(
  params: CallHierarchyPrepareParams,
  index: WorkspaceIndex,
): LspCallHierarchyItem[] | null {
  const result = prepareCallHierarchy(
    params.textDocument.uri,
    { line: params.position.line, character: params.position.character },
    index,
  );
  return result ? [toLspItem(result)] : null;
}

export function handleIncomingCalls(
  params: CallHierarchyIncomingCallsParams,
  index: WorkspaceIndex,
): CallHierarchyIncomingCall[] {
  const item: CallHierarchyItem = {
    name: params.item.name,
    kind: 'action',
    uri: params.item.uri,
    range: params.item.range,
    selectionRange: params.item.selectionRange,
  };

  return getIncomingCalls(item, index).map(c => ({
    from: toLspItem(c.from),
    fromRanges: c.fromRanges,
  }));
}

export function handleOutgoingCalls(
  params: CallHierarchyOutgoingCallsParams,
  index: WorkspaceIndex,
): CallHierarchyOutgoingCall[] {
  const item: CallHierarchyItem = {
    name: params.item.name,
    kind: 'action',
    uri: params.item.uri,
    range: params.item.range,
    selectionRange: params.item.selectionRange,
  };

  return getOutgoingCalls(item, index).map(c => ({
    to: toLspItem(c.from),
    fromRanges: c.fromRanges,
  }));
}
