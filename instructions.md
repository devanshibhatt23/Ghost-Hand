# Ghost Hand — Setup & Operation Instructions

This document provides step-by-step instructions for running, testing, deploying, and evaluating **Ghost Hand** locally on any machine (macOS, Linux, Windows, or Docker).

---

## 1. Prerequisites

### 1.1 Local Open-Weight AI (Ollama)
Ghost Hand relies entirely on open-weight vision models running locally through Ollama.
1. Download and install Ollama from [ollama.com](https://ollama.com).
2. Start the Ollama service:
   ```bash
   ollama serve
   ```
   *(On macOS or Windows with the Ollama desktop app, simply launching the app starts the background service automatically).*
3. Pull the primary vision model:
   ```bash
   ollama pull gemma4:e4b
   ```
4. Verify the model is installed:
   ```bash
   ollama list
   ```
   You should see `gemma4:e4b` (approx. 9.5 GB).

---

## 2. Local Python Environment Setup

### 2.1 Clone and Navigate
```bash
git clone https://github.com/devanshibhatt23/Ghost-Hand.git
cd Ghost-Hand
```

### 2.2 Create Virtual Environment
```bash
python3 -m venv .venv

# Activate on macOS / Linux:
source .venv/bin/activate

# Activate on Windows (cmd / PowerShell):
.venv\Scripts\activate
```

### 2.3 Install Pinned Dependencies
```bash
pip install --upgrade pip
pip install -r requirements.txt
```

---

## 3. Running the Application

### 3.1 Start the Server
With your virtual environment activated and Ollama running:
```bash
python3 server.py
```
Or directly with uvicorn:
```bash
uvicorn server:app --host 0.0.0.0 --port 8000 --reload
```

### 3.2 Access the Interface
Open your web browser and navigate to:
```
http://localhost:8000
```

---

## 4. How to Use "Casa de la Memoria"

1. **Place a Handwriting Upon the Altar**:
   - Drag and drop or select a handwritten recipe card or letter (English or Spanish) in the upload deck.
   - The altar light will sweep across the page while OpenCV segments the text lines and the local Gemma model performs consensus reads.
2. **Review & Remember (Unrolled Parchment)**:
   - When processing completes, the unrolled parchment view appears.
   - Words where the model was uncertain glow with an **ember pulse** (`#a94e3d`).
   - Click any ember word or edit the input line to verify the text against the original ink crop.
   - Correcting a word lights a small candle (`🕯️`) beside it and increments the **Words Remembered** counter.
3. **Save to the Altar Scrolls**:
   - Give the page a title (e.g., *"Abuela Rosa's Letter"*) and dedication notes.
   - Click **"Roll & Save to Altar"**.
4. **Altar Scrolls (Ofrenda View)**:
   - Browse saved memorial scrolls.
   - Click any tombstone scroll to unroll the side-by-side view (original handwriting beside verified transcript).
   - Click **"Export Plain Text"** to download a permanent `.md` file that outlives any app or subscription.

---

## 5. Docker Deployment (Single Command)

To run Ghost Hand in an isolated, cross-platform container:
```bash
docker compose up --build
```
The web application will be accessible at `http://localhost:8000`.  
*(Ensure Ollama is running on your host machine; Docker connects via `host.docker.internal:11434`).*

---

## 6. Running Tests & Offline Verification

Ghost Hand includes automated tests verifying the consensus engine, evaluation metrics, and strict offline operation:
```bash
PYTHONPATH=. pytest tests/
```

What the test suite validates:
- `test_pipeline.py`: Tests `flag_uncertain` under perfect agreement, low-agreement words, and line length divergences.
- `test_eval.py`: Tests Unicode NFC normalization, WER, CER, Flag Recall, and Flag Precision.
- `test_offline.py`: Scans all HTML, CSS, and JS files to assert that **zero external CDN links, Google Fonts, or telemetry URLs exist**.

---

## 7. Running the Evaluation Harness

To compute formal benchmark numbers against ground truth text:
```bash
python3 eval.py
```
This reads test pairs from `data/samples/` and `data/ground_truth/` and outputs an auditable metrics table.
