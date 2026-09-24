/**
 * What the server takes from the client's `initialize` request.
 *
 * Clients differ in what they send. VS Code sends `workspaceFolders`; many
 * others send only `rootUri`, and some open a single file with no root at all.
 * This module turns all of those into the one shape the server acts on.
 */
import { InitializeParams } from 'vscode-languageserver/node.js';
import { pathToUri } from '../core/io/UriUtils.js';

/**
 * The workspace roots to index, as `file://` URIs.
 *
 * `workspaceFolders` if the client sent any, else `rootUri`, else the
 * deprecated `rootPath`. Empty means single-file mode: no workspace scan and no
 * `.pssconfig.json`, but open documents are still served. Roots on other URI
 * schemes are dropped, because the loader reads from the local filesystem.
 */
export function workspaceRoots(params: InitializeParams): string[] {
  let uris: string[];
  if (params.workspaceFolders && params.workspaceFolders.length > 0) {
    uris = params.workspaceFolders.map(f => f.uri);
  } else if (params.rootUri) {
    uris = [params.rootUri];
  } else if (params.rootPath) {
    uris = [pathToUri(params.rootPath)];
  } else {
    uris = [];
  }
  return uris.filter(uri => uri.startsWith('file://'));
}

/**
 * `initializationOptions` the server understands, with defaults applied.
 * Every option may be left out and anything unrecognised is ignored, so a
 * client that sends nothing, or sends options meant for another server, gets
 * the editor-neutral defaults.
 */
export interface ServerInitOptions {
  /**
   * The client can run VS Code's built-in commands
   * (`editor.action.findReferences`, `editor.action.goToTypeDefinition`) and
   * the extension's `pss.showActivityDiagram`.
   *
   * Every code lens the server produces invokes one of those, so without this
   * the server neither advertises nor returns code lenses: in another editor
   * they would be lenses that do nothing when clicked, or raise an error.
   * The VS Code extension sets it.
   */
  vscodeCommands: boolean;
}

export function serverInitOptions(raw: unknown): ServerInitOptions {
  const options = (typeof raw === 'object' && raw !== null ? raw : {}) as Record<string, unknown>;
  return {
    vscodeCommands: options.vscodeCommands === true,
  };
}
