export const eyeModels = Object.freeze({
  A: {
    id: "A",
    name: "高度近视眼",
    eyeLength: 27.5,
    lensPower: "偏强",
    focusPosition: "retina_front_far",
    refractiveType: "myopia",
    correctLens: "-3.00D",
  },
  B: {
    id: "B",
    name: "中度近视眼",
    eyeLength: 26.5,
    lensPower: "偏强",
    focusPosition: "retina_front",
    refractiveType: "myopia",
    correctLens: "-2.00D",
  },
  C: {
    id: "C",
    name: "轻度近视眼",
    eyeLength: 25.5,
    lensPower: "偏强",
    focusPosition: "retina_front",
    refractiveType: "myopia",
    correctLens: "-1.50D",
  },
  D: {
    id: "D",
    name: "正视眼",
    eyeLength: 24,
    lensPower: "正常",
    focusPosition: "retina",
    refractiveType: "normal",
    correctLens: "0D",
  },
  E: {
    id: "E",
    name: "轻度远视眼",
    eyeLength: 23,
    lensPower: "偏弱",
    focusPosition: "retina_back",
    refractiveType: "hyperopia",
    correctLens: "+1.50D",
  },
  F: {
    id: "F",
    name: "中度远视眼",
    eyeLength: 22.5,
    lensPower: "偏弱",
    focusPosition: "retina_back",
    refractiveType: "hyperopia",
    correctLens: "+2.00D",
  },
  G: {
    id: "G",
    name: "高度远视眼",
    eyeLength: 21.5,
    lensPower: "偏弱",
    focusPosition: "retina_back_far",
    refractiveType: "hyperopia",
    correctLens: "+3.00D",
  },
  S: {
    id: "S",
    name: "散光模拟眼",
    eyeLength: 24,
    lensPower: "子午线屈光力不同",
    focusPosition: "two_directions",
    refractiveType: "astigmatism",
    correctLens: "柱面镜",
  },
});

const trigger = document.querySelector("#eye-model-box-trigger");
const drawer = document.querySelector("#eye-model-box-drawer");
const closeButton = document.querySelector("#eye-model-box-close");
const content = document.querySelector("#eye-model-box-content");
const triggerState = trigger?.querySelector(".eye-model-box-trigger-state");
const dropzone = document.querySelector("#eye-model-dropzone");
const toast = document.querySelector("#eye-model-install-toast");
const eyeInput = document.querySelector("#eye-id");

