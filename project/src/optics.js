export const RETINA_CM = 24;
export const TEACHING_LENS_EFFECT_SCALE = 0.45;
export const FOCUS_CLEAR_TOLERANCE_CM = 0.8;
export const FOCUS_IMPROVE_TOLERANCE_CM = 2.8;
const STORAGE_KEY = 'eye-lab-rows-v2';
const ROW_IDS = ['A', 'B', 'C', 'D', 'E', 'F', 'G'];

const RETINA_DIOPTER = 100 / RETINA_CM;

function focusCmForTeachingCorrection(correctionPower) {
  return 100 / (RETINA_DIOPTER - correctionPower * TEACHING_LENS_EFFECT_SCALE);
}

export const EYES = {
  A: { id: 'A', focusCm: focusCmForTeachingCorrection(-3), correctionPower: -3, note: '高度屈光偏强' },
  B: { id: 'B', focusCm: focusCmForTeachingCorrection(-2), correctionPower: -2, note: '中度屈光偏强' },
  C: { id: 'C', focusCm: focusCmForTeachingCorrection(-1.5), correctionPower: -1.5, note: '轻度屈光偏强' },
  D: { id: 'D', focusCm: RETINA_CM, correctionPower: 0, note: '正视眼校准' },
  E: { id: 'E', focusCm: focusCmForTeachingCorrection(1.5), correctionPower: 1.5, note: '轻度屈光偏弱' },
  F: { id: 'F', focusCm: focusCmForTeachingCorrection(2), correctionPower: 2, note: '中度屈光偏弱' },
  G: { id: 'G', focusCm: focusCmForTeachingCorrection(3), correctionPower: 3, note: '高度屈光偏弱' },
  S: { id: 'S', focusCm: 24.0, astigmatic: true, note: '散光眼' }
};

export function diopterFromCm(cm) {
  return 100 / cm;
}

export function classifyEye(focusCm) {
  if (Math.abs(focusCm - RETINA_CM) < 0.55) return '正视眼';
  return focusCm < RETINA_CM ? '近视眼' : '远视眼';
}

export function correctionPowerForEye(focusCm) {
  return (diopterFromCm(RETINA_CM) - diopterFromCm(focusCm)) / TEACHING_LENS_EFFECT_SCALE;
}

export function recommendedLens(power) {
  if (Math.abs(power) < 0.15) return { type: 'none', label: '无需矫正' };
  return power < 0 ? { type: 'concave', label: '凹透镜' } : { type: 'convex', label: '凸透镜' };
}

export function initialRows() {
  return Object.values(EYES)
    .filter((eye) => eye.id !== 'S')
    .map((eye) => ({
      id: eye.id,
      measurements: [],
      average: '',
      diopter: '',
      type: eye.id === 'D' ? '正视眼' : '',
      correctionCalc: '',
      correctionFit: ''
    }));
}

export function saveRows(rows) {
  if (typeof localStorage === 'undefined') return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(rows));
}

function normalizeMeasurements(values = []) {
  return values
    .map((value) => Number(value))
    .filter((value) => Number.isFinite(value) && value > 0)
    .map((value) => Number(value.toFixed(2)))
    .slice(0, 3);
}

function normalizeStoredRows(value) {
  const defaultRows = initialRows();
  if (!Array.isArray(value) || value.length !== ROW_IDS.length) return defaultRows;
  const ids = value.map((row) => row?.id);
  if (!ROW_IDS.every((id) => ids.includes(id))) return defaultRows;

  const defaults = new Map(defaultRows.map((row) => [row.id, row]));
  const rows = [];
  for (const id of ROW_IDS) {
    const source = value.find((row) => row?.id === id);
    if (!Array.isArray(source?.measurements)) return defaultRows;
    const row = { ...defaults.get(id), measurements: normalizeMeasurements(source.measurements) };
    if (row.measurements.length) applyRowCalculations(row, source.correctionFit);
    rows.push(row);
  }
  return rows;
}

export function loadRows() {
  if (typeof localStorage === 'undefined') return initialRows();
  try {
    return normalizeStoredRows(JSON.parse(localStorage.getItem(STORAGE_KEY)));
  } catch {
    return initialRows();
  }
}

