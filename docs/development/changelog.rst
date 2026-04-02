Changelog
=========

0.3.0
-----

Phase 5 — Polish & Extensions
^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
- Document formatting (AST-driven, configurable indent).
- Lint service with configurable rules.
- Monitor activity diagram builder.
- Project configuration via ``.pssconfig.json``.
- ``pss-check`` CLI tool with GCC-compatible output.
- Resource binding analysis and tree view.
- CodeLens for references and inheritance counts.
- Edit debouncing (300 ms).
- Sphinx documentation site skeleton.
- Condensed README for the VS Code Marketplace.
- Configuration and CLI reference docs.

Phase 4 — Advanced Features
^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
- Activity diagram visualisation (webview with SVG rendering via ELK.js).
- Rename symbol across workspace.
- Code actions — import suggestions for unresolved types.
- Call hierarchy (action composition via ``do`` traversals).
- Type hierarchy (super/subtypes and extensions).
- Inlay hints (template parameters, action types).
- CodeLens for references and inheritance.
- Diagram generation benchmarks.

Phase 3 — Productivity
^^^^^^^^^^^^^^^^^^^^^^^
- Context-sensitive completions (10 context categories).
- Completion item resolve with lazy documentation loading.
- Signature help for function parameters.
- Workspace symbol search with fuzzy matching.
- Semantic tokens (12 token types, 7 modifiers).
- Folding ranges (brace blocks, import groups).
- 44 code snippets covering all PSS constructs.
- User guide documentation.

Phase 2 — Core Intelligence
^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
- Pass 2: type extension application (``extend action``/``struct``/``enum``).
- Pass 2: import resolution.
- Pass 3: reference resolution with cross-file tracking.
- Semantic diagnostics (undefined types, duplicates, circular inheritance).
- Workspace index with dependency graph.
- Hover information (signature, docs, type info).
- Go to Definition (cross-file).
- Find All References.

Phase 1 — Foundation
^^^^^^^^^^^^^^^^^^^^^
- Full PSS 3.1 grammar parsing via ANTLR4.
- TypeScript AST with generated classes from pyastbuilder.
- AST builder covering all grammar productions.
- Pass 1 semantic analysis (symbol table construction).
- Document symbols (outline view).
- Standard library loading.
- MVC architecture with testable core layer.
