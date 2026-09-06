Contributing
============

Prerequisites
-------------

- **Node.js** 18 or newer (Node.js 22 recommended). Use ``nvm use 22`` if
  available.
- **Java** 11 or newer — needed only for regenerating the ANTLR grammar.
- **Python** 3.x — needed only if regenerating AST classes from YAML
  definitions.

Project Structure
-----------------

.. code-block:: text

   vscode-pss-support/
     client/                     # VS Code extension client
       src/extension.ts          # Extension entry point
     server/                     # Language server
       src/
         core/                   # Pure logic layer (no LSP/VS Code deps)
           ast/                  # AST node types and utilities
             generated/          # Auto-generated AST classes from YAML
           parser/               # ANTLR parser facade and AST builder
           services/             # Document symbols, hover, completion, etc.
           types/                # Model types (Diagnostic, SourceRange, …)
           io/                   # I/O abstraction interfaces
           analysis/             # Semantic analysis passes
         generated/              # ANTLR-generated lexer/parser
         lsp/                    # LSP protocol handlers
         server.ts               # Server entry point
       test/                     # Tests mirroring the src/ structure
       scripts/                  # Build scripts (gen-ast.mjs)
       vitest.config.ts          # Test configuration
     packages/                   # Fetched by ivpm; not tracked in git
       pssparser/                # Grammar (src/PSS*.g4) and AST YAML (ast/*.yaml)
       pyastbuilder/             # Python AST builder tool
       python/                   # ivpm-managed virtualenv

Build Steps
-----------

Two directories under ``server/src`` are **generated, not tracked**:

* ``server/src/generated/`` — the ANTLR lexer and parser, from
  ``packages/pssparser/src/PSS{Lexer,Parser}.g4``
* ``server/src/core/ast/generated/`` — the AST classes, from
  ``packages/pssparser/ast/*.yaml``, via ``astbuilder gen-ts`` (the same
  ``pyastbuilder`` tool that generates pssparser's C++ AST, so all three
  language bindings come from one generator)

A fresh clone therefore will not compile until you bootstrap. This is
deliberate: the PSS language moves, and deriving these at build time means an
upstream grammar or AST change surfaces as a CI failure rather than as a
checked-in copy that silently falls behind.

.. code-block:: bash

   # Fetch pssparser and friends, then derive the TypeScript sources from them.
   # Requires Python 3 (for ivpm) and Java 11+ (ANTLR is a Java tool).
   npm install
   npm run bootstrap

   # Thereafter, to re-derive after pssparser moves:
   npm run generate

   # Compile TypeScript
   npm run compile

   # Run core tests
   npm run test:core

No pssparser version is pinned. If a grammar or AST change upstream breaks the
build here, that is the intended signal — fix the consumer, do not pin the
dependency.

Running Tests
-------------

.. code-block:: bash

   cd server

   # All tests
   npx vitest run

   # Core tests only
   npx vitest run --project core

   # Watch mode
   npx vitest

Architecture Constraint
-----------------------

The ``server/src/core/`` directory must **not** import from
``vscode-languageserver``, ``vscode``, or any other LSP/editor library.
This is enforced by an ESLint ``no-restricted-imports`` rule. The core layer
must be testable in isolation without any editor dependencies.

Code Style
----------

- TypeScript strict mode is enabled.
- Compilation target: ES2020.
- Indent: 2 spaces.
