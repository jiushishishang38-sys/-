import * as THREE from '../vendor/three.module.js';
import { OrbitControls } from '../vendor/OrbitControls.js';
import {
  BENCH_RISER_Y,
  BENCH_RULER_Y,
  BENCH_RULER_TILT_RADIANS,
  DRAG_PICK_AREA_DEPTH,
  DRAG_PICK_AREA_HEIGHT,
  DRAG_PICK_AREA_WIDTH,
  DRAG_PICK_AREA_Y,
  DRAG_PICK_AREA_Z,
  MOUNT_BASE_DEPTH,
  MOUNT_BASE_HEIGHT,
  MOUNT_POST_HEIGHT,
  MOUNT_POST_Z,
  RULER_MAX_CM,
  RULER_MIN_CM,
  RULER_LABEL_Y,
  RULER_TICK_START_Y,
  clamp,
  cmToX,
  formatRailPosition,
  getRulerTickMarks,
  railXToSnappedCm,
  selectDragTargetFromHits,
  snapRailCm
} from './experiment-interaction.js';
import {
  clearRowData,
  EYES,
  evaluateExperiment,
  loadRows,
  renderDataTable,
  saveRows,
  traceTeachingRays,
  updateRowData,
  updateRowWithMeasurement
} from '../optics.js';

const mount = document.getElementById('experiment-canvas');
const modeInput = document.getElementById('mode');
const eyeInput = document.getElementById('eye-id');
const screenInput = document.getElementById('screen-pos');
const collimatorInput = document.getElementById('collimator-pos');
const objectInput = document.getElementById('object-pos');
const screenValue = document.getElementById('screen-pos-value');
const collimatorValue = document.getElementById('collimator-pos-value');
const objectValue = document.getElementById('object-pos-value');
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
let editingRowId = '';

function renderExperimentTable() {
  renderDataTable(table, rows, { editable: true, editingId: editingRowId });
}

renderExperimentTable();

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
let correctionSupport = null;

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

const dragHitAreaMaterial = new THREE.MeshBasicMaterial({
  transparent: true,
  opacity: 0,
  depthWrite: false
});

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
  let fontSize = 27;
  do {
    ctx.font = `700 ${fontSize}px Microsoft YaHei, sans-serif`;
    fontSize -= 1;
  } while (ctx.measureText(text).width > 228 && fontSize > 18);
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
  sprite.userData.text = text;
  scene.add(sprite);
  return sprite;
}

