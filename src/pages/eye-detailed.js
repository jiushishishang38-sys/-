const image = document.getElementById('eye-reference-image');
const explodedSource = document.getElementById('eye-exploded-source');

if (image) {
  const params = new URLSearchParams(window.location.search);
  const view = params.get('view') || window.location.hash.replace('#', '');
  const isExploded = ['explode', 'exploded', 'decompose', 'split', '2'].includes(view);

  if (isExploded && explodedSource) image.src = explodedSource.currentSrc || explodedSource.src;
  image.alt = isExploded ? '人眼结构分解图页面' : '人眼结构与光学特性页面';
  document.title = isExploded ? '人眼结构分解图' : '人眼结构与光学特性';
}
