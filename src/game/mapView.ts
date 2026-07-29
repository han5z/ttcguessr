import { MAP_VIEWBOX, type LineId } from '../data/lines';
import { STATIONS, type Station } from '../data/stations';

const SVG_NS = 'http://www.w3.org/2000/svg';
const MAP_URL = `${import.meta.env.BASE_URL}ttc-map.svg`;
const LABELS_URL = `${import.meta.env.BASE_URL}ttc-map-labels.svg`;
/** In the 2699x1701 coordinate space of public/ttc-map.svg. */
const MAX_HIT_DISTANCE = 80;

export interface MapClickResult {
  station: Station | null;
  x: number;
  y: number;
}

export interface MapView {
  svg: SVGSVGElement;
  onClick(cb: (result: MapClickResult) => void): void;
  highlightLines(lineIds: LineId[]): void;
  revealStation(stationId: string): void;
  flashStation(stationId: string, kind: 'correct' | 'incorrect'): void;
  flashPoint(x: number, y: number, kind: 'correct' | 'incorrect'): void;
  showLabel(stationId: string): void;
  hideLabel(stationId: string): void;
  resetHighlights(): void;
  setInteractive(interactive: boolean): void;
}

function el<K extends keyof SVGElementTagNameMap>(tag: K, attrs: Record<string, string | number> = {}): SVGElementTagNameMap[K] {
  const node = document.createElementNS(SVG_NS, tag);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, String(v));
  return node;
}

function byId(svg: SVGSVGElement | Element, id: string): SVGElement | null {
  return svg.querySelector<SVGElement>('#' + CSS.escape(id));
}

/** The map artwork groups each line's track segments under an id like "Line 1". */
function lineGroupId(lineId: LineId): string {
  return `Line ${lineId.slice(1)}`;
}

async function fetchSvgRoot(url: string): Promise<SVGSVGElement> {
  const res = await fetch(url);
  const text = await res.text();
  const parsed = new DOMParser().parseFromString(text, 'image/svg+xml');
  return parsed.documentElement as unknown as SVGSVGElement;
}

async function loadMapSvg(): Promise<SVGSVGElement> {
  const root = await fetchSvgRoot(MAP_URL);
  const svg = document.importNode(root, true) as unknown as SVGSVGElement;
  svg.removeAttribute('width');
  svg.removeAttribute('height');
  svg.setAttribute('viewBox', `0 0 ${MAP_VIEWBOX.width} ${MAP_VIEWBOX.height}`);
  return svg;
}

/** The labels file names each label id "{Station Name} Text" (whitespace can be uneven). */
function findLabelSources(labelsRoot: SVGSVGElement): Map<string, Element> {
  const sources = new Map<string, Element>();
  for (const node of Array.from(labelsRoot.querySelectorAll<SVGElement>('[id]'))) {
    const match = node.id.match(/^\s*(.+?)\s+Text\s*$/);
    if (!match) continue;
    const station = STATIONS.find((s) => s.name === match[1].trim());
    if (station) sources.set(station.id, node);
  }
  return sources;
}

