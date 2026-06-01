import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const headerPages = ['guide.html', 'experiment.html', 'eye.html', 'quiz.html', 'report.html'];
const coverHtml = readFileSync(resolve('index.html'), 'utf8');
const coverNav = coverHtml.match(/<nav class="cover-nav"[\s\S]*?<\/nav>/)?.[0] ?? '';
const coverLinks = [
  ['guide.html', '课前引导'],
  ['eye.html', '基础知识'],
  ['experiment.html', '模拟实验'],
  ['report.html', '实验报告'],
  ['quiz.html', '知识夯实']
];

coverLinks.forEach(([href, label]) => {
  assert.match(coverNav, new RegExp(`<a href="\\.\\/${href}">${label}<\\/a>`));
});
assert.doesNotMatch(coverNav, /href="\.\/course\.html"/);
assert.doesNotMatch(coverNav, />PROJECT<|>FEATURES<|>SIMULATION<|>REPORT</);

headerPages.forEach((page) => {
  const html = readFileSync(resolve(page), 'utf8');
  assert.match(html, /<a[^>]*class="brand"[^>]*href="\.\/index\.html"|<a[^>]*href="\.\/index\.html"[^>]*class="brand"/);
  assert.doesNotMatch(html, /href="\.\/course\.html"/);
});
