from typing import Dict, List, Any
import logging
import urllib.parse
import time
from datetime import datetime, timezone
import httpx
from app.core.config import settings

logger = logging.getLogger(__name__)

# Cache for Mapbox Geocoding lookup results
_mapbox_places_cache: Dict[str, bool] = {}

# Structured API log entries for admin audit trail
# Each entry: { timestamp, query, request_url, status_code, feature_count, place_name_returned, is_valid, latency_ms, error }
mapbox_api_logs: List[Dict[str, Any]] = []

# Caches for Gemini validation lookup results per category
_gemini_places_cache: Dict[str, bool] = {}
_gemini_animals_cache: Dict[str, bool] = {}
_gemini_things_cache: Dict[str, bool] = {}

# Structured Gemini API log entries for admin audit trail
gemini_api_logs: List[Dict[str, Any]] = []

# Cap the log list to prevent unbounded memory growth
_MAX_LOG_ENTRIES = 500


def _append_gemini_log(*, room_code: str, round_number: int, inputs: Dict[str, List[str]],
                       response: Dict[str, Any], latency_ms: float, status_code: int,
                       error: str, cached: bool):
    """Append a structured Gemini log entry, trimming old entries if over cap."""
    entry = {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "room_code": room_code,
        "round_number": round_number,
        "inputs": inputs,
        "response": response,
        "latency_ms": latency_ms,
        "status_code": status_code,
        "error": error,
        "cached": cached,
    }
    gemini_api_logs.append(entry)
    # Trim oldest entries when over cap
    if len(gemini_api_logs) > _MAX_LOG_ENTRIES:
        del gemini_api_logs[:len(gemini_api_logs) - _MAX_LOG_ENTRIES]


def validate_place_with_mapbox(place_name: str) -> bool:
    """
    Validate place name using Mapbox Geocoding API.
    Returns True if a valid place is found, False otherwise.
    If Mapbox API token is not configured, logs a warning and returns True.
    Every call is recorded into mapbox_api_logs for admin auditing.
    """
    token = getattr(settings, "MAPBOX_ACCESS_TOKEN", "")
    if not token:
        logger.warning("MAPBOX_ACCESS_TOKEN is not configured. Skipping place validation.")
        _append_log(query=place_name, request_url="", status_code=0, feature_count=0,
                     place_name_returned="", is_valid=True, latency_ms=0,
                     error="MAPBOX_ACCESS_TOKEN not configured – skipped", cached=False)
        return True

    norm_name = " ".join(place_name.strip().lower().split())
    if not norm_name:
        return False

    if norm_name in _mapbox_places_cache:
        cached_result = _mapbox_places_cache[norm_name]
        _append_log(query=norm_name, request_url="(cached)", status_code=200, feature_count=-1,
                     place_name_returned="", is_valid=cached_result, latency_ms=0,
                     error="", cached=True)
        return cached_result

    encoded_place = urllib.parse.quote(norm_name)
    url = f"https://api.mapbox.com/geocoding/v5/mapbox.places/{encoded_place}.json"
    params = {
        "access_token": token,
        "limit": 3,
        "types": "country,region,postcode,district,place,locality,neighborhood"
    }
    full_url = f"{url}?limit=3&types=country,region,...&access_token=***"

    start_time = time.monotonic()
    try:
        logger.info(f"Querying Mapbox Geocoding API for place: '{norm_name}'")
        response = httpx.get(url, params=params, timeout=5.0)
        latency = round((time.monotonic() - start_time) * 1000, 1)

        if response.status_code == 200:
            data = response.json()
            features = data.get("features", [])

            # Strict spelling match: the player's input must exactly match
            # the name of one of the returned places (case-insensitive).
            # Mapbox "text" field = short place name (e.g. "Monaco")
            # Mapbox "matching_text" field = alternative spelling that matched
            is_valid = False
            matched_name = ""
            for feat in features:
                api_text = (feat.get("text") or "").strip().lower()
                api_matching = (feat.get("matching_text") or "").strip().lower()
                if norm_name == api_text or norm_name == api_matching:
                    is_valid = True
                    matched_name = feat.get("text", "")
                    break

            _mapbox_places_cache[norm_name] = is_valid

            top_place = features[0].get("place_name", "") if features else ""
            log_error = "" if is_valid else f"Spelling mismatch: input='{norm_name}', api returned='{features[0].get('text', '')}'" if features else "No features"
            _append_log(query=norm_name, request_url=full_url, status_code=200,
                         feature_count=len(features),
                         place_name_returned=matched_name or top_place,
                         is_valid=is_valid, latency_ms=latency, error=log_error, cached=False)
            return is_valid
        else:
            latency = round((time.monotonic() - start_time) * 1000, 1)
            logger.error(f"Mapbox API returned status {response.status_code}: {response.text}")
            _append_log(query=norm_name, request_url=full_url, status_code=response.status_code,
                         feature_count=0, place_name_returned="",
                         is_valid=True, latency_ms=latency,
                         error=f"HTTP {response.status_code}", cached=False)
            return True  # Fallback to True on error
    except Exception as e:
        latency = round((time.monotonic() - start_time) * 1000, 1)
        logger.error(f"Error validating place '{place_name}' with Mapbox: {e}")
        _append_log(query=norm_name, request_url=full_url, status_code=0,
                     feature_count=0, place_name_returned="",
                     is_valid=True, latency_ms=latency,
                     error=str(e), cached=False)
        return True  # Fallback to True on error


