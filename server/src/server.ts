/**
 * Process entry point for the PSS language server.
 *
 * The VS Code client forks this module with `--node-ipc`. Run by hand, or by
 * any other editor, it defaults to stdio. The `pss-ls` bin (`cli/pss-ls.ts`)
 * starts the same server.
 */
import { runServer } from './lsp/serverProcess.js';

runServer();
