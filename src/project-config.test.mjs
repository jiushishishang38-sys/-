import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const packageJson = JSON.parse(readFileSync(resolve('package.json'), 'utf8'));
const workflow = readFileSync(resolve('.github/workflows/pages.yml'), 'utf8');
const serverSource = readFileSync(resolve('dev-server.mjs'), 'utf8');

assert.equal(packageJson.scripts.test, 'node scripts/run-tests.mjs');
assert.match(workflow, /run: npm test/);
assert.match(serverSource, /relative\(root,\s*file\)/);
assert.doesNotMatch(serverSource, /file\.startsWith\(root\)/);
