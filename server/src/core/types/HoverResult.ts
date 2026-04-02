import { SourceRange } from './SourceRange';

export interface HoverResult {
  contents: string;
  range?: SourceRange;
}
