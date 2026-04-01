import { describe, it, expect } from 'vitest';
import { WorkspaceIndex } from '../../../src/core/index/WorkspaceIndex';

describe('WorkspaceIndex', () => {
  it('should add and retrieve a file', () => {
    const index = new WorkspaceIndex();
    index.addFile('file:///test.pss', 'struct my_struct { }');

    const ast = index.getAST('file:///test.pss');
    expect(ast).toBeDefined();
  });

  it('should update a file', () => {
    const index = new WorkspaceIndex();
    index.addFile('file:///test.pss', 'struct old_s { }');
    index.updateFile('file:///test.pss', 'struct new_s { }');

    const ast = index.getAST('file:///test.pss');
    expect(ast).toBeDefined();
  });

  it('should remove a file', () => {
    const index = new WorkspaceIndex();
    index.addFile('file:///test.pss', 'struct my_struct { }');
    index.removeFile('file:///test.pss');

    const ast = index.getAST('file:///test.pss');
    expect(ast).toBeUndefined();
  });

  it('should return diagnostics after analysis', () => {
    const index = new WorkspaceIndex();
    index.addFile('file:///test.pss', 'component c { action my_action { rand undefined_type x; } }');

    const diags = index.getDiagnostics('file:///test.pss');
    expect(diags).toBeDefined();
  });

  it('should find type by qualified name', () => {
    const index = new WorkspaceIndex();
    index.addFile('file:///test.pss', 'struct my_struct { }');

    const scope = index.findType('my_struct');
    expect(scope).not.toBeNull();
  });

  it('should find symbol at position', () => {
    const index = new WorkspaceIndex();
    index.addFile('file:///test.pss', 'struct my_struct { rand bit[32] addr; }');

    const result = index.findSymbolAtPosition('file:///test.pss', { line: 0, character: 10 });
    expect(result).not.toBeNull();
  });

  it('should search all symbols', () => {
    const index = new WorkspaceIndex();
    index.addFile('file:///test.pss', `
      struct alpha_struct { }
      struct beta_struct { }
      enum gamma_enum { A, B }
    `);

    const results = index.getAllSymbols('struct');
    expect(results.length).toBeGreaterThanOrEqual(2);
  });

  it('should handle cross-file references', () => {
    const index = new WorkspaceIndex();
    index.addFile('file:///types.pss', 'struct shared_data { rand bit[32] val; }');
    index.addFile('file:///user.pss', 'component c { action user_a { rand shared_data d; } }');

    expect(index.getAST('file:///types.pss')).toBeDefined();
    expect(index.getAST('file:///user.pss')).toBeDefined();
  });

  it('should re-analyze dependents on update', () => {
    const index = new WorkspaceIndex();
    index.addFile('file:///types.pss', 'struct data_s { rand bit[32] val; }');
    index.addFile('file:///user.pss', 'component c { action user_a { rand data_s d; } }');

    index.updateFile('file:///types.pss', 'struct data_s { rand bit[64] val; }');

    const diags = index.getDiagnostics('file:///user.pss');
    expect(diags).toBeDefined();
  });

  it('should return empty diagnostics for removed file', () => {
    const index = new WorkspaceIndex();
    index.addFile('file:///test.pss', 'struct my_struct { }');
    index.removeFile('file:///test.pss');

    const diags = index.getDiagnostics('file:///test.pss');
    expect(diags).toHaveLength(0);
  });

  it('should list all file URIs', () => {
    const index = new WorkspaceIndex();
    index.addFile('file:///a.pss', 'struct a { }');
    index.addFile('file:///b.pss', 'struct b { }');

    const uris = index.getFileUris();
    expect(uris).toContain('file:///a.pss');
    expect(uris).toContain('file:///b.pss');
  });

  it('should return all diagnostics for all files', () => {
    const index = new WorkspaceIndex();
    index.addFile('file:///a.pss', 'struct a { }');
    index.addFile('file:///b.pss', 'struct b { }');

    const allDiags = index.getAllDiagnostics();
    expect(allDiags.size).toBe(2);
  });

  it('should handle package-scoped type lookup', () => {
    const index = new WorkspaceIndex();
    index.addFile('file:///test.pss', 'package my_pkg { struct pkg_struct { } }');

    const scope = index.findType('my_pkg');
    expect(scope).not.toBeNull();
  });

  it('should return dependents list', () => {
    const index = new WorkspaceIndex();
    index.addFile('file:///base.pss', 'struct base_s { }');
    index.addFile('file:///user.pss', 'component c { action user_a { rand base_s b; } }');

    index.getDiagnostics('file:///user.pss');
    const deps = index.getDependents('file:///base.pss');
    expect(deps).toBeDefined();
  });

  it('should handle empty workspace', () => {
    const index = new WorkspaceIndex();
    const diags = index.getDiagnostics('file:///nonexistent.pss');
    expect(diags).toHaveLength(0);
  });
});
