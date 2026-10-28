// Ghost Hand: Casa de la Memoria (Interactive Night Altar)
let activePageId = null;
let rememberedCount = 0;
let animationActive = true;

document.addEventListener("DOMContentLoaded", () => {
  setupPetals();
  setupFloatingCandles();
  setupNavigation();
  setupUpload();
  setupVisibilityHandler();
  setupParallax();
  loadOfrenda();
});

// Pause animations when tab is hidden to save battery & prevent M2 throttling
function setupVisibilityHandler() {
  document.addEventListener("visibilitychange", () => {
    animationActive = !document.hidden;
  });
}

// Subtle mouse parallax across the altar layers
function setupParallax() {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  document.addEventListener("mousemove", (e) => {
    const x = (e.clientX / window.innerWidth - 0.5) * 15;
    const y = (e.clientY / window.innerHeight - 0.5) * 15;
    const papel = document.querySelector(".papel-picado-header");
    if (papel) papel.style.transform = `translateX(${x * 0.4}px)`;
  });
}

// Falling marigold petals on a lightweight canvas
function setupPetals() {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const canvas = document.getElementById("petals-canvas");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  
  function resize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  }
  window.addEventListener("resize", resize);
  resize();

  const petalCount = 20; // Lightweight for M2 fanless Air
  const petals = [];
  for (let i = 0; i < petalCount; i++) {
    petals.push({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      size: 4 + Math.random() * 6,
      speedY: 0.6 + Math.random() * 1.2,
      speedX: -0.5 + Math.random() * 1.0,
      angle: Math.random() * Math.PI * 2,
      angularSpeed: (Math.random() - 0.5) * 0.03,
      color: Math.random() > 0.4 ? "#f59e0b" : "#fbbf24"
    });
  }

  function loop() {
    if (animationActive) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      petals.forEach(p => {
        p.y += p.speedY;
        p.x += p.speedX;
        p.angle += p.angularSpeed;

        if (p.y > canvas.height) {
          p.y = -10;
          p.x = Math.random() * canvas.width;
        }

        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.angle);
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.ellipse(0, 0, p.size, p.size * 0.5, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      });
    }
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);
}

// Floating candles (capped at 12)
function setupFloatingCandles() {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const container = document.getElementById("candles-container");
  if (!container) return;
  container.innerHTML = "";

  const count = 10;
  for (let i = 0; i < count; i++) {
    const candle = document.createElement("div");
    candle.className = "floating-candle";
    candle.style.left = `${(i * 10) + Math.random() * 6}%`;
    candle.style.animationDelay = `${i * 1.4}s`;
    candle.style.animationDuration = `${12 + Math.random() * 6}s`;

    candle.innerHTML = `
      <svg class="candle-flame-svg" viewBox="0 0 20 30">
        <path d="M10 0 C12 6, 18 12, 18 20 C18 26, 14 30, 10 30 C6 30, 2 26, 2 20 C2 12, 8 6, 10 0 Z" fill="#fbbf24"/>
        <path d="M10 8 C11 12, 14 16, 14 21 C14 25, 12 28, 10 28 C8 28, 6 25, 6 21 C6 16, 9 12, 10 8 Z" fill="#ffffff" opacity="0.8"/>
      </svg>
      <div class="candle-wax"></div>
    `;
    container.appendChild(candle);
  }
}

function setupNavigation() {
  const tabs = document.querySelectorAll("nav button");
  tabs.forEach(tab => {
    tab.addEventListener("click", () => {
      tabs.forEach(t => t.classList.remove("active"));
      tab.classList.add("active");
      
      const target = tab.getAttribute("data-target");
      document.querySelectorAll(".view-section").forEach(s => s.classList.remove("active"));
      document.getElementById(target).classList.add("active");
      
      if (target === "ofrenda-view") {
        loadOfrenda();
      }
    });
  });
}

function setupUpload() {
  const fileInput = document.getElementById("file-input");
  const uploadDeck = document.getElementById("upload-deck");
  
  fileInput.addEventListener("change", (e) => {
    if (e.target.files.length > 0) {
      handleUpload(e.target.files[0]);
    }
  });

  uploadDeck.addEventListener("dragover", (e) => {
    e.preventDefault();
    uploadDeck.style.borderColor = "var(--marigold)";
  });
  
  uploadDeck.addEventListener("dragleave", () => {
    uploadDeck.style.borderColor = "var(--border-muted)";
  });

  uploadDeck.addEventListener("drop", (e) => {
    e.preventDefault();
    if (e.dataTransfer.files.length > 0) {
      handleUpload(e.dataTransfer.files[0]);
    }
  });
}

