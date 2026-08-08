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
  getRulerTickMarks,
  railXToSnappedCm,
  selectDragTargetFromHits,
  selectNearestDragTarget,
  snapRailCm
} from './experiment-interaction.js';
import {
  clearAllRowData,
  clearRowData,
  EYES,
  evaluateExperiment,
  loadRows,
  normalizeLensPower,
  renderDataTable,
  saveRows,
  traceTeachingRays,
  updateRowData,
  updateRowWithMeasurement
} from '../optics.js?v=teaching-lens-4';
import { attachOpticsModel, setOpticsModel } from '../model-assets.js';

const mount = document.getElementById('experiment-canvas');
const modeInput = document.getElementById('mode');
const eyeInput = document.getElementById('eye-id');
const screenInput = document.getElementById('screen-pos');
const collimatorInput = document.getElementById('collimator-pos');
const objectInput = document.getElementById('object-pos');
const screenValue = document.getElementById('screen-pos-value');
const collimatorValue = document.getElementById('collimator-pos-value');
const objectValue = document.getElementById('object-pos-value');
const benchCollimationStatus = document.getElementById('bench-collimation-status');
const benchCollimationLabel = document.getElementById('bench-collimation-label');
const benchCollimationDistance = document.getElementById('bench-collimation-distance');
const benchCollimationFocal = document.getElementById('bench-collimation-focal');
const lensTypeInput = document.getElementById('lens-type');
const lensPowerInput = document.getElementById('lens-power');
const cylinderInput = document.getElementById('cylinder-angle');
const lensPowerValue = document.getElementById('lens-power-value');
const cylinderValue = document.getElementById('cylinder-angle-value');
const lensPowerControl = document.querySelector('[data-lens-control="power"]');
const cylinderControl = document.querySelector('[data-lens-control="cylinder"]');
const readout = document.getElementById('readout');
const table = document.getElementById('experiment-table');
const clearExperimentDataButton = document.getElementById('clear-experiment-data');
const experimentTableStatus = document.getElementById('experiment-table-status');
const detectorCard = document.getElementById('detector-card');
const detectorCardHandle = document.getElementById('detector-card-handle');
const detectorCardToggle = document.getElementById('detector-card-toggle');
const detectorResizeHandle = document.getElementById('detector-resize-handle');
const detectorSpotCanvas = document.getElementById('detector-spot-canvas');
const detectorSpotCtx = detectorSpotCanvas?.getContext('2d');
const labLayout = document.querySelector('.lab-layout');

let rows = loadRows();
let editingRowId = '';
let lastDetectorFrame = null;
let activeEyeId = eyeInput.value;

function renderExperimentTable() {
  renderDataTable(table, rows, { editable: true, editingId: editingRowId });
}

renderExperimentTable();

const scene = new THREE.Scene();
scene.background = new THREE.Color(0xf4f5f6);

const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
camera.position.set(7.6, 3.7, 14.8);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.domElement.setAttribute('role', 'img');
renderer.domElement.setAttribute('aria-label', '模拟眼屈光不正及矫正三维光具座');
renderer.domElement.setAttribute('aria-describedby', 'experiment-canvas-description');
mount.appendChild(renderer.domElement);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.target.set(0, 1.45, 0);
let userAdjustedCamera = false;

function applyDefaultCameraView() {
  const compact = camera.aspect < 1.18;
  if (compact) {
    camera.position.set(5.2, 3.8, 17.1);
    controls.target.set(0, 1.5, 0);
  } else {
    camera.position.set(7.6, 3.7, 14.8);
    controls.target.set(0, 1.45, 0);
  }
  camera.lookAt(controls.target);
  controls.update();
}

controls.addEventListener('start', () => {
  userAdjustedCamera = true;
});

scene.add(new THREE.AmbientLight(0xf7fbff, 1.65));
const key = new THREE.DirectionalLight(0xffffff, 2.2);
key.position.set(4, 7, 6);
key.castShadow = true;
scene.add(key);
scene.add(new THREE.HemisphereLight(0xffffff, 0xdde6ff, 1.1));

const draggable = [];
const componentMap = new Map();
let rayLines = [];
let lastExperimentKey = '';
let correctionSupport = null;
let simulatedEyeSupport = null;

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
  ctx.strokeStyle = 'rgba(104,66,216,0.5)';
  ctx.strokeRect(1, 1, canvas.width - 2, canvas.height - 2);
  ctx.fillStyle = '#101225';
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

  const frameMat = makeMat(0xc6cdf6, { roughness: 0.44, metalness: 0.16 });
  const upperLip = new THREE.Mesh(new THREE.BoxGeometry(18.45, 0.045, 0.045), frameMat);
  upperLip.rotation.x = -BENCH_RULER_TILT_RADIANS;
  upperLip.position.set(0, 0.48, -0.36);
  const lowerLip = upperLip.clone();
  lowerLip.position.set(0, -0.50, 0.56);
  group.add(ruler, upperLip, lowerLip);
  scene.add(group);
}