function resetRow(row) {
  row.measurements = [];
  row.average = '';
  row.diopter = '';
  row.type = '';
  row.correctionCalc = '';
  row.correctionFit = '';
}

function applyRowCalculations(row, fittedPower = row.correctionFit) {
  if (!row.measurements.length) {
    resetRow(row);
    return row;
  }
  const average = row.measurements.reduce((sum, item) => sum + item, 0) / row.measurements.length;
  const diopter = diopterFromCm(average);
  const correction = correctionPowerForEye(average);
  row.average = average.toFixed(2);
  row.diopter = diopter.toFixed(2);
  row.type = classifyEye(average);
  row.correctionCalc = correction.toFixed(2);
  const fitted = Number(fittedPower);
  row.correctionFit = Number.isFinite(fitted) ? fitted.toFixed(2) : '';
  return row;
}

export function updateRowData(rows, eyeId, values = {}) {
  const row = rows.find((item) => item.id === eyeId);
  if (!row) return rows;
  row.measurements = normalizeMeasurements(values.measurements);
  applyRowCalculations(row, values.correctionFit);
  saveRows(rows);
  return rows;
}

export function clearRowData(rows, eyeId) {
  const row = rows.find((item) => item.id === eyeId);
  if (!row) return rows;
  resetRow(row);
  saveRows(rows);
  return rows;
}

export function clearAllRowData(rows) {
  rows.forEach(resetRow);
  saveRows(rows);
  return rows;
}

export function updateRowWithMeasurement(rows, eyeId, valueCm, fittedPower) {
  const row = rows.find((item) => item.id === eyeId);
  if (!row) return rows;
  row.measurements = [...(row.measurements || []), Number(valueCm.toFixed(2))].slice(-3);
  applyRowCalculations(row, fittedPower);
  saveRows(rows);
  return rows;
}

export function normalizeLensPower(lensType, lensPower) {
  const power = Math.abs(Number(lensPower));
  if (!Number.isFinite(power) || lensType === 'none' || lensType === 'cylinder') return 0;
  return lensType === 'concave' ? -power : power;
}

export function classifyFocusClarity(errorCm) {
  const error = Math.abs(Number(errorCm));
  if (!Number.isFinite(error)) return 'blur';
  const comparisonEpsilon = 1e-9;
  if (error <= FOCUS_CLEAR_TOLERANCE_CM + comparisonEpsilon) return 'clear';
  if (error <= FOCUS_IMPROVE_TOLERANCE_CM + comparisonEpsilon) return 'improve';
  return 'blur';
}

export function evaluateExperiment({ eyeId, screenCm, lensPower = 0, lensType = 'none', cylinderAngle = 0 }) {
  const eye = EYES[eyeId] || EYES.D;
  const signedLens = normalizeLensPower(lensType, lensPower);
  const effectivePower = diopterFromCm(eye.focusCm) + signedLens * TEACHING_LENS_EFFECT_SCALE;
  const focusCm = 100 / Math.max(0.2, effectivePower);
  const cylinderActive = lensType === 'cylinder';
  const astigAngleTerm = Math.sin((cylinderAngle * Math.PI) / 90);
  const correctedAstigTerm = cylinderActive ? astigAngleTerm * 0.26 : astigAngleTerm;
  const target = eye.astigmatic ? RETINA_CM + correctedAstigTerm * 2.2 : RETINA_CM;
  const screenError = screenCm - focusCm;
  const retinaError = focusCm - target;
  const astigResidual = eye.astigmatic ? Math.abs(correctedAstigTerm) : 0;
  const sharpness = Math.max(0, 1 - Math.abs(screenError) / 8);
  const retinaSharpness = Math.max(0, 1 - Math.abs(retinaError) / 7);
  const spotRadius = estimateSpotRadiusCm(screenError, astigResidual);
  const clarity = classifyFocusClarity(screenError);
  const type = eye.astigmatic ? '散光眼' : classifyEye(eye.focusCm);
  const correction = correctionPowerForEye(eye.focusCm);
  return {
    eye,
    focusCm,
    screenError,
    retinaError,
    spotRadius,
    spotDiameter: spotRadius * 2,
    astigResidual,
    clarity,
    sharpness,
    retinaSharpness,
    type,
    correction,
    signedLensPower: signedLens,
    recommended: eye.astigmatic
      ? { type: 'cylinder', label: '柱面镜' }
      : recommendedLens(correction),
    isClearOnScreen: clarity === 'clear',
    isCorrected: eye.astigmatic
      ? cylinderActive
      : classifyFocusClarity(retinaError) === 'clear'
  };
}

