"""
Ghost Hand Server
FastAPI backend powering Casa de la Memoria with optimized full-page reads & line crops.
"""

import os
import shutil
import uuid
import json
import time
from typing import Dict, Any, List
from fastapi import FastAPI, UploadFile, File, Form, BackgroundTasks, HTTPException
from fastapi.staticfiles import StaticFiles
from fastapi.responses import JSONResponse
from pydantic import BaseModel
import pipeline
import ollama

app = FastAPI(title="Ghost Hand", description="Casa de la Memoria: Local Handwriting Altar")

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.path.join(BASE_DIR, "data")
UPLOADS_DIR = os.path.join(DATA_DIR, "uploads")
PAGES_DIR = os.path.join(DATA_DIR, "pages")
STATIC_DIR = os.path.join(BASE_DIR, "static")

for d in [UPLOADS_DIR, PAGES_DIR, STATIC_DIR]:
    os.makedirs(d, exist_ok=True)

page_jobs: Dict[str, Dict[str, Any]] = {}

class CorrectionItem(BaseModel):
    line_index: int
    corrected_text: str

class SaveCorrectionsRequest(BaseModel):
    page_id: str
    title: str = ""
    notes: str = ""
    corrections: List[CorrectionItem]

def run_transcription_job(
    page_id: str,
    image_path: str,
    output_dir: str,
    model: str = "gemma4:e4b",
    n_samples: int = 2,
    threshold: float = 0.8
):
    try:
        page_jobs[page_id] = {
            "status": "processing",
            "progress": 15,
            "message": "Preparing page on the altar..."
        }
        
        preprocessed_path = os.path.join(output_dir, "preprocessed.jpg")
        pipeline.preprocess_image(image_path, preprocessed_path)
        
        page_jobs[page_id]["progress"] = 35
        page_jobs[page_id]["message"] = "Light sweeps the page: segmenting ink lines..."
        crops_dir = os.path.join(output_dir, "crops")
        lines = pipeline.split_lines(preprocessed_path, crops_dir)
        
        client = ollama.Client()
        
        page_jobs[page_id]["progress"] = 50
        page_jobs[page_id]["message"] = "Reading handwriting (greedy reference pass)..."
        t0 = time.time()
        greedy_full = pipeline.read_image_ollama(
            preprocessed_path, temperature=0.0, seed=0, model=model, client=client
        )
        
        # Sampled passes for consensus
        samples_full = []
        for s_idx in range(1, n_samples + 1):
            page_jobs[page_id]["progress"] = 50 + int(35 * s_idx / (n_samples + 1))
            page_jobs[page_id]["message"] = f"Gathering ancestral consensus (pass {s_idx} of {n_samples})..."
            s_text = pipeline.read_image_ollama(
                preprocessed_path, temperature=0.7, seed=s_idx * 42, model=model, client=client
            )
            samples_full.append(s_text)
            
        page_jobs[page_id]["progress"] = 90
        page_jobs[page_id]["message"] = "Aligning words and measuring agreement..."
        
        greedy_lines = [l.strip() for l in greedy_full.splitlines() if l.strip()]
        samples_by_line = [
            [l.strip() for l in s.splitlines() if l.strip()] for s in samples_full
        ]
        
        line_results = []
        for idx, line_crop in enumerate(lines):
            line_greedy = greedy_lines[idx] if idx < len(greedy_lines) else ""
            line_samples = [
                s_lines[idx] if idx < len(s_lines) else "" for s_lines in samples_by_line
            ]
            
            scored = pipeline.flag_uncertain(line_greedy, line_samples, threshold=threshold)
            
            line_results.append({
                "line_index": line_crop["line_index"],
                "crop_url": f"/data/pages/{page_id}/crops/{line_crop['crop_filename']}",
                "bbox": line_crop["bbox"],
                "greedy_text": line_greedy,
                "samples": line_samples,
                "words": scored["words"],
                "word_count_divergence": scored["word_count_divergence"],
                "line_flagged": scored["line_flagged"]
            })
            
        page_data = {
            "page_id": page_id,
            "image_filename": os.path.basename(image_path),
            "model": model,
            "line_count": len(line_results),
            "total_latency_seconds": round(time.time() - t0, 2),
            "lines": line_results
        }
        
        result_file = os.path.join(output_dir, "model_output.json")
        with open(result_file, "w", encoding="utf-8") as f:
            json.dump(page_data, f, indent=2, ensure_ascii=False)
            
        page_jobs[page_id] = {
            "status": "completed",
            "progress": 100,
            "message": "Transcription illuminated on the altar."
        }
    except Exception as e:
        page_jobs[page_id] = {
            "status": "error",
            "progress": 0,
            "message": str(e)
        }

