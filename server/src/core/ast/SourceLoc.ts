/**
 * The one place that knows the parser and LSP disagree about column bases.
 *
 * Parser locations are 1-based in both axes; LSP positions are 0-based in
 * both. Lines were already converted at every site (`loc.lineno - 1`) because
 * the previous front end was 1-based there too, but it reported columns
 * 0-based, so `loc.linepos` used to be usable as-is. It no longer is.
 *
 * The conversion lives in a function rather than as a `- 1` sprinkled at each
 * site so that the next front end change has one place to land, and so that a
 * reader of any single site can see which base they are looking at.
 */

/** Location fields shared by every AST node, and by `Marker`. */
export interface HasColumn {
  linepos: number;
}

/**
 * The 0-based LSP character offset for a parser location.
 *
 * A `linepos` of 0 or less means the parser had no column for the node --
 * synthesised nodes carry that. Clamping rather than returning -1 keeps such
 * a node addressable at the start of its line instead of producing a range
 * the client will reject.
 */
export function lspChar(loc: HasColumn): number {
  return loc.linepos > 0 ? loc.linepos - 1 : 0;
}

/**
 * fileid of a node the linker made up rather than read.
 *
 * `link()` grafts members onto user types: every action gets a `comp` handle
 * for its enclosing component, every component the `set_executor` prototype
 * from the standard library. They are indistinguishable from written members
 * except by this -- same class, same parent, same `children` array.
 */
const FILEID_SYNTHETIC = -1;

/**
 * True when the node appears in someone's source text.
 *
 * Anything that reproduces source -- the formatter, the outline, semantic
 * tokens, folding ranges -- must ask this before emitting a node, or it will
 * emit members the user never wrote. The formatter is the sharpest case: it
 * writes `comp` into the document, and formatting the result writes a second
 * one, so the output grows on every save.
 */
export function isWritten(node: { location: { fileid: number } }): boolean {
  return node.location.fileid !== FILEID_SYNTHETIC;
}
