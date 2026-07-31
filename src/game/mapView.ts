import { MAP_VIEWBOX, type LineId } from '../data/lines';
import { STATIONS, type Station } from '../data/stations';

const SVG_NS = 'http://www.w3.org/2000/svg';
const MAP_URL = `${import.meta.env.BASE_URL}ttc-map.svg`;
const LABELS_URL = `${import.meta.env.BASE_URL}ttc-map-labels.svg`;
/** In the 2699x1701 coordinate space of public/ttc-map.svg. */
const MAX_HIT_DISTANCE = 80;
/** Narrowest allowed viewBox width - how far a user can zoom in. */
const MIN_VIEW_WIDTH = 220;
const ZOOM_STEP = 1.12;
/** Screen-pixel movement before a pointerdown is treated as a drag rather than a click. */
const DRAG_THRESHOLD = 4;

export interface MapClickResult {
  station: Station;
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
  /** Shows a station's label permanently for the rest of the game (survives resetHighlights). */
  markSolved(stationId: string): void;
  /** Clears all permanent solved-station labels; call when starting a brand-new game. */
  clearSolvedLabels(): void;
  /** Makes a station permanently unclickable for the rest of the game (e.g. once revealed). */
  disableStation(stationId: string): void;
  /** Re-enables all disabled stations; call when starting a brand-new game. */
  clearDisabledStations(): void;
  resetHighlights(): void;
  setInteractive(interactive: boolean): void;
  /** Frame the box between two map-space points (plus padding); call after mounting. */
  focusOnBounds(x1: number, y1: number, x2: number, y2: number, padding: number): void;
  /** Smoothly re-centers the current view on a station without changing zoom. */
  panToStation(stationId: string): void;
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
  // "slice" fills the container edge-to-edge (cropping overflow) instead of letterboxing,
  // since the map is meant to span the full browser window with no border.
  svg.setAttribute('preserveAspectRatio', 'xMidYMid slice');
  svg.setAttribute('viewBox', `0 0 ${MAP_VIEWBOX.width} ${MAP_VIEWBOX.height}`);
  return svg;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
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
  const solvedLabels = new Map<string, SVGElement>();
  const disabledStationIds = new Set<string>();

  function nearestStation(x: number, y: number, filter?: (s: Station) => boolean): { station: Station | null; dist: number } {
    let best: Station | null = null;
    let bestDist = Infinity;
    for (const s of STATIONS) {
      if (filter && !filter(s)) continue;
      const dist = Math.hypot(s.x - x, s.y - y);
      if (dist < bestDist) {
        bestDist = dist;
        best = s;
      }
    }
    return { station: best, dist: bestDist };
  }

