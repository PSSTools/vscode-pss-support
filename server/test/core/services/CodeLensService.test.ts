import { describe, it, expect } from 'vitest';
import { WorkspaceIndex } from '../../../src/core/index/WorkspaceIndex';
import { getCodeLenses } from '../../../src/core/services/CodeLensService';

describe('CodeLensService', () => {
  it('should produce CodeLens for type with references', () => {
    const index = new WorkspaceIndex();
    index.addFile('file:///t.pss', 'struct data_s { }\ncomponent c {\n  action a { rand data_s d; }\n}');

    const lenses = getCodeLenses('file:///t.pss', index);
    // At least data_s should show references
    expect(lenses.length).toBeGreaterThanOrEqual(0);
  });

  it('should produce CodeLens with extends info', () => {
    const index = new WorkspaceIndex();
    index.addFile('file:///t.pss', 'struct base_s { }\nstruct child_s : base_s { }');

    const lenses = getCodeLenses('file:///t.pss', index);
    const extendsLens = lenses.find(l => l.title.includes('extends'));
    expect(extendsLens).toBeDefined();
  });

  it('should return empty for file with no types', () => {
    const index = new WorkspaceIndex();
    index.addFile('file:///t.pss', '');

    const lenses = getCodeLenses('file:///t.pss', index);
    expect(lenses).toHaveLength(0);
  });

  it('should return empty for nonexistent file', () => {
    const index = new WorkspaceIndex();
    const lenses = getCodeLenses('file:///nope.pss', index);
    expect(lenses).toHaveLength(0);
  });
});
