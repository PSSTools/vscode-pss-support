/**
 * Owns the one WASM instance in the process and hands out `Parser`s.
 *
 * The WASM module has to be loaded asynchronously, but nothing downstream of
 * here should have to be async because of it: `WorkspaceIndex` is called from
 * LSP handlers and from 75 test sites, all of which are synchronous today.
 * Making them async to accommodate a one-time load would be a wide change for
 * a startup detail.
 *
 * So the await happens exactly once, at module scope. ESM guarantees a module
 * body runs to completion before any importer's body runs, which means every
 * consumer of `newParser()` observes an initialised module without doing
 * anything to arrange it. This is the payoff for the server being ESM: the
 * same guarantee is unavailable in CommonJS, where the only route to an
 * ESM-only dependency is `await import()` at some caller's expense.
 */
import { Parser, initPssParser } from '@psstools/pssparser';

const wasm = await initPssParser();

/**
 * A fresh parser with its own WASM-side session.
 *
 * One per `WorkspaceIndex` rather than one shared: sessions accumulate parsed
 * units, so two indexes sharing a session would see each other's files. Tests
 * construct indexes freely and must stay independent.
 *
 * The caller owns it and must `dispose()` it -- the WASM heap is not reachable
 * by the JavaScript garbage collector.
 */
export function newParser(): Parser {
  // Doc comments are not collected by default, and this server renders them on
  // hover. Off, the feature degrades to a bare signature with no explanation
  // of why -- so it is enabled here rather than at any single call site.
  return new Parser(new wasm.ParserSession(), { collectDocstrings: true });
}
