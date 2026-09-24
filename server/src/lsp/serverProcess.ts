/**
 * Starting the language server in the current process.
 *
 * Shared by `server.ts` (the module the VS Code client forks) and the `pss-ls`
 * bin, so both pick their transport the same way.
 */
import { createConnection, ProposedFeatures } from 'vscode-languageserver/node.js';
import { startLanguageServer } from './PSSLanguageServer.js';

/**
 * Whether `args` names a transport that `createConnection` understands.
 *
 * Mirrors the scan in `vscode-languageserver/node`: `--node-ipc`, `--stdio`,
 * `--socket=N` / `--socket N`, `--pipe=NAME` / `--pipe NAME`.
 */
export function hasTransportFlag(args: readonly string[]): boolean {
  return args.some(arg =>
    arg === '--node-ipc'
    || arg === '--stdio'
    || arg === '--socket' || arg.startsWith('--socket=')
    || arg === '--pipe' || arg.startsWith('--pipe='));
}

/**
 * `args` with `--stdio` appended when no transport was named.
 *
 * Without a flag, `createConnection` throws. Stdio is what every non-VS Code
 * client expects, so it is the default. The flag goes onto argv, rather than
 * passing `process.stdin`/`process.stdout` to `createConnection`, because the
 * library only redirects `console.*` to the client log when it sees `--stdio`
 * on the command line; without that, a stray `console.log` would corrupt the
 * protocol stream.
 */
export function withDefaultTransport(args: readonly string[]): string[] {
  return hasTransportFlag(args) ? [...args] : [...args, '--stdio'];
}

/** Start the server on the transport named by `process.argv`, defaulting to stdio. */
export function runServer(): void {
  const args = withDefaultTransport(process.argv.slice(2));
  process.argv.splice(2, process.argv.length - 2, ...args);

  const connection = createConnection(ProposedFeatures.all);
  startLanguageServer(connection);
  connection.listen();
}
