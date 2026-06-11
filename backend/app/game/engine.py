import string
import random
import logging
import asyncio
from uuid import UUID
from datetime import datetime
from typing import List, Dict, Any

from app.core.db import get_db
from app.core.redis import get_redis
from app.game.scoring import calculate_round_scores
from app.game.timer import timer_manager

logger = logging.getLogger(__name__)

# Helper to import websocket manager locally to avoid circular imports
def get_sio_manager():
    from app.websocket.manager import socket_manager
    return socket_manager

async def init_game_letters(game_id: str, exclude_u: bool) -> List[str]:
    """Generate and store 15 random letters for the game rounds"""
    redis = await get_redis()
    
    # Exclude X, Y, Z, Q
    excluded = {'X', 'Y', 'Z', 'Q'}
    if exclude_u:
        excluded.add('U')
        
    letters = [char for char in string.ascii_uppercase if char not in excluded]
    # Shuffle and pick 15 letters
    random.shuffle(letters)
    selected_letters = letters[:15]
    
    # Store letters in Redis for quick round retrieval
    letters_key = f"game:{game_id}:letters"
    await redis.delete(letters_key)
    await redis.rpush(letters_key, *selected_letters)
    
    return selected_letters

async def get_round_letter(game_id: str, round_number: int) -> str:
    """Retrieve the letter for the given round number"""
    redis = await get_redis()
    letters_key = f"game:{game_id}:letters"
    letter = await redis.lindex(letters_key, round_number - 1)
    if not letter:
        # Fallback if redis expired
        return "A"
    return letter

async def start_game_session(game_id: str):
    """Transition game from lobby to active and start round 1"""
    db_client = get_db()
    
    # Update game status
    db_client.table("games").update({
        "status": "active",
        "current_round": 1
    }).eq("id", game_id).execute()
    
    # Notify admin dashboard
    sio = get_sio_manager()
    await sio.notify_admin_dashboard()
    
    # Fetch game rules
    game_query = db_client.table("games").select("exclude_u, total_rounds, round_duration").eq("id", game_id).execute()
    exclude_u = game_query.data[0]["exclude_u"]
    total_rounds = game_query.data[0]["total_rounds"]
    
    # Set up random letters in Redis
    letters = await init_game_letters(game_id, exclude_u)
    
    # Start round 1
    await start_round(game_id, 1)

async def start_round(game_id: str, round_number: int):
    """Start typing phase for the round"""
    db_client = get_db()
    sio = get_sio_manager()
    
    # Update game current round
    db_client.table("games").update({
        "current_round": round_number
    }).eq("id", game_id).execute()
    
    # Fetch the round's letter
    letter = await get_round_letter(game_id, round_number)
    
    # Fetch round_duration from game settings
    game_settings = db_client.table("games").select("round_duration").eq("id", game_id).execute()
    round_duration = game_settings.data[0].get("round_duration", 15) if game_settings.data else 15
    
    # Insert round record in DB
    try:
        db_client.table("rounds").insert({
            "game_id": game_id,
            "round_number": round_number,
            "letter": letter
        }).execute()
    except Exception as e:
        logger.warning(f"Round record already exists or error: {e}")
        
    # Reset round answers state in Redis
    redis = await get_redis()
    await redis.set(f"game:{game_id}:phase", "typing")
    await redis.set(f"game:{game_id}:letter", letter)
    
    # 4 seconds animation time before the actual game timer countdown starts
    # 2s for Round Intro animation, 2s for Letter Reveal
    reveal_animation_duration = 4
    total_timer_duration = round_duration + reveal_animation_duration
    
    # Notify players
    await sio.broadcast_to_room(game_id, "round_start", {
        "round_number": round_number,
        "letter": letter,
        "duration_seconds": round_duration,
        "animation_seconds": reveal_animation_duration
    })
    await sio.notify_admin_dashboard()
    
    # Start dynamic Typing Timer
    async def on_tick(remaining: int):
        await sio.broadcast_to_room(game_id, "timer_tick", {
            "time_remaining": remaining,
            "phase": "typing"
        })
        
    async def on_expire():
        await end_typing_phase(game_id, round_number)
        
    timer_manager.start_timer(game_id, total_timer_duration, on_tick, on_expire)

async def end_typing_phase(game_id: str, round_number: int):
    """Transition from typing to challenge phase"""
    db_client = get_db()
    sio = get_sio_manager()
    redis = await get_redis()
    
    await redis.set(f"game:{game_id}:phase", "challenge")
    
    # 1. Fetch all game players
    players_query = db_client.table("game_players").select("user_id").eq("game_id", game_id).execute()
    player_ids = [p["user_id"] for p in players_query.data]
    
    # 2. Backfill empty submissions for players who didn't submit for all 4 categories
    categories = ["name", "place", "animal", "thing"]
    for pid in player_ids:
        # Check existing submissions
        sub_query = db_client.table("submissions").select("category").eq("game_id", game_id).eq("round_number", round_number).eq("user_id", pid).execute()
        existing_categories = {s["category"] for s in sub_query.data}
        
        missing = [cat for cat in categories if cat not in existing_categories]
        if missing:
            inserts = []
            for cat in missing:
                inserts.append({
                    "game_id": game_id,
                    "round_number": round_number,
                    "user_id": pid,
                    "category": cat,
                    "answer_text": "",
                    "is_valid": False,
                    "points": 0
                })
            db_client.table("submissions").insert(inserts).execute()
            
    # 3. Retrieve all round submissions to reveal to the room
    submissions_query = db_client.table("submissions").select("*, profiles(username)").eq("game_id", game_id).eq("round_number", round_number).execute()
    
    # Format submissions list for UI
    revealed_submissions = []
    for sub in submissions_query.data:
        revealed_submissions.append({
            "id": sub["id"],
            "user_id": sub["user_id"],
            "username": sub["profiles"]["username"],
            "category": sub["category"],
            "answer_text": sub["answer_text"] or "",
            "is_valid": sub["is_valid"]
        })
        
    # Broadcast submissions to start challenge window
    await sio.broadcast_to_room(game_id, "round_ended", {
        "submissions": revealed_submissions,
        "challenge_duration": 10
    })
    await sio.notify_admin_dashboard()
    
    # Start 30s Challenge Timer
    async def on_tick(remaining: int):
        await sio.broadcast_to_room(game_id, "timer_tick", {
            "time_remaining": remaining,
            "phase": "challenge"
        })
        
    async def on_expire():
        await end_challenge_phase(game_id, round_number)
        
    timer_manager.start_timer(game_id, 10, on_tick, on_expire)

