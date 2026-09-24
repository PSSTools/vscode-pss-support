#!/usr/bin/env node
/**
 * pss-ls: the package's only bin. Starts the PSS language server.
 *
 * The decision is made in `dispatch.ts`, where it is tested. This file only
 * acts on it, and is covered by the package tests against the installed bin.
 */
import { readFileSync } from 'fs';
import { dispatch, USAGE } from './dispatch.js';
import { runServer } from '../lsp/serverProcess.js';

function packageVersion(): string {
  // out/cli/pss-ls.js and src/cli/pss-ls.ts are both two levels below the
  // package root.
  const pkg = JSON.parse(readFileSync(new URL('../../package.json', import.meta.url), 'utf-8'));
  return pkg.version;
}

const command = dispatch(process.argv.slice(2));
switch (command.kind) {
  case 'version':
    process.stdout.write(`${packageVersion()}\n`);
    break;
  case 'help':
    process.stdout.write(USAGE);
    break;
  case 'usage-error':
    process.stderr.write(`${command.message}\n\n${USAGE}`);
    process.exitCode = 2;
    break;
  case 'serve':
    runServer();
    break;
}
