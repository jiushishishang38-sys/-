export const ELEMENT_TYPES = ['convexLens', 'concaveLens', 'concaveMirror', 'convexMirror', 'blocker'];
export const LIGHT_TYPES = ['ray', 'beam', 'point', 'parallel'];
export const SENSOR_TYPES = ['screen', 'detector'];
export const SCREEN_SIZE = 64;
const EPSILON = 1e-6;

const ELEMENT_LABELS = {
  convexLens: '凸透镜',
  concaveLens: '凹透镜',
  concaveMirror: '凹面镜',
  convexMirror: '凸面镜',
  blocker: '遮光物'
};

const LIGHT_LABELS = {
  ray: '单一光线',
  beam: '光束',
  point: '点光源',
  parallel: '平行光'
};

export function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

export function normalize(vector) {
  const length = Math.hypot(vector[0], vector[1], vector[2]);
  if (length < EPSILON) return [1, 0, 0];
  return [vector[0] / length, vector[1] / length, vector[2] / length];
}

function add(origin, direction, scale) {
  return [
    origin[0] + direction[0] * scale,
    origin[1] + direction[1] * scale,
    origin[2] + direction[2] * scale
  ];
}

function itemPosition(item) {
  return Array.isArray(item.position) ? item.position : [item.x ?? 0, 0, 0];
}

function setItemX(item, x) {
  if (Array.isArray(item.position)) item.position[0] = x;
  else item.x = x;
}

function setItemY(item, y) {
  if (Array.isArray(item.position)) item.position[1] = y;
  else item.y = y;
}

function makeId(prefix) {
  return `${prefix}-${Math.random().toString(36).slice(2, 8)}`;
}

export function createOpticalElement(type, x = 0) {
  const isLens = type === 'convexLens' || type === 'concaveLens';
  if (type === 'blocker') {
    return {
      id: makeId('element'),
      label: ELEMENT_LABELS.blocker,
      type,
      position: [x, 0, 0],
      width: 1,
      height: 8,
      apertureRadius: 4,
      reflective: false,
      absorptive: true
    };
  }
  const sign = type === 'concaveLens' || type === 'convexMirror' ? -1 : 1;
  return {
    id: makeId('element'),
    label: ELEMENT_LABELS[type] ?? '光学元件',
    type,
    position: [x, 0, 0],
    rotation: [0, 0, 0],
    apertureRadius: 4.6,
    thickness: isLens ? 0.8 : 0.35,
    frontRadius: 16 * sign,
    backRadius: isLens ? -16 * sign : 16 * sign,
    ior: isLens ? 1.5 : 1,
    reflective: !isLens,
    focalLength: type.includes('Mirror') ? 8 * sign : 12 * sign
  };
}

export function createLightSource(type, x = -24) {
  return {
    id: makeId('light'),
    label: LIGHT_LABELS[type] ?? '光源',
    type,
    position: [x, 0, 0],
    direction: [1, 0, 0],
    angleDeg: 0,
    beamRadius: type === 'ray' ? 0 : 3.2,
    divergenceDeg: type === 'point' ? 11 : type === 'beam' ? 2.4 : 0.8,
    rayCount: type === 'ray' ? 1 : 96,
    wavelengthNm: 560,
    power: 1
  };
}

export function createScreen(x = 20) {
  return {
    id: makeId('screen'),
    label: '光屏',
    type: 'screen',
    position: [x, 0, 0],
    width: 9,
    height: 9,
    magnifierZoom: 2
  };
}

export function createDetector(x = 18) {
  return {
    id: makeId('detector'),
    label: '探测器',
    type: 'detector',
    position: [x, 0, 0],
    width: 8,
    height: 8,
    magnifierZoom: 2
  };
}

export function createDefaultFreeScene() {
  const light = createLightSource('parallel', -24);
  const lens = createOpticalElement('convexLens', 0);
  const screen = createScreen(14);
  return {
    ...createEmptyFreeScene(),
    elements: [lens],
    lightSources: [light],
    screens: [screen],
    selectedId: screen.id
  };
}

export function createEmptyFreeScene() {
  return {
    mode: 'free',
    elements: [],
    lightSources: [],
    screens: [],
    selectedId: '',
    settings: {
      maxBounces: 4,
      interactionRayCount: 64,
      previewRayCount: 420,
      showNormals: true,
      showCaustics: true,
      showPrincipalRays: true,
      showAxis: true,
      showFocusPlane: true
    }
  };
}

