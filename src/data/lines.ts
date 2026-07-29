export type LineId = 'L1' | 'L2' | 'L4' | 'L5' | 'L6';

export interface LineDef {
  id: LineId;
  name: string;
  /** Short label for hint chips, e.g. "Line 1". */
  shortName: string;
  color: string;
}

export const LINES: Record<LineId, LineDef> = {
  L1: { id: 'L1', name: 'Line 1 Yonge-University', shortName: 'Line 1', color: '#ffcc29' },
  L2: { id: 'L2', name: 'Line 2 Bloor-Danforth', shortName: 'Line 2', color: '#00a859' },
  L4: { id: 'L4', name: 'Line 4 Sheppard', shortName: 'Line 4', color: '#a8518a' },
  L5: { id: 'L5', name: 'Line 5 Eglinton', shortName: 'Line 5', color: '#f58634' },
  L6: { id: 'L6', name: 'Line 6 Finch West', shortName: 'Line 6', color: '#8a999a' },
};

/** Matches the viewBox of public/ttc-map.svg. */
export const MAP_VIEWBOX = { width: 2699, height: 1701 };
