import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const reportHtml = readFileSync(resolve('report.html'), 'utf8');
const reportSource = readFileSync(resolve('src/pages/report.js'), 'utf8');

[
  'student-name',
  'student-class',
  'report-date',
  'purpose',
  'observation',
  'conclusion',
  'thinking-1',
  'thinking-2',
  'thinking-3',
  'thinking-4'
].forEach((key) => {
  assert.match(reportHtml, new RegExp(`data-report-draft="${key}"`));
});

assert.match(reportSource, /field\.matches\('textarea'\)/);
assert.match(reportSource, /field\.addEventListener\('input'/);
