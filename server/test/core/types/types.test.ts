import { describe, it, expect } from 'vitest';
import {
  DiagnosticSeverity,
  CompletionKind,
  SymbolKind,
  DiagramNodeKind,
  DiagramEdgeStyle,
} from '../../../src/core/types';

describe('Model Types', () => {
  it('DiagnosticSeverity has correct values', () => {
    expect(DiagnosticSeverity.Error).toBe(1);
    expect(DiagnosticSeverity.Warning).toBe(2);
    expect(DiagnosticSeverity.Information).toBe(3);
    expect(DiagnosticSeverity.Hint).toBe(4);
  });

  it('CompletionKind has correct values', () => {
    expect(CompletionKind.Keyword).toBe(1);
    expect(CompletionKind.Type).toBe(2);
    expect(CompletionKind.Action).toBe(9);
  });

  it('SymbolKind has correct values', () => {
    expect(SymbolKind.Package).toBe(1);
    expect(SymbolKind.Component).toBe(2);
    expect(SymbolKind.Action).toBe(3);
    expect(SymbolKind.Enum).toBe(5);
  });

  it('DiagramNodeKind has correct string values', () => {
    expect(DiagramNodeKind.Action).toBe('action');
    expect(DiagramNodeKind.Fork).toBe('fork');
    expect(DiagramNodeKind.Join).toBe('join');
  });

  it('DiagramEdgeStyle has correct string values', () => {
    expect(DiagramEdgeStyle.Solid).toBe('solid');
    expect(DiagramEdgeStyle.Dashed).toBe('dashed');
  });

  it('Diagnostic can be serialized to JSON', () => {
    const diag = {
      range: {
        start: { line: 0, character: 5 },
        end: { line: 0, character: 10 },
      },
      severity: DiagnosticSeverity.Error,
      message: 'test error',
    };
    const json = JSON.stringify(diag);
    const parsed = JSON.parse(json);
    expect(parsed.severity).toBe(1);
    expect(parsed.range.start.line).toBe(0);
    expect(parsed.message).toBe('test error');
  });
});
