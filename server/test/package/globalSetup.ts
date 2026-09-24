/**
 * Pack the server and install the tarball into a fresh directory (plan 3.1).
 *
 * The package tests run against what npm would publish, installed the way a
 * user installs it: `npm install <tgz>` into a directory outside the repo, so
 * nothing resolves from the repo's own `node_modules` or `src/`. The server's
 * dependencies, `@psstools/pssparser` and its WASM included, come from the
 * registry (or npm's cache).
 *
 * Environment:
 *   PSS_LS_TARBALL  install this tarball instead of packing one. CI packs
 *                   once and tests the exact artifact it uploads.
 *   PSS_LS_KEEP     keep the temporary directories, for debugging.
 */
import { execFileSync } from 'child_process';
import { mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync, realpathSync } from 'fs';
import { tmpdir } from 'os';
import { join, resolve } from 'path';
import { fileURLToPath } from 'url';
import type { GlobalSetupContext } from 'vitest/node';

declare module 'vitest' {
  export interface ProvidedContext {
    /** The directory the tarball was installed into. */
    installDir: string;
    /** The installed package's root, `<installDir>/node_modules/@psstools/pss-language-server`. */
    packageDir: string;
    /** The tarball that was installed. */
    tarball: string;
  }
}

const SERVER_DIR = fileURLToPath(new URL('../..', import.meta.url));
const IS_WINDOWS = process.platform === 'win32';

function npm(args: string[], cwd: string): void {
  // stdout is inherited so a failing pack or install shows why.
  execFileSync('npm', args, { cwd, stdio: ['ignore', 'inherit', 'inherit'], shell: IS_WINDOWS });
}

function packTarball(dest: string): string {
  // `prepack` does a clean build first, so this packs fresh output.
  npm(['pack', '--pack-destination', dest], SERVER_DIR);
  const tgz = readdirSync(dest).filter(f => f.endsWith('.tgz'));
  if (tgz.length !== 1) throw new Error(`expected one tarball in ${dest}, found: ${tgz.join(', ') || 'none'}`);
  return join(dest, tgz[0]);
}

export default function setup({ provide }: GlobalSetupContext) {
  // realpath: on macOS tmpdir() is a symlink, and the server reports real paths.
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'pss-ls-package-')));
  const tarball = process.env.PSS_LS_TARBALL
    ? resolve(process.env.PSS_LS_TARBALL)
    : packTarball(root);

  const installDir = join(root, 'install');
  mkdirSync(installDir);
  writeFileSync(
    join(installDir, 'package.json'),
    JSON.stringify({ name: 'pss-ls-package-test', version: '0.0.0', private: true }, null, 2),
  );
  npm(['install', '--no-audit', '--no-fund', '--no-package-lock', tarball], installDir);

  provide('installDir', installDir);
  provide('packageDir', join(installDir, 'node_modules', '@psstools', 'pss-language-server'));
  provide('tarball', tarball);

  return () => {
    if (process.env.PSS_LS_KEEP) {
      console.log(`package tests: kept ${root}`);
    } else {
      rmSync(root, { recursive: true, force: true });
    }
  };
}
