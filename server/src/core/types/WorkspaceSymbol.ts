import { SymbolKind } from './DocumentSymbol';
import { SourceRange } from './SourceRange';

/**
 * A symbol in the workspace-wide symbol list (Ctrl-T), flattened out of the
 * per-file DocumentSymbol trees and carrying the URI needed to navigate to it.
 */
export interface WorkspaceSymbol {
  name: string;
  kind: SymbolKind;
  uri: string;
  range: SourceRange;
  selectionRange: SourceRange;
  /** Dotted path of enclosing symbols, e.g. 'my_pkg.my_comp'. Empty at top level. */
  containerName: string;
}
