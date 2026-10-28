let activePageId = null;
let rememberedCount = 0;
let animationActive = !document.hidden;
let petalsFrameId = 0;
let petalsCanvasLoop = null;
let uploadPreviewUrl = null;
let toastTimeout = null;

const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

document.addEventListener("DOMContentLoaded", () => {
  animationActive = !document.hidden;
  setupVisibilityHandler();
  setupPetals();
  setupFloatingCandles();
  setupNavigation();
  setupUpload();
  setupSaveButton();
  setupParallax();
  loadOfrenda();
});

function setupVisibilityHandler() {
  document.addEventListener("visibilitychange", () => {
    animationActive = !document.hidden;
    document.body.classList.toggle("is-paused", !animationActive);

    if (!animationActive && petalsFrameId) {
      cancelAnimationFrame(petalsFrameId);
      petalsFrameId = 0;
    } else if (animationActive && petalsCanvasLoop && !reducedMotion) {
      petalsFrameId = requestAnimationFrame(petalsCanvasLoop);
    }
  });
}

function setupPetals() {
  const canvas = document.getElementById("petals-canvas");
  if (!canvas) return;

  const context = canvas.getContext("2d", { alpha: true });
  if (!context) return;

  let width = 0;
  let height = 0;
  let pixelRatio = 1;
  const petalCount = reducedMotion ? 12 : Math.min(24, Math.max(14, Math.round(window.innerWidth / 58)));
  const petals = Array.from({ length: petalCount }, () => ({
    x: Math.random() * window.innerWidth,
    y: Math.random() * window.innerHeight,
    size: 3 + Math.random() * 4,
    speedY: 0.28 + Math.random() * 0.55,
    speedX: -0.24 + Math.random() * 0.48,
    angle: Math.random() * Math.PI * 2,
    angularSpeed: (Math.random() - 0.5) * 0.012,
    color: Math.random() > 0.48 ? "#d88b3e" : "#e8b75f",
  }));

  function resize() {
    width = window.innerWidth;
    height = window.innerHeight;
    pixelRatio = Math.min(window.devicePixelRatio || 1, 1.25);
    canvas.width = Math.round(width * pixelRatio);
    canvas.height = Math.round(height * pixelRatio);
    context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);

    if (reducedMotion) drawPetals(false);
  }

  function drawPetals(advance) {
    context.clearRect(0, 0, width, height);

    petals.forEach((petal) => {
      if (advance) {
        petal.x += petal.speedX;
        petal.y += petal.speedY;
        petal.angle += petal.angularSpeed;

        if (petal.y > height + 12) {
          petal.y = -12;
          petal.x = Math.random() * width;
        }
        if (petal.x < -12) petal.x = width + 12;
        if (petal.x > width + 12) petal.x = -12;
      }

      context.save();
      context.translate(petal.x, petal.y);
      context.rotate(petal.angle);
      context.fillStyle = petal.color;
      context.globalAlpha = 0.52;
      context.beginPath();
      context.ellipse(0, 0, petal.size, petal.size * 0.54, 0, 0, Math.PI * 2);
      context.fill();
      context.restore();
    });
  }

  function animatePetals() {
    if (!animationActive) return;
    drawPetals(!reducedMotion);
    if (!reducedMotion) petalsFrameId = requestAnimationFrame(animatePetals);
  }

  window.addEventListener("resize", resize);
  petalsCanvasLoop = animatePetals;
  resize();

  if (reducedMotion) {
    drawPetals(false);
  } else if (animationActive) {
    petalsFrameId = requestAnimationFrame(animatePetals);
  }
}

