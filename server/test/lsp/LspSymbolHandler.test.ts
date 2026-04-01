import { describe, it, expect } from 'vitest';
import { PSSParserFacade } from '../../src/core/parser/PSSParserFacade';
import { PSSASTBuilder } from '../../src/core/parser/PSSASTBuilder';
import { handleDocumentSymbol } from '../../src/lsp/LspSymbolHandler';
import { GlobalScope } from '../../src/core/ast/generated';

describe('LspSymbolHandler', () => {
  it('returns empty array when no AST cached', () => {
    const result = handleDocumentSymbol(
      { textDocument: { uri: 'file:///test.pss' } },
      () => undefined,
    );
    expect(result).toHaveLength(0);
  });

  it('returns symbols for cached AST', () => {
    const facade = new PSSParserFacade();
    const parseResult = facade.parse('component c { action a { } }');
    const builder = new PSSASTBuilder(0, parseResult.tokens);
    const ast = builder.build(parseResult.tree);

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
    const facade = new PSSParserFacade();
    const parseResult = facade.parse('struct s { }\nenum e { A }');
    const builder = new PSSASTBuilder(0, parseResult.tokens);
    const ast = builder.build(parseResult.tree);

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
