import * as THREE from '../vendor/three.module.js';
import { OrbitControls } from '../vendor/OrbitControls.js';

document.title = '眼球 3D 结构模型';

const mount = document.getElementById('eye-canvas');
const info = document.getElementById('eye-info');

const scene = new THREE.Scene();
scene.background = new THREE.Color(0xf4f8fb);

const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
camera.position.set(4.8, 3.2, 6.4);

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
mount.appendChild(renderer.domElement);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.target.set(0.15, 0, 0);

scene.add(new THREE.AmbientLight(0xf4fbff, 1.55));
const key = new THREE.DirectionalLight(0xffffff, 2.2);
key.position.set(4.8, 5.4, 6.2);
scene.add(key);
scene.add(new THREE.HemisphereLight(0xffffff, 0xcad8e2, 1.0));

const root = new THREE.Group();
scene.add(root);

const parts = new Map();
const clickable = [];
const rayLines = [];
let modelMode = 'whole';
let showRays = false;
let activePartId = '';
let lockedPartId = '';

const partDetails = {
  cornea: {
    name: '角膜',
    function: '眼球最前方的透明曲面，是光线进入眼内后的第一道屈光界面。',
    role: '提供主要屈光力，并与泪膜一起形成清晰、稳定的入射光路。'
  },
  iris: {
    name: '虹膜',
    function: '含有环形和放射状肌肉，负责改变瞳孔大小。',
    role: '根据环境亮度调节入眼光量，保护视网膜并改善成像质量。'
  },
  pupil: {
    name: '瞳孔',
    function: '位于虹膜中央，是光线进入眼内的开口。',
    role: '限制光束直径，影响景深、亮度和像差。'
  },
  lens: {
    name: '晶状体',
    function: '透明且有弹性的双凸透镜，可通过睫状肌调节形状。',
    role: '改变焦距，使近处和远处物体都能在视网膜附近成像。'
  },
  vitreous: {
    name: '玻璃体',
    function: '填充晶状体后方的大部分眼内空间，呈透明凝胶状。',
    role: '维持眼球形态，并为光线到达视网膜提供透明通道。'
  },
  retina: {
    name: '视网膜',
    function: '眼球后部的感光神经层，含视杆和视锥细胞。',
    role: '接收成像光斑并将光信号转化为神经信号。'
  },
  sclera: {
    name: '巩膜',
    function: '眼球坚韧的白色外层，包围和保护内部组织。',
    role: '提供机械支撑，也是眼外肌附着并控制眼球运动的结构基础。'
  },
  opticNerve: {
    name: '视神经',
    function: '由视网膜神经节细胞轴突汇集而成。',
    role: '把视网膜形成的视觉信号传向大脑视觉中枢。'
  }
};

const modeDetails = {
  whole: {
    title: '整体观察模式',
    body: '各结构按眼球解剖位置组装，可观察角膜、晶状体、玻璃体、视网膜与视神经的空间关系。'
  },
  section: {
    title: '剖面结构模式',
    body: '外层巩膜、视网膜与内部屈光介质叠加显示，便于观察光路穿过眼球的位置。'
  },
  explode: {
    title: '结构拆解模式',
    body: '角膜、虹膜、瞳孔、晶状体、玻璃体、视网膜、巩膜和视神经沿光路展开。'
  }
};

function createInfoLine(label, text) {
  const row = document.createElement('p');
  const strong = document.createElement('strong');
  strong.textContent = label;
  row.append(strong, document.createTextNode(text));
  return row;
}

function renderModeInfo() {
  const detail = modeDetails[modelMode] || modeDetails.whole;
  info.replaceChildren();
  const eyebrow = document.createElement('span');
  eyebrow.className = 'eye-info-eyebrow';
  eyebrow.textContent = '当前视图';
  const title = document.createElement('h3');
  title.textContent = detail.title;
  const body = document.createElement('p');
  body.textContent = detail.body;
  info.append(eyebrow, title, body);
}

function renderPartInfo(record, locked = false) {
  const detail = partDetails[record.id];
  if (!detail) return;
  info.replaceChildren();
  const eyebrow = document.createElement('span');
  eyebrow.className = 'eye-info-eyebrow';
  eyebrow.textContent = locked ? '已锁定结构' : '当前结构';
  const title = document.createElement('h3');
  title.textContent = detail.name;
  info.append(
    eyebrow,
    title,
    createInfoLine('功能：', detail.function),
    createInfoLine('作用：', detail.role)
  );
}