function estimateSpotRadiusCm(screenError, astigResidual = 0) {
  const defocus = Math.abs(screenError);
  const focusPlateau = Math.sqrt(defocus * defocus + 0.42 * 0.42);
  const radius = 0.34 + focusPlateau * 0.28 + Math.pow(defocus, 1.18) * 0.12 + astigResidual * 1.25;
  return Number(Math.min(5.2, radius).toFixed(2));
}

export function estimateDetectorSpot(result) {
  const spotRadius = Number(result.spotRadius ?? estimateSpotRadiusCm(result.screenError, result.astigResidual));
  const spotDiameter = Number((spotRadius * 2).toFixed(2));
  const peakSignal = Number(Math.max(0.04, Math.min(1, 1 / (1 + spotRadius * spotRadius * 0.55))).toFixed(2));
  const focusClarity = result.clarity ?? classifyFocusClarity(result.screenError);
  const clarity = focusClarity === 'clear'
    ? '清晰小光斑'
    : focusClarity === 'improve'
      ? '轻度离焦'
      : '明显弥散光斑';
  return {
    spotRadius,
    spotDiameter,
    peakSignal,
    clarity,
    focusClarity,
    ellipticity: Number((1 + (result.astigResidual ?? 0) * 1.35).toFixed(2)),
    hitCount: 7
  };
}

export function sampleFocusMeasurement({ eyeId, screenCm, lensPower = 0, lensType = 'none', cylinderAngle = 0 }) {
  const result = evaluateExperiment({ eyeId, screenCm, lensPower, lensType, cylinderAngle });
  const spot = estimateDetectorSpot(result);
  const uncertainty = 0.08 + Math.min(0.46, spot.spotRadius * 0.08);
  const signedNoise = (Math.random() - 0.5) * 2 * uncertainty;
  const operatorBias = result.eye.astigmatic ? Math.sin((cylinderAngle * Math.PI) / 180) * 0.18 : 0;
  const measured = Number(screenCm) + signedNoise + operatorBias;
  return Number(Math.max(14, Math.min(36, measured)).toFixed(2));
}

const TEACHING_CM_TO_WORLD = 0.25;
export const TEACHING_COLLIMATOR_FOCAL_CM = 10;
const TEACHING_COLLIMATOR_APERTURE_CM = 5.2;
const TEACHING_CORRECTION_APERTURE_CM = 3.4;
const TEACHING_EYE_APERTURE_CM = 3.2;
const TEACHING_SCREEN_HALF_HEIGHT_CM = 4.2;
const TEACHING_SCREEN_HALF_WIDTH_CM = 2.9;

function toWorldPoint(point) {
  return [
    point[0] * TEACHING_CM_TO_WORLD,
    point[1] * TEACHING_CM_TO_WORLD,
    point[2] * TEACHING_CM_TO_WORLD
  ];
}

function appendTeachingPoint(path, ray) {
  path.push(toWorldPoint([ray.x, ray.y, ray.z]));
}

function propagateTeachingRay(ray, path, x, apertureRadius = Infinity) {
  const dx = x - ray.x;
  ray.y += ray.slopeY * dx;
  ray.z += ray.slopeZ * dx;
  ray.x = x;
  appendTeachingPoint(path, ray);
  return Math.hypot(ray.y, ray.z) <= apertureRadius;
}

function applyTeachingLens(ray, focalLengthCm, axisScale = 1) {
  if (!Number.isFinite(focalLengthCm) || Math.abs(focalLengthCm) < 0.2) return;
  ray.slopeY -= ray.y / focalLengthCm;
  ray.slopeZ -= (ray.z / focalLengthCm) * axisScale;
}

