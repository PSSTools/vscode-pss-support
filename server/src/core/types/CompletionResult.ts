export enum CompletionKind {
  Keyword = 1,
  Type = 2,
  Field = 3,
  Function = 4,
  Enum = 5,
  EnumMember = 6,
  Snippet = 7,
  Package = 8,
  Action = 9,
  Component = 10,
  Struct = 11,
  Constraint = 12,
  Activity = 13,
}

export interface CompletionResult {
  label: string;
  kind: CompletionKind;
  detail?: string;
  documentation?: string;
  insertText?: string;
  sortText?: string;
}