function addInclinedBenchBase() {
  const baseMat = makeMat(0xd9e1ff, { roughness: 0.5, metalness: 0.08 });
  const shadowMat = makeMat(0x8f9ee0, { roughness: 0.48, metalness: 0.12 });
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

function drawDetectorSpot(spot, result) {
  if (!detectorSpotCanvas || !detectorSpotCtx) return;
  const rect = detectorSpotCanvas.getBoundingClientRect();
  const ratio = Math.max(1, Math.min(window.devicePixelRatio || 1, 2));
  const width = Math.max(220, Math.round(rect.width * ratio));
  const height = Math.max(132, Math.round(rect.height * ratio));
  if (detectorSpotCanvas.width !== width || detectorSpotCanvas.height !== height) {
    detectorSpotCanvas.width = width;
    detectorSpotCanvas.height = height;
  }

  const ctx = detectorSpotCtx;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = '#f8fbfd';
  ctx.fillRect(0, 0, width, height);
  ctx.strokeStyle = 'rgba(104, 66, 216, 0.1)';
  ctx.lineWidth = 1 * ratio;
  for (let x = 0; x <= width; x += 28 * ratio) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, height);
    ctx.stroke();
  }
  for (let y = 0; y <= height; y += 28 * ratio) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
    ctx.stroke();
  }

  if (!spot) return;

  const cx = width / 2;
  const cy = height / 2;
  const maxPixelRadius = Math.min(width, height) * 0.42;
  const focusClarity = result?.clarity ?? spot.focusClarity ?? 'blur';
  const isBestFocus = focusClarity === 'clear'
    && (!result?.eye?.astigmatic || result?.isCorrected);
  // The astigmatism residual already changes the S-eye spot size and shape.
  // Avoid shrinking it a second time after the cylinder lens is installed.
  const focusedScale = isBestFocus && !result?.eye?.astigmatic ? 0.58 : 1;
  const minimumRadius = (isBestFocus ? 4.4 : 8) * ratio;
  const radius = Math.max(
    minimumRadius,
    Math.min(maxPixelRadius, spot.spotRadius * 18 * ratio * focusedScale)
  );
  const rx = radius * Math.max(1, spot.ellipticity ?? 1);
  const ry = radius / Math.max(1, (spot.ellipticity ?? 1) * 0.72);
  const gradient = ctx.createRadialGradient(cx, cy, 1, cx, cy, Math.max(rx, ry));
  gradient.addColorStop(0, `rgba(255, 226, 124, ${0.45 + spot.peakSignal * 0.38})`);
  gradient.addColorStop(0.22, `rgba(240, 167, 58, ${0.28 + spot.peakSignal * 0.32})`);
  gradient.addColorStop(0.68, 'rgba(15, 159, 209, 0.2)');
  gradient.addColorStop(1, 'rgba(15, 159, 209, 0)');

  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(result?.eye?.astigmatic ? (Number(cylinderInput.value) * Math.PI) / 180 : 0);
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.ellipse(0, 0, Math.min(rx, maxPixelRadius), Math.min(ry, maxPixelRadius), 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = focusClarity === 'clear'
    ? '#157a62'
    : focusClarity === 'improve'
      ? '#b57008'
      : '#c23d74';
  ctx.lineWidth = 2 * ratio;
  ctx.stroke();
  ctx.restore();

}

function boardTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 900;
  canvas.height = 420;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#f8fbfd';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.strokeStyle = 'rgba(104,66,216,0.16)';
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
  ctx.fillStyle = '#6842d8';
  ctx.font = '700 60px Microsoft YaHei, sans-serif';
  ctx.fillText('1/f = 1/u + 1/v', 72, 112);
  ctx.fillText('φ = 1/f', 610, 112);
  ctx.strokeStyle = '#0f9fd1';
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.moveTo(150, 302);
  ctx.lineTo(420, 302);
  ctx.lineTo(420, 172);
  ctx.lineTo(150, 302);
  ctx.stroke();
  ctx.font = '700 34px Microsoft YaHei, sans-serif';
  ctx.fillStyle = '#60657f';
  ctx.fillText('视网膜前：近视', 520, 250);
  ctx.fillText('视网膜后：远视', 520, 310);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function addLabBackdrop() {
  const wall = new THREE.Mesh(
    new THREE.PlaneGeometry(19, 9),
    new THREE.MeshBasicMaterial({
      color: 0xf0f1f3,
      side: THREE.DoubleSide
    })
  );
  wall.position.set(0, 3.15, -3.15);
  scene.add(wall);

  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(22, 8),
    makeMat(0xe6edff, { roughness: 0.68 })
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(0, -0.72, 1.1);
  floor.receiveShadow = true;
  scene.add(floor);

  const tableTop = new THREE.Mesh(
    new THREE.BoxGeometry(18, 0.32, 3.2),
    makeMat(0xffffff, { roughness: 0.36, metalness: 0.04 })
  );
  tableTop.position.set(0, -0.33, 0.1);
  tableTop.castShadow = true;
  tableTop.receiveShadow = true;
  scene.add(tableTop);

  const tableEdge = new THREE.Mesh(
    new THREE.BoxGeometry(18.2, 0.12, 3.35),
    makeMat(0xd7def7, { roughness: 0.48 })
  );
  tableEdge.position.set(0, -0.56, 0.1);
  scene.add(tableEdge);

  const boardFrame = new THREE.Mesh(
    new THREE.BoxGeometry(6.4, 3.0, 0.12),
    makeMat(0xbec6f0, { roughness: 0.42, metalness: 0.08 })
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
    makeMat(0xe5eaff, { roughness: 0.48 })
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

function makeLens(convex = true, color = 0x94cfff) {
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
  const edgeMat = makeMat(0x6842d8, {
    transparent: true,
    opacity: 0.72,
    roughness: 0.16,
    metalness: 0.04,
    emissive: 0x28115f,
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

  attachOpticsModel(lens, convex ? 'convexLens' : 'concaveLens', {
    hideFallback: true,
    scale: [1, 1, 1]
  });
  return lens;
}

function makeCylinderLens() {
  const group = new THREE.Group();
  const glass = makeMat(0xb8f0ff, {
    transparent: true,
    opacity: 0.36,
    roughness: 0.06,
    metalness: 0.02,
    emissive: 0x2fb7d4,
    emissiveIntensity: 0.05
  });
  const plate = new THREE.Mesh(new THREE.BoxGeometry(0.08, 1.45, 0.58), glass);
  const curve = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.012, 8, 48), makeMat(0x1687a7, {
    transparent: true,
    opacity: 0.72
  }));
  curve.rotation.y = Math.PI / 2;
  curve.scale.set(0.35, 1.0, 0.72);
  const axis = new THREE.Mesh(new THREE.BoxGeometry(0.03, 1.42, 0.025), makeMat(0x0f9fd1, {
    transparent: true,
    opacity: 0.78,
    emissive: 0x0f9fd1,
    emissiveIntensity: 0.08
  }));
  group.add(plate, curve, axis);
  attachOpticsModel(group, 'cylinderLens', {
    hideFallback: true,
    scale: [1, 1, 1]
  });
  return group;
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

  const convexLens = makeLens(true, 0x94cfff);
  convexLens.scale.set(0.78, 0.82, 0.88);
  convexLens.position.x = 0.02;

  const concaveLens = makeLens(false, 0xa795ff);
  concaveLens.scale.set(0.86, 0.82, 0.88);
  concaveLens.position.x = 0.02;

  const cylinderLens = makeCylinderLens();
  cylinderLens.position.x = -0.05;

  const emptySlot = new THREE.Mesh(
    new THREE.BoxGeometry(0.05, 1.38, 0.58),
    makeMat(0xe8f1f6, { transparent: true, opacity: 0.34, roughness: 0.28 })
  );

  const supportModelSlot = new THREE.Group();
  supportModelSlot.scale.set(0.86, 0.86, 0.86);
  support.add(convexLens, concaveLens, cylinderLens, emptySlot, supportModelSlot);
  support.userData.convexLens = convexLens;
  support.userData.concaveLens = concaveLens;
  support.userData.cylinderLens = cylinderLens;
  support.userData.emptySlot = emptySlot;
  support.userData.supportModelSlot = supportModelSlot;
  attachOpticsModel(supportModelSlot, 'correctionSupport', {
    hideFallback: false,
    position: [0, -0.02, 0],
    scale: [1.1, 1.05, 1.05]
  });
  return support;
}

function updateCorrectionSupport(state) {
  if (!correctionSupport) return;
  const showCylinder = state.lensType === 'cylinder' || state.mode === 'astig' || state.eyeId === 'S';
  correctionSupport.userData.convexLens.visible = state.lensType === 'convex';
  correctionSupport.userData.concaveLens.visible = state.lensType === 'concave';
  correctionSupport.userData.cylinderLens.visible = showCylinder;
  correctionSupport.userData.cylinderLens.rotation.x = (Number(state.cylinderAngle) || 0) * Math.PI / 180;
  correctionSupport.userData.emptySlot.visible = state.lensType === 'none' && !showCylinder;
}

function makeSimulatedEyeSupport() {
  const support = new THREE.Group();
  const metal = makeMat(0x7a8d9a, { metalness: 0.42, roughness: 0.32 });
  const dark = makeMat(0x4f6170, { metalness: 0.48, roughness: 0.3 });

  [-0.54, 0.54].forEach((z) => {
    const side = new THREE.Mesh(new THREE.BoxGeometry(0.12, 1.84, 0.08), metal);
    side.position.set(0, 0, z);
    support.add(side);
  });
  const cap = new THREE.Mesh(new THREE.BoxGeometry(0.17, 0.08, 1.18), metal);
  cap.position.y = 0.88;
  const cradle = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.12, 1.05), dark);
  cradle.position.y = -0.84;

  const modelSlot = new THREE.Group();
  const fallbackLens = makeLens(true, 0x9ad7ff);
  fallbackLens.scale.set(0.82, 0.9, 0.9);
  modelSlot.add(fallbackLens);

  const badge = new THREE.Sprite(labelTexture('D 正视眼'));
  badge.position.set(0.02, 1.25, -0.78);
  badge.scale.set(1.28, 0.39, 1);
  badge.renderOrder = 60;
  badge.userData.text = 'D 正视眼';
  badge.userData.keepWithModel = true;

  support.add(cap, cradle, modelSlot, badge);
  support.userData.modelSlot = modelSlot;
  support.userData.fallbackLens = fallbackLens;
  support.userData.badge = badge;
  return support;
}

