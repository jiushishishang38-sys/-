const steps = [...document.querySelectorAll('.quiz-step')];
const stepLabel = document.getElementById('quiz-step-label');
const progressBar = document.querySelector('.quiz-progress i');
const prevButton = document.getElementById('prev-question');
const nextButton = document.getElementById('next-question');
const resultPanel = document.querySelector('.quiz-result');
const scoreTitle = document.getElementById('quiz-score');
const analysisList = document.getElementById('analysis-list');
const restartButton = document.getElementById('restart-quiz');
const answers = new Array(steps.length).fill(null);
let current = 0;

function optionText(step, choice) {
  return step.querySelector(`[data-choice="${choice}"]`)?.textContent.trim() || '';
}

function renderStep() {
  steps.forEach((step, index) => {
    const active = index === current;
    step.classList.toggle('active', active);
    step.hidden = !active;
  });

  const answered = answers[current] !== null;
  const done = answers.every(Boolean);
  stepLabel.textContent = `第 ${current + 1} / ${steps.length} 题`;
  progressBar.style.width = `${((current + 1) / steps.length) * 100}%`;
  prevButton.disabled = current === 0;
  nextButton.disabled = !answered;
  nextButton.textContent = current === steps.length - 1 ? '查看解析' : '下一题';

  if (done && current === steps.length - 1) {
    nextButton.disabled = false;
  }
}

function selectAnswer(step, choice) {
  const index = steps.indexOf(step);
  answers[index] = choice;

  step.querySelectorAll('[data-choice]').forEach((button) => {
    button.classList.toggle('selected', button.dataset.choice === choice);
  });

  renderStep();
}

function showResult() {
  const correctCount = steps.reduce((total, step, index) => (
    total + (answers[index] === step.dataset.answer ? 1 : 0)
  ), 0);

  steps.forEach((step) => {
    step.hidden = true;
    step.classList.remove('active');
  });

  document.querySelector('.quiz-status').hidden = true;
  document.querySelector('.quiz-shell > .quiz-actions').hidden = true;
  resultPanel.hidden = false;
  scoreTitle.textContent = `本次得分：${correctCount} / ${steps.length}`;
  analysisList.innerHTML = steps.map((step, index) => {
    const selected = answers[index];
    const correct = step.dataset.answer;
    const ok = selected === correct;
    return `
      <article class="analysis-item ${ok ? 'correct' : 'wrong'}">
        <h3>${index + 1}. ${step.querySelector('h2').innerHTML}</h3>
        <p><strong>你的答案：</strong>${optionText(step, selected) || '未作答'}</p>
        <p><strong>正确答案：</strong>${optionText(step, correct)}</p>
        <p>${step.dataset.explain}</p>
      </article>
    `;
  }).join('');
}

function restartQuiz() {
  answers.fill(null);
  current = 0;
  resultPanel.hidden = true;
  document.querySelector('.quiz-status').hidden = false;
  document.querySelector('.quiz-shell > .quiz-actions').hidden = false;
  steps.forEach((step) => {
    step.querySelectorAll('[data-choice]').forEach((button) => {
      button.classList.remove('selected');
    });
  });
  renderStep();
}

steps.forEach((step) => {
  step.querySelectorAll('[data-choice]').forEach((button) => {
    button.addEventListener('click', () => selectAnswer(step, button.dataset.choice));
  });
});

prevButton.addEventListener('click', () => {
  current = Math.max(0, current - 1);
  renderStep();
});

nextButton.addEventListener('click', () => {
  if (current === steps.length - 1) {
    showResult();
    return;
  }
  current += 1;
  renderStep();
});

restartButton.addEventListener('click', restartQuiz);
renderStep();
