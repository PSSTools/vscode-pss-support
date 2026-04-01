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
     packages/
       zuspec-fe-pss/            # Reference grammar and AST YAML definitions
       pyastbuilder/             # Python AST builder tool

Build Steps
-----------

.. code-block:: bash

   # Install all workspace dependencies
   npm install

   # Generate ANTLR parser (requires Java 11+)
   cd server && npm run build:grammar && cd ..

   # Regenerate AST from YAML (optional — files are checked in)
   cd server && node scripts/gen-ast.mjs \
       ../packages/zuspec-fe-pss/ast src/core/ast/generated && cd ..

   # Compile TypeScript
   npm run compile

   # Run core tests
   npm run test:core

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
