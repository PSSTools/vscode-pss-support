# @psstools/pss-language-server

A language server for the Accellera Portable Test and Stimulus Standard (PSS).
It speaks the Language Server Protocol, so it works with any editor that has
an LSP client. It is the same server the
[PSS extension for VS Code](https://github.com/PSSTools/vscode-pss-support)
uses.

## Install

```sh
npm install -g @psstools/pss-language-server
```

This needs Node.js 18 or newer, and installs one command, `pss-ls`. The parser
is WebAssembly, so there is nothing to compile and no native dependency.

Every editor below starts it the same way:

```sh
pss-ls --stdio
```

`pss-ls --help` lists the other transports (`--node-ipc`, `--socket=PORT`,
`--pipe=NAME`), and `pss-ls --version` prints the version. `pss-ls` takes no
files: started from a terminal, it waits for an LSP client on stdin.

## What it provides

- Diagnostics: syntax errors, and semantic errors such as undefined types,
  duplicate declarations and circular inheritance, plus configurable lint
  rules
- Go to definition and find references, across the files of the workspace
- Hover, completion (triggered by `.` `:` `@` `<`) and signature help
- Document and workspace symbols, folding ranges and semantic tokens
- Rename, and code actions that add an import for an unresolved type
- Call hierarchy (action composition through `do` traversals) and type
  hierarchy (inheritance and extensions)
- Inlay hints for template parameters
- Document and range formatting

The server adapts to what the client says it supports: hover is sent as
plaintext unless the client takes markdown, document symbols are flat unless
it takes a hierarchy, and newer symbol and completion kinds are mapped to the
nearest ones the client knows. Positions are UTF-16, the LSP default.

## Workspace and configuration

The server indexes every `.pss` file under the workspace roots the client
sends: `workspaceFolders`, or else `rootUri`. With no root at all it serves
only the files that are open. If the client supports dynamic registration of
file watchers, the server asks it to watch `**/*.pss`, so files changed
outside the editor are picked up.

Project settings go in `.pssconfig.json` at the (first) workspace root. It is
read once, when the server starts:

```json
{
  "format": {
    "indentSize": 4,
    "insertFinalNewline": true
  },
  "lint": {
    "rules": {
      "no-empty-constraint": true,
      "no-unused-field": true,
      "naming-convention": false,
      "max-activity-depth": true,
      "no-unreachable-branch": true
    }
  }
}
```

| Field | Default | Meaning |
|---|---|---|
| `format.indentSize` | `4` | Spaces per indentation level |
| `format.insertFinalNewline` | `true` | End a formatted file with a newline |
| `lint.rules.no-empty-constraint` | `true` | Warn on empty `constraint` blocks |
| `lint.rules.no-unused-field` | `true` | Warn on fields that are never referenced |
| `lint.rules.naming-convention` | `true` | Suggest naming-convention fixes |
| `lint.rules.max-activity-depth` | `true` | Warn on deeply nested activities |
| `lint.rules.no-unreachable-branch` | `true` | Warn on branches that can never be taken |

`include`, `exclude`, `standardVersion`, `defines` and `lint.enabled` are
accepted without error but not yet acted on. The server does not read
`workspace/configuration`, so there are no editor-side settings to set.

## Editor setup

Each editor needs two things: to know that `*.pss` files are PSS, and to start
`pss-ls --stdio` for them. Where an editor asks for a language ID, use `pss`.
Put `.pssconfig.json` (or your version-control directory) at the project root
so the editor finds the root.

### Neovim 0.11 and later

No plugin is needed. In `init.lua`:

```lua
vim.filetype.add({ extension = { pss = 'pss' } })

vim.lsp.config('pss_ls', {
  cmd = { 'pss-ls', '--stdio' },
  filetypes = { 'pss' },
  root_markers = { '.pssconfig.json', '.git' },
})
vim.lsp.enable('pss_ls')
```

### Neovim 0.10 with nvim-lspconfig

nvim-lspconfig has no PSS entry yet, so register one:

```lua
vim.filetype.add({ extension = { pss = 'pss' } })

local configs = require('lspconfig.configs')
if not configs.pss_ls then
  configs.pss_ls = {
    default_config = {
      cmd = { 'pss-ls', '--stdio' },
      filetypes = { 'pss' },
      root_dir = require('lspconfig.util').root_pattern('.pssconfig.json', '.git'),
    },
  }
end
require('lspconfig').pss_ls.setup({})
```

On Neovim 0.11 and later, use the `vim.lsp.config` form above instead.

### Emacs with eglot

```elisp
(define-derived-mode pss-mode prog-mode "PSS"
  "Major mode for Portable Stimulus (PSS) files."
  (setq-local comment-start "// "))
(add-to-list 'auto-mode-alist '("\\.pss\\'" . pss-mode))

(with-eval-after-load 'eglot
  (add-to-list 'eglot-server-programs '(pss-mode "pss-ls" "--stdio")))
```

Then `M-x eglot` in a PSS buffer, or add `eglot-ensure` to `pss-mode-hook`.

### Emacs with lsp-mode

With the same `pss-mode` as above:

```elisp
(with-eval-after-load 'lsp-mode
  (add-to-list 'lsp-language-id-configuration '(pss-mode . "pss"))
  (lsp-register-client
   (make-lsp-client
    :new-connection (lsp-stdio-connection '("pss-ls" "--stdio"))
    :activation-fn (lsp-activate-on "pss")
    :server-id 'pss-ls)))
```

Then `M-x lsp`, or add `lsp-deferred` to `pss-mode-hook`.

### Helix

In `~/.config/helix/languages.toml`:

```toml
[language-server.pss-ls]
command = "pss-ls"
args = ["--stdio"]

[[language]]
name = "pss"
scope = "source.pss"
file-types = ["pss"]
roots = [".pssconfig.json"]
comment-token = "//"
block-comment-tokens = { start = "/*", end = "*/" }
indent = { tab-width = 4, unit = "    " }
language-servers = ["pss-ls"]
```

Helix has no PSS tree-sitter grammar, so there is no syntax highlighting, but
diagnostics, navigation and completion work. `hx --health pss` checks that
Helix finds `pss-ls`.

### Sublime Text (LSP package)

Install the [LSP](https://packagecontrol.io/packages/LSP) package, then in
*Preferences → Package Settings → LSP → Settings*:

```json
{
  "clients": {
    "pss-ls": {
      "enabled": true,
      "command": ["pss-ls", "--stdio"],
      "selector": "source.pss"
    }
  }
}
```

The selector matches files whose syntax has the scope `source.pss`, so this
also needs a PSS syntax that assigns it.

### Kate

In *Settings → Configure Kate → LSP Client → User Server Settings*:

```json
{
  "servers": {
    "pss": {
      "command": ["pss-ls", "--stdio"],
      "highlightingModeRegex": "^PSS$"
    }
  }
}
```

Kate starts the server for documents whose highlighting mode matches
`highlightingModeRegex`, so this needs a KSyntaxHighlighting definition named
`PSS` that claims `*.pss`.

### Zed

Zed attaches language servers only to languages that an extension defines, and
there is no PSS extension for Zed yet, so it cannot be set up from settings
alone.

## Non-standard extensions

Both are optional. A client that knows nothing about them loses nothing else.

**`initializationOptions.vscodeCommands`** (boolean, default `false`). Set by
the VS Code extension: the client can run VS Code's built-in commands and the
extension's own. Every code lens the server produces runs one of those, so
code lenses are advertised and returned only when this is `true`. Other
editors should leave it unset. Any other `initializationOptions` are ignored.

**`pss/activityDiagram` request.** Params `{ uri: string, line: number }`,
with `line` 0-based. Returns the activity that starts at or before that line
as a graph, or `null` if there is none:

```ts
{
  nodes: { id: string; kind: 'action' | 'fork' | 'join' | 'decision' | 'start' | 'end' | 'group';
           label?: string; parentId?: string; sourceUri?: string; sourceLine?: number }[];
  edges: { id: string; sourceId: string; targetId: string; label?: string;
           style: 'solid' | 'dashed' }[];
}
```

`sourceLine` is 0-based. The VS Code extension draws the graph as its activity
diagram.

## Command-line checking

`pss-ls` is only a language server. To check PSS files from the command line
or in CI, use the `pssparser` command from the pssparser Python package
(`pip install pssparser`).

## License

Apache-2.0
