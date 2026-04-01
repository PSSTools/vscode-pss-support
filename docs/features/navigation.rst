Navigation
==========

Outline View
------------

The Outline panel (``Ctrl+Shift+O``) shows a hierarchical tree of all
declarations in the current file: packages, components, actions, structs,
enums, fields, constraints, activities, and functions.

Go to Definition
----------------

Press ``F12`` or ``Ctrl+Click`` on any symbol to jump to its declaration.
Works across files for types, fields, base-type references, imports, and
activity traversals.

Find All References
-------------------

Press ``Shift+F12`` to find every reference to a symbol across the entire
workspace, including type references, inheritance, extensions, and activity
traversals.

Workspace Symbol Search
-----------------------

Press ``Ctrl+T`` and type a partial name to locate any declaration across
all ``.pss`` files in the workspace. Supports fuzzy matching.

Call Hierarchy
--------------

Press ``Shift+Alt+H`` on an action to open the call hierarchy:

- **Outgoing calls** — actions traversed by ``do`` in the action's activity.
- **Incoming calls** — actions whose activities traverse this action.

Type Hierarchy
--------------

Open the type hierarchy for any type to inspect:

- **Supertypes** — walk the ``: base_type`` chain upward.
- **Subtypes** — all types that inherit from this type.
- **Extensions** — ``extend`` declarations targeting this type.

Rename Symbol
-------------

Press ``F2`` to rename a symbol and all its references across the workspace.
The extension validates that the cursor is on a renamable identifier before
applying the rename. Supported symbol kinds: types, fields, enums, functions,
and constraint blocks.

Code Actions
------------

A lightbulb appears when the editor detects a fixable issue. Currently
supported quick fixes:

- **Import suggestion** — for an unresolved type name, suggests adding an
  ``import`` statement for a matching type found in another package.

Hover Information
-----------------

Hover over any symbol to see its signature, doc-comment, type information,
and source location. Supported symbol kinds: actions, components, structs,
fields, enums, functions, packages, and annotations.
