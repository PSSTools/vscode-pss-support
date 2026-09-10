import { describe, it, expect } from 'vitest';
import { parseSource } from '../helpers/ParseHelper.js';
import { handleDocumentSymbol } from '../../src/lsp/LspSymbolHandler.js';
import { GlobalScope } from '../../src/core/ast/generated/index.js';

describe('LspSymbolHandler', () => {
  it('returns empty array when no AST cached', () => {
    const result = handleDocumentSymbol(
      { textDocument: { uri: 'file:///test.pss' } },
      () => undefined,
    );
    expect(result).toHaveLength(0);
  });

  it('returns symbols for cached AST', () => {
    const ast = parseSource('component c { action a { } }')!;

    const result = handleDocumentSymbol(
      { textDocument: { uri: 'file:///test.pss' } },
      (uri) => uri === 'file:///test.pss' ? ast : undefined,
    );
    expect(result.length).toBe(1);
    expect(result[0].name).toBe('c');
    expect(result[0].children).toBeDefined();
    expect(result[0].children!.length).toBe(1);
    expect(result[0].children![0].name).toBe('a');
  });

  it('returns correct LSP symbol kinds', () => {
    const ast = parseSource('struct s { }\nenum e { A }')!;

    const result = handleDocumentSymbol(
      { textDocument: { uri: 'file:///test.pss' } },
      () => ast,
    );
    expect(result.length).toBe(2);
    // Struct -> SymbolKind.Struct -> LspSymbolKind.Struct (23)
    expect(result[0].kind).toBe(23);
    // Enum -> SymbolKind.Enum -> LspSymbolKind.Enum (10)
    expect(result[1].kind).toBe(10);
  });
});
