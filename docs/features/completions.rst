Completions
===========

Context-Sensitive Completions
------------------------------

Completions appear automatically as you type, or can be triggered manually
with ``Ctrl+Space``. The engine detects the cursor's context and offers
relevant suggestions:

.. list-table::
   :header-rows: 1
   :widths: 25 75

   * - Context
     - Suggestions
   * - Top-level
     - Keywords: ``action``, ``component``, ``struct``, ``enum``, ``package``, ``import``
   * - Action body
     - ``rand``, ``constraint``, ``activity``, ``exec``, field types
   * - Struct body
     - ``rand``, ``constraint``, field types
   * - Component body
     - ``action``, ``struct``, ``pool``, ``bind``
   * - Activity
     - ``do``, ``parallel``, ``schedule``, ``select``, ``repeat``
   * - Constraint
     - ``foreach``, ``forall``, ``if``, ``unique``, field names
   * - Type position
     - All visible types — built-in and user-defined
   * - Member access (``.``)
     - Fields and functions of the resolved type
   * - Annotation (``@``)
     - Annotation type names
   * - Import path
     - Package names discovered in the workspace
   * - Template parameter (``<``)
     - Valid template arguments for the enclosing parameterised type

Trigger characters: ``.``, ``:``, ``@``, ``<``

Signature Help
--------------

Inside a function call's argument list, signature help shows the function
signature with the active parameter highlighted.
Trigger characters: ``(``, ``,``

Snippets
--------

Type a prefix and press ``Tab`` to expand a snippet. Available snippets
cover all major PSS constructs:

**Types**
  ``action``, ``abstract action``, ``component``, ``struct``, ``buffer``,
  ``resource``, ``enum``, ``package``, ``monitor``, ``annotation``, ``typedef``

**Constraints**
  ``constraint``, ``dynamic constraint``, ``constraint foreach``,
  ``constraint implies``

**Exec blocks**
  ``exec body``, ``exec pre_solve``, ``exec post_solve``

**Functions**
  ``function``, ``pure function``, ``covergroup``

**Extensions**
  ``extend action``, ``extend component``, ``extend struct``, ``extend enum``

**Resource flow**
  ``input``, ``output``, ``lock``, ``share``

**Activity**
  ``parallel``, ``schedule``, ``select``, ``replicate``, ``repeat``, ``match``

**Misc**
  ``rand``, ``template action``

Inlay Hints
-----------

Inline annotations are displayed directly in the editor (without modifying
the source file):

- **Template parameter names** at instantiation sites, showing which
  formal parameter each argument corresponds to.
- **Resolved action type** on ``do`` handle traversals.

CodeLens
--------

CodeLens annotations appear above declarations showing:

- **References** — number of references to the symbol across the workspace.
  Click to run *Find All References*.
- **Subtypes** — number of types that inherit from or extend this type.
  Click to open the type hierarchy.
