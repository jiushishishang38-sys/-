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
  resizeTextarea(field);
  field.addEventListener('input', () => {
    draft[key] = field.value;
    saveDraft(draft);
    resizeTextarea(field);
  });
});
