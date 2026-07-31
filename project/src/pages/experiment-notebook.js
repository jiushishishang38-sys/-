import {
  classifyFocusClarity,
  EYES,
} from "../optics.js?v=teaching-lens-3";

const modelTruth = Object.freeze({
  A: {
    eyeLength: 27.5,
    focalLength: 18.13,
    refractivePower: "-3.00D",
    focus: "front_retina",
    diagnosis: "myopia",
    diagnosisLabel: "近视眼",
    clarity: "blur",
    bestRetina: EYES.A.focusCm,
    lensPower: -3,
    lensLabel: "-3.00D 凹透镜",
  },
  B: {
    eyeLength: 26.5,
    focalLength: 19.74,
    refractivePower: "-2.00D",
    focus: "front_retina",
    diagnosis: "myopia",
    diagnosisLabel: "近视眼",
    clarity: "blur",
    bestRetina: EYES.B.focusCm,
    lensPower: -2,
    lensLabel: "-2.00D 凹透镜",
  },
  C: {
    eyeLength: 25.5,
    focalLength: 20.65,
    refractivePower: "-1.50D",
    focus: "front_retina",
    diagnosis: "myopia",
    diagnosisLabel: "近视眼",
    clarity: "blur",
    bestRetina: EYES.C.focusCm,
    lensPower: -1.5,
    lensLabel: "-1.50D 凹透镜",
  },
  D: {
    eyeLength: 24,
    focalLength: 24,
    refractivePower: "0.00D",
    focus: "on_retina",
    diagnosis: "normal",
    diagnosisLabel: "正常眼",
    clarity: "clear",
    bestRetina: EYES.D.focusCm,
    lensPower: 0,
    lensLabel: "0.00D（无需矫正）",
  },
  E: {
    eyeLength: 23,
    focalLength: 28.64,
    refractivePower: "+1.50D",
    focus: "behind_retina",
    diagnosis: "hyperopia",
    diagnosisLabel: "远视眼",
    clarity: "blur",
    bestRetina: EYES.E.focusCm,
    lensPower: 1.5,
    lensLabel: "+1.50D 凸透镜",
  },
  F: {
    eyeLength: 22.5,
    focalLength: 30.61,
    refractivePower: "+2.00D",
    focus: "behind_retina",
    diagnosis: "hyperopia",
    diagnosisLabel: "远视眼",
    clarity: "blur",
    bestRetina: EYES.F.focusCm,
    lensPower: 2,
    lensLabel: "+2.00D 凸透镜",
  },
  G: {
    eyeLength: 21.5,
    focalLength: 35.5,
    refractivePower: "+3.00D",
    focus: "behind_retina",
    diagnosis: "hyperopia",
    diagnosisLabel: "远视眼",
    clarity: "blur",
    bestRetina: EYES.G.focusCm,
    lensPower: 3,
    lensLabel: "+3.00D 凸透镜",
  },
  S: {
    eyeLength: 24,
    focalLength: 24,
    refractivePower: "柱面屈光差",
    focus: "two_directions",
    diagnosis: "astigmatism",
    diagnosisLabel: "散光",
    clarity: "blur",
    bestRetina: EYES.S.focusCm,
    lensPower: "cylinder",
    lensLabel: "柱面镜",
  },
});

const labels = {
  clarity: {
    clear: "清晰",
    blur: "模糊",
  },
  focus: {
    front_retina: "视网膜前",
    on_retina: "视网膜上",
    behind_retina: "视网膜后",
    two_directions: "不同方向焦点不同",
  },
  diagnosis: {
    normal: "正常眼",
    myopia: "近视眼",
    hyperopia: "远视眼",
    astigmatism: "散光",
  },
  trial: {
    blur: "模糊",
    improve: "改善",
    clear: "清晰",
  },
};

const DRAFT_KEY = "eye-lab-process-record-draft-v1";
const SAVED_KEY = "eye-lab-process-record-saved-v1";
const MAX_ACTIONS = 300;

const root = document.querySelector("#experiment-notebook-root");
const reportModal = document.querySelector("#experiment-report-modal");
const eyeInput = document.querySelector("#eye-id");
const screenInput = document.querySelector("#screen-pos");
const lensTypeInput = document.querySelector("#lens-type");
const lensPowerInput = document.querySelector("#lens-power");
const lensPowerValue = document.querySelector("#lens-power-value");
const cylinderInput = document.querySelector("#cylinder-angle");
const cylinderValue = document.querySelector("#cylinder-angle-value");
const autoCorrectButton = document.querySelector("#auto-correct");
const recordMeasurementButton = document.querySelector("#record-measurement");

function validEyeId(value) {
  return modelTruth[value] ? value : "A";
}

function readScreenPosition() {
  const position = Number(screenInput?.value);
  return Number.isFinite(position) ? position : 24;
}