if (trigger && drawer && closeButton && content && dropzone && toast && eyeInput) {
  trigger.dataset.eyeModelReady = "true";

  let selectedId = eyeModels[eyeInput.value] ? eyeInput.value : "A";
  let installedId = selectedId;
  let draggedId = null;
  let toastTimer = 0;

  const modelCard = (model) => `
    <article
      class="eye-model-card${model.id === selectedId ? " is-selected" : ""}${model.id === installedId ? " is-installed" : ""}"
      data-eye-model-id="${model.id}"
      draggable="true"
      tabindex="0"
      aria-label="模拟眼 ${model.id}，可拖动到光具座安装"
    >
      <span class="eye-model-visual" aria-hidden="true"></span>
      <strong>模拟眼 ${model.id}</strong>
      <div class="eye-model-card-actions">
        <button type="button" data-eye-model-action="view" data-eye-model-id="${model.id}">查看</button>
        <button type="button" data-eye-model-action="take" data-eye-model-id="${model.id}">取出</button>
      </div>
    </article>
  `;

  const studentInspector = (model) => `
    <section class="eye-model-inspector" aria-label="模拟眼 ${model.id} 检测任务">
      <p class="eye-model-inspector-kicker">当前模型</p>
      <h3>模拟眼 ${model.id}</h3>
      <p class="eye-model-student-note">未知屈光参数已隐藏。选择“取出”安装到光具座后，再按记录本顺序完成调焦、判断与矫正。</p>
      <ol class="eye-model-inspector-flow">
        <li><span>01</span><strong>查看并选择模型</strong></li>
        <li><span>02</span><strong>取出并安装到光具座</strong></li>
        <li><span>03</span><strong>关闭模型盒，继续像屏调节</strong></li>
      </ol>
    </section>
  `;

  const render = () => {
    const selectedModel = eyeModels[selectedId];
    content.innerHTML = `
      <div class="eye-model-case" aria-label="A 至 G 及 S 模拟眼器材格">
        <div class="eye-model-case-grid">
          ${Object.values(eyeModels).map(modelCard).join("")}
        </div>
      </div>
      ${studentInspector(selectedModel)}
    `;
  };

  const openDrawer = () => {
    drawer.hidden = false;
    trigger.setAttribute("aria-expanded", "true");
    if (triggerState) triggerState.textContent = "−";
    render();
    closeButton.focus({ preventScroll: true });
  };

  const closeDrawer = () => {
    drawer.hidden = true;
    trigger.setAttribute("aria-expanded", "false");
    if (triggerState) triggerState.textContent = "＋";
    trigger.focus({ preventScroll: true });
  };

  const showToast = (message) => {
    window.clearTimeout(toastTimer);
    toast.textContent = message;
    toast.hidden = false;
    toastTimer = window.setTimeout(() => {
      toast.hidden = true;
    }, 2600);
  };

  const applyInstalledModel = (id) => {
    if (!eyeModels[id]) return;
    selectedId = id;
    installedId = id;
    eyeInput.value = id;
    eyeInput.dispatchEvent(new Event("input", { bubbles: true }));
    render();
    showToast(`模拟眼${id}已安装`);
    drawer.dispatchEvent(
      new CustomEvent("eye-model-installed", {
        bubbles: true,
        detail: { id },
      }),
    );
  };

  const installWithAnimation = (id, sourceElement) => {
    if (!eyeModels[id]) return;
    const sourceRect = sourceElement?.getBoundingClientRect();
    const targetRect = dropzone.getBoundingClientRect();
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (!sourceRect || reducedMotion || typeof Element.prototype.animate !== "function") {
      applyInstalledModel(id);
      return;
    }

    const flight = document.createElement("div");
    flight.className = "eye-model-flight";
    flight.textContent = `模拟眼 ${id}`;
    Object.assign(flight.style, {
      left: `${sourceRect.left}px`,
      top: `${sourceRect.top}px`,
      width: `${sourceRect.width}px`,
      height: `${sourceRect.height}px`,
    });
    document.body.append(flight);

    const targetX = targetRect.left + targetRect.width / 2 - sourceRect.left - sourceRect.width / 2;
    const targetY = targetRect.top + targetRect.height / 2 - sourceRect.top - sourceRect.height / 2;
    const animation = flight.animate(
      [
        { transform: "translate(0, 0) scale(1)", opacity: 1 },
        { transform: `translate(${targetX * 0.48}px, ${targetY * 0.34 - 34}px) scale(0.92)`, opacity: 0.96, offset: 0.48 },
        { transform: `translate(${targetX}px, ${targetY}px) scale(0.48)`, opacity: 0.22 },
      ],
      {
        duration: 620,
        easing: "cubic-bezier(0.22, 0.72, 0.24, 1)",
      },
    );

    animation.finished
      .catch(() => {})
      .finally(() => {
        flight.remove();
        applyInstalledModel(id);
      });
  };

  trigger.addEventListener("click", () => {
    if (drawer.hidden) openDrawer();
    else closeDrawer();
  });

  closeButton.addEventListener("click", closeDrawer);

  content.addEventListener("click", (event) => {
    const button = event.target.closest("[data-eye-model-action]");
    const card = event.target.closest(".eye-model-card");
    const id = button?.dataset.eyeModelId || card?.dataset.eyeModelId;
    if (!eyeModels[id]) return;

    if (!button || button.dataset.eyeModelAction === "view") {
      selectedId = id;
      render();
      return;
    }

    installWithAnimation(id, button.closest(".eye-model-card"));
  });

  content.addEventListener("keydown", (event) => {
    if (!["Enter", " "].includes(event.key) || event.target.closest("button, input, select")) return;
    const card = event.target.closest(".eye-model-card");
    if (!card) return;
    event.preventDefault();
    selectedId = card.dataset.eyeModelId;
    render();
  });

  content.addEventListener("dragstart", (event) => {
    const card = event.target.closest(".eye-model-card");
    if (!card) return;
    draggedId = card.dataset.eyeModelId;
    card.classList.add("is-dragging");
    dropzone.classList.add("is-active");
    dropzone.setAttribute("aria-hidden", "false");
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", draggedId);
  });

  content.addEventListener("dragend", (event) => {
    event.target.closest(".eye-model-card")?.classList.remove("is-dragging");
    draggedId = null;
    dropzone.classList.remove("is-active", "is-over");
    dropzone.setAttribute("aria-hidden", "true");
  });

  dropzone.addEventListener("dragover", (event) => {
    event.preventDefault();
    dropzone.classList.add("is-over");
    event.dataTransfer.dropEffect = "move";
  });

  dropzone.addEventListener("dragleave", () => {
    dropzone.classList.remove("is-over");
  });

  dropzone.addEventListener("drop", (event) => {
    event.preventDefault();
    const id = event.dataTransfer.getData("text/plain") || draggedId;
    dropzone.classList.remove("is-active", "is-over");
    dropzone.setAttribute("aria-hidden", "true");
    applyInstalledModel(id);
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !drawer.hidden) closeDrawer();
  });

  eyeInput.addEventListener("input", () => {
    if (!eyeModels[eyeInput.value] || eyeInput.value === installedId) return;
    selectedId = eyeInput.value;
    installedId = eyeInput.value;
    if (!drawer.hidden) render();
  });
}
