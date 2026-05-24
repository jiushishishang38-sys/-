import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const testDir = dirname(fileURLToPath(import.meta.url));
const experimentSource = readFileSync(resolve(testDir, './experiment.js'), 'utf8');

const presetsBlock = experimentSource.match(/const presets = \{([\s\S]*?)\n    \};/);

assert.ok(presetsBlock, 'view presets are defined');
assert.match(presetsBlock[1], /front:\s*\[0,\s*3\.2,\s*12\]/);
assert.match(presetsBlock[1], /reset:\s*\[0,\s*3\.2,\s*12\]/);
