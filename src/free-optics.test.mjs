import assert from 'node:assert/strict';
import {
  addSceneItem,
  createDefaultFreeScene,
  createDetector,
  createEmptyFreeScene,
  createLightSource,
  createOpticalElement,
  createScreen,
  removeSceneItem,
  traceScene,
  updateItemPosition,
  updateItemPosition2D
} from './free-optics.js';

function assertFinitePath(result) {
  for (const path of result.paths) {
    for (const point of path) {
      point.forEach((value) => assert.equal(Number.isFinite(value), true));
    }
  }
}

const defaultScene = createDefaultFreeScene();
let result = traceScene(defaultScene, { rayCount: 96 });
assert.equal(result.screenResults.length, 1);
assert.ok(result.screenResults[0].hitCount > 20);
assert.ok(result.screenResults[0].spotRadius < 1.2);
assertFinitePath(result);

const emptyScene = createEmptyFreeScene();
result = traceScene(emptyScene, { rayCount: 96 });
assert.equal(result.paths.length, 0);
assert.equal(result.screenResults.length, 0);

const twoLensScene = createDefaultFreeScene();
twoLensScene.elements.push(createOpticalElement('concaveLens', 5));
twoLensScene.screens[0].position[0] = 22;
result = traceScene(twoLensScene, { rayCount: 128 });
assertFinitePath(result);
assert.ok(result.screenResults[0].hitCount > 0);

const mirrorScene = createDefaultFreeScene();
mirrorScene.lightSources[0].position[0] = 24;
mirrorScene.lightSources[0].direction = [-1, 0, 0];
mirrorScene.elements = [createOpticalElement('concaveMirror', 7)];
mirrorScene.elements[0].focalLength = 7;
mirrorScene.screens = [createScreen(14)];
mirrorScene.selectedId = mirrorScene.screens[0].id;
result = traceScene(mirrorScene, { rayCount: 120 });
assertFinitePath(result);
assert.ok(result.screenResults[0].hitCount > 0);
assert.ok(result.screenResults[0].spotRadius < 1.2);

const reversePointScene = createDefaultFreeScene();
reversePointScene.elements = [];
reversePointScene.lightSources = [createLightSource('point', 18)];
reversePointScene.lightSources[0].direction = [-1, 0, 0];
reversePointScene.screens = [createScreen(0)];
result = traceScene(reversePointScene, { rayCount: 96 });
assert.ok(result.screenResults[0].hitCount > 0);

const singleRayScene = createDefaultFreeScene();
singleRayScene.elements = [];
singleRayScene.lightSources = [createLightSource('ray', -12)];
singleRayScene.screens = [createScreen(4)];
result = traceScene(singleRayScene, { rayCount: 96 });
assert.equal(result.paths.length, 1);
assert.equal(result.screenResults[0].hitCount, 1);

const detectorScene = createDefaultFreeScene();
detectorScene.elements = [];
detectorScene.lightSources = [createLightSource('parallel', -12)];
detectorScene.screens = [createDetector(-2), createScreen(8)];
result = traceScene(detectorScene, { rayCount: 80 });
assert.ok(result.screenResults[0].hitCount > 0);
assert.ok(result.screenResults[1].hitCount > 0);

const blockerScene = createDefaultFreeScene();
blockerScene.elements = [createOpticalElement('blocker', -2)];
blockerScene.elements[0].apertureRadius = 7;
blockerScene.lightSources = [createLightSource('parallel', -12)];
blockerScene.screens = [createScreen(8)];
result = traceScene(blockerScene, { rayCount: 80 });
assert.equal(result.screenResults[0].hitCount, 0);

const shiftedScene = createDefaultFreeScene();
updateItemPosition2D(shiftedScene, shiftedScene.elements[0].id, 0, 2);
updateItemPosition2D(shiftedScene, shiftedScene.screens[0].id, 12, 2);
shiftedScene.lightSources[0].position[1] = 2;
result = traceScene(shiftedScene, { rayCount: 120 });
assert.ok(result.screenResults[0].hitCount > 20);

const angledRayScene = createDefaultFreeScene();
angledRayScene.elements = [];
angledRayScene.lightSources = [createLightSource('ray', -10)];
angledRayScene.lightSources[0].position[1] = -2;
angledRayScene.lightSources[0].angleDeg = 20;
angledRayScene.lightSources[0].direction = [Math.cos(Math.PI / 9), Math.sin(Math.PI / 9), 0];
angledRayScene.screens = [createScreen(4)];
angledRayScene.screens[0].height = 12;
result = traceScene(angledRayScene, { rayCount: 40 });
assert.equal(result.screenResults[0].hitCount, 1);

const smallScreenScene = createDefaultFreeScene();
smallScreenScene.elements = [];
smallScreenScene.lightSources[0].beamRadius = 3;
smallScreenScene.lightSources[0].divergenceDeg = 0;
smallScreenScene.screens[0].width = 1;
smallScreenScene.screens[0].height = 1;
result = traceScene(smallScreenScene, { rayCount: 120 });
assert.ok(result.screenResults[0].hitCount < 120);

const focusScene = createDefaultFreeScene();
focusScene.elements[0].focalLength = 10;
focusScene.screens[0].position[0] = 10;
const focused = traceScene(focusScene, { rayCount: 180 }).screenResults[0].spotRadius;
focusScene.screens[0].position[0] = 18;
const defocused = traceScene(focusScene, { rayCount: 180 }).screenResults[0].spotRadius;
assert.ok(focused < defocused);

const editingScene = createDefaultFreeScene();
const added = addSceneItem(editingScene, 'convexMirror');
assert.equal(editingScene.selectedId, added.id);
updateItemPosition(editingScene, added.id, 12.25);
assert.equal(added.position[0], 12.25);
removeSceneItem(editingScene, added.id);
assert.equal(editingScene.elements.some((item) => item.id === added.id), false);
