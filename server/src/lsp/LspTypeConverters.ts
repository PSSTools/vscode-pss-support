import {
  DocumentSymbol as LspDocumentSymbol,
  SymbolKind as LspSymbolKind,
  DiagnosticSeverity as LspDiagnosticSeverity,
  Diagnostic as LspDiagnostic,
} from 'vscode-languageserver/node';
import { DocumentSymbol, SymbolKind } from '../core/types/DocumentSymbol';
import { Diagnostic, DiagnosticSeverity } from '../core/types/Diagnostic';

export function convertSymbolKind(kind: SymbolKind): LspSymbolKind {
  switch (kind) {
    case SymbolKind.Package: return LspSymbolKind.Package;
    case SymbolKind.Component: return LspSymbolKind.Class;
    case SymbolKind.Action: return LspSymbolKind.Method;
    case SymbolKind.Struct: return LspSymbolKind.Struct;
    case SymbolKind.Buffer: return LspSymbolKind.Struct;
    case SymbolKind.Stream: return LspSymbolKind.Struct;
    case SymbolKind.State: return LspSymbolKind.Struct;
    case SymbolKind.Resource: return LspSymbolKind.Struct;
    case SymbolKind.Enum: return LspSymbolKind.Enum;
    case SymbolKind.EnumMember: return LspSymbolKind.EnumMember;
    case SymbolKind.Field: return LspSymbolKind.Field;
    case SymbolKind.Constraint: return LspSymbolKind.Property;
    case SymbolKind.Activity: return LspSymbolKind.Event;
    case SymbolKind.Function: return LspSymbolKind.Function;
    case SymbolKind.TypeDef: return LspSymbolKind.TypeParameter;
    case SymbolKind.Monitor: return LspSymbolKind.Interface;
    case SymbolKind.Covergroup: return LspSymbolKind.Namespace;
    case SymbolKind.Pool: return LspSymbolKind.Array;
    case SymbolKind.ExecBlock: return LspSymbolKind.Constructor;
  }
}

export function convertDocumentSymbol(sym: DocumentSymbol): LspDocumentSymbol {
  return {
    name: sym.name,
    kind: convertSymbolKind(sym.kind),
    range: sym.range,
    selectionRange: sym.selectionRange,
    detail: sym.detail,
    children: sym.children?.map(convertDocumentSymbol),
  };
}

export function convertSeverity(sev: DiagnosticSeverity): LspDiagnosticSeverity {
  switch (sev) {
    case DiagnosticSeverity.Error: return LspDiagnosticSeverity.Error;
    case DiagnosticSeverity.Warning: return LspDiagnosticSeverity.Warning;
    case DiagnosticSeverity.Information: return LspDiagnosticSeverity.Information;
    case DiagnosticSeverity.Hint: return LspDiagnosticSeverity.Hint;
  }
}

export function convertDiagnostic(diag: Diagnostic): LspDiagnostic {
  return {
    range: diag.range,
    severity: convertSeverity(diag.severity),
    code: diag.code,
    source: diag.source ?? 'pss',
    message: diag.message,
  };
}
