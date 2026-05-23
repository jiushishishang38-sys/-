import * as THREE from '../vendor/three.module.js';
import { OrbitControls } from '../vendor/OrbitControls.js';
import {
  EYES,
  evaluateExperiment,
  loadRows,
  renderDataTable,
  saveRows,
  traceTeachingRays,
  updateRowWithMeasurement
} from '../optics.js';

const mount = document.getElementById('experiment-canvas');
const modeInput = document.getElementById('mode');
const eyeInput = document.getElementById('eye-id');
const screenInput = document.getElementById('screen-pos');
const collimatorInput = document.getElementById('collimator-pos');
const objectInput = document.getElementById('object-pos');
const lensTypeInput = document.getElementById('lens-type');
const lensPowerInput = document.getElementById('lens-power');
const cylinderInput = document.getElementById('cylinder-angle');
const readout = document.getElementById('readout');
const table = document.getElementById('experiment-table');
const rayCanvas = document.getElementById('ray-sim-canvas');
const rayCtx = rayCanvas.getContext('2d');
const rayFocalInput = document.getElementById('ray-focal');
const raySimResult = document.getElementById('ray-sim-result');

let rows = loadRows();
renderDataTable(table, rows);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0xf4f8fb);

const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
camera.position.set(8, 5.2, 9);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
mount.appendChild(renderer.domElement);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.target.set(0, 0.55, 0);

scene.add(new THREE.AmbientLight(0xf4fbff, 1.55));
const key = new THREE.DirectionalLight(0xffffff, 2.2);
key.position.set(4, 7, 6);
key.castShadow = true;
scene.add(key);
scene.add(new THREE.HemisphereLight(0xffffff, 0xcad8e2, 1.05));

const draggable = [];
const componentMap = new Map();
let rayLines = [];
let lastExperimentKey = '';
let rayObjectDrag = false;

function cmToX(cm) {
  return cm / 4;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function makeMat(color, options = {}) {
  return new THREE.MeshStandardMaterial({
    color,
    roughness: options.roughness ?? 0.38,
    metalness: options.metalness ?? 0.06,
    transparent: options.transparent ?? false,
    opacity: options.opacity ?? 1,
    side: THREE.DoubleSide,
    emissive: options.emissive ?? 0x000000,
    emissiveIntensity: options.emissiveIntensity ?? 0
  });
}

function labelTexture(text) {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 80;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = 'rgba(255,255,255,0.9)';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.strokeStyle = 'rgba(22,135,167,0.55)';
  ctx.strokeRect(1, 1, canvas.width - 2, canvas.height - 2);
  ctx.fillStyle = '#162532';
  ctx.font = '700 27px Microsoft YaHei, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, 128, 42);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return new THREE.SpriteMaterial({ map: texture, transparent: true, depthTest: false });
}

function addLabel(text, x, y = 2.92) {
  const sprite = new THREE.Sprite(labelTexture(text));
  sprite.position.set(x, y, -0.82);
  sprite.scale.set(1.7, 0.55, 1);
  sprite.renderOrder = 50;
  scene.add(sprite);
  return sprite;
}

function scaleTexture(text) {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 64;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#050505';
  ctx.font = '700 24px Microsoft YaHei, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, 64, 32);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function addScaleNumber(text, x) {
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({
    map: scaleTexture(text),
    transparent: true,
    depthTest: false
  }));
  sprite.position.set(x, 0.42, 0.86);
  sprite.scale.set(0.62, 0.31, 1);
  sprite.renderOrder = 60;
  scene.add(sprite);
}

function rulerTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 2400;
  canvas.height = 260;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = 'rgba(255, 255, 255, 0.48)';
  ctx.fillRect(0, 38, canvas.width, 150);
  ctx.strokeStyle = 'rgba(0, 0, 0, 0.76)';
  ctx.lineWidth = 5;
  ctx.strokeRect(8, 38, canvas.width - 16, 150);

  const startCm = -32;
  const endCm = 32;
  const span = endCm - startCm;
  const left = 90;
  const right = canvas.width - 90;
  const usable = right - left;

  for (let cm = startCm; cm <= endCm; cm += 1) {
    const x = left + ((cm - startCm) / span) * usable;
    const major = cm % 10 === 0;
    const medium = cm % 5 === 0;
    const tickHeight = major ? 112 : medium ? 82 : 52;
    ctx.beginPath();
    ctx.moveTo(x, 48);
    ctx.lineTo(x, 48 + tickHeight);
    ctx.strokeStyle = major ? '#050505' : medium ? '#111111' : '#222222';
    ctx.lineWidth = major ? 6 : medium ? 4 : 2.5;
    ctx.stroke();

    if (major) {
      ctx.fillStyle = '#050505';
      ctx.font = '900 42px Microsoft YaHei, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(String(cm), x, 220);
    }
  }

  ctx.fillStyle = '#050505';
  ctx.font = '900 38px Microsoft YaHei, sans-serif';
  ctx.textAlign = 'right';
  ctx.fillText('cm', canvas.width - 44, 220);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  return texture;
}

function addTransparentRuler() {
  const ruler = new THREE.Mesh(
    new THREE.PlaneGeometry(16.6, 1.16),
    new THREE.MeshBasicMaterial({
      map: rulerTexture(),
      transparent: true,
      opacity: 0.86,
      depthWrite: false,
      side: THREE.DoubleSide
    })
  );
  ruler.rotation.x = -Math.PI / 2;
  ruler.position.set(0, 0.382, 0.96);
  ruler.renderOrder = 42;
  scene.add(ruler);
}

