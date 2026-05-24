export const BENCH_RISER_Y = 0.28;
export const BENCH_RULER_Y = 0.86;
export const BENCH_RULER_TILT_RADIANS = Math.PI / 6;
export const MOUNT_BASE_DEPTH = 0.42;
export const MOUNT_BASE_HEIGHT = 0.24;
export const MOUNT_POST_HEIGHT = 1.1;
export const MOUNT_POST_Z = -0.18;
export const DRAG_PICK_AREA_WIDTH = 0.95;
export const DRAG_PICK_AREA_HEIGHT = 2.65;
export const DRAG_PICK_AREA_DEPTH = 1.45;
export const DRAG_PICK_AREA_Y = 1.32;
export const DRAG_PICK_AREA_Z = -0.05;
export const DRAG_PICK_RAIL_TOLERANCE = 0.85;
export const RULER_MIN_CM = -36;
export const RULER_MAX_CM = 36;
export const RULER_TICK_START_Y = 34;
export const RULER_LABEL_Y = 212;

export function cmToX(cm) {
  return cm / 4;
}

export function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

export function snapRailCm(value, min, max, step = 0.25) {
  const snapped = Math.round(value / step) * step;
  return clamp(Number(snapped.toFixed(2)), min, max);
}

export function railXToSnappedCm(x, min, max) {
  return snapRailCm(x * 4, min, max);
}

export function formatRailPosition(cm) {
  return `${Number(cm).toFixed(2)} cm`;
}

export function getRulerTickMarks(minCm = RULER_MIN_CM, maxCm = RULER_MAX_CM) {
  const ticks = [];
  for (let halfCm = minCm * 2; halfCm <= maxCm * 2; halfCm += 1) {
    const cm = halfCm / 2;
    const whole = Number.isInteger(cm);
    const kind = cm === 0
      ? 'zero'
      : whole && cm % 10 === 0
        ? 'major'
        : whole && cm % 5 === 0
          ? 'medium'
          : whole
            ? 'minor'
            : 'half';
    ticks.push({
      cm,
      kind,
      label: kind === 'major' || kind === 'zero' ? String(cm) : ''
    });
  }
  return ticks;
}

export function selectDragTargetFromHits(hits, railX, options = {}) {
  const railTolerance = options.railTolerance ?? DRAG_PICK_RAIL_TOLERANCE;
  const hasRailPosition = Number.isFinite(railX);
  const candidates = [];

  for (const hit of hits ?? []) {
    const target = hit?.object?.userData?.parentDrag;
    if (!target) continue;

    const existing = candidates.find((candidate) => candidate.target === target);
    const distance = Number.isFinite(hit.distance) ? hit.distance : Number.POSITIVE_INFINITY;
    const targetX = target.position?.x;
    const railDelta = hasRailPosition && Number.isFinite(targetX)
      ? Math.abs(targetX - railX)
      : Number.POSITIVE_INFINITY;

    if (existing) {
      existing.distance = Math.min(existing.distance, distance);
      existing.railDelta = Math.min(existing.railDelta, railDelta);
    } else {
      candidates.push({ target, distance, railDelta });
    }
  }

  if (candidates.length === 0) return null;

  const railCandidates = hasRailPosition
    ? candidates.filter((candidate) => candidate.railDelta <= railTolerance)
    : [];
  const pool = railCandidates.length > 0 ? railCandidates : candidates;
  pool.sort((a, b) => {
    if (railCandidates.length > 0 && a.railDelta !== b.railDelta) {
      return a.railDelta - b.railDelta;
    }
    return a.distance - b.distance;
  });

  return pool[0].target;
}