def _append_log(*, query: str, request_url: str, status_code: int,
                feature_count: int, place_name_returned: str,
                is_valid: bool, latency_ms: float, error: str, cached: bool):
    """Append a structured log entry, trimming old entries if over cap."""
    entry = {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "query": query,
        "request_url": request_url,
        "status_code": status_code,
        "feature_count": feature_count,
        "place_name_returned": place_name_returned,
        "is_valid": is_valid,
        "latency_ms": latency_ms,
        "error": error,
        "cached": cached,
    }
    mapbox_api_logs.append(entry)
    # Trim oldest entries when over cap
    if len(mapbox_api_logs) > _MAX_LOG_ENTRIES:
        del mapbox_api_logs[:len(mapbox_api_logs) - _MAX_LOG_ENTRIES]

# Cached set of valid animal names loaded from animals_dictionary.py
_valid_animals_set = None

def get_valid_animals() -> set:
    """Load and parse the animals dictionary into a high-performance search set"""
    global _valid_animals_set
    if _valid_animals_set is not None:
        return _valid_animals_set

    try:
        from app.game.animals_dictionary import animals as animals_dict
    except ImportError:
        logger.error("Failed to import animals_dictionary.py in scoring engine.")
        animals_dict = {}

    valid_set = set()
    for key, val in animals_dict.items():
        # Normalize underscores and spaces
        k_clean = key.lower().replace("_", " ").strip()
        v_clean = val.lower().strip()
        
        valid_set.add(k_clean)
        valid_set.add(v_clean)
        
        # Handle hyphens (e.g., "bat-eared fox" -> "bat eared fox")
        k_nohyphen = k_clean.replace("-", " ")
        v_nohyphen = v_clean.replace("-", " ")
        valid_set.add(k_nohyphen)
        valid_set.add(v_nohyphen)
        
        # Add last word of multi-word names as generic animals (e.g., "grizzly bear" -> "bear")
        k_words = k_nohyphen.split()
        if len(k_words) > 1:
            valid_set.add(k_words[-1])
            
        v_words = v_nohyphen.split()
        if len(v_words) > 1:
            valid_set.add(v_words[-1])

    _valid_animals_set = valid_set
    return _valid_animals_set

def normalize_text(text: str) -> str:
    """Normalize text for duplicate detection (lowercase, stripped whitespace)"""
    if not text:
        return ""
    return " ".join(text.strip().lower().split())