function addLabBackdrop() {
  const wall = new THREE.Mesh(
    new THREE.PlaneGeometry(10, 6),
    new THREE.MeshStandardMaterial({ color: 0xe8eff4, roughness: 0.78 })
  );
  wall.position.set(0, 1.9, -2.7);
  scene.add(wall);

  const reference = new THREE.Mesh(
    new THREE.BoxGeometry(3.4, 1.55, 0.08),
    new THREE.MeshStandardMaterial({ color: 0xf8fbfd, roughness: 0.82 })
  );
  reference.position.set(-2.25, 2.7, -2.55);
  scene.add(reference);

  const tableTop = new THREE.Mesh(
    new THREE.BoxGeometry(9.5, 0.28, 2.5),
    new THREE.MeshStandardMaterial({ color: 0xf7fafc, roughness: 0.42, metalness: 0.04 })
  );
  tableTop.position.set(0, -1.48, 0.65);
  scene.add(tableTop);

  const lampPanel = new THREE.Mesh(
    new THREE.BoxGeometry(1.65, 0.05, 0.52),
    new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xffffff, emissiveIntensity: 0.78 })
  );
  lampPanel.position.set(0, 4.65, -0.9);
  scene.add(lampPanel);
}

function mat(color, options = {}) {
  const opacity = options.opacity ?? 1;
  return new THREE.MeshPhysicalMaterial({
    color,
    roughness: options.roughness ?? 0.32,
    metalness: options.metalness ?? 0.02,
    transparent: opacity < 1,
    opacity,
    depthWrite: opacity > 0.55,
    side: THREE.DoubleSide,
    emissive: options.emissive ?? 0x000000,
    emissiveIntensity: options.emissiveIntensity ?? 0
  });
}

function labelTexture(text) {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 76;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = 'rgba(255,255,255,0.9)';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.strokeStyle = 'rgba(22,135,167,0.55)';
  ctx.strokeRect(2, 2, canvas.width - 4, canvas.height - 4);
  ctx.fillStyle = '#162532';
  ctx.font = '700 28px Microsoft YaHei, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, canvas.width / 2, canvas.height / 2 + 1);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function addLabel(group, text, position, scale = 0.42) {
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({
    map: labelTexture(text),
    transparent: true,
    depthTest: false
  }));
  sprite.position.copy(position);
  sprite.scale.set(scale * 2.65, scale * 0.78, 1);
  sprite.renderOrder = 100;
  sprite.userData.ignoreRaycast = true;
  group.add(sprite);
}

function registerPart(id, name, home, exploded, section, build) {
  const group = new THREE.Group();
  group.position.copy(home);
  build(group);
  const record = { id, name, home, exploded, section, group };
  group.userData.partRecord = record;
  group.traverse((child) => {
    if (child.isMesh && !child.userData.ignoreRaycast) {
      child.userData.partRecord = record;
      clickable.push(child);
    }
  });
  root.add(group);
  parts.set(id, record);
  return group;
}

function addCircle(group, radius, color, opacity = 1, x = 0) {
  const mesh = new THREE.Mesh(
    new THREE.CircleGeometry(radius, 64),
    mat(color, { opacity, roughness: 0.38 })
  );
  mesh.rotation.y = Math.PI / 2;
  mesh.position.x = x;
  group.add(mesh);
  return mesh;
}

function addRing(group, inner, outer, color, opacity = 1, x = 0) {
  const mesh = new THREE.Mesh(
    new THREE.RingGeometry(inner, outer, 96),
    mat(color, { opacity, roughness: 0.42 })
  );
  mesh.rotation.y = Math.PI / 2;
  mesh.position.x = x;
  group.add(mesh);
  return mesh;
}

function addTube(group, points, radius, color, opacity = 1) {
  const curve = new THREE.CatmullRomCurve3(points);
  const mesh = new THREE.Mesh(
    new THREE.TubeGeometry(curve, 24, radius, 8, false),
    mat(color, { opacity, roughness: 0.24 })
  );
  group.add(mesh);
  return mesh;
}

function addRetinaVessels(group) {
  const starts = [
    new THREE.Vector3(1.02, -0.18, 0.02),
    new THREE.Vector3(1.02, -0.18, -0.02)
  ];
  const targets = [
    new THREE.Vector3(0.2, 0.74, 0.04),
    new THREE.Vector3(0.0, 0.4, 0.44),
    new THREE.Vector3(0.08, -0.58, 0.18),
    new THREE.Vector3(0.28, -0.38, -0.48),
    new THREE.Vector3(0.48, 0.16, -0.62),
    new THREE.Vector3(0.72, 0.58, 0.22)
  ];
  targets.forEach((target, index) => {
    const start = starts[index % starts.length];
    const mid = new THREE.Vector3((start.x + target.x) / 2, (start.y + target.y) / 2 + 0.15, (start.z + target.z) / 2);
    addTube(group, [start, mid, target], index % 2 ? 0.006 : 0.008, index % 2 ? 0x376b8f : 0xb64b5c, 0.86);
  });
}

