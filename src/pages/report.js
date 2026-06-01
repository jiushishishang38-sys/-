import { loadRows, renderDataTable } from '../optics.js';

const rows = loadRows();
renderDataTable(document.getElementById('report-table'), rows);

const DRAFT_KEY = 'eye-lab-report-draft-v1';

function loadDraft() {
  try {
    return JSON.parse(localStorage.getItem(DRAFT_KEY)) || {};
  } catch {
    return {};
  }
}

function saveDraft(draft) {
  localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
}

function resizeTextarea(textarea) {
  textarea.style.height = 'auto';
  textarea.style.height = `${textarea.scrollHeight}px`;
}

function resizeDraftField(field) {
  if (field.matches('textarea')) resizeTextarea(field);
}

function syncPrintCopy(field) {
  const copy = field.nextElementSibling;
  if (!copy?.matches('.print-field-copy, .print-input-copy')) return;
  copy.textContent = field.value || field.placeholder || '';
}

function createPrintCopy(field) {
  if (field.matches('input') && !field.nextElementSibling?.matches('.print-input-copy')) {
    const copy = document.createElement('span');
    copy.className = 'print-input-copy';
    field.insertAdjacentElement('afterend', copy);
    syncPrintCopy(field);
    return;
  }
  if (!field.matches('textarea') || field.nextElementSibling?.matches('.print-field-copy')) return;
  const copy = document.createElement('div');
  copy.className = field.classList.contains('answer-field') ? 'print-field-copy answer-copy' : 'print-field-copy';
  field.insertAdjacentElement('afterend', copy);
  syncPrintCopy(field);
}

const draft = loadDraft();
const reportDateInput = document.getElementById('report-date');

function formatLocalDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

if (reportDateInput && !reportDateInput.value) {
  reportDateInput.value = formatLocalDate(new Date());
}

document.querySelectorAll('[data-report-draft]').forEach((field) => {
  const key = field.dataset.reportDraft;
  if (draft[key]) field.value = draft[key];
  createPrintCopy(field);
  resizeDraftField(field);
  field.addEventListener('input', () => {
    draft[key] = field.value;
    saveDraft(draft);
    syncPrintCopy(field);
    resizeDraftField(field);
  });
});

window.addEventListener('beforeprint', () => {
  document.querySelectorAll('input[data-report-draft]').forEach(syncPrintCopy);
  document.querySelectorAll('textarea').forEach((textarea) => {
    resizeTextarea(textarea);
    syncPrintCopy(textarea);
  });
});
