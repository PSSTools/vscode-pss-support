import { describe, it, expect } from 'vitest';
import { WorkspaceIndex } from '../../../src/core/index/WorkspaceIndex';
import { prepareTypeHierarchy, getSupertypes, getSubtypes } from '../../../src/core/services/TypeHierarchyService';

function createIndex(files: Record<string, string>): WorkspaceIndex {
  const index = new WorkspaceIndex();
  for (const [uri, content] of Object.entries(files)) index.addFile(uri, content);
  return index;
}

describe('TypeHierarchyService', () => {
  it('should prepare type hierarchy for struct', () => {
    const index = createIndex({ 'file:///t.pss': 'struct my_s { }' });
    const result = prepareTypeHierarchy('file:///t.pss', { line: 0, character: 10 }, index);
    expect(result).not.toBeNull();
    expect(result!.name).toBe('my_s');
  });

  it('should return null for non-type position', () => {
    const index = createIndex({ 'file:///t.pss': '' });
    const result = prepareTypeHierarchy('file:///t.pss', { line: 0, character: 0 }, index);
    expect(result).toBeNull();
  });

  it('should find supertypes in inheritance chain', () => {
    const index = createIndex({
      'file:///t.pss': 'struct base_s { }\nstruct mid_s : base_s { }\nstruct leaf_s : mid_s { }',
    });

    const item = { name: 'leaf_s', kind: 'struct', uri: 'file:///t.pss',
      range: { start: { line: 2, character: 0 }, end: { line: 2, character: 10 } },
      selectionRange: { start: { line: 2, character: 0 }, end: { line: 2, character: 10 } } };

    const supertypes = getSupertypes(item, index);
    expect(supertypes.length).toBeGreaterThanOrEqual(1);
    expect(supertypes.map(s => s.name)).toContain('mid_s');
  });

  it('should find subtypes', () => {
    const index = createIndex({
      'file:///t.pss': 'struct parent_s { }\nstruct child1_s : parent_s { }\nstruct child2_s : parent_s { }',
    });

    const item = { name: 'parent_s', kind: 'struct', uri: 'file:///t.pss',
      range: { start: { line: 0, character: 0 }, end: { line: 0, character: 10 } },
      selectionRange: { start: { line: 0, character: 0 }, end: { line: 0, character: 10 } } };

    const subtypes = getSubtypes(item, index);
    expect(subtypes.length).toBe(2);
  });

  it('should include extend types as subtypes', () => {
    const index = createIndex({
      'file:///t.pss': 'struct target_s { }\nextend struct target_s { rand bit[32] x; }',
    });

    const item = { name: 'target_s', kind: 'struct', uri: 'file:///t.pss',
      range: { start: { line: 0, character: 0 }, end: { line: 0, character: 10 } },
      selectionRange: { start: { line: 0, character: 0 }, end: { line: 0, character: 10 } } };

    const subtypes = getSubtypes(item, index);
    const extensions = subtypes.filter(s => s.detail === 'type extension');
    expect(extensions.length).toBeGreaterThanOrEqual(1);
  });

  it('should handle type with no supertypes', () => {
    const index = createIndex({ 'file:///t.pss': 'struct standalone_s { }' });
    const item = { name: 'standalone_s', kind: 'struct', uri: 'file:///t.pss',
      range: { start: { line: 0, character: 0 }, end: { line: 0, character: 10 } },
      selectionRange: { start: { line: 0, character: 0 }, end: { line: 0, character: 10 } } };
    const supertypes = getSupertypes(item, index);
    expect(supertypes).toHaveLength(0);
  });

  it('should handle type with no subtypes', () => {
    const index = createIndex({ 'file:///t.pss': 'struct leaf_s { }' });
    const item = { name: 'leaf_s', kind: 'struct', uri: 'file:///t.pss',
      range: { start: { line: 0, character: 0 }, end: { line: 0, character: 10 } },
      selectionRange: { start: { line: 0, character: 0 }, end: { line: 0, character: 10 } } };
    const subtypes = getSubtypes(item, index);
    expect(subtypes).toHaveLength(0);
  });
});
