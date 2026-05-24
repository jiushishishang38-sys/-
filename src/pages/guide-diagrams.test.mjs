import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const testDir = dirname(fileURLToPath(import.meta.url));
const guideHtml = readFileSync(resolve(testDir, '../../guide.html'), 'utf8');

const diagramCount = (guideHtml.match(/data-optics-diagram=/g) || []).length;
assert.equal(diagramCount, 5);
assert.match(guideHtml, /data-optics-diagram="convex-rays"[\s\S]*?data-focus="real"/);
assert.match(guideHtml, /data-optics-diagram="concave-rays"[\s\S]*?data-focus="virtual"/);
assert.match(guideHtml, /data-optics-diagram="diopter-compare"[\s\S]*?4 D/);
