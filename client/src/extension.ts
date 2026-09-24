import * as vscode from 'vscode';
import { ExtensionContext } from 'vscode';

import {
    LanguageClient,
    LanguageClientOptions,
    ServerOptions,
    TransportKind,
} from 'vscode-languageclient/node';

import { ActivityDiagramPanel } from './views/ActivityDiagramPanel';
import { resolveDiagramTarget } from './diagramTarget';

let client: LanguageClient;

export function activate(context: ExtensionContext): void {
    // The server is the @psstools/pss-language-server npm package. In a
    // checkout this resolves through the file:../server link to server/out;
    // in a VSIX it is the packed tarball under client/node_modules.
    const serverModule = require.resolve('@psstools/pss-language-server/server');

    const debugOptions = { execArgv: ['--nolazy', '--inspect=6009'] };

    const serverOptions: ServerOptions = {
        run: {
            module: serverModule,
            transport: TransportKind.ipc,
        },
        debug: {
            module: serverModule,
            transport: TransportKind.ipc,
            options: debugOptions,
        },
    };

    const clientOptions: LanguageClientOptions = {
        documentSelector: [{ scheme: 'file', language: 'pss' }],
        // The server's code lenses run VS Code commands, so it only offers
        // them to a client that says it can run them.
        initializationOptions: { vscodeCommands: true },
        // No synchronize.fileEvents: the server registers its own watcher
        // for **/*.pss, as it does with any client that allows it.
    };

    // The id is also the settings section vscode-languageclient reads its
    // trace level from, so 'pss' makes it read pss.trace.server.
    client = new LanguageClient(
        'pss',
        'PSS Language Server',
        serverOptions,
        clientOptions
    );

    // Register the activity diagram command
    const diagramCmd = vscode.commands.registerCommand(
        'pss.showActivityDiagram',
        async (uri?: string, line?: number) => {
            const editor = vscode.window.activeTextEditor;
            const target = resolveDiagramTarget(uri, line, editor && {
                uri: editor.document.uri.toString(),
                languageId: editor.document.languageId,
                activeLine: editor.selection.active.line,
            });

            if (!target.ok) {
                vscode.window.showWarningMessage('Open a PSS file with an activity block first.');
                return;
            }

            try {
                const graph = await client.sendRequest('pss/activityDiagram', {
                    uri: target.uri,
                    line: target.line,
                });

                if (!graph) {
                    vscode.window.showInformationMessage('No activity block found at this location.');
                    return;
                }

                ActivityDiagramPanel.createOrShow(
                    context.extensionUri,
                    graph as any,
                    'Activity Diagram',
                );
            } catch (err: unknown) {
                const msg = err instanceof Error ? err.message : String(err);
                vscode.window.showErrorMessage(`Failed to build activity diagram: ${msg}`);
            }
        }
    );

    context.subscriptions.push(diagramCmd);
    client.start();
}

export function deactivate(): Thenable<void> | undefined {
    if (!client) {
        return undefined;
    }
    return client.stop();
}