function eyeModelKey(eyeId) {
  if (eyeId === 'S') return 'eyeD';
  return `eye${eyeId || 'D'}`;
}

function updateSimulatedEyeSupport(state) {
  if (!simulatedEyeSupport) return;
  const eye = EYES[state.eyeId] || EYES.D;
  const focusOffset = (eye.focusCm - EYES.D.focusCm) / 8;
  const thickness = clamp(0.82 - focusOffset * 0.34, 0.58, 1.08);
  const height = clamp(0.9 + Math.abs(focusOffset) * 0.08, 0.9, 1.02);
  simulatedEyeSupport.userData.fallbackLens.scale.set(thickness, height, height);
  const label = state.eyeId === 'S' ? 'S 散光眼' : `${state.eyeId} ${state.eyeId === 'D' ? '正视眼' : '模拟眼'}`;
  updateLabel(simulatedEyeSupport.userData.badge, label);
  const nextModelKey = eyeModelKey(state.eyeId);
  if (simulatedEyeSupport.userData.currentModelKey !== nextModelKey) {
    simulatedEyeSupport.userData.currentModelKey = nextModelKey;
    setOpticsModel(simulatedEyeSupport.userData.modelSlot, nextModelKey, {
      hideFallback: true,
      scale: [0.92, 0.92, 0.92]
    });
  }
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

function makeModelBackedGroup(modelKey, fallback, options = {}) {
  const group = new THREE.Group();
  group.add(fallback);
  attachOpticsModel(group, modelKey, {
    hideFallback: true,
    ...options
  });
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
  const benchAsset = new THREE.Group();
  benchAsset.position.set(0, BENCH_RISER_Y + 0.05, 0);
  scene.add(benchAsset);
  attachOpticsModel(benchAsset, 'bench', {
    hideFallback: false,
    scale: [1, 1, 1]
  });

  const lamp = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.78, 28), makeMat(0xd9e5ec));
  lamp.rotation.z = Math.PI / 2;
  const glass = new THREE.Mesh(new THREE.CircleGeometry(0.22, 28), makeMat(0xffd47a, { transparent: true, opacity: 0.9, emissive: 0xffc04a, emissiveIntensity: 0.35 }));
  glass.position.set(0.41, 0, 0);
  lamp.add(glass);
  lamp.position.x = -0.41;
  const pointSource = new THREE.Group();
  pointSource.add(lamp);
  makeMount('source', '点光源', cmToX(Number(objectInput.value)), pointSource, {
    input: objectInput,
    min: -34,
    max: -7
  });

  makeMount('collimator', '双凸透镜', cmToX(Number(collimatorInput.value)), makeLens(true), {
    input: collimatorInput,
    min: -24,
    max: -6
  });

  correctionSupport = makeCorrectionSupport();
  makeMount('slot', '镜片支架', -1.35, correctionSupport, { draggable: false });

  simulatedEyeSupport = makeSimulatedEyeSupport();
  makeMount('simEye', '模拟眼光学组', 0, simulatedEyeSupport, { draggable: false });

  const screen = new THREE.Mesh(new THREE.BoxGeometry(0.1, 1.9, 1.25), makeMat(0xffffff, { transparent: true, opacity: 0.84 }));
  makeMount('screen', '像屏', cmToX(Number(screenInput.value)), makeModelBackedGroup('imageScreen', screen), {
    input: screenInput,
    min: 14,
    max: 36
  });
}

buildScene();

const rayMat = new THREE.LineBasicMaterial({ color: 0xf0a73a, transparent: true, opacity: 0.95, depthTest: false });
const correctedMat = new THREE.LineBasicMaterial({ color: 0x0f9fd1, transparent: true, opacity: 0.96, depthTest: false });

