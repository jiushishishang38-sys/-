import assert from 'node:assert/strict';
import * as optics from './optics.js';

const {
  classifyEye,
  clearRowData,
  evaluateExperiment,
  initialRows,
  loadRows,
  normalizeLensPower,
  renderDataTable,
  updateRowData
} = optics;

const rows = initialRows();

const edited = updateRowData(rows, 'A', {
  measurements: ['17.5', '18', '', 'bad'],
  correctionFit: '-1.25'
});
const rowA = edited.find((row) => row.id === 'A');

assert.deepEqual(rowA.measurements, [17.5, 18]);
assert.equal(rowA.average, '17.75');
assert.equal(rowA.diopter, '5.63');
assert.equal(rowA.type, classifyEye(17.75));
assert.equal(rowA.correctionCalc, '-1.47');
assert.equal(rowA.correctionFit, '-1.25');

const cleared = clearRowData(edited, 'A');
assert.deepEqual(cleared.find((row) => row.id === 'A'), {
  id: 'A',
  measurements: [],
  average: '',
  diopter: '',
  type: '',
  correctionCalc: '',
  correctionFit: ''
});
assert.equal(cleared.length, 7);

const reportTable = { innerHTML: '' };
renderDataTable(reportTable, cleared);
assert.match(reportTable.innerHTML, /<th>模拟眼<\/th>/);
assert.doesNotMatch(reportTable.innerHTML, /data-row-action/);

const editableTable = { innerHTML: '' };
renderDataTable(editableTable, cleared, { editable: true, editingId: 'B' });
assert.match(editableTable.innerHTML, /<th>操作<\/th>/);
assert.match(editableTable.innerHTML, /data-row-action="delete" data-eye-id="A"/);
assert.match(editableTable.innerHTML, /data-row-action="save" data-eye-id="B"/);
assert.match(editableTable.innerHTML, /data-field="measurement" data-index="0"/);

const originalStorage = globalThis.localStorage;
function withStoredRows(value, callback) {
  globalThis.localStorage = {
    getItem: () => value,
    setItem: () => {}
  };
  try {
    return callback();
  } finally {
    if (originalStorage === undefined) {
      delete globalThis.localStorage;
    } else {
      globalThis.localStorage = originalStorage;
    }
  }
}

assert.equal(withStoredRows('{}', () => loadRows()).length, 7);
assert.equal(withStoredRows(JSON.stringify([{ id: 'A' }]), () => loadRows()).length, 7);

const loadedRows = withStoredRows(JSON.stringify([
  { id: 'A', measurements: ['17.234', '-1', 'bad', '18.2'], correctionFit: '-1.5' },
  { id: 'B', measurements: [20.8], correctionFit: '' },
  { id: 'C', measurements: [], correctionFit: '' },
  { id: 'D', measurements: [], correctionFit: '' },
  { id: 'E', measurements: [], correctionFit: '' },
  { id: 'F', measurements: [], correctionFit: '' },
  { id: 'G', measurements: [], correctionFit: '' }
]), () => loadRows());
assert.deepEqual(loadedRows.find((row) => row.id === 'A').measurements, [17.23, 18.2]);
assert.equal(loadedRows.find((row) => row.id === 'A').average, '17.71');

assert.equal(typeof normalizeLensPower, 'function');
assert.equal(normalizeLensPower('concave', 2.5), -2.5);
assert.equal(normalizeLensPower('concave', -2.5), -2.5);
assert.equal(normalizeLensPower('convex', -3), 3);
assert.equal(normalizeLensPower('none', 3), 0);

const concaveResult = evaluateExperiment({ eyeId: 'D', screenCm: 24, lensType: 'concave', lensPower: 2 });
const convexResult = evaluateExperiment({ eyeId: 'D', screenCm: 24, lensType: 'convex', lensPower: -2 });
assert.equal(concaveResult.signedLensPower, -2);
assert.equal(convexResult.signedLensPower, 2);
