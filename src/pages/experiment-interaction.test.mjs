import assert from 'node:assert/strict';
import {
  BENCH_RISER_Y,
  BENCH_RULER_Y,
  BENCH_RULER_TILT_RADIANS,
  MOUNT_BASE_DEPTH,
  MOUNT_BASE_HEIGHT,
  MOUNT_POST_HEIGHT,
  MOUNT_POST_Z,
  RULER_LABEL_Y,
  RULER_TICK_START_Y,
  cmToX,
  formatRailPosition,
  getRulerTickMarks,
  snapRailCm,
  railXToSnappedCm,
  selectDragTargetFromHits
} from './experiment-interaction.js';

assert.equal(BENCH_RISER_Y, 0.28);
assert.equal(BENCH_RULER_Y, 0.86);
assert.equal(BENCH_RULER_TILT_RADIANS, Math.PI / 6);
assert.equal(RULER_TICK_START_Y, 34);
assert.equal(RULER_LABEL_Y, 212);
assert.equal(MOUNT_BASE_HEIGHT, 0.24);
assert.equal(MOUNT_BASE_DEPTH, 0.42);
assert.equal(MOUNT_POST_HEIGHT, 1.1);
assert.equal(MOUNT_POST_Z, -0.18);
assert.equal(cmToX(24), 6);
assert.equal(formatRailPosition(24), '24.00 cm');
assert.equal(formatRailPosition(-14.25), '-14.25 cm');
assert.equal(snapRailCm(12.12, -34, 36), 12);
assert.equal(snapRailCm(12.13, -34, 36), 12.25);
assert.equal(snapRailCm(40, -34, 36), 36);
assert.equal(snapRailCm(-40, -34, 36), -34);
assert.equal(railXToSnappedCm(3.04, -24, -6), -6);
assert.equal(railXToSnappedCm(-3.04, -24, -6), -12.25);

const rulerTicks = getRulerTickMarks();
assert.equal(rulerTicks[0].cm, -36);
assert.equal(rulerTicks.at(-1).cm, 36);
assert.equal(rulerTicks.length, 145);
assert.deepEqual(
  rulerTicks.filter((tick) => tick.label !== '').map((tick) => tick.label),
  ['-30', '-20', '-10', '0', '10', '20', '30']
);
assert.deepEqual(
  rulerTicks.filter((tick) => tick.cm >= -1 && tick.cm <= 1).map((tick) => tick.kind),
  ['minor', 'half', 'zero', 'half', 'minor']
);

const intendedTarget = { position: { x: -4.05 }, userData: { key: 'object' } };
const nearestWrongTarget = { position: { x: 2.9 }, userData: { key: 'screen' } };
const targetFromRailProjection = selectDragTargetFromHits([
  {
    distance: 1.2,
    object: { userData: { parentDrag: nearestWrongTarget } }
  },
  {
    distance: 2.8,
    object: { userData: { parentDrag: intendedTarget } }
  }
], -4.1);
assert.equal(targetFromRailProjection, intendedTarget);
