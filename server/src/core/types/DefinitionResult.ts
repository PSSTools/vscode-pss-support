import { SourceRange } from './SourceRange.js';

export interface DefinitionResult {
  uri: string;
  range: SourceRange;
}
