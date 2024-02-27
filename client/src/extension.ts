/* --------------------------------------------------------------------------------------------
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import * as path from 'path';
import { workspace, ExtensionContext, extensions } from 'vscode';
import { access, constants } from 'node:fs/promises';
//import { access, constants } from 'node:fs';

import {
    Executable,
	LanguageClient,
	LanguageClientOptions,
	ServerOptions,
	TransportKind,
    createClientSocketTransport
} from 'vscode-languageclient';
import { log } from 'console';
import { ConsoleErrorListener } from 'antlr4ts';

let client: LanguageClient;

export function activate(context: ExtensionContext) {
	// The server is implemented in node
    const fs = require("fs");
	console.log("activate")


    var serverOptions = null;
    let my_ext = extensions.getExtension('matthew-ballance.vscode-pss-support')
    console.log("Extension path: " + my_ext.extensionPath)

    try {

        // Have a native-executable language server
        access(my_ext.extensionPath + "/platform/zsp-langserver", fs.constants.F_OK);
        console.log("Platform exists");

        let LaunchCommand : Executable = {
                command: my_ext.extensionPath + "/platform/zsp_langserver",
                args: []
        }

        /*
    	let serverOptions: ServerOptions = {
		    run: LaunchCommand,
            debug: LaunchCommand
        };
         */
        serverOptions = LaunchCommand;

        /*
                module: serverModule, transport: TransportKind.ipc },
		    debug: {
			    module: serverModule,
			    transport: TransportKind.ipc,
    			options: debugOptions
		    }
	    };
         */
    } catch(e) {
        // Use the TypeScript language server
        console.log("Platform doesn't exist: " + e.Message);
    	let serverModule = context.asAbsolutePath(
    		path.join('server', 'out', 'server.js')
    	);

    	// The debug options for the server
    	// --inspect=6009: runs the server in Node's Inspector mode so VS Code can attach to the server for debugging
    	let debugOptions = { execArgv: ['--nolazy', '--inspect=6009'] };

    	// If the extension is launched in debug mode then the debug server options are used
    	// Otherwise the run options are used
    	serverOptions = {
		    run: { module: serverModule, transport: TransportKind.ipc },
		    debug: {
			    module: serverModule,
			    transport: TransportKind.ipc,
    			options: debugOptions
		    }
	    };
    }

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

    console.log("About to start server");

	// Start the client. This will also launch the server
	client.start();
}

export function deactivate(): Thenable<void> | undefined {
	if (!client) {
		return undefined;
	}
	return client.stop();
}
