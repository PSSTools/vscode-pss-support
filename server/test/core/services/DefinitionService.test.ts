import { describe, it, expect } from 'vitest';
import { WorkspaceIndex } from '../../../src/core/index/WorkspaceIndex';
import { getDefinition } from '../../../src/core/services/DefinitionService';

function createIndex(files: Record<string, string>): WorkspaceIndex {
  const index = new WorkspaceIndex();
  for (const [uri, content] of Object.entries(files)) {
    index.addFile(uri, content);
  }
  return index;
}

describe('DefinitionService', () => {
  it('should navigate to component declaration', () => {
    const index = createIndex({
      'file:///test.pss': 'component my_comp { }',
    });

    const results = getDefinition('file:///test.pss', { line: 0, character: 14 }, index);
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].uri).toBe('file:///test.pss');
  });

  it('should return empty for position with no symbol', () => {
    const index = createIndex({
      'file:///test.pss': '\n\n\n',
    });

    const results = getDefinition('file:///test.pss', { line: 0, character: 0 }, index);
    expect(results).toHaveLength(0);
  });

  it('should navigate to struct declaration', () => {
    const index = createIndex({
      'file:///test.pss': 'struct my_struct { rand bit[32] x; }',
    });

    const results = getDefinition('file:///test.pss', { line: 0, character: 10 }, index);
    expect(results.length).toBeGreaterThan(0);
  });

  it('should navigate to enum declaration', () => {
    const index = createIndex({
      'file:///test.pss': 'enum dir_e { READ, WRITE }',
    });

    const results = getDefinition('file:///test.pss', { line: 0, character: 8 }, index);
    expect(results.length).toBeGreaterThan(0);
  });

  it('should navigate to action inside component', () => {
    const index = createIndex({
      'file:///test.pss': 'component c {\n  action my_action { }\n}',
    });

    const results = getDefinition('file:///test.pss', { line: 1, character: 12 }, index);
    expect(results.length).toBeGreaterThan(0);
  });

  it('should handle package-scoped declarations', () => {
    const index = createIndex({
      'file:///test.pss': 'package my_pkg {\n  struct pkg_struct { }\n}',
    });

    const results = getDefinition('file:///test.pss', { line: 1, character: 12 }, index);
    expect(results.length).toBeGreaterThan(0);
  });

  it('should return empty for nonexistent file', () => {
    const index = new WorkspaceIndex();
    const results = getDefinition('file:///nonexistent.pss', { line: 0, character: 0 }, index);
    expect(results).toHaveLength(0);
  });

  it('should handle cross-file navigation setup', () => {
    const index = createIndex({
      'file:///types.pss': 'struct shared_s { rand bit[32] val; }',
      'file:///user.pss': 'component c {\n  action user_a { rand shared_s d; }\n}',
    });

    // Both files should be loaded
    expect(index.getAST('file:///types.pss')).toBeDefined();
    expect(index.getAST('file:///user.pss')).toBeDefined();
  });

  it('should navigate from super type reference', () => {
    const index = createIndex({
      'file:///test.pss': 'component c {\n  action base_action { }\n  action child_action : base_action { }\n}',
    });

    const results = getDefinition('file:///test.pss', { line: 2, character: 12 }, index);
    expect(results.length).toBeGreaterThan(0);
  });

  it('should handle multiple files', () => {
    const index = createIndex({
      'file:///a.pss': 'struct a_s { }',
      'file:///b.pss': 'struct b_s { }',
      'file:///c.pss': 'struct c_s { }',
    });

    const resultsA = getDefinition('file:///a.pss', { line: 0, character: 8 }, index);
    expect(resultsA.length).toBeGreaterThan(0);

    const resultsB = getDefinition('file:///b.pss', { line: 0, character: 8 }, index);
    expect(resultsB.length).toBeGreaterThan(0);
  });

  it('should navigate to abstract action', () => {
    const index = createIndex({
      'file:///test.pss': 'abstract action my_action { }',
    });

    const results = getDefinition('file:///test.pss', { line: 0, character: 18 }, index);
    expect(results.length).toBeGreaterThan(0);
  });

  it('should navigate to package', () => {
    const index = createIndex({
      'file:///test.pss': 'package my_pkg { }',
    });

    const results = getDefinition('file:///test.pss', { line: 0, character: 10 }, index);
    expect(results.length).toBeGreaterThan(0);
  });
});
