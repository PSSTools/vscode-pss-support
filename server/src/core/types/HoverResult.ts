import { SourceRange } from './SourceRange.js';

export interface HoverResult {
  contents: string;
  range?: SourceRange;
}
