import { describe, it, expect } from 'vitest';
import { PSSParserFacade } from '../../../src/core/parser/PSSParserFacade';
import { PSSASTBuilder } from '../../../src/core/parser/PSSASTBuilder';
import { getFoldingRanges } from '../../../src/core/services/FoldingService';

function buildAST(source: string) {
  const parser = new PSSParserFacade();
  const result = parser.parse(source, 1);
  const builder = new PSSASTBuilder(1, result.tokens);
  return builder.build(result.tree);
}

describe('FoldingService', () => {
  it('should produce fold range for struct body', () => {
    const ast = buildAST('struct s {\n  rand bit[32] x;\n  rand bit[32] y;\n}');
    const ranges = getFoldingRanges(ast);

    expect(ranges.length).toBeGreaterThan(0);
    const structRange = ranges.find(r => r.startLine === 0);
    expect(structRange).toBeDefined();
    expect(structRange!.endLine).toBeGreaterThan(0);
  });

  it('should produce fold range for component body', () => {
    const ast = buildAST('component c {\n  action a {\n  }\n}');
    const ranges = getFoldingRanges(ast);

    expect(ranges.length).toBeGreaterThan(0);
  });

  it('should produce fold range for nested scopes', () => {
    const ast = buildAST('component c {\n  action a {\n    rand bit[32] x;\n  }\n}');
    const ranges = getFoldingRanges(ast);

    // Should have ranges for both component and action
    expect(ranges.length).toBeGreaterThanOrEqual(2);
  });

  it('should handle consecutive imports', () => {
    const ast = buildAST('package p {\n  import a::*;\n  import b::*;\n  import c::*;\n}');
    const ranges = getFoldingRanges(ast);

    const importRanges = ranges.filter(r => r.kind === 'imports');
    expect(importRanges.length).toBeGreaterThanOrEqual(1);
  });

  it('should return empty ranges for empty source', () => {
    const ast = buildAST('');
    const ranges = getFoldingRanges(ast);
    expect(ranges).toHaveLength(0);
  });

  it('should produce fold range for package', () => {
    const ast = buildAST('package my_pkg {\n  struct s { }\n}');
    const ranges = getFoldingRanges(ast);

    expect(ranges.length).toBeGreaterThan(0);
  });
});