  /** Resolves the station a point should hit-test against: whichever of the nearest active or
   * nearest disabled station is actually closer wins, so a disabled station only swallows clicks
   * genuinely meant for it rather than blanketing its whole hit radius over active neighbors. */
  function resolveActiveStation(x: number, y: number): { station: Station | null; dist: number } {
    const active = nearestStation(x, y, (s) => !disabledStationIds.has(s.id));
    const disabled = nearestStation(x, y, (s) => disabledStationIds.has(s.id));
    if (disabled.station && disabled.dist <= MAX_HIT_DISTANCE && disabled.dist <= active.dist) {
      return { station: null, dist: Infinity };
    }
    return active;
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
  const view = { x: 0, y: 0, w: MAP_VIEWBOX.width, h: MAP_VIEWBOX.height };

  function applyView() {
    view.w = Math.min(view.w, MAP_VIEWBOX.width);
    view.h = Math.min(view.h, MAP_VIEWBOX.height);
    view.x = clamp(view.x, 0, MAP_VIEWBOX.width - view.w);
    view.y = clamp(view.y, 0, MAP_VIEWBOX.height - view.h);
    svg.setAttribute('viewBox', `${view.x} ${view.y} ${view.w} ${view.h}`);
  }

  /** Frames the box between two map-space points (plus padding), filling the container. */
  function focusOnBounds(x1: number, y1: number, x2: number, y2: number, padding: number) {
    cancelPanAnimation();
    const rect = svg.getBoundingClientRect();
    const aspect = rect.height > 0 ? rect.width / rect.height : MAP_VIEWBOX.width / MAP_VIEWBOX.height;
    const boxW = Math.abs(x2 - x1) + padding * 2;
    const boxH = Math.abs(y2 - y1) + padding * 2;
    let w = boxW;
    let h = boxH;
    if (boxW / boxH > aspect) {
      h = w / aspect;
    } else {
      w = h * aspect;
    }
    w = clamp(w, MIN_VIEW_WIDTH, MAP_VIEWBOX.width);
    h = w / aspect;
    view.w = w;
    view.h = h;
    view.x = (x1 + x2) / 2 - w / 2;
    view.y = (y1 + y2) / 2 - h / 2;
    applyView();
  }

  let panAnimationFrame: number | null = null;

  function cancelPanAnimation() {
    if (panAnimationFrame !== null) {
      cancelAnimationFrame(panAnimationFrame);
      panAnimationFrame = null;
    }
  }

  /** Smoothly re-centers the current view on a station without changing zoom. */
  function panToStation(stationId: string) {
    const station = STATIONS.find((s) => s.id === stationId);
    if (!station) return;
    cancelPanAnimation();
    const startCx = view.x + view.w / 2;
    const startCy = view.y + view.h / 2;
    const duration = 500;
    const startTime = performance.now();
    const step = (now: number) => {
      const t = Math.min(1, (now - startTime) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      view.x = startCx + (station.x - startCx) * eased - view.w / 2;
      view.y = startCy + (station.y - startCy) * eased - view.h / 2;
      applyView();
      panAnimationFrame = t < 1 ? requestAnimationFrame(step) : null;
    };
    panAnimationFrame = requestAnimationFrame(step);
  }

  svg.addEventListener(
    'wheel',
    (ev) => {
      if (!interactive) return;
      ev.preventDefault();
      cancelPanAnimation();
      const local = toLocalPoint(ev.clientX, ev.clientY);
      if (!local) return;
      const factor = ev.deltaY > 0 ? ZOOM_STEP : 1 / ZOOM_STEP;
      const newW = clamp(view.w * factor, MIN_VIEW_WIDTH, MAP_VIEWBOX.width);
      const actualFactor = newW / view.w;
      view.x = local.x - (local.x - view.x) * actualFactor;
      view.y = local.y - (local.y - view.y) * actualFactor;
      view.w = newW;
      view.h = view.h * actualFactor;
      applyView();
    },
    { passive: false },
  );

  let panState: { pointerId: number; startX: number; startY: number; startViewX: number; startViewY: number } | null = null;
  let dragMoved = false;

  // Two-finger pinch-to-zoom (touch-action:none on the SVG disables the browser's native
  // gesture, so it has to be reimplemented here on top of Pointer Events).
  const activePointers = new Map<number, { x: number; y: number }>();
  let pinchState: { prevDist: number; prevMidX: number; prevMidY: number } | null = null;

  function pointerDistance(a: { x: number; y: number }, b: { x: number; y: number }): number {
    return Math.hypot(a.x - b.x, a.y - b.y);
  }

  function pointerMidpoint(a: { x: number; y: number }, b: { x: number; y: number }): { x: number; y: number } {
    return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
  }

  function beginPinch(): void {
    const [a, b] = Array.from(activePointers.values());
    const mid = pointerMidpoint(a, b);
    pinchState = { prevDist: pointerDistance(a, b), prevMidX: mid.x, prevMidY: mid.y };
  }

  // Capture can fail for pointers the browser no longer considers active (rare, but seen on
  // Safari) - a thrown error here must not stop gesture tracking from being set up below.
  function trySetPointerCapture(pointerId: number): void {
    try {
      svg.setPointerCapture(pointerId);
    } catch {
      /* ignore */
    }
  }

  function tryReleasePointerCapture(pointerId: number): void {
    try {
      svg.releasePointerCapture(pointerId);
    } catch {
      /* ignore */
    }
  }

  svg.addEventListener('pointerdown', (ev) => {
    if (!interactive || ev.button !== 0) return;
    cancelPanAnimation();
    trySetPointerCapture(ev.pointerId);
    activePointers.set(ev.pointerId, { x: ev.clientX, y: ev.clientY });

    if (activePointers.size === 2) {
      panState = null;
      svg.classList.remove('ttc-map--panning');
      beginPinch();
      dragMoved = true;
    } else if (activePointers.size === 1) {
      panState = { pointerId: ev.pointerId, startX: ev.clientX, startY: ev.clientY, startViewX: view.x, startViewY: view.y };
      dragMoved = false;
    }
  });

  svg.addEventListener('pointermove', (ev) => {
    if (!activePointers.has(ev.pointerId)) return;
    activePointers.set(ev.pointerId, { x: ev.clientX, y: ev.clientY });

    if (pinchState && activePointers.size === 2) {
      const [a, b] = Array.from(activePointers.values());
      const dist = pointerDistance(a, b);
      const mid = pointerMidpoint(a, b);
      const rect = svg.getBoundingClientRect();
      const local = toLocalPoint(pinchState.prevMidX, pinchState.prevMidY);
      if (dist > 0 && pinchState.prevDist > 0 && local && rect.width > 0 && rect.height > 0) {
        const scaleFactor = pinchState.prevDist / dist;
        const newW = clamp(view.w * scaleFactor, MIN_VIEW_WIDTH, MAP_VIEWBOX.width);
        const actualFactor = newW / view.w;
        view.x = local.x - (local.x - view.x) * actualFactor;
        view.y = local.y - (local.y - view.y) * actualFactor;
        view.w = newW;
        view.h = view.h * actualFactor;
        view.x -= ((mid.x - pinchState.prevMidX) * view.w) / rect.width;
        view.y -= ((mid.y - pinchState.prevMidY) * view.h) / rect.height;
        applyView();
        setHovered(null);
      }
      pinchState.prevDist = dist;
      pinchState.prevMidX = mid.x;
      pinchState.prevMidY = mid.y;
      return;
    }

    if (!panState || ev.pointerId !== panState.pointerId) return;
    const dx = ev.clientX - panState.startX;
    const dy = ev.clientY - panState.startY;
    if (!dragMoved && Math.hypot(dx, dy) < DRAG_THRESHOLD) return;
    if (!dragMoved) svg.classList.add('ttc-map--panning');
    dragMoved = true;
    const rect = svg.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;
    view.x = panState.startViewX - (dx * view.w) / rect.width;
    view.y = panState.startViewY - (dy * view.h) / rect.height;
    applyView();
    setHovered(null);
  });

  function endPan(ev: PointerEvent) {
    if (!activePointers.has(ev.pointerId)) return;
    activePointers.delete(ev.pointerId);
    tryReleasePointerCapture(ev.pointerId);

    if (pinchState) {
      if (activePointers.size >= 2) {
        beginPinch();
        return;
      }
      pinchState = null;
      svg.classList.remove('ttc-map--panning');
      if (activePointers.size === 1) {
        // One finger still down after a pinch - resume panning from here instead of
        // requiring the user to lift and re-touch.
        const [id, pos] = Array.from(activePointers.entries())[0];
        panState = { pointerId: id, startX: pos.x, startY: pos.y, startViewX: view.x, startViewY: view.y };
      } else {
        panState = null;
      }
      return;
    }

    if (!panState || ev.pointerId !== panState.pointerId) return;
    svg.classList.remove('ttc-map--panning');
    panState = null;
  }
  svg.addEventListener('pointerup', endPan);
  svg.addEventListener('pointercancel', endPan);

  const clickCallbacks: Array<(r: MapClickResult) => void> = [];

  svg.addEventListener('click', (ev) => {
    if (dragMoved) {
      dragMoved = false;
      return;
    }
    if (!interactive) return;
    const local = toLocalPoint(ev.clientX, ev.clientY);
    if (!local) return;
    const { station, dist } = resolveActiveStation(local.x, local.y);
    if (!station || dist > MAX_HIT_DISTANCE) return;
    for (const cb of clickCallbacks) cb({ station, x: local.x, y: local.y });
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
    const { station, dist } = resolveActiveStation(local.x, local.y);
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

  function createLabelClone(stationId: string): SVGElement | null {
    const source = labelSources.get(stationId);
    const marker = markerEls.get(stationId);
    if (!source || !marker || !marker.parentNode) return null;
    const clone = document.importNode(source, true) as SVGElement;
    clone.classList.add('station-label');
    // Insert just before the station's circle so any leader line in the label (some stations'
    // labels include one, pointing back at the dot) renders underneath the circle, not over it.
    marker.parentNode.insertBefore(clone, marker);
    return clone;
  }

  function showLabel(stationId: string) {
    if (activeLabels.has(stationId) || solvedLabels.has(stationId)) return;
    const clone = createLabelClone(stationId);
    if (clone) activeLabels.set(stationId, clone);
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

  // Once a station is solved (guessed correctly or confirmed after reveal), its label stays up
  // for the rest of the game - separate from the transient wrong-guess labels above, which get
  // cleared every round by resetHighlights().
  function markSolved(stationId: string) {
    if (solvedLabels.has(stationId)) return;
    hideLabel(stationId);
    const clone = createLabelClone(stationId);
    if (clone) {
      clone.classList.add('station-label--solved');
      solvedLabels.set(stationId, clone);
    }
  }

  function clearSolvedLabels() {
    for (const clone of solvedLabels.values()) clone.remove();
    solvedLabels.clear();
  }

  // Revealed-but-unsolved stations stay disabled for the rest of the game so a later round's
  // wrong guess can't land back on them - nearestStation() already skips anything in this set.
  function disableStation(stationId: string) {
    disabledStationIds.add(stationId);
  }

  function clearDisabledStations() {
    disabledStationIds.clear();
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
    markSolved,
    clearSolvedLabels,
    disableStation,
    clearDisabledStations,
    resetHighlights,
    setInteractive,
    focusOnBounds,
    panToStation,
  };
}
