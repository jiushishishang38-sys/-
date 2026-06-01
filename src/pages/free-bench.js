import {
  ELEMENT_TYPES,
  LIGHT_TYPES,
  PRESET_SCENES,
  SCREEN_SIZE,
  SENSOR_TYPES,
  addSceneItem,
  createDefaultFreeScene,
  createEmptyFreeScene,
  describeItem,
  getAllItems,
  getItemById,
  removeSceneItem,
  sortBenchItems,
  traceScene,
  updateItemPosition,
  updateItemPosition2D
} from '../free-optics.js';
import { attachOpticsModel } from '../model-assets.js';

let THREE;
let OrbitControls;

const DEVICE_GROUPS = [
  { label: '光源', hint: '射线、光束、点光源', types: LIGHT_TYPES },
  { label: '光学元件', hint: '透镜、面镜与遮挡', types: ELEMENT_TYPES },
  { label: '接收与测量', hint: '光屏、探测器', types: SENSOR_TYPES }
];

async function loadThreeModules() {
  if (THREE && OrbitControls) return;
  const [threeModule, controlsModule] = await Promise.all([
    import('../vendor/three.module.js'),
    import('../vendor/OrbitControls.js')
  ]);
  THREE = threeModule;
  OrbitControls = controlsModule.OrbitControls;
}

