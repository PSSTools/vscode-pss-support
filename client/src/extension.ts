/* --------------------------------------------------------------------------------------------
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import { error } from 'console';
import { fstat, stat, statSync, existsSync, exists } from 'fs';
import { Server } from 'http';
import * as path from 'path';
import { extensions, workspace, ExtensionContext } from 'vscode';

import {
	LanguageClient,
	LanguageClientOptions,
	ServerOptions,
	SocketTransport,
	TransportKind,
    createClientSocketTransport
} from 'vscode-languageclient';

let client: LanguageClient;

export function activate(context: ExtensionContext) {
	// The server is implemented in node
	console.log("activate")

    var serverOptions : ServerOptions = null;
    let extension = extensions.all;

//    extension = extension.filter(extension => !extension.id.startsWith('vscode.'));
    extension = extension.filter(extension => extension.id.startsWith('zuspec.zuspec-langserver'));
    if (extension.length == 0) {
        // 
	    let serverModule = context.asAbsolutePath(
		    path.join('server', 'out', 'server.js')
	    );

	    // The debug options for the server
	    // --inspect=6009: runs the server in Node's Inspector mode so VS Code can attach to the server for debugging
	    let debugOptions = { execArgv: ['--nolazy', '--inspect=6009'] };

	    serverOptions = {
		    run: { 
                module: serverModule, 
                transport: TransportKind.ipc 
            },
		    debug: {
			    module: serverModule,
			    transport: TransportKind.ipc,
			    options: debugOptions
		    }
	    };
    } else {
        if (extension.length > 1) {
            // TODO: error
        }
        let zsp_langserver_ext = extension[0];
        // See about finding the server...
        var server_path : string = null;

        for (let subpath of ['bin/zsp-langserver', '../../build/src/zsp-langserver']) {
            for (let ext of ['', '.exe']) {
                var ex = false;
                let trial_path = path.join(zsp_langserver_ext.extensionPath, subpath + ext);
                console.log("trial_path: " + trial_path);
                if (existsSync(trial_path)) {
                    console.log("exists");

                    server_path = trial_path;
                    console.log("server_path: " + server_path);
                    break;
                } else {
                    console.log("doesn't exist");
                }
                console.log("post-if");
            }
            if (server_path != null) {
                break;
            }
        }

        if (server_path != null) {
            // TODO: error
        }

        /*
        serverOptions = {
            run: {
                command: "valgrind",
                args: [
                    "--tool=memcheck",
                    "--num-callers=32",
                    server_path
                ],
                options: {shell: true, detached: true}
            },
            debug: {
                command: "valgrind",
                args: [
                    "--tool=memcheck",
                    "--num-callers=32",
                    server_path
                ],
                options: {shell: true, detached: true}
            }
        };
         */
        serverOptions = {
            run: {
                command: server_path,
                args: [],
                options: {shell: true, detached: true}
            },
            debug: {
                command: server_path,
                args: [],
                options: {shell: true, detached: true}
            }
        };
        /*
        let tp_skt : SocketTransport = {
            kind: TransportKind.socket,
            port: 6000
        };
        serverOptions = {
            run: {
                command: server_path,
                args: [],
                options: {shell: true, detached: true},
                transport: tp_skt
            },
            debug: {
                command: server_path,
                args: [],
                options: {shell: true, detached: true},
                transport: tp_skt
            }
        };
         */
    }

    for (let e of extension) {
        console.log(e.id);
        console.log(e.extensionPath);
    }


	// If the extension is launched in debug mode then the debug server options are used
	// Otherwise the run options are used



    /*
    let socketT = createClientSocketTransport(6000);
    console.log("Created socket")
    let socket2T = createClientSocketTransport(6000);
    console.log("Created socket")
     */

	// Options to control the language client
	let clientOptions: LanguageClientOptions = {
		// Register the server for plain text documents
		documentSelector: [{ scheme: 'file', language: 'pss' }],
		synchronize: {
			// Notify the server about file changes to '.clientrc files contained in the workspace
			fileEvents: workspace.createFileSystemWatcher('**/.clientrc')
		}
	};

	// Create the language client and start the client.
	client = new LanguageClient(
		'languageServerExample',
		'Language Server Example',
		serverOptions,
		clientOptions
	);

	// Start the client. This will also launch the server
	client.start();
}

export function deactivate(): Thenable<void> | undefined {
	if (!client) {
		return undefined;
	}
	return client.stop();
}
