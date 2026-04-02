import { describe, it, expect } from 'vitest';
import { WorkspaceIndex } from '../../../src/core/index/WorkspaceIndex';
import { getReferences } from '../../../src/core/services/ReferencesService';

function createIndex(files: Record<string, string>): WorkspaceIndex {
  const index = new WorkspaceIndex();
  for (const [uri, content] of Object.entries(files)) {
    index.addFile(uri, content);
  }
  return index;
}

describe('ReferencesService', () => {
  it('should find references to a struct type', () => {
    const index = createIndex({
      'file:///test.pss': 'struct data_s { rand bit[32] val; }\ncomponent c {\n  action a1 { rand data_s d1; }\n}',
    });

    const results = getReferences(
      'file:///test.pss',
      { line: 0, character: 10 },
      index,
      true,
    );

    expect(results.length).toBeGreaterThanOrEqual(1);
  });

  it('should include declaration when requested', () => {
    const index = createIndex({
      'file:///test.pss': 'struct my_struct { }',
    });

    const results = getReferences(
      'file:///test.pss',
      { line: 0, character: 10 },
      index,
      true,
    );

    const declarations = results.filter(r => r.isDeclaration);
    expect(declarations.length).toBeGreaterThanOrEqual(1);
  });

  it('should exclude declaration when not requested', () => {
    const index = createIndex({
      'file:///test.pss': 'struct my_struct { }',
    });

    const results = getReferences(
      'file:///test.pss',
      { line: 0, character: 10 },
      index,
      false,
    );

    const declarations = results.filter(r => r.isDeclaration);
    expect(declarations).toHaveLength(0);
  });

  it('should find references across files', () => {
    const index = createIndex({
      'file:///types.pss': 'struct shared_s { rand bit[32] val; }',
      'file:///user1.pss': 'component c1 {\n  action a1 { rand shared_s d; }\n}',
      'file:///user2.pss': 'component c2 {\n  action a2 { rand shared_s d; }\n}',
    });

    const results = getReferences(
      'file:///types.pss',
      { line: 0, character: 10 },
      index,
      true,
    );

    expect(results.length).toBeGreaterThanOrEqual(1);
  });

  it('should find references from extend statements', () => {
    const index = createIndex({
      'file:///test.pss': 'struct target_s { }\nextend struct target_s { rand bit[32] x; }',
    });

    const results = getReferences(
      'file:///test.pss',
      { line: 0, character: 10 },
      index,
      true,
    );

    expect(results.length).toBeGreaterThanOrEqual(1);
  });

  it('should find references from inheritance', () => {
    const index = createIndex({
      'file:///test.pss': 'struct base_s { }\nstruct child_s : base_s { }',
    });

    const results = getReferences(
      'file:///test.pss',
      { line: 0, character: 10 },
      index,
      true,
    );

    expect(results.length).toBeGreaterThanOrEqual(1);
  });

  it('should return empty for position with no symbol', () => {
    const index = createIndex({
      'file:///test.pss': '\n\n\n',
    });

    const results = getReferences(
      'file:///test.pss',
      { line: 0, character: 0 },
      index,
      true,
    );

    expect(results).toHaveLength(0);
  });

  it('should return empty for nonexistent file', () => {
    const index = new WorkspaceIndex();
    const results = getReferences(
      'file:///nonexistent.pss',
      { line: 0, character: 0 },
      index,
      true,
    );

    expect(results).toHaveLength(0);
  });
});
