/**
 * Stamp the release version into package.json and server/package.json:
 * `node scripts/stamp-version.mjs [<version>]`.
 *
 * CI's one source of the version, used by both the `server-package` and the
 * `build` jobs so the npm package and the VSIX cannot disagree (lockstep: one
 * tag releases both). `server-package` runs it with no argument and exports
 * what it stamped; `build` passes that version back in rather than working
 * it out again. Working it out twice is not safe: a dev build's version is
 * the date, and two jobs can run either side of midnight UTC.
 *
 * THE TAG IS THE VERSION. With no argument, a `v<major>.<minor>.<patch>` tag
 * in GITHUB_REF gives that version, and anything else gives the dev stamp
 * 0.0.<YYYYMMDD>. The dev stamp is constrained three ways:
 *
 *   * a VSIX version is three fields, so pssparser's `.<run-id>` suffix does
 *     not port;
 *   * the date cannot go in major or minor. A dev build must sort BELOW every
 *     real release, or a dogfooder who installed one is told they are up to
 *     date and never offered the Marketplace upgrade. 0.<YYYYMMDD>.<run>
 *     would outrank 0.4.0; in the patch field, under a 0 minor, it cannot
 *     outrank any 0.N.x;
 *   * it has to be legal semver, because vsce validates with semver.valid().
 *
 * The cost, accepted: two builds on the same day carry the same version. The
 * run number and commit go in the artifact names instead. A dev version can
 * never reach npm or the Marketplace: both publish jobs run only on a tag and
 * check the artifact's version against it.
 *
 * Tags are strictly <major>.<minor>.<patch>. The Marketplace has no
 * pre-release channel keyed on the version string (pre-releases there are a
 * packaging flag plus the even/odd-minor convention), so an rc tag is refused
 * rather than quietly shipped as a normal release.
 *
 * `npm version` rather than an edit: it updates package-lock.json in step and
 * refuses a malformed version. --no-git-tag-version because a release is
 * already on its tag; it also skips npm's clean-tree check. The result is
 * read back from disk (anti-vacuity): a stamp that wrote nothing would
 * otherwise package the 0.0.0 placeholder and, on a tag, try to release it.
 *
 * In GitHub Actions it appends VERSION and SHORT_SHA to $GITHUB_ENV and
 * `version` to $GITHUB_OUTPUT.
 */
import { execFileSync } from 'child_process';
import { appendFileSync, readFileSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const MANIFESTS = ['package.json', 'server/package.json'];
const IS_WINDOWS = process.platform === 'win32';

function fail(message) {
  console.error(`::error::${message}`);
  process.exit(1);
}

const isRelease = v => /^\d+\.\d+\.\d+$/.test(v);

function versionFromRef(ref) {
  if (ref.startsWith('refs/tags/v')) {
    const v = ref.slice('refs/tags/v'.length);
    if (!isRelease(v)) {
      fail(`tag v${v} is not <major>.<minor>.<patch>; the VS Code Marketplace has no ` +
        'pre-release channel keyed on the version string, so rc/alpha/beta tags are not accepted here');
    }
    return v;
  }
  return `0.0.${new Date().toISOString().slice(0, 10).replaceAll('-', '')}`;
}

const version = process.argv[2] ?? versionFromRef(process.env.GITHUB_REF ?? '');
if (!isRelease(version)) fail(`'${version}' is not <major>.<minor>.<patch>`);

for (const manifest of MANIFESTS) {
  const dir = join(ROOT, manifest, '..');
  execFileSync(IS_WINDOWS ? 'npm.cmd' : 'npm',
    ['version', version, '--no-git-tag-version', '--allow-same-version'],
    { cwd: dir, stdio: ['ignore', 'ignore', 'inherit'], shell: IS_WINDOWS });
  const got = JSON.parse(readFileSync(join(ROOT, manifest), 'utf-8')).version;
  if (got !== version) fail(`failed to stamp version ${version} into ${manifest} (it reads ${got})`);
}
console.log(`version: ${version} (${MANIFESTS.join(', ')})`);

if (process.env.GITHUB_ENV) {
  const sha = execFileSync('git', ['rev-parse', '--short=7', 'HEAD'], { cwd: ROOT, encoding: 'utf-8' }).trim();
  appendFileSync(process.env.GITHUB_ENV, `VERSION=${version}\nSHORT_SHA=${sha}\n`);
}
if (process.env.GITHUB_OUTPUT) {
  appendFileSync(process.env.GITHUB_OUTPUT, `version=${version}\n`);
}
