Diagnostic Reference
====================

All diagnostics have ``"source": "pss"`` and a stable string ``code``.
Severities follow the LSP convention (Error, Warning, Information, Hint).

Syntax Errors
-------------

.. list-table::
   :header-rows: 1
   :widths: 25 15 60

   * - Code
     - Severity
     - Description
   * - ``syntax-error``
     - Error
     - ANTLR4 parse error. The message contains the parser's description
       of the unexpected token or missing construct.

Symbol Table Errors (Pass 1)
-----------------------------

.. list-table::
   :header-rows: 1
   :widths: 25 15 60

   * - Code
     - Severity
     - Description
   * - ``duplicate-symbol``
     - Error
     - Two declarations share the same name in the same scope.
       Related information points to the conflicting declaration.

Extension Errors (Pass 2)
--------------------------

.. list-table::
   :header-rows: 1
   :widths: 30 15 55

   * - Code
     - Severity
     - Description
   * - ``extend-missing-target``
     - Error
     - An ``extend`` declaration does not specify a target type.
   * - ``unresolved-extend-target``
     - Error
     - The target type named in an ``extend`` declaration cannot be found.
   * - ``extend-kind-mismatch``
     - Error
     - The ``extend`` declaration's kind does not match the target's kind
       (e.g. ``extend struct`` applied to an ``action``).
   * - ``extend-duplicate-member``
     - Error
     - The extension adds a member whose name already exists in the target.

Import Errors (Pass 2)
-----------------------

.. list-table::
   :header-rows: 1
   :widths: 25 15 60

   * - Code
     - Severity
     - Description
   * - ``unresolved-import``
     - Error
     - The import path does not resolve to any known package.

Reference Resolution Errors (Pass 3)
--------------------------------------

.. list-table::
   :header-rows: 1
   :widths: 25 15 60

   * - Code
     - Severity
     - Description
   * - ``undefined-type``
     - Error
     - A type name used in a field declaration, parameter, or expression
       cannot be resolved.
   * - ``unresolved-base-type``
     - Error
     - The base type in an inheritance clause cannot be resolved.
   * - ``circular-inheritance``
     - Error
     - A type's inheritance chain forms a cycle.

Lint Warnings
-------------

Lint diagnostics are produced by the lint service and can be configured
individually. See :doc:`configuration` for per-rule enable/disable settings.

.. list-table::
   :header-rows: 1
   :widths: 30 15 55

   * - Code
     - Severity
     - Description
   * - ``no-empty-constraint``
     - Warning
     - A ``constraint`` block contains no constraints.
   * - ``no-unused-field``
     - Warning
     - A field is declared but never referenced.
   * - ``naming-convention``
     - Hint
     - An identifier does not follow PSS naming conventions.
   * - ``max-activity-depth``
     - Warning
     - An activity is nested beyond the configured depth threshold.
   * - ``no-unreachable-branch``
     - Warning
     - A branch in a ``select`` or ``match`` construct can never be taken.

Diagnostic Structure
--------------------

Each diagnostic carries:

- **Range** — source location (start line/column to end line/column).
- **Severity** — Error, Warning, Information, or Hint.
- **Code** — stable string identifier listed above.
- **Source** — always ``"pss"``.
- **Message** — human-readable description.
- **Related information** (optional) — additional source locations relevant
  to the diagnostic, e.g. the conflicting declaration for
  ``duplicate-symbol``.
