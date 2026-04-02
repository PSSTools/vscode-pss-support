import { describe, it, expect } from 'vitest';
import { PSSParserFacade } from '../../../src/core/parser/PSSParserFacade';
import { PSSASTBuilder } from '../../../src/core/parser/PSSASTBuilder';
import { lint } from '../../../src/core/services/LintService';
import { TestConfiguration } from '../../helpers/TestConfiguration';

function buildAndLint(source: string, config?: TestConfiguration) {
  const parser = new PSSParserFacade();
  const result = parser.parse(source, 1);
  const builder = new PSSASTBuilder(1, result.tokens);
  const ast = builder.build(result.tree);
  return lint(ast, config);
}

describe('LintService', () => {
  it('should not produce diagnostics for clean code', () => {
    const diags = buildAndLint('struct my_struct { rand bit[32] addr; }');
    expect(diags.filter(d => d.code?.startsWith('lint/'))).toHaveLength(0);
  });

  it('should detect camelCase type names', () => {
    const diags = buildAndLint('struct myStruct { }');
    const namingDiags = diags.filter(d => d.code === 'lint/naming-convention');
    expect(namingDiags.length).toBeGreaterThan(0);
  });

  it('should not flag snake_case names', () => {
    const diags = buildAndLint('struct my_struct { }');
    const namingDiags = diags.filter(d => d.code === 'lint/naming-convention');
    expect(namingDiags).toHaveLength(0);
  });

  it('should not flag PascalCase names', () => {
    const diags = buildAndLint('struct MyStruct { }');
    const namingDiags = diags.filter(d => d.code === 'lint/naming-convention');
    expect(namingDiags).toHaveLength(0);
  });

  it('should respect disabled rules via config', () => {
    const config = new TestConfiguration();
    config.set('pss.lint.rules.naming-convention', false);
    const diags = buildAndLint('struct myStruct { }', config);
    const namingDiags = diags.filter(d => d.code === 'lint/naming-convention');
    expect(namingDiags).toHaveLength(0);
  });

  it('should handle empty source', () => {
    const diags = buildAndLint('');
    expect(diags).toHaveLength(0);
  });

  it('should handle multiple types', () => {
    const diags = buildAndLint('struct goodName_s { }\nstruct badName { }');
    // badName is not camelCase (starts lowercase, has uppercase, but no _)
    // Actually "badName" starts lowercase, has uppercase N, no underscore -> camelCase
    const namingDiags = diags.filter(d => d.code === 'lint/naming-convention');
    expect(namingDiags.length).toBeGreaterThan(0);
  });

  it('should lint components', () => {
    const diags = buildAndLint('component myComp { }');
    const namingDiags = diags.filter(d => d.code === 'lint/naming-convention');
    expect(namingDiags.length).toBeGreaterThan(0);
  });

  it('should not lint enums for naming', () => {
    const diags = buildAndLint('enum myEnum { A, B }');
    // EnumDecl is not TypeScope, so naming check should not apply
    const namingDiags = diags.filter(d => d.code === 'lint/naming-convention');
    expect(namingDiags).toHaveLength(0);
  });

  it('should handle package with types', () => {
    const diags = buildAndLint('package my_pkg { struct good_s { } }');
    expect(diags.filter(d => d.code === 'lint/naming-convention')).toHaveLength(0);
  });
});