function addLightRay(points, color = 0xf0b33a) {
  const line = new THREE.Line(
    new THREE.BufferGeometry().setFromPoints(points),
    new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.92, depthTest: false })
  );
  line.renderOrder = 120;
  rayLines.push(line);
  root.add(line);
}

addLabBackdrop();

registerPart('cornea', '角膜', new THREE.Vector3(-1.72, 0, 0), new THREE.Vector3(-3.75, 0.28, 0), new THREE.Vector3(-1.72, 0, 0.08), (group) => {
  const cornea = new THREE.Mesh(new THREE.SphereGeometry(0.72, 64, 32), mat(0x7de7ff, { opacity: 0.34, roughness: 0.08 }));
  cornea.scale.set(0.34, 1.08, 1.08);
  group.add(cornea);
  addLabel(group, '角膜', new THREE.Vector3(-0.05, 1.32, 0));
});

registerPart('iris', '虹膜', new THREE.Vector3(-1.18, 0, 0), new THREE.Vector3(-2.45, 0.16, 0), new THREE.Vector3(-1.18, 0, 0.14), (group) => {
  addRing(group, 0.24, 0.78, 0x5f8f4d, 0.88);
  addLabel(group, '虹膜', new THREE.Vector3(-0.03, 1.08, 0));
});

registerPart('pupil', '瞳孔', new THREE.Vector3(-1.17, 0, 0.012), new THREE.Vector3(-2.45, -0.58, 0), new THREE.Vector3(-1.17, 0, 0.2), (group) => {
  addCircle(group, 0.25, 0x162532, 1, 0.02);
  addLabel(group, '瞳孔', new THREE.Vector3(0.02, -0.72, 0));
});

registerPart('lens', '晶状体', new THREE.Vector3(-0.78, 0, 0), new THREE.Vector3(-1.45, 0.82, 0), new THREE.Vector3(-0.78, 0, 0.1), (group) => {
  const lens = new THREE.Mesh(new THREE.SphereGeometry(0.82, 64, 32), mat(0xffd36b, { opacity: 0.5, roughness: 0.05 }));
  lens.scale.set(0.32, 1.0, 1.0);
  group.add(lens);
  addLabel(group, '晶状体', new THREE.Vector3(0.04, 1.25, 0));
});

registerPart('vitreous', '玻璃体', new THREE.Vector3(0.25, 0, 0), new THREE.Vector3(0.25, -0.78, 0), new THREE.Vector3(0.25, 0, 0.04), (group) => {
  const body = new THREE.Mesh(new THREE.SphereGeometry(1.33, 64, 32), mat(0x89a7ff, { opacity: 0.18, roughness: 0.02 }));
  body.scale.set(1.15, 0.92, 0.92);
  group.add(body);
  addLabel(group, '玻璃体', new THREE.Vector3(0.05, 1.33, 0));
});

registerPart('retina', '视网膜', new THREE.Vector3(0.33, 0, 0), new THREE.Vector3(1.45, 0.32, 0), new THREE.Vector3(0.33, 0, -0.04), (group) => {
  const retina = new THREE.Mesh(new THREE.SphereGeometry(1.47, 64, 32), mat(0xff7a91, { opacity: 0.28, roughness: 0.58 }));
  retina.scale.set(1.18, 0.86, 0.86);
  group.add(retina);
  addRetinaVessels(group);
  addLabel(group, '视网膜', new THREE.Vector3(0.18, 1.5, 0));
});

registerPart('sclera', '巩膜', new THREE.Vector3(0.38, 0, 0), new THREE.Vector3(2.55, 0.2, 0), new THREE.Vector3(0.38, 0, -0.2), (group) => {
  const shell = new THREE.Mesh(new THREE.SphereGeometry(1.64, 64, 32), mat(0xf4f0e7, { opacity: 0.18, roughness: 0.62 }));
  shell.scale.set(1.2, 0.88, 0.88);
  group.add(shell);
  addLabel(group, '巩膜', new THREE.Vector3(0.18, 1.72, 0));
});

registerPart('opticNerve', '视神经', new THREE.Vector3(2.15, -0.14, 0), new THREE.Vector3(3.82, -0.14, 0), new THREE.Vector3(2.15, -0.14, -0.04), (group) => {
  const nerve = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.26, 1.55, 28), mat(0xf5c06a, { opacity: 0.78, roughness: 0.42 }));
  nerve.rotation.z = Math.PI / 2;
  nerve.position.x = 0.48;
  group.add(nerve);
  addLabel(group, '视神经', new THREE.Vector3(0.65, -0.52, 0));
});

function clearRays() {
  rayLines.forEach((line) => {
    root.remove(line);
    line.geometry.dispose();
    line.material.dispose();
  });
  rayLines.length = 0;
}

