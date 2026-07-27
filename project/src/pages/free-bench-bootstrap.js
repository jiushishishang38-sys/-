const labLayout = document.querySelector('.lab-layout');
const dataSection = document.querySelector('.data-section');

if (labLayout && dataSection) {
  let freeBenchMounted = false;
  let freeBenchLoading = false;
  const tabs = document.createElement('section');
  tabs.className = 'bench-tabs no-print';
  tabs.innerHTML = `
    <button class="bench-tab active" type="button" data-bench-panel="preset">预设演示</button>
    <button class="bench-tab" type="button" data-bench-panel="free">自由搭建</button>
  `;
  labLayout.before(tabs);

  const freeHost = document.createElement('section');
  freeHost.id = 'free-bench-module';
  freeHost.className = 'free-bench page-panel no-print';
  freeHost.hidden = true;
  dataSection.after(freeHost);

  tabs.addEventListener('click', async (event) => {
    const button = event.target.closest('[data-bench-panel]');
    if (!button) return;
    const showFree = button.dataset.benchPanel === 'free';
    tabs.querySelectorAll('.bench-tab').forEach((tab) => tab.classList.toggle('active', tab === button));
    labLayout.hidden = showFree;
    dataSection.hidden = showFree;
    freeHost.hidden = !showFree;

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
  });

  if (window.location.hash === '#free') {
    requestAnimationFrame(() => {
      tabs.querySelector('[data-bench-panel="free"]')?.click();
    });
  }
}