async function handleUpload(file) {
  const sweepBeam = document.getElementById("altar-sweep-beam");
  const progressBox = document.getElementById("upload-progress");
  const progressBar = document.getElementById("progress-bar-fill");
  const progressText = document.getElementById("progress-text");
  
  sweepBeam.classList.add("active");
  progressBox.style.display = "block";
  progressText.textContent = "Placing handwriting upon the altar...";
  progressBar.style.width = "15%";
  
  const formData = new FormData();
  formData.append("file", file);
  
  try {
    const res = await fetch("/api/upload", { method: "POST", body: formData });
    if (!res.ok) throw new Error("Upload failed");
    const data = await res.json();
    activePageId = data.page_id;
    pollStatus(activePageId);
  } catch (err) {
    sweepBeam.classList.remove("active");
    progressText.textContent = "Error: " + err.message;
  }
}

async function pollStatus(pageId) {
  const progressBar = document.getElementById("progress-bar-fill");
  const progressText = document.getElementById("progress-text");
  const sweepBeam = document.getElementById("altar-sweep-beam");
  
  const interval = setInterval(async () => {
    try {
      const res = await fetch(`/api/status/${pageId}`);
      if (!res.ok) return;
      const status = await res.json();
      
      progressBar.style.width = `${status.progress}%`;
      progressText.textContent = status.message || "Illuminating page...";
      
      if (status.status === "completed") {
        clearInterval(interval);
        sweepBeam.classList.remove("active");
        setTimeout(() => {
          loadPageReview(pageId);
        }, 500);
      } else if (status.status === "error") {
        clearInterval(interval);
        sweepBeam.classList.remove("active");
        progressText.textContent = "Processing failed: " + status.message;
      }
    } catch (e) {
      console.error(e);
    }
  }, 1000);
}

async function loadPageReview(pageId) {
  activePageId = pageId;
  const res = await fetch(`/api/page/${pageId}`);
  if (!res.ok) return;
  const pageData = await res.json();
  
  document.querySelectorAll("nav button").forEach(t => t.classList.remove("active"));
  document.querySelector("[data-target='review-view']").classList.add("active");
  document.querySelectorAll(".view-section").forEach(s => s.classList.remove("active"));
  document.getElementById("review-view").classList.add("active");
  
  renderReviewParchment(pageData);
}

function renderReviewParchment(pageData) {
  const container = document.getElementById("review-parchment-container");
  container.innerHTML = "";
  
  rememberedCount = 0;
  updateMemoryCounter();

  pageData.lines.forEach((line) => {
    const lineCard = document.createElement("div");
    lineCard.className = `parchment-line ${line.line_flagged ? "flagged" : ""}`;
    
    // Line crop preview
    const cropBox = document.createElement("div");
    cropBox.className = "crop-preview-box";
    cropBox.innerHTML = `<img src="${line.crop_url}" alt="Line ${line.line_index}">`;
    lineCard.appendChild(cropBox);
    
    // Words row with ember glowing flagged words
    const wordsRow = document.createElement("div");
    wordsRow.className = "words-row";
    
    line.words.forEach(w => {
      const chip = document.createElement("span");
      if (w.flagged) {
        chip.className = "ember-word";
        chip.title = `Low Consensus: ${(w.agreement * 100).toFixed(0)}% agreement. Click to verify.`;
      } else {
        chip.style.padding = "0.2rem 0.4rem";
        chip.style.color = "var(--ink-faded)";
      }
      chip.textContent = w.word;
      wordsRow.appendChild(chip);
    });
    lineCard.appendChild(wordsRow);

    // High contrast editable line input
    const input = document.createElement("input");
    input.type = "text";
    input.className = "parchment-input";
    input.value = line.greedy_text;
    input.dataset.lineIndex = line.line_index;
    
    // Fixing a word lights a small candle icon next to it and increments "words remembered"
    let userHasEdited = false;
    input.addEventListener("input", () => {
      if (!userHasEdited) {
        userHasEdited = true;
        rememberedCount++;
        updateMemoryCounter();
        
        // Add resolved candle icon
        if (!lineCard.querySelector(".resolved-candle-icon")) {
          const candle = document.createElement("span");
          candle.className = "resolved-candle-icon";
          candle.innerHTML = "🕯️";
          wordsRow.appendChild(candle);
        }
      }
    });

    lineCard.appendChild(input);
    container.appendChild(lineCard);
  });
}