export const PRESET_SCENES = [
  {
    id: 'convex-image',
    label: '凸透镜成实像',
    makeScene() {
      const scene = createDefaultFreeScene();
      scene.elements[0].type = 'convexLens';
      scene.elements[0].label = ELEMENT_LABELS.convexLens;
      scene.elements[0].focalLength = 10;
      scene.screens[0].position[0] = 10;
      return scene;
    }
  },
  {
    id: 'concave-diverge',
    label: '凹透镜发散',
    makeScene() {
      const scene = createDefaultFreeScene();
      scene.elements[0].type = 'concaveLens';
      scene.elements[0].label = ELEMENT_LABELS.concaveLens;
      scene.elements[0].focalLength = -10;
      scene.screens[0].position[0] = 18;
      return scene;
    }
  },
  {
    id: 'concave-mirror',
    label: '凹面镜聚焦',
    makeScene() {
      const scene = createDefaultFreeScene();
      scene.lightSources[0].position[0] = 24;
      scene.lightSources[0].direction = [-1, 0, 0];
      scene.lightSources[0].angleDeg = 180;
      scene.elements = [createOpticalElement('concaveMirror', 7)];
      scene.elements[0].focalLength = 7;
      scene.screens = [createScreen(14)];
      scene.selectedId = scene.screens[0].id;
      return scene;
    }
  },
  {
    id: 'convex-mirror',
    label: '凸面镜发散',
    makeScene() {
      const scene = createDefaultFreeScene();
      scene.lightSources[0].position[0] = 24;
      scene.lightSources[0].direction = [-1, 0, 0];
      scene.lightSources[0].angleDeg = 180;
      scene.elements = [createOpticalElement('convexMirror', 7)];
      scene.elements[0].focalLength = -7;
      scene.screens = [createScreen(14)];
      scene.selectedId = scene.screens[0].id;
      return scene;
    }
  }
];

function sampleDisk(index, count, radius) {
  const goldenAngle = Math.PI * (3 - Math.sqrt(5));
  const r = radius * Math.sqrt((index + 0.5) / count);
  const theta = index * goldenAngle;
  return [Math.cos(theta) * r, Math.sin(theta) * r];
}

function makeLightRays(source, rayCount) {
  if (source.type === 'ray') {
    return [{
      origin: itemPosition(source),
      direction: normalize(source.direction || [1, 0, 0]),
      wavelength: source.wavelengthNm,
      intensity: source.power || 1
    }];
  }
  const count = Math.max(8, Math.min(rayCount, source.rayCount || rayCount));
  const rays = [];
  const sourcePosition = itemPosition(source);
  const baseDirection = normalize(source.direction || [1, 0, 0]);
  const divergence = ((source.divergenceDeg || 0) * Math.PI) / 180;

  for (let index = 0; index < count; index += 1) {
    const [y, z] = sampleDisk(index, count, source.beamRadius || 3);
    if (source.type === 'point') {
      const baseAngle = Math.atan2(baseDirection[1], baseDirection[0]);
      const fanOffset = count === 1 ? 0 : ((index / (count - 1)) - 0.5) * divergence * 2;
      const angle = baseAngle + fanOffset;
      rays.push({
        origin: sourcePosition,
        direction: normalize([Math.cos(angle), Math.sin(angle), 0]),
        wavelength: source.wavelengthNm,
        intensity: source.power / count
      });
    } else {
      const jitter = source.type === 'beam' ? divergence * 0.42 : divergence * 0.22;
      rays.push({
        origin: [sourcePosition[0], sourcePosition[1] + y, sourcePosition[2] + z],
        direction: normalize([baseDirection[0], baseDirection[1] + y * jitter, baseDirection[2] + z * jitter]),
        wavelength: source.wavelengthNm,
        intensity: source.power / count
      });
    }
  }
  return rays;
}

function intersectPlane(ray, item) {
  const x = itemPosition(item)[0];
  if (Math.abs(ray.direction[0]) < EPSILON) return null;
  const t = (x - ray.origin[0]) / ray.direction[0];
  if (t <= 0.025) return null;
  const point = add(ray.origin, ray.direction, t);
  return { item, t, point };
}

function insideAperture(point, item) {
  const radius = item.apertureRadius ?? Math.max(item.width ?? 8, item.height ?? 8) / 2;
  const center = itemPosition(item);
  return Math.hypot(point[1] - center[1], point[2] - center[2]) <= radius;
}

function insideScreen(point, screen) {
  const center = itemPosition(screen);
  const halfWidth = (screen.width ?? 9) / 2;
  const halfHeight = (screen.height ?? 9) / 2;
  return Math.abs(point[2] - center[2]) <= halfWidth && Math.abs(point[1] - center[1]) <= halfHeight;
}