export async function mountFreeBench(host) {
  await loadThreeModules();
  host.innerHTML = `
    <div class="free-bench-shell">
      <section class="free-bench-stage">
        <div class="free-bench-head">
          <div>
            <p class="eyebrow">自由二维光路模拟</p>
            <h1>搭建光源、透镜与屏幕，实时观察光线传播</h1>
          </div>
          <div class="free-preset-strip" aria-label="教学预设">
            ${PRESET_SCENES.map((preset) => `<button type="button" data-free-preset="${preset.id}">${preset.label}</button>`).join('')}
          </div>
        </div>
        <div class="ray-optics-workspace">
          <div class="canvas-toolbelt" aria-label="器材添加工具条">
            ${DEVICE_GROUPS.map((group) => `
              <details class="canvas-device-menu">
                <summary>
                  <span>${group.label}</span>
                  <small>${group.hint}</small>
                </summary>
                <div class="device-grid">
                  ${group.types.map((type) => `<button type="button" data-add-device="${type}">${deviceName(type)}</button>`).join('')}
                </div>
              </details>
            `).join('')}
          </div>
          <canvas id="free-optics-2d" width="1200" height="560" aria-label="二维几何光学自由模拟画布"></canvas>
        </div>
        <details class="free-3d-details">
          <summary>空间光具座预览</summary>
          <div class="free-bench-canvas" id="free-bench-canvas"></div>
        </details>
        <details class="ray-optics-reference">
          <summary>功能提示</summary>
          <div class="ray-optics-reference-grid" aria-label="自由模式功能概览">
            <article>
              <strong>器件</strong>
              <span>单一光线、光束、点光源、理想透镜、面镜、遮光物、光屏、探测器</span>
            </article>
            <article>
              <strong>视图</strong>
              <span>实时光线、焦平面、法线、屏幕热力图与探测读数</span>
            </article>
            <article>
              <strong>操作</strong>
              <span>在二维画布中拖动器件，右侧调节焦距、口径、光束半径和发散角</span>
            </article>
          </div>
        </details>
      </section>
      <aside class="free-bench-panel">
        <details class="tool-section tool-accordion" open>
          <summary>
            <span>光具座列表</span>
            <em>当前场景</em>
          </summary>
          <div class="section-line compact-actions">
            <button type="button" class="button small" id="free-align">整理</button>
            <button type="button" class="button small danger" id="free-reset">清空全部</button>
          </div>
          <div id="bench-item-list" class="bench-item-list"></div>
        </details>
        <details class="tool-section tool-accordion">
          <summary>
            <span>参数</span>
            <em>选中后调整</em>
          </summary>
          <div id="selected-editor"></div>
        </details>
        <details class="tool-section tool-accordion">
          <summary>
            <span>光斑 / 探测器</span>
            <em>测量结果</em>
          </summary>
          <div class="section-line">
            <select id="magnifier-zoom" aria-label="光斑放大倍率">
              <option value="1">1x</option>
              <option value="2" selected>2x</option>
              <option value="4">4x</option>
            </select>
          </div>
          <canvas id="spot-magnifier" width="256" height="256"></canvas>
          <div class="spot-readout" id="spot-readout">等待光线命中光屏或探测器</div>
        </details>
        <details class="tool-section tool-accordion">
          <summary>
            <span>显示辅助</span>
            <em>光轴与热力图</em>
          </summary>
          <label class="check-row"><input type="checkbox" data-setting="showAxis" checked /> 光轴</label>
          <label class="check-row"><input type="checkbox" data-setting="showNormals" checked /> 法线</label>
          <label class="check-row"><input type="checkbox" data-setting="showPrincipalRays" checked /> 延长光线 / 主光线</label>
          <label class="check-row"><input type="checkbox" data-setting="showFocusPlane" checked /> 焦平面</label>
          <label class="check-row"><input type="checkbox" data-setting="showCaustics" checked /> 屏幕热力图</label>
        </details>
      </aside>
    </div>
  `;

  const state = {
    scene: createDefaultFreeScene(),
    result: null,
    interacting: false,
    stableTimer: 0,
    traceFrame: 0,
    meshes: new Map(),
    rayLines: [],
    screenTextures: new Map()
  };

  const mount = host.querySelector('#free-bench-canvas');
  const optics2dCanvas = host.querySelector('#free-optics-2d');
  const optics2dCtx = optics2dCanvas.getContext('2d');
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  mount.appendChild(renderer.domElement);

  const scene3d = new THREE.Scene();
  scene3d.background = new THREE.Color(0xf6f9ff);
  const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 120);
  camera.position.set(7.4, 5.2, 8.2);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.target.set(0, 0.45, 0);

  scene3d.add(new THREE.AmbientLight(0xffffff, 1.5));
  const key = new THREE.DirectionalLight(0xffffff, 2.1);
  key.position.set(4, 8, 5);
  scene3d.add(key);
  scene3d.add(new THREE.HemisphereLight(0xffffff, 0xdde6ff, 1.1));

  const benchGroup = new THREE.Group();
  const objectGroup = new THREE.Group();
  const rayGroup = new THREE.Group();
  const helperGroup = new THREE.Group();
  scene3d.add(benchGroup, objectGroup, rayGroup, helperGroup);
  buildBench(benchGroup);

  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  const dragPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  const dragPoint = new THREE.Vector3();
  let activeDragId = '';
  let active2dDragId = '';

  function resize() {
    const rect = mount.getBoundingClientRect();
    if (rect.width < 2 || rect.height < 2) return;
    renderer.setSize(rect.width, rect.height, false);
    camera.aspect = rect.width / rect.height;
    camera.updateProjectionMatrix();
  }

  function resize2d() {
    const rect = optics2dCanvas.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const width = Math.max(360, Math.round(rect.width * dpr));
    const height = Math.max(260, Math.round(rect.height * dpr));
    if (optics2dCanvas.width !== width || optics2dCanvas.height !== height) {
      optics2dCanvas.width = width;
      optics2dCanvas.height = height;
    }
    draw2dScene();
  }

  function cmToWorld(cm) {
    return cm * 0.17;
  }

  function worldToCm(worldX) {
    return Math.round((worldX / 0.17) * 4) / 4;
  }

  function itemX(item) {
    return item.position?.[0] ?? item.x ?? 0;
  }

  function itemY(item) {
    return item.position?.[1] ?? item.y ?? 0;
  }

  function setSelected(id) {
    state.scene.selectedId = id;
    renderUi();
    rebuildObjects();
    scheduleTrace(true);
  }

  function scheduleTrace(interacting = false) {
    state.interacting = interacting;
    window.clearTimeout(state.stableTimer);
    if (!state.traceFrame) {
      state.traceFrame = requestAnimationFrame(() => {
        state.traceFrame = 0;
        const rayCount = state.interacting
          ? state.scene.settings.interactionRayCount
          : state.scene.settings.previewRayCount;
        state.result = traceScene(state.scene, { rayCount });
        draw2dScene();
        renderRays();
        renderHelpers();
        updateScreenTextures();
        renderMagnifier();
      });
    }

    if (interacting) {
      state.stableTimer = window.setTimeout(() => scheduleTrace(false), 320);
    }
  }

  function xToCanvas(x) {
    const pad = 58;
    return pad + ((x + 34) / 70) * (optics2dCanvas.width - pad * 2);
  }

  function canvasToX(x) {
    const pad = 58;
    return Math.round((((x - pad) / Math.max(1, optics2dCanvas.width - pad * 2)) * 70 - 34) * 4) / 4;
  }

  function canvasToY(y) {
    return Math.round(((optics2dCanvas.height / 2 - y) / (optics2dCanvas.height / 18)) * 4) / 4;
  }

  function yToCanvas(y) {
    return optics2dCanvas.height / 2 - y * (optics2dCanvas.height / 18);
  }

  function pointToCanvas(point) {
    return [xToCanvas(point[0]), yToCanvas(point[1])];
  }

  function draw2dScene() {
    if (!optics2dCtx) return;
    const ctx = optics2dCtx;
    const width = optics2dCanvas.width;
    const height = optics2dCanvas.height;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = '#f8fbff';
    ctx.fillRect(0, 0, width, height);

    ctx.save();
    ctx.strokeStyle = 'rgba(22,31,48,0.08)';
    ctx.lineWidth = 1 * dpr;
    for (let x = 58; x < width - 58; x += (width - 116) / 14) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }
    for (let y = height / 2 - 6 * height / 18; y <= height / 2 + 6 * height / 18; y += height / 18) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }

    const axisY = yToCanvas(0);
    ctx.strokeStyle = 'rgba(16,19,26,0.42)';
    ctx.setLineDash([7 * dpr, 7 * dpr]);
    ctx.beginPath();
    ctx.moveTo(34, axisY);
    ctx.lineTo(width - 34, axisY);
    ctx.stroke();
    ctx.setLineDash([]);

    if (state.scene.settings.showFocusPlane) {
      for (const element of state.scene.elements) {
        if (element.type.includes('Lens')) {
          drawFocusMarker(ctx, itemX(element) + (element.focalLength || 0), itemY(element), element.type === 'concaveLens');
        }
      }
    }

    const paths = state.result?.paths ?? [];
    const step = paths.length > 260 ? Math.ceil(paths.length / 260) : 1;
    paths.forEach((path, index) => {
      if (index % step !== 0 || path.length < 2) return;
      ctx.beginPath();
      path.forEach((point, pointIndex) => {
        const [x, y] = pointToCanvas(point);
        if (pointIndex === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.strokeStyle = index % 3 === 0 ? 'rgba(245,157,35,0.86)' : index % 3 === 1 ? 'rgba(9,148,194,0.82)' : 'rgba(230,64,108,0.74)';
      ctx.lineWidth = Math.max(1.25, 1.7 * dpr);
      ctx.stroke();
    });

    for (const item of getAllItems(state.scene)) {
      draw2dItem(ctx, item, item.id === state.scene.selectedId);
    }
    ctx.restore();
  }

  function drawFocusMarker(ctx, xValue, yValue = 0, virtual = false) {
    const x = xToCanvas(xValue);
    const y = yToCanvas(yValue);
    ctx.save();
    ctx.strokeStyle = virtual ? 'rgba(242,95,92,0.34)' : 'rgba(240,167,58,0.42)';
    ctx.fillStyle = virtual ? 'rgba(242,95,92,0.1)' : 'rgba(240,167,58,0.12)';
    ctx.setLineDash(virtual ? [5, 5] : []);
    ctx.beginPath();
    ctx.moveTo(x, 42);
    ctx.lineTo(x, optics2dCanvas.height - 42);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(x, y, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function draw2dItem(ctx, item, selected) {
    const x = xToCanvas(itemX(item));
    const y = yToCanvas(itemY(item));
    const scaleY = optics2dCanvas.height / 18;
    const radius = item.apertureRadius ?? (item.height ?? 8) / 2;
    ctx.save();
    ctx.lineWidth = selected ? 4 : 2;
    ctx.strokeStyle = selected ? '#6842d8' : '#294f65';
    ctx.fillStyle = selected ? 'rgba(104,66,216,0.12)' : 'rgba(255,255,255,0.78)';

    if (LIGHT_TYPES.includes(item.type)) {
      const direction = normalize2d(item.direction || [1, 0, 0]);
      ctx.fillStyle = item.type === 'point' ? '#ff8f4d' : '#ffd166';
      ctx.strokeStyle = '#9a6a00';
      ctx.beginPath();
      ctx.arc(x, y, item.type === 'ray' ? 8 : 12, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      const arrowEndX = x + direction[0] * 30;
      const arrowEndY = y - direction[1] * 30;
      ctx.beginPath();
      ctx.moveTo(x + direction[0] * 9, y - direction[1] * 9);
      ctx.lineTo(arrowEndX, arrowEndY);
      ctx.lineTo(arrowEndX - direction[0] * 9 - direction[1] * 5, arrowEndY + direction[1] * 9 - direction[0] * 5);
      ctx.moveTo(arrowEndX, arrowEndY);
      ctx.lineTo(arrowEndX - direction[0] * 9 + direction[1] * 5, arrowEndY + direction[1] * 9 + direction[0] * 5);
      ctx.stroke();
      draw2dLabel(ctx, item.label, x, y + 30);
    } else if (item.type === 'screen' || item.type === 'detector') {
      const halfH = (item.height ?? 8) * scaleY / 2;
      const halfW = Math.max(12, (item.width ?? 8) * 1.6);
      ctx.fillStyle = item.type === 'detector' ? 'rgba(21,122,98,0.11)' : 'rgba(255,255,255,0.92)';
      ctx.strokeStyle = item.type === 'detector' ? '#157a62' : '#6842d8';
      ctx.fillRect(x - halfW / 2, y - halfH, halfW, halfH * 2);
      ctx.strokeRect(x - halfW / 2, y - halfH, halfW, halfH * 2);
      draw2dLabel(ctx, item.label, x, y + halfH + 22);
    } else if (item.type === 'blocker') {
      const halfH = radius * scaleY;
      ctx.fillStyle = '#23283a';
      ctx.fillRect(x - 5, y - halfH, 10, halfH * 2);
      draw2dLabel(ctx, item.label, x, y + halfH + 22);
    } else if (item.type.includes('Mirror')) {
      const halfH = radius * scaleY;
      ctx.strokeStyle = item.type === 'concaveMirror' ? '#0c8fb8' : '#c23d74';
      ctx.beginPath();
      ctx.arc(x + (item.type === 'concaveMirror' ? 34 : -34), y, 36, Math.PI * 0.68, Math.PI * 1.32, item.type !== 'concaveMirror');
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(x, y - halfH);
      ctx.lineTo(x, y + halfH);
      ctx.strokeStyle = 'rgba(16,19,26,0.18)';
      ctx.stroke();
      draw2dLabel(ctx, item.label, x, y + halfH + 22);
    } else {
      const halfH = radius * scaleY;
      ctx.strokeStyle = item.type === 'convexLens' ? '#0c8fb8' : '#6842d8';
      ctx.fillStyle = item.type === 'convexLens' ? 'rgba(154,215,255,0.22)' : 'rgba(167,149,255,0.18)';
      ctx.beginPath();
      if (item.type === 'convexLens') {
        ctx.ellipse(x, y, 12, halfH, 0, 0, Math.PI * 2);
      } else {
        ctx.moveTo(x - 10, y - halfH);
        ctx.quadraticCurveTo(x + 9, y, x - 10, y + halfH);
        ctx.lineTo(x + 10, y + halfH);
        ctx.quadraticCurveTo(x - 9, y, x + 10, y - halfH);
        ctx.closePath();
      }
      ctx.fill();
      ctx.stroke();
      draw2dLabel(ctx, item.label, x, y + halfH + 22);
    }
    ctx.restore();
  }

  function normalize2d(direction) {
    const length = Math.hypot(direction[0], direction[1]);
    if (!length) return [1, 0];
    return [direction[0] / length, direction[1] / length];
  }

  function draw2dLabel(ctx, label, x, y) {
    ctx.save();
    ctx.font = '700 13px "Microsoft YaHei", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#10131a';
    ctx.fillText(label, x, y);
    ctx.restore();
  }

  function rebuildObjects() {
    disposeGroup(objectGroup);
    objectGroup.clear();
    state.screenTextures.forEach((texture) => texture.dispose());
    state.screenTextures.clear();
    state.meshes.clear();
    for (const item of getAllItems(state.scene)) {
      const mesh = makeDeviceMesh(item, item.id === state.scene.selectedId);
      mesh.position.x = cmToWorld(itemX(item));
      mesh.position.z = cmToWorld(itemY(item));
      mesh.userData.itemId = item.id;
      mesh.traverse((child) => {
        child.userData.itemId = item.id;
      });
      objectGroup.add(mesh);
      state.meshes.set(item.id, mesh);
    }
  }

  function renderRays() {
    disposeGroup(rayGroup);
    rayGroup.clear();
    state.rayLines = [];
    const paths = state.result?.paths ?? [];
    const step = paths.length > 180 ? Math.ceil(paths.length / 180) : 1;
    paths.forEach((path, index) => {
      if (index % step !== 0) return;
      const points = path.map(([x, y, z]) => new THREE.Vector3(cmToWorld(x), cmToWorld(y) + 0.85, cmToWorld(z)));
      const material = new THREE.LineBasicMaterial({
        color: index % 3 === 0 ? 0xffd166 : index % 3 === 1 ? 0x0f9fd1 : 0xf25f5c,
        transparent: true,
        opacity: state.interacting ? 0.55 : 0.78,
        depthTest: false
      });
      const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints(points), material);
      line.renderOrder = 80;
      rayGroup.add(line);
      state.rayLines.push(line);
    });
  }

  function renderHelpers() {
    disposeGroup(helperGroup);
    helperGroup.clear();
    if (state.scene.settings.showAxis) {
      const axis = new THREE.Line(
        new THREE.BufferGeometry().setFromPoints([
          new THREE.Vector3(cmToWorld(-36), 0.85, 0),
          new THREE.Vector3(cmToWorld(38), 0.85, 0)
        ]),
        new THREE.LineDashedMaterial({ color: 0x294f65, dashSize: 0.16, gapSize: 0.12, transparent: true, opacity: 0.5 })
      );
      axis.computeLineDistances();
      helperGroup.add(axis);
    }

    for (const element of state.scene.elements) {
      if (state.scene.settings.showNormals) {
        const x = cmToWorld(itemX(element));
        const normal = new THREE.Line(
          new THREE.BufferGeometry().setFromPoints([
            new THREE.Vector3(x, 0.18, -0.72),
            new THREE.Vector3(x, 1.55, 0.72)
          ]),
          new THREE.LineBasicMaterial({ color: 0x218c73, transparent: true, opacity: 0.48 })
        );
        helperGroup.add(normal);
      }
      if (state.scene.settings.showFocusPlane && !element.type.includes('Mirror')) {
        const focusX = itemX(element) + (element.focalLength || 12);
        helperGroup.add(makeFocusPlane(focusX));
      }
    }
  }

  function updateScreenTextures() {
    const results = new Map((state.result?.screenResults ?? []).map((result) => [result.screenId, result]));
    for (const screen of state.scene.screens) {
      const group = state.meshes.get(screen.id);
      const panel = group?.userData?.screenPanel;
      if (!panel) continue;
      const result = results.get(screen.id);
      const texture = makeHeatmapTexture(result, state.scene.settings.showCaustics);
      const old = state.screenTextures.get(screen.id);
      old?.dispose();
      state.screenTextures.set(screen.id, texture);
      panel.material.map = texture;
      panel.material.needsUpdate = true;
    }
  }

  function renderUi() {
    const list = host.querySelector('#bench-item-list');
    const items = getAllItems(state.scene).sort((a, b) => itemX(a) - itemX(b));
    list.innerHTML = items.map((item) => `
      <button type="button" class="bench-item ${item.id === state.scene.selectedId ? 'active' : ''}" data-select-item="${item.id}">
        <strong>${item.label}</strong>
        <span>${describeItem(item)}</span>
      </button>
    `).join('');

    const editor = host.querySelector('#selected-editor');
    const selected = getItemById(state.scene, state.scene.selectedId);
    if (!selected) {
      editor.innerHTML = '<p class="empty-note">选择一个器件后可调整参数。</p>';
      return;
    }
    editor.innerHTML = renderEditor(selected);
    host.querySelector('#magnifier-zoom').value = String(getSelectedScreen()?.magnifierZoom ?? 2);
  }

  function getSelectedScreen() {
    const selected = getItemById(state.scene, state.scene.selectedId);
    if (selected && SENSOR_TYPES.includes(selected.type)) return selected;
    return state.scene.screens[0] ?? null;
  }

  function renderMagnifier() {
    const canvas = host.querySelector('#spot-magnifier');
    const readout = host.querySelector('#spot-readout');
    const ctx = canvas.getContext('2d');
    const screen = getSelectedScreen();
    const result = (state.result?.screenResults ?? []).find((item) => item.screenId === screen?.id);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#f8fbfd';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    if (!screen || !result || result.hitCount === 0) {
      ctx.fillStyle = '#60657f';
      ctx.font = '700 17px Microsoft YaHei, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('暂无光线命中', canvas.width / 2, canvas.height / 2);
      readout.textContent = '移动光屏/探测器或调整元件，让光线落到测量面上';
      return;
    }

    drawHeatmap(ctx, result, screen.magnifierZoom ?? 2);
    const diameter = Number.isFinite(result.spotRadius) ? result.spotRadius * 2 : 0;
    const label = screen.type === 'detector' ? '探测器' : '光屏';
    readout.textContent = `${label}命中 ${result.hitCount} 条 · 光斑直径约 ${diameter.toFixed(2)} cm · 峰值 (${result.peakPosition[0].toFixed(2)}, ${result.peakPosition[1].toFixed(2)}) cm`;
  }

  host.addEventListener('click', (event) => {
    const addButton = event.target.closest('[data-add-device]');
    if (addButton) {
      addSceneItem(state.scene, addButton.dataset.addDevice);
      addButton.closest('.canvas-device-menu, .device-category')?.removeAttribute('open');
      sortBenchItems(state.scene);
      rebuildObjects();
      renderUi();
      scheduleTrace(true);
      return;
    }

    const selectButton = event.target.closest('[data-select-item]');
    if (selectButton) {
      setSelected(selectButton.dataset.selectItem);
      return;
    }

    const presetButton = event.target.closest('[data-free-preset]');
    if (presetButton) {
      const preset = PRESET_SCENES.find((item) => item.id === presetButton.dataset.freePreset);
      if (!preset) return;
      state.scene = preset.makeScene();
      rebuildObjects();
      renderUi();
      scheduleTrace(true);
      return;
    }

    if (event.target.closest('#free-reset')) {
      state.scene = createEmptyFreeScene();
      state.result = null;
      rebuildObjects();
      renderUi();
      scheduleTrace(true);
      return;
    }

    if (event.target.closest('#free-align')) {
      alignBench(state.scene);
      rebuildObjects();
      renderUi();
      scheduleTrace(true);
    }
  });

  host.querySelector('.free-3d-details')?.addEventListener('toggle', () => {
    requestAnimationFrame(() => {
      resize();
      rebuildObjects();
      scheduleTrace(false);
    });
  });

  host.addEventListener('input', (event) => {
    const selected = getItemById(state.scene, state.scene.selectedId);
    const field = event.target.dataset.editField;
    if (selected && field) {
      const value = Number(event.target.value);
      if (field === 'x') updateItemPosition(state.scene, selected.id, value);
      else if (field === 'y') updateItemPosition2D(state.scene, selected.id, selected.position?.[0] ?? 0, value);
      else if (field === 'angleDeg') updateLightAngle(selected, value);
      else selected[field] = value;
      if (field === 'focalLength' && selected.type === 'concaveLens') selected.focalLength = -Math.abs(value);
      if (field === 'focalLength' && selected.type === 'convexMirror') selected.focalLength = -Math.abs(value);
      renderUi();
      rebuildObjects();
      scheduleTrace(true);
    }

    const setting = event.target.dataset.setting;
    if (setting) {
      state.scene.settings[setting] = event.target.checked;
      renderHelpers();
      updateScreenTextures();
      renderMagnifier();
    }

    if (event.target.id === 'magnifier-zoom') {
      const screen = getSelectedScreen();
      if (screen) screen.magnifierZoom = Number(event.target.value);
      renderMagnifier();
    }
  });

  host.addEventListener('click', (event) => {
    const deleteButton = event.target.closest('[data-delete-selected]');
    if (!deleteButton) return;
    removeSceneItem(state.scene, state.scene.selectedId);
    rebuildObjects();
    renderUi();
    scheduleTrace(true);
  });

  function updatePointer(event) {
    const rect = renderer.domElement.getBoundingClientRect();
    pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    pointer.y = -(((event.clientY - rect.top) / rect.height) * 2 - 1);
  }

  renderer.domElement.addEventListener('pointerdown', (event) => {
    updatePointer(event);
    raycaster.setFromCamera(pointer, camera);
    const hits = raycaster.intersectObjects([...state.meshes.values()], true);
    const hit = hits.find((item) => item.object.userData.itemId);
    if (!hit) return;
    activeDragId = hit.object.userData.itemId;
    setSelected(activeDragId);
    controls.enabled = false;
    renderer.domElement.setPointerCapture(event.pointerId);
  });

  renderer.domElement.addEventListener('pointermove', (event) => {
    if (!activeDragId) return;
    updatePointer(event);
    raycaster.setFromCamera(pointer, camera);
    if (!raycaster.ray.intersectPlane(dragPlane, dragPoint)) return;
    updateItemPosition(state.scene, activeDragId, worldToCm(dragPoint.x));
    const mesh = state.meshes.get(activeDragId);
    if (mesh) mesh.position.x = cmToWorld(itemX(getItemById(state.scene, activeDragId)));
    renderUi();
    scheduleTrace(true);
  });

  function stopDrag(event) {
    if (!activeDragId) return;
    renderer.domElement.releasePointerCapture?.(event.pointerId);
    activeDragId = '';
    controls.enabled = true;
    sortBenchItems(state.scene);
    renderUi();
    scheduleTrace(false);
  }

  renderer.domElement.addEventListener('pointerup', stopDrag);
  renderer.domElement.addEventListener('pointercancel', stopDrag);

  optics2dCanvas.addEventListener('pointerdown', (event) => {
    const rect = optics2dCanvas.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const x = (event.clientX - rect.left) * dpr;
    const y = (event.clientY - rect.top) * dpr;
    const hit = getAllItems(state.scene)
      .map((item) => ({ item, distance: Math.hypot(xToCanvas(itemX(item)) - x, yToCanvas(itemY(item)) - y) }))
      .filter(({ distance }) => distance < 46 * dpr)
      .sort((a, b) => a.distance - b.distance)[0];
    if (!hit) return;
    active2dDragId = hit.item.id;
    setSelected(active2dDragId);
    optics2dCanvas.setPointerCapture(event.pointerId);
  });

  optics2dCanvas.addEventListener('pointermove', (event) => {
    if (!active2dDragId) return;
    const rect = optics2dCanvas.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    updateItemPosition2D(
      state.scene,
      active2dDragId,
      canvasToX((event.clientX - rect.left) * dpr),
      canvasToY((event.clientY - rect.top) * dpr)
    );
    const mesh = state.meshes.get(active2dDragId);
    const item = getItemById(state.scene, active2dDragId);
    if (mesh && item) {
      mesh.position.x = cmToWorld(itemX(item));
      mesh.position.z = cmToWorld(itemY(item));
    }
    renderUi();
    draw2dScene();
    scheduleTrace(true);
  });

  function stop2dDrag(event) {
    if (!active2dDragId) return;
    optics2dCanvas.releasePointerCapture?.(event.pointerId);
    active2dDragId = '';
    sortBenchItems(state.scene);
    renderUi();
    scheduleTrace(false);
  }

  optics2dCanvas.addEventListener('pointerup', stop2dDrag);
  optics2dCanvas.addEventListener('pointercancel', stop2dDrag);

  window.addEventListener('resize', resize);
  window.addEventListener('resize', resize2d);
  if ('ResizeObserver' in window) new ResizeObserver(resize).observe(mount);
  if ('ResizeObserver' in window) new ResizeObserver(resize2d).observe(optics2dCanvas);

  rebuildObjects();
  renderUi();
  scheduleTrace(false);

  function animate() {
    controls.update();
    renderer.render(scene3d, camera);
    requestAnimationFrame(animate);
  }
  resize();
  resize2d();
  animate();
}

function deviceName(type) {
  return {
    point: '点光源',
    parallel: '平行光',
    ray: '单一光线',
    beam: '光束',
    convexLens: '凸透镜',
    concaveLens: '凹透镜',
    concaveMirror: '凹面镜',
    convexMirror: '凸面镜',
    blocker: '遮光物',
    screen: '光屏',
    detector: '探测器'
  }[type] || type;
}

function renderEditor(item) {
  const x = item.position?.[0] ?? 0;
  const y = item.position?.[1] ?? 0;
  const common = `
    <div class="selected-title">
      <strong>${item.label}</strong>
      <button type="button" class="button small danger" data-delete-selected>删除</button>
    </div>
    <label>位置 x
      <input data-edit-field="x" type="range" min="-34" max="36" step="0.25" value="${x}" />
    </label>
    <label>位置 y
      <input data-edit-field="y" type="range" min="-7.5" max="7.5" step="0.25" value="${y}" />
    </label>
  `;
  if (SENSOR_TYPES.includes(item.type)) {
    return `${common}
      <label>${item.type === 'detector' ? '探测宽度' : '屏幕宽度'}
        <input data-edit-field="width" type="range" min="4" max="14" step="0.5" value="${item.width}" />
      </label>
      <label>${item.type === 'detector' ? '探测高度' : '屏幕高度'}
        <input data-edit-field="height" type="range" min="4" max="14" step="0.5" value="${item.height}" />
      </label>
    `;
  }
  if (LIGHT_TYPES.includes(item.type)) {
    return `${common}
      <label>发射角
        <input data-edit-field="angleDeg" type="range" min="-180" max="180" step="1" value="${item.angleDeg ?? directionAngle(item.direction)}" />
      </label>
      ${item.type === 'ray' ? '' : `
      <label>光束半径
        <input data-edit-field="beamRadius" type="range" min="0.8" max="6" step="0.1" value="${item.beamRadius}" />
      </label>
      <label>发散角
        <input data-edit-field="divergenceDeg" type="range" min="0" max="24" step="0.2" value="${item.divergenceDeg}" />
      </label>
      <label>光线数量
        <input data-edit-field="rayCount" type="range" min="24" max="520" step="8" value="${item.rayCount}" />
      </label>
      `}
    `;
  }
  if (item.type === 'blocker') {
    return `${common}
      <label>遮挡宽度
        <input data-edit-field="width" type="range" min="0.5" max="3" step="0.1" value="${item.width}" />
      </label>
      <label>遮挡高度
        <input data-edit-field="apertureRadius" type="range" min="1" max="7" step="0.1" value="${item.apertureRadius}" />
      </label>
    `;
  }
  return `${common}
    <label>焦距 |f|
      <input data-edit-field="focalLength" type="range" min="4" max="24" step="0.25" value="${Math.abs(item.focalLength)}" />
    </label>
    <label>口径
      <input data-edit-field="apertureRadius" type="range" min="1.5" max="7" step="0.1" value="${item.apertureRadius}" />
    </label>
    <label>折射率
      <input data-edit-field="ior" type="range" min="1" max="1.9" step="0.01" value="${item.ior}" />
    </label>
  `;
}

function updateLightAngle(item, value) {
  item.angleDeg = value;
  const radians = (value * Math.PI) / 180;
  item.direction = [Math.cos(radians), Math.sin(radians), 0];
}

function directionAngle(direction = [1, 0, 0]) {
  return Math.round((Math.atan2(direction[1] ?? 0, direction[0] ?? 1) * 180) / Math.PI);
}

function alignBench(scene) {
  const items = getAllItems(scene).sort((a, b) => (a.position?.[0] ?? 0) - (b.position?.[0] ?? 0));
  let x = -24;
  for (const item of items) {
    item.position[0] = x;
    x += item.type === 'screen' ? 10 : 7;
  }
}

function buildBench(group) {
  const railMat = new THREE.MeshStandardMaterial({ color: 0x8298a8, roughness: 0.42, metalness: 0.25 });
  const baseMat = new THREE.MeshStandardMaterial({ color: 0xe8eefc, roughness: 0.65 });
  const top = new THREE.Mesh(new THREE.BoxGeometry(13.4, 0.18, 1.25), baseMat);
  top.position.set(0, 0.04, 0);
  group.add(top);
  [-0.36, 0.36].forEach((z) => {
    const rail = new THREE.Mesh(new THREE.BoxGeometry(13.2, 0.06, 0.06), railMat);
    rail.position.set(0, 0.25, z);
    group.add(rail);
  });
  for (let cm = -30; cm <= 36; cm += 6) {
    const tick = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.04, 0.62), railMat);
    tick.position.set(cm * 0.17, 0.31, 0);
    group.add(tick);
  }
  attachOpticsModel(group, 'bench', {
    hideFallback: true,
    scale: [0.72, 0.72, 0.72],
    position: [0, 0, 0]
  });
}