async def end_challenge_phase(game_id: str, round_number: int):
    """Tally challenges, calculate scores, and progress the game"""
    db_client = get_db()
    sio = get_sio_manager()
    
    # 1. Fetch all pending challenges for the round
    challenges_query = db_client.table("challenges").select("*").eq("game_id", game_id).eq("round_number", round_number).eq("status", "pending").execute()
    
    # 2. Resolve challenges based on votes (Yes votes > No votes invalidates the answer)
    for chal in challenges_query.data:
        chal_id = chal["id"]
        target_uid = chal["target_user_id"]
        cat = chal["category"]
        
        yes = chal["yes_votes"]
        no = chal["no_votes"]
        
        if yes > no:
            # Mark challenged answer as invalid
            db_client.table("submissions").update({"is_valid": False}).eq("game_id", game_id).eq("round_number", round_number).eq("user_id", target_uid).eq("category", cat).execute()
            db_client.table("challenges").update({"status": "approved"}).eq("id", chal_id).execute()
        else:
            db_client.table("challenges").update({"status": "rejected"}).eq("id", chal_id).execute()
            
    # 3. Retrieve round letter
    letter = await get_round_letter(game_id, round_number)
    
    # 4. Fetch all submissions to apply the scoring engine
    submissions_query = db_client.table("submissions").select("*").eq("game_id", game_id).eq("round_number", round_number).execute()
    
    scored_submissions = calculate_round_scores(letter, submissions_query.data)
    
    # 5. Save calculated points back to DB and track total points per player
    player_round_totals: Dict[str, int] = {}
    for sub in scored_submissions:
        db_client.table("submissions").update({
            "points": sub["points"]
        }).eq("id", sub["id"]).execute()
        
        pid = sub["user_id"]
        player_round_totals[pid] = player_round_totals.get(pid, 0) + sub["points"]
        
    # 6. Update overall players scores in game_players table
    for pid, points in player_round_totals.items():
        # Read current score
        gp_query = db_client.table("game_players").select("score").eq("game_id", game_id).eq("user_id", pid).execute()
        if gp_query.data:
            current_score = gp_query.data[0]["score"]
            db_client.table("game_players").update({
                "score": current_score + points
            }).eq("game_id", game_id).eq("user_id", pid).execute()
            
    # 7. Fetch all players list with new scores
    players_query = db_client.table("game_players").select("score, is_ready, profiles(username, id)").eq("game_id", game_id).execute()
    
    players_scores = []
    for item in players_query.data:
        pid = item["profiles"]["id"]
        round_points = player_round_totals.get(pid, 0)
        players_scores.append({
            "user_id": pid,
            "username": item["profiles"]["username"],
            "score": item["score"],
            "round_points": round_points
        })
        
    # Sort by score descending
    players_scores.sort(key=lambda x: x["score"], reverse=True)
    
    # Notify clients of round scores
    await sio.broadcast_to_room(game_id, "round_scores", {
        "round_number": round_number,
        "scores": players_scores
    })
    await sio.notify_admin_dashboard()
    
    # 8. Check game termination condition
    game_query = db_client.table("games").select("total_rounds").eq("id", game_id).execute()
    total_rounds = game_query.data[0]["total_rounds"]
    
    if round_number >= total_rounds:
        await end_game(game_id, players_scores)
    else:
        # Wait 5 seconds before starting next round to let players see the scores
        async def wait_and_start():
            await asyncio.sleep(5)
            await start_round(game_id, round_number + 1)
        asyncio.create_task(wait_and_start())

async def end_game(game_id: str, final_leaderboard: List[Dict[str, Any]]):
    """Calculate winner/runner-up, mark completed in DB, and notify players"""
    db_client = get_db()
    sio = get_sio_manager()
    
    # Mark game completed
    db_client.table("games").update({
        "status": "completed",
        "completed_at": datetime.utcnow().isoformat()
    }).eq("id", game_id).execute()
    
    winner = None
    runner_up = None
    
    if len(final_leaderboard) > 0:
        winner = final_leaderboard[0]
    if len(final_leaderboard) > 1:
        runner_up = final_leaderboard[1]
        
    await sio.broadcast_to_room(game_id, "game_completed", {
        "winner": winner,
        "runner_up": runner_up,
        "leaderboard": final_leaderboard
    })
    await sio.notify_admin_dashboard()
    logger.info(f"Game {game_id} completed. Winner: {winner}")
