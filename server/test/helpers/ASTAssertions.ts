import { expect } from 'vitest';
import { Diagnostic } from '../../src/core/types/Diagnostic';

export function assertDiagnosticAt(
  diagnostics: Diagnostic[],
  line: number,
  character: number,
  messageSubstring?: string,
): void {
  const found = diagnostics.find(
    d => d.range.start.line === line && d.range.start.character === character,
  );
  expect(found, `Expected diagnostic at line ${line}, char ${character}`).toBeDefined();
  if (messageSubstring && found) {
    expect(found.message).toContain(messageSubstring);
  }
}

export function assertNoDiagnostics(diagnostics: Diagnostic[]): void {
  expect(diagnostics, `Expected no diagnostics but got ${diagnostics.length}`).toHaveLength(0);
}
