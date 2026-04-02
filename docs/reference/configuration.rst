Configuration
=============

VS Code Settings
----------------

All settings are prefixed with ``pss.`` and can be changed in
**File → Preferences → Settings** (``Ctrl+,``).

.. list-table::
   :header-rows: 1
   :widths: 40 15 15 30

   * - Setting
     - Type
     - Default
     - Description
   * - ``pss.maxNumberOfProblems``
     - number
     - 100
     - Maximum number of diagnostics reported per file.
   * - ``pss.trace.server``
     - string
     - ``"off"``
     - LSP protocol tracing level: ``"off"``, ``"messages"``, or ``"verbose"``.
   * - ``pss.format.indentSize``
     - number
     - 4
     - Spaces per indentation level.
   * - ``pss.format.insertFinalNewline``
     - boolean
     - true
     - Insert a newline at the end of the file when formatting.
   * - ``pss.lint.enabled``
     - boolean
     - true
     - Master switch for all lint diagnostics.
   * - ``pss.lint.rules.no-empty-constraint``
     - boolean
     - true
     - Warn on empty ``constraint`` blocks.
   * - ``pss.lint.rules.no-unused-field``
     - boolean
     - true
     - Warn on fields that are never referenced.
   * - ``pss.lint.rules.naming-convention``
     - boolean
     - true
     - Suggest naming-convention fixes.
   * - ``pss.lint.rules.max-activity-depth``
     - boolean
     - true
     - Warn on deeply nested activities.
   * - ``pss.lint.rules.no-unreachable-branch``
     - boolean
     - true
     - Warn on branches that can never be taken.

Project Configuration File
--------------------------

Create a ``.pssconfig.json`` file in your workspace root for project-level
settings that are checked into source control alongside the PSS sources.

Example:

.. code-block:: json

   {
     "include": ["src/**/*.pss"],
     "exclude": ["test/fixtures/**"],
     "standardVersion": "3.1",
     "defines": {
       "SIMULATION": "1"
     },
     "format": {
       "indentSize": 4,
       "insertFinalNewline": true
     },
     "lint": {
       "enabled": true,
       "rules": {
         "no-empty-constraint": true,
         "naming-convention": false
       }
     }
   }

Fields
^^^^^^

.. list-table::
   :header-rows: 1
   :widths: 30 15 55

   * - Field
     - Type
     - Description
   * - ``include``
     - string[]
     - Glob patterns for files to index. Default: ``["**/*.pss"]``.
   * - ``exclude``
     - string[]
     - Glob patterns for files to exclude from indexing.
   * - ``standardVersion``
     - string
     - PSS standard version: ``"3.0"`` or ``"3.1"``.
   * - ``defines``
     - object
     - Compile-time defines used in ``compile if`` expressions.
   * - ``format``
     - object
     - Formatting options (same keys as the VS Code settings above).
   * - ``lint.enabled``
     - boolean
     - Master switch for lint diagnostics.
   * - ``lint.rules``
     - object
     - Per-rule enable/disable map (rule name → boolean).
