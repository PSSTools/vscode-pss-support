CLI Reference — pss-check
==========================

``pss-check`` is a command-line tool that checks PSS source files outside of
VS Code. It runs the same parser and semantic analysis as the extension.

Usage
-----

.. code-block:: bash

   # Check all .pss files in current directory (recursive)
   npx pss-check .

   # Check a specific file
   npx pss-check path/to/file.pss

   # Check a specific directory
   npx pss-check src/pss/

Output Format
-------------

Diagnostics are printed in GCC-compatible format::

   file.pss:12:5: error: Undefined type 'my_type'
   file.pss:20:1: warning: Duplicate field declaration: 'addr'

Format: ``file:line:col: severity: message``

Exit Codes
----------

.. list-table::
   :header-rows: 1
   :widths: 15 85

   * - Code
     - Meaning
   * - 0
     - No errors found.
   * - 1
     - One or more errors found.
   * - 2
     - Cannot access the target path.

CI Integration
--------------

GitHub Actions
^^^^^^^^^^^^^^

.. code-block:: yaml

   - name: Check PSS sources
     run: npx pss-check src/

GitLab CI
^^^^^^^^^

.. code-block:: yaml

   pss-lint:
     script:
       - npx pss-check src/
     allow_failure: false

Limitations
-----------

- Reports syntax and semantic errors only (same checks as the extension).
- Does not format or fix files.
- Requires Node.js 18 or newer.
