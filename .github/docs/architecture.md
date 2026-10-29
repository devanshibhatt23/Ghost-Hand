# Ghost Hand Architecture

> **Casa de la Memoria**: Local, 100% offline-capable handwriting transcription and memory altar powered by open-weight multimodal vision AI with uncertainty-by-disagreement guarantees.

---

## 1. System Overview

Ghost Hand addresses the fundamental flaw of multimodal vision models when reading archival handwriting: **silent hallucination**. When cursive loops, faded ink, or archaic phrasing become ambiguous, standard models invent plausible-sounding words without alerting the user.

Ghost Hand places a strict **code-enforced consensus guardrail** around an open-weight vision model running locally via Ollama (`gemma4:e4b`). It operates under hard offline constraints: **zero cloud APIs, zero remote CDNs, and zero data leaving the host machine**.

---

## 2. Architecture at a Glance

One image goes in, six steps run on your machine, and a verified transcript comes out. Each step saves to its own storage layer, so human edits never overwrite what the AI produced.

```mermaid
flowchart LR
    A["📤 <b>Upload</b><br/>handwriting image"]
    B["✂️ <b>Segment</b><br/>OpenCV line crops"]
    C["🧠 <b>Read 3×</b><br/>Gemma 4 via Ollama<br/>1 greedy + 2 sampled"]
    D["⚖️ <b>Score</b><br/>flag words with<br/>agreement below 80%"]
    E["📜 <b>Review</b><br/>human fixes<br/>flagged words"]
    F["🕯️ <b>Archive</b><br/>altar + Markdown<br/>export"]

    A --> B --> C --> D --> E --> F

    L1[("Layer 1<br/>Original + crops")]
    L2[("Layer 2<br/>Model output + scores")]
    L3[("Layer 3<br/>Human corrections")]

    B -.-> L1
    D -.-> L2
    E -.-> L3

    classDef step fill:#fff4d6,stroke:#e08a00,stroke-width:2px,color:#3b2a00
    classDef store fill:#f3e8ff,stroke:#7a4fb5,stroke-width:1.5px,color:#2a1747
    class A,B,C,D,E,F step
    class L1,L2,L3 store
```

Everything above runs **100% offline** on the host machine: a browser UI (*Casa de la Memoria*) talks to a local FastAPI server, which drives the OpenCV and Ollama pipeline.

---

## 3. Core Architectural Pillars

### 3.1 The Uncertainty-by-Disagreement Engine
Instead of relying on self-reported model probabilities (which vision LLMs calibrate poorly), Ghost Hand measures consensus across stochastic reads:
1. **Reference Pass ($T = 0.0$, Seed 0)**: Deterministic greedy read of the preprocessed handwriting.
2. **Consensus Passes ($N = 2$, $T = 0.7$, Varying Seeds)**: Sampled reads with controlled random seeds.
3. **Word Sequence Alignment**: Uses `difflib.SequenceMatcher` across tokenized word lists to map words between passes.
4. **Disagreement Scoring**:
   $$\text{Agreement}(w) = \frac{\text{Votes}(w)}{N}$$
   Any word with $\text{Agreement} < 0.8$ is flagged as uncertain.
5. **Divergence Guard**: Lines where sampled word counts differ from the greedy baseline are flagged for structural inspection.

### 3.2 Three-Layer Isolated Persistence
Ghost Hand ensures that human edits never overwrite original data, and model outputs remain immutable for auditable evaluation:
```
data/pages/<page_id>/
├── original.jpg              # Layer 1: Immutable original upload
├── preprocessed.jpg          # Resized, contrast-boosted grayscale image
├── crops/                    # OpenCV segmented line crops
│   ├── line_01.jpg
│   └── line_02.jpg
├── model_output.json         # Layer 2: Immutable raw AI transcript & agreement scores
├── human_corrections.json    # Layer 3: Human verification overrides & dedication
└── transcription.md          # Generated standalone plain text export
```

