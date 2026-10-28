# Ghost Hand 🕯️🌼

> **Hacktoberfest Open-Source AI Challenge: Week 4 — Ghost in the Machine**  
> *Transcribing handwritten ancestral recipes and letters with local open-weight vision AI and uncertainty guarantees.*

Ghost Hand is a local, 100% offline-capable application built to transcribe handwritten family cards, recipes, and letters in **English and Spanish**. Centered around the spirit of the Mexican Día de los Muertos ofrenda (altar), Ghost Hand is designed to honor the past while ensuring private family memories never leave your local device.

---

## 🎯 The Core Problem & The "Uncertainty-by-Disagreement" Engine

Standard closed and open multimodal vision models hallucinate quietly when confronted with messy handwriting, cursive loops, or faded ink. In family archives, silent misreadings corrupt recipes and distort ancestral words.

Ghost Hand implements a **code-enforced guardrail around the model**:
1. **Multi-Pass Inference with Controlled Seeds**: Each segmented line is read once at greedy temperature ($T = 0$), followed by $N$ sampled passes ($T \approx 0.7$) with varying random seeds.
2. **Word-Level Consensus & Sequence Alignment**: Uses sequence matching to align tokens across passes and compute a per-word agreement ratio:
   $$\text{Agreement} = \frac{\text{Votes}}{N}$$
3. **Explicit Uncertainty Highlighting**: Any word falling below the threshold ($< 0.8$) or lines with diverging word counts are flagged and shown side-by-side with the cropped original handwriting.
4. **Three-Layer Persistence**: Keeps raw model outputs, human corrections, and original image crops strictly isolated on disk.

---

## 💻 Cross-Platform & Run Locally Anywhere

Ghost Hand is designed to run locally on **any device**:
- **macOS** (Apple Silicon / Intel)
- **Linux** (Ubuntu, Debian, Fedora, Arch)
- **Windows** (Native or WSL2)
- **Docker** (Containerized single command)

### 1. Prerequisites
- **Ollama**: Download and install from [ollama.com](https://ollama.com).
- Pull the primary vision model:
  ```bash
  ollama pull gemma4:e4b
  ```

### 2. Local Setup (Python)
```bash
# Clone the repository
git clone https://github.com/devanshibhatt23/Ghost-Hand.git
cd Ghost-Hand

# Create virtual environment
python3 -m venv .venv
source .venv/bin/activate  # On Windows: .venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Run server
python3 server.py
```
Open [http://localhost:8000](http://localhost:8000) in your browser.

### 3. Docker Deployment (Single Command)
```bash
docker compose up --build
```

---

## 🧪 Automated Testing & Offline Proof

Ghost Hand enforces strict offline operation. All CSS, JavaScript, and fonts are locally bundled with zero remote CDN dependencies.

To execute the test suite:
```bash
PYTHONPATH=. pytest tests/
```
Tests verify:
- Word agreement scoring and divergence detection ([test_pipeline.py](tests/test_pipeline.py))
- Metric evaluation harness WER/CER/Recall ([test_eval.py](tests/test_eval.py))
- **Strict offline asset verification** ([test_offline.py](tests/test_offline.py)) ensuring zero external network calls.

---

## 🌼 The Ofrenda (Altar) & Perpetual Plain-Text Export

Corrected cards and letters can be placed upon the virtual **Ofrenda**, rendered in the warm colors of cempasúchil (marigolds) and candlelight. Each card exports to standalone Markdown, multi-layer JSON, and original image crops that will survive for decades without requiring active servers or vendor subscriptions.

---

## 📄 License
MIT License.
