import { SourceRange } from './SourceRange';

export enum SymbolKind {
  Package = 1,
  Component = 2,
  Action = 3,
  Struct = 4,
  Enum = 5,
  EnumMember = 6,
  Field = 7,
  Constraint = 8,
  Activity = 9,
  Function = 10,
  TypeDef = 11,
  Buffer = 12,
  Stream = 13,
  State = 14,
  Resource = 15,
  Monitor = 16,
  Covergroup = 17,
  Pool = 18,
  ExecBlock = 19,
}

export interface DocumentSymbol {
  name: string;
  detail?: string;
  kind: SymbolKind;
  range: SourceRange;
  selectionRange: SourceRange;
  children?: DocumentSymbol[];
}