function createRecord(eyeId = "A") {
  const initialPosition = readScreenPosition();
  const validatedEyeId = validEyeId(eyeId);
  return {
    eyeModel: validatedEyeId,
    observation: {
      clarity: modelTruth[validatedEyeId].clarity,
      focusPosition: "",
      diagnosis: "",
    },
    retinaAdjustment: {
      initialPosition,
      currentPosition: initialPosition,
      measurements: [],
      bestPosition: null,
      offset: null,
    },
    lensTrial: [],
    finalResult: {
      diagnosis: "",
      lensPower: null,
      lensLabel: "",
      success: false,
    },
    actions: [],
    startedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

export const experimentRecord = createRecord(eyeInput?.value);

function replaceRecord(nextRecord) {
  Object.keys(experimentRecord).forEach((key) => delete experimentRecord[key]);
  Object.assign(experimentRecord, nextRecord);
}

function safeStorageGet(key) {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeStorageSet(key, value) {
  try {
    window.localStorage.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}

function safeStorageRemove(key) {
  try {
    window.localStorage.removeItem(key);
  } catch {
    // Storage can be unavailable in privacy-restricted contexts.
  }
}

function cloneRecord() {
  return JSON.parse(JSON.stringify(experimentRecord));
}

function writeDraft() {
  experimentRecord.updatedAt = new Date().toISOString();
  safeStorageSet(DRAFT_KEY, JSON.stringify(experimentRecord));
}

function logAction(action, detail = {}) {
  experimentRecord.actions.push({
    action,
    ...detail,
    time: new Date().toISOString(),
  });
  if (experimentRecord.actions.length > MAX_ACTIONS) {
    experimentRecord.actions.splice(0, experimentRecord.actions.length - MAX_ACTIONS);
  }
  writeDraft();
}

function restoreDraft() {
  const raw = safeStorageGet(DRAFT_KEY);
  if (!raw) return;
  try {
    const saved = JSON.parse(raw);
    if (
      saved &&
      modelTruth[saved.eyeModel] &&
      saved.eyeModel === validEyeId(eyeInput?.value) &&
      saved.observation &&
      saved.retinaAdjustment &&
      Array.isArray(saved.lensTrial)
    ) {
      replaceRecord({
        ...createRecord(saved.eyeModel),
        ...saved,
        observation: {
          ...createRecord(saved.eyeModel).observation,
          ...saved.observation,
          clarity: modelTruth[saved.eyeModel].clarity,
        },
        retinaAdjustment: {
          ...createRecord(saved.eyeModel).retinaAdjustment,
          ...saved.retinaAdjustment,
        },
        finalResult: {
          ...createRecord(saved.eyeModel).finalResult,
          ...saved.finalResult,
        },
        actions: Array.isArray(saved.actions) ? saved.actions.slice(-MAX_ACTIONS) : [],
      });

      const adjustment = experimentRecord.retinaAdjustment;
      const rangeMin = Number(screenInput?.min);
      const rangeMax = Number(screenInput?.max);
      const initialPosition = Number(adjustment.initialPosition);
      const positionIsValid = (value) => Number.isFinite(value)
        && value >= rangeMin
        && value <= rangeMax;

      if (!positionIsValid(initialPosition)) {
        adjustment.initialPosition = readScreenPosition();
      }
      adjustment.measurements = Array.isArray(adjustment.measurements)
        ? adjustment.measurements
          .map(Number)
          .filter(positionIsValid)
          .slice(0, 3)
        : [];
      if (adjustment.measurements.length < 3) {
        adjustment.bestPosition = null;
        adjustment.offset = null;
      } else {
        adjustment.bestPosition = Number(
          (
            adjustment.measurements.reduce((sum, value) => sum + value, 0)
            / adjustment.measurements.length
          ).toFixed(2),
        );
        adjustment.offset = Number(
          (adjustment.bestPosition - Number(adjustment.initialPosition)).toFixed(2),
        );
      }
    }
  } catch {
    safeStorageRemove(DRAFT_KEY);
  }
}

function notebookTemplate() {
  return `
    <header class="record-book-head">
      <div class="record-book-title">
        <span class="record-book-icon" aria-hidden="true">⌁</span>
        <div>
          <p>LAB PROCESS LOG</p>
          <h3>实验记录本</h3>
        </div>
      </div>
      <button class="record-collapse" id="record-collapse" type="button" aria-expanded="true" aria-label="收起实验记录本">⌃</button>
    </header>

    <section class="record-operation-dock" aria-labelledby="record-operation-title">
      <header class="record-operation-head">
        <span aria-hidden="true">PREP</span>
        <div>
          <h4 id="record-operation-title">实验准备</h4>
          <p>先完成光源自准直，再安装模拟眼并开始测量。</p>
        </div>
      </header>
      <div class="record-operation-controls" id="record-operation-controls"></div>
    </section>

    <div class="record-steps">
      <details class="record-step" data-record-step="1" open>
        <summary class="record-step-head">
          <span class="record-step-number">01</span>
          <div><p>STEP 01</p><h4>模拟眼选择</h4></div>
          <span class="record-step-state">等待安装</span>
        </summary>
        <div class="record-step-body">
          <div class="record-current-eye">
            <span>当前模拟眼</span>
            <strong>模拟眼 <span id="record-eye-id">D</span></strong>
          </div>
          <div class="record-eye-model-box" id="record-eye-model-box"></div>
          <p class="record-step-note">安装完成后，调节像屏寻找该模型的最佳成像位置。</p>
        </div>
      </details>

      <details class="record-step record-screen-stage" data-record-step="2" open>
        <summary class="record-step-head">
          <span class="record-step-number">02</span>
          <div><p>STEP 02</p><h4>像屏调节</h4></div>
          <span class="record-step-state">未完成</span>
        </summary>
        <div class="record-step-body">
          <div class="record-screen-controls" id="record-screen-controls"></div>
          <div class="record-screen-feedback">
            <div class="record-retina-readout">
              <span>当前记录位置</span>
              <p><strong id="record-retina-value">24.00</strong><em>cm</em></p>
            </div>
            <div class="record-clarity-scale" aria-label="当前成像清晰度">
              <span data-record-clarity="blur">模糊</span>
              <span data-record-clarity="improve">较清晰</span>
              <span data-record-clarity="clear">最清晰</span>
            </div>
            <div class="record-retina-measurements" aria-label="三次像屏位置记录">
              <div><span>第 1 次</span><strong data-record-retina-measurement="0">—</strong></div>
              <div><span>第 2 次</span><strong data-record-retina-measurement="1">—</strong></div>
              <div><span>第 3 次</span><strong data-record-retina-measurement="2">—</strong></div>
            </div>
            <div class="record-adjustment-data">
              <div><span>初始位置</span><strong id="record-retina-initial">24.00 cm</strong></div>
              <div><span id="record-retina-best-label">三次平均位置</span><strong id="record-retina-best">—</strong></div>
              <div><span>移动距离</span><strong id="record-retina-offset">—</strong></div>
            </div>
          </div>
          <p class="record-step-note"><span aria-hidden="true">↔</span> 每次调到最清晰后记录当前位置；完成三次测量后进入裸眼判断。</p>
          <div class="record-screen-actions" id="record-screen-actions"></div>
        </div>
      </details>

      <details class="record-step" data-record-step="3" open>
        <summary class="record-step-head">
          <span class="record-step-number">03</span>
          <div><p>STEP 03</p><h4>裸眼成像观察</h4></div>
          <span class="record-step-state">未完成</span>
        </summary>
        <div class="record-step-body">
          <div class="record-reference-position">
            <div>
              <span>已知正视眼基准</span>
              <strong>模拟眼 D · ${EYES.D.focusCm.toFixed(2)} cm</strong>
              <small>将像屏回到正视眼最佳位置，再根据当前光斑和光线判断未知模拟眼。</small>
            </div>
            <button id="record-move-to-d-reference" type="button">移至 D 眼最佳位置</button>
          </div>
          <fieldset class="record-fieldset">
            <legend>焦点位置</legend>
            <div class="record-choice-grid">
              <label class="record-choice"><input type="radio" name="record-focus" value="front_retina" />视网膜前</label>
              <label class="record-choice"><input type="radio" name="record-focus" value="on_retina" />视网膜上</label>
              <label class="record-choice"><input type="radio" name="record-focus" value="behind_retina" />视网膜后</label>
              <label class="record-choice"><input type="radio" name="record-focus" value="two_directions" />不同方向不同</label>
            </div>
          </fieldset>
          <fieldset class="record-fieldset">
            <legend>学生判断</legend>
            <div class="record-choice-grid">
              <label class="record-choice"><input type="radio" name="record-diagnosis" value="normal" />正常眼</label>
              <label class="record-choice"><input type="radio" name="record-diagnosis" value="myopia" />近视眼</label>
              <label class="record-choice"><input type="radio" name="record-diagnosis" value="hyperopia" />远视眼</label>
              <label class="record-choice"><input type="radio" name="record-diagnosis" value="astigmatism" />散光</label>
            </div>
          </fieldset>
          <p class="record-feedback" id="record-observation-feedback">请根据光路与成像现象完成记录。</p>
        </div>
      </details>

      <details class="record-step" data-record-step="4">
        <summary class="record-step-head">
          <span class="record-step-number">04</span>
          <div><p>STEP 04</p><h4>矫正镜片选择</h4></div>
          <span class="record-step-state">未完成</span>
        </summary>
        <div class="record-step-body">
          <div class="record-lens-workflow" id="record-lens-workflow" data-state="closed">
            <div class="record-lens-gate">
              <span class="record-lens-glyph" aria-hidden="true">◫</span>
              <div class="record-lens-gate-copy">
                <strong id="record-lens-status-title">镜片盒未打开</strong>
                <small id="record-lens-status-copy">先打开镜片盒，再选择需要安装的矫正镜片。</small>
              </div>
              <button class="record-open-lens" id="record-open-lens" type="button">打开镜片盒</button>
            </div>
            <div class="record-lens-workspace" id="record-lens-workspace" hidden>
              <div class="record-lens-controls" id="record-lens-controls" aria-label="矫正镜片调节"></div>
              <div class="record-lens-commit">
                <div class="record-lens-selection">
                  <span>待安装镜片</span>
                  <strong id="record-lens-preview">未加镜片</strong>
                </div>
                <button id="record-apply-lens" type="button">安装并记录</button>
              </div>
            </div>
          </div>
          <div class="record-trial-wrap" id="record-trial-wrap" hidden>
            <div class="record-trial-head">
              <strong>镜片尝试记录</strong>
              <small>每次安装后自动判断成像状态</small>
            </div>
            <table class="record-trial-table" aria-label="镜片尝试记录">
              <thead><tr><th>次数</th><th>镜片</th><th>成像</th></tr></thead>
              <tbody id="record-lens-trials"></tbody>
            </table>
          </div>
        </div>
      </details>

      <details class="record-step" data-record-step="5">
        <summary class="record-step-head">
          <span class="record-step-number">05</span>
          <div><p>STEP 05</p><h4>最终结果</h4></div>
          <span class="record-step-state">未完成</span>
        </summary>
        <div class="record-step-body">
          <div class="record-final-grid">
            <div><span>模拟眼</span><strong id="record-final-eye">—</strong></div>
            <div><span>屈光类型</span><strong id="record-final-diagnosis">—</strong></div>
            <div><span>最佳矫正镜片</span><strong id="record-final-lens">—</strong></div>
          </div>
          <div class="record-result-controls" id="record-result-controls" aria-label="实时计算结果"></div>
          <p class="record-complete-banner" id="record-complete-banner" hidden>✓ 实验完成，过程数据已形成完整记录。</p>
        </div>
      </details>
    </div>

    <div class="record-book-actions">
      <button id="record-save-data" type="button">保存实验数据</button>
      <button class="record-clear" id="record-clear-data" type="button">清空重新实验</button>
    </div>
    <p class="record-save-status" id="record-save-status" role="status" aria-live="polite"></p>
  `;
}

function formatSigned(value, digits = 2, unit = "") {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return "—";
  const number = Number(value);
  const sign = number > 0 ? "+" : "";
  return `${sign}${number.toFixed(digits)}${unit}`;
}

function setStepState(stepNumber, state, label) {
  const step = root.querySelector(`[data-record-step="${stepNumber}"]`);
  if (!step) return;
  step.classList.toggle("is-complete", state === "complete");
  step.classList.toggle("is-error", state === "error");
  const stateElement = step.querySelector(".record-step-state");
  if (stateElement) stateElement.textContent = label;
}

function observationIsCorrect() {
  const truth = modelTruth[experimentRecord.eyeModel];
  const observation = experimentRecord.observation;
  return (
    observationIsReady() &&
    observation.focusPosition === truth.focus &&
    observation.diagnosis === truth.diagnosis
  );
}

function screenIsAtDReference() {
  return Math.abs(
    Number(experimentRecord.retinaAdjustment.currentPosition) - Number(EYES.D.focusCm),
  ) < 0.01;
}

function observationIsReady() {
  return retinaPositionIsComplete() && screenIsAtDReference();
}

function updateStepOne() {
  const eyeId = experimentRecord.eyeModel;
  root.querySelector("#record-eye-id").textContent = eyeId;
  setStepState(1, "complete", "✓ 已安装");
}

function updateObservationUI() {
  const observation = experimentRecord.observation;
  const measurementsComplete = retinaPositionIsComplete();
  const ready = observationIsReady();
  const observationStep = root.querySelector('[data-record-step="3"]');
  const referenceButton = root.querySelector("#record-move-to-d-reference");
  root.querySelectorAll('input[name="record-focus"]').forEach((input) => {
    input.checked = input.value === observation.focusPosition;
    input.disabled = !ready;
  });
  root.querySelectorAll('input[name="record-diagnosis"]').forEach((input) => {
    input.checked = input.value === observation.diagnosis;
    input.disabled = !ready;
  });
  observationStep?.classList.toggle("is-locked", !ready);
  referenceButton.disabled = !measurementsComplete || ready;
  referenceButton.textContent = ready
    ? `已位于 D 眼基准位置（${EYES.D.focusCm.toFixed(2)} cm）`
    : "移至 D 眼最佳位置";

  const feedback = root.querySelector("#record-observation-feedback");
  const allAnswered = observation.focusPosition && observation.diagnosis;
  feedback.classList.remove("is-success", "is-error");

  if (!measurementsComplete) {
    feedback.textContent = "请先完成像屏调节，再记录焦点位置与屈光判断。";
    setStepState(3, "pending", "等待调焦");
    return;
  }

  if (!ready) {
    feedback.textContent = "三次测量已完成，请先将像屏移至正视眼 D 的最佳位置。";
    setStepState(3, "pending", "待移至 D 位");
    return;
  }

  if (!allAnswered) {
    feedback.textContent = "请根据光路与成像现象完成记录。";
    setStepState(3, "pending", "未完成");
    return;
  }

  if (observationIsCorrect()) {
    feedback.textContent = "✓ 判断正确，裸眼观察结果已记录。";
    feedback.classList.add("is-success");
    setStepState(3, "complete", "✓ 已记录");
    return;
  }

  const truth = modelTruth[experimentRecord.eyeModel];
  if (observation.focusPosition !== truth.focus) {
    feedback.textContent = "× 请重新观察焦点位置。";
  } else if (observation.diagnosis !== truth.diagnosis) {
    feedback.textContent = "× 屈光状态判断不正确，请结合焦点位置重新判断。";
  } else {
    feedback.textContent = "× 请重新核对焦点位置与屈光状态判断。";
  }
  feedback.classList.add("is-error");
  setStepState(3, "error", "需复查");
}

function clarityAtPosition(position) {
  const truth = modelTruth[experimentRecord.eyeModel];
  return classifyFocusClarity(Number(position) - truth.bestRetina);
}

function retinaPositionIsComplete() {
  const adjustment = experimentRecord.retinaAdjustment;
  return (
    adjustment.measurements.length === 3
    && adjustment.bestPosition !== null
  );
}

function syncRetinaFromExperiment({ commit = false, confirm = false } = {}) {
  const position = readScreenPosition();
  const adjustment = experimentRecord.retinaAdjustment;
  const clarity = clarityAtPosition(position);
  let accepted = false;

  adjustment.currentPosition = position;
  if (
    confirm
    && clarity === "clear"
    && adjustment.measurements.length < 3
  ) {
    accepted = true;
    adjustment.measurements.push(Number(position.toFixed(2)));
    if (adjustment.measurements.length === 3) {
      adjustment.bestPosition = Number(
        (
          adjustment.measurements.reduce((sum, value) => sum + value, 0)
          / adjustment.measurements.length
        ).toFixed(2),
      );
      adjustment.offset = Number(
        (adjustment.bestPosition - Number(adjustment.initialPosition)).toFixed(2),
      );
    }
  }

  if (commit) {
    logAction("move_retina", {
      position,
      clarity,
    });
  }
  if (confirm) {
    logAction("record_retina", {
      position,
      clarity,
      accepted,
      index: accepted ? adjustment.measurements.length : null,
    });
  }
  return {
    accepted,
    clarity,
    count: adjustment.measurements.length,
    complete: retinaPositionIsComplete(),
  };
}

function updateRetinaUI() {
  const adjustment = experimentRecord.retinaAdjustment;
  const current = Number(adjustment.currentPosition);
  const clarity = clarityAtPosition(current);
  const measurementCount = adjustment.measurements.length;

  root.querySelector("#record-retina-value").textContent = current.toFixed(2);
  root.querySelector("#record-retina-initial").textContent = `${Number(adjustment.initialPosition).toFixed(2)} cm`;
  root.querySelector("#record-retina-best-label").textContent = experimentRecord.eyeModel === "S"
    ? "三次平均观察位置"
    : "三次平均位置";
  root.querySelector("#record-retina-best").textContent = adjustment.bestPosition === null
    ? "—"
    : experimentRecord.eyeModel === "S"
      ? `${Number(adjustment.bestPosition).toFixed(2)} cm（仍有散光）`
      : `${Number(adjustment.bestPosition).toFixed(2)} cm`;
  root.querySelector("#record-retina-offset").textContent = adjustment.offset === null
    ? "—"
    : formatSigned(adjustment.offset, 2, " cm");
  root.querySelectorAll("[data-record-clarity]").forEach((item) => {
    item.classList.toggle("is-active", item.dataset.recordClarity === clarity);
  });
  root.querySelectorAll("[data-record-retina-measurement]").forEach((item) => {
    const index = Number(item.dataset.recordRetinaMeasurement);
    const value = adjustment.measurements[index];
    item.textContent = Number.isFinite(value) ? `${value.toFixed(2)} cm` : "—";
    item.closest("div")?.classList.toggle("is-recorded", Number.isFinite(value));
  });
  if (recordMeasurementButton) {
    recordMeasurementButton.disabled = retinaPositionIsComplete();
    recordMeasurementButton.textContent = retinaPositionIsComplete()
      ? "三次测量已完成"
      : `记录第 ${measurementCount + 1} 次测量结果`;
  }

  if (retinaPositionIsComplete()) {
    setStepState(2, "complete", "✓ 已记录 3/3");
  } else {
    const label = measurementCount > 0
      ? `已记录 ${measurementCount}/3`
      : clarity === "clear"
        ? "可记录 0/3"
      : clarity === "improve"
        ? "接近清晰"
        : "未完成";
    setStepState(2, "pending", label);
  }
}

function renderLensTrials() {
  updateLensWorkflow();
  const tbody = root.querySelector("#record-lens-trials");
  const workflowReady = retinaPositionIsComplete() && observationIsCorrect();
  if (!experimentRecord.lensTrial.length) {
    tbody.innerHTML = '<tr><td class="record-empty-row" colspan="3">选择镜片后，点击“安装并记录”</td></tr>';
    setStepState(4, "pending", workflowReady ? "未完成" : "等待判断");
    return;
  }

  tbody.innerHTML = experimentRecord.lensTrial
    .map((trial, index) => `
      <tr>
        <td>${index + 1}</td>
        <td>${escapeHtml(trial.lensLabel)}</td>
        <td class="${trial.result === "clear" ? "is-clear" : ""}">${labels.trial[trial.result]}</td>
      </tr>
    `)
    .join("");

  const corrected = experimentRecord.finalResult.success && workflowReady;
  const label = !workflowReady
    ? "等待判断"
    : corrected
      ? "✓ 已矫正"
      : "继续尝试";
  setStepState(4, corrected ? "complete" : "pending", label);
}

function experimentIsComplete() {
  return (
    observationIsCorrect() &&
    retinaPositionIsComplete() &&
    experimentRecord.finalResult.success
  );
}

function updateFinalUI() {
  const complete = experimentIsComplete();
  const truth = modelTruth[experimentRecord.eyeModel];
  root.querySelector("#record-final-eye").textContent = `模拟眼 ${experimentRecord.eyeModel}`;
  root.querySelector("#record-final-diagnosis").textContent = complete ? truth.diagnosisLabel : "—";
  root.querySelector("#record-final-lens").textContent = complete
    ? experimentRecord.finalResult.lensLabel
    : "—";
  root.querySelector("#record-complete-banner").hidden = !complete;
  const pendingLabel = !retinaPositionIsComplete()
    ? "等待调焦"
    : !observationIsReady()
      ? "等待基准复位"
      : !observationIsCorrect()
        ? "等待判断"
        : !experimentRecord.finalResult.success
          ? "等待矫正"
          : "未完成";
  setStepState(5, complete ? "complete" : "pending", complete ? "✓ 实验完成" : pendingLabel);

  if (complete && !experimentRecord.finalResult.completedAt) {
    experimentRecord.finalResult.diagnosis = truth.diagnosis;
    experimentRecord.finalResult.completedAt = new Date().toISOString();
    logAction("complete_experiment", {
      eyeModel: experimentRecord.eyeModel,
      lens: experimentRecord.finalResult.lensLabel,
    });
  }
}

function revealCurrentStep() {
  const steps = [...root.querySelectorAll(".record-step")];
  const current = steps.find((step) => !step.classList.contains("is-complete"));
  steps.forEach((step) => {
    step.open = current ? step === current : step === steps.at(-1);
  });
}

function advanceToStep(stepNumber) {
  const target = root.querySelector(`[data-record-step="${stepNumber}"]`);
  if (!target) return;
  root.querySelectorAll(".record-step").forEach((step) => {
    if (Number(step.dataset.recordStep) < stepNumber) step.open = false;
  });
  target.open = true;
}

function updateAllUI() {
  updateStepOne();
  updateRetinaUI();
  updateObservationUI();
  renderLensTrials();
  updateFinalUI();
  revealCurrentStep();
}

function resetForEye(eyeId, source = "select") {
  const next = createRecord(eyeId);
  replaceRecord(next);
  logAction("select_eye", {
    eyeModel: next.eyeModel,
    source,
  });
  updateAllUI();
}

function readLensSelection() {
  const type = lensTypeInput?.value ?? "none";
  const power = Math.abs(Number(lensPowerInput?.value) || 0);
  const angle = Math.round(Number(cylinderInput?.value) || 0);

  if (type === "concave") {
    return {
      type,
      lensPower: -power,
      lensLabel: `-${power.toFixed(2)}D`,
    };
  }
  if (type === "convex") {
    return {
      type,
      lensPower: power,
      lensLabel: `+${power.toFixed(2)}D`,
    };
  }
  if (type === "cylinder") {
    return {
      type,
      lensPower: "cylinder",
      lensLabel: `柱面镜 / ${angle}°`,
    };
  }
  return {
    type: "none",
    lensPower: 0,
    lensLabel: "未加镜片",
  };
}

function evaluateLensTrial(selection) {
  const expected = modelTruth[experimentRecord.eyeModel].lensPower;
  if (expected === "cylinder") {
    if (selection.type === "cylinder") return "clear";
    if (selection.type !== "none") return "improve";
    return "blur";
  }

  const delta = Math.abs(Number(selection.lensPower) - Number(expected));
  if (delta <= 0.15) return "clear";
  if (delta <= 0.75) return "improve";
  return "blur";
}

let lensBoxOpened = false;
let lastLensSignature = "";

function updateLensWorkflow() {
  const workflow = root?.querySelector("#record-lens-workflow");
  if (!workflow) return;

  const workspace = root.querySelector("#record-lens-workspace");
  const openButton = root.querySelector("#record-open-lens");
  const applyButton = root.querySelector("#record-apply-lens");
  const trialWrap = root.querySelector("#record-trial-wrap");
  const statusTitle = root.querySelector("#record-lens-status-title");
  const statusCopy = root.querySelector("#record-lens-status-copy");
  const preview = root.querySelector("#record-lens-preview");
  const selection = readLensSelection();
  const workflowReady = retinaPositionIsComplete() && observationIsCorrect();
  const corrected = experimentRecord.finalResult.success && workflowReady;
  const correctionStep = root.querySelector('[data-record-step="4"]');

  workflow.dataset.state = corrected ? "complete" : lensBoxOpened ? "open" : "closed";
  workspace.hidden = !lensBoxOpened;
  trialWrap.hidden = !lensBoxOpened;
  openButton.hidden = lensBoxOpened;
  openButton.disabled = !workflowReady;
  applyButton.disabled = !lensBoxOpened || !workflowReady;
  preview.textContent = selection.lensLabel;
  correctionStep?.classList.toggle("is-locked", !workflowReady);

  if (corrected) {
    statusTitle.textContent = "矫正完成";
    statusCopy.textContent = "已获得清晰像，最佳镜片已写入最终结果。";
  } else if (!workflowReady) {
    statusTitle.textContent = "等待完成裸眼判断";
    statusCopy.textContent = "先完成像屏调节并正确判断屈光状态，再打开镜片盒。";
  } else if (lensBoxOpened) {
    statusTitle.textContent = "镜片盒已打开";
    statusCopy.textContent = "调节镜片参数，确认后安装到光具座并记录结果。";
  } else {
    statusTitle.textContent = "镜片盒未打开";
    statusCopy.textContent = "先打开镜片盒，再选择需要安装的矫正镜片。";
  }
}

function recordLensAttempt() {
  if (!retinaPositionIsComplete() || !observationIsCorrect()) {
    showSaveStatus("请先完成像屏调节和裸眼判断，再安装矫正镜片。", false);
    return;
  }
  if (!lensBoxOpened) lensBoxOpened = true;
  const selection = readLensSelection();
  const signature = `${selection.type}|${selection.lensPower}|${selection.lensLabel}`;
  if (signature === lastLensSignature) {
    showSaveStatus("当前镜片已记录，请调整镜片后再进行下一次尝试。", false);
    return;
  }
  lastLensSignature = signature;

  const result = evaluateLensTrial(selection);
  const trial = {
    lens: selection.lensPower,
    lensLabel: selection.lensLabel,
    result,
    time: new Date().toISOString(),
  };
  experimentRecord.lensTrial.push(trial);
  experimentRecord.lensTrial = experimentRecord.lensTrial.slice(-20);

  if (result === "clear") {
    experimentRecord.finalResult = {
      diagnosis: modelTruth[experimentRecord.eyeModel].diagnosis,
      lensPower: selection.lensPower,
      lensLabel: selection.lensLabel,
      success: true,
      completedAt: experimentRecord.finalResult.completedAt ?? "",
    };
  } else {
    experimentRecord.finalResult = {
      diagnosis: "",
      lensPower: null,
      lensLabel: "",
      success: false,
    };
  }

  logAction("change_lens", {
    lens: selection.lensLabel,
    result,
  });
  document.dispatchEvent(new CustomEvent("experiment-lens-trial-recorded", {
    detail: {
      eyeId: experimentRecord.eyeModel,
      lensType: selection.type,
      lensPower: selection.lensPower,
      lensLabel: selection.lensLabel,
      result,
    },
  }));
  updateLensWorkflow();
  renderLensTrials();
  updateFinalUI();
  showSaveStatus(
    experimentRecord.eyeModel === "S"
      ? `已记录镜片尝试：${selection.lensLabel}。`
      : `已记录镜片尝试：${selection.lensLabel}，实配值已同步到实验表。`,
  );
  if (result === "clear" && experimentIsComplete()) advanceToStep(5);
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function formatDateTime(value) {
  if (!value) return "—";
  try {
    return new Intl.DateTimeFormat("zh-CN", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    }).format(new Date(value));
  } catch {
    return "—";
  }
}

function actionDescription(action) {
  if (action.action === "select_eye") return `选择并安装模拟眼 ${action.eyeModel}`;
  if (action.action === "record_observation") {
    const valueLabel = labels.clarity[action.value] || labels.focus[action.value] || labels.diagnosis[action.value] || action.value;
    return `记录${action.field}：${valueLabel}`;
  }
  if (action.action === "move_retina") return `移动视网膜至 ${Number(action.position).toFixed(2)} cm，成像${labels.trial[action.clarity]}`;
  if (action.action === "record_retina") {
    return action.accepted
      ? `记录第 ${action.index} 次像屏位置 ${Number(action.position).toFixed(2)} cm`
      : `尝试记录像屏位置 ${Number(action.position).toFixed(2)} cm，成像尚未清晰`;
  }
  if (action.action === "move_to_d_reference") {
    return `像屏移至正视眼 D 基准位置 ${Number(action.position).toFixed(2)} cm`;
  }
  if (action.action === "change_lens") return `更换镜片为 ${action.lens}，成像${labels.trial[action.result]}`;
  if (action.action === "complete_experiment") return `完成实验，最佳镜片 ${action.lens}`;
  if (action.action === "save_record") return "保存实验过程数据";
  if (action.action === "generate_report") return "生成标准实验报告";
  return action.action;
}

function reportBody() {
  const record = experimentRecord;
  const truth = modelTruth[record.eyeModel];
  const observation = record.observation;
  const adjustment = record.retinaAdjustment;
  const finalLens = record.finalResult.lensLabel || "未完成";
  const status = experimentIsComplete() ? "实验完成" : "实验尚未完成";
  const trialRows = record.lensTrial.length
    ? record.lensTrial.map((trial, index) => `
        <tr>
          <td>${index + 1}</td>
          <td>模拟眼 ${escapeHtml(record.eyeModel)}</td>
          <td>${escapeHtml(trial.lensLabel)}</td>
          <td>${labels.trial[trial.result]}</td>
        </tr>
      `).join("")
    : '<tr><td colspan="4">暂无镜片尝试记录</td></tr>';
  const actionRows = record.actions.length
    ? record.actions.map((action, index) => `
        <tr>
          <td>${index + 1}</td>
          <td>${escapeHtml(actionDescription(action))}</td>
          <td>${escapeHtml(formatDateTime(action.time))}</td>
        </tr>
      `).join("")
    : '<tr><td colspan="3">暂无过程操作记录</td></tr>';

  return `
    <article class="generated-experiment-report">
      <h1>模拟眼屈光不正及矫正实验报告</h1>
      <div class="report-generated-meta">
        <span>实验对象：模拟眼 ${escapeHtml(record.eyeModel)}</span>
        <span>生成时间：${escapeHtml(formatDateTime(new Date().toISOString()))}</span>
        <span>状态：${status}</span>
      </div>

      <h2>一、实验目的</h2>
      <p>通过模拟眼模型观察屈光系统成像，判断焦点与视网膜的相对位置；通过移动视网膜寻找最清晰像，并选择合适的矫正镜片，掌握近视、远视与散光的实验判别和矫正方法。</p>

      <h2>二、实验原理</h2>
      <p>平行光经模拟眼屈光系统后，焦点落在视网膜上时成像清晰；焦点位于视网膜前为近视状态，需用凹透镜矫正；焦点位于视网膜后为远视状态，需用凸透镜矫正；不同方向焦点不重合时表现为散光，通常使用柱面镜矫正。</p>

      <h2>三、实验步骤</h2>
      <ol>
        <li>调节点光源与双凸透镜，使光源位于透镜焦点处并获得平行光。</li>
        <li>从模拟眼模型盒选择模型并安装到光具座。</li>
        <li>移动视网膜像屏，寻找清晰范围并记录实际位置与位移。</li>
        <li>根据光路与成像现象记录焦点位置，判断模拟眼屈光状态。</li>
        <li>依次尝试矫正镜片，记录成像效果并确定最佳矫正方案。</li>
      </ol>
      <table class="report-process-table">
        <caption>实验过程操作记录</caption>
        <thead><tr><th>序号</th><th>操作</th><th>时间</th></tr></thead>
        <tbody>${actionRows}</tbody>
      </table>

      <h2>四、实验数据</h2>
      <table>
        <caption>表1 裸眼观察记录</caption>
        <thead><tr><th>模拟眼</th><th>成像状态</th><th>焦点位置</th><th>判断</th></tr></thead>
        <tbody><tr>
          <td>${escapeHtml(record.eyeModel)}</td>
          <td>${labels.clarity[observation.clarity] || "未记录"}</td>
          <td>${labels.focus[observation.focusPosition] || "未记录"}</td>
          <td>${labels.diagnosis[observation.diagnosis] || "未记录"}</td>
        </tr></tbody>
      </table>
      <table>
        <caption>表2 调焦记录</caption>
        <thead><tr><th>模拟眼</th><th>初始位置</th><th>最佳位置</th><th>偏移</th></tr></thead>
        <tbody><tr>
          <td>${escapeHtml(record.eyeModel)}</td>
          <td>${Number(adjustment.initialPosition).toFixed(2)} cm</td>
          <td>${adjustment.bestPosition === null ? "未记录" : `${Number(adjustment.bestPosition).toFixed(2)} cm`}</td>
          <td>${adjustment.offset === null ? "未记录" : formatSigned(adjustment.offset, 2, " cm")}</td>
        </tr></tbody>
      </table>
      <table>
        <caption>表3 矫正记录</caption>
        <thead><tr><th>次数</th><th>模拟眼</th><th>镜片</th><th>结果</th></tr></thead>
        <tbody>${trialRows}</tbody>
      </table>

      <h2>五、实验结果</h2>
      <div class="report-result-box">
        <p><strong>模拟眼：</strong>${escapeHtml(record.eyeModel)}</p>
        <p><strong>屈光类型：</strong>${experimentIsComplete() ? truth.diagnosisLabel : "待完成判断"}</p>
        <p><strong>最佳矫正镜片：</strong>${escapeHtml(finalLens)}</p>
        <p><strong>完成状态：</strong>${status}</p>
      </div>

      <h2>六、误差分析</h2>
      <p>误差可能来自视网膜位置读数分辨率、清晰度判断的主观性、镜片焦度调节步长、光具座元件未完全共轴以及模拟眼模型对真实眼球结构的简化。可通过减小调节步长、重复寻找最清晰位置、记录多次镜片尝试并校准元件共轴性来降低误差。</p>
    </article>
  `;
}

function reportDocument() {
  return `<!doctype html>
  <html lang="zh-CN">
    <head>
      <meta charset="UTF-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <title>模拟眼屈光不正及矫正实验报告</title>
      <style>
        *{box-sizing:border-box}
        body{margin:0;padding:32px;background:#eef0f3;color:#242a35}
        .generated-experiment-report{width:min(794px,100%);margin:0 auto;padding:48px;background:#fff;box-shadow:0 8px 28px rgba(20,24,36,.1);font-family:"Noto Serif SC","SimSun",serif}
        h1{margin:0;padding-bottom:14px;border-bottom:2px solid #303846;text-align:center;font-size:28px}
        .report-generated-meta{display:flex;justify-content:space-between;gap:12px;margin:12px 0 22px;color:#69707c;font:10px "Microsoft YaHei",sans-serif}
        h2{margin:22px 0 9px;color:#303846;font-size:16px}
        p,li{color:#404754;font-size:12px;line-height:1.8}
        ol{padding-left:22px}
        table{width:100%;margin:9px 0 16px;border-collapse:collapse;table-layout:fixed}
        caption{margin-bottom:6px;text-align:left;font-size:12px;font-weight:900}
        th,td{padding:7px 5px;border:1px solid #aeb4bf;font:10px/1.5 "Microsoft YaHei",sans-serif;text-align:center;overflow-wrap:anywhere}
        th{background:#f0f2f5}.report-process-table td:nth-child(2){text-align:left}
        .report-result-box{padding:12px 14px;border-left:4px solid #148b78;background:#edf8f5}
        @media print{body{padding:0;background:#fff}.generated-experiment-report{width:100%;box-shadow:none;padding:20mm}}
      </style>
    </head>
    <body>${reportBody()}</body>
  </html>`;
}

function openReportPreview() {
  logAction("generate_report", {
    complete: experimentIsComplete(),
  });
  reportModal.innerHTML = `
    <section class="record-report-shell" role="dialog" aria-modal="true" aria-labelledby="record-report-title">
      <header class="record-report-toolbar">
        <div>
          <h2 id="record-report-title">实验报告预览</h2>
          <p>包含实验过程、三张标准数据表、结果与误差分析</p>
        </div>
        <div class="record-report-toolbar-actions">
          <button type="button" data-report-action="print">打印 / 保存PDF</button>
          <button type="button" data-report-action="download">导出HTML</button>
          <button type="button" data-report-action="close">关闭</button>
        </div>
      </header>
      <div class="record-report-preview">${reportBody()}</div>
    </section>
  `;
  reportModal.hidden = false;
  reportModal.querySelector('[data-report-action="close"]')?.focus();
}

function downloadReport() {
  const blob = new Blob([reportDocument()], { type: "text/html;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `模拟眼${experimentRecord.eyeModel}-屈光不正及矫正实验报告.html`;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function printReport() {
  const printWindow = window.open("", "_blank");
  if (!printWindow) {
    showSaveStatus("浏览器阻止了打印窗口，请允许弹出窗口后重试。", false);
    return;
  }
  printWindow.opener = null;
  printWindow.document.open();
  printWindow.document.write(reportDocument());
  printWindow.document.close();
  printWindow.addEventListener("load", () => {
    printWindow.focus();
    printWindow.print();
  });
}

let saveStatusTimer = 0;
let clearArmed = false;
let clearArmedTimer = 0;

function collectExperimentControlNodes() {
  return {
    operation: [
      document.querySelector('[data-operation-control="collimation"]'),
    ].filter(Boolean),
    screen: [
      document.querySelector('[data-operation-control="screen"]'),
    ].filter(Boolean),
    screenActions: [
      document.querySelector(".essential-control-actions"),
    ].filter(Boolean),
    correction: [...document.querySelectorAll("[data-correction-control]")],
    result: [...document.querySelectorAll("[data-result-control]")],
    eyeModelBox: [
      document.querySelector("#eye-model-box-trigger"),
      document.querySelector("#eye-model-box-drawer"),
    ].filter(Boolean),
  };
}

function mountExperimentControls(nodes) {
  const operationTarget = root.querySelector("#record-operation-controls");
  const screenTarget = root.querySelector("#record-screen-controls");
  const screenActionTarget = root.querySelector("#record-screen-actions");
  const correctionTarget = root.querySelector("#record-lens-controls");
  const resultTarget = root.querySelector("#record-result-controls");
  const eyeModelTarget = root.querySelector("#record-eye-model-box");
  nodes.operation.forEach((node) => operationTarget?.append(node));
  nodes.screen.forEach((node) => {
    if (node.matches("details")) {
      node.open = true;
      node.classList.add("record-embedded-control");
    }
    screenTarget?.append(node);
  });
  nodes.screenActions.forEach((node) => screenActionTarget?.append(node));
  nodes.correction.forEach((node) => correctionTarget?.append(node));
  nodes.result.forEach((node) => resultTarget?.append(node));
  nodes.eyeModelBox.forEach((node) => eyeModelTarget?.append(node));
}

function showSaveStatus(message, success = true) {
  const status = root.querySelector("#record-save-status");
  window.clearTimeout(saveStatusTimer);
  status.textContent = message;
  status.classList.toggle("is-success", success);
  saveStatusTimer = window.setTimeout(() => {
    status.textContent = "";
    status.classList.remove("is-success");
  }, 3200);
}

if (root && reportModal && eyeInput && lensTypeInput && lensPowerInput && cylinderInput) {
  const experimentControlNodes = collectExperimentControlNodes();
  root.innerHTML = notebookTemplate();
  mountExperimentControls(experimentControlNodes);
  restoreDraft();
  lensBoxOpened = experimentRecord.lensTrial.length > 0;
  syncRetinaFromExperiment();
  if (experimentRecord.actions.length === 0) {
    logAction("select_eye", {
      eyeModel: experimentRecord.eyeModel,
      source: "initial",
    });
  }
  updateAllUI();

  root.addEventListener("change", (event) => {
    const input = event.target;
    if (!(input instanceof HTMLInputElement)) return;

    if (input.name === "record-focus") {
      experimentRecord.observation.focusPosition = input.value;
      logAction("record_observation", { field: "焦点位置", value: input.value });
    } else if (input.name === "record-diagnosis") {
      experimentRecord.observation.diagnosis = input.value;
      logAction("record_observation", { field: "屈光判断", value: input.value });
    } else {
      return;
    }

    updateObservationUI();
    updateLensWorkflow();
    updateFinalUI();
    if (observationIsCorrect()) advanceToStep(4);
  });

  screenInput?.addEventListener("input", () => {
    syncRetinaFromExperiment();
    updateRetinaUI();
    updateObservationUI();
    updateLensWorkflow();
    updateFinalUI();
  });

  screenInput?.addEventListener("change", () => {
    syncRetinaFromExperiment({ commit: true });
    updateRetinaUI();
    updateObservationUI();
    updateLensWorkflow();
    updateFinalUI();
  });

  recordMeasurementButton?.addEventListener("click", () => {
    const measurement = syncRetinaFromExperiment({ confirm: true });
    updateRetinaUI();
    updateObservationUI();
    updateLensWorkflow();
    updateFinalUI();
    if (measurement.accepted) {
      document.dispatchEvent(new CustomEvent("experiment-retina-measurement-recorded", {
        detail: {
          eyeId: experimentRecord.eyeModel,
          position: Number(readScreenPosition().toFixed(2)),
          index: measurement.count,
        },
      }));
      if (measurement.complete) {
        showSaveStatus(
          `三次测量完成，平均位置 ${Number(experimentRecord.retinaAdjustment.bestPosition).toFixed(2)} cm。`,
        );
        advanceToStep(3);
      } else {
        showSaveStatus(
          `已记录第 ${measurement.count} 次像屏位置，还需 ${3 - measurement.count} 次。`,
        );
      }
    } else if (measurement.complete) {
      showSaveStatus("三次像屏位置已经记录完成。");
    } else {
      showSaveStatus("当前光斑尚未进入清晰范围，请继续调节像屏。", false);
    }
  });

  root.querySelector("#record-move-to-d-reference").addEventListener("click", () => {
    if (!retinaPositionIsComplete()) {
      showSaveStatus("请先完成三次像屏位置测量。", false);
      return;
    }
    const referencePosition = Number(EYES.D.focusCm.toFixed(2));
    experimentRecord.observation.focusPosition = "";
    experimentRecord.observation.diagnosis = "";
    screenInput.value = String(referencePosition);
    screenInput.dispatchEvent(new Event("input", { bubbles: true }));
    screenInput.dispatchEvent(new Event("change", { bubbles: true }));
    logAction("move_to_d_reference", {
      position: referencePosition,
      eyeModel: experimentRecord.eyeModel,
    });
    updateObservationUI();
    showSaveStatus(`像屏已移至正视眼 D 的最佳位置 ${referencePosition.toFixed(2)} cm，请观察光斑和光线。`);
  });

  root.querySelector("#record-open-lens").addEventListener("click", () => {
    lensBoxOpened = true;
    updateLensWorkflow();
    lensTypeInput.focus({ preventScroll: true });
    showSaveStatus("镜片盒已打开：选择镜片后，点击“安装并记录”完成一次尝试。");
  });

  root.querySelector("#record-apply-lens").addEventListener("click", recordLensAttempt);

  root.querySelector("#record-collapse").addEventListener("click", (event) => {
    const notebookTop = root.getBoundingClientRect().top;
    const collapsed = root.classList.toggle("is-collapsed");
    event.currentTarget.setAttribute("aria-expanded", String(!collapsed));
    event.currentTarget.setAttribute("aria-label", collapsed ? "展开实验记录本" : "收起实验记录本");
    event.currentTarget.textContent = collapsed ? "⌄" : "⌃";
    if (!collapsed) root.scrollTo({ top: 0, behavior: "auto" });
    event.currentTarget.blur();

    window.requestAnimationFrame(() => {
      const shift = root.getBoundingClientRect().top - notebookTop;
      if (Math.abs(shift) > 0.5) window.scrollBy({ top: shift, behavior: "auto" });
    });
  });

  root.querySelector("#record-save-data").addEventListener("click", () => {
    logAction("save_record", {
      complete: experimentIsComplete(),
    });
    const saved = safeStorageSet(SAVED_KEY, JSON.stringify(cloneRecord()));
    showSaveStatus(saved ? "实验过程数据已保存。" : "保存失败：浏览器未允许本地存储。", saved);
  });

  root.querySelector("#record-clear-data").addEventListener("click", () => {
    const clearButton = root.querySelector("#record-clear-data");
    if (!clearArmed) {
      clearArmed = true;
      clearButton.textContent = "再次点击确认清空";
      showSaveStatus("再次点击将只清空记录本，不会改变当前光具座。", false);
      window.clearTimeout(clearArmedTimer);
      clearArmedTimer = window.setTimeout(() => {
        clearArmed = false;
        clearButton.textContent = "清空重新实验";
      }, 4200);
      return;
    }

    clearArmed = false;
    window.clearTimeout(clearArmedTimer);
    clearButton.textContent = "清空重新实验";
    safeStorageRemove(DRAFT_KEY);
    safeStorageRemove(SAVED_KEY);
    replaceRecord(createRecord(eyeInput.value));
    lensBoxOpened = false;
    lastLensSignature = "";
    logAction("select_eye", {
      eyeModel: experimentRecord.eyeModel,
      source: "restart",
    });
    updateAllUI();
    showSaveStatus("记录本已清空，可以重新实验。");
  });

  eyeInput.addEventListener("input", () => {
    if (!modelTruth[eyeInput.value] || eyeInput.value === experimentRecord.eyeModel) return;
    lensBoxOpened = false;
    lastLensSignature = "";
    resetForEye(eyeInput.value, "experiment_control");
  });

  document.addEventListener("eye-model-installed", (event) => {
    const eyeId = event.detail?.id;
    if (!modelTruth[eyeId] || eyeId === experimentRecord.eyeModel) return;
    lensBoxOpened = false;
    lastLensSignature = "";
    resetForEye(eyeId, "model_box");
  });

  [
    lensTypeInput,
    lensPowerInput,
    lensPowerValue,
    cylinderInput,
    cylinderValue,
  ].filter(Boolean).forEach((input) => {
    input.addEventListener("input", updateLensWorkflow);
    input.addEventListener("change", updateLensWorkflow);
  });

  autoCorrectButton?.addEventListener("click", () => {
    lensBoxOpened = true;
    window.setTimeout(() => {
      updateLensWorkflow();
      recordLensAttempt();
    }, 0);
  });

  reportModal.addEventListener("click", (event) => {
    if (event.target === reportModal || event.target.closest('[data-report-action="close"]')) {
      reportModal.hidden = true;
      return;
    }
    if (event.target.closest('[data-report-action="download"]')) {
      downloadReport();
      return;
    }
    if (event.target.closest('[data-report-action="print"]')) {
      printReport();
    }
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !reportModal.hidden) reportModal.hidden = true;
  });
}
