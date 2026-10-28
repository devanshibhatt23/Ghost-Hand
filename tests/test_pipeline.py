import pytest
from pipeline import flag_uncertain

def test_flag_uncertain_perfect_agreement():
    ref = "Abuela's Hot Chocolate"
    samples = [
        "Abuela's Hot Chocolate",
        "Abuela's Hot Chocolate",
        "Abuela's Hot Chocolate",
        "Abuela's Hot Chocolate",
        "Abuela's Hot Chocolate"
    ]
    result = flag_uncertain(ref, samples, threshold=0.8)
    assert not result["line_flagged"]
    assert not result["word_count_divergence"]
    for w in result["words"]:
        assert w["votes"] == 5
        assert w["agreement"] == 1.0
        assert not w["flagged"]

def test_flag_uncertain_low_agreement_word():
    ref = "Stir with the wooden molinillo"
    # 2 out of 5 samples hallucinate or disagree on 'molinillo'
    samples = [
        "Stir with the wooden molinillo",
        "Stir with the wooden molinillo",
        "Stir with the wooden spoon",
        "Stir with the wooden whisk",
        "Stir with the wooden molinillo"
    ]
    result = flag_uncertain(ref, samples, threshold=0.8)
    # molinillo has 3/5 votes = 0.6 < 0.8 -> flagged
    assert result["line_flagged"]
    molinillo_word = [w for w in result["words"] if w["word"] == "molinillo"][0]
    assert molinillo_word["flagged"] is True
    assert molinillo_word["agreement"] == 0.6
    
    # wooden has 5/5 = 1.0 -> not flagged
    wooden_word = [w for w in result["words"] if w["word"] == "wooden"][0]
    assert wooden_word["flagged"] is False
    assert wooden_word["agreement"] == 1.0

def test_flag_uncertain_word_count_divergence():
    ref = "Serve with pan de muerto."
    # 4 out of 5 samples drop words or hallucinate extra words
    samples = [
        "Serve pan muerto.",
        "Serve with hot pan de muerto.",
        "Serve pan",
        "Serve with pan",
        "Serve with pan de muerto."
    ]
    result = flag_uncertain(ref, samples, threshold=0.8)
    assert result["word_count_divergence"] is True
    assert result["line_flagged"] is True
