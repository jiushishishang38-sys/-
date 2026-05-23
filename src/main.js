const page = document.body.dataset.page;

document.querySelectorAll('.nav a').forEach((link) => {
  if (link.href.includes(`${page}.html`) || (page === 'home' && link.href.endsWith('/course.html'))) {
    link.classList.add('active');
  }
});

function markAnswer(card, choice) {
  const ok = card.dataset.answer === choice;
  const feedback = card.querySelector('small');
  feedback.textContent = ok ? '回答正确：这个判断与光路规律一致。' : '再观察光路：注意焦点在视网膜前后的位置。';
  feedback.style.color = ok ? 'var(--green)' : 'var(--amber)';
}

document.querySelectorAll('.quiz-card, .quick-question').forEach((card) => {
  card.querySelectorAll('[data-choice]').forEach((button) => {
    button.addEventListener('click', () => markAnswer(card, button.dataset.choice));
  });
});

document.querySelectorAll('[data-close-modal]').forEach((button) => {
  button.addEventListener('click', () => button.closest('.modal')?.classList.remove('open'));
});

document.getElementById('print-report')?.addEventListener('click', () => window.print());
