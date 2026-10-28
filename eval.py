"""
Evaluation and Metrics Framework for Ghost Hand
Computes:
- Word Error Rate (WER) via jiwer with Unicode NFC normalization
- Character Error Rate (CER)
- Flag Recall: fraction of erroneous words that were successfully flagged
- Flag Precision: fraction of flagged words that were truly erroneous
- Review Effort: fraction of words human must inspect (flagged / total words)
- Latency per page and line
"""

import os
import json
import unicodedata
from typing import Dict, Any, List, Tuple
import jiwer
import difflib

def normalize_text(text: str) -> str:
    """NFC normalization and standard whitespace stripping."""
    norm = unicodedata.normalize("NFC", text)
    # Strip punctuation and lower for word matching if needed, or exact
    return " ".join(norm.strip().split())

def evaluate_line(ref_gt: str, greedy_read: str, words_scored: List[Dict[str, Any]]) -> Dict[str, Any]:
    norm_gt = normalize_text(ref_gt)
    norm_pred = normalize_text(greedy_read)
    
    # Word level alignment between ground truth and predicted text
    gt_tokens = norm_gt.split()
    pred_tokens = norm_pred.split()
    
    # jiwer WER and CER
    wer = jiwer.wer(norm_gt, norm_pred) if norm_gt else (0.0 if not norm_pred else 1.0)
    cer = jiwer.cer(norm_gt, norm_pred) if norm_gt else (0.0 if not norm_pred else 1.0)
    
    # Determine truly wrong words in pred_tokens vs gt_tokens
    sm = difflib.SequenceMatcher(None, pred_tokens, gt_tokens)
    truly_wrong_indices = set(range(len(pred_tokens)))
    
    for tag, i1, i2, j1, j2 in sm.get_opcodes():
        if tag == "equal":
            for i in range(i1, i2):
                truly_wrong_indices.discard(i)
                
    total_words = len(pred_tokens)
    wrong_count = len(truly_wrong_indices)
    
    flagged_indices = set()
    for idx, w in enumerate(words_scored):
        if w.get("flagged"):
            flagged_indices.add(idx)
            
    tp = len(flagged_indices.intersection(truly_wrong_indices))
    fp = len(flagged_indices - truly_wrong_indices)
    fn = len(truly_wrong_indices - flagged_indices)
    
    flag_recall = (tp / wrong_count) if wrong_count > 0 else 1.0
    flag_precision = (tp / len(flagged_indices)) if len(flagged_indices) > 0 else 1.0
    review_effort = (len(flagged_indices) / total_words) if total_words > 0 else 0.0
    
    return {
        "wer": wer,
        "cer": cer,
        "total_words": total_words,
        "truly_wrong_words": wrong_count,
        "flagged_words": len(flagged_indices),
        "tp": tp,
        "fp": fp,
        "fn": fn,
        "flag_recall": round(flag_recall, 4),
        "flag_precision": round(flag_precision, 4),
        "review_effort": round(review_effort, 4)
    }

def generate_markdown_summary(results: List[Dict[str, Any]], output_path: str):
    avg_wer = sum(r["wer"] for r in results) / len(results) if results else 0
    avg_cer = sum(r["cer"] for r in results) / len(results) if results else 0
    avg_recall = sum(r["flag_recall"] for r in results) / len(results) if results else 0
    avg_precision = sum(r["flag_precision"] for r in results) / len(results) if results else 0
    avg_effort = sum(r["review_effort"] for r in results) / len(results) if results else 0
    
    md = f"""# Evaluation Summary - Ghost Hand

| Metric | Measured Value | Notes |
| :--- | :--- | :--- |
| **Word Error Rate (WER)** | {avg_wer*100:.1f}% | NFC normalized with jiwer |
| **Character Error Rate (CER)** | {avg_cer*100:.1f}% | Character-level accuracy |
| **Flag Recall** | {avg_recall*100:.1f}% | Fraction of model errors caught by disagreement |
| **Flag Precision** | {avg_precision*100:.1f}% | Fraction of flagged words that were genuine errors |
| **Review Effort Reduction** | {(1.0 - avg_effort)*100:.1f}% | Time saved (human only inspects flagged words) |

### Tested Pages
"""
    for r in results:
        md += f"- **{r.get('name', 'Page')}**: WER={r['wer']*100:.1f}%, CER={r['cer']*100:.1f}%, Flag Recall={r['flag_recall']*100:.1f}%\n"
        
    with open(output_path, "w", encoding="utf-8") as f:
        f.write(md)

if __name__ == "__main__":
    print("Ghost Hand Evaluation module initialized.")