def validate_categories_with_gemini(words_by_category: Dict[str, List[str]], room_code: str = "", round_number: int = 0) -> Dict[str, Dict[str, bool]]:
    """
    Validate lists of words for place, animal, and thing categories in a single bulk Gemini API call.
    Returns a dict mapping category -> word -> is_valid.
    If GEMINI_API_KEY is not configured, logs a warning and returns True for all words.
    """
    token = getattr(settings, "GEMINI_API_KEY", "")
    model = getattr(settings, "GEMINI_MODEL", "gemini-2.5-flash-lite")
    
    # Initialize results
    results: Dict[str, Dict[str, bool]] = {
        "place": {},
        "animal": {},
        "thing": {}
    }
    
    if not token:
        logger.warning("GEMINI_API_KEY is not configured. Skipping Gemini validation.")
        for cat, words in words_by_category.items():
            for word in words:
                results[cat][normalize_text(word)] = True
        return results

    # Group words and check caches
    uncached: Dict[str, List[str]] = {
        "place": [],
        "animal": [],
        "thing": []
    }
    
    cache_map = {
        "place": _gemini_places_cache,
        "animal": _gemini_animals_cache,
        "thing": _gemini_things_cache
    }
    
    for cat, words in words_by_category.items():
        if cat not in uncached:
            continue
        norm_words = list(set([normalize_text(w) for w in words if normalize_text(w)]))
        for w in norm_words:
            if w in cache_map[cat]:
                results[cat][w] = cache_map[cat][w]
            else:
                uncached[cat].append(w)
                
    # Check if there is anything to query
    has_uncached = any(len(lst) > 0 for lst in uncached.values())
    if not has_uncached:
        _append_gemini_log(
            room_code=room_code,
            round_number=round_number,
            inputs={cat: list(res.keys()) for cat, res in results.items()},
            response=results,
            latency_ms=0.0,
            status_code=200,
            error="",
            cached=True
        )
        return results

    import json
    import time
    
    url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent"
    params = {"key": token}
    
    prompt = (
        "You are an expert referee for the word game 'Think & Type'.\n"
        "Validate if each of the following words is valid for its respective category:\n"
        "- 'place': a country, city, state, town, continent, or major geographical feature.\n"
        "- 'animal': any mammal, bird, reptile, amphibian, fish, insect, or other living creature.\n"
        "- 'thing': a physical object, item, utensil, tool, clothing, device, or physical substance. Do not allow abstract concepts, actions, or adjectives.\n\n"
        "Respond ONLY with a JSON object of this exact structure (do not include markdown wrapping or other text):\n"
        "{\n"
        "  \"place\": {\"word1\": true, \"word2\": false},\n"
        "  \"animal\": {\"word3\": true},\n"
        "  \"thing\": {\"word4\": true}\n"
        "}\n\n"
        f"Input words to validate:\n{json.dumps(uncached)}"
    )
    
    payload = {
        "contents": [{
            "parts": [{"text": prompt}]
        }],
        "generationConfig": {
            "responseMimeType": "application/json"
        }
    }
    
    start_time = time.monotonic()
    status_code = 0
    error_msg = ""
    gemini_response_dict = {}
    latency = 0.0
    
    try:
        response = httpx.post(url, params=params, json=payload, timeout=8.0)
        status_code = response.status_code
        latency = round((time.monotonic() - start_time) * 1000, 1)
        
        if response.status_code == 200:
            data = response.json()
            candidates = data.get("candidates", [])
            if candidates:
                text_content = candidates[0].get("content", {}).get("parts", [{}])[0].get("text", "{}")
                gemini_response_dict = json.loads(text_content.strip())
                
                # Update caches and results from the parsed response
                for cat in ["place", "animal", "thing"]:
                    cat_res = gemini_response_dict.get(cat, {})
                    # Standardize keys to lowercase
                    cat_res_lower = {k.lower().strip(): v for k, v in cat_res.items()}
                    
                    for w in uncached[cat]:
                        is_valid = False
                        if w in cat_res_lower:
                            is_valid = bool(cat_res_lower[w])
                        cache_map[cat][w] = is_valid
                        results[cat][w] = is_valid
            else:
                error_msg = "No candidates in Gemini response"
                # Fallback to valid to prevent blocking gameplay
                for cat in ["place", "animal", "thing"]:
                    for w in uncached[cat]:
                        results[cat][w] = True
        else:
            error_msg = f"HTTP {response.status_code}: {response.text}"
            for cat in ["place", "animal", "thing"]:
                for w in uncached[cat]:
                    results[cat][w] = True
    except Exception as e:
        latency = round((time.monotonic() - start_time) * 1000, 1)
        error_msg = str(e)
        for cat in ["place", "animal", "thing"]:
            for w in uncached[cat]:
                results[cat][w] = True
                
    _append_gemini_log(
        room_code=room_code,
        round_number=round_number,
        inputs=uncached,
        response=gemini_response_dict or results,
        latency_ms=latency,
        status_code=status_code,
        error=error_msg,
        cached=False
    )
    
    return results

