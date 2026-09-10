import { SourcePosition } from '../../src/core/types/SourcePosition.js';

/**
 * Marker syntax for test sources.
 *
 * Markers are comments of the form `/*[kind:name]*` + `/` that are stripped
 * before parsing; the recorded position is the character immediately after the
 * marker. A bare `|` also works as a single anonymous cursor.
 *
 *   package p { struct  /*[def:s]* / s { } }
 *   component c { p::s  /*[ref:s]* / x; }
 *
 * `def:` and `ref:` are conventions used by the navigation assertions:
 * every `ref:N` must resolve to the location of `def:N`. Any other kind is
 * simply a named position, e.g. `/*[cursor]* /`.
 */
export interface Marker {
  /** Kind before the colon, or '' when the marker is just a name. */
  kind: string;
  /** Name after the colon, or the whole label when there is no colon. */
  name: string;
  /** Full label as written, e.g. 'def:s'. */
  label: string;
  position: SourcePosition;
  /** 0-based offset into the cleaned text. */
  offset: number;
}

export interface MarkedSource {
  /** Source with all markers removed -- what actually gets parsed. */
  text: string;
  markers: Marker[];
}

const MARKER_RE = /\/\*\[([^\]]*)\]\*\//g;

/** Strip markers from `source` and record where each one pointed. */
export function parseMarkers(source: string): MarkedSource {
  const markers: Marker[] = [];
  let text = '';
  let lastIndex = 0;

  MARKER_RE.lastIndex = 0;
  for (;;) {
    const match = MARKER_RE.exec(source);
    if (!match) break;

    text += source.slice(lastIndex, match.index);
    lastIndex = match.index + match[0].length;

    const label = match[1];
    const colon = label.indexOf(':');
    markers.push({
      kind: colon < 0 ? '' : label.slice(0, colon),
      name: colon < 0 ? label : label.slice(colon + 1),
      label,
      offset: text.length,
      position: offsetToPosition(text, text.length),
    });
  }
  text += source.slice(lastIndex);

  // A bare '|' cursor, supported for brevity in single-position tests.
  const bar = text.indexOf('|');
  if (bar >= 0) {
    text = text.slice(0, bar) + text.slice(bar + 1);
    markers.push({
      kind: '',
      name: 'cursor',
      label: 'cursor',
      offset: bar,
      position: offsetToPosition(text, bar),
    });
  }

  return { text, markers };
}

/** Convert a 0-based offset into a line/character position. */
export function offsetToPosition(text: string, offset: number): SourcePosition {
  const before = text.slice(0, offset);
  const lastNewline = before.lastIndexOf('\n');
  return {
    line: before.split('\n').length - 1,
    character: offset - lastNewline - 1,
  };
}

/** Convert a line/character position back into a 0-based offset. */
export function positionToOffset(text: string, position: SourcePosition): number {
  const lines = text.split('\n');
  let offset = 0;
  for (let i = 0; i < position.line && i < lines.length; i++) {
    offset += lines[i].length + 1;
  }
  return offset + position.character;
}