function makeDeviceMesh(item, selected = false) {
  const group = new THREE.Group();
  const postMat = new THREE.MeshStandardMaterial({ color: 0x718899, metalness: 0.35, roughness: 0.34 });
  const post = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.9, 16), postMat);
  post.position.y = 0.7;
  const foot = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.12, 0.46), postMat);
  foot.position.y = 0.27;
  group.add(post, foot);

  if (SENSOR_TYPES.includes(item.type)) {
    const texture = makeHeatmapTexture(null, true);
    const panel = new THREE.Mesh(
      new THREE.PlaneGeometry((item.width ?? 9) * 0.17, (item.height ?? 9) * 0.17),
      new THREE.MeshBasicMaterial({ map: texture, transparent: true, opacity: item.type === 'detector' ? 0.42 : 0.95, side: THREE.DoubleSide })
    );
    panel.rotation.y = Math.PI / 2;
    panel.position.y = 0.93;
    group.userData.screenPanel = panel;
    group.add(panel);
    if (item.type === 'screen') {
      attachOpticsModel(group, 'imageScreen', {
        hideFallback: false,
        position: [0, 0.93, 0],
        scale: [0.7, 0.7, 0.7]
      });
    }
  } else if (LIGHT_TYPES.includes(item.type)) {
    const lamp = new THREE.Mesh(
      new THREE.CylinderGeometry(0.13, 0.13, 0.44, 28),
      new THREE.MeshStandardMaterial({ color: item.type === 'parallel' || item.type === 'beam' ? 0xffcf70 : 0xff8f4d, emissive: 0xffbc4f, emissiveIntensity: 0.35, roughness: 0.24 })
    );
    lamp.rotation.z = Math.PI / 2;
    const lampSlot = new THREE.Group();
    lampSlot.position.y = 0.93;
    lampSlot.add(lamp);
    group.add(lampSlot);
    attachOpticsModel(lampSlot, item.type === 'parallel' || item.type === 'beam' ? 'sourceParallel' : 'sourcePoint', {
      hideFallback: true,
      scale: [0.55, 0.55, 0.55]
    });
  } else if (item.type === 'blocker') {
    const blocker = new THREE.Mesh(
      new THREE.BoxGeometry(0.05, (item.apertureRadius ?? 4) * 0.34, 0.82),
      new THREE.MeshStandardMaterial({ color: 0x23283a, roughness: 0.72, metalness: 0.08 })
    );
    blocker.position.y = 0.93;
    group.add(blocker);
  } else if (item.type.includes('Mirror')) {
    const mirror = new THREE.Mesh(
      new THREE.SphereGeometry(0.52, 32, 18, 0, Math.PI * 2, 0.35, Math.PI * 0.62),
      new THREE.MeshPhysicalMaterial({ color: 0xcfd8e3, metalness: 0.72, roughness: 0.18, side: THREE.DoubleSide })
    );
    mirror.scale.x = 0.18;
    mirror.rotation.z = Math.PI / 2;
    if (item.type === 'convexMirror') mirror.rotation.y = Math.PI;
    const mirrorSlot = new THREE.Group();
    mirrorSlot.position.y = 0.93;
    mirrorSlot.add(mirror);
    group.add(mirrorSlot);
    attachOpticsModel(mirrorSlot, item.type === 'convexMirror' ? 'convexMirror' : 'concaveMirror', {
      hideFallback: true,
      scale: [0.72, 0.72, 0.72]
    });
  } else {
    const material = new THREE.MeshPhysicalMaterial({
      color: item.type === 'convexLens' ? 0x9ad7ff : 0xa795ff,
      roughness: 0.03,
      transparent: true,
      opacity: 0.42,
      transmission: 0.4,
      ior: item.ior || 1.5,
      side: THREE.DoubleSide
    });
    const lens = item.type === 'convexLens'
      ? new THREE.Mesh(new THREE.SphereGeometry(0.5, 44, 24), material)
      : makeConcaveLens(material);
    lens.scale.set(0.2, 1, 0.62);
    const rim = new THREE.Mesh(new THREE.TorusGeometry(0.53, 0.014, 8, 58), new THREE.MeshBasicMaterial({ color: 0x6842d8 }));
    rim.rotation.y = Math.PI / 2;
    const lensSlot = new THREE.Group();
    lensSlot.position.y = 0.93;
    lensSlot.add(lens, rim);
    group.add(lensSlot);
    attachOpticsModel(lensSlot, item.type === 'convexLens' ? 'convexLens' : 'concaveLens', {
      hideFallback: true,
      scale: [0.72, 0.72, 0.72]
    });
  }

  const marker = new THREE.Mesh(
    new THREE.RingGeometry(selected ? 0.34 : 0.3, selected ? 0.37 : 0.325, 28),
    new THREE.MeshBasicMaterial({ color: 0x6842d8, transparent: true, opacity: 0.18, side: THREE.DoubleSide })
  );
  marker.rotation.x = -Math.PI / 2;
  marker.position.y = 0.355;
  group.add(marker);
  return group;
}

