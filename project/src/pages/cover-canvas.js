const canvas = document.getElementById('cover-optics-canvas');
const coverVisual = canvas?.closest('.cover-visual');

if (canvas instanceof HTMLCanvasElement && coverVisual) {
  const context = canvas.getContext('2d', { alpha: true });

  if (context) {
    const TAU = Math.PI * 2;
    const CYCLE_MS = 12000;
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const finePointer = window.matchMedia('(pointer: fine)');
    const state = {
      width: 1,
      height: 1,
      dpr: 1,
      frameId: 0,
      running: false,
      pointerX: 0,
      pointerY: 0,
      targetX: 0,
      targetY: 0
    };

    function spectralGradient(ctx, x0, y0, x1, y1, alpha = 1) {
      const gradient = ctx.createLinearGradient(x0, y0, x1, y1);
      gradient.addColorStop(0, `rgba(78, 42, 219, ${0.94 * alpha})`);
      gradient.addColorStop(0.22, `rgba(103, 70, 255, ${0.84 * alpha})`);
      gradient.addColorStop(0.46, `rgba(20, 202, 245, ${0.74 * alpha})`);
      gradient.addColorStop(0.62, `rgba(255, 255, 255, ${0.96 * alpha})`);
      gradient.addColorStop(0.78, `rgba(58, 128, 255, ${0.7 * alpha})`);
      gradient.addColorStop(1, `rgba(211, 54, 199, ${0.68 * alpha})`);
      return gradient;
    }

    function ellipsePath(ctx, rx, ry) {
      ctx.beginPath();
      ctx.ellipse(0, 0, rx, ry, 0, 0, TAU);
    }

    function drawShadow(ctx, cx, cy, radius, opacity) {
      ctx.save();
      ctx.translate(cx, cy);
      ctx.scale(1, 0.18);
      ctx.filter = `blur(${Math.max(10, radius * 0.08)}px)`;
      const shadow = ctx.createRadialGradient(0, 0, radius * 0.08, 0, 0, radius);
      shadow.addColorStop(0, `rgba(80, 56, 177, ${0.2 * opacity})`);
      shadow.addColorStop(0.36, `rgba(99, 82, 206, ${0.14 * opacity})`);
      shadow.addColorStop(0.72, `rgba(74, 179, 222, ${0.07 * opacity})`);
      shadow.addColorStop(1, 'rgba(255, 255, 255, 0)');
      ctx.fillStyle = shadow;
      ctx.beginPath();
      ctx.arc(0, 0, radius, 0, TAU);
      ctx.fill();
      ctx.restore();
    }

    function drawOrbit(ctx, {
      x,
      y,
      rx,
      ry,
      rotation,
      alpha,
      phase
    }) {
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(rotation);
      ctx.lineWidth = Math.max(1, rx * 0.009);
      ctx.strokeStyle = spectralGradient(ctx, -rx, -ry, rx, ry, alpha);
      ctx.shadowColor = `rgba(81, 91, 238, ${0.18 * alpha})`;
      ctx.shadowBlur = Math.max(3, rx * 0.035);
      ellipsePath(ctx, rx, ry);
      ctx.stroke();

      const tracerX = Math.cos(phase) * rx;
      const tracerY = Math.sin(phase) * ry;
      ctx.fillStyle = `rgba(255, 255, 255, ${0.92 * alpha})`;
      ctx.shadowColor = `rgba(37, 206, 244, ${0.9 * alpha})`;
      ctx.shadowBlur = Math.max(7, rx * 0.055);
      ctx.beginPath();
      ctx.arc(tracerX, tracerY, Math.max(1.8, rx * 0.012), 0, TAU);
      ctx.fill();
      ctx.restore();
    }

    function drawPrismaticBands(ctx, rx, ry, phase, alpha) {
      ctx.save();
      ellipsePath(ctx, rx * 0.91, ry * 0.91);
      ctx.clip();
      ctx.rotate(-0.18 + Math.sin(phase) * 0.025);
      ctx.globalCompositeOperation = 'multiply';

      const sweep = ((Math.sin(phase) + 1) * 0.5) * rx * 0.2;
      [
        { y: -ry * 0.28 + sweep * 0.2, color: `rgba(84, 40, 214, ${0.28 * alpha})` },
        { y: -ry * 0.02, color: `rgba(21, 207, 244, ${0.24 * alpha})` },
        { y: ry * 0.26 - sweep * 0.2, color: `rgba(204, 48, 192, ${0.18 * alpha})` }
      ].forEach(({ y, color }, index) => {
        const band = ctx.createLinearGradient(-rx, y, rx, y + ry * 0.12);
        band.addColorStop(0, 'rgba(255,255,255,0)');
        band.addColorStop(0.25, color);
        band.addColorStop(0.54, index % 2 === 0
          ? `rgba(255,255,255,${0.22 * alpha})`
          : `rgba(80,220,246,${0.15 * alpha})`);
        band.addColorStop(0.82, color);
        band.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = band;
        ctx.fillRect(-rx * 1.2, y, rx * 2.4, Math.max(3, ry * 0.11));
      });
      ctx.restore();
    }

    function drawGlassLens(ctx, {
      x,
      y,
      rx,
      ry,
      rotation = 0,
      alpha = 1,
      phase = 0,
      depth = 0.12,
      highlightDirection = 1
    }) {
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(rotation);

      ctx.save();
      ctx.translate(-rx * depth * highlightDirection, 0);
      const rearFill = ctx.createLinearGradient(-rx, -ry, rx, ry);
      rearFill.addColorStop(0, `rgba(64, 45, 177, ${0.12 * alpha})`);
      rearFill.addColorStop(0.45, `rgba(255, 255, 255, ${0.09 * alpha})`);
      rearFill.addColorStop(1, `rgba(38, 181, 224, ${0.12 * alpha})`);
      ctx.fillStyle = rearFill;
      ctx.strokeStyle = spectralGradient(ctx, -rx, -ry, rx, ry, alpha * 0.72);
      ctx.lineWidth = Math.max(2, rx * 0.045);
      ctx.shadowColor = `rgba(81, 62, 198, ${0.19 * alpha})`;
      ctx.shadowBlur = Math.max(4, rx * 0.06);
      ellipsePath(ctx, rx, ry);
      ctx.fill();
      ctx.stroke();
      ctx.restore();

      const glass = ctx.createRadialGradient(
        -rx * 0.28 * highlightDirection,
        -ry * 0.28,
        rx * 0.04,
        0,
        0,
        Math.max(rx, ry)
      );
      glass.addColorStop(0, `rgba(255, 255, 255, ${0.62 * alpha})`);
      glass.addColorStop(0.36, `rgba(216, 249, 255, ${0.14 * alpha})`);
      glass.addColorStop(0.68, `rgba(148, 126, 239, ${0.09 * alpha})`);
      glass.addColorStop(0.88, `rgba(62, 177, 227, ${0.12 * alpha})`);
      glass.addColorStop(1, `rgba(64, 37, 170, ${0.16 * alpha})`);
      ctx.fillStyle = glass;
      ellipsePath(ctx, rx, ry);
      ctx.fill();

      drawPrismaticBands(ctx, rx, ry, phase, alpha);

      ctx.lineWidth = Math.max(2, rx * 0.036);
      ctx.strokeStyle = spectralGradient(ctx, -rx, -ry, rx, ry, alpha);
      ctx.shadowColor = `rgba(54, 65, 210, ${0.24 * alpha})`;
      ctx.shadowBlur = Math.max(5, rx * 0.055);
      ellipsePath(ctx, rx, ry);
      ctx.stroke();

      ctx.shadowBlur = 0;
      ctx.lineWidth = Math.max(1, rx * 0.012);
      ctx.strokeStyle = `rgba(255, 255, 255, ${0.76 * alpha})`;
      ctx.beginPath();
      ctx.ellipse(
        0,
        0,
        rx * 0.91,
        ry * 0.91,
        0,
        highlightDirection > 0 ? Math.PI * 1.02 : Math.PI * 0.02,
        highlightDirection > 0 ? Math.PI * 1.8 : Math.PI * 0.8
      );
      ctx.stroke();

      ctx.strokeStyle = `rgba(36, 195, 229, ${0.26 * alpha})`;
      ctx.beginPath();
      ctx.ellipse(
        0,
        0,
        rx * 0.72,
        ry * 0.72,
        0,
        highlightDirection > 0 ? -0.56 : Math.PI - 0.62,
        highlightDirection > 0 ? 0.62 : Math.PI + 0.56
      );
      ctx.stroke();

      ctx.fillStyle = `rgba(255, 255, 255, ${0.54 * alpha})`;
      ctx.beginPath();
      ctx.ellipse(
        -rx * 0.34 * highlightDirection,
        -ry * 0.22,
        rx * 0.08,
        ry * 0.25,
        -0.42 * highlightDirection,
        0,
        TAU
      );
      ctx.fill();
      ctx.restore();
    }

    function drawCoreGlow(ctx, cx, cy, radius, phase, alpha) {
      const pulse = 0.92 + Math.sin(phase * 2) * 0.08;
      const glowRadius = radius * 0.19 * pulse;

      ctx.save();
      ctx.globalCompositeOperation = 'screen';
      const glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, glowRadius);
      glow.addColorStop(0, `rgba(255, 255, 255, ${0.86 * alpha})`);
      glow.addColorStop(0.14, `rgba(102, 234, 255, ${0.58 * alpha})`);
      glow.addColorStop(0.42, `rgba(92, 72, 244, ${0.22 * alpha})`);
      glow.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(cx, cy, glowRadius, 0, TAU);
      ctx.fill();

      ctx.lineCap = 'round';
      ctx.strokeStyle = `rgba(217, 252, 255, ${0.54 * alpha})`;
      ctx.lineWidth = Math.max(0.8, radius * 0.004);
      ctx.shadowColor = `rgba(43, 207, 245, ${0.82 * alpha})`;
      ctx.shadowBlur = Math.max(7, radius * 0.045);
      ctx.beginPath();
      ctx.moveTo(cx - radius * 0.21, cy);
      ctx.lineTo(cx + radius * 0.21, cy);
      ctx.moveTo(cx, cy - radius * 0.13);
      ctx.lineTo(cx, cy + radius * 0.13);
      ctx.stroke();

      ctx.fillStyle = `rgba(255, 255, 255, ${0.94 * alpha})`;
      ctx.beginPath();
      ctx.arc(cx, cy, Math.max(1.8, radius * 0.012), 0, TAU);
      ctx.fill();
      ctx.restore();
    }

    function drawLightPath(ctx, cx, cy, radius, phase, alpha) {
      const startX = Math.max(0, cx - radius * 1.55);
      const focusX = cx - radius * 0.68;
      const endX = cx + radius * 1.08;
      const pulse = 0.6 + Math.sin(phase * 2) * 0.18;

      ctx.save();
      ctx.lineCap = 'round';
      ctx.globalCompositeOperation = 'source-over';
      [-0.2, 0, 0.2].forEach((offset, index) => {
        const startY = cy + radius * offset;
        const endY = cy + radius * offset * 0.16;
        const beam = ctx.createLinearGradient(startX, startY, endX, endY);
        beam.addColorStop(0, 'rgba(255,255,255,0)');
        beam.addColorStop(0.12, `rgba(102, 66, 219, ${0.19 * alpha})`);
        beam.addColorStop(0.46, `rgba(37, 190, 236, ${0.38 * alpha})`);
        beam.addColorStop(0.76, `rgba(104, 83, 231, ${0.26 * alpha})`);
        beam.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.strokeStyle = beam;
        ctx.lineWidth = index === 1 ? Math.max(1.2, radius * 0.008) : Math.max(0.8, radius * 0.004);
        ctx.shadowColor = `rgba(55, 178, 234, ${0.42 * alpha})`;
        ctx.shadowBlur = index === 1 ? 10 : 5;
        ctx.beginPath();
        ctx.moveTo(startX, startY);
        ctx.lineTo(focusX, cy);
        ctx.lineTo(endX, endY);
        ctx.stroke();
      });

      const axis = ctx.createLinearGradient(startX, cy, endX, cy);
      axis.addColorStop(0, 'rgba(255,255,255,0)');
      axis.addColorStop(0.2, `rgba(88, 45, 204, ${0.34 * alpha})`);
      axis.addColorStop(0.5, `rgba(255, 255, 255, ${0.88 * alpha})`);
      axis.addColorStop(0.68, `rgba(35, 197, 232, ${0.54 * alpha})`);
      axis.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.strokeStyle = axis;
      ctx.lineWidth = Math.max(1.4, radius * 0.009);
      ctx.shadowBlur = 13 * pulse;
      ctx.beginPath();
      ctx.moveTo(startX, cy);
      ctx.lineTo(endX, cy);
      ctx.stroke();

      ctx.fillStyle = `rgba(255, 255, 255, ${0.92 * alpha})`;
      ctx.shadowColor = `rgba(68, 205, 244, ${0.8 * alpha})`;
      ctx.shadowBlur = 18 * pulse;
      ctx.beginPath();
      ctx.arc(focusX, cy, Math.max(2, radius * 0.014), 0, TAU);
      ctx.fill();
      ctx.restore();
    }

    function render(time = 0) {
      const { width, height } = state;
      if (width <= 1 || height <= 1) return;

      const phase = reducedMotion.matches ? 0.68 : ((time % CYCLE_MS) / CYCLE_MS) * TAU;
      const wide = width >= 980;
      const radius = Math.min(
        width * (wide ? 0.245 : 0.42),
        height * (wide ? 0.43 : 0.42)
      );
      const motionScale = reducedMotion.matches ? 0 : 1;
      const yaw = phase;
      const cosYaw = Math.cos(yaw);
      const sinYaw = Math.sin(yaw);
      const faceScale = 0.11 + Math.abs(cosYaw) * 0.89;
      const highlightDirection = cosYaw >= 0 ? 1 : -1;
      const breathe = 1 + Math.sin(phase * 2) * 0.008 * motionScale;
      const cx = width * (wide ? 0.27 : 0.5)
        + state.pointerX * radius * 0.055
        + Math.sin(phase) * radius * 0.012 * motionScale;
      const cy = height * (wide ? 0.54 : 0.5)
        + state.pointerY * radius * 0.04
        + Math.cos(phase) * radius * 0.008 * motionScale;
      const alpha = wide ? 1 : 0.84;

      context.setTransform(state.dpr, 0, 0, state.dpr, 0, 0);
      context.clearRect(0, 0, width, height);
      context.fillStyle = '#ffffff';
      context.fillRect(0, 0, width, height);

      const atmosphere = context.createRadialGradient(cx, cy, radius * 0.08, cx, cy, radius * 1.5);
      atmosphere.addColorStop(0, `rgba(116, 92, 225, ${0.07 * alpha})`);
      atmosphere.addColorStop(0.44, `rgba(74, 188, 230, ${0.045 * alpha})`);
      atmosphere.addColorStop(1, 'rgba(255,255,255,0)');
      context.fillStyle = atmosphere;
      context.fillRect(0, 0, width, height);

      drawShadow(
        context,
        cx - radius * 0.04,
        cy + radius * 0.92,
        radius * (0.74 + faceScale * 0.34),
        alpha
      );
      drawOrbit(context, {
        x: cx - radius * 0.12,
        y: cy,
        rx: radius * 1.02,
        ry: radius * 0.7,
        rotation: -0.24 + phase * motionScale,
        alpha: alpha * 0.38,
        phase
      });
      drawOrbit(context, {
        x: cx + radius * 0.06,
        y: cy,
        rx: radius * 0.68,
        ry: radius * 1.02,
        rotation: 0.34 - phase * motionScale,
        alpha: alpha * 0.32,
        phase: -phase
      });

      drawLightPath(
        context,
        cx,
        cy,
        radius,
        phase,
        alpha * (0.42 + faceScale * 0.58)
      );

      const lensParts = [
        { offset: -0.58, z: -0.04, rx: 0.42, ry: 0.74, alpha: 0.84, phaseOffset: 0.8, depth: 0.18 },
        { offset: -0.08, z: 0.06, rx: 0.58, ry: 0.86, alpha: 1, phaseOffset: 0, depth: 0.13 },
        { offset: 0.42, z: -0.05, rx: 0.43, ry: 0.61, alpha: 0.92, phaseOffset: 1.8, depth: 0.16 },
        { offset: 0.76, z: 0.02, rx: 0.19, ry: 0.3, alpha: 0.66, phaseOffset: 2.4, depth: 0.12 }
      ].map((part) => ({
        ...part,
        projectedX: (part.offset * cosYaw + part.z * sinYaw) * radius,
        depthOrder: -part.offset * sinYaw + part.z * cosYaw
      })).sort((a, b) => a.depthOrder - b.depthOrder);

      lensParts.forEach((part) => {
        drawGlassLens(context, {
          x: cx + part.projectedX + state.pointerX * radius * part.offset * -0.035,
          y: cy + part.depthOrder * radius * 0.035,
          rx: radius * part.rx * faceScale * breathe,
          ry: radius * part.ry,
          rotation: state.pointerY * 0.035 + sinYaw * 0.025,
          alpha: alpha * part.alpha,
          phase: phase + part.phaseOffset,
          depth: part.depth,
          highlightDirection
        });
      });

      drawCoreGlow(
        context,
        cx,
        cy,
        radius,
        phase,
        alpha * (0.58 + faceScale * 0.42)
      );
    }

    function tick(time) {
      if (!state.running) return;
      state.pointerX += (state.targetX - state.pointerX) * 0.055;
      state.pointerY += (state.targetY - state.pointerY) * 0.055;
      render(time);
      state.frameId = window.requestAnimationFrame(tick);
    }

    function stop() {
      state.running = false;
      if (state.frameId) window.cancelAnimationFrame(state.frameId);
      state.frameId = 0;
    }

    function start() {
      stop();
      if (document.hidden || reducedMotion.matches) {
        render(performance.now());
        return;
      }
      state.running = true;
      state.frameId = window.requestAnimationFrame(tick);
    }

    function resize() {
      const rect = coverVisual.getBoundingClientRect();
      const width = Math.max(1, Math.round(rect.width));
      const height = Math.max(1, Math.round(rect.height));
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      if (width === state.width && height === state.height && dpr === state.dpr) return;
      state.width = width;
      state.height = height;
      state.dpr = dpr;
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      render(performance.now());
    }

    function handlePointerMove(event) {
      if (!finePointer.matches || reducedMotion.matches) return;
      state.targetX = Math.max(-1, Math.min(1, (event.clientX / window.innerWidth - 0.5) * 2));
      state.targetY = Math.max(-1, Math.min(1, (event.clientY / window.innerHeight - 0.5) * 2));
    }

    function handlePointerLeave() {
      state.targetX = 0;
      state.targetY = 0;
    }

    const observer = typeof ResizeObserver === 'function'
      ? new ResizeObserver(resize)
      : null;
    observer?.observe(coverVisual);
    if (!observer) window.addEventListener('resize', resize);
    window.addEventListener('pointermove', handlePointerMove, { passive: true });
    window.addEventListener('pointerleave', handlePointerLeave);
    document.addEventListener('visibilitychange', start);
    reducedMotion.addEventListener('change', start);

    resize();
    start();
  }
}