function setupFloatingCandles() {
  const container = document.getElementById("candles-container");
  if (!container) return;

  container.replaceChildren();
  const candleCount = 10;

  for (let index = 0; index < candleCount; index += 1) {
    const candle = document.createElement("div");
    candle.className = "floating-candle";
    candle.style.left = `${4 + (index * 9.6) + Math.random() * 4}%`;

    if (reducedMotion) {
      candle.classList.add("is-static");
      candle.style.top = `${14 + ((index * 19) % 70)}%`;
    } else {
      candle.style.animationDelay = `${index * -1.65}s`;
      candle.style.animationDuration = `${16 + Math.random() * 7}s`;
    }

    const flame = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    flame.setAttribute("class", "candle-flame-svg");
    flame.setAttribute("viewBox", "0 0 24 30");
    flame.setAttribute("aria-hidden", "true");

    const gradientId = `flame-glow-${index}`;
    flame.innerHTML = `
      <defs>
        <radialGradient id="${gradientId}" cx="50%" cy="65%" r="62%">
          <stop offset="0" stop-color="#fff8da"/>
          <stop offset=".42" stop-color="#f7d384"/>
          <stop offset="1" stop-color="#e69b43" stop-opacity=".05"/>
        </radialGradient>
      </defs>
      <ellipse cx="12" cy="17" rx="11" ry="12" fill="url(#${gradientId})" opacity=".68"/>
      <path d="M12 1c1.8 5 7.2 9.2 7.2 16.2a7.2 7.2 0 1 1-14.4 0C4.8 10.2 10.4 6 12 1Z" fill="url(#${gradientId})"/>
      <path d="M12 10c.8 2.5 2.8 4.2 2.8 7.2a2.8 2.8 0 1 1-5.6 0c0-3 2-4.7 2.8-7.2Z" fill="#fff9e5" opacity=".84"/>
    `;

    const wax = document.createElement("span");
    wax.className = "candle-wax";
    candle.append(flame, wax);
    container.appendChild(candle);
  }
}

function setupParallax() {
  if (reducedMotion || window.matchMedia("(hover: none)").matches) return;

  let queued = false;
  let nextX = 0;
  let nextY = 0;

  document.addEventListener("pointermove", (event) => {
    if (!animationActive || queued) return;
    nextX = (event.clientX / window.innerWidth - 0.5) * 24;
    nextY = (event.clientY / window.innerHeight - 0.5) * 18;
    queued = true;

    requestAnimationFrame(() => {
      document.documentElement.style.setProperty("--parallax-x", `${nextX}px`);
      document.documentElement.style.setProperty("--parallax-y", `${nextY}px`);
      queued = false;
    });
  });
}

function setupNavigation() {
  const tabs = document.querySelectorAll("nav button[data-target]");

  tabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      showView(tab.dataset.target);
    });
  });
}

function showView(targetId) {
  document.querySelectorAll("nav button[data-target]").forEach((tab) => {
    const active = tab.dataset.target === targetId;
    tab.classList.toggle("active", active);
    tab.setAttribute("aria-pressed", String(active));
  });

  document.querySelectorAll(".view-section").forEach((section) => {
    section.classList.toggle("active", section.id === targetId);
  });

  if (targetId === "ofrenda-view") loadOfrenda();
}

function setupUpload() {
  const fileInput = document.getElementById("file-input");
  const uploadDeck = document.getElementById("upload-deck");
  if (!fileInput || !uploadDeck) return;

  fileInput.addEventListener("change", (event) => {
    const [file] = event.target.files || [];
    if (file) void handleUpload(file);
    fileInput.value = "";
  });

  uploadDeck.addEventListener("dragover", (event) => {
    event.preventDefault();
    uploadDeck.classList.add("drag-over");
  });

  uploadDeck.addEventListener("dragleave", (event) => {
    if (!uploadDeck.contains(event.relatedTarget)) uploadDeck.classList.remove("drag-over");
  });

  uploadDeck.addEventListener("drop", (event) => {
    event.preventDefault();
    uploadDeck.classList.remove("drag-over");
    const [file] = event.dataTransfer?.files || [];
    if (file) void handleUpload(file);
  });
}

function showUploadPreview(file) {
  const preview = document.getElementById("upload-preview");
  const image = document.getElementById("upload-preview-image");
  if (!preview || !image) return;

  if (uploadPreviewUrl) URL.revokeObjectURL(uploadPreviewUrl);
  uploadPreviewUrl = URL.createObjectURL(file);
  image.src = uploadPreviewUrl;
  image.alt = `Selected handwritten page: ${file.name}`;
  preview.hidden = false;
}

function setProgress(percent, message) {
  const track = document.getElementById("progress-track");
  const fill = document.getElementById("progress-bar-fill");
  const text = document.getElementById("progress-text");
  const value = Math.max(0, Math.min(100, Number(percent) || 0));

  if (fill) fill.style.setProperty("--progress", String(value / 100));
  if (track) track.setAttribute("aria-valuenow", String(value));
  if (text) text.textContent = message || "";
}