function updateRays(resultBundle) {
  rayLines.forEach((line) => {
    scene.remove(line);
    line.geometry.dispose();
  });
  rayLines = [];
  const rayMaterial = resultBundle.collimation?.isCollimated ? correctedMat : rayMat;
  resultBundle.rays.forEach((ray) => {
    const points = ray.map(([x, y, z]) => new THREE.Vector3(x, y + 1.65 + BENCH_RISER_Y, z));
    const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints(points), rayMaterial);
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

function normalizeCollimationPositions(state) {
  const collimatorMin = Number(collimatorInput.min);
  const collimatorMax = Number(collimatorInput.max);
  const sourceMin = Number(objectInput.min);
  const sourceMax = Number(objectInput.max);
  state.collimatorCm = snapRailCm(state.collimatorCm, collimatorMin, collimatorMax);
  state.objectCm = snapRailCm(
    state.objectCm,
    sourceMin,
    Math.min(sourceMax, state.collimatorCm - 1)
  );
  collimatorInput.value = String(state.collimatorCm);
  objectInput.value = String(state.objectCm);
  return state;
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
  componentMap.get('source').position.x = cmToX(state.objectCm);
  componentMap.get('collimator').position.x = cmToX(state.collimatorCm);
  componentMap.get('screen').position.x = cmToX(state.screenCm);
}

function updatePositionReadouts(state) {
  if (document.activeElement !== objectValue) objectValue.value = state.objectCm.toFixed(2);
  if (document.activeElement !== collimatorValue) collimatorValue.value = state.collimatorCm.toFixed(2);
  if (document.activeElement !== screenValue) screenValue.value = state.screenCm.toFixed(2);
}

function updateBenchCollimationStatus(collimation) {
  if (!benchCollimationStatus || !collimation) return;
  const copy = {
    diverging: '光线发散（u < f）',
    parallel: '准直成功（u = f）',
    converging: '光线会聚（u > f）'
  };
  benchCollimationStatus.className = `bench-collimation-status is-${collimation.rayState}`;
  benchCollimationStatus.dataset.state = collimation.rayState;
  benchCollimationStatus.querySelector('.bench-collimation-mark').textContent = collimation.isCollimated ? '✓' : '×';
  benchCollimationLabel.textContent = copy[collimation.rayState];
  benchCollimationDistance.textContent = collimation.distanceCm.toFixed(2);
  benchCollimationFocal.textContent = collimation.focalLengthCm.toFixed(2);
  mount.dataset.collimationState = collimation.rayState;
}

function syncPositionNumberToRange(numberInput, rangeInput) {
  const value = Number(numberInput.value);
  if (!Number.isFinite(value) || numberInput.value.trim() === '') {
    numberInput.value = Number(rangeInput.value).toFixed(2);
    return;
  }
  const min = Number(rangeInput.min);
  const max = Number(rangeInput.max);
  const step = Number(rangeInput.step) || 0.05;
  const snapped = snapRailCm(value, min, max, step);
  numberInput.value = snapped.toFixed(2);
  rangeInput.value = String(snapped);
  rangeInput.dispatchEvent(new Event('input', { bubbles: true }));
  rangeInput.dispatchEvent(new Event('change', { bubbles: true }));
}

function syncLensNumberToRange(numberInput, rangeInput, digits = 0) {
  const value = Number(numberInput.value);
  if (!Number.isFinite(value) || numberInput.value.trim() === '') {
    numberInput.value = Number(rangeInput.value).toFixed(digits);
    return;
  }
  const min = Number(rangeInput.min);
  const max = Number(rangeInput.max);
  const step = Number(rangeInput.step) || 1;
  const snapped = clamp(Math.round(value / step) * step, min, max);
  numberInput.value = snapped.toFixed(digits);
  rangeInput.value = String(snapped);
  rangeInput.dispatchEvent(new Event('input', { bubbles: true }));
  rangeInput.dispatchEvent(new Event('change', { bubbles: true }));
}

function updateLensValueReadouts() {
  if (lensPowerValue && document.activeElement !== lensPowerValue) {
    lensPowerValue.value = Number(lensPowerInput.value).toFixed(2);
  }
  if (cylinderValue && document.activeElement !== cylinderValue) {
    cylinderValue.value = String(Math.round(Number(cylinderInput.value)));
  }
}

function resetCorrectionSelection() {
  lensTypeInput.value = 'none';
  lensPowerInput.value = '0';
  cylinderInput.value = cylinderInput.defaultValue || '20';
  updateLensValueReadouts();
  updateLensControls();
}

function applyRecommendedCorrection() {
  const result = evaluateExperiment({ eyeId: eyeInput.value, screenCm: Number(screenInput.value) });
  lensTypeInput.value = result.recommended.type;
  lensPowerInput.value = Math.abs(result.correction).toFixed(2);
  updateLensValueReadouts();
}

function updateLensControls() {
  const lensType = lensTypeInput.value;
  const usesSphericalPower = lensType === 'concave' || lensType === 'convex';
  const usesCylinder = lensType === 'cylinder';
  if (lensPowerControl) lensPowerControl.classList.toggle('is-disabled', !usesSphericalPower);
  if (cylinderControl) cylinderControl.classList.toggle('is-disabled', !usesCylinder);
  [lensPowerInput, lensPowerValue].forEach((input) => {
    if (input) input.disabled = !usesSphericalPower;
  });
  [cylinderInput, cylinderValue].forEach((input) => {
    if (input) input.disabled = !usesCylinder;
  });
}

function updateExperiment(force = false) {
  const state = normalizeCollimationPositions(readExperimentState());
  const key = experimentKey(state);
  if (!force && key === lastExperimentKey) return;
  lastExperimentKey = key;
  setComponentPositions(state);
  updatePositionReadouts(state);
  updateLensValueReadouts();
  updateLensControls();
  updateCorrectionSupport(state);
  updateSimulatedEyeSupport(state);
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
  updateBenchCollimationStatus(bundle.collimation);
  const result = bundle.result;
  lastDetectorFrame = { spot: bundle.spot, result };
  drawDetectorSpot(bundle.spot, result);
  const focus = result.focusCm.toFixed(2);
  const correction = result.correction.toFixed(2);
  const retina = result.isCorrected ? '焦点接近视网膜' : result.retinaError < 0 ? '焦点在视网膜前' : '焦点在视网膜后';
  const cylinderReadout = state.eyeId === 'S' && state.lensType === 'cylinder'
    ? `<span>柱面镜角度：<strong>${cylinderInput.value}°</strong></span>`
    : '';
  readout.innerHTML = `
    <span>当前模拟眼：<strong>${eyeInput.value}</strong>，${result.type}，${result.eye.note}</span>
    <span>当前焦点位置：<strong>${focus} cm</strong></span>
    <span>视网膜判断：<strong>${retina}</strong></span>
    <span>推荐矫正：<strong>${result.recommended.label}</strong>，计算焦度 ${correction} D</span>
    ${cylinderReadout}
  `;
}

[modeInput, screenInput, collimatorInput, objectInput, lensTypeInput, lensPowerInput, cylinderInput].forEach((input) => {
  input.addEventListener('input', () => updateExperiment(true));
});

function handleEyeSelection() {
  const nextEyeId = eyeInput.value;
  if (nextEyeId !== activeEyeId) {
    activeEyeId = nextEyeId;
    resetCorrectionSelection();
  }
  updateExperiment(true);
}

eyeInput.addEventListener('input', handleEyeSelection);

[
  [screenValue, screenInput],
  [collimatorValue, collimatorInput],
  [objectValue, objectInput]
].forEach(([numberInput, rangeInput]) => {
  numberInput.addEventListener('focus', () => {
    window.requestAnimationFrame(() => numberInput.select());
  });
  numberInput.addEventListener('change', () => syncPositionNumberToRange(numberInput, rangeInput));
  numberInput.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      numberInput.blur();
    } else if (event.key === 'Escape') {
      event.preventDefault();
      numberInput.value = Number(rangeInput.value).toFixed(2);
      numberInput.blur();
    }
  });
});

