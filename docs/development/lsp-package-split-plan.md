# Plan: publish the PSS language server as a standalone npm package

Status: **Phases 1–6 done, not yet committed** (2026-09-23), except the
manual checks in a real VS Code (4.3, 4.7, 4.9) and Phase 5's exit
criteria, which need a CI run. Phase 7 follows the first release.
Owner: Matthew Ballance
Started: 2026-09-23

## Goal

Publish `server/` to npm as a language server that works in any editor.
Neovim, Emacs (eglot/lsp-mode), Helix, Zed and others then install it with
`npm i -g`. The VS Code extension becomes a *consumer* of that same package.

This is a **package split, not a repo split.** The server stays in this repo,
under `server/`. The boundary is enforced by the fact that the extension
installs the server from the packed tarball, the same bytes that go to npm,
and never from a relative path. A later repo split (Phase 7) is then a
mechanical `git subtree split --prefix=server`.

Two goals, with equal weight:

1. **Reach.** The server works in any LSP client, not only VS Code.
2. **Focused testing.** The server's contract is tested against the artifact
   that is actually published, and against more than one kind of client. The
   extension's tests then cover only what the extension itself adds.

## Current state (as of 3df2bc9)

Facts the plan depends on. Each was checked in the tree.

| Area | Today | Consequence |
|---|---|---|
| Package | `server/package.json`: `pss-language-server@1.0.0`, `"type": "module"`, no `bin`/`files`/`exports`, own `package-lock.json` | Needs packaging metadata; version must follow the tag like the extension's |
| Dependencies | `@psstools/pssparser` (WASM), `vscode-languageserver`, `vscode-languageserver-textdocument`. Nothing imports `vscode` | Already editor-neutral at the import level |
| Layering | `src/core/` (no LSP), `src/lsp/` (adapter), `src/server.ts` (3 lines), and a `src/cli/pss-check.ts` checker CLI | The seams already exist. The checker CLI duplicates pssparser's own checker (the `pssparser` command) and gets removed (D2) |
| Transport | `createConnection(ProposedFeatures.all)` with no args picks the transport from argv. The extension uses `TransportKind.ipc` | `--stdio` works. A bare invocation with no flag **throws**, which is unfriendly for a `bin` |
| Workspace root | `onInitialized` reads only `initParams.workspaceFolders` (`PSSLanguageServer.ts:~136`) | Clients that send only `rootUri`, or a single file with no root, get **no indexing and no `.pssconfig.json`** |
| Configuration | Read once from `.pssconfig.json` at the first root. No `workspace/configuration`, no `initializationOptions` | Good for neutrality. Changes to the file are not picked up (out of scope, noted) |
| File watching | Relies on the extension's `synchronize.fileEvents` watcher (`client/src/extension.ts`) | Other clients never send `didChangeWatchedFiles`. The server must register the watcher itself |
| Code lens | `CodeLensService.ts` emits `editor.action.findReferences`, `editor.action.goToTypeDefinition`, `pss.showActivityDiagram` | These are **VS Code client-side commands**. Other editors will show lenses that do nothing or give errors |
| Custom request | `pss/activityDiagram` (`PSSLanguageServer.ts:~276`) | Fine as a documented extension. Must stay optional |
| Protocol tests | `server/test/lsp/protocol.test.ts`, in-process over `PassThrough` streams, one VS Code-shaped client | The built binary, the tarball, and minimal clients are not tested |
| VSIX contents | `.vscodeignore` ships `server/out` + `server/node_modules` by path. `client/src/extension.ts` hard-codes `server/out/server.js` | This is the coupling to remove |
| VSIX hazard | `.vscodeignore` header: a **directory symlink** in the file list makes `vsce` fail with EISDIR | A `file:../server` dependency is a symlink, so the VSIX build must install the **tarball** |
| Repo tests | `test/contributions.test.ts` asserts on `server/out` shipping (~L219-232) and reads server sources (~L99). `test/differential.test.ts` runs `server/out/cli/pss-check.js`, which **crashes when run directly** (`require` in an ES module). The test skips without the reference CLI, which hides this | These need updating. 1.2a deletes the crashing CLI and moves the differential test in-process |
| CI | `.github/workflows/ci.yml`: `gate` → `build` (VSIX artifact) → `publish` (tag + authority). The tag is the version, stamped by `npm version` | npm publish follows the same pattern |
| Forgejo shadow | `.forgejo/workflows/ci.yml` checks that publish steps are gated. Its `PUBLISH` list has `vsce publish` but **not `npm publish`** | Must be extended, or a new npm publish job goes unchecked |
| Names | `@psstools/pss-language-server` and `pss-language-server` both 404 on npm (checked 2026-09-23) | Available |

## Decisions

Reviewed 2026-09-23. All settled.

| # | Decision | Settled | Notes |
|---|---|---|---|
| D1 | npm name | `@psstools/pss-language-server` | Same scope as `@psstools/pssparser` |
| D2 | Entry points | **One bin, `pss-ls`**, which is only the language server. **No checker CLI** in this package, neither as a bin nor as a subcommand | Users check PSS on the command line with pssparser's own checker, the `pssparser` command (see 1.2a: there is no `pss-check` in pssparser). This repo's `src/cli/pss-check.ts` is deleted. See 1.2 and 1.2a |
| D3 | Versioning | **Lockstep**: one `v*` tag stamps and releases both the npm package and the VSIX | Revisit when the repos are separated (Phase 7) |
| D4 | Directory | Keep `server/` where it is, for now | `packages/` belongs to IVPM and is excluded wholesale |
| D5 | npm workspaces | **No.** Keep separate installs per directory | Workspaces hoist dependencies to the root `node_modules/`, which `.vscodeignore` excludes, and which breaks `use:source` / `which:parser` |
| D6 | Public JS API | **None in v1.** `exports` exposes only `./server` (entry path) and `./package.json` | Export `startLanguageServer` / `core` later, when a consumer asks |
| D7 | VS Code-only code lenses | Off by default. The extension turns them on with `initializationOptions.vscodeCommands: true` | |
| D8 | npm auth | **`NPM_TOKEN` repository secret** (already configured) | `--provenance` is separate from auth and still works with a token on GitHub Actions (needs `id-token: write`). Keep it unless it causes trouble |
| D9 | Dev builds on npm | **None.** npm publishes only on a `v*` tag, like the Marketplace | |

## Phases

Phases 1–3 can land as separate PRs, and none of them changes what the VSIX
ships. Phase 4 is the cut-over. Every phase leaves `master` releasable.

---

### Phase 1: make the server editor-neutral (code)

Behavior changes to the server. Each change comes with a protocol test.

