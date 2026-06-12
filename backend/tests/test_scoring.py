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

def test_scoring_mapbox_place_validation():
    from app.game.scoring import _mapbox_places_cache

    # Test case 1: Mapbox key not configured (should bypass and allow)
    _mapbox_places_cache.clear()
    with patch("app.game.scoring.settings") as mock_settings:
        mock_settings.MAPBOX_ACCESS_TOKEN = ""
        letter = "P"
        submissions = [
            {"user_id": "u1", "category": "place", "answer_text": "Paris", "is_valid": True, "points": 0}
        ]
        scored = calculate_round_scores(letter, submissions)
        assert scored[0]["points"] == 10

    # Test case 2: Correct spelling — API returns "Paris", player typed "Paris" → valid
    _mapbox_places_cache.clear()
    with patch("app.game.scoring.settings") as mock_settings, \
         patch("httpx.get") as mock_get:
        mock_settings.MAPBOX_ACCESS_TOKEN = "test_key"
        
        mock_resp = MagicMock()
        mock_resp.status_code = 200
        mock_resp.json.return_value = {"features": [{"id": "place.123", "text": "Paris", "place_name": "Paris, France"}]}
        mock_get.return_value = mock_resp
        
        letter = "P"
        submissions = [
            {"user_id": "u1", "category": "place", "answer_text": "Paris", "is_valid": True, "points": 0}
        ]
        scored = calculate_round_scores(letter, submissions)
        assert scored[0]["points"] == 10
        mock_get.assert_called_once()

    # Test case 3: No features returned (made-up place) → invalid
    _mapbox_places_cache.clear()
    with patch("app.game.scoring.settings") as mock_settings, \
         patch("httpx.get") as mock_get:
        mock_settings.MAPBOX_ACCESS_TOKEN = "test_key"
        
        mock_resp = MagicMock()
        mock_resp.status_code = 200
        mock_resp.json.return_value = {"features": []}
        mock_get.return_value = mock_resp
        
        letter = "P"
        submissions = [
            {"user_id": "u1", "category": "place", "answer_text": "PlutoLand", "is_valid": True, "points": 0}
        ]
        scored = calculate_round_scores(letter, submissions)
        assert scored[0]["points"] == 0

    # Test case 4: Misspelled place — player typed "Monago", API returns "Monaco" → REJECTED
    _mapbox_places_cache.clear()
    with patch("app.game.scoring.settings") as mock_settings, \
         patch("httpx.get") as mock_get:
        mock_settings.MAPBOX_ACCESS_TOKEN = "test_key"
        
        mock_resp = MagicMock()
        mock_resp.status_code = 200
        mock_resp.json.return_value = {"features": [{"id": "place.456", "text": "Monaco", "place_name": "Monaco"}]}
        mock_get.return_value = mock_resp
        
        letter = "M"
        submissions = [
            {"user_id": "u1", "category": "place", "answer_text": "Monago", "is_valid": True, "points": 0}
        ]
        scored = calculate_round_scores(letter, submissions)
        assert scored[0]["points"] == 0  # Spelling mismatch: "monago" ≠ "monaco"

    # Test case 5: Correct spelling, different case — player typed "monaco" → API returns "Monaco" → VALID
    _mapbox_places_cache.clear()
    with patch("app.game.scoring.settings") as mock_settings, \
         patch("httpx.get") as mock_get:
        mock_settings.MAPBOX_ACCESS_TOKEN = "test_key"
        
        mock_resp = MagicMock()
        mock_resp.status_code = 200
        mock_resp.json.return_value = {"features": [{"id": "place.456", "text": "Monaco", "place_name": "Monaco"}]}
        mock_get.return_value = mock_resp
        
        letter = "M"
        submissions = [
            {"user_id": "u1", "category": "place", "answer_text": "monaco", "is_valid": True, "points": 0}
        ]
        scored = calculate_round_scores(letter, submissions)
        assert scored[0]["points"] == 10  # Case-insensitive: "monaco" == "monaco" ✓

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