async function handleUpload(file) {
  if (!file.type.startsWith("image/")) {
    showToast("Choose an image file to place on the altar.");
    return;
  }

  const sweepBeam = document.getElementById("altar-sweep-beam");
  const progressBox = document.getElementById("upload-progress");
  const uploadDeck = document.getElementById("upload-deck");

  showUploadPreview(file);
  if (progressBox) progressBox.hidden = false;
  if (sweepBeam) {
    sweepBeam.classList.remove("active");
    void sweepBeam.offsetWidth;
    sweepBeam.classList.add("active");
  }
  if (uploadDeck) uploadDeck.classList.add("is-processing");
  setProgress(8, "Placing the page in warm light…");

  const formData = new FormData();
  formData.append("file", file);

  try {
    const response = await fetch("/api/upload", { method: "POST", body: formData });
    if (!response.ok) throw new Error("The page could not be placed on the altar.");

    const data = await response.json();
    activePageId = data.page_id;
    await pollStatus(activePageId);
  } catch (error) {
    if (sweepBeam) sweepBeam.classList.remove("active");
    if (uploadDeck) uploadDeck.classList.remove("is-processing");
    setProgress(0, error.message || "Something interrupted the reading.");
  }
}

async function pollStatus(pageId) {
  const sweepBeam = document.getElementById("altar-sweep-beam");
  const uploadDeck = document.getElementById("upload-deck");

  try {
    while (true) {
      const response = await fetch(`/api/status/${encodeURIComponent(pageId)}`);
      if (!response.ok) throw new Error("Could not check the page reading.");

      const status = await response.json();
      setProgress(status.progress, status.message || "Reading the handwriting…");

      if (status.status === "completed") {
        if (sweepBeam) sweepBeam.classList.remove("active");
        if (uploadDeck) uploadDeck.classList.remove("is-processing");
        await wait(240);
        await loadPageReview(pageId);
        return;
      }

      if (status.status === "error") {
        throw new Error(status.message || "The page could not be read.");
      }

      await wait(1000);
    }
  } catch (error) {
    if (sweepBeam) sweepBeam.classList.remove("active");
    if (uploadDeck) uploadDeck.classList.remove("is-processing");
    setProgress(0, error.message || "Something interrupted the reading.");
  }
}

async function loadPageReview(pageId) {
  const response = await fetch(`/api/page/${encodeURIComponent(pageId)}`);
  if (!response.ok) {
    showToast("This page is not ready to review yet.");
    return;
  }

  const pageData = await response.json();
  activePageId = pageId;
  renderReviewParchment(pageData);
  showView("review-view");
}

