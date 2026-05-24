import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const testDir = dirname(fileURLToPath(import.meta.url));
const experimentSource = readFileSync(resolve(testDir, './experiment.js'), 'utf8');

assert.match(experimentSource, /function makeLens[\s\S]*?new THREE\.Group\(\)/);
assert.match(experimentSource, /SphereGeometry/);
assert.match(experimentSource, /TorusGeometry/);
assert.match(experimentSource, /lens\.userData\.isVolumetric = true/);
