Diagrams
========

Activity Diagrams
-----------------

Right-click inside an action that contains an ``activity`` block and choose
**PSS: View Activity Diagram**, or run the command from the Command Palette
(``Ctrl+Shift+P``).

The diagram renders as an interactive SVG inside a VS Code webview panel:

- **Sequential edges** connect action traversals that execute in order.
- **Fork/join bars** represent ``parallel`` and ``schedule`` blocks.
- **Decision diamonds** represent ``if/else``, ``select``, and ``match``
  constructs.
- **Loop-back edges** represent ``repeat`` and ``foreach`` iterations.

Click any node in the diagram to jump to the corresponding source location
in the editor.

Resource Binding Tree View
--------------------------

The **PSS Resources** tree view (in the Explorer side bar) shows the
resource binding relationships in the workspace:

- Components and their declared resource pools.
- Actions that ``lock`` or ``share`` each resource.
- The inferred binding between action resource claims and component pools.

This view updates automatically as you edit ``.pss`` files.
