import { describe, it, expect } from 'vitest';
import { PSSParserFacade } from '../../../src/core/parser/PSSParserFacade';
import { PSSASTBuilder } from '../../../src/core/parser/PSSASTBuilder';
import { getSemanticTokens, TokenType, TokenModifier } from '../../../src/core/services/SemanticTokenService';

function buildAST(source: string) {
  const parser = new PSSParserFacade();
  const result = parser.parse(source, 1);
  const builder = new PSSASTBuilder(1, result.tokens);
  return builder.build(result.tree);
}

describe('SemanticTokenService', () => {
  it('should produce tokens for struct declaration', () => {
    const ast = buildAST('struct my_struct { }');
    const tokens = getSemanticTokens(ast);

    expect(tokens.length).toBeGreaterThan(0);
    const classToken = tokens.find(t => t.tokenType === TokenType.class);
    expect(classToken).toBeDefined();
    expect(classToken!.tokenModifiers & TokenModifier.declaration).toBeTruthy();
  });

  it('should produce tokens for component declaration', () => {
    const ast = buildAST('component my_comp { }');
    const tokens = getSemanticTokens(ast);

    const classToken = tokens.find(t => t.tokenType === TokenType.class);
    expect(classToken).toBeDefined();
  });

  it('should produce tokens for enum declaration with members', () => {
    const ast = buildAST('enum color_e { RED, GREEN, BLUE }');
    const tokens = getSemanticTokens(ast);

    const enumToken = tokens.find(t => t.tokenType === TokenType.enum);
    expect(enumToken).toBeDefined();

    const memberTokens = tokens.filter(t => t.tokenType === TokenType.enumMember);
    expect(memberTokens.length).toBe(3);
  });

  it('should mark rand fields with modification modifier', () => {
    const ast = buildAST('struct s {\n  rand bit[32] addr;\n}');
    const tokens = getSemanticTokens(ast);

    const fieldToken = tokens.find(
      t => t.tokenType === TokenType.variable && (t.tokenModifiers & TokenModifier.modification),
    );
    expect(fieldToken).toBeDefined();
  });

  it('should mark abstract action with abstract modifier', () => {
    const ast = buildAST('abstract action base_a { }');
    const tokens = getSemanticTokens(ast);

    const classToken = tokens.find(
      t => t.tokenType === TokenType.class && (t.tokenModifiers & TokenModifier.abstract),
    );
    expect(classToken).toBeDefined();
  });

  it('should produce tokens for action inside component', () => {
    const ast = buildAST('component c {\n  action my_action { }\n}');
    const tokens = getSemanticTokens(ast);

    const classTokens = tokens.filter(t => t.tokenType === TokenType.class);
    // Should have at least component + action
    expect(classTokens.length).toBeGreaterThanOrEqual(2);
  });

  it('should return empty tokens for empty source', () => {
    const ast = buildAST('');
    const tokens = getSemanticTokens(ast);
    expect(tokens).toHaveLength(0);
  });

  it('should return sorted tokens', () => {
    const ast = buildAST('struct a { }\nstruct b { }\nstruct c { }');
    const tokens = getSemanticTokens(ast);

    for (let i = 1; i < tokens.length; i++) {
      const prev = tokens[i - 1];
      const curr = tokens[i];
      expect(
        curr.line > prev.line || (curr.line === prev.line && curr.startChar >= prev.startChar),
      ).toBe(true);
    }
  });

  it('should produce namespace token for package', () => {
    const ast = buildAST('package my_pkg { }');
    const tokens = getSemanticTokens(ast);

    const nsToken = tokens.find(t => t.tokenType === TokenType.namespace);
    expect(nsToken).toBeDefined();
  });

  it('should produce variable tokens for fields', () => {
    const ast = buildAST('struct s {\n  rand bit[32] x;\n  bool flag;\n}');
    const tokens = getSemanticTokens(ast);

    const varTokens = tokens.filter(t => t.tokenType === TokenType.variable);
    expect(varTokens.length).toBeGreaterThanOrEqual(2);
  });
});
