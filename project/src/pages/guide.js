const canvas = document.getElementById('mini-optics');
const ctx = canvas.getContext('2d');
const type = document.getElementById('mini-type');
const focal = document.getElementById('mini-focal');

function drawMiniOptics() {
  const w = canvas.width;
  const h = canvas.height;
  const cx = w * 0.48;
  const cy = h * 0.54;
  const f = Number(focal.value) * 5;

  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = '#f7fbfd';
  ctx.fillRect(0, 0, w, h);

  ctx.strokeStyle = 'rgba(55, 107, 143, 0.12)';
  ctx.lineWidth = 1;
  for (let x = 24; x < w; x += 40) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, h);
    ctx.stroke();
  }
  for (let y = 24; y < h; y += 40) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(w, y);
    ctx.stroke();
  }

  ctx.strokeStyle = 'rgba(45, 82, 108, 0.55)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(28, cy);
  ctx.lineTo(w - 28, cy);
  ctx.stroke();

  ctx.strokeStyle = type.value === 'convex' ? '#1687a7' : '#b87b1e';
  ctx.lineWidth = 4;
  ctx.beginPath();
  if (type.value === 'convex') {
    ctx.ellipse(cx, cy, 18, 96, 0, 0, Math.PI * 2);
  } else {
    ctx.moveTo(cx - 14, cy - 96);
    ctx.quadraticCurveTo(cx + 22, cy, cx - 14, cy + 96);
    ctx.moveTo(cx + 14, cy - 96);
    ctx.quadraticCurveTo(cx - 22, cy, cx + 14, cy + 96);
  }
  ctx.stroke();

  const ys = [-54, 0, 54];
  ys.forEach((offset) => {
    ctx.strokeStyle = 'rgba(184, 123, 30, 0.9)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(44, cy + offset);
    ctx.lineTo(cx, cy + offset);
    if (type.value === 'convex') {
      ctx.lineTo(cx + f, cy);
      ctx.lineTo(w - 34, cy - offset * 0.38);
    } else {
      ctx.lineTo(w - 34, cy + offset * 1.45);
      ctx.setLineDash([6, 7]);
      ctx.moveTo(cx, cy + offset);
      ctx.lineTo(cx - f, cy);
      ctx.setLineDash([]);
    }
    ctx.stroke();
  });

  ctx.fillStyle = '#162532';
  ctx.font = '700 18px Microsoft YaHei, sans-serif';
  ctx.fillText(type.value === 'convex' ? '凸透镜：平行光会聚到焦点' : '凹透镜：平行光发散，反向延长相交于虚焦点', 32, 34);
}

type.addEventListener('input', drawMiniOptics);
focal.addEventListener('input', drawMiniOptics);
drawMiniOptics();

document.getElementById('open-guide-quiz').addEventListener('click', () => {
  document.getElementById('guide-modal').classList.add('open');
});

const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

function initCarousel(carousel) {
  const track = carousel.querySelector('.carousel-track');
  const slides = [...carousel.querySelectorAll('[data-carousel-slide]')];
  const dots = [...carousel.querySelectorAll('[data-carousel-dot]')];
  const prev = carousel.querySelector('[data-carousel-prev]');
  const next = carousel.querySelector('[data-carousel-next]');
  let currentSlide = 0;
  let autoplayId;

  function showSlide(index) {
    if (!track || slides.length === 0) return;

    currentSlide = (index + slides.length) % slides.length;
    track.style.transform = `translateX(-${currentSlide * 100}%)`;

    slides.forEach((slide, slideIndex) => {
      const active = slideIndex === currentSlide;
      slide.classList.toggle('active', active);
      slide.setAttribute('aria-hidden', String(!active));
    });

    dots.forEach((dot, dotIndex) => {
      const active = dotIndex === currentSlide;
      dot.classList.toggle('active', active);
      dot.setAttribute('aria-selected', String(active));
    });
  }

  function stopAutoplay() {
    if (autoplayId) {
      window.clearInterval(autoplayId);
      autoplayId = undefined;
    }
  }

  function startAutoplay() {
    if (reduceMotion || slides.length < 2) return;
    stopAutoplay();
    autoplayId = window.setInterval(() => showSlide(currentSlide + 1), 5200);
  }

  function moveSlide(index) {
    showSlide(index);
    startAutoplay();
  }

  prev?.addEventListener('click', () => moveSlide(currentSlide - 1));
  next?.addEventListener('click', () => moveSlide(currentSlide + 1));

  dots.forEach((dot, index) => {
    dot.addEventListener('click', () => moveSlide(index));
  });

  carousel.addEventListener('mouseenter', stopAutoplay);
  carousel.addEventListener('mouseleave', startAutoplay);
  carousel.addEventListener('focusin', stopAutoplay);
  carousel.addEventListener('focusout', (event) => {
    if (!carousel.contains(event.relatedTarget)) {
      startAutoplay();
    }
  });

  showSlide(0);
  startAutoplay();
}

document.querySelectorAll('.guide-carousel, .concept-carousel').forEach(initCarousel);