function findNextHit(ray, scene, includeScreens = true) {
  const items = includeScreens ? [...scene.elements, ...scene.screens] : scene.elements;
  let nearest = null;
  for (const item of items) {
    const hit = intersectPlane(ray, item);
    if (!hit) continue;
    const isInside = item.type === 'screen' || item.type === 'detector'
      ? insideScreen(hit.point, item)
      : insideAperture(hit.point, item);
    if (!isInside) continue;
    if (!nearest || hit.t < nearest.t) nearest = hit;
  }
  return nearest;
}

function refractThinLens(direction, point, element) {
  const f = Math.abs(element.focalLength || 12) * (element.type === 'concaveLens' ? -1 : 1);
  const center = itemPosition(element);
  const sx = Math.sign(direction[0]) || 1;
  const slopeY = direction[1] / Math.max(EPSILON, Math.abs(direction[0]));
  const slopeZ = direction[2] / Math.max(EPSILON, Math.abs(direction[0]));
  const nextSlopeY = slopeY - (point[1] - center[1]) / f;
  const nextSlopeZ = slopeZ - (point[2] - center[2]) / f;
  return normalize([sx, nextSlopeY, nextSlopeZ]);
}

function reflectMirror(direction, point, element) {
  const center = itemPosition(element);
  const x = center[0];
  const incomingSign = Math.sign(direction[0]) || 1;
  const f = Math.abs(element.focalLength || 8);
  const isConcave = element.type === 'concaveMirror';
  const focusX = isConcave ? x - incomingSign * f : x + incomingSign * f;
  if (isConcave) return normalize([focusX - point[0], center[1] - point[1], center[2] - point[2]]);
  return normalize([point[0] - focusX, point[1] - center[1], point[2] - center[2]]);
}

function emptyMap(size = SCREEN_SIZE) {
  return Array.from({ length: size }, () => Array.from({ length: size }, () => 0));
}

function makeScreenResults(scene) {
  return new Map(scene.screens.map((screen) => [
    screen.id,
    {
      screenId: screen.id,
      type: screen.type,
      label: screen.label,
      hitCount: 0,
      irradianceMap: emptyMap(),
      peakPosition: [0, 0],
      spotRadius: Number.NaN,
      magnifierZoom: screen.magnifierZoom ?? 2,
      _sum: 0,
      _sumY: 0,
      _sumZ: 0,
      _sumR2: 0,
      _peakValue: 0,
      _width: screen.width ?? 9,
      _height: screen.height ?? 9
    }
  ]));
}

function recordScreenHit(result, screen, point, intensity) {
  const center = itemPosition(screen);
  const width = screen.width ?? 9;
  const height = screen.height ?? 9;
  const localY = point[1] - center[1];
  const localZ = point[2] - center[2];
  const u = clamp((localZ / width) + 0.5, 0, 0.999999);
  const v = clamp(0.5 - (localY / height), 0, 0.999999);
  const x = Math.floor(u * SCREEN_SIZE);
  const y = Math.floor(v * SCREEN_SIZE);
  result.irradianceMap[y][x] += intensity;
  result.hitCount += 1;
  result._sum += intensity;
  result._sumY += localY * intensity;
  result._sumZ += localZ * intensity;
  const cellValue = result.irradianceMap[y][x];
  if (cellValue > result._peakValue) {
    result._peakValue = cellValue;
    result.peakPosition = [point[1], point[2]];
  }
}

function finalizeScreenResults(results) {
  for (const result of results.values()) {
    if (result._sum > 0) {
      const centerY = result._sumY / result._sum;
      const centerZ = result._sumZ / result._sum;
      for (let row = 0; row < SCREEN_SIZE; row += 1) {
        for (let col = 0; col < SCREEN_SIZE; col += 1) {
          const value = result.irradianceMap[row][col];
          if (!value) continue;
          const y = (0.5 - (row + 0.5) / SCREEN_SIZE) * result._height;
          const z = (((col + 0.5) / SCREEN_SIZE) - 0.5) * result._width;
          result._sumR2 += ((y - centerY) ** 2 + (z - centerZ) ** 2) * value;
        }
      }
      result.spotRadius = Math.sqrt(result._sumR2 / result._sum);
    }
    delete result._sum;
    delete result._sumY;
    delete result._sumZ;
    delete result._sumR2;
    delete result._peakValue;
    delete result._width;
    delete result._height;
  }
  return [...results.values()];
}