- [x] **1.1 Default to stdio.** In `server/src/server.ts`, if argv has none of
      `--stdio`, `--node-ipc`, `--socket=`, `--pipe=`, append `--stdio` before
      `createConnection`. `server.ts` stays the module the VS Code client
      forks (with `--node-ipc`), so this default must not affect that path.
      *Test:* spawn with no args, then initialize/shutdown succeeds.
  - *Done 2026-09-23.* `src/lsp/serverProcess.ts` (`hasTransportFlag`,
    `withDefaultTransport`, `runServer`) is shared by `server.ts` and
    `pss-ls`. `--stdio` goes onto `process.argv` rather than passing
    `process.stdin`/`stdout` to `createConnection`: the library only patches
    `console.*` into the client log when it sees `--stdio` in argv (checked in
    `vscode-languageserver/lib/node/main.js`), so this keeps 1.8's guarantee.
  - *Tests:* `test/lsp/serverProcess.test.ts` unit-tests the selection. The
    spawned check is deferred to 3.3, because `test:lsp` runs from source
    without a build (CI's `test-lsp` job doesn't compile). Checked by hand
    against `out/`: bare `node out/server.js` initializes, publishes
    diagnostics and exits 0 on shutdown/exit. A `fork(..., ['--node-ipc'])`
    (the VS Code path) still works and writes nothing to stdout.
- [x] **1.2 `pss-ls` entry point (D2).** New `server/src/cli/pss-ls.ts`,
      with a `#!/usr/bin/env node` shebang, as the package's only `bin`:
  - `pss-ls --version` / `-v`: print the version from `package.json` (read
    relative to `import.meta.url`), exit 0.
  - `pss-ls --help` / `-h`: usage (transport flags, `.pssconfig.json`, a
    pointer to the `pssparser` command for command-line checking), exit 0.
  - Anything else: start the language server, and pass argv through so
    `--stdio` / `--node-ipc` / `--socket=N` work, defaulting to stdio (1.1).
  - A leading positional argument: usage on stderr, exit 2. Don't start a
    server that would then wait on stdin.

  *Tests:* `server/test/cli/` covers dispatch (`--version`, `--help`, stray
  positional, server passthrough) through an exported `dispatch(argv)`,
  without spawning. Phase 3 covers the installed bin.

  - *Done 2026-09-23.* `dispatch` lives in its own pure module,
    `src/cli/dispatch.ts`, not in `pss-ls.ts`. That way the bin needs no
    "am I the main module" guard, which in ESM means comparing
    `import.meta.url` with a realpath of `argv[1]` and breaks under npm's
    `.bin` symlinks. `--version`/`--help` win wherever they appear (the first
    one decides). Only a *leading* positional is rejected, so `--socket 5007`
    still works. By hand: `--version` prints `1.0.0`, `foo` exits 2 with
    usage on stderr, `--stdio` serves, and `tsc` keeps the shebang (2.4).
  - **Found:** `server/test/cli/` was never run in CI. `test:core` runs
    `test/core` and `test:lsp` runs `test/lsp test/helpers`, so the old
    `pss-check` tests only ran under a bare `vitest run`. `test:lsp` now
    includes `test/cli`.

