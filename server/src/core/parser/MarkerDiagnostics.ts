/**
 * Convert a parser `Marker` into the server's `Diagnostic`.
 *
 * The two disagree on two conventions and this is the only place that knows
 * it: markers are 1-based in both line and column (LSP is 0-based in both),
 * and a marker's `extent` is -1 when the core did not supply a span rather
 * than 0. A -1 passed through arithmetic unnoticed produces a range that ends
 * before it starts, which some clients render as a whole-line squiggle and
 * others drop silently.
 */
import { Marker, MarkerSeverity } from '@psstools/pssparser';

import { Diagnostic, DiagnosticSeverity } from '../types/Diagnostic.js';

function severityOf(s: MarkerSeverity): DiagnosticSeverity {
  switch (s) {
    case 'error':
      return DiagnosticSeverity.Error;
    case 'warning':
      return DiagnosticSeverity.Warning;
    case 'info':
      return DiagnosticSeverity.Information;
    case 'hint':
      return DiagnosticSeverity.Hint;
  }
}

export function markerToDiagnostic(marker: Marker): Diagnostic {
  const line = Math.max(0, marker.line - 1);
  const character = Math.max(0, marker.col - 1);
  // "Unknown extent" becomes a one-character span, which is what a caret
  // diagnostic looks like; it is never allowed to become a negative width.
  const width = marker.extent > 0 ? marker.extent : 1;

  const diagnostic: Diagnostic = {
    range: {
      start: { line, character },
      end: { line, character: character + width },
    },
    severity: severityOf(marker.severity),
    source: 'pss',
    message: marker.message,
  };

  if (marker.code !== undefined) {
    diagnostic.code = marker.code;
  }

  if (marker.related.length > 0) {
    diagnostic.relatedInformation = marker.related.map((r) => ({
      location: {
        uri: r.file,
        range: {
          start: { line: Math.max(0, r.line - 1), character: Math.max(0, r.col - 1) },
          end: { line: Math.max(0, r.line - 1), character: Math.max(0, r.col - 1) + 1 },
        },
      },
      message: r.label,
    }));
  }

  return diagnostic;
}
