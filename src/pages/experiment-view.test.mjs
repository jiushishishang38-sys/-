import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const testDir = dirname(fileURLToPath(import.meta.url));
const root = resolve(testDir, '../..');
const experimentSource = readFileSync(resolve(testDir, './experiment.js'), 'utf8');
const experimentHtml = readFileSync(resolve(root, 'experiment.html'), 'utf8');

assert.equal((experimentHtml.match(/data-view="/g) || []).length, 1);
assert.match(experimentHtml, /data-view="reset"/);
assert.doesNotMatch(experimentHtml, /data-view="front"|data-view="side"|data-view="top"|data-view="teach"/);
assert.match(experimentHtml, /<input id="mode" type="hidden" value="measure" \/>/);
assert.doesNotMatch(experimentHtml, /<select id="mode">|实验模式/);
assert.match(experimentSource, /camera\.position\.set\(0,\s*3\.2,\s*12\)/);
assert.match(experimentHtml, /data-lens-control="power"/);
assert.match(experimentHtml, /data-lens-control="cylinder"/);
assert.match(experimentHtml, /id="lens-power-value"/);
assert.match(experimentHtml, /id="cylinder-angle-value"/);
assert.match(experimentSource, /function updateLensControls\(\)/);
assert.match(experimentSource, /usesSphericalPower = lensType === 'concave' \|\| lensType === 'convex'/);
assert.match(experimentSource, /const usesCylinder = lensType === 'cylinder'/);
assert.match(experimentSource, /classList\.toggle\('is-disabled', !usesSphericalPower\)/);
assert.match(experimentSource, /input\.disabled = !usesCylinder/);
