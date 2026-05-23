export const RETINA_CM = 24;
const STORAGE_KEY = 'eye-lab-rows-v2';

export const EYES = {
  A: { id: 'A', focusCm: 17.6, note: '屈光系统偏强' },
  B: { id: 'B', focusCm: 20.8, note: '轻度屈光偏强' },
  C: { id: 'C', focusCm: 22.6, note: '接近正视但偏强' },
  D: { id: 'D', focusCm: 24.0, note: '正视眼校准' },
  E: { id: 'E', focusCm: 26.4, note: '轻度屈光偏弱' },
  F: { id: 'F', focusCm: 29.1, note: '屈光系统偏弱' },
  G: { id: 'G', focusCm: 31.8, note: '明显屈光偏弱' },
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
  return diopterFromCm(RETINA_CM) - diopterFromCm(focusCm);
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

export function loadRows() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || initialRows();
  } catch {
    return initialRows();
  }
}

export function saveRows(rows) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(rows));
}

export function updateRowWithMeasurement(rows, eyeId, valueCm, fittedPower) {
  const row = rows.find((item) => item.id === eyeId);
  if (!row) return rows;
  row.measurements = [...(row.measurements || []), Number(valueCm.toFixed(2))].slice(-3);
  const average = row.measurements.reduce((sum, item) => sum + item, 0) / row.measurements.length;
  const diopter = diopterFromCm(average);
  const correction = correctionPowerForEye(average);
  row.average = average.toFixed(2);
  row.diopter = diopter.toFixed(2);
  row.type = classifyEye(average);
  row.correctionCalc = correction.toFixed(2);
  row.correctionFit = Number.isFinite(fittedPower) ? fittedPower.toFixed(2) : '';
  saveRows(rows);
  return rows;
}

export function evaluateExperiment({ eyeId, screenCm, lensPower = 0, lensType = 'none', cylinderAngle = 0 }) {
  const eye = EYES[eyeId] || EYES.D;
  const signedLens = lensType === 'none' ? 0 : Number(lensPower);
  const effectivePower = diopterFromCm(eye.focusCm) + signedLens;
  const focusCm = 100 / Math.max(0.2, effectivePower);
  const target = eye.astigmatic ? RETINA_CM + Math.sin((cylinderAngle * Math.PI) / 90) * 2.2 : RETINA_CM;
  const screenError = screenCm - focusCm;
  const retinaError = focusCm - target;
  const sharpness = Math.max(0, 1 - Math.abs(screenError) / 8);
  const retinaSharpness = Math.max(0, 1 - Math.abs(retinaError) / 7);
  const type = eye.astigmatic ? '散光眼' : classifyEye(eye.focusCm);
  const correction = correctionPowerForEye(eye.focusCm);
  return {
    eye,
    focusCm,
    screenError,
    retinaError,
    sharpness,
    retinaSharpness,
    type,
    correction,
    recommended: recommendedLens(correction),
    isClearOnScreen: Math.abs(screenError) < 0.8,
    isCorrected: Math.abs(retinaError) < 0.8 || (eye.astigmatic && Math.abs(Math.sin((cylinderAngle * Math.PI) / 90)) < 0.18)
  };
}

export function traceTeachingRays({ eyeId, lensType, lensPower, screenCm, cylinderAngle, objectCm = -24, collimatorCm = -14 }) {
  const result = evaluateExperiment({ eyeId, lensType, lensPower, screenCm, cylinderAngle });
  const sourceX = -7;
  const objectX = objectCm / 4;
  const collimatorX = collimatorCm / 4;
  const correctionX = -1.35;
  const eyeX = 0;
  const focusX = result.focusCm / 4;
  const screenX = screenCm / 4;
  const lensStrength = lensType === 'none' ? 0 : Math.min(Math.abs(Number(lensPower)) / 8, 1);
  const correctionScale = lensType === 'concave'
    ? 0.82 + lensStrength * 0.28
    : lensType === 'convex'
      ? 0.72 - lensStrength * 0.22
      : 0.78;
  const astigOffset = (EYES[eyeId] || EYES.D).astigmatic ? Math.sin((cylinderAngle * Math.PI) / 90) * 0.18 : 0;
  const rays = [-1.2, 0, 1.2].map((y) => [
    [Math.min(sourceX - 0.8, objectX - 0.8), y, 0],
    [objectX, y, 0],
    [collimatorX, y * 0.35, 0],
    [correctionX, y * correctionScale + astigOffset, 0],
    [eyeX, y * 0.45 + astigOffset * 0.55, 0],
    [focusX, 0, 0],
    [screenX, result.screenError * 0.08 + y * 0.05, 0]
  ]);
  return { rays, result };
}

export function renderDataTable(table, rows) {
  table.innerHTML = `
    <thead>
      <tr>
        <th>模拟眼</th><th>焦距 1 cm</th><th>焦距 2 cm</th><th>焦距 3 cm</th>
        <th>平均值 cm</th><th>焦度 D</th><th>屈光不正性质</th>
        <th>矫正镜片焦度计算值 D</th><th>实配值 D</th>
      </tr>
    </thead>
    <tbody>
      ${rows.map((row) => `
        <tr>
          <td>${row.id}</td>
          <td>${row.measurements?.[0] ?? ''}</td>
          <td>${row.measurements?.[1] ?? ''}</td>
          <td>${row.measurements?.[2] ?? ''}</td>
          <td>${row.average ?? ''}</td>
          <td>${row.diopter ?? ''}</td>
          <td>${row.type ?? ''}</td>
          <td>${row.correctionCalc ?? ''}</td>
          <td>${row.correctionFit ?? ''}</td>
        </tr>`).join('')}
    </tbody>`;
}