function updateLabel(sprite, text) {
  if (!sprite || sprite.userData.text === text) return;
  const previousMaterial = sprite.material;
  sprite.material = labelTexture(text);
  sprite.userData.text = text;
  previousMaterial.map?.dispose();
  previousMaterial.dispose();
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
  canvas.width = 3200;
  canvas.height = 360;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  const left = 126;
  const right = canvas.width - 126;
  const usable = right - left;
  const span = RULER_MAX_CM - RULER_MIN_CM;
  const bodyTop = 42;
  const bodyBottom = 278;

  const gradient = ctx.createLinearGradient(0, bodyTop, 0, bodyBottom);
  gradient.addColorStop(0, 'rgba(255, 255, 255, 0.9)');
  gradient.addColorStop(0.54, 'rgba(247, 251, 253, 0.82)');
  gradient.addColorStop(1, 'rgba(224, 235, 242, 0.86)');
  ctx.fillStyle = gradient;
  ctx.fillRect(14, bodyTop, canvas.width - 28, bodyBottom - bodyTop);

  ctx.fillStyle = 'rgba(22, 135, 167, 0.08)';
  for (let cm = RULER_MIN_CM; cm < RULER_MAX_CM; cm += 10) {
    const x = left + ((cm - RULER_MIN_CM) / span) * usable;
    const nextX = left + ((Math.min(cm + 5, RULER_MAX_CM) - RULER_MIN_CM) / span) * usable;
    ctx.fillRect(x, bodyTop + 8, nextX - x, bodyBottom - bodyTop - 16);
  }

  ctx.strokeStyle = 'rgba(22, 37, 50, 0.72)';
  ctx.lineWidth = 5;
  ctx.strokeRect(14, bodyTop, canvas.width - 28, bodyBottom - bodyTop);

  ctx.strokeStyle = 'rgba(22, 37, 50, 0.24)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(28, RULER_LABEL_Y - 48);
  ctx.lineTo(canvas.width - 28, RULER_LABEL_Y - 48);
  ctx.stroke();

  getRulerTickMarks().forEach((tick) => {
    const x = left + ((tick.cm - RULER_MIN_CM) / span) * usable;
    const tickHeight = {
      zero: 166,
      major: 142,
      medium: 112,
      minor: 74,
      half: 42
    }[tick.kind];
    ctx.beginPath();
    ctx.moveTo(x, RULER_TICK_START_Y);
    ctx.lineTo(x, RULER_TICK_START_Y + tickHeight);
    ctx.strokeStyle = tick.kind === 'zero'
      ? '#b64b5c'
      : tick.kind === 'major'
        ? '#162532'
        : tick.kind === 'medium'
          ? '#2f5369'
          : tick.kind === 'minor'
            ? 'rgba(22, 37, 50, 0.7)'
            : 'rgba(22, 37, 50, 0.38)';
    ctx.lineWidth = tick.kind === 'zero' ? 8 : tick.kind === 'major' ? 6 : tick.kind === 'medium' ? 4 : 2.3;
    ctx.stroke();

    if (tick.label) {
      ctx.fillStyle = tick.kind === 'zero' ? '#b64b5c' : '#162532';
      ctx.font = `${tick.kind === 'zero' ? '950' : '900'} 48px Microsoft YaHei, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(tick.label, x, RULER_LABEL_Y);
    }
  });

  ctx.fillStyle = '#2f5369';
  ctx.font = '900 36px Microsoft YaHei, sans-serif';
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';
  ctx.fillText('cm', canvas.width - 48, RULER_LABEL_Y);

  ctx.fillStyle = 'rgba(22, 37, 50, 0.5)';
  ctx.font = '800 22px Microsoft YaHei, sans-serif';
  ctx.fillText('0.5 cm', canvas.width - 48, bodyTop + 34);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 12;
  return texture;
}

function addInclinedRuler() {
  const group = new THREE.Group();
  group.position.set(0, BENCH_RULER_Y, 0.72);

  const ruler = new THREE.Mesh(
    new THREE.PlaneGeometry(18.25, 1.08),
    new THREE.MeshBasicMaterial({
      map: rulerTexture(),
      transparent: true,
      opacity: 0.96,
      depthWrite: false,
      side: THREE.DoubleSide
    })
  );
  ruler.rotation.x = -BENCH_RULER_TILT_RADIANS;
  ruler.position.set(0, 0.04, 0.04);
  ruler.renderOrder = 42;

  const frameMat = makeMat(0xaebfca, { roughness: 0.44, metalness: 0.16 });
  const upperLip = new THREE.Mesh(new THREE.BoxGeometry(18.45, 0.045, 0.045), frameMat);
  upperLip.rotation.x = -BENCH_RULER_TILT_RADIANS;
  upperLip.position.set(0, 0.48, -0.36);
  const lowerLip = upperLip.clone();
  lowerLip.position.set(0, -0.50, 0.56);
  group.add(ruler, upperLip, lowerLip);
  scene.add(group);
}

function addInclinedBenchBase() {
  const baseMat = makeMat(0xb8cfdd, { roughness: 0.5, metalness: 0.08 });
  const shadowMat = makeMat(0x87a8ba, { roughness: 0.48, metalness: 0.12 });
  const wedge = new THREE.Mesh(new THREE.BoxGeometry(18.55, 0.22, 1.26), baseMat);
  wedge.rotation.x = -BENCH_RULER_TILT_RADIANS;
  wedge.position.set(0, BENCH_RISER_Y + 0.08, 0.58);
  wedge.castShadow = true;
  wedge.receiveShadow = true;

  const rearLift = new THREE.Mesh(new THREE.BoxGeometry(18.7, 0.28, 0.22), shadowMat);
  rearLift.position.set(0, BENCH_RISER_Y + 0.24, 0.08);
  rearLift.castShadow = true;
  rearLift.receiveShadow = true;

  const frontFoot = new THREE.Mesh(new THREE.BoxGeometry(18.7, 0.12, 0.28), shadowMat);
  frontFoot.position.set(0, BENCH_RISER_Y - 0.18, 1.1);
  frontFoot.castShadow = true;
  frontFoot.receiveShadow = true;

  scene.add(wedge, rearLift, frontFoot);
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
  const lens = new THREE.Group();
  lens.userData.isVolumetric = true;

  const glassMat = new THREE.MeshPhysicalMaterial({
    color,
    roughness: 0.03,
    metalness: 0,
    transparent: true,
    opacity: convex ? 0.42 : 0.34,
    transmission: 0.42,
    thickness: convex ? 0.75 : 0.26,
    ior: 1.48,
    clearcoat: 0.7,
    clearcoatRoughness: 0.04,
    side: THREE.DoubleSide
  });
  const edgeMat = makeMat(0x1687a7, {
    transparent: true,
    opacity: 0.72,
    roughness: 0.16,
    metalness: 0.04,
    emissive: 0x0a4452,
    emissiveIntensity: 0.05
  });
  const highlightMat = makeMat(0xffffff, {
    transparent: true,
    opacity: 0.45,
    roughness: 0.05,
    emissive: 0xffffff,
    emissiveIntensity: 0.16
  });

  if (convex) {
    const body = new THREE.Mesh(new THREE.SphereGeometry(1, 48, 28), glassMat);
    body.scale.set(0.24, 1.02, 0.46);
    body.castShadow = true;
    body.receiveShadow = true;
    lens.add(body);
  } else {
    const shape = new THREE.Shape();
    shape.moveTo(-0.23, -1);
    shape.quadraticCurveTo(0.14, 0, -0.23, 1);
    shape.lineTo(0.23, 1);
    shape.quadraticCurveTo(-0.14, 0, 0.23, -1);
    shape.lineTo(-0.23, -1);
    const bodyGeometry = new THREE.ExtrudeGeometry(shape, {
      depth: 0.22,
      bevelEnabled: true,
      bevelSize: 0.025,
      bevelThickness: 0.025,
      bevelSegments: 8,
      curveSegments: 32
    });
    bodyGeometry.center();
    const body = new THREE.Mesh(bodyGeometry, glassMat);
    body.scale.z = 3.2;
    body.castShadow = true;
    body.receiveShadow = true;
    lens.add(body);
  }

  const rim = new THREE.Mesh(new THREE.TorusGeometry(0.74, 0.022, 12, 80), edgeMat);
  rim.rotation.y = Math.PI / 2;
  rim.scale.set(0.68, 1.34, 1);
  lens.add(rim);

  [-0.11, 0.11].forEach((x) => {
    const surface = new THREE.Mesh(new THREE.TorusGeometry(0.56, 0.009, 8, 64), highlightMat);
    surface.rotation.y = Math.PI / 2;
    surface.scale.set(0.42, 1.42, 0.32);
    surface.position.x = x;
    lens.add(surface);
  });

  const verticalGlint = new THREE.Mesh(new THREE.BoxGeometry(0.018, 1.58, 0.018), highlightMat);
  verticalGlint.position.set(convex ? -0.08 : -0.12, 0.02, 0.24);
  lens.add(verticalGlint);

  return lens;
}

function makeCorrectionSupport() {
  const support = new THREE.Group();
  const metal = makeMat(0x8aa0ae, { metalness: 0.42, roughness: 0.34 });
  const dark = makeMat(0x5f7180, { metalness: 0.48, roughness: 0.32 });

  [-0.48, 0.48].forEach((z) => {
    const upright = new THREE.Mesh(new THREE.BoxGeometry(0.13, 1.72, 0.08), metal);
    upright.position.set(0, 0, z);
    support.add(upright);
  });

  const topBridge = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.08, 1.08), metal);
  topBridge.position.y = 0.82;
  const lowerCradle = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.1, 0.98), dark);
  lowerCradle.position.y = -0.78;
  support.add(topBridge, lowerCradle);

  const convexLens = makeLens(true, 0x69c7d8);
  convexLens.scale.set(0.78, 0.82, 0.88);
  convexLens.position.x = 0.02;

  const concaveLens = makeLens(false, 0x7fc0df);
  concaveLens.scale.set(0.86, 0.82, 0.88);
  concaveLens.position.x = 0.02;

  const emptySlot = new THREE.Mesh(
    new THREE.BoxGeometry(0.05, 1.38, 0.58),
    makeMat(0xe8f1f6, { transparent: true, opacity: 0.34, roughness: 0.28 })
  );

  support.add(convexLens, concaveLens, emptySlot);
  support.userData.convexLens = convexLens;
  support.userData.concaveLens = concaveLens;
  support.userData.emptySlot = emptySlot;
  return support;
}

function updateCorrectionSupport(state) {
  if (!correctionSupport) return;
  correctionSupport.userData.convexLens.visible = state.lensType === 'convex';
  correctionSupport.userData.concaveLens.visible = state.lensType === 'concave';
  correctionSupport.userData.emptySlot.visible = state.lensType === 'none';
}

function makeMount(keyName, label, x, mesh, options = {}) {
  const group = new THREE.Group();
  group.position.set(x, BENCH_RISER_Y, 0);
  const base = new THREE.Mesh(new THREE.BoxGeometry(0.52, MOUNT_BASE_HEIGHT, MOUNT_BASE_DEPTH), makeMat(0xc8d5de, { metalness: 0.12 }));
  base.position.set(0, 0.2, MOUNT_POST_Z);
  const post = new THREE.Mesh(new THREE.CylinderGeometry(0.052, 0.052, MOUNT_POST_HEIGHT, 18), makeMat(0x8095a3, { metalness: 0.45 }));
  post.position.set(0, 0.82, MOUNT_POST_Z);
  mesh.position.y += 1.65;
  group.add(base, post, mesh);
  group.userData.key = keyName;
  group.userData.label = label;
  group.userData.dragInput = options.input ?? null;
  group.userData.dragMin = options.min ?? -32;
  group.userData.dragMax = options.max ?? 32;
  group.traverse((child) => {
    child.userData.parentDrag = group;
  });
  if (options.draggable !== false) {
    const hitArea = new THREE.Mesh(
      new THREE.BoxGeometry(DRAG_PICK_AREA_WIDTH, DRAG_PICK_AREA_HEIGHT, DRAG_PICK_AREA_DEPTH),
      dragHitAreaMaterial
    );
    hitArea.position.set(0, DRAG_PICK_AREA_Y, DRAG_PICK_AREA_Z);
    hitArea.userData.parentDrag = group;
    hitArea.userData.isDragHitArea = true;
    group.add(hitArea);
  }
  scene.add(group);
  if (options.draggable !== false) draggable.push(group);
  componentMap.set(keyName, group);
  return group;
}

function buildScene() {
  addLabBackdrop();
  addInclinedBenchBase();

  const railMat = makeMat(0x7e94a3, { metalness: 0.38 });
  const rail = new THREE.Mesh(new THREE.BoxGeometry(17.6, 0.16, 0.16), railMat);
  rail.position.set(0, BENCH_RISER_Y + 0.1, -0.34);
  const rail2 = rail.clone();
  rail2.position.z = 0.34;
  scene.add(rail, rail2);

  addInclinedRuler();

  const lamp = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.78, 28), makeMat(0xd9e5ec));
  lamp.rotation.z = Math.PI / 2;
  const glass = new THREE.Mesh(new THREE.CircleGeometry(0.22, 28), makeMat(0xffd47a, { transparent: true, opacity: 0.9, emissive: 0xffc04a, emissiveIntensity: 0.35 }));
  glass.position.set(0.41, 0, 0);
  lamp.add(glass);
  makeMount('source', '光源', -7.0, lamp, { draggable: false });

  const object = new THREE.Group();
  const plate = new THREE.Mesh(new THREE.BoxGeometry(0.12, 1.45, 0.92), makeMat(0xf8fbfd, { transparent: true, opacity: 0.72 }));
  const arrow = new THREE.Mesh(new THREE.ConeGeometry(0.18, 0.48, 3), makeMat(0x2b5369));
  arrow.position.y = 0.24;
  arrow.rotation.z = Math.PI;
  object.add(plate, arrow);
  makeMount('object', '物屏', cmToX(Number(objectInput.value)), object, {
    input: objectInput,
    min: -34,
    max: -12
  });

  makeMount('collimator', '双凸透镜', cmToX(Number(collimatorInput.value)), makeLens(true), {
    input: collimatorInput,
    min: -24,
    max: -6
  });

  correctionSupport = makeCorrectionSupport();
  makeMount('slot', '镜片支架', -1.35, correctionSupport, { draggable: false });

  const screen = new THREE.Mesh(new THREE.BoxGeometry(0.1, 1.9, 1.25), makeMat(0xffffff, { transparent: true, opacity: 0.84 }));
  makeMount('screen', '像屏', cmToX(Number(screenInput.value)), screen, {
    input: screenInput,
    min: 14,
    max: 36
  });
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
    const points = ray.map(([x, y, z]) => new THREE.Vector3(x, y + 1.65 + BENCH_RISER_Y, z));
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

function updatePositionReadouts(state) {
  objectValue.textContent = formatRailPosition(state.objectCm);
  collimatorValue.textContent = formatRailPosition(state.collimatorCm);
  screenValue.textContent = formatRailPosition(state.screenCm);
}

function applyRecommendedCorrection() {
  const result = evaluateExperiment({ eyeId: eyeInput.value, screenCm: Number(screenInput.value) });
  lensTypeInput.value = result.recommended.type;
  lensPowerInput.value = result.correction.toFixed(2);
}

function updateExperiment(force = false) {
  const state = readExperimentState();
  const key = experimentKey(state);
  if (!force && key === lastExperimentKey) return;
  lastExperimentKey = key;
  setComponentPositions(state);
  updatePositionReadouts(state);
  updateCorrectionSupport(state);
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

eyeInput.addEventListener('change', () => {
  applyRecommendedCorrection();
  updateExperiment(true);
});

rayFocalInput.addEventListener('input', drawRaySim);

document.getElementById('auto-correct').addEventListener('click', () => {
  applyRecommendedCorrection();
  updateExperiment(true);
});

document.getElementById('record-measurement').addEventListener('click', () => {
  if (eyeInput.value === 'S') return;
  const measuredFocus = EYES[eyeInput.value].focusCm;
  const fittedPower = lensTypeInput.value === 'none' ? Number.NaN : Number(lensPowerInput.value);
  rows = updateRowWithMeasurement(rows, eyeInput.value, measuredFocus, fittedPower);
  editingRowId = '';
  renderExperimentTable();
});

table.addEventListener('click', (event) => {
  const button = event.target.closest('[data-row-action]');
  if (!button) return;
  const eyeId = button.dataset.eyeId;
  const action = button.dataset.rowAction;

  if (action === 'edit') {
    editingRowId = eyeId;
    renderExperimentTable();
    return;
  }

  if (action === 'cancel') {
    editingRowId = '';
    renderExperimentTable();
    return;
  }

  if (action === 'delete') {
    rows = clearRowData(rows, eyeId);
    editingRowId = '';
    renderExperimentTable();
    return;
  }

  if (action === 'save') {
    const row = table.querySelector(`[data-eye-row="${eyeId}"]`);
    const measurements = [0, 1, 2].map((index) => row.querySelector(`[data-field="measurement"][data-index="${index}"]`)?.value ?? '');
    const correctionFit = row.querySelector('[data-field="correctionFit"]')?.value ?? '';
    rows = updateRowData(rows, eyeId, { measurements, correctionFit });
    editingRowId = '';
    renderExperimentTable();
  }
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
      reset: [0, 3.2, 12]
    };
    camera.position.set(...presets[view]);
    controls.target.set(0, 0.7, 0);
    controls.update();
  });
});

const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
const railDragPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -(BENCH_RISER_Y + 0.28));
const dragPoint = new THREE.Vector3();
let activeDrag = null;

function updatePointerFromEvent(event) {
  const rect = renderer.domElement.getBoundingClientRect();
  pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  pointer.y = -(((event.clientY - rect.top) / rect.height) * 2 - 1);
}

function moveActiveDrag(event) {
  if (!activeDrag) return;
  updatePointerFromEvent(event);
  raycaster.setFromCamera(pointer, camera);
  if (!raycaster.ray.intersectPlane(railDragPlane, dragPoint)) return;

  if (activeDrag.userData.dragInput) {
    const cm = railXToSnappedCm(dragPoint.x, activeDrag.userData.dragMin, activeDrag.userData.dragMax);
    activeDrag.userData.dragInput.value = String(cm);
    activeDrag.position.x = cmToX(cm);
  } else {
    activeDrag.position.x = clamp(dragPoint.x, -7.5, 8.5);
  }
  updateExperiment(true);
}

renderer.domElement.addEventListener('pointerdown', (event) => {
  updatePointerFromEvent(event);
  raycaster.setFromCamera(pointer, camera);
  const hits = raycaster.intersectObjects(draggable, true);
  const railX = raycaster.ray.intersectPlane(railDragPlane, dragPoint) ? dragPoint.x : Number.NaN;
  activeDrag = selectDragTargetFromHits(hits, railX);
  if (activeDrag) {
    renderer.domElement.setPointerCapture(event.pointerId);
    controls.enabled = false;
    moveActiveDrag(event);
  }
});

function setObjectFromRayPointer(event) {
  const rect = rayCanvas.getBoundingClientRect();
  const lensX = rect.left + rect.width * 0.52;
  const scale = (rect.width - 90) / 72;
  const cm = snapRailCm((event.clientX - lensX) / scale, -34, -12);
  objectInput.value = String(cm);
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
  moveActiveDrag(event);
});

function endActiveDrag(event) {
  if (activeDrag && renderer.domElement.hasPointerCapture?.(event.pointerId)) {
    renderer.domElement.releasePointerCapture(event.pointerId);
  }
  activeDrag = null;
  controls.enabled = true;
}

window.addEventListener('pointerup', endActiveDrag);
window.addEventListener('pointercancel', endActiveDrag);

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
