const experimentEntryHashes = new Set(['', '#preset', '#free']);

if (experimentEntryHashes.has(window.location.hash)) {
  if ('scrollRestoration' in window.history) {
    window.history.scrollRestoration = 'manual';
  }

  window.addEventListener('pageshow', () => {
    window.requestAnimationFrame(() => {
      window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
    });
  }, { once: true });
}

const labLayout = document.querySelector('.lab-layout');
const dataSection = document.querySelector('.data-section');
const collimationModule = document.getElementById('collimation-module');

if (labLayout && dataSection) {
  let benchNavigationInitialized = false;

  function initializeBenchNavigation() {
    if (benchNavigationInitialized) return true;
    const panelLinks = [...document.querySelectorAll('[data-bench-panel]')];
    if (panelLinks.length === 0) return false;
    benchNavigationInitialized = true;

    let freeBenchMounted = false;
    let freeBenchLoading = false;
    const freeHost = document.createElement('section');
    freeHost.id = 'free-bench-module';
    freeHost.className = 'free-bench page-panel no-print';
    freeHost.hidden = true;
    dataSection.after(freeHost);

    async function showBenchPanel(panel, updateHash = true) {
      const showFree = panel === 'free';
      panelLinks.forEach((link) => {
        const current = link.dataset.benchPanel === panel;
        link.classList.toggle('is-current', current);
        if (current) link.setAttribute('aria-current', 'page');
        else link.removeAttribute('aria-current');
      });
      if (collimationModule) collimationModule.hidden = showFree;
      labLayout.hidden = showFree;
      dataSection.hidden = showFree;
      freeHost.hidden = !showFree;

      if (updateHash) {
        history.replaceState(null, '', showFree ? '#free' : '#preset');
      }

      const dropdown = document.querySelector('.nav-dropdown');
      dropdown?.classList.remove('is-open');
      dropdown?.querySelector('.nav-dropdown-trigger')?.setAttribute('aria-expanded', 'false');

      if (!showFree || freeBenchMounted || freeBenchLoading) return;
      freeBenchLoading = true;
      try {
        const { mountFreeBench } = await import('./free-bench.js');
        await mountFreeBench(freeHost);
        freeBenchMounted = true;
        requestAnimationFrame(() => window.dispatchEvent(new Event('resize')));
      } finally {
        freeBenchLoading = false;
      }
    }

    panelLinks.forEach((link) => {
      link.addEventListener('click', (event) => {
        const targetUrl = new URL(link.href, window.location.href);
        if (targetUrl.pathname !== window.location.pathname) return;
        event.preventDefault();
        showBenchPanel(link.dataset.benchPanel);
      });
    });

    window.addEventListener('hashchange', () => {
      const panel = window.location.hash === '#free' ? 'free' : 'preset';
      showBenchPanel(panel, false);
    });

    const initialPanel = window.location.hash === '#free' ? 'free' : 'preset';
    showBenchPanel(initialPanel, false);
    return true;
  }

  if (!initializeBenchNavigation()) {
    document.addEventListener('experiment-navigation-ready', initializeBenchNavigation, { once: true });
  }
}