function drawGlowLine(ctx, points, color, width = 2.5, dashed = false) {
  ctx.save();
  ctx.setLineDash(dashed ? [8, 8] : []);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = color;
  ctx.shadowColor = color;
  ctx.shadowBlur = dashed ? 0 : 10;
  ctx.lineWidth = width + 5;
  ctx.globalAlpha = dashed ? 0.42 : 0.2;
  ctx.beginPath();
  points.forEach(([x, y], index) => {
    if (index === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.stroke();
  ctx.globalAlpha = dashed ? 0.74 : 1;
  ctx.shadowBlur = dashed ? 0 : 5;
  ctx.lineWidth = width;
  ctx.beginPath();
  points.forEach(([x, y], index) => {
    if (index === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.stroke();
  ctx.restore();
}

function drawArrow(ctx, x, axisY, height, color, label) {
  const tipY = axisY - height;
  const direction = height >= 0 ? -1 : 1;
  ctx.save();
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = 5;
  ctx.shadowColor = color;
  ctx.shadowBlur = 8;
  ctx.beginPath();
  ctx.moveTo(x, axisY);
  ctx.lineTo(x, tipY);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(x, tipY);
  ctx.lineTo(x - 10, tipY - direction * 16);
  ctx.lineTo(x + 10, tipY - direction * 16);
  ctx.closePath();
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.font = '800 14px Microsoft YaHei, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(label, x, axisY + 22);
  ctx.restore();
}

function drawBezierLens(ctx, x, y, height) {
  const top = y - height / 2;
  const bottom = y + height / 2;
  ctx.save();
  ctx.fillStyle = 'rgba(85, 186, 208, 0.2)';
  ctx.strokeStyle = '#1687a7';
  ctx.lineWidth = 4;
  ctx.shadowColor = '#55bad0';
  ctx.shadowBlur = 12;
  ctx.beginPath();
  ctx.moveTo(x, top);
  ctx.quadraticCurveTo(x + 28, y, x, bottom);
  ctx.quadraticCurveTo(x - 28, y, x, top);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

function drawRaySim() {
  const rect = rayCanvas.getBoundingClientRect();
  const ratio = Math.max(1, Math.min(window.devicePixelRatio || 1, 2));
  const width = Math.max(360, Math.round(rect.width * ratio));
  const height = Math.max(180, Math.round(rect.height * ratio));
  if (rayCanvas.width !== width || rayCanvas.height !== height) {
    rayCanvas.width = width;
    rayCanvas.height = height;
  }

  const ctx = rayCtx;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = '#f7fbfd';
  ctx.fillRect(0, 0, width, height);

  ctx.strokeStyle = 'rgba(55, 107, 143, 0.12)';
  ctx.lineWidth = 1;
  for (let x = 0; x <= width; x += 36 * ratio) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, height);
    ctx.stroke();
  }
  for (let y = 0; y <= height; y += 36 * ratio) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
    ctx.stroke();
  }

  const axisY = height * 0.56;
  const lensX = width * 0.52;
  const scale = (width - 90 * ratio) / 72;
  const objectCm = Number(objectInput.value);
  const u = Math.abs(objectCm);
  const f = Number(rayFocalInput.value);
  const rawV = Math.abs(u - f) < 0.25 ? Infinity : 1 / (1 / f - 1 / u);
  const v = Number.isFinite(rawV) ? rawV : 90;
  const m = Number.isFinite(rawV) ? -v / u : -6;
  const objectX = lensX + objectCm * scale;
  const imageX = lensX + clamp(v, -34, 34) * scale;
  const objectH = 46 * ratio;
  const imageH = clamp(objectH * m, -90 * ratio, 90 * ratio);
  const focusLeft = lensX - f * scale;
  const focusRight = lensX + f * scale;
  const objectTip = [objectX, axisY - objectH];
  const lensUpper = [lensX, axisY - objectH];
  const lensCenter = [lensX, axisY];
  const imageTip = [imageX, axisY - imageH];
  const realImage = Number.isFinite(rawV) && rawV > 0;

  ctx.strokeStyle = 'rgba(45, 82, 108, 0.7)';
  ctx.lineWidth = 2 * ratio;
  ctx.beginPath();
  ctx.moveTo(28 * ratio, axisY);
  ctx.lineTo(width - 28 * ratio, axisY);
  ctx.stroke();

  [focusLeft, focusRight].forEach((x, index) => {
    ctx.fillStyle = '#7a4d0d';
    ctx.beginPath();
    ctx.arc(x, axisY, 4 * ratio, 0, Math.PI * 2);
    ctx.fill();
    ctx.font = `${12 * ratio}px Microsoft YaHei, sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText(index === 0 ? "F'" : 'F', x, axisY + 18 * ratio);
  });

  drawBezierLens(ctx, lensX, axisY, 142 * ratio);
  drawArrow(ctx, objectX, axisY, objectH, '#2f7c68', '物');

  if (realImage) {
    drawGlowLine(ctx, [objectTip, lensUpper, imageTip], '#f0b33a', 2.5 * ratio);
    drawGlowLine(ctx, [objectTip, lensCenter, imageTip], '#1687a7', 2.5 * ratio);
    drawArrow(ctx, imageX, axisY, imageH, '#b64b5c', '实像');
  } else {
    const virtualTip = imageTip;
    const divergeTopEnd = [width - 32 * ratio, axisY - objectH * 0.45];
    const divergeCenterEnd = [width - 32 * ratio, axisY + objectH * 0.4];
    drawGlowLine(ctx, [objectTip, lensUpper, divergeTopEnd], '#f0b33a', 2.5 * ratio);
    drawGlowLine(ctx, [objectTip, lensCenter, divergeCenterEnd], '#1687a7', 2.5 * ratio);
    drawGlowLine(ctx, [lensUpper, virtualTip], '#f0b33a', 2 * ratio, true);
    drawGlowLine(ctx, [lensCenter, virtualTip], '#1687a7', 2 * ratio, true);
    drawArrow(ctx, imageX, axisY, imageH, '#b64b5c', '虚像');
  }

  ctx.fillStyle = '#162532';
  ctx.font = `${13 * ratio}px Microsoft YaHei, sans-serif`;
  ctx.textAlign = 'left';
  ctx.fillText(`u = ${u.toFixed(1)} cm`, 18 * ratio, 24 * ratio);
  ctx.fillText(`f = ${f.toFixed(1)} cm`, 18 * ratio, 44 * ratio);

  const resultText = Number.isFinite(rawV)
    ? `像距 ${rawV.toFixed(1)} cm · ${Math.abs(m).toFixed(2)} 倍 · ${m < 0 ? '倒立' : '正立'}${realImage ? '实像' : '虚像'}`
    : '物体在焦点附近 · 像距趋于无穷远';
  raySimResult.textContent = resultText;
}

function boardTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 900;
  canvas.height = 420;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#f8fbfd';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.strokeStyle = 'rgba(55,107,143,0.18)';
  ctx.lineWidth = 3;
  for (let x = 40; x < canvas.width; x += 80) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, canvas.height);
    ctx.stroke();
  }
  for (let y = 40; y < canvas.height; y += 80) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(canvas.width, y);
    ctx.stroke();
  }
  ctx.fillStyle = '#2f6686';
  ctx.font = '700 60px Microsoft YaHei, sans-serif';
  ctx.fillText('1/f = 1/u + 1/v', 72, 112);
  ctx.fillText('φ = 1/f', 610, 112);
  ctx.strokeStyle = '#1687a7';
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.moveTo(150, 302);
  ctx.lineTo(420, 302);
  ctx.lineTo(420, 172);
  ctx.lineTo(150, 302);
  ctx.stroke();
  ctx.font = '700 34px Microsoft YaHei, sans-serif';
  ctx.fillStyle = '#5f7180';
  ctx.fillText('视网膜前：近视', 520, 250);
  ctx.fillText('视网膜后：远视', 520, 310);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function addLabBackdrop() {
  const wall = new THREE.Mesh(
    new THREE.PlaneGeometry(19, 9),
    makeMat(0xe8eff4, { roughness: 0.78 })
  );
  wall.position.set(0, 3.15, -3.15);
  wall.receiveShadow = true;
  scene.add(wall);

  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(22, 8),
    makeMat(0xdce7ee, { roughness: 0.68 })
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(0, -0.72, 1.1);
  floor.receiveShadow = true;
  scene.add(floor);

  const tableTop = new THREE.Mesh(
    new THREE.BoxGeometry(18, 0.32, 3.2),
    makeMat(0xf7fafc, { roughness: 0.42, metalness: 0.04 })
  );
  tableTop.position.set(0, -0.33, 0.1);
  tableTop.castShadow = true;
  tableTop.receiveShadow = true;
  scene.add(tableTop);

  const tableEdge = new THREE.Mesh(
    new THREE.BoxGeometry(18.2, 0.12, 3.35),
    makeMat(0xc5d4de, { roughness: 0.48 })
  );
  tableEdge.position.set(0, -0.56, 0.1);
  scene.add(tableEdge);

  const boardFrame = new THREE.Mesh(
    new THREE.BoxGeometry(6.4, 3.0, 0.12),
    makeMat(0xb3c2cc, { roughness: 0.42, metalness: 0.08 })
  );
  boardFrame.position.set(0.3, 3.65, -3.0);
  scene.add(boardFrame);

  const board = new THREE.Mesh(
    new THREE.PlaneGeometry(5.95, 2.55),
    new THREE.MeshStandardMaterial({ map: boardTexture(), roughness: 0.78 })
  );
  board.position.set(0.3, 3.65, -2.9);
  scene.add(board);

  const cabinet = new THREE.Mesh(
    new THREE.BoxGeometry(2.0, 4.05, 0.85),
    makeMat(0xd2dee7, { roughness: 0.48 })
  );
  cabinet.position.set(7.35, 2.45, -2.65);
  cabinet.castShadow = true;
  scene.add(cabinet);

  [-3.9, 4.8].forEach((x) => {
    const panel = new THREE.Mesh(
      new THREE.BoxGeometry(2.1, 0.05, 0.75),
      makeMat(0xffffff, { emissive: 0xffffff, emissiveIntensity: 0.78, roughness: 0.22 })
    );
    panel.position.set(x, 6.85, -1.1);
    scene.add(panel);
  });
}

function makeLens(convex = true, color = 0x69c7d8) {
  const shape = new THREE.Shape();
  if (convex) {
    shape.absellipse(0, 0, 0.28, 1.0, 0, Math.PI * 2);
  } else {
    shape.moveTo(-0.22, -1);
    shape.quadraticCurveTo(0.16, 0, -0.22, 1);
    shape.lineTo(0.22, 1);
    shape.quadraticCurveTo(-0.16, 0, 0.22, -1);
    shape.lineTo(-0.22, -1);
  }
  const geometry = new THREE.ExtrudeGeometry(shape, { depth: 0.08, bevelEnabled: false });
  geometry.center();
  return new THREE.Mesh(geometry, makeMat(color, { transparent: true, opacity: 0.5, roughness: 0.08 }));
}

function makeMount(keyName, label, x, mesh) {
  const group = new THREE.Group();
  group.position.set(x, 0, 0);
  const base = new THREE.Mesh(new THREE.BoxGeometry(0.58, 0.34, 0.75), makeMat(0xc8d5de, { metalness: 0.12 }));
  base.position.y = 0.25;
  const post = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, 1.35, 18), makeMat(0x8095a3, { metalness: 0.45 }));
  post.position.y = 0.95;
  mesh.position.y += 1.65;
  group.add(base, post, mesh);
  group.userData.key = keyName;
  group.traverse((child) => {
    child.userData.parentDrag = group;
  });
  scene.add(group);
  addLabel(label, x);
  draggable.push(group);
  componentMap.set(keyName, group);
  return group;
}

function buildScene() {
  addLabBackdrop();

  const railMat = makeMat(0x7e94a3, { metalness: 0.38 });
  const rail = new THREE.Mesh(new THREE.BoxGeometry(15.5, 0.16, 0.16), railMat);
  rail.position.set(0, 0.1, -0.34);
  const rail2 = rail.clone();
  rail2.position.z = 0.34;
  scene.add(rail, rail2);

  const scaleDeck = new THREE.Mesh(new THREE.BoxGeometry(15.8, 0.035, 0.18), makeMat(0xd5e2ea));
  scaleDeck.position.set(0, 0.255, 0.72);
  scene.add(scaleDeck);
  addTransparentRuler();

  for (let cm = -32; cm <= 32; cm += 2) {
    const major = cm % 10 === 0;
    const medium = cm % 5 === 0;
    const x = cmToX(cm);
    const tick = new THREE.Mesh(
      new THREE.BoxGeometry(major ? 0.035 : 0.022, major ? 0.12 : 0.075, major ? 0.58 : medium ? 0.42 : 0.28),
      makeMat(major ? 0x050505 : 0x111111, { metalness: 0.02, roughness: 0.5 })
    );
    tick.position.set(x, 0.405, 0.72);
    scene.add(tick);
    if (major) addScaleNumber(String(cm), x);
  }
  addScaleNumber('cm', 7.55);

  const lamp = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.78, 28), makeMat(0xd9e5ec));
  lamp.rotation.z = Math.PI / 2;
  const glass = new THREE.Mesh(new THREE.CircleGeometry(0.22, 28), makeMat(0xffd47a, { transparent: true, opacity: 0.9, emissive: 0xffc04a, emissiveIntensity: 0.35 }));
  glass.position.set(0.41, 0, 0);
  lamp.add(glass);
  makeMount('source', '光源', -7.0, lamp);

  const object = new THREE.Group();
  const plate = new THREE.Mesh(new THREE.BoxGeometry(0.12, 1.45, 0.92), makeMat(0xf8fbfd, { transparent: true, opacity: 0.72 }));
  const arrow = new THREE.Mesh(new THREE.ConeGeometry(0.18, 0.48, 3), makeMat(0x2b5369));
  arrow.position.y = 0.24;
  arrow.rotation.z = Math.PI;
  object.add(plate, arrow);
  makeMount('object', '物屏', cmToX(Number(objectInput.value)), object);

  makeMount('collimator', '双凸透镜', cmToX(Number(collimatorInput.value)), makeLens(true));

  const slot = new THREE.Mesh(new THREE.BoxGeometry(0.18, 1.7, 1.05), makeMat(0xb9c7d1, { metalness: 0.18 }));
  makeMount('slot', '槽板', -0.2, slot);

  const screen = new THREE.Mesh(new THREE.BoxGeometry(0.1, 1.9, 1.25), makeMat(0xffffff, { transparent: true, opacity: 0.84 }));
  makeMount('screen', '像屏', cmToX(Number(screenInput.value)), screen);
}

buildScene();

const rayMat = new THREE.LineBasicMaterial({ color: 0xf0b33a, transparent: true, opacity: 0.95, depthTest: false });
const correctedMat = new THREE.LineBasicMaterial({ color: 0x1687a7, transparent: true, opacity: 0.96, depthTest: false });

function updateRays(resultBundle) {
  rayLines.forEach((line) => {
    scene.remove(line);
    line.geometry.dispose();
  });
  rayLines = [];
  resultBundle.rays.forEach((ray, index) => {
    const points = ray.map(([x, y, z]) => new THREE.Vector3(x, y + 1.65, z));
    const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints(points), index === 1 ? correctedMat : rayMat);
    line.renderOrder = 100;
    rayLines.push(line);
    scene.add(line);
  });
}

function readExperimentState() {
  return {
    mode: modeInput.value,
    eyeId: eyeInput.value,
    screenCm: Number(screenInput.value),
    collimatorCm: Number(collimatorInput.value),
    objectCm: Number(objectInput.value),
    lensType: lensTypeInput.value,
    lensPower: Number(lensPowerInput.value),
    cylinderAngle: Number(cylinderInput.value)
  };
}

function experimentKey(state) {
  return [
    state.mode,
    state.eyeId,
    state.screenCm,
    state.collimatorCm,
    state.objectCm,
    state.lensType,
    state.lensPower,
    state.cylinderAngle
  ].join('|');
}

function setComponentPositions(state) {
  componentMap.get('object').position.x = cmToX(state.objectCm);
  componentMap.get('collimator').position.x = cmToX(state.collimatorCm);
  componentMap.get('screen').position.x = cmToX(state.screenCm);
}

function updateExperiment(force = false) {
  const state = readExperimentState();
  const key = experimentKey(state);
  if (!force && key === lastExperimentKey) return;
  lastExperimentKey = key;
  setComponentPositions(state);
  const bundle = traceTeachingRays({
    eyeId: state.eyeId,
    lensType: state.lensType,
    lensPower: state.lensPower,
    screenCm: state.screenCm,
    cylinderAngle: state.cylinderAngle,
    objectCm: state.objectCm,
    collimatorCm: state.collimatorCm
  });
  updateRays(bundle);
  const result = bundle.result;
  const focus = result.focusCm.toFixed(2);
  const correction = result.correction.toFixed(2);
  const clear = result.isClearOnScreen ? '像屏清晰' : '像屏模糊';
  const retina = result.isCorrected ? '焦点接近视网膜' : result.retinaError < 0 ? '焦点在视网膜前' : '焦点在视网膜后';
  readout.innerHTML = `
    <span>当前模拟眼：<strong>${eyeInput.value}</strong>，${result.type}，${result.eye.note}</span>
    <span>当前焦点位置：<strong>${focus} cm</strong></span>
    <span>像屏判断：<strong>${clear}</strong>，偏差 ${result.screenError.toFixed(2)} cm</span>
    <span>视网膜判断：<strong>${retina}</strong></span>
    <span>推荐矫正：<strong>${result.recommended.label}</strong>，计算焦度 ${correction} D</span>
    <span>柱面镜角度：<strong>${cylinderInput.value}°</strong></span>
  `;
  drawRaySim();
}

[modeInput, eyeInput, screenInput, collimatorInput, objectInput, lensTypeInput, lensPowerInput, cylinderInput].forEach((input) => {
  input.addEventListener('input', () => updateExperiment(true));
});

rayFocalInput.addEventListener('input', drawRaySim);

document.getElementById('auto-correct').addEventListener('click', () => {
  const result = evaluateExperiment({ eyeId: eyeInput.value, screenCm: Number(screenInput.value) });
  lensTypeInput.value = result.recommended.type;
  lensPowerInput.value = result.correction.toFixed(2);
  updateExperiment(true);
});

document.getElementById('record-measurement').addEventListener('click', () => {
  if (eyeInput.value === 'S') return;
  const measuredFocus = EYES[eyeInput.value].focusCm;
  const fittedPower = lensTypeInput.value === 'none' ? Number.NaN : Number(lensPowerInput.value);
  rows = updateRowWithMeasurement(rows, eyeInput.value, measuredFocus, fittedPower);
  renderDataTable(table, rows);
});

document.getElementById('save-report').addEventListener('click', () => {
  saveRows(rows);
  readout.insertAdjacentHTML('beforeend', '<span><strong>已保存：</strong>实验数据可在报告页查看。</span>');
});

document.querySelectorAll('[data-view]').forEach((button) => {
  button.addEventListener('click', () => {
    const view = button.dataset.view;
    const presets = {
      front: [0, 3.2, 12],
      side: [12, 3.5, 0],
      top: [0, 13, 0.01],
      teach: [8, 5.2, 9],
      reset: [8, 5.2, 9]
    };
    camera.position.set(...presets[view]);
    controls.target.set(0, 0.7, 0);
    controls.update();
  });
});

const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
let activeDrag = null;

renderer.domElement.addEventListener('pointerdown', (event) => {
  const rect = renderer.domElement.getBoundingClientRect();
  pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  pointer.y = -(((event.clientY - rect.top) / rect.height) * 2 - 1);
  raycaster.setFromCamera(pointer, camera);
  const hit = raycaster.intersectObjects(draggable, true)[0];
  activeDrag = hit?.object.userData.parentDrag || null;
  if (activeDrag) controls.enabled = false;
});

function setObjectFromRayPointer(event) {
  const rect = rayCanvas.getBoundingClientRect();
  const lensX = rect.left + rect.width * 0.52;
  const scale = (rect.width - 90) / 72;
  const cm = clamp((event.clientX - lensX) / scale, -34, -12);
  objectInput.value = String(Math.round(cm));
  updateExperiment(true);
}

rayCanvas.addEventListener('pointerdown', (event) => {
  rayObjectDrag = true;
  rayCanvas.setPointerCapture(event.pointerId);
  setObjectFromRayPointer(event);
});

rayCanvas.addEventListener('pointermove', (event) => {
  if (rayObjectDrag) setObjectFromRayPointer(event);
});

rayCanvas.addEventListener('pointerup', () => {
  rayObjectDrag = false;
});

rayCanvas.addEventListener('pointercancel', () => {
  rayObjectDrag = false;
});

window.addEventListener('pointermove', (event) => {
  if (!activeDrag) return;
  const rect = renderer.domElement.getBoundingClientRect();
  const x = ((event.clientX - rect.left) / rect.width) * 14 - 7;
  activeDrag.position.x = THREE.MathUtils.clamp(x, -7.5, 8.5);
  const cm = Math.round(activeDrag.position.x * 4);
  if (activeDrag.userData.key === 'screen') screenInput.value = THREE.MathUtils.clamp(cm, 14, 36);
  if (activeDrag.userData.key === 'collimator') collimatorInput.value = THREE.MathUtils.clamp(cm, -24, -6);
  if (activeDrag.userData.key === 'object') objectInput.value = THREE.MathUtils.clamp(cm, -34, -12);
  updateExperiment(true);
});

window.addEventListener('pointerup', () => {
  activeDrag = null;
  controls.enabled = true;
});

function resize() {
  const rect = mount.getBoundingClientRect();
  renderer.setSize(rect.width, rect.height);
  camera.aspect = rect.width / rect.height;
  camera.updateProjectionMatrix();
}

window.addEventListener('resize', () => {
  resize();
  drawRaySim();
});

if ('ResizeObserver' in window) {
  const raySimResizeObserver = new ResizeObserver(() => drawRaySim());
  raySimResizeObserver.observe(rayCanvas);
}

resize();
updateExperiment(true);
requestAnimationFrame(drawRaySim);

function animate() {
  updateExperiment();
  controls.update();
  renderer.render(scene, camera);
  requestAnimationFrame(animate);
}

animate();