[
  [lensPowerValue, lensPowerInput, 2],
  [cylinderValue, cylinderInput, 0]
].forEach(([numberInput, rangeInput, digits]) => {
  numberInput.addEventListener('focus', () => {
    window.requestAnimationFrame(() => numberInput.select());
  });
  numberInput.addEventListener('change', () => syncLensNumberToRange(numberInput, rangeInput, digits));
  numberInput.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      numberInput.blur();
    } else if (event.key === 'Escape') {
      event.preventDefault();
      numberInput.value = Number(rangeInput.value).toFixed(digits);
      numberInput.blur();
    }
  });
});

eyeInput.addEventListener('change', handleEyeSelection);

document.getElementById('auto-correct').addEventListener('click', () => {
  applyRecommendedCorrection();
  updateExperiment(true);
});

document.addEventListener('experiment-retina-measurement-recorded', (event) => {
  const eyeId = event.detail?.eyeId;
  const measuredFocus = Number(event.detail?.position);
  if (eyeId === 'S' || !EYES[eyeId] || !Number.isFinite(measuredFocus)) return;
  const fittedPower = lensTypeInput.value === 'none'
    ? Number.NaN
    : normalizeLensPower(lensTypeInput.value, lensPowerInput.value);
  rows = updateRowWithMeasurement(rows, eyeId, measuredFocus, fittedPower);
  editingRowId = '';
  renderExperimentTable();
});

