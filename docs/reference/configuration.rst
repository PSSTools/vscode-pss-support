Configuration
=============

There are two independent mechanisms, and which one a setting belongs to is not
a matter of preference:

* **VS Code settings** (``File → Preferences → Settings``) — two keys, both
  about the editor integration itself.
* **A** ``.pssconfig.json`` **file** in the workspace root — everything about
  how PSS sources are formatted and linted. These are *not* VS Code settings
  and do not appear in the Settings UI.

VS Code Settings
----------------

.. list-table::
   :header-rows: 1
   :widths: 32 12 14 42

   * - Setting
     - Type
     - Default
     - Description
   * - ``pss.trace.server``
     - string
     - ``"off"``
     - LSP protocol tracing level: ``"off"``, ``"messages"``, or ``"verbose"``.
       Handled by the language-client library.
   * - ``pss.maxNumberOfProblems``
     - number
     - 100
     - **Declared but not yet honoured.** The server does not read it, so
       changing it has no effect today. Wiring it is part of the diagnostics
       work (the ``PSS029`` error cap).

That is the complete list. A test asserts that
``pss.maxNumberOfProblems`` is the *only* declared-and-unread setting, so this
gap cannot quietly grow.

Project Configuration File
--------------------------

Create ``.pssconfig.json`` in your workspace root. It is read once, when the
server initializes against the first workspace root.

.. code-block:: json

   {
     "format": {
       "indentSize": 4,
       "insertFinalNewline": true
     },
     "lint": {
       "rules": {
         "no-empty-constraint": true,
         "no-unused-field": true,
         "naming-convention": false,
         "max-activity-depth": true,
         "no-unreachable-branch": true
       }
     }
   }

Honoured fields
^^^^^^^^^^^^^^^

.. list-table::
   :header-rows: 1
   :widths: 40 12 14 34

   * - Field
     - Type
     - Default
     - Description
   * - ``format.indentSize``
     - number
     - 4
     - Spaces per indentation level.
   * - ``format.insertFinalNewline``
     - boolean
     - true
     - Insert a newline at end of file when formatting.
   * - ``lint.rules.no-empty-constraint``
     - boolean
     - true
     - Warn on empty ``constraint`` blocks.
   * - ``lint.rules.no-unused-field``
     - boolean
     - true
     - Warn on fields that are never referenced.
   * - ``lint.rules.naming-convention``
     - boolean
     - true
     - Suggest naming-convention fixes.
   * - ``lint.rules.max-activity-depth``
     - boolean
     - true
     - Warn on deeply nested activities.
   * - ``lint.rules.no-unreachable-branch``
     - boolean
     - true
     - Warn on branches that can never be taken.

Accepted but not yet honoured
^^^^^^^^^^^^^^^^^^^^^^^^^^^^^

These keys are part of the ``.pssconfig.json`` schema and are parsed without
error, but nothing currently reads them. They are listed so that a file using
them is not mistaken for a file that is working:

.. list-table::
   :header-rows: 1
   :widths: 26 74

   * - Field
     - Intended meaning
   * - ``include``
     - Glob patterns for files to index. Indexing currently discovers all
       ``.pss`` files under the workspace root.
   * - ``exclude``
     - Glob patterns to exclude from indexing.
   * - ``standardVersion``
     - PSS standard version. The parser accepts the 3.1 grammar unconditionally.
   * - ``defines``
     - Compile-time defines for ``compile if`` expressions.
   * - ``lint.enabled``
     - Master switch for lint diagnostics. Disable rules individually under
       ``lint.rules`` instead.
