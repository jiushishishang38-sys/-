import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const headerPages = ['course.html', 'guide.html', 'experiment.html', 'eye.html', 'quiz.html', 'report.html'];

headerPages.forEach((page) => {
  const html = readFileSync(resolve(page), 'utf8');
  assert.match(html, /<a class="brand" href="\.\/index\.html">/);
});