document.addEventListener('experiment-lens-trial-recorded', (event) => {
  const eyeId = event.detail?.eyeId;
  const row = rows.find((item) => item.id === eyeId);
  if (!row) return;
  const lensPower = Number(event.detail?.lensPower);
  rows = updateRowData(rows, eyeId, {
    measurements: row.measurements,
    correctionFit: Number.isFinite(lensPower) ? lensPower : Number.NaN
  });
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

clearExperimentDataButton.addEventListener('click', () => {
  const confirmed = window.confirm('确定清除表格中 A–G 的全部实验数据吗？此操作不可撤销。');
  if (!confirmed) return;
  rows = clearAllRowData(rows);
  editingRowId = '';
  renderExperimentTable();
  experimentTableStatus.textContent = '已清除 A–G 的全部实验数据。';
});

document.getElementById('save-report').addEventListener('click', () => {
  saveRows(rows);
  readout.insertAdjacentHTML('beforeend', '<span><strong>已保存：</strong>实验数据可在报告页查看。</span>');
});

document.querySelectorAll('[data-view]').forEach((button) => {
  button.addEventListener('click', () => {
    userAdjustedCamera = false;
    applyDefaultCameraView();
    if (button.dataset.view === 'reset') resetDetectorCard();
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
    let dragMin = activeDrag.userData.dragMin;
    let dragMax = activeDrag.userData.dragMax;
    if (activeDrag.userData.key === 'source') {
      dragMax = Math.min(dragMax, Number(collimatorInput.value) - 1);
    }
    if (activeDrag.userData.key === 'collimator') {
      dragMin = Math.max(dragMin, Number(objectInput.value) + 1);
    }
    const cm = railXToSnappedCm(dragPoint.x, dragMin, dragMax);
    const dragInput = activeDrag.userData.dragInput;
    const changed = dragInput.value !== String(cm);
    dragInput.value = String(cm);
    activeDrag.position.x = cmToX(cm);
    if (changed) {
      activeDrag.userData.dragChanged = true;
      dragInput.dispatchEvent(new Event('input', { bubbles: true }));
    }
  } else {
    activeDrag.position.x = clamp(dragPoint.x, -7.5, 8.5);
  }
  if (!activeDrag.userData.dragInput) updateExperiment(true);
}

renderer.domElement.addEventListener('pointerdown', (event) => {
  updatePointerFromEvent(event);
  raycaster.setFromCamera(pointer, camera);
  const hits = raycaster.intersectObjects(draggable, true);
  const railX = raycaster.ray.intersectPlane(railDragPlane, dragPoint) ? dragPoint.x : Number.NaN;
  activeDrag = selectDragTargetFromHits(hits, railX) || selectNearestDragTarget(draggable, railX);
  if (activeDrag) {
    activeDrag.userData.dragChanged = false;
    event.preventDefault();
    renderer.domElement.setPointerCapture(event.pointerId);
    controls.enabled = false;
    moveActiveDrag(event);
  }
});

window.addEventListener('pointermove', (event) => {
  moveActiveDrag(event);
});

function endActiveDrag(event) {
  const dragInput = activeDrag?.userData.dragInput;
  const dragChanged = activeDrag?.userData.dragChanged === true;
  if (activeDrag && renderer.domElement.hasPointerCapture?.(event.pointerId)) {
    renderer.domElement.releasePointerCapture(event.pointerId);
  }
  activeDrag = null;
  controls.enabled = true;
  if (dragInput && dragChanged) dragInput.dispatchEvent(new Event('change', { bubbles: true }));
}

window.addEventListener('pointerup', endActiveDrag);
window.addEventListener('pointercancel', endActiveDrag);

function clampDetectorCardPosition(left, top) {
  if (!detectorCard) return;
  const edge = 8;
  const maxLeft = Math.max(edge, mount.clientWidth - detectorCard.offsetWidth - edge);
  const maxTop = Math.max(edge, mount.clientHeight - detectorCard.offsetHeight - edge);
  detectorCard.style.left = `${clamp(left, edge, maxLeft)}px`;
  detectorCard.style.top = `${clamp(top, edge, maxTop)}px`;
  detectorCard.style.right = 'auto';
  detectorCard.style.bottom = 'auto';
}

function setDetectorCardWidth(width) {
  if (!detectorCard) return;
  const edge = 8;
  const maximum = Math.max(180, Math.min(440, mount.clientWidth - edge * 2));
  const minimum = Math.min(210, maximum);
  detectorCard.style.width = `${clamp(width, minimum, maximum)}px`;
  detectorCard.dataset.resized = 'true';
  clampDetectorCardPosition(detectorCard.offsetLeft, detectorCard.offsetTop);
}

function setDetectorCardCollapsed(collapsed) {
  if (!detectorCard || !detectorCardToggle) return;
  detectorCard.classList.toggle('is-collapsed', collapsed);
  detectorCardToggle.setAttribute('aria-expanded', String(!collapsed));
  detectorCardToggle.setAttribute('aria-label', collapsed ? '展开光斑显示' : '收起光斑显示');
  detectorCardToggle.title = collapsed ? '展开光斑显示' : '收起光斑显示';
  detectorCardToggle.textContent = collapsed ? '⌄' : '⌃';
  requestAnimationFrame(() => {
    clampDetectorCardPosition(detectorCard.offsetLeft, detectorCard.offsetTop);
    if (!collapsed && lastDetectorFrame) {
      drawDetectorSpot(lastDetectorFrame.spot, lastDetectorFrame.result);
    }
  });
}

function resetDetectorCard() {
  if (!detectorCard) return;
  delete detectorCard.dataset.dragged;
  delete detectorCard.dataset.resized;
  detectorCard.classList.remove('is-dragging', 'is-resizing');
  detectorCard.style.removeProperty('left');
  detectorCard.style.removeProperty('top');
  detectorCard.style.removeProperty('right');
  detectorCard.style.removeProperty('bottom');
  detectorCard.style.removeProperty('width');
  setDetectorCardCollapsed(true);
}

function initializeDetectorCardDrag() {
  if (!detectorCard || !detectorCardHandle) return;

  let dragOffsetX = 0;
  let dragOffsetY = 0;
  let dragging = false;

  detectorCardHandle.addEventListener('pointerdown', (event) => {
    if (event.button !== 0 || event.target.closest('button')) return;
    const mountRect = mount.getBoundingClientRect();
    const cardRect = detectorCard.getBoundingClientRect();
    dragging = true;
    dragOffsetX = event.clientX - cardRect.left;
    dragOffsetY = event.clientY - cardRect.top;
    detectorCard.dataset.dragged = 'true';
    detectorCard.classList.add('is-dragging');
    clampDetectorCardPosition(cardRect.left - mountRect.left, cardRect.top - mountRect.top);
    detectorCardHandle.setPointerCapture(event.pointerId);
    event.preventDefault();
    event.stopPropagation();
  });

  window.addEventListener('pointermove', (event) => {
    if (!dragging) return;
    const mountRect = mount.getBoundingClientRect();
    clampDetectorCardPosition(
      event.clientX - mountRect.left - dragOffsetX,
      event.clientY - mountRect.top - dragOffsetY
    );
    event.preventDefault();
  });

  function stopDetectorCardDrag(event) {
    if (!dragging) return;
    dragging = false;
    detectorCard.classList.remove('is-dragging');
    if (detectorCardHandle.hasPointerCapture?.(event.pointerId)) {
      detectorCardHandle.releasePointerCapture(event.pointerId);
    }
  }

  window.addEventListener('pointerup', stopDetectorCardDrag);
  window.addEventListener('pointercancel', stopDetectorCardDrag);
  detectorCardHandle.addEventListener('keydown', (event) => {
    if (event.target.closest('button')) return;
    const movement = event.shiftKey ? 12 : 4;
    const direction = {
      ArrowLeft: [-movement, 0],
      ArrowRight: [movement, 0],
      ArrowUp: [0, -movement],
      ArrowDown: [0, movement]
    }[event.key];
    if (!direction) return;
    const mountRect = mount.getBoundingClientRect();
    const cardRect = detectorCard.getBoundingClientRect();
    detectorCard.dataset.dragged = 'true';
    clampDetectorCardPosition(
      cardRect.left - mountRect.left + direction[0],
      cardRect.top - mountRect.top + direction[1]
    );
    event.preventDefault();
  });

  detectorCardToggle?.addEventListener('click', (event) => {
    setDetectorCardCollapsed(!detectorCard.classList.contains('is-collapsed'));
    event.stopPropagation();
  });

  if (detectorResizeHandle) {
    let resizing = false;
    let resizeStartX = 0;
    let resizeStartWidth = 0;

    detectorResizeHandle.addEventListener('pointerdown', (event) => {
      if (event.button !== 0 || detectorCard.classList.contains('is-collapsed')) return;
      resizing = true;
      resizeStartX = event.clientX;
      resizeStartWidth = detectorCard.getBoundingClientRect().width;
      detectorCard.classList.add('is-resizing');
      detectorResizeHandle.setPointerCapture(event.pointerId);
      event.preventDefault();
      event.stopPropagation();
    });

    window.addEventListener('pointermove', (event) => {
      if (!resizing) return;
      setDetectorCardWidth(resizeStartWidth + event.clientX - resizeStartX);
      event.preventDefault();
    });

    function stopDetectorResize(event) {
      if (!resizing) return;
      resizing = false;
      detectorCard.classList.remove('is-resizing');
      if (detectorResizeHandle.hasPointerCapture?.(event.pointerId)) {
        detectorResizeHandle.releasePointerCapture(event.pointerId);
      }
    }

    window.addEventListener('pointerup', stopDetectorResize);
    window.addEventListener('pointercancel', stopDetectorResize);
    detectorResizeHandle.addEventListener('keydown', (event) => {
      if (!['ArrowLeft', 'ArrowRight'].includes(event.key)) return;
      const direction = event.key === 'ArrowRight' ? 1 : -1;
      setDetectorCardWidth(detectorCard.getBoundingClientRect().width + direction * (event.shiftKey ? 24 : 8));
      event.preventDefault();
    });
  }
}

initializeDetectorCardDrag();
resetDetectorCard();

function syncLabPanelToCanvas() {
  if (!labLayout || !mount) return;
  const panel = labLayout.querySelector('.lab-panel');
  if (!panel) return;
  const panelRect = panel.getBoundingClientRect();
  const canvasRect = mount.getBoundingClientRect();
  const currentPanelOffset = Number.parseFloat(window.getComputedStyle(panel).marginTop) || 0;
  const panelBaseTop = panelRect.top - currentPanelOffset;
  labLayout.style.setProperty('--lab-panel-canvas-offset', `${Math.max(0, canvasRect.top - panelBaseTop)}px`);
  labLayout.style.setProperty('--experiment-canvas-height', `${Math.max(1, canvasRect.height)}px`);
}

function resize() {
  const rect = mount.getBoundingClientRect();
  renderer.setSize(rect.width, rect.height);
  camera.aspect = rect.width / rect.height;
  camera.updateProjectionMatrix();
  if (!userAdjustedCamera) applyDefaultCameraView();
  syncLabPanelToCanvas();
  if (detectorCard?.dataset.resized === 'true') {
    setDetectorCardWidth(detectorCard.getBoundingClientRect().width);
  }
  if (detectorCard?.dataset.dragged === 'true') {
    clampDetectorCardPosition(detectorCard.offsetLeft, detectorCard.offsetTop);
  }
}

window.addEventListener('resize', () => {
  resize();
});

resize();
updateExperiment(true);

if (window.ResizeObserver) {
  const layoutObserver = new ResizeObserver(() => syncLabPanelToCanvas());
  layoutObserver.observe(mount);
  if (detectorSpotCanvas) {
    const detectorObserver = new ResizeObserver(() => {
      if (!detectorCard?.classList.contains('is-collapsed') && lastDetectorFrame) {
        drawDetectorSpot(lastDetectorFrame.spot, lastDetectorFrame.result);
      }
    });
    detectorObserver.observe(detectorSpotCanvas);
  }
}

function animate() {
  updateExperiment();
  controls.update();
  renderer.render(scene, camera);
  requestAnimationFrame(animate);
}

animate();
