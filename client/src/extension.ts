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
import { resolveDiagramTarget } from './diagramTarget';

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
