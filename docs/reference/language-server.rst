Language Server
===============

The language server behind the extension is also published on its own, as the
npm package ``@psstools/pss-language-server``. It speaks the Language Server
Protocol, so any editor with an LSP client can use it. The extension runs the
same package, released from the same tag.

Installing
----------

.. code-block:: bash

   npm install -g @psstools/pss-language-server

This needs Node.js 18 or newer and installs one command, ``pss-ls``. The parser
is WebAssembly, so nothing is compiled on install.

The ``pss-ls`` command
----------------------

.. code-block:: text

   pss-ls [--stdio | --node-ipc | --socket=PORT | --pipe=NAME]
   pss-ls --version
   pss-ls --help

Editors start ``pss-ls --stdio``, which is also the default. ``pss-ls`` is only
a language server: it takes no files, and started from a terminal it waits for
an LSP client on standard input. To check PSS files from the command line or
in CI, use the ``pssparser`` command from the pssparser Python package
(``pip install pssparser``).

Editor setup
------------

An editor needs to know that ``*.pss`` files are PSS (language ID ``pss``) and
to start ``pss-ls --stdio`` for them. In Neovim 0.11 or later, for example, no
plugin is needed:

.. code-block:: lua

   vim.filetype.add({ extension = { pss = 'pss' } })

   vim.lsp.config('pss_ls', {
     cmd = { 'pss-ls', '--stdio' },
     filetypes = { 'pss' },
     root_markers = { '.pssconfig.json', '.git' },
   })
   vim.lsp.enable('pss_ls')

The `package README
<https://github.com/PSSTools/vscode-pss-support/tree/master/server#readme>`_,
which is also its npm page, has the setup for Neovim with nvim-lspconfig,
Emacs (eglot and lsp-mode), Helix, Sublime Text and Kate.

Workspace
---------

The server indexes every ``.pss`` file under the workspace roots the client
sends: ``workspaceFolders``, or else ``rootUri``. With no root it serves only
the files that are open. If the client supports dynamic registration of file
watchers, the server asks it to watch ``**/*.pss``, so files changed outside
the editor are picked up.

Project settings come from ``.pssconfig.json`` at the first workspace root; see
:doc:`configuration`. The server does not read ``workspace/configuration``, so
there are no editor-side settings.

The server adapts to the capabilities the client declares: hover is plaintext
unless the client takes markdown, document symbols are flat unless it takes a
hierarchy, and newer symbol and completion kinds are mapped to the nearest ones
the client knows. Positions are UTF-16, the LSP default.

Non-standard extensions
-----------------------

Both are optional, and a client that knows nothing about them loses nothing
else.

``initializationOptions.vscodeCommands``
   Boolean, default ``false``. The VS Code extension sets it to say that the
   client can run VS Code's built-in commands and the extension's own. Every
   code lens the server produces runs one of those, so code lenses are
   advertised and returned only when it is ``true``. Other editors should leave
   it unset. Other ``initializationOptions`` are ignored.

``pss/activityDiagram`` request
   Params ``{ uri: string, line: number }``, with ``line`` 0-based. Returns the
   activity that starts at or before that line as a graph of ``nodes`` and
   ``edges``, or ``null`` if there is none. Each node has an ``id``, a ``kind``
   (``action``, ``fork``, ``join``, ``decision``, ``start``, ``end`` or
   ``group``) and optionally a ``label``, ``parentId``, ``sourceUri`` and a
   0-based ``sourceLine``. Each edge has an ``id``, ``sourceId``, ``targetId``,
   a ``style`` (``solid`` or ``dashed``) and optionally a ``label``. The
   extension draws this as its activity diagram (see :doc:`../features/diagrams`).
