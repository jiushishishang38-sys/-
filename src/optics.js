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
  if (typeof localStorage === 'undefined') return initialRows();
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || initialRows();
  } catch {
    return initialRows();
  }
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

export function updateRowWithMeasurement(rows, eyeId, valueCm, fittedPower) {
  const row = rows.find((item) => item.id === eyeId);
  if (!row) return rows;
  row.measurements = [...(row.measurements || []), Number(valueCm.toFixed(2))].slice(-3);
  applyRowCalculations(row, fittedPower);
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

function renderDataTableLegacy(table, rows) {
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