function makeConcaveLens(material) {
  const shape = new THREE.Shape();
  shape.moveTo(-0.2, -0.5);
  shape.quadraticCurveTo(0.12, 0, -0.2, 0.5);
  shape.lineTo(0.2, 0.5);
  shape.quadraticCurveTo(-0.12, 0, 0.2, -0.5);
  shape.lineTo(-0.2, -0.5);
  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth: 0.28,
    bevelEnabled: true,
    bevelSize: 0.018,
    bevelThickness: 0.018,
    bevelSegments: 6,
    curveSegments: 26
  });
  geometry.center();
  return new THREE.Mesh(geometry, material);
}

function makeFocusPlane(focusX) {
  const plane = new THREE.Mesh(
    new THREE.PlaneGeometry(0.7, 1.6),
    new THREE.MeshBasicMaterial({ color: 0xf0a73a, transparent: true, opacity: 0.12, side: THREE.DoubleSide })
  );
  plane.rotation.y = Math.PI / 2;
  plane.position.set(focusX * 0.17, 0.92, 0);
  return plane;
}

function makeHeatmapTexture(result, enabled) {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#f9fbff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.strokeStyle = 'rgba(104,66,216,0.22)';
  ctx.strokeRect(0.5, 0.5, canvas.width - 1, canvas.height - 1);
  if (enabled && result?.hitCount > 0) drawHeatmap(ctx, result, 1);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function drawHeatmap(ctx, result, zoom = 1) {
  const width = ctx.canvas.width;
  const height = ctx.canvas.height;
  const maxValue = Math.max(1e-9, ...result.irradianceMap.flat());
  const centerRow = Math.round((0.5 - result.peakPosition[0] / 9) * SCREEN_SIZE);
  const centerCol = Math.round((result.peakPosition[1] / 9 + 0.5) * SCREEN_SIZE);
  const span = SCREEN_SIZE / zoom;
  const startRow = Math.max(0, Math.min(SCREEN_SIZE - span, centerRow - span / 2));
  const startCol = Math.max(0, Math.min(SCREEN_SIZE - span, centerCol - span / 2));
  const cellW = width / span;
  const cellH = height / span;

  for (let row = 0; row < span; row += 1) {
    for (let col = 0; col < span; col += 1) {
      const sourceRow = Math.floor(startRow + row);
      const sourceCol = Math.floor(startCol + col);
      const value = result.irradianceMap[sourceRow]?.[sourceCol] ?? 0;
      if (!value) continue;
      ctx.fillStyle = heatColor(value / maxValue);
      ctx.fillRect(col * cellW, row * cellH, Math.ceil(cellW), Math.ceil(cellH));
    }
  }

  ctx.strokeStyle = 'rgba(16,18,37,0.28)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(width / 2, 0);
  ctx.lineTo(width / 2, height);
  ctx.moveTo(0, height / 2);
  ctx.lineTo(width, height / 2);
  ctx.stroke();
}

function heatColor(t) {
  const value = Math.max(0, Math.min(1, Math.sqrt(t)));
  const r = Math.round(20 + value * 235);
  const g = Math.round(80 + Math.sin(value * Math.PI) * 150);
  const b = Math.round(210 - value * 170);
  return `rgba(${r}, ${g}, ${b}, ${0.18 + value * 0.78})`;
}

function disposeMaterial(material) {
  if (!material) return;
  const materials = Array.isArray(material) ? material : [material];
  for (const entry of materials) {
    entry.map?.dispose();
    entry.dispose();
  }
}

function disposeGroup(group) {
  group.traverse((object) => {
    object.geometry?.dispose();
    disposeMaterial(object.material);
  });
}