### 3.3 100% Offline, Zero-CDN Client ("Casa de la Memoria")
The web interface is designed with respectful Día de los Muertos motifs (marigold, candlelight, papel picado):
- **Zero outbound network calls**: All CSS, JavaScript, and assets are bundled locally. Verified continuously by automated tests (`tests/test_offline.py`).
- **Hardware-friendly animations**: Floating candles and marigold canvas particles animate strictly on `transform` and `opacity` to avoid thermal throttling on fanless hardware (such as Apple Silicon MacBook Air M2).
- **Tab visibility pause**: Automatically pauses `requestAnimationFrame` loops when the tab is hidden.
- **Accessibility & Motion**: Fully respects `prefers-reduced-motion` with a calm, static fallback.

---

## 4. Component Details

### 4.1 `pipeline.py`
- **`preprocess_image(input_path, output_path, max_dimension=1600)`**: Converts HEIC/PNG/JPEG to RGB, scales down long side to 1600px via Lanczos filter, converts to grayscale, and boosts contrast by 1.3× using `Pillow`.
- **`split_lines(image_path, output_dir)`**: Binarizes with Otsu inverted thresholding, performs horizontal morphological dilation (`cv2.dilate`), and computes a horizontal projection profile (`np.sum(axis=1)`) to detect line boundaries with bounding boxes and padding.
- **`flag_uncertain(greedy_text, samples, threshold=0.8)`**: Aligns tokens via sequence matching, tallies word votes, and returns word-by-word agreement ratios.
- **`read_image_ollama(image_path, temperature, seed, model)`**: Communicates with the local Ollama daemon via the Python SDK.

### 4.2 `server.py`
- **`POST /api/upload`**: Accepts image file, assigns a unique `page_id`, persists `original.<ext>`, initializes progress state, and launches `run_transcription_job` as a background task.
- **`GET /api/status/{page_id}`**: Returns real-time progress percentage and state message for the sweeping light beam UI.
- **`GET /api/page/{page_id}`**: Retrieves line crops, transcribed text, confidence scores, and previous human corrections.
- **`POST /api/correct`**: Saves user corrections into `human_corrections.json` without modifying `model_output.json`.
- **`GET /api/ofrenda`**: Enumerate all saved pages on the memorial altar.
- **`GET /api/export/{page_id}`**: Builds a standalone Markdown export containing title, notes, and line-by-line verified text.

### 4.3 `eval.py`
- Benchmark evaluation harness.
- Computes **Word Error Rate (WER)** and **Character Error Rate (CER)** using `jiwer` with Unicode NFC normalization (`unicodedata.normalize`).
- Computes **Flag Recall** (fraction of actual errors flagged) and **Flag Precision** (fraction of flagged words that were erroneous).
- Computes **Review Effort Reduction** (human inspection time saved).

---

## 5. Life of a Document

The sequence below follows a single page from upload to permanent archive:

```mermaid
sequenceDiagram
    autonumber
    actor User as Family Member
    participant App as Casa de la Memoria<br/>(Browser UI + FastAPI)
    participant Engine as Vision Engine<br/>(OpenCV + Gemma 4 via Ollama)
    participant Disk as Three-Layer Storage

    Note over User,Disk: Upload
    User->>App: Drop handwriting image
    App->>Disk: Save original (Layer 1)

    Note over User,Disk: Read with consensus
    App->>Engine: Segment lines and read 3 times<br/>(T=0.0, then T=0.7 twice)
    Engine->>Disk: Save crops (Layer 1)
    Engine->>Disk: Save text + agreement scores (Layer 2)

    Note over User,Disk: Review and correct
    App-->>User: Line crops + text, words below 80% glow as embers
    User->>App: Fix flagged words, then "Roll & Save to Altar"
    App->>Disk: Save human corrections (Layer 3)

    Note over User,Disk: Archive
    User->>App: Open altar and export
    App-->>User: Standalone Markdown file
```