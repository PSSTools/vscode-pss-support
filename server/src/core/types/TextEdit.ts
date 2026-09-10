import { SourceRange } from './SourceRange.js';

export interface TextEdit {
  range: SourceRange;
  newText: string;
}