function updateRays() {
  clearRays();
  if (!showRays) return;
  [-0.42, 0, 0.42].forEach((y, index) => {
    addLightRay([
      new THREE.Vector3(-4.8, y, 0),
      new THREE.Vector3(-1.72, y * 0.72, 0),
      new THREE.Vector3(-1.17, y * 0.35, 0),
      new THREE.Vector3(-0.78, y * 0.18, 0),
      new THREE.Vector3(1.45, index === 1 ? 0.36 : -0.22, 0)
    ], index === 1 ? 0x1687a7 : 0xf0b33a);
  });
}

function setCameraForMode(nextMode) {
  if (nextMode === 'section') {
    camera.position.set(0.05, 0.35, 7.4);
    controls.target.set(0.12, 0, 0);
  } else if (nextMode === 'explode') {
    camera.position.set(0.15, 0.55, 8.7);
    controls.target.set(0.08, 0, 0);
  } else {
    camera.position.set(4.8, 3.2, 6.4);
    controls.target.set(0.15, 0, 0);
  }
  controls.update();
}

function setMode(nextMode) {
  modelMode = nextMode;
  lockedPartId = '';
  activePartId = '';
  renderModeInfo();
  setCameraForMode(nextMode);
}

function targetFor(record) {
  if (modelMode === 'explode') return record.exploded;
  if (modelMode === 'section') return record.section;
  return record.home;
}

function applyState() {
  parts.forEach((record) => {
    record.group.position.lerp(targetFor(record), 0.12);
    const scale = record.id === activePartId ? 1.045 : 1;
    record.group.scale.lerp(new THREE.Vector3(scale, scale, scale), 0.16);
  });
}

document.querySelectorAll('[data-eye-action]').forEach((button) => {
  button.addEventListener('click', () => {
    const action = button.dataset.eyeAction;
    if (action === 'whole') {
      showRays = false;
      updateRays();
      setMode('whole');
    }
    if (action === 'section') {
      showRays = false;
      updateRays();
      setMode('section');
    }
    if (action === 'explode') {
      showRays = false;
      updateRays();
      setMode('explode');
    }
    if (action === 'rays') {
      showRays = !showRays;
      updateRays();
    }
    if (action === 'reset') {
      showRays = false;
      updateRays();
      setMode('whole');
    }
  });
});

const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();

function setMaterialHighlight(mesh, active) {
  const material = mesh.material;
  if (!material?.emissive) return;
  if (mesh.userData.baseEmissive === undefined) {
    mesh.userData.baseEmissive = material.emissive.getHex();
    mesh.userData.baseEmissiveIntensity = material.emissiveIntensity || 0;
  }
  material.emissive.setHex(active ? 0x1687a7 : mesh.userData.baseEmissive);
  material.emissiveIntensity = active ? 0.24 : mesh.userData.baseEmissiveIntensity;
}

function setActivePart(record, locked = false) {
  if (activePartId === (record?.id || '') && !locked) return;
  if (activePartId) {
    const previous = parts.get(activePartId);
    previous?.group.traverse((child) => {
      if (child.isMesh) setMaterialHighlight(child, false);
    });
  }
  activePartId = record?.id || '';
  if (!record) {
    renderModeInfo();
    return;
  }
  record.group.traverse((child) => {
    if (child.isMesh) setMaterialHighlight(child, true);
  });
  renderPartInfo(record, locked);
}

function pickPart(event) {
  const rect = renderer.domElement.getBoundingClientRect();
  pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  pointer.y = -(((event.clientY - rect.top) / rect.height) * 2 - 1);
  raycaster.setFromCamera(pointer, camera);
  const hits = raycaster.intersectObjects(clickable, false);
  return hits.find((hit) => hit.object.userData.partRecord)?.object.userData.partRecord || null;
}

renderer.domElement.addEventListener('pointermove', (event) => {
  const record = pickPart(event);
  renderer.domElement.style.cursor = record ? 'pointer' : 'grab';
  if (!lockedPartId) setActivePart(record);
});

renderer.domElement.addEventListener('pointerleave', () => {
  renderer.domElement.style.cursor = 'grab';
  if (!lockedPartId) setActivePart(null);
});

renderer.domElement.addEventListener('click', (event) => {
  const record = pickPart(event);
  lockedPartId = record?.id || '';
  setActivePart(record, Boolean(record));
});

function resize() {
  const rect = mount.getBoundingClientRect();
  renderer.setSize(rect.width, rect.height);
  camera.aspect = rect.width / rect.height;
  camera.updateProjectionMatrix();
}

window.addEventListener('resize', resize);
resize();
setMode('whole');

function animate(time) {
  root.position.y = Math.sin(time * 0.0011) * 0.045;
  applyState();
  controls.update();
  renderer.render(scene, camera);
  requestAnimationFrame(animate);
}

animate(0);
