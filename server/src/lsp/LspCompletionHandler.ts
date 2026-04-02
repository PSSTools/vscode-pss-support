import {
  CompletionParams,
  CompletionItem,
  CompletionItemKind,
  CompletionList,
} from 'vscode-languageserver/node';
import { getCompletions, resolveCompletionItem } from '../core/services/CompletionService';
import { CompletionKind } from '../core/types/CompletionResult';
import { WorkspaceIndex } from '../core/index/WorkspaceIndex';

function convertKind(kind: CompletionKind): CompletionItemKind {
  switch (kind) {
    case CompletionKind.Keyword: return CompletionItemKind.Keyword;
    case CompletionKind.Type: return CompletionItemKind.Class;
    case CompletionKind.Field: return CompletionItemKind.Field;
    case CompletionKind.Function: return CompletionItemKind.Function;
    case CompletionKind.Enum: return CompletionItemKind.Enum;
    case CompletionKind.EnumMember: return CompletionItemKind.EnumMember;
    case CompletionKind.Snippet: return CompletionItemKind.Snippet;
    case CompletionKind.Package: return CompletionItemKind.Module;
    case CompletionKind.Action: return CompletionItemKind.Method;
    case CompletionKind.Component: return CompletionItemKind.Class;
    case CompletionKind.Struct: return CompletionItemKind.Struct;
    case CompletionKind.Constraint: return CompletionItemKind.Property;
    case CompletionKind.Activity: return CompletionItemKind.Event;
    default: return CompletionItemKind.Text;
  }
}

export function handleCompletion(
  params: CompletionParams,
  index: WorkspaceIndex,
  getDocumentText?: (uri: string) => string | undefined,
): CompletionList {
  const text = getDocumentText?.(params.textDocument.uri);

  const results = getCompletions(
    params.textDocument.uri,
    { line: params.position.line, character: params.position.character },
    index,
    text,
  );

  const items: CompletionItem[] = results.map(r => ({
    label: r.label,
    kind: convertKind(r.kind),
    detail: r.detail,
    documentation: r.documentation,
    insertText: r.insertText,
    sortText: r.sortText,
    data: { label: r.label },
  }));

  return { isIncomplete: false, items };
}

export function handleCompletionResolve(
  item: CompletionItem,
  index: WorkspaceIndex,
): CompletionItem {
  if (item.data?.label && !item.documentation) {
    const resolved = resolveCompletionItem(
      { label: item.data.label, kind: CompletionKind.Type },
      index,
    );
    if (resolved.documentation) {
      item.documentation = resolved.documentation;
    }
  }
  return item;
}
