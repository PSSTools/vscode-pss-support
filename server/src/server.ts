/**
 * Process entry point for the PSS language server.
 *
 * All wiring lives in PSSLanguageServer.startLanguageServer, which can be
 * started on any Connection; this file only supplies the stdio one.
 */
import { createConnection, ProposedFeatures } from 'vscode-languageserver/node';
import { startLanguageServer } from './lsp/PSSLanguageServer';

const connection = createConnection(ProposedFeatures.all);
startLanguageServer(connection);
connection.listen();
