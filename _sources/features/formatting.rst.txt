Formatting
==========

Document Formatting
-------------------

Press ``Shift+Alt+F`` (or right-click → **Format Document**) to reformat the
current file. The formatter is AST-driven: it re-indents declarations,
normalises whitespace around operators, and can optionally insert a trailing
newline.

Formatting options are configured in VS Code settings or in
``.pssconfig.json``. See :doc:`/reference/configuration` for details.

Range Formatting
----------------

Select a region of code and use **Format Selection** to format only that
range. The formatter respects the indentation context of the selection.

Folding
-------

Brace-delimited blocks can be folded and unfolded:

- Type bodies (``action``, ``component``, ``struct``, …)
- ``constraint`` and ``activity`` blocks
- ``exec`` blocks
- Multi-line ``/* … */`` comments
- Consecutive ``import`` statements are grouped into a single foldable region

Use ``Ctrl+K Ctrl+0`` to fold all and ``Ctrl+K Ctrl+J`` to unfold all.
