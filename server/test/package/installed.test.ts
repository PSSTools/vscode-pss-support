/**
 * The installed package, tested the way users run it (plan 3.2-3.4).
 *
 * `globalSetup.ts` packs the server and installs the tarball outside the repo.
 * These tests catch what the in-process suites cannot: a file missing from
 * `files`, a lost shebang, the WASM parser not resolving from a registry
 * install, an `exports` path that does not exist, or an ES module path that
 * only works from the source tree.
 */
import { describe, it, expect, beforeAll, afterAll, afterEach, inject } from 'vitest';
import { execFile } from 'child_process';
import { createRequire } from 'module';
import { mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync, realpathSync } from 'fs';
import { tmpdir } from 'os';
import { join, relative, sep } from 'path';
import { pathToFileURL } from 'url';
import { promisify } from 'util';
import {
  InitializeRequest,
  InitializedNotification,
  DefinitionRequest,
  ShutdownRequest,
  ExitNotification,
  Location,
} from 'vscode-languageserver-protocol/node.js';
import { binPath, spawnBin, forkIpc, waitFor, exitWithin, ServerProcess } from './lspProcess.js';

const run = promisify(execFile);
const IS_WINDOWS = process.platform === 'win32';

const installDir = inject('installDir');
const packageDir = inject('packageDir');

const PKG_TEXT = 'package p {\n    struct data_s {\n        rand bit[32] addr;\n    }\n}\n';
const TOP_TEXT = 'import p::*;\ncomponent top_c {\n    data_s cfg;\n    nowhere_s bad;\n}\n';

let workspace: string;
let server: ServerProcess | undefined;

beforeAll(() => {
  workspace = realpathSync(mkdtempSync(join(tmpdir(), 'pss-ls-ws-')));
  writeFileSync(join(workspace, 'pkg.pss'), PKG_TEXT);
  writeFileSync(join(workspace, 'top.pss'), TOP_TEXT);
});

afterAll(() => {
  rmSync(workspace, { recursive: true, force: true });
});

afterEach(() => {
  server?.dispose();
  server = undefined;
});

function runBin(args: string[]) {
  return run(binPath(installDir), args, { cwd: installDir, shell: IS_WINDOWS });
}

/**
 * The session every transport must support: index a workspace, report a
 * cross-file error, resolve a cross-file definition, and shut down cleanly.
 */
async function workspaceSession(s: ServerProcess): Promise<void> {
  const rootUri = pathToFileURL(workspace).href;
  const topUri = pathToFileURL(join(workspace, 'top.pss')).href;
  const pkgUri = pathToFileURL(join(workspace, 'pkg.pss')).href;

  const init = await s.alive(s.connection.sendRequest(InitializeRequest.type, {
    processId: process.pid,
    rootUri,
    capabilities: {},
    workspaceFolders: null,
  }));
  expect(init.capabilities.definitionProvider).toBe(true);
  await s.connection.sendNotification(InitializedNotification.type, {});

  // The workspace scan publishes for every file, without any didOpen.
  const top = await s.alive(waitFor(() => s.diagnostics.find(d => d.uri === topUri), 'no diagnostics for top.pss'));
  expect(top.diagnostics.map(d => d.message).join('\n')).toContain('nowhere_s');
  const pkg = await s.alive(waitFor(() => s.diagnostics.find(d => d.uri === pkgUri), 'no diagnostics for pkg.pss'));
  expect(pkg.diagnostics).toEqual([]);

  // `data_s` in top.pss is declared in pkg.pss.
  const def = await s.alive(s.connection.sendRequest(DefinitionRequest.type, {
    textDocument: { uri: topUri },
    position: { line: 2, character: 6 },
  }));
  const locations = (Array.isArray(def) ? def : [def]) as Location[];
  expect(locations).toHaveLength(1);
  expect(locations[0].uri).toBe(pkgUri);
  expect(locations[0].range.start.line).toBe(1);

  await s.alive(s.connection.sendRequest(ShutdownRequest.type));
  await s.connection.sendNotification(ExitNotification.type);
  expect(await exitWithin(s, 5000)).toBe(0);
}

describe('installed package contents', () => {
  it('ships only compiled JavaScript, the README, the LICENSE and package.json', () => {
    const files: string[] = [];
    const walk = (dir: string) => {
      for (const name of readdirSync(dir)) {
        const path = join(dir, name);
        if (statSync(path).isDirectory()) walk(path);
        else files.push(relative(packageDir, path).split(sep).join('/'));
      }
    };
    walk(packageDir);

    const unexpected = files.filter(f =>
      !(f.startsWith('out/') && f.endsWith('.js')) && !['README.md', 'LICENSE', 'package.json'].includes(f));
    expect(unexpected).toEqual([]);
    expect(files).toContain('out/server.js');
    expect(files).toContain('out/cli/pss-ls.js');
  });

  it('keeps the shebang on the bin', () => {
    const bin = readFileSync(join(packageDir, 'out', 'cli', 'pss-ls.js'), 'utf-8');
    expect(bin.split('\n')[0]).toBe('#!/usr/bin/env node');
  });

  it('exports ./server and nothing internal', () => {
    const require = createRequire(join(installDir, 'package.json'));
    expect(require.resolve('@psstools/pss-language-server/server')).toBe(join(packageDir, 'out', 'server.js'));
    expect(require('@psstools/pss-language-server/package.json').name).toBe('@psstools/pss-language-server');
    let code: string | undefined;
    try {
      require.resolve('@psstools/pss-language-server/out/lsp/PSSLanguageServer.js');
    } catch (e) {
      code = (e as NodeJS.ErrnoException).code;
    }
    expect(code).toBe('ERR_PACKAGE_PATH_NOT_EXPORTED');
  });
});

describe('pss-ls command line', () => {
  it('prints the packed version for --version', async () => {
    const packed = JSON.parse(readFileSync(join(packageDir, 'package.json'), 'utf-8'));
    const { stdout } = await runBin(['--version']);
    expect(stdout.trim()).toBe(packed.version);
  });

  it('prints usage for --help and exits 0', async () => {
    const { stdout } = await runBin(['--help']);
    expect(stdout).toContain('Usage: pss-ls');
    expect(stdout).toContain('pssparser');
  });

  // Stdin is left open: a server started by mistake would wait on it forever.
  it('rejects a positional argument with exit 2 instead of waiting on stdin', async () => {
    server = spawnBin(installDir, ['foo']);
    expect(await exitWithin(server, 5000)).toBe(2);
    expect(server.stderr()).toContain("unexpected argument 'foo'");
    expect(server.stderr()).toContain('Usage: pss-ls');
  });
});

describe('language server session', () => {
  it('over stdio with --stdio', async () => {
    server = spawnBin(installDir, ['--stdio']);
    await workspaceSession(server);
  });

  it('over stdio with no transport flag', async () => {
    server = spawnBin(installDir, []);
    await workspaceSession(server);
  });

  it('over Node IPC from the ./server export, as the VS Code extension starts it', async () => {
    const require = createRequire(join(installDir, 'package.json'));
    server = forkIpc(require.resolve('@psstools/pss-language-server/server'), installDir);
    await workspaceSession(server);
  });
});
