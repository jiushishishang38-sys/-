import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const testDir = dirname(fileURLToPath(import.meta.url));
const guideHtml = readFileSync(resolve(testDir, '../../guide.html'), 'utf8');
const guideReact = readFileSync(resolve(testDir, './guide.jsx'), 'utf8');

assert.match(guideHtml, /id="guide-root"/);
assert.match(guideHtml, /src="\.\/src\/pages\/guide\.jsx"/);
assert.match(guideReact, /gsap\.registerPlugin\(useGSAP\)/);
assert.match(guideReact, /<h1 id="guide-heading">探索视觉的奥秘<\/h1>/);
assert.match(guideReact, /const guideCards = \[[\s\S]*?理解原理[\s\S]*?观察现象[\s\S]*?模拟实验[\s\S]*?应用拓展/);
assert.match(guideReact, /const processNodes = \[[\s\S]*?光线进入[\s\S]*?屈光系统[\s\S]*?眼内成像[\s\S]*?神经传导[\s\S]*?大脑感知/);
