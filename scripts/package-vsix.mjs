/**
 * Build the VSIX: `npm run package:vsix [-- <vsce package options>]`.
 *
 * The extension ships the language server as the npm package, installed from
 * the packed tarball: the same bytes that go to npm. In a checkout
 * `client/node_modules/@psstools/pss-language-server` is the `file:../server`
 * link, which vsce cannot package. So this script:
 *
 *  1. builds the extension;
 *  2. packs the server, or takes the tarball named by PSS_LS_TARBALL (CI
 *     passes the one it tested and will publish);
 *  3. installs it into client/ with --omit=dev, so the VSIX gets a real
 *     directory and none of the client's devDependencies, together with the
 *     parser version server/package-lock.json pins (see PARSER below);
 *  4. runs `vsce package`, whose vscode:prepublish guard checks step 3;
 *  5. checks what the VSIX contains;
 *  6. puts the development link and devDependencies back with `npm install`.
 */
import { execFileSync } from 'child_process';
import { mkdtempSync, readFileSync, readdirSync, rmSync, statSync } from 'fs';
import { tmpdir } from 'os';
import { join, resolve } from 'path';
import { fileURLToPath } from 'url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const CLIENT = join(ROOT, 'client');
const SERVER = join(ROOT, 'server');
const IS_WINDOWS = process.platform === 'win32';

function run(cmd, args, cwd) {
  console.log(`\n> ${cmd} ${args.join(' ')}   (in ${cwd})`);
  execFileSync(cmd, args, { cwd, stdio: 'inherit', shell: IS_WINDOWS });
}
const npm = (args, cwd) => run(IS_WINDOWS ? 'npm.cmd' : 'npm', args, cwd);

/** The entry names in a zip file, read from its central directory. */
function zipEntries(file) {
  const buf = readFileSync(file);
  let eocd = -1;
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 22 - 0xffff); i--) {
    if (buf.readUInt32LE(i) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd < 0) throw new Error(`${file} is not a zip file`);
  const count = buf.readUInt16LE(eocd + 10);
  let p = buf.readUInt32LE(eocd + 16);
  const names = [];
  for (let n = 0; n < count; n++) {
    if (buf.readUInt32LE(p) !== 0x02014b50) throw new Error(`${file}: bad central directory entry`);
    const nameLen = buf.readUInt16LE(p + 28);
    const extraLen = buf.readUInt16LE(p + 30);
    const commentLen = buf.readUInt16LE(p + 32);
    names.push(buf.toString('utf-8', p + 46, p + 46 + nameLen));
    p += 46 + nameLen + extraLen + commentLen;
  }
  return names;
}

/** Fail unless the VSIX has the server from the tarball and nothing it should not. */
function checkVsix(file) {
  const entries = zipEntries(file);
  const has = name => entries.includes(name);
  const problems = [];

  const pkg = 'extension/client/node_modules/@psstools/pss-language-server/';
  for (const need of [
    'extension/client/out/extension.js',
    `${pkg}out/server.js`,
    `${pkg}out/cli/pss-ls.js`,
    `${pkg}package.json`,
    'extension/client/node_modules/@psstools/pssparser/dist/wasm/pssparser.wasm',
    'extension/client/node_modules/vscode-languageclient/package.json',
  ]) {
    if (!has(need)) problems.push(`missing ${need}`);
  }

  const stray = entries.filter(e => e.startsWith('extension/server/'));
  if (stray.length) problems.push(`ships ${stray.length} files under extension/server/, e.g. ${stray[0]}`);

  // vsce packages whatever is in the checkout. A tarball left there (CI once
  // downloaded the server's into it) ships inside the VSIX.
  const tarballs = entries.filter(e => e.endsWith('.tgz'));
  if (tarballs.length) problems.push(`ships a tarball: ${tarballs.join(', ')}`);

  const devDeps = Object.keys(JSON.parse(readFileSync(join(CLIENT, 'package.json'), 'utf-8')).devDependencies ?? {});
  for (const dep of devDeps) {
    if (entries.some(e => e.startsWith(`extension/client/node_modules/${dep}/`))) {
      problems.push(`ships the client devDependency ${dep}`);
    }
  }

  if (problems.length) {
    throw new Error(`${file} failed its content check:\n  ${problems.join('\n  ')}`);
  }
  const mb = (statSync(file).size / 1024 / 1024).toFixed(1);
  console.log(`\n${file}: ${entries.length} files, ${mb} MB, content check passed`);
}

/**
 * THE PARSER IS PINNED HERE, not by the tarball. A lockfile never ships in a
 * package, so installing the tarball alone resolves @psstools/pssparser to
 * the newest release in the server's range -- whatever the registry holds on
 * the day of the build. That is right for `npm i -g` users, and the package
 * tests (test:package) test exactly that. The VSIX instead ships the version
 * server/package-lock.json pins, which is the one every other test ran
 * against: installing it alongside the tarball satisfies the server's range,
 * so npm uses it rather than resolving another.
 */
const PARSER = '@psstools/pssparser';
function lockedParserVersion() {
  const lock = JSON.parse(readFileSync(join(SERVER, 'package-lock.json'), 'utf-8'));
  const version = lock.packages?.[`node_modules/${PARSER}`]?.version;
  if (!version) throw new Error(`server/package-lock.json does not pin ${PARSER}`);
  return version;
}

const manifest = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf-8'));
const vsix = join(ROOT, `${manifest.name}-${manifest.version}.vsix`);
const tmp = mkdtempSync(join(tmpdir(), 'pss-vsix-'));
let failed = false;
try {
  npm(['run', 'build'], ROOT);

  let tarball = process.env.PSS_LS_TARBALL && resolve(process.env.PSS_LS_TARBALL);
  if (!tarball) {
    npm(['pack', '--pack-destination', tmp], SERVER);
    const packed = readdirSync(tmp).filter(f => f.endsWith('.tgz'));
    if (packed.length !== 1) throw new Error(`npm pack left ${packed.length} tarballs in ${tmp}`);
    tarball = join(tmp, packed[0]);
  }

  const parser = lockedParserVersion();
  npm(['install', '--no-save', '--omit=dev', '--no-audit', '--no-fund', tarball, `${PARSER}@${parser}`], CLIENT);
  const installed = JSON.parse(readFileSync(join(CLIENT, 'node_modules', PARSER, 'package.json'), 'utf-8')).version;
  if (installed !== parser) {
    throw new Error(`client/node_modules has ${PARSER} ${installed}, not the ${parser} server/package-lock.json pins`);
  }
  run(join(ROOT, 'node_modules', '.bin', IS_WINDOWS ? 'vsce.cmd' : 'vsce'),
    ['package', '--no-yarn', '--out', vsix, ...process.argv.slice(2)], ROOT);
  try {
    checkVsix(vsix);
  } catch (e) {
    // Not left lying about to be installed by mistake.
    rmSync(vsix, { force: true });
    throw e;
  }
} catch (e) {
  failed = true;
  console.error(`\n${e instanceof Error ? e.message : String(e)}`);
} finally {
  // Back to the development link. CI skips this: nothing runs after it.
  if (!process.env.PSS_VSIX_NO_RESTORE) {
    try {
      npm(['install', '--no-audit', '--no-fund'], CLIENT);
    } catch {
      failed = true;
      console.error('\nerror: could not restore client/node_modules; run `npm install` in client/');
    }
  }
  rmSync(tmp, { recursive: true, force: true });
}
process.exit(failed ? 1 : 0);
