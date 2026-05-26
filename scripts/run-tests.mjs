import { readdir } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { join } from 'node:path';

async function findTests(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const tests = [];
  for (const entry of entries) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      tests.push(...await findTests(path));
    } else if (entry.name.endsWith('.test.mjs')) {
      tests.push(path);
    }
  }
  return tests;
}

function runTest(file) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [file], { stdio: 'inherit' });
    child.on('close', (code) => resolve(code));
  });
}

const tests = (await findTests('src')).sort();
for (const test of tests) {
  console.log(`RUN ${test}`);
  const code = await runTest(test);
  if (code !== 0) process.exit(code);
}