export async function createMapView(): Promise<MapView> {
  const [svg, labelsRoot] = await Promise.all([loadMapSvg(), fetchSvgRoot(LABELS_URL)]);
  svg.classList.add('ttc-map');
  svg.setAttribute('role', 'img');
  svg.setAttribute('aria-label', 'Unlabelled TTC rapid transit map');

  // The label artwork's text is embedded images referenced via patterns defined in its own
  // <defs> - merge those in once so cloned labels can resolve their fill references.
  const mainDefs = svg.querySelector('defs');
  const labelDefs = labelsRoot.querySelector('defs');
  if (mainDefs && labelDefs) {
    for (const child of Array.from(labelDefs.children)) {
      mainDefs.appendChild(document.importNode(child, true));
    }
  }
  const labelSources = findLabelSources(labelsRoot);

  const overlayLayer = el('g', { class: 'overlay-layer' });
  svg.appendChild(overlayLayer);

  const markerEls = new Map<string, SVGElement>();
  for (const station of STATIONS) {
    const marker = byId(svg, station.name);
    if (marker) {
      marker.classList.add('station-marker');
      markerEls.set(station.id, marker);
    }
  }

  // Elements deep in this imported document silently ignore a CSS `transform` unless the
  // element is cycled out of and back into layout in the same synchronous pass as the change -
  // so every scale change below re-does this dance right before setting the new transform.
  function setMarkerScale(marker: SVGElement, scale: number) {
    marker.style.display = 'none';
    void svg.getBoundingClientRect();
    marker.style.display = '';
    void svg.getBoundingClientRect();
    marker.style.transform = scale === 1 ? '' : `scale(${scale})`;
  }

  const glowedGroups = new Set<SVGElement>();
  const activeLabels = new Map<string, SVGElement>();

  function nearestStation(x: number, y: number): { station: Station | null; dist: number } {
    let best: Station | null = null;
    let bestDist = Infinity;
    for (const s of STATIONS) {
      const dist = Math.hypot(s.x - x, s.y - y);
      if (dist < bestDist) {
        bestDist = dist;
        best = s;
      }
    }
    return { station: best, dist: bestDist };
  }

  function toLocalPoint(clientX: number, clientY: number): { x: number; y: number } | null {
    const ctm = svg.getScreenCTM();
    if (!ctm) return null;
    const pt = svg.createSVGPoint();
    pt.x = clientX;
    pt.y = clientY;
    const local = pt.matrixTransform(ctm.inverse());
    return { x: local.x, y: local.y };
  }

  let interactive = true;
  const clickCallbacks: Array<(r: MapClickResult) => void> = [];

  svg.addEventListener('click', (ev) => {
    if (!interactive) return;
    const local = toLocalPoint(ev.clientX, ev.clientY);
    if (!local) return;
    const { station, dist } = nearestStation(local.x, local.y);
    const matched = dist <= MAX_HIT_DISTANCE ? station : null;
    for (const cb of clickCallbacks) cb({ station: matched, x: local.x, y: local.y });
  });

  let hoveredId: string | null = null;
  function setHovered(id: string | null) {
    if (id === hoveredId) return;
    if (hoveredId) {
      const prev = markerEls.get(hoveredId);
      if (prev) setMarkerScale(prev, 1);
    }
    if (id) {
      const next = markerEls.get(id);
      if (next) setMarkerScale(next, 1.6);
    }
    hoveredId = id;
  }

  svg.addEventListener('mousemove', (ev) => {
    if (!interactive) return setHovered(null);
    const local = toLocalPoint(ev.clientX, ev.clientY);
    if (!local) return;
    const { station, dist } = nearestStation(local.x, local.y);
    setHovered(station && dist <= MAX_HIT_DISTANCE ? station.id : null);
  });
  svg.addEventListener('mouseleave', () => setHovered(null));

  function highlightLines(lineIds: LineId[]) {
    for (const lineId of lineIds) {
      const group = byId(svg, lineGroupId(lineId));
      if (!group) continue;
      group.classList.add('line-glow');
      glowedGroups.add(group);
    }
  }

  function revealStation(stationId: string) {
    const station = STATIONS.find((s) => s.id === stationId);
    if (!station) return;
    const ring = el('circle', {
      cx: station.x,
      cy: station.y,
      r: 26,
      class: 'reveal-ring',
      fill: 'none',
    });
    overlayLayer.appendChild(ring);
  }

  function flashStation(stationId: string, kind: 'correct' | 'incorrect') {
    const station = STATIONS.find((s) => s.id === stationId);
    if (!station) return;
    flashPoint(station.x, station.y, kind);
  }

  function flashPoint(x: number, y: number, kind: 'correct' | 'incorrect') {
    const ring = el('circle', {
      cx: x,
      cy: y,
      r: 10,
      class: kind === 'correct' ? 'click-flash click-flash--correct' : 'click-flash click-flash--incorrect',
    });
    overlayLayer.appendChild(ring);
    setTimeout(() => ring.remove(), 650);
  }

  function showLabel(stationId: string) {
    if (activeLabels.has(stationId)) return;
    const source = labelSources.get(stationId);
    const marker = markerEls.get(stationId);
    if (!source || !marker || !marker.parentNode) return;
    const clone = document.importNode(source, true) as SVGElement;
    clone.classList.add('station-label');
    // Insert just before the station's circle so any leader line in the label (some stations'
    // labels include one, pointing back at the dot) renders underneath the circle, not over it.
    marker.parentNode.insertBefore(clone, marker);
    activeLabels.set(stationId, clone);
  }

  function hideLabel(stationId: string) {
    const clone = activeLabels.get(stationId);
    if (clone) {
      clone.remove();
      activeLabels.delete(stationId);
    }
  }

  function hideAllLabels() {
    for (const clone of activeLabels.values()) clone.remove();
    activeLabels.clear();
  }

  function resetHighlights() {
    for (const group of glowedGroups) group.classList.remove('line-glow');
    glowedGroups.clear();
    hideAllLabels();
    overlayLayer.replaceChildren();
  }

  function setInteractive(v: boolean) {
    interactive = v;
    svg.classList.toggle('ttc-map--disabled', !v);
    if (!v) setHovered(null);
  }

  return {
    svg,
    onClick(cb) {
      clickCallbacks.push(cb);
    },
    highlightLines,
    revealStation,
    flashStation,
    flashPoint,
    showLabel,
    hideLabel,
    resetHighlights,
    setInteractive,
  };
}
