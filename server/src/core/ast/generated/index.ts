/**
 * The PSS AST classes, re-exported from `@psstools/pssparser`.
 *
 * This directory used to hold ~2,000 lines emitted by `npm run gen:ast`,
 * which ran astbuilder over `packages/pssparser/ast/*.yaml` -- the same
 * schema, the same generator, the same output as the copy inside the parser
 * package. Two generated copies of one schema is one copy too many, and the
 * duplicate was not merely redundant: it was *wrong*.
 *
 * The services dispatch on node type with `instanceof` in dozens of places.
 * `instanceof` compares constructor identity, not shape, so a tree built by
 * the parser out of *its* classes fails every check written against *ours* --
 * silently. Nothing throws; the analyzer simply finds nothing. Sharing one set
 * of constructors is what makes the WASM parser and this server agree on what
 * a `Component` is.
 *
 * The file stays at this path, rather than the importers moving to
 * `@psstools/pssparser/ast`, because 46 files import from here and the
 * indirection is worth keeping: if the AST ever needs a server-local
 * augmentation, this is where it goes.
 *
 * Named `generated/` for the same reason -- the path is load-bearing for those
 * 46 imports -- though nothing generates it any more. It is checked in.
 */
export * from '@psstools/pssparser/ast';