function traceTeachingRay({
  objectCm,
  collimatorCm,
  correctionCm,
  eyeCm,
  screenCm,
  objectY,
  collimatorY,
  collimatorZ,
  collimatorFocalCm,
  collimationState,
  correctionFocalCm,
  eyeFocalCm,
  astigmatic,
  cylinderAngle
}) {
  const safeCollimatorCm = Math.abs(collimatorCm - objectCm) < 1 ? objectCm + 1 : collimatorCm;
  const ray = {
    x: objectCm,
    y: objectY,
    z: 0,
    slopeY: (collimatorY - objectY) / (safeCollimatorCm - objectCm),
    slopeZ: collimatorZ / (safeCollimatorCm - objectCm)
  };
  const path = [];
  appendTeachingPoint(path, ray);

  if (!propagateTeachingRay(ray, path, collimatorCm, TEACHING_COLLIMATOR_APERTURE_CM)) return path;
  if (collimationState === 'parallel') {
    ray.slopeY = 0;
    ray.slopeZ = 0;
  } else {
    applyTeachingLens(ray, collimatorFocalCm);
  }

  if (correctionFocalCm) {
    if (!propagateTeachingRay(ray, path, correctionCm, TEACHING_CORRECTION_APERTURE_CM)) return path;
    applyTeachingLens(ray, correctionFocalCm);
  } else {
    propagateTeachingRay(ray, path, correctionCm, Infinity);
  }

  if (!propagateTeachingRay(ray, path, eyeCm, TEACHING_EYE_APERTURE_CM)) return path;
  const astigAmount = astigmatic ? Math.sin((cylinderAngle * Math.PI) / 90) * 0.22 : 0;
  applyTeachingLens(ray, eyeFocalCm, 1 + astigAmount);

  propagateTeachingRay(ray, path, screenCm, Infinity);
  const screenMiss = Math.abs(ray.y) > TEACHING_SCREEN_HALF_HEIGHT_CM || Math.abs(ray.z) > TEACHING_SCREEN_HALF_WIDTH_CM;
  if (screenMiss) {
    const last = path[path.length - 1];
    last[1] = Math.max(-TEACHING_SCREEN_HALF_HEIGHT_CM, Math.min(TEACHING_SCREEN_HALF_HEIGHT_CM, ray.y)) * TEACHING_CM_TO_WORLD;
    last[2] = Math.max(-TEACHING_SCREEN_HALF_WIDTH_CM, Math.min(TEACHING_SCREEN_HALF_WIDTH_CM, ray.z)) * TEACHING_CM_TO_WORLD;
  }
  return path;
}

export function traceTeachingRays({ eyeId, lensType, lensPower, screenCm, cylinderAngle, objectCm = -24, collimatorCm = -14 }) {
  const result = evaluateExperiment({ eyeId, lensType, lensPower, screenCm, cylinderAngle });
  const safeObjectCm = Math.min(Number(objectCm), Number(collimatorCm) - 1);
  const sourceDistanceCm = Number(collimatorCm) - safeObjectCm;
  const collimationDeltaCm = sourceDistanceCm - TEACHING_COLLIMATOR_FOCAL_CM;
  const collimationState = Math.abs(collimationDeltaCm) < 0.2
    ? 'parallel'
    : collimationDeltaCm < 0
      ? 'diverging'
      : 'converging';
  const eye = EYES[eyeId] || EYES.D;
  const signedLensPower = normalizeLensPower(lensType, lensPower);
  const effectiveCorrectionPower = signedLensPower * TEACHING_LENS_EFFECT_SCALE;
  const correctionFocalCm = Math.abs(effectiveCorrectionPower) > 0.01 ? 100 / effectiveCorrectionPower : 0;
  const correctionCm = -1.35 / TEACHING_CM_TO_WORLD;
  const eyeCm = 0;
  const samples = [
    [-TEACHING_COLLIMATOR_APERTURE_CM * 0.78, 0],
    [-TEACHING_COLLIMATOR_APERTURE_CM * 0.38, 0],
    [0, 0],
    [TEACHING_COLLIMATOR_APERTURE_CM * 0.38, 0],
    [TEACHING_COLLIMATOR_APERTURE_CM * 0.78, 0],
    [0, -TEACHING_COLLIMATOR_APERTURE_CM * 0.42],
    [0, TEACHING_COLLIMATOR_APERTURE_CM * 0.42]
  ];
  const rays = samples.map(([collimatorY, collimatorZ]) => traceTeachingRay({
    objectCm: safeObjectCm,
    collimatorCm,
    correctionCm,
    eyeCm,
    screenCm,
    objectY: 0,
    collimatorY,
    collimatorZ,
    collimatorFocalCm: TEACHING_COLLIMATOR_FOCAL_CM,
    collimationState,
    correctionFocalCm,
    eyeFocalCm: eye.focusCm,
    astigmatic: Boolean(eye.astigmatic) && lensType !== 'cylinder',
    cylinderAngle
  }));
  return {
    rays,
    result,
    spot: estimateDetectorSpot(result),
    collimation: {
      distanceCm: sourceDistanceCm,
      focalLengthCm: TEACHING_COLLIMATOR_FOCAL_CM,
      deltaCm: collimationDeltaCm,
      rayState: collimationState,
      isCollimated: collimationState === 'parallel'
    }
  };
}

