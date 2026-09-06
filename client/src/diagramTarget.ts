/** The editor state the diagram command reads when no explicit target is given. */
export interface ActiveEditorState {
  uri: string;
  languageId: string;
  activeLine: number;
}

export type DiagramTarget =
  | { ok: true; uri: string; line: number }
  | { ok: false; reason: 'no-pss-editor' };

/**
 * Decide which document and line the activity-diagram command should target.
 *
 * Explicit arguments win (the command is also invoked from a code lens, which
 * passes them); otherwise it falls back to the active editor, but only when
 * that editor holds a PSS file.
 *
 * Extracted from extension.ts so the branch that decides whether to warn the
 * user is testable without an editor.
 */
export function resolveDiagramTarget(
  uri: string | undefined,
  line: number | undefined,
  activeEditor: ActiveEditorState | undefined,
): DiagramTarget {
  if (uri) {
    return { ok: true, uri, line: line ?? 0 };
  }
  if (!activeEditor || activeEditor.languageId !== 'pss') {
    return { ok: false, reason: 'no-pss-editor' };
  }
  return { ok: true, uri: activeEditor.uri, line: activeEditor.activeLine };
}