@app.post("/api/upload")
async def upload_page(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...)
):
    page_id = str(uuid.uuid4())[:8]
    page_dir = os.path.join(PAGES_DIR, page_id)
    os.makedirs(page_dir, exist_ok=True)
    
    ext = os.path.splitext(file.filename)[1] or ".jpg"
    orig_path = os.path.join(page_dir, f"original{ext}")
    with open(orig_path, "wb") as f:
        shutil.copyfileobj(file.file, f)
        
    page_jobs[page_id] = {
        "status": "queued",
        "progress": 5,
        "message": "Resting on altar..."
    }
    
    background_tasks.add_task(
        run_transcription_job,
        page_id=page_id,
        image_path=orig_path,
        output_dir=page_dir
    )
    
    return {"page_id": page_id, "status": "queued"}

@app.get("/api/status/{page_id}")
async def get_status(page_id: str):
    if page_id not in page_jobs:
        result_file = os.path.join(PAGES_DIR, page_id, "model_output.json")
        if os.path.exists(result_file):
            return {"status": "completed", "progress": 100, "message": "Illuminated."}
        raise HTTPException(status_code=404, detail="Page not found.")
    return page_jobs[page_id]

@app.get("/api/page/{page_id}")
async def get_page(page_id: str):
    page_dir = os.path.join(PAGES_DIR, page_id)
    result_file = os.path.join(page_dir, "model_output.json")
    if not os.path.exists(result_file):
        raise HTTPException(status_code=404, detail="Page not ready.")
        
    with open(result_file, "r", encoding="utf-8") as f:
        data = json.load(f)
        
    corr_file = os.path.join(page_dir, "human_corrections.json")
    if os.path.exists(corr_file):
        with open(corr_file, "r", encoding="utf-8") as cf:
            data["corrections"] = json.load(cf)
    else:
        data["corrections"] = None
        
    return data

@app.post("/api/correct")
async def save_corrections(req: SaveCorrectionsRequest):
    page_dir = os.path.join(PAGES_DIR, req.page_id)
    if not os.path.isdir(page_dir):
        raise HTTPException(status_code=404, detail="Page not found.")
        
    corr_path = os.path.join(page_dir, "human_corrections.json")
    corr_data = {
        "page_id": req.page_id,
        "title": req.title,
        "notes": req.notes,
        "corrections": [c.dict() for c in req.corrections]
    }
    with open(corr_path, "w", encoding="utf-8") as f:
        json.dump(corr_data, f, indent=2, ensure_ascii=False)
        
    return {"status": "saved", "page_id": req.page_id}

@app.get("/api/ofrenda")
async def get_ofrenda():
    items = []
    if not os.path.exists(PAGES_DIR):
        return items
        
    for page_id in os.listdir(PAGES_DIR):
        p_dir = os.path.join(PAGES_DIR, page_id)
        if not os.path.isdir(p_dir):
            continue
        corr_file = os.path.join(p_dir, "human_corrections.json")
        model_file = os.path.join(p_dir, "model_output.json")
        
        if os.path.exists(model_file):
            title = "Ancestral Memory"
            notes = ""
            is_corrected = False
            if os.path.exists(corr_file):
                with open(corr_file, "r", encoding="utf-8") as f:
                    cdata = json.load(f)
                    title = cdata.get("title") or title
                    notes = cdata.get("notes") or ""
                    is_corrected = True
                    
            items.append({
                "page_id": page_id,
                "title": title,
                "notes": notes,
                "is_corrected": is_corrected,
                "original_url": f"/data/pages/{page_id}/preprocessed.jpg"
            })
            
    return items

@app.get("/api/export/{page_id}")
async def export_page(page_id: str):
    page_dir = os.path.join(PAGES_DIR, page_id)
    model_file = os.path.join(page_dir, "model_output.json")
    corr_file = os.path.join(page_dir, "human_corrections.json")
    
    if not os.path.exists(model_file):
        raise HTTPException(status_code=404, detail="Page not found.")
        
    with open(model_file, "r", encoding="utf-8") as f:
        model_data = json.load(f)
        
    corr_data = None
    if os.path.exists(corr_file):
        with open(corr_file, "r", encoding="utf-8") as f:
            corr_data = json.load(f)
            
    title = (corr_data.get("title") if corr_data else "") or f"Transcription {page_id}"
    corr_map = {}
    if corr_data and "corrections" in corr_data:
        corr_map = {c["line_index"]: c["corrected_text"] for c in corr_data["corrections"]}
        
    lines_md = []
    for line in model_data.get("lines", []):
        l_idx = line["line_index"]
        text = corr_map.get(l_idx, line.get("greedy_text", ""))
        lines_md.append(text)
        
    md_content = f"# {title}\n\n"
    if corr_data and corr_data.get("notes"):
        md_content += f"> *{corr_data['notes']}*\n\n"
    md_content += "\n".join(lines_md) + "\n"
    
    export_md_path = os.path.join(page_dir, "transcription.md")
    with open(export_md_path, "w", encoding="utf-8") as f:
        f.write(md_content)
        
    return {
        "page_id": page_id,
        "title": title,
        "markdown": md_content,
        "model_output": model_data,
        "human_corrections": corr_data
    }

app.mount("/data", StaticFiles(directory=DATA_DIR), name="data")
app.mount("/", StaticFiles(directory=STATIC_DIR, html=True), name="static")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("server:app", host="0.0.0.0", port=8000, reload=True)
