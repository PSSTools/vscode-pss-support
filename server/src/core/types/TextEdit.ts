import { SourceRange } from './SourceRange';

export interface TextEdit {
  range: SourceRange;
  newText: string;
}
