import * as path from 'path';
import * as vscode from 'vscode';
import { workspace, ExtensionContext } from 'vscode';

import {
    LanguageClient,
    LanguageClientOptions,
    ServerOptions,
    TransportKind,
} from 'vscode-languageclient/node';

import { ActivityDiagramPanel } from './views/ActivityDiagramPanel';

let client: LanguageClient;

export function activate(context: ExtensionContext): void {
    const serverModule = context.asAbsolutePath(
        path.join('server', 'out', 'server.js')
    );

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
        synchronize: {
            fileEvents: workspace.createFileSystemWatcher('**/*.pss'),
        },
    };

    client = new LanguageClient(
        'pssLanguageServer',
        'PSS Language Server',
        serverOptions,
        clientOptions
    );

    // Register the activity diagram command
    const diagramCmd = vscode.commands.registerCommand(
        'pss.showActivityDiagram',
        async (uri?: string, line?: number) => {
            // Resolve URI and line from arguments or active editor
            let targetUri = uri;
            let targetLine = line ?? 0;

            if (!targetUri) {
                const editor = vscode.window.activeTextEditor;
                if (!editor || editor.document.languageId !== 'pss') {
                    vscode.window.showWarningMessage('Open a PSS file with an activity block first.');
                    return;
                }
                targetUri = editor.document.uri.toString();
                targetLine = editor.selection.active.line;
            }

            try {
                const graph = await client.sendRequest('pss/activityDiagram', {
                    uri: targetUri,
                    line: targetLine,
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
