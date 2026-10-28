"""
Ghost Hand Core Pipeline - Optimized for Speed & High Accuracy
- Preprocessing: Resize, Grayscale, Contrast Enhancement
- Line splitting: Horizontal projection profile for UI side-by-side inspection
- Page-level greedy & sampled consensus reading:
  Runs full page once at T=0, and N sampled passes at T=0.7 with controlled seeds.
  Maps lines directly to crops to keep response snappy while maintaining rigorous uncertainty detection.
"""

import os
import json
import time
import difflib
from typing import List, Dict, Any
from PIL import Image, ImageEnhance
import cv2
import numpy as np
import ollama

PROMPT = (
    "Transcribe the handwriting in this image exactly as written. "
    "Do not correct spelling. Do not guess unclear words. "
    "Keep Spanish accents and punctuation exact. Output only the plain transcribed text line by line."
)

def preprocess_image(input_path: str, output_path: str, max_dimension: int = 1600) -> str:
    with Image.open(input_path) as img:
        img = img.convert("RGB")
        w, h = img.size
        scale = max_dimension / max(w, h)
        if scale < 1.0:
            new_w, new_h = int(w * scale), int(h * scale)
            img = img.resize((new_w, new_h), Image.Resampling.LANCZOS)
        
        gray = img.convert("L")
        enhancer = ImageEnhance.Contrast(gray)
        enhanced = enhancer.enhance(1.3)
        enhanced.save(output_path, "JPEG", quality=95)
        
    return output_path

def split_lines(image_path: str, output_dir: str, min_line_height: int = 20, padding: int = 8) -> List[Dict[str, Any]]:
    os.makedirs(output_dir, exist_ok=True)
    img = cv2.imread(image_path, cv2.IMREAD_GRAYSCALE)
    if img is None:
        raise ValueError(f"Could not load image at {image_path}")
        
    h, w = img.shape
    _, binary = cv2.threshold(img, 0, 255, cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU)
    kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (25, 3))
    dilated = cv2.dilate(binary, kernel, iterations=1)
    
    proj = np.sum(dilated, axis=1) / 255.0
    threshold_proj = np.mean(proj) * 0.15
    
    in_line = False
    start_y = 0
    lines = []
    
    for y in range(h):
        if proj[y] > threshold_proj and not in_line:
            in_line = True
            start_y = y
        elif proj[y] <= threshold_proj and in_line:
            in_line = False
            if (y - start_y) >= min_line_height:
                lines.append((start_y, y))
                
    if in_line and (h - start_y) >= min_line_height:
        lines.append((start_y, h))
        
    if len(lines) <= 1:
        contours, _ = cv2.findContours(dilated, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        boxes = [cv2.boundingRect(c) for c in contours]
        boxes = [b for b in boxes if b[3] >= min_line_height and b[2] >= w * 0.15]
        boxes.sort(key=lambda b: b[1])
        lines = [(y, y + bh) for (_, y, _, bh) in boxes]

    line_records = []
    for idx, (y1, y2) in enumerate(lines):
        padded_y1 = max(0, y1 - padding)
        padded_y2 = min(h, y2 + padding)
        
        line_crop = img[padded_y1:padded_y2, 0:w]
        crop_filename = f"line_{idx+1:02d}.jpg"
        crop_path = os.path.join(output_dir, crop_filename)
        cv2.imwrite(crop_path, line_crop)
        
        line_records.append({
            "line_index": idx + 1,
            "crop_path": crop_path,
            "crop_filename": crop_filename,
            "bbox": [padded_y1, 0, padded_y2, w]
        })
        
    return line_records

def flag_uncertain(greedy_text: str, samples: List[str], threshold: float = 0.8) -> Dict[str, Any]:
    ref_words = greedy_text.split()
    if not ref_words:
        return {
            "words": [],
            "word_count_divergence": False,
            "line_flagged": False,
            "samples": samples
        }
        
    votes = [0] * len(ref_words)
    divergence_count = 0
    
    for s in samples:
        s_words = s.split()
        if len(s_words) != len(ref_words):
            divergence_count += 1
            
        sm = difflib.SequenceMatcher(None, ref_words, s_words)
        for tag, i1, i2, _, _ in sm.get_opcodes():
            if tag == "equal":
                for i in range(i1, i2):
                    votes[i] += 1
                    
    n = max(1, len(samples))
    words_result = []
    has_flagged_word = False
    
    for i, w in enumerate(ref_words):
        ratio = votes[i] / n
        is_flagged = ratio < threshold
        if is_flagged:
            has_flagged_word = True
        words_result.append({
            "word": w,
            "votes": votes[i],
            "total_samples": n,
            "agreement": round(ratio, 3),
            "flagged": is_flagged
        })
        
    word_count_divergence = divergence_count > (len(samples) // 2)
    line_flagged = has_flagged_word or word_count_divergence
    
    return {
        "words": words_result,
        "word_count_divergence": word_count_divergence,
        "line_flagged": line_flagged,
        "samples": samples
    }

def read_image_ollama(
    image_path: str,
    temperature: float,
    seed: int = 0,
    model: str = "gemma4:e4b",
    client: ollama.Client = None
) -> str:
    if client is None:
        client = ollama.Client()
        
    response = client.chat(
        model=model,
        messages=[{
            "role": "user",
            "content": PROMPT,
            "images": [image_path]
        }],
        options={
            "temperature": temperature,
            "seed": seed
        }
    )
    return response["message"]["content"].strip()
