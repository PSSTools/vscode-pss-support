/**
 * Command-line dispatch for `pss-ls`.
 *
 * Pure: it decides what to do and does none of it, so the tests can cover
 * every branch without spawning a process. `pss-ls.ts` carries the decision out.
 */

export type Command =
  | { kind: 'version' }
  | { kind: 'help' }
  | { kind: 'usage-error'; message: string }
  | { kind: 'serve' };

/**
 * Decide what `pss-ls` does with `args` (argv without node and the script).
 *
 * `--version`/`-v` and `--help`/`-h` win wherever they appear; the first one
 * seen decides. A leading positional argument is an error, because `pss-ls`
 * takes no files: starting a server there would sit waiting on stdin for a
 * user who expected output. Anything else starts the server and leaves the
 * arguments for `createConnection` to read.
 */
export function dispatch(args: readonly string[]): Command {
  for (const arg of args) {
    if (arg === '--version' || arg === '-v') return { kind: 'version' };
    if (arg === '--help' || arg === '-h') return { kind: 'help' };
  }
  if (args.length > 0 && !args[0].startsWith('-')) {
    return {
      kind: 'usage-error',
      message: `pss-ls: unexpected argument '${args[0]}'. pss-ls is a language server and takes no files.`,
    };
  }
  return { kind: 'serve' };
}

export const USAGE = `\
Usage: pss-ls [--stdio | --node-ipc | --socket=PORT | --pipe=NAME]
       pss-ls --version
       pss-ls --help

Language server for the Accellera Portable Test and Stimulus Standard (PSS).
Speaks the Language Server Protocol; start it from your editor's LSP client.

Transport (default: --stdio):
  --stdio          JSON-RPC over stdin/stdout
  --node-ipc       Node IPC channel (when forked by a Node client)
  --socket=PORT    connect to a socket on PORT
  --pipe=NAME      connect to a named pipe

Options:
  -v, --version    print the version and exit
  -h, --help       print this help and exit

Configuration is read from .pssconfig.json at the workspace root.

To check PSS files from the command line or in CI, use the 'pssparser'
command from the pssparser Python package (pip install pssparser).
`;
