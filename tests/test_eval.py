import pytest
from eval import evaluate_line, normalize_text

def test_normalize_text():
    assert normalize_text("  Querida   Mariana:  ") == "Querida Mariana:"
    assert normalize_text("an\u00eds") == "anís"

def test_evaluate_line_perfect():
    gt = "Abuela's Hot Chocolate"
    pred = "Abuela's Hot Chocolate"
    words_scored = [
        {"word": "Abuela's", "flagged": False},
        {"word": "Hot", "flagged": False},
        {"word": "Chocolate", "flagged": False}
    ]
    res = evaluate_line(gt, pred, words_scored)
    assert res["wer"] == 0.0
    assert res["cer"] == 0.0
    assert res["truly_wrong_words"] == 0
    assert res["flagged_words"] == 0
    assert res["flag_recall"] == 1.0

def test_evaluate_line_with_error_and_flag():
    gt = "Stir with the wooden molinillo"
    pred = "Stir with the wooden spoon"
    words_scored = [
        {"word": "Stir", "flagged": False},
        {"word": "with", "flagged": False},
        {"word": "the", "flagged": False},
        {"word": "wooden", "flagged": False},
        {"word": "spoon", "flagged": True}
    ]
    res = evaluate_line(gt, pred, words_scored)
    assert res["truly_wrong_words"] == 1
    assert res["flagged_words"] == 1
    assert res["tp"] == 1
    assert res["flag_recall"] == 1.0
    assert res["flag_precision"] == 1.0