function renderReviewParchment(pageData) {
  const container = document.getElementById("review-parchment-container");
  const titleInput = document.getElementById("parchment-title-input");
  const notesInput = document.getElementById("parchment-notes-input");
  if (!container) return;

  const correctionData = pageData.corrections || null;
  const corrections = new Map(
    (correctionData?.corrections || []).map((item) => [item.line_index, item.corrected_text])
  );

  if (titleInput) titleInput.value = correctionData?.title || "";
  if (notesInput) notesInput.value = correctionData?.notes || "";
  container.replaceChildren();

  const lines = Array.isArray(pageData.lines) ? pageData.lines : [];
  if (lines.length === 0) {
    const empty = document.createElement("p");
    empty.className = "empty-review";
    empty.textContent = "No handwriting lines were found on this page.";
    container.appendChild(empty);
    rememberedCount = 0;
    updateMemoryCounter();
    return;
  }

  lines.forEach((line, index) => {
    const lineCard = document.createElement("article");
    lineCard.className = `parchment-line reveal-line${line.line_flagged ? " flagged" : ""}`;
    lineCard.style.setProperty("--line-delay", `${Math.min(index * 90, 1500)}ms`);

    const cropBox = document.createElement("div");
    cropBox.className = "crop-preview-box";
    const crop = document.createElement("img");
    crop.src = line.crop_url;
    crop.alt = `Handwriting crop for line ${line.line_index}`;
    crop.loading = "lazy";
    cropBox.appendChild(crop);

    const content = document.createElement("div");
    content.className = "line-content";

    const lineHeading = document.createElement("div");
    lineHeading.className = "line-heading";
    const lineLabel = document.createElement("span");
    lineLabel.textContent = `LINE ${String(line.line_index).padStart(2, "0")}`;
    lineHeading.appendChild(lineLabel);

    if (line.word_count_divergence) {
      const divergence = document.createElement("span");
      divergence.className = "line-divergence";
      divergence.textContent = "Line length differed";
      lineHeading.appendChild(divergence);
    }

    const wordsRow = document.createElement("div");
    wordsRow.className = "words-row";
    const words = Array.isArray(line.words) ? line.words : [];
    words.forEach((word, wordIndex) => {
      const chip = document.createElement(word.flagged ? "button" : "span");
      if (word.flagged) {
        chip.type = "button";
        chip.className = "ember-word";
        chip.dataset.wordIndex = String(wordIndex);
        chip.title = `Uncertain word · ${Math.round((word.agreement || 0) * 100)}% agreement · select to locate`;
      } else {
        chip.className = "plain-word";
      }
      chip.textContent = word.word;
      wordsRow.appendChild(chip);
    });

    const correctedText = document.createElement("input");
    correctedText.type = "text";
    correctedText.className = "parchment-input line-correction-input";
    correctedText.value = corrections.get(line.line_index) ?? line.greedy_text ?? "";
    correctedText.dataset.lineIndex = String(line.line_index);
    correctedText.setAttribute("aria-label", `Corrected text for line ${line.line_index}`);

    wordsRow.addEventListener("click", (event) => {
      const chip = event.target.closest(".ember-word");
      if (!chip) return;
      focusWord(correctedText, Number(chip.dataset.wordIndex));
    });

    correctedText.addEventListener("input", () => {
      updateWordFeedback(line, wordsRow, correctedText);
      updatePageMemoryCount(container);
    });

    content.append(lineHeading, wordsRow, correctedText);
    lineCard.append(cropBox, content);
    container.appendChild(lineCard);
    updateWordFeedback(line, wordsRow, correctedText);
  });

  updatePageMemoryCount(container);
  requestAnimationFrame(() => {
    container.querySelectorAll(".reveal-line").forEach((line) => line.classList.add("is-revealed"));
  });
}

function updateWordFeedback(line, wordsRow, input) {
  const words = Array.isArray(line.words) ? line.words : [];
  const currentWords = input.value.trim() ? input.value.trim().split(/\s+/) : [];
  let rememberedOnLine = 0;

  words.forEach((word, index) => {
    if (!word.flagged) return;
    const chip = wordsRow.querySelector(`.ember-word[data-word-index="${index}"]`);
    if (!chip) return;

    const currentWord = currentWords[index] || "";
    const originalWord = String(word.word || "");
    const isResolved = currentWord.length > 0 && currentWord !== originalWord;
    if (isResolved) rememberedOnLine += 1;

    chip.classList.toggle("is-resolved", isResolved);
    chip.setAttribute("aria-pressed", String(isResolved));
    chip.setAttribute(
      "aria-label",
      isResolved
        ? `Remembered word: ${currentWord}. Select to edit it again.`
        : `Uncertain word: ${originalWord}. Select to locate it in the line.`
    );
    chip.replaceChildren(document.createTextNode(currentWord || originalWord));

    if (isResolved) chip.appendChild(createCandleMark());
  });

  input.dataset.rememberedCount = String(rememberedOnLine);
}

function focusWord(input, wordIndex) {
  const matches = Array.from(input.value.matchAll(/\S+/g));
  const match = matches[wordIndex];
  input.focus();

  if (match && typeof match.index === "number") {
    input.setSelectionRange(match.index, match.index + match[0].length);
  }
}

function createCandleMark() {
  const wrapper = document.createElement("span");
  wrapper.className = "resolved-candle-icon";
  wrapper.setAttribute("aria-hidden", "true");

  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", "0 0 12 20");
  svg.innerHTML = `
    <path d="M6 1c.9 2.1 3.1 3.7 3.1 6.5A3.1 3.1 0 1 1 2.9 7.5C2.9 4.7 5.1 3.1 6 1Z" fill="#c78735"/>
    <rect x="3.2" y="7" width="5.6" height="11.5" rx="1.3" fill="#f4d28a" stroke="#9d7136" stroke-width=".7"/>
  `;
  wrapper.appendChild(svg);
  return wrapper;
}

function updatePageMemoryCount(container) {
  rememberedCount = Array.from(container.querySelectorAll(".line-correction-input"))
    .reduce((total, input) => total + Number(input.dataset.rememberedCount || 0), 0);
  updateMemoryCounter();
}

