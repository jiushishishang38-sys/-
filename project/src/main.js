const page = document.body.dataset.page;

function enhanceExperimentNavigation() {
  const nav = document.querySelector('.nav');
  if (!nav) return null;

  const experimentLink = [...nav.children].find((item) => (
    item.matches('a') && new URL(item.href, window.location.href).pathname.endsWith('/experiment.html')
  ));
  if (!experimentLink) return null;

  const dropdown = document.createElement('div');
  dropdown.className = 'nav-dropdown';
  experimentLink.before(dropdown);
  experimentLink.classList.add('nav-dropdown-trigger');

  const menuId = 'experiment-nav-menu';
  experimentLink.setAttribute('aria-haspopup', 'true');
  experimentLink.setAttribute('aria-expanded', 'false');
  experimentLink.setAttribute('aria-controls', menuId);

  const menu = document.createElement('div');
  menu.className = 'nav-dropdown-menu';
  menu.id = menuId;
  menu.setAttribute('aria-label', '模拟实验子模块');
  menu.innerHTML = `
    <a class="nav-dropdown-option" href="./experiment.html#preset" data-bench-panel="preset">
      <span class="nav-dropdown-index" aria-hidden="true">01</span>
      <span><strong>预设演示</strong><small>按教材流程完成屈光矫正实验</small></span>
    </a>
    <a class="nav-dropdown-option" href="./experiment.html#free" data-bench-panel="free">
      <span class="nav-dropdown-index" aria-hidden="true">02</span>
      <span><strong>自由搭建</strong><small>自由组合光源与光学元件</small></span>
    </a>
  `;

  dropdown.append(experimentLink, menu);

  const setOpen = (open) => {
    dropdown.classList.toggle('is-open', open);
    experimentLink.setAttribute('aria-expanded', String(open));
  };

  experimentLink.addEventListener('click', (event) => {
    event.preventDefault();
    event.stopPropagation();
    setOpen(!dropdown.classList.contains('is-open'));
  });
  dropdown.addEventListener('focusout', (event) => {
    if (!dropdown.contains(event.relatedTarget)) setOpen(false);
  });
  dropdown.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') return;
    setOpen(false);
    experimentLink.focus();
  });
  document.addEventListener('click', (event) => {
    if (!dropdown.contains(event.target)) setOpen(false);
  });

  return dropdown;
}

const experimentNavigation = enhanceExperimentNavigation();
if (experimentNavigation) {
  document.dispatchEvent(new Event('experiment-navigation-ready'));
}

document.querySelectorAll('.nav > a, .nav-dropdown > .nav-dropdown-trigger').forEach((link) => {
  if (link.href.includes(`${page}.html`)) {
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
