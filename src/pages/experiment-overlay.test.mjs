import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const testDir = dirname(fileURLToPath(import.meta.url));
const root = resolve(testDir, '../..');
const experimentHtml = readFileSync(resolve(root, 'experiment.html'), 'utf8');
const experimentSource = readFileSync(resolve(testDir, './experiment.js'), 'utf8');
const appCss = readFileSync(resolve(root, 'src/styles/app.css'), 'utf8');

assert.match(experimentHtml, /class="equipment-overlay"/);
assert.match(experimentHtml, /class="equipment-canvas-layout"/);
assert.equal((experimentHtml.match(/class="equipment-thumb/g) || []).length, 6);
assert.match(experimentHtml, /detector-thumb/);
assert.match(experimentHtml, /id="experiment-canvas" class="three-canvas">\s*<div class="equipment-overlay"/);
assert.match(experimentHtml, /id="experiment-canvas" class="three-canvas">[\s\S]*<div class="detector-card" aria-label="光斑显示">/);
assert.match(experimentHtml, /<canvas id="detector-spot-canvas"/);
assert.doesNotMatch(experimentHtml, /id="equip-[^"]+-pos"/);
assert.doesNotMatch(experimentSource, /const equipmentReadouts/);
assert.doesNotMatch(experimentSource, /labelSprite\s*=\s*addLabel/);
assert.match(appCss, /\.equipment-canvas-layout\s*{[\s\S]*display:\s*block/);
assert.match(appCss, /\.three-canvas \.detector-card\s*{[\s\S]*position:\s*absolute/);
assert.match(appCss, /\.equipment-overlay\s*{[\s\S]*grid-template-columns:\s*1fr/);
assert.match(appCss, /\.equipment-overlay\s*{[\s\S]*position:\s*absolute/);
assert.match(appCss, /\.equipment-item\s*{[\s\S]*grid-template-columns:\s*24px minmax\(0,\s*1fr\)/);
assert.doesNotMatch(appCss, /\.equipment-item output/);
