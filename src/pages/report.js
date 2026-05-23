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

const draft = loadDraft();

document.querySelectorAll('[data-report-draft]').forEach((field) => {
  const key = field.dataset.reportDraft;
  if (draft[key]) field.value = draft[key];
  resizeTextarea(field);
  field.addEventListener('input', () => {
    draft[key] = field.value;
    saveDraft(draft);
    resizeTextarea(field);
  });
});
