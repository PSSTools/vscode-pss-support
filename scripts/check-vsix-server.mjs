/**
 * The `vscode:prepublish` guard: `vsce package` runs it before packaging.
 *
 * The extension starts the server from `client/node_modules/@psstools/
 * pss-language-server`. In a checkout that path is the `file:../server` link,
 * and vsce cannot package a symlinked directory: secretlint fails with EISDIR
 * and never says which path it was. A VSIX is built with `npm run
 * package:vsix`, which installs the packed tarball there as a real directory.
 * This turns the EISDIR into an error that says so.
 *
 * It also checks that the server carries the extension's version: one tag
 * releases both, and a VSIX must not ship a server version that npm will
 * never have.
 */
import { existsSync, lstatSync, readFileSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const SERVER = join(ROOT, 'client', 'node_modules', '@psstools', 'pss-language-server');

function fail(message) {
  console.error(`error: ${message}`);
  process.exit(1);
}

if (!existsSync(SERVER)) {
  fail(`${SERVER} is missing. Build the VSIX with \`npm run package:vsix\`.`);
}
if (lstatSync(SERVER).isSymbolicLink()) {
  fail(`${SERVER} is the file:../server development link, and vsce cannot package a
symlinked directory. Build the VSIX with \`npm run package:vsix\`, which installs
the packed server tarball in its place (and puts the link back afterwards).`);
}
if (!existsSync(join(SERVER, 'out', 'server.js'))) {
  fail(`${SERVER} has no out/server.js; it is not an installed server package.`);
}

const extension = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf-8')).version;
const server = JSON.parse(readFileSync(join(SERVER, 'package.json'), 'utf-8')).version;
if (server !== extension) {
  fail(`the installed server is version ${server} but the extension is ${extension}.
Stamp both with the same version before packing the server.`);
}
