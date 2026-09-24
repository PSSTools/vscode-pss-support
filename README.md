# VSCode PSS Support

Language support for the Accellera Portable Stimulus Standard (PSS) 3.1.

## Features

**Navigation**
- Outline view with full declaration hierarchy
- Go to Definition (`F12`) -- across files
- Find All References (`Shift+F12`)
- Call Hierarchy -- action composition via `do` traversals
- Type Hierarchy -- inheritance chains and extensions
- Workspace Symbol Search (`Ctrl+T`)

**Editing**
- Context-sensitive completions with trigger characters `.` `:` `@` `<`
- Signature help for function parameters
- Rename symbol across workspace (`F2`)
- Code actions -- import suggestions for unresolved types
- 44 snippets covering all PSS constructs
- Document formatting

**Analysis**
- Syntax diagnostics (real-time ANTLR4 parsing)
- Semantic diagnostics (undefined types, duplicates, circular inheritance)
- Configurable lint rules
- Semantic tokens for AST-aware syntax highlighting
- Inlay hints for template parameters

**Visualization**
- Activity diagrams with click-to-navigate
- Resource binding tree view
- CodeLens showing reference/subtype counts

## Quick Start

1. Install the extension
2. Open a folder with `.pss` files
3. Outline, diagnostics, and completions activate automatically

## Keyboard Shortcuts

| Action | Shortcut |
|--------|----------|
| Go to Definition | `F12` |
| Find All References | `Shift+F12` |
| Rename | `F2` |
| Outline | `Ctrl+Shift+O` |
| Workspace Symbols | `Ctrl+T` |
| Trigger Completions | `Ctrl+Space` |
| Format Document | `Shift+Alt+F` |

## Configuration

Create `.pssconfig.json` in your workspace root for project settings
(formatting and lint rules). See
[docs/reference/configuration.rst](docs/reference/configuration.rst).

## Other editors

The language server behind this extension is published on its own as
[`@psstools/pss-language-server`](https://www.npmjs.com/package/@psstools/pss-language-server).
It works with any LSP client, including Neovim, Emacs and Helix:

```sh
npm install -g @psstools/pss-language-server
```

This installs `pss-ls`; have your editor start `pss-ls --stdio` for `*.pss`
files. The [package README](server/README.md) has the setup for each editor.

## Command-line checking

To check PSS files from the command line or in CI, use the `pssparser`
command from the pssparser Python package (`pip install pssparser`).

## Development

See [docs/development/contributing.rst](docs/development/contributing.rst) for build instructions.

## Requirements

- VS Code >= 1.75.0
- Node.js >= 18 (development only)

## License

Apache 2.0 -- see [LICENSE](LICENSE).
