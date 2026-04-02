Diagnostics
===========

The extension reports problems in real time as you edit. Diagnostics appear
as squiggles in the editor and are listed in the **Problems** panel
(``Ctrl+Shift+M``).

Syntax Diagnostics
------------------

Syntax errors are detected immediately by the ANTLR4 parser:

- Missing or mismatched braces, brackets, and parentheses.
- Invalid or unexpected tokens.
- Incomplete declarations.

Semantic Diagnostics
--------------------

After parsing, multiple analysis passes check semantic correctness:

**Pass 1 — Symbol Table**
  - Duplicate declarations within the same scope.

**Pass 2 — Extensions and Imports**
  - ``extend`` target not found in scope.
  - ``extend`` kind mismatch (e.g. extending a ``struct`` as an ``action``).
  - ``extend`` adds a member that already exists in the target.
  - Unresolved ``import`` paths.

**Pass 3 — Reference Resolution**
  - Undefined types in field declarations.
  - Unresolved base types in inheritance (``action a : unknown_base``).
  - Circular inheritance chains.

Lint Rules
----------

The lint service adds optional style and quality checks on top of the core
semantic analysis. Each rule can be enabled or disabled individually in the
:doc:`/reference/configuration` settings or in ``.pssconfig.json``.

.. list-table::
   :header-rows: 1
   :widths: 35 15 50

   * - Rule
     - Default
     - Description
   * - ``no-empty-constraint``
     - enabled
     - Warn on empty ``constraint`` blocks.
   * - ``no-unused-field``
     - enabled
     - Warn on fields that are never referenced.
   * - ``naming-convention``
     - enabled
     - Suggest fixes for identifiers that violate naming conventions.
   * - ``max-activity-depth``
     - enabled
     - Warn on activities nested beyond a configurable depth.
   * - ``no-unreachable-branch``
     - enabled
     - Warn on branches that can never be taken.

To disable the entire lint service set ``pss.lint.enabled`` to ``false``.

Semantic Tokens
---------------

The extension provides AST-aware syntax highlighting that goes beyond the
TextMate grammar. Token types and modifiers are applied based on the
resolved semantic meaning of each identifier:

- Type declarations vs. type references.
- ``rand`` fields vs. regular fields.
- Enum member names.
- Function names and parameters.
- Annotation names.

This allows editor themes to colour, e.g., a type name differently depending
on whether it is being defined or used.
