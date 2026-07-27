import { GLTFLoader } from './vendor/GLTFLoader.js';

export const OPTICS_MODELS = Object.freeze({
  bench: new URL('./assets/models/optics/bench.glb', import.meta.url).href,
  sourceParallel: new URL('./assets/models/optics/source-parallel.glb', import.meta.url).href,
  sourcePoint: new URL('./assets/models/optics/source-point.glb', import.meta.url).href,
  objectScreen: new URL('./assets/models/optics/object-screen.glb', import.meta.url).href,
  imageScreen: new URL('./assets/models/optics/image-screen.glb', import.meta.url).href,
  convexLens: new URL('./assets/models/optics/lens-convex.glb', import.meta.url).href,
  concaveLens: new URL('./assets/models/optics/lens-concave.glb', import.meta.url).href,
  cylinderLens: new URL('./assets/models/optics/lens-cylinder.glb', import.meta.url).href,
  correctionSupport: new URL('./assets/models/optics/correction-support.glb', import.meta.url).href,
  eyeA: new URL('./assets/models/optics/sim-eye-a.glb', import.meta.url).href,
  eyeB: new URL('./assets/models/optics/sim-eye-b.glb', import.meta.url).href,
  eyeC: new URL('./assets/models/optics/sim-eye-c.glb', import.meta.url).href,
  eyeD: new URL('./assets/models/optics/sim-eye-d.glb', import.meta.url).href,
  eyeE: new URL('./assets/models/optics/sim-eye-e.glb', import.meta.url).href,
  eyeF: new URL('./assets/models/optics/sim-eye-f.glb', import.meta.url).href,
  eyeG: new URL('./assets/models/optics/sim-eye-g.glb', import.meta.url).href,
  concaveMirror: new URL('./assets/models/optics/mirror-concave.glb', import.meta.url).href,
  convexMirror: new URL('./assets/models/optics/mirror-convex.glb', import.meta.url).href
});

const loader = new GLTFLoader();
const cache = new Map();
const warnedMissing = new Set();

function configureModel(root) {
  root.traverse((child) => {
    child.userData.ignoreRaycast = child.userData.ignoreRaycast ?? false;
    if (child.isMesh) {
      child.castShadow = true;
      child.receiveShadow = true;
      if (child.material?.transparent) {
        child.material.depthWrite = child.material.opacity > 0.55;
      }
    }
  });
}

export async function loadOpticsModel(modelKey) {
  const url = OPTICS_MODELS[modelKey];
  if (!url) return null;
  if (!cache.has(modelKey)) {
    cache.set(modelKey, new Promise((resolve) => {
      loader.load(
        url,
        (gltf) => {
          configureModel(gltf.scene);
          resolve(gltf.scene);
        },
        undefined,
        () => {
          if (!warnedMissing.has(modelKey)) {
            warnedMissing.add(modelKey);
            console.warn(`Optics model unavailable: ${url}`);
          }
          resolve(null);
        }
      );
    }));
  }
  const source = await cache.get(modelKey);
  if (!source) return null;
  const clone = source.clone(true);
  configureModel(clone);
  return clone;
}

export function applyModelTransform(model, {
  position = [0, 0, 0],
  rotation = [0, 0, 0],
  scale = [1, 1, 1]
} = {}) {
  model.position.set(position[0], position[1], position[2]);
  model.rotation.set(rotation[0], rotation[1], rotation[2]);
  model.scale.set(scale[0], scale[1], scale[2]);
  return model;
}

export function attachOpticsModel(target, modelKey, options = {}) {
  target.userData.pendingModelKey = modelKey;
  loadOpticsModel(modelKey).then((model) => {
    if (!model || target.userData.pendingModelKey !== modelKey) return;
    applyModelTransform(model, options);
    model.userData.isLoadedOpticsModel = true;
    ['itemId', 'parentDrag'].forEach((key) => {
      if (target.userData[key] !== undefined) model.userData[key] = target.userData[key];
    });
    model.traverse((child) => {
      ['itemId', 'parentDrag'].forEach((key) => {
        if (target.userData[key] !== undefined) child.userData[key] = target.userData[key];
      });
    });
    target.add(model);
    if (options.hideFallback !== false) {
      target.children.forEach((child) => {
        if (child !== model && !child.userData.keepWithModel) child.visible = false;
      });
    }
    target.userData.loadedModel = model;
  });
}

export function setOpticsModel(target, modelKey, options = {}) {
  if (target.userData.loadedModel) {
    target.remove(target.userData.loadedModel);
    target.userData.loadedModel = null;
  }
  target.children.forEach((child) => {
    if (!child.userData.isLoadedOpticsModel) child.visible = true;
  });
  attachOpticsModel(target, modelKey, options);
}
