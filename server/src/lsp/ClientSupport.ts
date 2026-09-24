/**
 * What the client said it can take, reduced to the choices the handlers make.
 *
 * A capability the client leaves out takes the protocol's default, and the
 * defaults are the conservative end: plaintext only, flat document symbols,
 * and only the 18 completion and symbol kinds of the original protocol. VS Code
 * and Neovim advertise everything; eglot without markdown-mode, Helix and
 * minimal clients do not, and would otherwise receive markdown they show raw,
 * a symbol tree they did not ask for, or kinds they may drop.
 */
import {
  ClientCapabilities,
  CompletionItemKind,
  SymbolKind,
} from 'vscode-languageserver/node.js';

export interface ClientSupport {
  /** Hover contents may be markdown; otherwise send plaintext. */
  hoverMarkdown: boolean;
  /** textDocument/documentSymbol may return a DocumentSymbol tree. */
  hierarchicalSymbols: boolean;
  completionKind(kind: CompletionItemKind): CompletionItemKind;
  documentSymbolKind(kind: SymbolKind): SymbolKind;
  workspaceSymbolKind(kind: SymbolKind): SymbolKind;
}

/** Text (1) to Reference (18) for completions, File (1) to Array (18) for symbols. */
const ORIGINAL_KINDS = 18;

/**
 * The nearest original kind for each later one the server uses. A kind the
 * server does not use falls back to Text / Variable.
 */
const COMPLETION_FALLBACK: Partial<Record<CompletionItemKind, CompletionItemKind>> = {
  [CompletionItemKind.EnumMember]: CompletionItemKind.Value,
  [CompletionItemKind.Struct]: CompletionItemKind.Class,
  [CompletionItemKind.Event]: CompletionItemKind.Keyword,
  [CompletionItemKind.Constant]: CompletionItemKind.Value,
  [CompletionItemKind.TypeParameter]: CompletionItemKind.Class,
};
const SYMBOL_FALLBACK: Partial<Record<SymbolKind, SymbolKind>> = {
  [SymbolKind.EnumMember]: SymbolKind.Constant,
  [SymbolKind.Struct]: SymbolKind.Class,
  [SymbolKind.Event]: SymbolKind.Method,
  [SymbolKind.TypeParameter]: SymbolKind.Class,
};

function kindMapper<K extends number>(
  valueSet: K[] | undefined,
  fallback: Partial<Record<K, K>>,
  otherwise: K,
): (kind: K) => K {
  const supported = new Set<number>(valueSet ?? Array.from({ length: ORIGINAL_KINDS }, (_, i) => i + 1));
  return kind => {
    if (supported.has(kind)) return kind;
    const alt = fallback[kind];
    return alt !== undefined && supported.has(alt) ? alt : otherwise;
  };
}

export function clientSupport(caps: ClientCapabilities): ClientSupport {
  const td = caps.textDocument;
  return {
    hoverMarkdown: td?.hover?.contentFormat?.includes('markdown') === true,
    hierarchicalSymbols: td?.documentSymbol?.hierarchicalDocumentSymbolSupport === true,
    completionKind: kindMapper(td?.completion?.completionItemKind?.valueSet, COMPLETION_FALLBACK, CompletionItemKind.Text),
    documentSymbolKind: kindMapper(td?.documentSymbol?.symbolKind?.valueSet, SYMBOL_FALLBACK, SymbolKind.Variable),
    workspaceSymbolKind: kindMapper(caps.workspace?.symbol?.symbolKind?.valueSet, SYMBOL_FALLBACK, SymbolKind.Variable),
  };
}

/**
 * A client that takes everything the server can send. The default for
 * handlers called directly, as in unit tests.
 */
export const FULL_SUPPORT: ClientSupport = {
  hoverMarkdown: true,
  hierarchicalSymbols: true,
  completionKind: kind => kind,
  documentSymbolKind: kind => kind,
  workspaceSymbolKind: kind => kind,
};
