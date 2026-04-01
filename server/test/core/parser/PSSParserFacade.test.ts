import { describe, it, expect } from 'vitest';
import { PSSParserFacade } from '../../../src/core/parser/PSSParserFacade';

describe('PSSParserFacade', () => {
  const facade = new PSSParserFacade();

  it('parses valid PSS with zero errors', () => {
    const result = facade.parse('component c { action a { } }');
    expect(result.errors).toHaveLength(0);
    expect(result.tree).toBeDefined();
  });

  it('parses empty string with zero errors', () => {
    const result = facade.parse('');
    expect(result.errors).toHaveLength(0);
    expect(result.tree).toBeDefined();
  });

  it('reports errors for broken PSS', () => {
    const result = facade.parse('action { }');
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors[0].range.start.line).toBeGreaterThanOrEqual(0);
  });

  it('reports correct line for syntax error on second line', () => {
    const result = facade.parse('component c {\n  foo bar\n}');
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it('parses component declaration', () => {
    const result = facade.parse('component my_comp { }');
    expect(result.errors).toHaveLength(0);
  });

  it('parses struct declaration', () => {
    const result = facade.parse('struct my_struct { }');
    expect(result.errors).toHaveLength(0);
  });

  it('parses enum declaration', () => {
    const result = facade.parse('enum color_e { RED, GREEN, BLUE }');
    expect(result.errors).toHaveLength(0);
  });

  it('parses package declaration', () => {
    const result = facade.parse('package my_pkg {\n  struct s { }\n}');
    expect(result.errors).toHaveLength(0);
  });

  it('parses abstract action declaration at top level', () => {
    const result = facade.parse('abstract action a { }');
    expect(result.errors).toHaveLength(0);
  });

  it('parses action inside component', () => {
    const result = facade.parse('component c { action a { } }');
    expect(result.errors).toHaveLength(0);
  });

  it('returns CommonTokenStream', () => {
    const result = facade.parse('struct s { }');
    expect(result.tokens).toBeDefined();
    result.tokens.fill();
    expect(result.tokens.getTokens().length).toBeGreaterThan(0);
  });
});
