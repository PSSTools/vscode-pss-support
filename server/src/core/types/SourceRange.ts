import { SourcePosition } from './SourcePosition.js';

export interface SourceRange {
  start: SourcePosition;
  end: SourcePosition;
}
