import type { LineId } from './lines';

/** Each line's stations in physical order, used to derive stop-to-stop adjacency. */
export const LINE_SEQUENCES: Record<LineId, string[]> = {
  L1: [
    'vaughan-mc', 'highway-407', 'pioneer-village', 'york-university', 'finch-west',
    'downsview-park', 'sheppard-west', 'wilson', 'yorkdale', 'lawrence-west', 'glencairn',
    'cedarvale', 'st-clair-west', 'dupont', 'spadina', 'st-george', 'museum', 'queens-park',
    'st-patrick', 'osgoode', 'st-andrew', 'union', 'king', 'queen', 'tmu', 'college',
    'wellesley', 'bloor-yonge', 'rosedale', 'summerhill', 'st-clair', 'davisville', 'eglinton',
    'lawrence', 'york-mills', 'sheppard-yonge', 'north-york-centre', 'finch',
  ],
  L2: [
    'kipling', 'islington', 'royal-york', 'old-mill', 'jane', 'runnymede', 'high-park', 'keele',
    'dundas-west', 'lansdowne', 'dufferin', 'ossington', 'christie', 'bathurst', 'spadina',
    'st-george', 'bay', 'bloor-yonge', 'sherbourne', 'castle-frank', 'broadview', 'chester',
    'pape', 'donlands', 'greenwood', 'coxwell', 'woodbine', 'main-street', 'victoria-park',
    'warden', 'kennedy',
  ],
  L4: ['sheppard-yonge', 'bayview', 'bessarion', 'leslie', 'don-mills'],
  L5: [
    'mount-dennis', 'keelesdale', 'caledonia', 'fairbank', 'oakwood', 'cedarvale', 'forest-hill',
    'chaplin', 'avenue', 'eglinton', 'mount-pleasant', 'leaside', 'laird', 'sunnybrook-park',
    'don-valley', 'aga-khan-park-museum', 'wynford', 'sloane', 'oconnor', 'pharmacy',
    'hakimi-lebovic', 'golden-mile', 'birchmount', 'ionview', 'kennedy',
  ],
  L6: [
    'humber-college', 'westmore', 'martin-grove', 'albion', 'stevenson', 'mount-olive',
    'rowntree-mills', 'pearldale', 'duncanwoods', 'milvan-rumike', 'emery', 'signet-arrow',
    'norfinch-oakdale', 'jane-and-finch', 'driftwood', 'tobermory', 'sentinel', 'finch-west',
  ],
};

let adjacency: Map<string, Set<string>> | null = null;

function getAdjacency(): Map<string, Set<string>> {
  if (adjacency) return adjacency;
  adjacency = new Map();
  const link = (a: string, b: string) => {
    if (!adjacency!.has(a)) adjacency!.set(a, new Set());
    if (!adjacency!.has(b)) adjacency!.set(b, new Set());
    adjacency!.get(a)!.add(b);
    adjacency!.get(b)!.add(a);
  };
  for (const sequence of Object.values(LINE_SEQUENCES)) {
    for (let i = 0; i < sequence.length - 1; i++) {
      link(sequence[i], sequence[i + 1]);
    }
  }
  return adjacency;
}

/** Number of stops between two stations via shortest path, or Infinity if unreachable. */
export function stopsBetween(fromId: string, toId: string): number {
  if (fromId === toId) return 0;
  const graph = getAdjacency();
  const visited = new Set<string>([fromId]);
  let frontier = [fromId];
  let distance = 0;
  while (frontier.length > 0) {
    distance += 1;
    const next: string[] = [];
    for (const id of frontier) {
      for (const neighbor of graph.get(id) ?? []) {
        if (neighbor === toId) return distance;
        if (!visited.has(neighbor)) {
          visited.add(neighbor);
          next.push(neighbor);
        }
      }
    }
    frontier = next;
  }
  return Infinity;
}
