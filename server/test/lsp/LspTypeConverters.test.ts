import { describe, it, expect } from 'vitest';
import {
  SymbolKind as LspSymbolKind,
  DiagnosticSeverity as LspDiagnosticSeverity,
} from 'vscode-languageserver/node';
import {
  convertSymbolKind,
  convertSeverity,
  convertDiagnostic,
  convertDocumentSymbol,
} from '../../src/lsp/LspTypeConverters';
import { SymbolKind, DocumentSymbol } from '../../src/core/types/DocumentSymbol';
import { DiagnosticSeverity } from '../../src/core/types/Diagnostic';

/**
 * The converters are two hand-written enum tables that decide which icon the
 * user sees in the outline and how severe a diagnostic looks. A wrong arm here
 * is invisible to every core test, because core never sees an LSP constant.
 *
 * The exhaustiveness tests matter more than the individual mappings: they fail
 * when a new SymbolKind is added and the table is not updated, which is the
 * realistic way this breaks.
 */

const EXPECTED_SYMBOL_KINDS: Record<SymbolKind, LspSymbolKind> = {
  [SymbolKind.Package]: LspSymbolKind.Package,
  [SymbolKind.Component]: LspSymbolKind.Class,
  [SymbolKind.Action]: LspSymbolKind.Method,
  [SymbolKind.Struct]: LspSymbolKind.Struct,
  [SymbolKind.Buffer]: LspSymbolKind.Struct,
  [SymbolKind.Stream]: LspSymbolKind.Struct,
  [SymbolKind.State]: LspSymbolKind.Struct,
  [SymbolKind.Resource]: LspSymbolKind.Struct,
  [SymbolKind.Enum]: LspSymbolKind.Enum,
  [SymbolKind.EnumMember]: LspSymbolKind.EnumMember,
  [SymbolKind.Field]: LspSymbolKind.Field,
  [SymbolKind.Constraint]: LspSymbolKind.Property,
  [SymbolKind.Activity]: LspSymbolKind.Event,
  [SymbolKind.Function]: LspSymbolKind.Function,
  [SymbolKind.TypeDef]: LspSymbolKind.TypeParameter,
  [SymbolKind.Monitor]: LspSymbolKind.Interface,
  [SymbolKind.Covergroup]: LspSymbolKind.Namespace,
  [SymbolKind.Pool]: LspSymbolKind.Array,
  [SymbolKind.ExecBlock]: LspSymbolKind.Constructor,
};

/** Numeric members of a TS numeric enum (the reverse mapping adds string keys). */
function enumValues(e: object): number[] {
  return Object.values(e).filter((v): v is number => typeof v === 'number');
}

/** Name of a SymbolKind member, for readable test titles. */
function symbolKindName(kind: number): string {
  return (SymbolKind as unknown as Record<number, string>)[kind] ?? `kind${kind}`;
}

describe('convertSymbolKind', () => {
  for (const kind of enumValues(SymbolKind) as SymbolKind[]) {
    const expected = EXPECTED_SYMBOL_KINDS[kind];
    it(`maps ${symbolKindName(kind)} to LSP kind ${expected}`, () => {
      expect(convertSymbolKind(kind)).toBe(expected);
    });
  }

  it('covers every SymbolKind -- a new kind must be added to the table', () => {
    const declared = enumValues(SymbolKind).sort((a, b) => a - b);
    const covered = Object.keys(EXPECTED_SYMBOL_KINDS).map(Number).sort((a, b) => a - b);
    expect(covered).toEqual(declared);
  });

  it('returns a defined LSP kind for every SymbolKind', () => {
    for (const kind of enumValues(SymbolKind)) {
      expect(convertSymbolKind(kind), `SymbolKind.${symbolKindName(kind)} maps to undefined`)
        .toBeDefined();
    }
  });
});

describe('convertSeverity', () => {
  it('maps every severity', () => {
    expect(convertSeverity(DiagnosticSeverity.Error)).toBe(LspDiagnosticSeverity.Error);
    expect(convertSeverity(DiagnosticSeverity.Warning)).toBe(LspDiagnosticSeverity.Warning);
    expect(convertSeverity(DiagnosticSeverity.Information)).toBe(LspDiagnosticSeverity.Information);
    expect(convertSeverity(DiagnosticSeverity.Hint)).toBe(LspDiagnosticSeverity.Hint);
  });

  it('covers every declared severity', () => {
    for (const severity of enumValues(DiagnosticSeverity)) {
      expect(convertSeverity(severity), `severity ${severity} maps to undefined`).toBeDefined();
    }
  });
});

describe('convertDiagnostic', () => {
  const base = {
    range: { start: { line: 1, character: 2 }, end: { line: 1, character: 8 } },
    severity: DiagnosticSeverity.Error,
    message: "Undefined type 'foo'",
  };

  it('preserves range, message, severity and code', () => {
    const out = convertDiagnostic({ ...base, code: 'undefined-type' });
    expect(out.range).toEqual(base.range);
    expect(out.message).toBe(base.message);
    expect(out.severity).toBe(LspDiagnosticSeverity.Error);
    expect(out.code).toBe('undefined-type');
  });

  it('defaults the source to "pss"', () => {
    expect(convertDiagnostic(base).source).toBe('pss');
  });

  it('keeps an explicit source', () => {
    expect(convertDiagnostic({ ...base, source: 'other' }).source).toBe('other');
  });
});

describe('convertDocumentSymbol', () => {
  const symbol: DocumentSymbol = {
    name: 'dev_c',
    kind: SymbolKind.Component,
    detail: 'component',
    range: { start: { line: 0, character: 0 }, end: { line: 5, character: 1 } },
    selectionRange: { start: { line: 0, character: 10 }, end: { line: 0, character: 15 } },
    children: [{
      name: 'write_a',
      kind: SymbolKind.Action,
      range: { start: { line: 1, character: 4 }, end: { line: 3, character: 5 } },
      selectionRange: { start: { line: 1, character: 11 }, end: { line: 1, character: 18 } },
    }],
  };

  it('converts the whole tree, kinds included', () => {
    const out = convertDocumentSymbol(symbol);
    expect(out.name).toBe('dev_c');
    expect(out.kind).toBe(LspSymbolKind.Class);
    expect(out.detail).toBe('component');
    expect(out.range).toEqual(symbol.range);
    expect(out.selectionRange).toEqual(symbol.selectionRange);
    expect(out.children).toHaveLength(1);
    expect(out.children![0].name).toBe('write_a');
    expect(out.children![0].kind).toBe(LspSymbolKind.Method);
  });

  it('leaves children undefined when there are none', () => {
    const out = convertDocumentSymbol({ ...symbol, children: undefined });
    expect(out.children).toBeUndefined();
  });
});
