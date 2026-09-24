import { describe, it, expect } from 'vitest';
import { CompletionItemKind, SymbolKind } from 'vscode-languageserver/node.js';
import { clientSupport } from '../../src/lsp/ClientSupport.js';
import { markdownToPlaintext } from '../../src/lsp/LspHoverHandler.js';

describe('clientSupport', () => {
  it('takes the protocol defaults from a client that advertises nothing', () => {
    const s = clientSupport({});
    expect(s.hoverMarkdown).toBe(false);
    expect(s.hierarchicalSymbols).toBe(false);
    expect(s.completionKind(CompletionItemKind.Struct)).toBe(CompletionItemKind.Class);
    expect(s.completionKind(CompletionItemKind.EnumMember)).toBe(CompletionItemKind.Value);
    expect(s.documentSymbolKind(SymbolKind.Struct)).toBe(SymbolKind.Class);
    expect(s.workspaceSymbolKind(SymbolKind.EnumMember)).toBe(SymbolKind.Constant);
    // Original kinds pass through.
    expect(s.completionKind(CompletionItemKind.Keyword)).toBe(CompletionItemKind.Keyword);
    expect(s.documentSymbolKind(SymbolKind.Package)).toBe(SymbolKind.Package);
  });

  it('keeps every kind a client lists', () => {
    const all = Array.from({ length: 26 }, (_, i) => (i + 1) as SymbolKind);
    const s = clientSupport({
      textDocument: {
        hover: { contentFormat: ['markdown', 'plaintext'] },
        documentSymbol: { hierarchicalDocumentSymbolSupport: true, symbolKind: { valueSet: all } },
        completion: { completionItemKind: { valueSet: all.slice(0, 25) as CompletionItemKind[] } },
      },
    });
    expect(s.hoverMarkdown).toBe(true);
    expect(s.hierarchicalSymbols).toBe(true);
    expect(s.completionKind(CompletionItemKind.Struct)).toBe(CompletionItemKind.Struct);
    expect(s.documentSymbolKind(SymbolKind.Struct)).toBe(SymbolKind.Struct);
    // workspace/symbol has its own capability, absent here.
    expect(s.workspaceSymbolKind(SymbolKind.Struct)).toBe(SymbolKind.Class);
  });

  it('falls back to Text / Variable when the nearest kind is not listed either', () => {
    const s = clientSupport({
      textDocument: {
        completion: { completionItemKind: { valueSet: [CompletionItemKind.Text, CompletionItemKind.Keyword] } },
        documentSymbol: { symbolKind: { valueSet: [SymbolKind.Variable] } },
      },
    });
    expect(s.completionKind(CompletionItemKind.Struct)).toBe(CompletionItemKind.Text);
    expect(s.documentSymbolKind(SymbolKind.Struct)).toBe(SymbolKind.Variable);
  });
});

describe('markdownToPlaintext', () => {
  it('drops the code fences and bold labels HoverService adds', () => {
    const md = '```pss\nstruct data_s\n```\n\nThe payload.\n\n**Type:** bit[32]\n\n**Annotations:** @x';
    expect(markdownToPlaintext(md)).toBe('struct data_s\n\nThe payload.\n\nType: bit[32]\n\nAnnotations: @x');
  });

  it('leaves text without that markup alone', () => {
    expect(markdownToPlaintext('a * b ** c')).toBe('a * b ** c');
  });
});
