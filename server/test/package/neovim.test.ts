/**
 * Neovim's built-in LSP client against the installed bin (plan 3.6).
 *
 * The profile matrix checks the server against Neovim's capabilities; this
 * checks a real Neovim can start `pss-ls`, receives its diagnostics and
 * navigates with it. Skipped when there is no Neovim: set NVIM_BIN, or put
 * `nvim` (0.11 or later) on PATH. In CI it runs without blocking the build
 * until it has proven stable.
 */
import { describe, it, expect, beforeAll, afterAll, inject } from 'vitest';
import { execFileSync, spawnSync } from 'child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync, realpathSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import { binPath } from './lspProcess.js';

const installDir = inject('installDir');
const SCRIPT = fileURLToPath(new URL('neovim-smoke.lua', import.meta.url));

// NVIM_BIN is a demand, `nvim` on PATH an opportunity: a NVIM_BIN that does
// not run is an error rather than a skip. CI's Neovim job sets it, and a job
// that skipped its only test would otherwise report green.
function findNvim(): string | undefined {
  const candidate = process.env.NVIM_BIN ?? 'nvim';
  const probe = spawnSync(candidate, ['--version'], { encoding: 'utf-8' });
  if (probe.status === 0) return candidate;
  if (process.env.NVIM_BIN) {
    throw new Error(`NVIM_BIN=${candidate} does not run: ${probe.error?.message ?? probe.stderr}`);
  }
  return undefined;
}
const nvim = findNvim();

let workspace: string;

beforeAll(() => {
  workspace = realpathSync(mkdtempSync(join(tmpdir(), 'pss-ls-nvim-')));
  writeFileSync(join(workspace, 'pkg.pss'), 'package p {\n    struct data_s {\n        rand bit[32] addr;\n    }\n}\n');
  writeFileSync(join(workspace, 'top.pss'), 'import p::*;\ncomponent top_c {\n    data_s cfg;\n    nowhere_s bad;\n}\n');
});

afterAll(() => {
  rmSync(workspace, { recursive: true, force: true });
});

describe.skipIf(!nvim)('Neovim', () => {
  it('shows diagnostics and goes to a definition in another file', () => {
    const out = join(workspace, 'result.json');
    execFileSync(nvim!, [
      '--headless', '--clean', '-l', SCRIPT,
      binPath(installDir), workspace, join(workspace, 'top.pss'), out,
    ], { stdio: ['ignore', 'pipe', 'pipe'], timeout: 30_000 });

    const result = JSON.parse(readFileSync(out, 'utf-8'));
    expect(result.error).toBeUndefined();
    expect(result.timedOut).toBe(false);
    expect(result.diagnostics.map((d: { message: string }) => d.message).join('\n')).toContain('nowhere_s');
    expect(result.diagnostics[0].source).toBe('pss');
    expect(result.definitions).toEqual([{ uri: pathToFileURL(join(workspace, 'pkg.pss')).href, line: 1 }]);
  });
});
