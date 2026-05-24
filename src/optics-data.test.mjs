import assert from 'node:assert/strict';
import {
  classifyEye,
  clearRowData,
  initialRows,
  renderDataTable,
  updateRowData
} from './optics.js';

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