- [x] **1.2a Remove the checker CLI (D2).**
  - Delete `server/src/cli/pss-check.ts` and `server/test/cli/pss-check.test.ts`.
    This also removes the file that crashes when run directly (`require.main`
    in an ES module, checked 2026-09-23), so nothing needs fixing there.
  - Before deleting, move any assertions in `pss-check.test.ts` that cover
    *indexing and diagnostics* (not CLI formatting) into
    `server/test/core/`, so coverage of `WorkspaceLoader` + `WorkspaceIndex`
    doesn't drop.
  - **`test/differential.test.ts`:** keep what it checks (the server's
    diagnostics agree with pssparser's reference `pss-check`), but compute
    the server side **in-process** through `WorkspaceLoader` /
    `WorkspaceIndex` instead of spawning `server/out/cli/pss-check.js`.
    Move it to `server/test/core/differential.test.ts`, since it tests
    server behavior. The reference CLI lookup and skip-when-absent stay
    as they are.
  - **Docs that advertise the removed CLI:** `README.md:64` (`npx pss-check
    src/`), `docs/reference/cli.rst` (the whole page, including CI recipes
    using `npx pss-check`). Point them at pssparser's `pss-check`, or remove
    the page and its toctree entry (the docs build uses `-W`).
  - **Changelogs:** `pss-check` was never released, so it is removed
    outright. Delete its line from the unreleased 0.3.0 section of
    `CHANGELOG.md` (L49) and `docs/development/changelog.rst` (L13). No
    "Removed" entry and no deprecation period.

  *Done 2026-09-23.* Notes:
  - **Correction to the plan's premise: pssparser has no `pss-check`.** Its
    command-line checker is the `pssparser` console script
    (`pssparser.cli.app`, from the pssparser Python package). Every pointer
    now says "the `pssparser` command from the pssparser Python package
    (`pip install pssparser`)": the `pss-ls --help` text, and the README's
    "Command-line checking" section, which replaces "CLI" and its dead link to
    `docs/CLI.md`. Phase 6 wording is updated to match.
  - **The differential suite had never run.** All three `CANDIDATES` were
    `pss-check` paths that don't exist, so it always skipped. It now looks for
    `packages/python/bin/pssparser` (installed by `ivpm update`), passes
    `--no-color`, and reads **stderr as well as stdout**, because that is
    where pssparser writes its diagnostics. It now runs locally, and all four
    corpus files agree (`2:6`, `3:1`, `1:15`, clean). CI still skips it,
    because the test jobs don't install the Python packages. Whether to add
    that is a follow-up for Phase 5.
  - `server/test/core/index/disk-workspace.test.ts` keeps the `pss-check`
    tests' indexing and diagnostics assertions, including the pinned
    `nowhere_s` column gap. They now run through the default `NodeFileSystem`
    against a real temp dir. Dropped as CLI-only: relative-path rendering, a
    missing path throwing, and single-file mode (plain `addFile`).
  - `docs/reference/cli.rst` is removed along with its toctree entry, and
    `sphinx-build -W` is clean. Both changelogs lose the `pss-check` line, and
    "Configuration and CLI reference docs" becomes "Configuration reference
    docs".

- [x] **1.3 Root fallback.** In `onInitialized`, use `workspaceFolders`, else
      `rootUri`, else (deprecated) `rootPath`, else no root. With no root, skip
      the workspace scan and `.pssconfig.json`, and still serve open documents
      (single-file mode).
      *Test:* one case each for folders, `rootUri` only, and no root at all.
      Each checks that diagnostics arrive for an opened file, and that
      cross-file definition works when there is a root.
  - *Done 2026-09-23.* `workspaceRoots(params)` in `src/lsp/InitParams.ts`.
    An empty `workspaceFolders` array also falls through to `rootUri`. Roots
    that aren't `file://` are dropped, as before. With no root, the server logs
    `[workspace] No workspace root; serving open documents only`.
  - *Tests:* `test/lsp/workspace-roots.test.ts` has unit cases plus protocol
    cases for folders, `rootUri` only, `rootPath` only, and no root. Each
    rooted case checks that diagnostics arrive for an *unopened* file (proof
    of the scan), a cross-file definition into an unopened file, and that
    `.pssconfig.json` is honored (`indentSize: 2` shows in the formatting
    output).
  - The in-process client is now shared: `test/lsp/harness.ts` (used by
    `protocol.test.ts`) records every server→client request and notification,
    and answers requests with `null`. 1.4–1.7 and 3.5 build on it.
  - **Side finding (not in scope):** with no root, an unresolved
    `import p::*;` produces `unknown type 'p'; did you mean 'map'?` **twice**
    on the same file. It is a duplicate diagnostic in core.
- [x] **1.4 Code lens neutrality (D7).** Parse `initializationOptions` into a
      typed `ServerInitOptions` (`vscodeCommands?: boolean`, and later others).
      Without the flag, omit the three VS Code-command lenses. Reference counts
      stay useful if emitted as lenses with no command (`command` is optional
      on resolve). Decide in review whether an unactionable lens is worth
      showing.
      *Test:* lenses with and without the flag. Assert that no lens names
      `editor.action.*` or `pss.*` unless the flag is set.
  - *Done 2026-09-23.* **Decision for review:** without the flag, the server
    *neither advertises `codeLensProvider` nor returns lenses*. It does not
    emit command-less lenses. All three lens kinds (reference count,
    `extends`, activity diagram) run a VS Code-only command, so nothing
    actionable is left. A command-less lens is "unresolved" in LSP terms, and
    with `resolveProvider: false` clients either hide it or show dead text. If
    the reference count is wanted elsewhere, the editor-neutral way is the
    client's own references UI. Reversible: showing counts would mean adding
    a server-side command.
  - `ServerInitOptions` / `serverInitOptions()` live in
    `src/lsp/InitParams.ts`. Only a literal `true` enables the flag, and
    anything unrecognized is ignored. The `onCodeLens` handler also returns
    `[]` without the flag, in case a client asks anyway.
  - **The VS Code half of 4.3 landed with it**, as the exit criteria require:
    `client/src/extension.ts` passes `initializationOptions: {
    vscodeCommands: true }`, so VS Code never loses its lenses.
  - *Tests:* `test/lsp/init-options.test.ts` covers option parsing, a
    client with no flag (no capability, `[]`, no `editor.action.*`/`pss.*`),
    and a client with the flag (all three commands present).
- [x] **1.5 Server-registered file watching.** After `initialized`, if
      `capabilities.workspace.didChangeWatchedFiles.dynamicRegistration`, send
      `client/registerCapability` for `workspace/didChangeWatchedFiles` with
      glob `**/*.pss`. The `onDidChangeWatchedFiles` handler must tolerate
      duplicate events, because VS Code will still send its own until
      Phase 4.3 removes that watcher.
      *Test:* client that advertises the capability → registration received;
      client that doesn't → no registration and no error.
  - *Done 2026-09-23.* The registration is sent in `onInitialized`, only when
    there is a workspace root (1.3), and *before* the scan, so changes made
    during the scan aren't lost. A rejected registration is logged, not
    thrown.
  - **Idempotency lives in core** (`DocumentSession`). `didChangeOnDisk`
    returns early when the text equals what is indexed, and `didDeleteOnDisk`
    returns early when the file isn't there. Unit tests are in
    `DocumentSession.test.ts`.
  - *Tests:* `test/lsp/file-watching.test.ts` covers registration with and
    without the capability, a duplicate *Created* (published once), and a
    duplicate *Deleted* (cleared once), against a real temp dir.
  - **Side findings (pre-existing, not in scope):**
    - On-disk changes and deletes re-diagnose only the file itself, not its
      dependents. Edits in open buffers do (`publishDependents`).
    - `didClose` **removes the file from the index**. In a rooted workspace,
      closing a file that exists on disk drops its declarations until
      something re-adds it, so cross-file references into it break. This
      affects every client, VS Code included. It is worth its own issue.
- [x] **1.6 Capability audit.** For each registration in `onInitialize`,
      confirm nothing is *sent* to a client that didn't advertise it
      (`workspace/inlayHint/refresh`, `semanticTokens/refresh`,
      `codeLens/refresh`, `window/workDoneProgress`, `showDocument`). Today
      the server only answers requests, so this is expected to be a check,
      not a change. Record the result here.
  - *Result 2026-09-23.* The server initiates only three things:
    `textDocument/publishDiagnostics` (plain range, severity, code, source
    and message; no tags, `relatedInformation` or `codeDescription`),
    `window/logMessage`, and the 1.5 `client/registerCapability`, which is
    gated. There are no refresh requests, progress, `showDocument` or
    `applyEdit`. Edits use `WorkspaceEdit.changes`, not `documentChanges`, so
    they need no capability.
  - *Test:* `test/lsp/capability-audit.test.ts` runs a client that advertises
    nothing through hover, definition, references, completion, symbols,
    semantic tokens, inlay hints, code actions and formatting on a rooted
    workspace. It asserts that nothing but diagnostics and log messages
    arrived. 3.5 generalizes this per editor profile.
  - **Recorded gaps: response shapes ignore client capabilities.** These are
    harmless for current VS Code, Neovim, eglot and Helix, which support all
    of them, but they are off-spec for minimal clients. Revisit when 3.5
    captures real profiles:
    - Hover is always `MarkupKind.Markdown`, whatever
      `hover.contentFormat` says.
    - `documentSymbol` always returns hierarchical `DocumentSymbol[]`, even
      without `hierarchicalDocumentSymbolSupport`.
    - Code actions are always `CodeAction` literals, even without
      `codeActionLiteralSupport`.
- [x] **1.7 Position encoding.** Confirm the server assumes UTF-16 (the LSP
      default) and never advertises anything else. Add one test with a
      non-ASCII identifier before a diagnostic column.
  - *Done 2026-09-23. It found a real mismatch.* The server never advertises
    a `positionEncoding`, even when the client offers `utf-8`/`utf-32`, so the
    protocol says UTF-16. **The parser reports columns in Unicode code
    points**, and `lspChar()` passes them through. BMP characters (`é`) come
    out right, because one code point is one UTF-16 unit and it isn't bytes.
    Each **astral** character (`😀`, in a comment or string) before a position
    shifts it one unit left. Checked with syntax errors after
    `/* ab */`, `/* éé */` and `/* 😀 */`, and after `"😀é"` in a string.
  - *Tests:* `test/lsp/position-encoding.test.ts` covers no negotiated
    encoding, ASCII, and BMP. The astral case is a **pinned recorded gap**
    (`expect(actual).toBe(utf16 - 1)`), the same pattern as the linker
    column pin, so a fix shows up as a failure.
  - **Fix is out of scope for Phase 1.** There are 67 `lspChar`/`linepos`
    sites across core, plus every *incoming* position. Advertising
    `utf-32` is not a shortcut: positions computed from text (formatter,
    completion prefix) are JS string offsets, i.e. UTF-16, so the server
    mixes both today. The fix is a code point ↔ UTF-16 conversion with line
    text, at the `SourceLoc` boundary. Tracked as a follow-up.
- [x] **1.8 stdout hygiene.** Confirm no path in `src/core` or `src/lsp`
      writes to `process.stdout` (checked 2026-09-23: none. `console.*` is
      patched by `vscode-languageserver` in stdio mode). Add a lint rule
      (`no-restricted-properties` on `process.stdout`) for `server/src/**`
      except `src/cli/**`.
  - *Done 2026-09-23.* The override is in `.eslintrc.json`, and the message
    points at `connection.console`. **The root `lint` script now covers
    `server/src/`, not just `server/src/core/`**. Otherwise the rule would
    never run on `src/lsp`, which is where it matters. That added no errors,
    only existing warnings (152 in total). Checked that a probe file in
    `src/lsp` fails and `src/cli/pss-ls.ts` passes.

**Exit criteria:** `npm run test:lsp` covers 1.1–1.8, `server/test/cli` covers the `pss-ls` dispatch, and no `pss-check` remains in `server/`, the docs or the changelogs, except the note in the differential test. The VS Code extension
still behaves the same (it doesn't yet pass `vscodeCommands`, so lenses
disappear there until Phase 4.3. **Land 1.4 and 4.3 together**, or temporarily
default the flag to `true` and flip it in Phase 4).

**Exit check (2026-09-23): met.**
- `npm test` is green: core 428, lsp 155, client 23, contrib 20, grammar.
- `npm run typecheck` and `npm run lint` report 0 errors.
- `sphinx-build -W` is clean.
- `git grep pss-check` finds only the differential test's comment.
- The rebuilt `pss-ls` passed a stdio smoke test with a `rootUri`-only
  client (Neovim-style) that supports watcher registration: it registered the
  watcher, indexed 2 files, published diagnostics, and exited 0 after
  shutdown/exit.
- The VS Code client passes `vscodeCommands: true` (1.4), so lenses are
  unchanged there.
- One unhandled-error race was fixed in the test itself: a parse timer that
  was still pending after the connection was disposed.

**Follow-ups raised by Phase 1** (not blocking the package split):
- The astral-character column gap (1.7).
- Response shapes vs client capabilities (1.6).
- Dependents aren't re-diagnosed on disk changes, and `didClose` drops files
  from the index (1.5).
- A duplicate `unknown type 'p'` diagnostic for an unresolved import (1.3).
- The differential suite doesn't run in CI (1.2a).

---

### Phase 2: package metadata

Done 2026-09-23, not yet committed.

- [x] **2.1 `server/package.json`:**
  - `name`: `@psstools/pss-language-server` (D1). `version`: `0.0.0`
    placeholder, stamped by CI like the root package. (Stamping the server
    is 5.x; until then `pss-ls --version` prints `0.0.0` in a dev build.)
  - `bin`: `{ "pss-ls": "out/cli/pss-ls.js" }` (D2).
  - `exports`: `{ "./server": "./out/server.js", "./package.json": "./package.json" }` (D6)
  - `files`: `["out/**/*.js", "README.md", "LICENSE"]`. No sources, tests,
    maps or `.d.ts` while there is no API (D6).
  - `repository` with `"directory": "server"`, `homepage`, `bugs`,
    `keywords`, `publishConfig: { "access": "public", "provenance": true }`.
  - `description` now uses the standard's name, matching `pss-ls --help`.
  - `scripts.prepack`: **a clean build**, `npm run clean && tsc -b`, not
    plain `tsc -b`. `tsc -b` never deletes the output of a source that was
    removed or renamed, and `files` would pack it (the deleted `pss-check.js`
    was exactly that case). `clean` removes `out/` *and*
    `tsconfig.tsbuildinfo`; removing only `out/` makes `tsc -b` think it is
    up to date and emit nothing. Checked by planting `out/stale-canary.js`
    before `npm pack --dry-run`: it was not packed.
  - `package-lock.json` root entry updated to match (name, version, bin).
  - `engines.node >= 18` kept. It matches `@psstools/pssparser@3.1.3`
    (`>=18`); `vscode-jsonrpc` needs `>=14`, the other two declare nothing.
    pssparser's `prepare` script runs only for git/local installs, not for a
    registry install.
- [x] **2.2 `server/LICENSE`:** copy of the root Apache-2.0 LICENSE (npm
      packs only from the package directory).
- [x] **2.3 `server/README.md`:** stub (install, `pss-ls --stdio`,
      `.pssconfig.json`, point to `pssparser`). Phase 6 fills it in.
- [x] **2.4 Shebang:** `tsc` keeps it. `out/cli/pss-ls.js` in the tarball
      starts with `#!/usr/bin/env node`. The smoke test (3.2) will keep
      checking it.
- [x] **2.5 `npm pack --dry-run` review:** 80 files: the 77 `out/**/*.js`,
      plus `LICENSE`, `README.md`, `package.json`. No `.map`, `.d.ts`,
      sources or tests. **56.2 kB packed, 234 kB unpacked.**
      `@psstools/pssparser` (and its `.wasm`) is a dependency, not bundled.
- [x] **VSIX unchanged.** `.vscodeignore` excludes `server/README.md` and
      `server/LICENSE`, so the extension still ships only the root ones.
      Checked with `vsce ls --no-yarn`: under `server/`, only `out/`,
      `node_modules/`, `package.json`, `package-lock.json` and
      `tsconfig.tsbuildinfo` ship, as before. (Shipping `tsconfig.tsbuildinfo`
      is an existing leak, since `**/tsconfig*.json` does not match it. It
      goes away with 4.4.)

**Exit criteria:** `cd server && npm pack` produces
`psstools-pss-language-server-0.0.0.tgz` with the expected contents.
**Met.**

An early run of 3.2 by hand: the tarball installed into an empty project
outside the repo (7 packages from the registry). `pss-ls --version` printed
`0.0.0`, `pss-ls foo` exited 2, and a stdio session (initialize, didOpen,
shutdown, exit) published the expected `undefined-type` diagnostic and
exited 0. So the WASM parser loads from a registry install of pssparser.

Found while doing it:

- `import('@psstools/pss-language-server/server')` from `node -e` throws
  "Connection input stream is not set". With no script path, `process.argv`
  has one entry; the library looks for transport flags only from index 2,
  and `runServer` inserts `--stdio` at index 1. The real consumer forks the
  module with `--node-ipc` (argv has 3+ entries), so this only affects
  `node -e` or the REPL. Left as is.
- Closing stdin without `shutdown` exits 1, as the protocol specifies. (A
  stack trace seen during testing came from the test harness closing the
  server's stdout early, not from the server.)

---

### Phase 3: package-level tests (the focused-testing half)

Done 2026-09-23, not yet committed.

New suite `server/test/package/`, run by `npm run test:package` (in
`server/`, or from the root). It packs and installs, so it has its own config
(`server/vitest.package.config.ts`) and the default config excludes it:
`npm test` and `test:lsp` do not run it. About 2 s locally once npm's cache
is warm.

- [x] **3.1 Tarball install harness** (`test/package/globalSetup.ts`):
      `npm pack` (whose `prepack` is the clean build from 2.1) into a temp
      directory, then `npm install <tgz>` into a fresh directory under the
      OS temp dir, so nothing resolves from the repo's `node_modules` or
      `src/`. The paths reach the tests through vitest's `provide`/`inject`.
      `PSS_LS_TARBALL=<tgz>` installs a given tarball instead of packing (for
      5.1, which tests the exact artifact it uploads); `PSS_LS_KEEP=1` keeps
      the temp directories. The process client (`test/package/lspProcess.ts`)
      imports nothing from `src/`.
- [x] **3.2 Session against the installed bin** (`installed.test.ts`):
      workspace of two files with a cross-file error; checks the diagnostics
      from the workspace scan (no didOpen), a cross-file `definition`, and
      `shutdown`/`exit` with exit code 0. Run three ways: `pss-ls --stdio`,
      bare `pss-ls` (3.3), and the `./server` export forked with
      `--node-ipc`, which is how the extension will start it in Phase 4.
      Also checks what was installed: only `out/**/*.js`, README, LICENSE and
      `package.json`; the shebang; `./server` resolves through `exports` and
      an internal path is `ERR_PACKAGE_PATH_NOT_EXPORTED` (D6).
      If the server dies mid-session the test fails at once with its stderr,
      not with a timeout.
- [x] **3.3 Bare invocation** and `--version` matching the installed
      `package.json`; `--help` exits 0.
- [x] **3.4 Stray positional argument:** `pss-ls foo` exits 2 with usage on
      stderr, with stdin left open (so a hang would fail the test).
- [x] **Checked that the suite can fail:** a tarball with
      `out/lsp/serverProcess.js` removed and a stray `.map` added, fed in
      through `PSS_LS_TARBALL`, failed 7 of 9 (the contents check, every bin
      test and all three sessions, each with Node's `ERR_MODULE_NOT_FOUND` in
      the message).
- [x] **3.5 Client-profile matrix** (`test/lsp/client-profiles.test.ts`,
      runs in `test:lsp`, in-process). Profiles in `test/lsp/profiles/`,
      each recording its source and date:
  - `vscode.json`: vscode-languageclient 9.0.1 from `client/node_modules`,
    produced by running the library's own `initialize` against a stub
    `vscode` module, with the extension's options. Runtime-only values
    (VS Code version, locale) are fixed stand-ins.
  - `neovim.json` (v0.12.5), `eglot.json` (1.24, no markdown-mode or
    yasnippet), `helix.json` (25.07.1): **transcribed from each client's
    source** at that tag, not captured from a running editor. Runtime-
    dependent choices are in each file's `notes`.
  - `minimal.json`: hand-written, `rootUri` and no capabilities.

  One scenario per profile (workspace scan, open, hover, definition,
  references, completion and resolve, document and workspace symbols,
  formatting, code lens, shutdown). The check goes beyond requests: every
  response shape, content format and enum value must be within what the
  profile advertised, with the protocol's defaults where it advertised
  nothing. File-watcher registration must happen exactly when the client
  supports it. A further test checks VS Code still gets the full versions.

  **It found three real problems**, now fixed in the server
  (`src/lsp/ClientSupport.ts`, computed at `initialize`):
  - Hover was always markdown. eglot without markdown-mode and minimal
    clients now get plaintext, with the code fences and bold labels removed.
  - Document symbols were always a tree. Helix (which does not advertise
    `documentSymbol` at all) and minimal clients now get the flat
    `SymbolInformation[]` with `containerName`.
  - Completion and symbol kinds past the original 18 (`Struct`, `EnumMember`,
    `Event`, `TypeParameter`) went to clients that did not list them. They
    now map to the nearest original kind (e.g. `Struct` → `Class`).

  Neovim and VS Code were already clean and see no change.
  `protocol.test.ts`'s symbol-tree test now advertises tree support.
- [x] **3.6 Headless Neovim** (`test/package/neovim.test.ts` +
      `neovim-smoke.lua`): `nvim --headless --clean -l` starts the installed
      bin with `vim.lsp.start`, waits for diagnostics, asks for a cross-file
      definition, and writes both out as JSON for the test to check. Uses
      `NVIM_BIN` or `nvim` on PATH (0.11+), and is **skipped** when neither
      exists. Run here against the v0.12.5 release: Neovim got
      `unknown type 'nowhere_s'` from source `pss` and the definition in
      `pkg.pss`. (Column 5 where the token starts at 4: the linker
      off-by-one already recorded in `disk-workspace.test.ts`.) In CI it
      waits for 5.6.
- [x] **3.7 Ownership of tests.** Server behavior tests are all in
      `server/test`. `test/contributions.test.ts`'s "reads every setting"
      check read server sources; it now reads only `client/src`. A match in
      server code was misleading: the server never sees VS Code settings
      (nothing forwards them) and reads `.pssconfig.json`, whose keys have the
      same names. The result is unchanged: `pss.maxNumberOfProblems` is still
      the one declared-but-unread setting. Its `server/out` shipping checks
      (~L219-232) are Phase 4's to change.

Found while doing it:

- **`pss.trace.server` did nothing.** vscode-languageclient reads
  `<client id>.trace.server`, and the client's id was `pssLanguageServer`.
  Fixed in Phase 4 (see there).

**Exit criteria:** `npm run test:package` passes locally from a clean
checkout, and the profile matrix runs in `test:lsp`. **Met.** Full `npm test`
passes (core 428, lsp 168, client 23, contrib 20, grammar), typecheck is
clean, and lint has no new warnings.

---

### Phase 4: the extension consumes the package (the cut-over)

- [x] **4.1 Dependency:** `client/package.json` has
      `"@psstools/pss-language-server": "file:../server"`. Checked with npm
      11.7: npm links it (`client/node_modules/@psstools/pss-language-server
      -> ../../../server`, lock entry `"link": true`) and does **not** install
      the server's dependencies into `client/`. They resolve from
      `server/node_modules`, because Node resolves from the link's real path,
      and the root `postinstall` already fills that. Install order does not
      matter.
- [x] **4.2 Server resolution:** `client/src/extension.ts` uses
      `require.resolve('@psstools/pss-language-server/server')`. From
      `client/out` in a checkout it resolves to
      `server/out/server.js`, and in the VSIX to
      `client/node_modules/@psstools/pss-language-server/out/server.js`.
- [x] **4.3 Client options:** `synchronize.fileEvents` is removed, and
      `initializationOptions: { vscodeCommands: true }` stays. The server
      registers `**/*.pss`, the same glob the client used to watch.
      vscode-languageclient always advertises
      `didChangeWatchedFiles.dynamicRegistration` (it is set in
      `FileSystemWatcherFeature.fillClientCapabilities`, whatever the
      options), so the `vscode.json` profile is unchanged. The server in the
      built VSIX does send `client/registerCapability` (see 4.9).
      **Still to do by hand:** check in a real VS Code that created, deleted
      and renamed files are picked up. This machine has no display to run
      one.
- [x] **4.4 VSIX build installs the tarball:** `npm run package:vsix`
      (`scripts/package-vsix.mjs`):
      1. builds;
      2. packs the server, or takes `PSS_LS_TARBALL`;
      3. runs `npm install --no-save --omit=dev <tgz>
         @psstools/pssparser@<locked>` in `client/`;
      4. runs `vsce package --no-yarn`;
      5. checks the VSIX;
      6. puts the link back with `npm install` in `client/`
         (`PSS_VSIX_NO_RESTORE=1` skips this, and CI sets it).

      `vscode:prepublish` is now the guard `scripts/check-vsix-server.mjs`. It
      fails with a clear message if the server path is the link, is missing,
      or carries a different version from the extension. The build moved into
      the script, because after `--omit=dev` the client's `@types/vscode` is
      gone. `@vscode/vsce@^3.9.2` is now a root devDependency: CI installed
      the latest vsce globally, and 4.0 needs Node ≥ 22.12
      (`require()` of ESM), so it fails on 22.11.

      Content check, after packaging:
      - these must be present: `client/out/extension.js`, the server's
        `out/server.js`, `out/cli/pss-ls.js` and `package.json`,
        `pssparser.wasm`, and vscode-languageclient;
      - nothing may be under `extension/server/`;
      - none of the client's `devDependencies` may be present.

      The CI `build` job stamps `server/package.json` with the same version as
      the extension, reads both back, and runs `npm run package:vsix` in place
      of `vsce package`. 5.1 moves the stamping into a shared script.

      Checked with three failures, each caught with the link restored
      afterwards:
      - `vsce package` run directly hits the guard's error, not EISDIR;
      - a 9.9.9 tarball fails the version check;
      - `server/**` narrowed to `server/src/**` gives "ships 1446 files
        under extension/server/".

      A CI-style build of a fresh copy (fresh `npm install`, no `out/`,
      version 0.0.20260923) passes.
      Two things this turned up:
      - **The VSIX shipped devDependencies.** vsce includes `client/` and
        `server/node_modules` wholesale, so vitest, typescript, babel and
        coverage tools went in from both. It had **2180 files; now 367
        (1.2 MB)**.
      - **The parser version floated.** A lockfile never ships in a
        tarball, so installing the tarball on its own took pssparser
        **3.1.6**, while `server/package-lock.json` pins **3.1.3**.
        Shipping an `npm-shrinkwrap.json` doesn't help, because npm 11
        ignores it when installing from a tarball file (tried). The
        script pins the parser instead: it installs the locked version
        next to the tarball, which satisfies the server's range, and
        checks the result. So the VSIX ships the parser every other test
        ran against, as it did before. `npm i -g` users get the newest
        version in range, which is normal for npm, and `test:package`
        (Phase 3) tests exactly that, so it has been running 3.1.6.
- [x] **4.5 `.vscodeignore`:** `server/**` replaces the `server/test`,
      `server/bench`, `server/README.md` and `server/LICENSE` rules. It also
      excludes `scripts/**`, `**/*.tsbuildinfo` and `**/package-lock.json`,
      which shipped from `client/` before. The header and the parser note
      are rewritten.
- [x] **4.6 Repo tests:** `test/contributions.test.ts` checks that
      `server/**` is excluded and that nothing excludes `client/node_modules`.
      It checks that the extension resolves the package export and no
      longer calls `asAbsolutePath`, and it checks the `file:../server`
      dependency, the package's name and its `./server` export. It also
      checks the prepublish guard and the `package:vsix` script (contrib 20 → 24
      tests). The VSIX's own contents are checked by the script that builds
      it (4.4), not by a unit test, because building a VSIX is too slow for
      the test run.
- [x] **4.7 Debugging:** in a checkout the client resolves the server to
      `server/out/server.js` (the real path), which has source maps, so the
      "Attach to PSS Server" `outFiles` (`server/out/**`) still matches.
      **Still to do by hand:** check that breakpoints bind.
- [x] **4.8 Parser source override:** `use:source` and `which:parser` still
      act on `server/node_modules`, which is what a checkout runs through the
      link (`which:parser` reports `3.1.3 (prebuilt, from registry)`). The
      `.vscodeignore` parser note and a new "Packaging the Extension" section
      in `docs/development/contributing.rst` say that a VSIX always ships the
      registry parser.
- [x] **4.9 Checked without an editor:** unzipped the CI-style VSIX,
      resolved the server from `extension/client/out` the way
      `extension.ts` does, forked it with `--node-ipc`, and ran a session
      with the extension's options:
      - code lenses offered;
      - `client/registerCapability` for the watcher;
      - `unknown type 'nowhere_s'` for `top.pss` and nothing for `pkg.pss`;
      - the cross-file definition resolved;
      - exit 0.

      **Still to do by hand:** install the VSIX into a clean VS Code profile
      and check diagnostics, hover, go-to-definition, code lenses, the
      activity diagram and cross-file indexing.

Also fixed: **`pss.trace.server` now works.** The language client's id
changed from `pssLanguageServer` to `pss`, the section
vscode-languageclient reads `trace.server` from. A contrib test checks that
the id and the declared setting match. The id is only a settings section
(the output channel is named after the display name), so nothing else
changes.

**Exit criteria:** the VSIX contains no `extension/server/` directory.
**Met,** and checked on every build. The extension works from the
tarball: **met at the protocol level (4.9); the real VS Code check is still
to do.** All repo tests pass: **met** (core 428, lsp 168, client 23, contrib
24, grammar; `test:package` 10 with Neovim). Typecheck is clean, lint has 0
errors, and `sphinx-build -W` passes.

---

### Phase 5: CI and release

Done 2026-09-23, not committed. Everything was rehearsed locally; nothing has
run on a real runner yet (see the exit criteria). The `dvkit-infra` skill was
loaded first: both forges, the release-authority gate and the shadow check
are involved.

- [x] **5.1 New job `server-package`** (every push and PR). Stamps the
      version, `npm install` in `server/`, `npm pack` into `$RUNNER_TEMP`,
      checks the tarball, runs `test:package` against it with
      `PSS_LS_TARBALL`, and uploads `server-tgz-<version>-r<run>-g<sha>`.
      - **One stamping script, one computation.** The stamp step's logic
        moved from `ci.yml` into `scripts/stamp-version.mjs`: a tag gives
        `<major>.<minor>.<patch>` (rc and short tags refused), and anything
        else gives `0.0.<YYYYMMDD>`. It stamps `package.json` and
        `server/package.json`, reads both back, and exports `VERSION`,
        `SHORT_SHA` and a `version` step output.
      - The plan said to have both jobs run the script. That alone is not
        enough: a dev version is the date, and the two jobs can run either
        side of midnight UTC. So only `server-package` computes the version;
        it exports it as a job output, and `build` passes it back in
        (`stamp-version.mjs <version>`).
      - The tarball check, the same one `publish-npm` makes, fails a PR that
        breaks the package: name, version and filename; `package.json`,
        `README.md`, `LICENSE`, `out/server.js` and `out/cli/pss-ls.js`
        present; nothing from `src/`, `test/` or `bench/`, and no `.ts`.
- [x] **5.2 `build` (VSIX)** `needs: server-package`. It stamps that job's
      version, downloads the tarball and runs `npm run package:vsix` with
      `PSS_LS_TARBALL`. Its own stamping and packing are gone, and so is the
      separate `npm run compile`, which `package:vsix` already runs.
      - **Found in the rehearsal:** downloaded into the checkout, the tarball
        ships **inside the VSIX** (vsce packages the checkout). It now
        downloads into `$RUNNER_TEMP`. `package-vsix.mjs`'s content check
        also rejects any `.tgz` (mutation-checked), and it deletes a VSIX
        that fails the check so nobody installs it by mistake.
- [x] **5.3 New job `publish-npm`**, with the same `if:` as `publish` and
      `needs` on `gate`, `server-package`, `build`, lint, typecheck, all
      test jobs and docs. It has no checkout.
      - `setup-node` with `registry-url`. It checks the tarball's filename
        and the `package.json` inside it (D1 name, the tag's version, not
        `private`).
      - Then `npm publish <tgz> --access public --provenance`, with
        `NODE_AUTH_TOKEN` taken from `secrets.NPM_TOKEN`. An empty secret
        fails with a clear error.
      - `permissions: contents: read, id-token: write`.
      - The upload is unconditional, as in pssparser's release: nothing asks
        the registry first, because npm's read path lags its write path.
      - **Provenance:** npm checks `repository.url` against the GitHub repo,
        which is `PSSTools/vscode-pss-support`. `server/package.json` said
        `psstools`, so its three URLs now use GitHub's casing, so that a
        case-sensitive match cannot reject the first publish.
- [x] **5.4 Order:** `publish` (Marketplace) `needs: publish-npm`.
      - If the Marketplace fails after npm succeeds, "Re-run failed jobs"
        re-runs only `publish`. Re-running `publish-npm` after a successful
        upload fails on EPUBLISHCONFLICT, as it should.
      - `publish`'s "Check the VSIX" now also checks that the server inside
        the VSIX carries the tag's version (mutation-checked with a 9.9.9
        server).
- [x] **5.5 Shadow check:** added `("npm ", "publish")` to `PUBLISH` in
      `.forgejo/workflows/ci.yml` (git-sync's `PUBLISH_MARKERS` already
      carried it).
      - Run locally, the check now reports "2 publishing step(s), every one
        tag-gated and switch-gated". Before the marker it reported 1.
      - Mutations fail it: dropping the tag condition from `publish-npm`,
        and dropping its `needs: gate`.
      - The internal-identifier pattern finds nothing in the changed files.
- [x] **5.6 Neovim job `test-neovim`**: `needs: server-package`,
      `continue-on-error: true`, not in any publish job's `needs`. It
      installs the Neovim v0.12.5 release tarball (the version 3.6 ran
      against) and runs only `test/package/neovim.test.ts` against the
      downloaded tarball with `NVIM_BIN` set.
      - So that it reports "run": `neovim.test.ts` now fails instead of
        skipping when `NVIM_BIN` is set but does not run (checked with
        `NVIM_BIN=/nonexistent`). `nvim` on PATH is still optional.
- [x] **5.7 One-time npm setup.** Done from here:
      - `NPM_TOKEN` is an **org** secret, created 2026-09-10 and visible to
        this repo. pssparser's release uses it for `@psstools/pssparser`.
      - `npm publish --dry-run --access public <tgz>` on a packed tarball:
        81 files, 57.7 kB, "public access (dry-run)".
      - `@psstools/pss-language-server` still 404s, so the name is free.

      The token must be able to create a *new* package under `@psstools`
      without a 2FA prompt, which a dry run cannot show. Confirmed by the
      owner 2026-09-23: the same `NPM_TOKEN` created and published
      `@psstools/pssparser`.
- [x] **5.8 Release authority.**
      - `sync-policy.toml` pins nothing for this repo, so the authority is
        the `[release]` default, `github`.
      - GitHub is the forge that holds `NPM_TOKEN`, and the Forgejo workflow
        has no publish jobs.
      - Authority is per repo, not per registry, so npm needs no entry of its
        own. No change was made.
      - The gate's comment already notes the authority is `github` "by
        accident rather than by intent". This repo now publishes to two
        registries that don't allow version reuse, so pinning
        `[repo."psstools/vscode-pss-support"] authority = "github"` is worth
        doing. That is a change to live infrastructure, so it is left to the
        owner.

**Local rehearsal, in a fresh copy of the tree, at 0.0.20260923:**
- `server-package`'s steps passed: stamp, pack, the tarball check, and
  `test:package` (10/10, including Neovim).
- `build` passed on the same tarball: a VSIX of 366 files, with the content
  check passed.
- `publish`'s VSIX check passed, including the new server-version check.
- The workflow's check scripts were extracted and run; each passed on good
  input and failed on bad input.
- actionlint is clean.
- `npm test` passes: core 428, lsp 168, client 23, contrib 24, and the
  grammar tests.
- Typecheck is clean. Lint has 0 errors. `sphinx-build -W` passes.
- `docs/development/contributing.rst` gained a "Releasing" section.

**Exit criteria**, not yet met, because nothing has been pushed:
- a PR run produces both a VSIX and a server tarball artifact;
- a tag run with the authority set to none shows both publish jobs skipped;
- the first real tag publishes both.

---

### Phase 6: documentation

- [x] **6.1 `server/README.md`** (the npm page):
      - install, the `pss-ls` command and its transports, what the server
        provides, and how it adapts to client capabilities;
      - workspace roots, single-file mode, file watching, and the
        `.pssconfig.json` fields, including the ones accepted but not yet
        acted on;
      - a setup section per editor, each starting `pss-ls --stdio` and
        mapping `*.pss` to the `pss` language: Neovim 0.11+
        (`vim.lsp.config`), Neovim 0.10 with nvim-lspconfig, Emacs eglot and
        lsp-mode, Helix, Sublime LSP and Kate;
      - Zed is covered by saying it cannot be set up yet: it attaches
        servers only to languages an extension defines, and there is no PSS
        extension for Zed;
      - `initializationOptions.vscodeCommands` and `pss/activityDiagram`
        (0-based lines, the graph's shape), documented as optional and
        non-standard;
      - a pointer to the `pssparser` command for command-line checking.

      **Snippets run for real**, against a tarball installed with
      `npm i -g --prefix`, in a workspace with a cross-file error:
      - Neovim 0.12.5, the `vim.lsp.config` snippet extracted verbatim from
        the README: the filetype is `pss`, the root comes from
        `.pssconfig.json`, and the `unknown type 'nowhere_s'` diagnostic
        arrives.
      - The same with the nvim-lspconfig snippet and a current nvim-lspconfig
        checkout: same result.
      - Helix 25.07.1, the `languages.toml` snippet verbatim: `hx --health
        pss` finds `pss-ls`, and Helix's log shows it starting the server and
        receiving diagnostics for both files.
      - **Not run:** Emacs (eglot, lsp-mode), Sublime and Kate. None is
        installed here. Sublime and Kate also need a PSS syntax definition,
        which the README says.
- [x] **6.2 Root README:** an "Other editors" section: the package name, the
      install command, `pss-ls --stdio`, and a link to `server/README.md`.
      Also fixed two links that pointed at files that do not exist
      (`docs/CONFIGURATION.md`, `docs/CONTRIBUTING.md`), and dropped
      "include/exclude globs" from the configuration line, since those keys
      are not acted on.
- [x] **6.3 Sphinx:** `docs/reference/language-server.rst`, in the reference
      toctree: install, the command, the Neovim example, workspace behavior
      and the two extensions. For the other editors it links to the package
      README instead of copying the snippets, so there is one copy to keep
      right. `sphinx-build -W` passes.
- [x] **6.4 CHANGELOG:** an "Unreleased" entry in `CHANGELOG.md` and
      `docs/development/changelog.rst`: the package, the extension running
      it, and the editor-neutral changes. There is no version number to put
      on it yet: the tag decides, and there are no tags so far. Rename the
      heading to the tag's version when releasing.

---

### Phase 7: after the first release (not part of this plan's exit)

- Submit the server upstream: nvim-lspconfig (`lsp/pss.lua`), the Mason
  registry, and Helix `languages.toml`. Upstream entries bring more users
  than the npm listing will.
- Watch whether the server and extension release on different schedules. If
  they do, revisit D3 (separate tags).
- **Criteria for moving `server/` to its own repo:** (a) no PR in ~2 months
  needed to change both `server/` and `client/`; (b) the extension could
  depend on a published *range* rather than the tarball from the same
  commit; (c) there are server-only contributors. Then `git subtree split
  --prefix=server`, move `server-package` / `publish-npm` with it, and change
  `client/package.json` to a semver range.
- Out of scope, noted for later: reloading `.pssconfig.json` on change;
  a `workspace/configuration` bridge; a public `core` API (D6); bundling
  the server with esbuild to shrink the VSIX.

## Risks

| Risk | Mitigation |
|---|---|
| The VSIX build packs a `file:` symlink → vsce EISDIR | 4.4 installs the tarball, plus an explicit symlink guard with a clear error |
| The WASM file doesn't resolve from a global or `npx` install | 3.2 runs from a clean tarball install, outside the repo |
| npm version burned by a bad publish | 5.1 and 5.3 check the tarball contents, `--dry-run` rehearsal (5.7), lockstep with Marketplace ordering (5.4) |
| Dev builds on either side of midnight UTC get different versions | Only `server-package` computes the version; `build` takes it from that job's output (5.1) |
| Code lenses vanish in VS Code between Phase 1 and 4 | Resolved: the client passes `vscodeCommands: true` as of 1.4 |
| Duplicate watched-file events during the transition | 1.5 makes the handler idempotent |
| Client profiles go stale, or were transcribed wrong (three of five are read from source, not captured) | Each records its source tag and date. Re-derive when bumping `vscode-languageserver` or `vscode-languageclient`; replace a transcription with a real `initialize` log when one is available |
| The new publish job isn't covered by the Forgejo shadow check | 5.5 |

## Tracking

| Phase | PR | Status |
|---|---|---|
| Decisions D1–D9 | n/a | settled 2026-09-23 |
| 1 Editor-neutral server | | done 2026-09-23, uncommitted |
| 2 Package metadata | | done 2026-09-23, uncommitted |
| 3 Package-level tests | | done 2026-09-23, uncommitted |
| 4 Extension cut-over | | done 2026-09-23, uncommitted; manual VS Code checks (4.3, 4.7, 4.9) open |
| 5 CI & release | | done 2026-09-23, uncommitted, rehearsed locally; a real CI run open |
| 6 Documentation | | done 2026-09-23, uncommitted; Emacs, Sublime and Kate snippets not run |
