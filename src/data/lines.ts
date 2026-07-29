export type LineId = 'L1' | 'L2' | 'L4' | 'L5' | 'L6';

export interface LineDef {
  id: LineId;
  name: string;
}

export const LINES: Record<LineId, LineDef> = {
  L1: { id: 'L1', name: 'Line 1 Yonge-University' },
  L2: { id: 'L2', name: 'Line 2 Bloor-Danforth' },
  L4: { id: 'L4', name: 'Line 4 Sheppard' },
  L5: { id: 'L5', name: 'Line 5 Eglinton' },
  L6: { id: 'L6', name: 'Line 6 Finch West' },
};

/** Matches the viewBox of public/ttc-map.svg. */
export const MAP_VIEWBOX = { width: 2699, height: 1701 };
