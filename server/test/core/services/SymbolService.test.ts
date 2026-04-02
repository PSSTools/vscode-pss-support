import { describe, it, expect } from 'vitest';
import { PSSParserFacade } from '../../../src/core/parser/PSSParserFacade';
import { PSSASTBuilder } from '../../../src/core/parser/PSSASTBuilder';
import { getDocumentSymbols } from '../../../src/core/services/SymbolService';
import { SymbolKind } from '../../../src/core/types/DocumentSymbol';

function getSymbols(source: string) {
  const facade = new PSSParserFacade();
  const result = facade.parse(source);
  const builder = new PSSASTBuilder(0, result.tokens);
  const ast = builder.build(result.tree);
  return getDocumentSymbols(ast);
}

describe('SymbolService', () => {
  it('returns empty array for empty source', () => {
    const symbols = getSymbols('');
    expect(symbols).toHaveLength(0);
  });

  it('returns component symbol', () => {
    const symbols = getSymbols('component my_comp { }');
    expect(symbols).toHaveLength(1);
    expect(symbols[0].name).toBe('my_comp');
    expect(symbols[0].kind).toBe(SymbolKind.Component);
  });

  it('returns struct symbol', () => {
    const symbols = getSymbols('struct my_struct { }');
    expect(symbols).toHaveLength(1);
    expect(symbols[0].name).toBe('my_struct');
    expect(symbols[0].kind).toBe(SymbolKind.Struct);
  });

  it('returns buffer as Buffer kind', () => {
    const symbols = getSymbols('buffer my_buf { }');
    expect(symbols[0].kind).toBe(SymbolKind.Buffer);
  });

  it('returns enum symbol', () => {
    const symbols = getSymbols('enum color_e { RED, GREEN, BLUE }');
    expect(symbols).toHaveLength(1);
    expect(symbols[0].name).toBe('color_e');
    expect(symbols[0].kind).toBe(SymbolKind.Enum);
  });

  it('returns nested action inside component', () => {
    const symbols = getSymbols('component c { action a { } }');
    expect(symbols).toHaveLength(1);
    expect(symbols[0].children).toBeDefined();
    expect(symbols[0].children!.length).toBe(1);
    expect(symbols[0].children![0].name).toBe('a');
    expect(symbols[0].children![0].kind).toBe(SymbolKind.Action);
  });

  it('returns abstract action with detail', () => {
    const symbols = getSymbols('abstract action my_action { }');
    expect(symbols[0].detail).toBe('abstract');
  });

  it('returns package symbol', () => {
    const symbols = getSymbols('package my_pkg { struct s { } }');
    expect(symbols).toHaveLength(1);
    expect(symbols[0].name).toBe('my_pkg');
    expect(symbols[0].kind).toBe(SymbolKind.Package);
    expect(symbols[0].children).toBeDefined();
  });

  it('returns multiple top-level symbols', () => {
    const symbols = getSymbols('struct s1 { }\nstruct s2 { }\nenum e { A }');
    expect(symbols).toHaveLength(3);
  });

  it('returns field children in struct', () => {
    const symbols = getSymbols('struct s { rand int x; bool y; }');
    expect(symbols).toHaveLength(1);
    if (symbols[0].children) {
      const fieldSymbols = symbols[0].children.filter(c => c.kind === SymbolKind.Field);
      expect(fieldSymbols.length).toBeGreaterThanOrEqual(1);
    }
  });

  it('returns symbols with valid ranges', () => {
    const symbols = getSymbols('struct s { }');
    expect(symbols[0].range.start.line).toBe(0);
    expect(symbols[0].range.start.character).toBe(0);
  });
});