function updateMemoryCounter() {
  const el = document.getElementById("memory-counter-badge");
  if (el) el.textContent = `${rememberedCount} words remembered 🕯️`;
}

async function saveParchment() {
  if (!activePageId) return;
  const title = document.getElementById("parchment-title-input").value || "Ancestral Memory";
  const notes = document.getElementById("parchment-notes-input").value || "";
  
  const inputs = document.querySelectorAll(".parchment-input");
  const corrections = [];
  inputs.forEach(inp => {
    corrections.push({
      line_index: parseInt(inp.dataset.lineIndex),
      corrected_text: inp.value
    });
  });
  
  const res = await fetch("/api/correct", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ page_id: activePageId, title, notes, corrections })
  });
  
  if (res.ok) {
    alert("Honored and placed upon the Altar!");
  }
}

async function loadOfrenda() {
  const grid = document.getElementById("altar-scrolls-grid");
  const res = await fetch("/api/ofrenda");
  if (!res.ok) return;
  const items = await res.json();
  
  grid.innerHTML = "";
  if (items.length === 0) {
    grid.innerHTML = "<p style='color: #94a3b8; grid-column: 1/-1; text-align: center;'>No scrolls rest on the altar yet. Place a handwritten letter or recipe above!</p>";
    return;
  }
  
  items.forEach(item => {
    const wrapper = document.createElement("div");
    wrapper.className = "scroll-wrapper";
    
    wrapper.innerHTML = `
      <div class="rolled-scroll" tabindex="0" role="button" aria-label="Open scroll ${item.title}">
        <span class="scroll-title">📜 ${item.title}</span>
        <div class="scroll-ribbon"></div>
        <span style="font-size: 1.3rem;">🕯️</span>
      </div>
      <div class="parchment-sheet" style="display: none;">
        <h3 style="color: var(--marigold); margin-bottom: 0.5rem;">${item.title}</h3>
        <p style="font-size: 0.9rem; color: var(--ink-faded); margin-bottom: 1rem;">${item.notes || "Words preserved in eternal memory."}</p>
        <img src="${item.original_url}" style="width: 100%; border-radius: 6px; margin-bottom: 1rem; border: 1px solid var(--parchment-border);" alt="${item.title}">
        <div style="display: flex; gap: 0.5rem;">
          <button style="flex:1; padding: 0.5rem; background: var(--marigold); color: #000; font-weight:600; border: none; border-radius: 6px; cursor: pointer;" onclick="loadPageReview('${item.page_id}')">Inspect & Edit</button>
          <button style="flex:1; padding: 0.5rem; background: #262138; color: #fff; border: 1px solid var(--border-muted); border-radius: 6px; cursor: pointer;" onclick="exportDownload('${item.page_id}')">Export Plain Text</button>
        </div>
      </div>
    `;

    // Click or Enter unrolls the scroll (animated unroll)
    const rolled = wrapper.querySelector(".rolled-scroll");
    const unfurled = wrapper.querySelector(".parchment-sheet");
    const ribbon = wrapper.querySelector(".scroll-ribbon");
    
    function toggleUnroll() {
      if (unfurled.style.display === "none") {
        ribbon.style.opacity = "0";
        unfurled.style.display = "block";
      } else {
        ribbon.style.opacity = "1";
        unfurled.style.display = "none";
      }
    }
    
    rolled.addEventListener("click", toggleUnroll);
    rolled.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        toggleUnroll();
      }
    });

    grid.appendChild(wrapper);
  });
}

async function exportDownload(pageId) {
  const res = await fetch(`/api/export/${pageId}`);
  if (!res.ok) return;
  const data = await res.json();
  
  const blob = new Blob([data.markdown], { type: "text/markdown;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `${data.title.replace(/\s+/g, "_")}_transcription.md`;
  a.click();
}
