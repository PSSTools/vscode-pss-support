// Auto-generated - DO NOT EDIT

import * as enums from "./enums";

export interface Location {
  fileid: number;
  lineno: number;
  linepos: number;
  extent: number;
}

export function mkLocation(fileid: number = -1, lineno: number = -1, linepos: number = -1, extent: number = -1): Location {
  return { fileid, lineno, linepos, extent };
}

export interface SymbolRefPathElem {
  kind: enums.SymbolRefPathElemKind;
  idx: number;
}

export function mkSymbolRefPathElem(kind: enums.SymbolRefPathElemKind = enums.SymbolRefPathElemKind.ElemKind_ChildIdx, idx: number = 0): SymbolRefPathElem {
  return { kind, idx };
}

