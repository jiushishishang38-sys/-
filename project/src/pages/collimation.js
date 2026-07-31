const moduleRoot = document.getElementById('collimation-module');

if (moduleRoot) {
  const SVG_NS = 'http://www.w3.org/2000/svg';
  const AXIS_Y = 210;
  const RAY_END_X = 850;
  const PX_PER_CM = 14;
  const SOURCE_MIN_X = 96;
  const LENS_MAX_X = 760;
  const MIN_DISTANCE_PX = PX_PER_CM;
  const DEFAULTS = {
    sourceX: 422,
    lensX: 520,
    focalLength: 10,
    raysVisible: true
  };

  const svg = document.getElementById('collimation-svg');
  const sourceGroup = document.getElementById('collimation-source');
  const lensGroup = document.getElementById('collimation-lens');
  const rayGroup = document.getElementById('collimation-rays');
  const focusMarker = document.getElementById('collimation-focus-marker');
  const convergenceMarker = document.getElementById('collimation-convergence-marker');
  const distanceReadout = document.getElementById('collimation-distance');
  const focalReadout = document.getElementById('collimation-focal-readout');
  const rayStateReadout = document.getElementById('collimation-ray-state');
  const resultBadge = document.getElementById('collimation-result-badge');
  const feedback = document.getElementById('collimation-feedback');
  const feedbackTitle = document.getElementById('collimation-feedback-title');
  const feedbackDetail = document.getElementById('collimation-feedback-detail');
  const focalNumber = document.getElementById('collimation-focal-number');
  const focalRange = document.getElementById('collimation-focal-range');
  const showRaysButton = document.getElementById('collimation-show-rays');
  const hideRaysButton = document.getElementById('collimation-hide-rays');
  const autoButton = document.getElementById('collimation-auto');
  const resetButton = document.getElementById('collimation-reset');
  const nextButton = document.getElementById('collimation-next');
  const successDialog = document.getElementById('collimation-success');
  const successCloseButton = document.getElementById('collimation-success-close');
  const successNextButton = document.getElementById('collimation-success-next');
  const checklistItems = [...moduleRoot.querySelectorAll('[data-collimation-check]')];

  const state = {
    ...DEFAULTS,
    activeDrag: null,
    autoFrame: 0,
    wasSuccess: false,
    returnFocus: null
  };

  const stateCopy = {
    diverging: {
      rayLabel: '发散',
      title: '光源位于焦点以内，无法获得平行光',
      detail: '继续增大光源与准直透镜之间的距离。'
    },
    converging: {
      rayLabel: '会聚',
      title: '光源位于焦点之外，光线发生会聚',
      detail: '减小光源与准直透镜之间的距离，使会聚点逐渐远离。'
    },
    parallel: {
      rayLabel: '平行',
      title: '光源位于凸透镜焦点位置，已获得平行光',
      detail: '距离误差小于 0.2 cm，准直条件已经满足。'
    }
  };

  function clamp(value, minimum, maximum) {
    return Math.min(Math.max(value, minimum), maximum);
  }

  function getDistanceCm() {
    return (state.lensX - state.sourceX) / PX_PER_CM;
  }

  function getRayState() {
    const difference = getDistanceCm() - state.focalLength;
    if (Math.abs(difference) < 0.2) return 'parallel';
    return difference < 0 ? 'diverging' : 'converging';
  }

  function makePath(className, pathData, markerId = '') {
    const path = document.createElementNS(SVG_NS, 'path');
    path.setAttribute('class', className);
    path.setAttribute('d', pathData);
    if (markerId) path.setAttribute('marker-end', `url(#${markerId})`);
    return path;
  }

  function renderRays(rayState) {
    rayGroup.replaceChildren();
    const lensDistance = Math.max(state.lensX - state.sourceX, MIN_DISTANCE_PX);
    const focalPx = state.focalLength * PX_PER_CM;
    const rayOffsets = [-92, -46, 0, 46, 92];

    rayOffsets.forEach((offset) => {
      const lensY = AXIS_Y + offset;
      const incomingSlope = offset / lensDistance;
      const outgoingSlope = rayState === 'parallel'
        ? 0
        : incomingSlope - (offset / focalPx);
      const outgoingY = lensY + outgoingSlope * (RAY_END_X - state.lensX);

      rayGroup.append(
        makePath(
          'collimation-ray-in',
          `M ${state.sourceX} ${AXIS_Y} L ${state.lensX} ${lensY}`
        ),
        makePath(
          'collimation-ray-out',
          `M ${state.lensX} ${lensY} L ${RAY_END_X} ${outgoingY}`,
          rayState === 'parallel' ? 'collimation-arrow-parallel' : 'collimation-arrow-warm'
        )
      );
    });

    if (rayState === 'converging') {
      const objectDistance = getDistanceCm();
      const imageDistance = (state.focalLength * objectDistance) / (objectDistance - state.focalLength);
      const focusX = state.lensX + imageDistance * PX_PER_CM;
      const focusIsVisible = Number.isFinite(focusX) && focusX > state.lensX + 24 && focusX < 872;
      convergenceMarker.style.visibility = focusIsVisible ? 'visible' : 'hidden';
      convergenceMarker.setAttribute('transform', `translate(${focusX}, ${AXIS_Y})`);
    } else {
      convergenceMarker.style.visibility = 'hidden';
    }
  }

  function setChecklistComplete(isComplete) {
    checklistItems.forEach((item, index) => {
      item.classList.toggle('is-complete', isComplete);
      const marker = item.querySelector('i');
      marker.textContent = isComplete ? '✓' : String(index + 1);
    });
  }

  function openSuccessDialog() {
    if (!successDialog.hidden) return;
    state.returnFocus = document.activeElement;
    successDialog.hidden = false;
    window.requestAnimationFrame(() => successNextButton.focus());
  }

  function closeSuccessDialog() {
    if (successDialog.hidden) return;
    successDialog.hidden = true;
    if (state.returnFocus instanceof HTMLElement) state.returnFocus.focus();
    state.returnFocus = null;
  }

  function goToNextStep() {
    closeSuccessDialog();
    document.querySelector('.lab-layout')?.scrollIntoView({
      behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
      block: 'start'
    });
  }

  function updateInterface({ notifySuccess = true } = {}) {
    const distance = getDistanceCm();
    const rayState = getRayState();
    const isSuccess = rayState === 'parallel';
    const copy = stateCopy[rayState];

    moduleRoot.dataset.rayState = rayState;
    moduleRoot.dataset.complete = String(isSuccess);
    moduleRoot.classList.toggle('rays-hidden', !state.raysVisible);
    sourceGroup.setAttribute('transform', `translate(${state.sourceX}, 0)`);
    lensGroup.setAttribute('transform', `translate(${state.lensX}, 0)`);
    focusMarker.setAttribute('transform', `translate(${state.lensX - state.focalLength * PX_PER_CM}, 0)`);

    sourceGroup.setAttribute('aria-valuenow', distance.toFixed(2));
    sourceGroup.setAttribute('aria-valuetext', `光源距离准直透镜 ${distance.toFixed(2)} 厘米`);
    lensGroup.setAttribute('aria-valuenow', (state.lensX / PX_PER_CM).toFixed(2));
    lensGroup.setAttribute('aria-valuetext', `准直凸透镜光轴位置 ${(state.lensX / PX_PER_CM).toFixed(2)} 厘米`);

    distanceReadout.textContent = distance.toFixed(2);
    focalReadout.textContent = state.focalLength.toFixed(2);
    rayStateReadout.textContent = copy.rayLabel;
    if (document.activeElement !== focalNumber) {
      focalNumber.value = state.focalLength.toFixed(2);
    }
    focalRange.value = state.focalLength.toFixed(2);

    resultBadge.className = `collimation-result-badge ${isSuccess ? 'is-success' : 'is-pending'}`;
    resultBadge.innerHTML = isSuccess
      ? '<span aria-hidden="true">✓</span><strong>准直成功</strong>'
      : '<span aria-hidden="true">×</span><strong>未准直</strong>';

    feedback.className = `collimation-feedback is-${rayState}`;
    feedback.querySelector('.collimation-feedback-icon').textContent = isSuccess ? '✓' : '×';
    feedbackTitle.textContent = copy.title;
    feedbackDetail.textContent = copy.detail;

    showRaysButton.disabled = state.raysVisible;
    hideRaysButton.disabled = !state.raysVisible;
    nextButton.disabled = !isSuccess;
    setChecklistComplete(isSuccess);
    renderRays(rayState);

    if (notifySuccess) {
      if (isSuccess && !state.wasSuccess) openSuccessDialog();
      if (!isSuccess && !successDialog.hidden) closeSuccessDialog();
      state.wasSuccess = isSuccess;
    }
  }

  function setFocalLength(value, notifySuccess = true) {
    const nextValue = Number(value);
    if (!Number.isFinite(nextValue)) return;
    state.focalLength = Number(clamp(nextValue, 5, 20).toFixed(2));
    updateInterface({ notifySuccess });
  }

  function clientToSvgX(clientX) {
    const point = svg.createSVGPoint();
    point.x = clientX;
    point.y = 0;
    return point.matrixTransform(svg.getScreenCTM().inverse()).x;
  }

  function stopAutoAdjustment() {
    if (!state.autoFrame) return;
    window.cancelAnimationFrame(state.autoFrame);
    state.autoFrame = 0;
  }

  function moveComponent(type, nextX, notifySuccess = true) {
    if (type === 'source') {
      state.sourceX = clamp(nextX, SOURCE_MIN_X, state.lensX - MIN_DISTANCE_PX);
    } else {
      state.lensX = clamp(nextX, state.sourceX + MIN_DISTANCE_PX, LENS_MAX_X);
    }
    updateInterface({ notifySuccess });
  }

  function startDrag(event) {
    if (event.button !== 0) return;
    stopAutoAdjustment();
    const target = event.currentTarget;
    state.activeDrag = target.dataset.collimationDrag;
    target.classList.add('is-dragging');
    target.setPointerCapture(event.pointerId);
    moveComponent(state.activeDrag, clientToSvgX(event.clientX));
    event.preventDefault();
  }

  function continueDrag(event) {
    if (!state.activeDrag) return;
    moveComponent(state.activeDrag, clientToSvgX(event.clientX));
  }

  function endDrag(event) {
    if (!state.activeDrag) return;
    event.currentTarget.classList.remove('is-dragging');
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    state.activeDrag = null;
  }

  function handleKeyboardMove(event) {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    stopAutoAdjustment();
    const type = event.currentTarget.dataset.collimationDrag;
    const currentX = type === 'source' ? state.sourceX : state.lensX;
    const step = event.shiftKey ? PX_PER_CM / 2 : PX_PER_CM / 20;
    let nextX = currentX;
    if (event.key === 'ArrowLeft') nextX -= step;
    if (event.key === 'ArrowRight') nextX += step;
    if (event.key === 'Home') nextX = type === 'source' ? SOURCE_MIN_X : state.sourceX + MIN_DISTANCE_PX;
    if (event.key === 'End') nextX = type === 'source' ? state.lensX - MIN_DISTANCE_PX : LENS_MAX_X;
    moveComponent(type, nextX);
    event.preventDefault();
  }

  function autoAdjust() {
    stopAutoAdjustment();
    const startX = state.sourceX;
    const targetX = clamp(
      state.lensX - state.focalLength * PX_PER_CM,
      SOURCE_MIN_X,
      state.lensX - MIN_DISTANCE_PX
    );
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (reduceMotion || Math.abs(targetX - startX) < 0.5) {
      state.sourceX = targetX;
      updateInterface({ notifySuccess: true });
      return;
    }

    const startTime = performance.now();
    const duration = 460;
    const animate = (now) => {
      const progress = clamp((now - startTime) / duration, 0, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      state.sourceX = startX + (targetX - startX) * eased;
      updateInterface({ notifySuccess: progress === 1 });
      if (progress < 1) {
        state.autoFrame = window.requestAnimationFrame(animate);
      } else {
        state.autoFrame = 0;
      }
    };
    state.autoFrame = window.requestAnimationFrame(animate);
  }

  function resetModule() {
    stopAutoAdjustment();
    Object.assign(state, DEFAULTS, {
      activeDrag: null,
      wasSuccess: false
    });
    closeSuccessDialog();
    updateInterface({ notifySuccess: false });
  }

  [sourceGroup, lensGroup].forEach((group) => {
    group.addEventListener('pointerdown', startDrag);
    group.addEventListener('pointermove', continueDrag);
    group.addEventListener('pointerup', endDrag);
    group.addEventListener('pointercancel', endDrag);
    group.addEventListener('keydown', handleKeyboardMove);
  });

  function commitFocalNumber() {
    const value = Number(focalNumber.value);
    if (!Number.isFinite(value) || focalNumber.value.trim() === '') {
      focalNumber.value = state.focalLength.toFixed(2);
      return;
    }
    setFocalLength(value);
    focalNumber.value = state.focalLength.toFixed(2);
  }

  focalRange.addEventListener('input', () => setFocalLength(focalRange.value));
  focalNumber.addEventListener('focus', () => {
    window.requestAnimationFrame(() => focalNumber.select());
  });
  focalNumber.addEventListener('change', commitFocalNumber);
  focalNumber.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      focalNumber.blur();
    } else if (event.key === 'Escape') {
      event.preventDefault();
      focalNumber.value = state.focalLength.toFixed(2);
      focalNumber.blur();
    }
  });
  showRaysButton.addEventListener('click', () => {
    state.raysVisible = true;
    updateInterface({ notifySuccess: false });
  });
  hideRaysButton.addEventListener('click', () => {
    state.raysVisible = false;
    updateInterface({ notifySuccess: false });
  });
  autoButton.addEventListener('click', autoAdjust);
  resetButton.addEventListener('click', resetModule);
  nextButton.addEventListener('click', goToNextStep);
  successCloseButton.addEventListener('click', closeSuccessDialog);
  successNextButton.addEventListener('click', goToNextStep);
  successDialog.addEventListener('click', (event) => {
    if (event.target === successDialog) closeSuccessDialog();
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && !successDialog.hidden) closeSuccessDialog();
  });

  updateInterface({ notifySuccess: false });
}