export function traceScene(scene, options = {}) {
  const rayCount = options.rayCount ?? scene.settings.previewRayCount ?? 256;
  const maxBounces = options.maxBounces ?? scene.settings.maxBounces ?? 4;
  const paths = [];
  const screenResults = makeScreenResults(scene);
  const sources = scene.lightSources;

  for (const source of sources) {
    const rays = makeLightRays(source, rayCount);
    for (const startRay of rays) {
      let ray = { ...startRay, origin: [...startRay.origin], direction: normalize(startRay.direction) };
      const path = [[...ray.origin]];
      for (let bounce = 0; bounce < maxBounces; bounce += 1) {
        const hit = findNextHit(ray, scene, bounce > 0 || scene.elements.length === 0);
        if (!hit) {
          path.push(add(ray.origin, ray.direction, 52));
          break;
        }

        path.push(hit.point);
        if (hit.item.type === 'screen') {
          recordScreenHit(screenResults.get(hit.item.id), hit.item, hit.point, ray.intensity);
          break;
        }

        if (hit.item.type === 'detector') {
          recordScreenHit(screenResults.get(hit.item.id), hit.item, hit.point, ray.intensity);
          ray = {
            ...ray,
            origin: add(hit.point, ray.direction, 0.035)
          };
          continue;
        }

        if (hit.item.type === 'blocker' || hit.item.absorptive) break;

        const nextDirection = hit.item.reflective || hit.item.type.includes('Mirror')
          ? reflectMirror(ray.direction, hit.point, hit.item)
          : refractThinLens(ray.direction, hit.point, hit.item);
        ray = {
          ...ray,
          origin: add(hit.point, nextDirection, 0.035),
          direction: nextDirection,
          intensity: ray.intensity * 0.96
        };
      }
      paths.push(path);
    }
  }

  return {
    paths,
    screenResults: finalizeScreenResults(screenResults)
  };
}

export function getAllItems(scene) {
  return [...scene.lightSources, ...scene.elements, ...scene.screens];
}

export function getItemById(scene, id) {
  return getAllItems(scene).find((item) => item.id === id) ?? null;
}

export function addSceneItem(scene, kind) {
  const allItems = getAllItems(scene);
  const rightMost = Math.max(-24, ...allItems.map((item) => itemPosition(item)[0]));
  let item;
  if (LIGHT_TYPES.includes(kind)) {
    item = createLightSource(kind, -26 + scene.lightSources.length * 2);
    scene.lightSources.push(item);
  } else if (kind === 'screen') {
    item = createScreen(clamp(rightMost + 7, -30, 34));
    scene.screens.push(item);
  } else if (kind === 'detector') {
    item = createDetector(clamp(rightMost + 7, -30, 34));
    scene.screens.push(item);
  } else {
    item = createOpticalElement(kind, clamp(rightMost + 5, -28, 30));
    scene.elements.push(item);
  }
  scene.selectedId = item.id;
  return item;
}

export function removeSceneItem(scene, id) {
  scene.elements = scene.elements.filter((item) => item.id !== id);
  scene.lightSources = scene.lightSources.filter((item) => item.id !== id);
  scene.screens = scene.screens.filter((item) => item.id !== id);
  if (scene.selectedId === id) {
    scene.selectedId = scene.screens[0]?.id || scene.elements[0]?.id || scene.lightSources[0]?.id || '';
  }
}

export function updateItemPosition(scene, id, x) {
  const item = getItemById(scene, id);
  if (!item) return null;
  setItemX(item, clamp(Number(x), -34, 36));
  return item;
}

export function updateItemPosition2D(scene, id, x, y) {
  const item = getItemById(scene, id);
  if (!item) return null;
  setItemX(item, clamp(Number(x), -34, 36));
  setItemY(item, clamp(Number(y), -7.5, 7.5));
  return item;
}

export function describeItem(item) {
  const [x, y] = itemPosition(item);
  const position = `${x.toFixed(1)}, ${y.toFixed(1)} cm`;
  if (item.type === 'screen') return `${position} · 光斑观察`;
  if (item.type === 'detector') return `${position} · 能量流率测量`;
  if (LIGHT_TYPES.includes(item.type)) {
    if (item.type === 'ray') return `${position} · 方向 ${Math.round(item.angleDeg ?? 0)}°`;
    return `${position} · ${item.type === 'parallel' ? '平行束' : '发散角'} ${item.divergenceDeg.toFixed(1)}°`;
  }
  if (item.type === 'blocker') return `${position} · 吸收命中的光线`;
  return `${position} · f ${Math.abs(item.focalLength || 0).toFixed(1)} cm · 口径 ${item.apertureRadius.toFixed(1)} cm`;
}

export function sortBenchItems(scene) {
  scene.elements.sort((a, b) => itemPosition(a)[0] - itemPosition(b)[0]);
  scene.screens.sort((a, b) => itemPosition(a)[0] - itemPosition(b)[0]);
  scene.lightSources.sort((a, b) => itemPosition(a)[0] - itemPosition(b)[0]);
}
