import pytest
from app.game.scoring import calculate_round_scores, normalize_text

def test_normalize_text():
    assert normalize_text("  Apple  ") == "apple"
    assert normalize_text("New   York") == "new york"
    assert normalize_text("") == ""
    assert normalize_text(None) == ""

def test_scoring_unique_answers():
    letter = "A"
    submissions = [
        {"user_id": "u1", "category": "animal", "answer_text": "Alpaca", "is_valid": True, "points": 0},
        {"user_id": "u2", "category": "animal", "answer_text": "Alligator", "is_valid": True, "points": 0},
        {"user_id": "u3", "category": "animal", "answer_text": "Aardvark", "is_valid": True, "points": 0},
    ]
    
    scored = calculate_round_scores(letter, submissions)
    
    # All are unique, should get 10 points
    assert scored[0]["points"] == 10
    assert scored[1]["points"] == 10
    assert scored[2]["points"] == 10

def test_scoring_duplicate_answers():
    letter = "A"
    submissions = [
        {"user_id": "u1", "category": "thing", "answer_text": "Apple", "is_valid": True, "points": 0},
        {"user_id": "u2", "category": "thing", "answer_text": "apple", "is_valid": True, "points": 0}, # duplicate (case-insensitive)
        {"user_id": "u3", "category": "thing", "answer_text": "Anchor", "is_valid": True, "points": 0}, # unique
    ]
    
    scored = calculate_round_scores(letter, submissions)
    
    assert scored[0]["points"] == 5
    assert scored[1]["points"] == 5
    assert scored[2]["points"] == 10

def test_scoring_wrong_letter_and_invalid():
    letter = "B"
    submissions = [
        {"user_id": "u1", "category": "name", "answer_text": "Bob", "is_valid": True, "points": 0},       # valid
        {"user_id": "u2", "category": "name", "answer_text": "Alice", "is_valid": True, "points": 0},     # wrong letter
        {"user_id": "u3", "category": "name", "answer_text": "Billy", "is_valid": False, "points": 0},    # challenged/invalidated
        {"user_id": "u4", "category": "name", "answer_text": "", "is_valid": True, "points": 0},          # empty
    ]
    
    scored = calculate_round_scores(letter, submissions)
    
    assert scored[0]["points"] == 10  # Bob is valid and unique
    assert scored[1]["points"] == 0   # Alice starts with A, round letter is B
    assert scored[2]["points"] == 0   # Billy is marked invalid
    assert scored[3]["points"] == 0   # Empty answer


from unittest.mock import patch, MagicMock

def test_scoring_gemini_unified_validation():
    from app.game.scoring import _gemini_places_cache, _gemini_animals_cache, _gemini_things_cache

    # Test case 1: Gemini key not configured (should bypass and allow all)
    _gemini_places_cache.clear()
    _gemini_animals_cache.clear()
    _gemini_things_cache.clear()
    with patch("app.game.scoring.settings") as mock_settings:
        mock_settings.GEMINI_API_KEY = ""
        letter = "P"
        submissions = [
            {"user_id": "u1", "category": "place", "answer_text": "Paris", "is_valid": True, "points": 0},
            {"user_id": "u2", "category": "animal", "answer_text": "Panda", "is_valid": True, "points": 0},
            {"user_id": "u3", "category": "thing", "answer_text": "Pencil", "is_valid": True, "points": 0}
        ]
        scored = calculate_round_scores(letter, submissions)
        assert scored[0]["points"] == 10
        assert scored[1]["points"] == 10
        assert scored[2]["points"] == 10

    # Test case 2: Gemini API returns valid/invalid mock response for place, animal, and thing
    _gemini_places_cache.clear()
    _gemini_animals_cache.clear()
    _gemini_things_cache.clear()
    with patch("app.game.scoring.settings") as mock_settings, \
         patch("httpx.post") as mock_post:
        mock_settings.GEMINI_API_KEY = "test_key"
        mock_settings.GEMINI_MODEL = "gemini-2.5-flash-lite"
        
        mock_resp = MagicMock()
        mock_resp.status_code = 200
        mock_resp.json.return_value = {
            "candidates": [{
                "content": {
                    "parts": [{"text": '{"place": {"paris": true, "plutoland": false}, "animal": {"panda": true, "pekingese": false}, "thing": {"pencil": true, "pride": false}}'}]
                }
            }]
        }
        mock_post.return_value = mock_resp
        
        letter = "P"
        submissions = [
            {"user_id": "u1", "category": "place", "answer_text": "paris", "is_valid": True, "points": 0},
            {"user_id": "u2", "category": "place", "answer_text": "plutoland", "is_valid": True, "points": 0},
            {"user_id": "u3", "category": "animal", "answer_text": "panda", "is_valid": True, "points": 0},
            {"user_id": "u4", "category": "animal", "answer_text": "pekingese", "is_valid": True, "points": 0},
            {"user_id": "u5", "category": "thing", "answer_text": "pencil", "is_valid": True, "points": 0},
            {"user_id": "u6", "category": "thing", "answer_text": "pride", "is_valid": True, "points": 0}
        ]
        scored = calculate_round_scores(letter, submissions)
        assert scored[0]["points"] == 10  # paris is valid place
        assert scored[1]["points"] == 0   # plutoland is invalid place
        assert scored[2]["points"] == 10  # panda is valid animal
        assert scored[3]["points"] == 0   # pekingese is invalid animal (or false in mock)
        assert scored[4]["points"] == 10  # pencil is valid thing
        assert scored[5]["points"] == 0   # pride is invalid thing (abstract)
        mock_post.assert_called_once()

def test_scoring_min_two_characters():
    # 'name' and 'thing' categories require at least 2 characters
    letter = "A"
    submissions = [
        {"user_id": "u1", "category": "name", "answer_text": "A", "is_valid": True, "points": 0},      # too short
        {"user_id": "u2", "category": "name", "answer_text": "Ab", "is_valid": True, "points": 0},     # valid
        {"user_id": "u3", "category": "thing", "answer_text": "A", "is_valid": True, "points": 0},     # too short
        {"user_id": "u4", "category": "thing", "answer_text": "Ax", "is_valid": True, "points": 0},    # valid
    ]
    scored = calculate_round_scores(letter, submissions)
    assert scored[0]["points"] == 0
    assert scored[1]["points"] == 10
    assert scored[2]["points"] == 0
    assert scored[3]["points"] == 10

def test_scoring_banned_category_names():
    # Players cannot enter the name of the category itself
    letter = "N"
    submissions = [
        {"user_id": "u1", "category": "name", "answer_text": "name", "is_valid": True, "points": 0},
    ]
    scored = calculate_round_scores(letter, submissions)
    assert scored[0]["points"] == 0

    letter = "T"
    submissions = [
        {"user_id": "u1", "category": "thing", "answer_text": "thing", "is_valid": True, "points": 0},
    ]
    scored = calculate_round_scores(letter, submissions)
    assert scored[0]["points"] == 0
