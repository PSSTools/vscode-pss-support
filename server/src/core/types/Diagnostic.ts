import { SourceRange } from './SourceRange';

export enum DiagnosticSeverity {
  Error = 1,
  Warning = 2,
  Information = 3,
  Hint = 4,
}

export interface Diagnostic {
  range: SourceRange;
  severity: DiagnosticSeverity;
  code?: string;
  source?: string;
  message: string;
  /** File ID from the AST -- used for routing diagnostics to the correct file. */
  fileId?: number;
  relatedInformation?: DiagnosticRelatedInformation[];
}

export interface DiagnosticRelatedInformation {
  location: { uri: string; range: SourceRange };
  message: string;
  /** File ID from the AST -- used for routing diagnostics to the correct file. */
  fileId?: number;
}