function updateMemoryCounter() {
  const label = document.querySelector("#memory-counter-badge span");
  if (label) label.textContent = `${rememberedCount} words remembered`;
}

function setupSaveButton() {
  document.getElementById("save-parchment-button")?.addEventListener("click", saveParchment);
}

async function saveParchment() {
  if (!activePageId) {
    showToast("Place a handwritten page before saving a memory.");
    return;
  }

  const title = document.getElementById("parchment-title-input").value.trim() || "Ancestral Memory";
  const notes = document.getElementById("parchment-notes-input").value.trim();
  const corrections = Array.from(document.querySelectorAll(".line-correction-input")).map((input) => ({
    line_index: Number.parseInt(input.dataset.lineIndex, 10),
    corrected_text: input.value,
  }));

  try {
    const response = await fetch("/api/correct", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ page_id: activePageId, title, notes, corrections }),
    });
    if (!response.ok) throw new Error("The memory could not be saved.");

    showToast("This memory has been placed on the altar.");
    void loadOfrenda();
  } catch (error) {
    showToast(error.message || "The memory could not be saved.");
  }
}

async function loadOfrenda() {
  const grid = document.getElementById("altar-scrolls-grid");
  if (!grid) return;

  try {
    const response = await fetch("/api/ofrenda");
    if (!response.ok) throw new Error("Saved memories could not be opened.");
    const items = await response.json();
    grid.replaceChildren();

    if (!items.length) {
      grid.appendChild(createEmptyState());
      return;
    }

    items.forEach((item) => grid.appendChild(createScrollCard(item)));
  } catch (error) {
    grid.replaceChildren(createEmptyState(error.message || "Saved memories could not be opened."));
  }
}

function createEmptyState(message) {
  const empty = document.createElement("div");
  empty.className = "empty-state";
  const heading = document.createElement("h2");
  heading.textContent = message ? "The altar is resting" : "A space is waiting";
  const copy = document.createElement("p");
  copy.textContent = message || "Place a handwritten recipe or letter, then save it here with care.";
  empty.append(heading, copy);
  return empty;
}

function createScrollCard(item) {
  const wrapper = document.createElement("article");
  wrapper.className = "scroll-wrapper";

  const rolled = document.createElement("button");
  rolled.className = "rolled-scroll";
  rolled.type = "button";
  rolled.setAttribute("aria-expanded", "false");
  rolled.setAttribute("aria-label", `Unroll ${item.title || "saved memory"}`);

  const title = document.createElement("span");
  title.className = "scroll-title";
  title.textContent = item.title || "Ancestral Memory";

  const ribbon = document.createElement("span");
  ribbon.className = "scroll-ribbon";
  ribbon.setAttribute("aria-hidden", "true");

  const openMark = document.createElement("span");
  openMark.className = "scroll-opening-mark";
  openMark.setAttribute("aria-hidden", "true");
  openMark.textContent = "↗";

  rolled.append(title, ribbon, openMark);

  const sheet = document.createElement("div");
  sheet.className = "scroll-sheet parchment-sheet";
  sheet.setAttribute("aria-hidden", "true");
  sheet.inert = true;

  let isOpen = false;
  let contentLoaded = false;
  let closeTimer = null;

  rolled.addEventListener("click", async () => {
    isOpen = !isOpen;
    rolled.setAttribute("aria-expanded", String(isOpen));

    if (closeTimer) {
      clearTimeout(closeTimer);
      closeTimer = null;
    }

    if (isOpen) {
      sheet.style.display = "block";
      sheet.setAttribute("aria-hidden", "false");
      sheet.inert = false;
      requestAnimationFrame(() => wrapper.classList.add("is-open"));

      if (!contentLoaded) {
        contentLoaded = true;
        await populateScroll(item, sheet);
      }
    } else {
      wrapper.classList.remove("is-open");
      sheet.setAttribute("aria-hidden", "true");
      sheet.inert = true;
      closeTimer = window.setTimeout(() => {
        if (!isOpen) sheet.style.display = "none";
      }, 440);
    }
  });

  wrapper.append(rolled, sheet);
  return wrapper;
}