def calculate_round_scores(letter: str, submissions: List[Dict[str, Any]], room_code: str = "", round_number: int = 0) -> List[Dict[str, Any]]:
    """
    Calculate scores for a list of submissions in a round.
    """
    letter_upper = letter.upper()
    
    # 1. Gather all candidates for Place, Animal, and Thing to validate with Gemini in one API call
    words_by_category = {
        "place": [],
        "animal": [],
        "thing": []
    }
    
    for sub in submissions:
        cat = sub.get("category")
        if cat in words_by_category:
            text = sub.get("answer_text", "")
            is_valid = sub.get("is_valid", True)
            if not text or not is_valid:
                continue
            normalized = normalize_text(text)
            if not normalized or normalized[0].upper() != letter_upper:
                continue
            if normalized == cat:
                continue
            if cat in ["name", "thing"] and len(normalized) < 2:
                continue
            words_by_category[cat].append(normalized)
            
    # Perform the single unified Gemini API call
    gemini_validations = validate_categories_with_gemini(words_by_category, room_code, round_number)

    # 2. Group submissions by category
    categories = ["name", "place", "animal", "thing"]
    grouped: Dict[str, List[Dict[str, Any]]] = {cat: [] for cat in categories}
    
    for sub in submissions:
        cat = sub.get("category")
        if cat in grouped:
            grouped[cat].append(sub)
            
    # 3. Process each category individually
    for cat, cat_subs in grouped.items():
        # First, reset all points to 0 and pre-filter valid submissions
        valid_subs: List[Dict[str, Any]] = []
        
        for sub in cat_subs:
            sub["points"] = 0
            
            # Submissions must be valid, not empty, and must start with the correct letter
            text = sub.get("answer_text", "")
            is_valid = sub.get("is_valid", True)
            
            if not text or not is_valid:
                continue
                
            normalized = normalize_text(text)
            if not normalized or normalized[0].upper() != letter_upper:
                # Doesn't start with the correct letter or is empty
                continue

            # Min 2 characters for 'name' and 'thing' categories
            if cat in ["name", "thing"] and len(normalized) < 2:
                continue

            # Cannot submit the name of the category itself
            if normalized == cat:
                continue
                
            # Validation for 'animal', 'place', and 'thing' categories via the unified Gemini validations
            if cat in ["place", "animal", "thing"]:
                # Lookup validation result from the single batch API response
                if not gemini_validations[cat].get(normalized, False):
                    continue
                
            valid_subs.append(sub)
            
        # Count occurrences of normalized answers in this category
        answer_counts: Dict[str, int] = {}
        for sub in valid_subs:
            norm = normalize_text(sub["answer_text"])
            answer_counts[norm] = answer_counts.get(norm, 0) + 1
            
        # Assign points based on uniqueness
        for sub in valid_subs:
            norm = normalize_text(sub["answer_text"])
            count = answer_counts[norm]
            if count == 1:
                # Unique valid answer
                sub["points"] = 10
            elif count > 1:
                # Duplicate valid answer
                sub["points"] = 5
                
    return submissions