function formatTableValue(value) {
  return value === undefined || value === null || value === '' ? '<span class="empty-cell">—</span>' : value;
}

function renderMeasurementCell(row, index, editing) {
  const value = row.measurements?.[index] ?? '';
  if (!editing) return `<td>${formatTableValue(value)}</td>`;
  return `
    <td>
      <input class="table-input" type="number" min="0" step="0.01"
        value="${value}" data-field="measurement" data-index="${index}" aria-label="${row.id} 焦距 ${index + 1}" />
    </td>`;
}

function renderFitCell(row, editing) {
  if (!editing) return `<td>${formatTableValue(row.correctionFit)}</td>`;
  return `
    <td>
      <input class="table-input" type="number" step="0.01"
        value="${row.correctionFit ?? ''}" data-field="correctionFit" aria-label="${row.id} 实配值" />
    </td>`;
}

function renderActionCell(row, editing) {
  if (editing) {
    return `
      <td class="table-actions">
        <button type="button" class="button small primary" data-row-action="save" data-eye-id="${row.id}">保存</button>
        <button type="button" class="button small" data-row-action="cancel" data-eye-id="${row.id}">取消</button>
      </td>`;
  }
  return `
    <td class="table-actions">
      <button type="button" class="button small" data-row-action="edit" data-eye-id="${row.id}">修改</button>
      <button type="button" class="button small danger" data-row-action="delete" data-eye-id="${row.id}">删除</button>
    </td>`;
}

export function renderDataTable(table, rows, options = {}) {
  const editable = options.editable === true;
  const editingId = options.editingId ?? '';
  table.innerHTML = `
    <thead>
      <tr>
        <th>模拟眼</th><th>焦距 1 cm</th><th>焦距 2 cm</th><th>焦距 3 cm</th>
        <th>平均值 cm</th><th>焦度 D</th><th>屈光不正性质</th>
        <th>矫正镜片焦度计算值 D</th><th>实配值 D</th>${editable ? '<th>操作</th>' : ''}
      </tr>
    </thead>
    <tbody>
      ${rows.map((row) => {
        const editing = editable && editingId === row.id;
        return `
        <tr data-eye-row="${row.id}"${editing ? ' class="editing-row"' : ''}>
          <td>${row.id}</td>
          ${[0, 1, 2].map((index) => renderMeasurementCell(row, index, editing)).join('')}
          <td>${formatTableValue(row.average)}</td>
          <td>${formatTableValue(row.diopter)}</td>
          <td>${formatTableValue(row.type)}</td>
          <td>${formatTableValue(row.correctionCalc)}</td>
          ${renderFitCell(row, editing)}
          ${editable ? renderActionCell(row, editing) : ''}
        </tr>`;
      }).join('')}
    </tbody>`;
}
