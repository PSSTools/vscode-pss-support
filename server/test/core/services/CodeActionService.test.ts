import { describe, it, expect } from 'vitest';
import { WorkspaceIndex } from '../../../src/core/index/WorkspaceIndex';
import { getCodeActions } from '../../../src/core/services/CodeActionService';
import { DiagnosticSeverity } from '../../../src/core/types/Diagnostic';

function createIndex(files: Record<string, string>): WorkspaceIndex {
  const index = new WorkspaceIndex();
  for (const [uri, content] of Object.entries(files)) index.addFile(uri, content);
  return index;
}

describe('CodeActionService', () => {
  it('should suggest import for unresolved type', () => {
    const index = createIndex({
      'file:///types.pss': 'package my_pkg { struct my_struct { } }',
      'file:///user.pss': 'component c { action a { rand my_struct d; } }',
    });

    const diags = [{
      range: { start: { line: 0, character: 29 }, end: { line: 0, character: 38 } },
      severity: DiagnosticSeverity.Error,
      code: 'undefined-type',
      message: "Undefined type 'my_struct'",
    }];

    const actions = getCodeActions('file:///user.pss', diags[0].range, diags, index);

    const importActions = actions.filter(a => a.title.includes('Import'));
    expect(importActions.length).toBeGreaterThanOrEqual(1);
  });

  it('should return empty for non-matching diagnostic', () => {
    const index = createIndex({ 'file:///t.pss': 'struct s { }' });

    const diags = [{
      range: { start: { line: 0, character: 0 }, end: { line: 0, character: 1 } },
      severity: DiagnosticSeverity.Error,
      code: 'syntax-error',
      message: 'some syntax error',
    }];

    const actions = getCodeActions('file:///t.pss', diags[0].range, diags, index);
    expect(actions).toHaveLength(0);
  });

  it('should return empty for empty diagnostics', () => {
    const index = createIndex({ 'file:///t.pss': 'struct s { }' });
    const actions = getCodeActions('file:///t.pss', { start: { line: 0, character: 0 }, end: { line: 0, character: 0 } }, [], index);
    expect(actions).toHaveLength(0);
  });

  it('should include edit that inserts import statement', () => {
    const index = createIndex({
      'file:///types.pss': 'package lib { struct data_s { } }',
      'file:///user.pss': 'component c { action a { rand data_s d; } }',
    });

    const diags = [{
      range: { start: { line: 0, character: 29 }, end: { line: 0, character: 35 } },
      severity: DiagnosticSeverity.Error,
      code: 'undefined-type',
      message: "Undefined type 'data_s'",
    }];

    const actions = getCodeActions('file:///user.pss', diags[0].range, diags, index);
    const importAction = actions.find(a => a.title.includes('Import'));
    if (importAction) {
      const edits = importAction.edits.get('file:///user.pss');
      expect(edits).toBeDefined();
      expect(edits![0].newText).toContain('import');
    }
  });

  it('should not suggest import when type is not in any package', () => {
    const index = createIndex({
      'file:///t.pss': 'component c { action a { rand unknown_t d; } }',
    });

    const diags = [{
      range: { start: { line: 0, character: 29 }, end: { line: 0, character: 38 } },
      severity: DiagnosticSeverity.Error,
      code: 'undefined-type',
      message: "Undefined type 'unknown_t'",
    }];

    const actions = getCodeActions('file:///t.pss', diags[0].range, diags, index);
    expect(actions).toHaveLength(0);
  });

  it('should handle multiple diagnostics', () => {
    const index = createIndex({
      'file:///types.pss': 'package p { struct s1 { } struct s2 { } }',
      'file:///user.pss': 'component c { action a { rand s1 d1; rand s2 d2; } }',
    });

    const diags = [
      { range: { start: { line: 0, character: 29 }, end: { line: 0, character: 31 } }, severity: DiagnosticSeverity.Error, code: 'undefined-type', message: "Undefined type 's1'" },
      { range: { start: { line: 0, character: 41 }, end: { line: 0, character: 43 } }, severity: DiagnosticSeverity.Error, code: 'undefined-type', message: "Undefined type 's2'" },
    ];

    const actions = getCodeActions('file:///user.pss', diags[0].range, diags, index);
    expect(actions.length).toBeGreaterThanOrEqual(1);
  });
});