async function populateScroll(item, sheet) {
  const loading = document.createElement("p");
  loading.className = "scroll-loading";
  loading.textContent = "Unrolling the page…";
  sheet.appendChild(loading);

  try {
    const response = await fetch(`/api/page/${encodeURIComponent(item.page_id)}`);
    if (!response.ok) throw new Error("The original page could not be opened.");
    const page = await response.json();
    sheet.replaceChildren(buildScrollContent(item, page));
  } catch (error) {
    const message = document.createElement("p");
    message.className = "empty-review";
    message.textContent = error.message || "The original page could not be opened.";
    sheet.replaceChildren(message);
  }
}

function buildScrollContent(item, page) {
  const fragment = document.createDocumentFragment();
  const header = document.createElement("div");
  header.className = "scroll-sheet-header";

  const headingGroup = document.createElement("div");
  const heading = document.createElement("h2");
  heading.textContent = item.title || "Ancestral Memory";
  const notes = document.createElement("p");
  notes.textContent = item.notes || "A page kept close.";
  headingGroup.append(heading, notes);

  const state = document.createElement("span");
  state.className = "memory-state";
  state.textContent = item.is_corrected ? "Remembered" : "Original";
  header.append(headingGroup, state);

  const grid = document.createElement("div");
  grid.className = "scroll-memory-grid";

  const figure = document.createElement("figure");
  figure.className = "memory-photo";
  const photo = document.createElement("img");
  const pageId = page.page_id || item.page_id;
  const imageName = page.image_filename;
  photo.src = imageName
    ? `/data/pages/${encodeURIComponent(pageId)}/${encodeURIComponent(imageName)}`
    : item.original_url;
  photo.alt = `Original handwritten page: ${item.title || "saved memory"}`;
  photo.loading = "lazy";
  const caption = document.createElement("figcaption");
  caption.textContent = "The original handwriting";
  figure.append(photo, caption);

  const transcript = document.createElement("div");
  transcript.className = "memory-transcript";
  const transcriptHeading = document.createElement("h3");
  transcriptHeading.textContent = "Words remembered";
  transcript.appendChild(transcriptHeading);

  const correctionMap = new Map(
    (page.corrections?.corrections || []).map((correction) => [
      correction.line_index,
      correction.corrected_text,
    ])
  );
  const lines = Array.isArray(page.lines) ? page.lines : [];

  if (!lines.length) {
    const empty = document.createElement("p");
    empty.textContent = "No transcript is available for this page.";
    transcript.appendChild(empty);
  } else {
    lines.forEach((line) => {
      const row = document.createElement("p");
      row.className = "memory-line";
      const number = document.createElement("span");
      number.className = "memory-line-number";
      number.textContent = String(line.line_index).padStart(2, "0");
      const text = document.createElement("span");
      text.textContent = correctionMap.get(line.line_index) ?? line.greedy_text ?? "";
      row.append(number, text);
      transcript.appendChild(row);
    });
  }

  grid.append(figure, transcript);

  const actions = document.createElement("div");
  actions.className = "scroll-actions";

  const editButton = document.createElement("button");
  editButton.className = "scroll-action";
  editButton.type = "button";
  editButton.textContent = "Read and correct";
  editButton.addEventListener("click", (event) => {
    event.stopPropagation();
    void loadPageReview(item.page_id);
  });

  const exportButton = document.createElement("button");
  exportButton.className = "scroll-action secondary";
  exportButton.type = "button";
  exportButton.textContent = "Export plain text";
  exportButton.addEventListener("click", (event) => {
    event.stopPropagation();
    void exportDownload(item.page_id);
  });

  actions.append(editButton, exportButton);
  fragment.append(header, grid, actions);
  return fragment;
}

async function exportDownload(pageId) {
  try {
    const response = await fetch(`/api/export/${encodeURIComponent(pageId)}`);
    if (!response.ok) throw new Error("This memory could not be exported.");
    const data = await response.json();
    const blob = new Blob([data.markdown], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${(data.title || "memory").replace(/\s+/g, "_")}_transcription.md`;
    anchor.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  } catch (error) {
    showToast(error.message || "This memory could not be exported.");
  }
}

function showToast(message) {
  const toast = document.getElementById("toast-message");
  if (!toast) return;
  toast.textContent = message;
  toast.classList.add("is-visible");
  window.clearTimeout(toastTimeout);
  toastTimeout = window.setTimeout(() => toast.classList.remove("is-visible"), 3200);
}

function wait(milliseconds) {
  return new Promise((resolve) => window.setTimeout(resolve, milliseconds));
}
