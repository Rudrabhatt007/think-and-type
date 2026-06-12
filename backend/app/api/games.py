import random
import string
import logging
import asyncio
from fastapi import APIRouter, Depends, HTTPException, status
from uuid import UUID
from app.core.db import get_db
from app.api.auth import get_current_user
from app.schemas.auth import UserResponse
from app.schemas.game import GameCreateRequest, GameResponse, GameStateResponse, PlayerResponse, AdminUpdatePointsRequest

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/games", tags=["games"])

def generate_room_code() -> str:
    """Generate a random 6-character room code (uppercase alphanumeric)"""
    return "".join(random.choices(string.ascii_uppercase + string.digits, k=6))

async def get_unique_room_code(db_client) -> str:
    """Generate a unique room code that does not already exist in active/lobby games"""
    for _ in range(10): # try up to 10 times
        code = generate_room_code()
        # check db
        response = db_client.table("games").select("id").eq("room_code", code).neq("status", "completed").execute()
        if not response.data:
            return code
    raise HTTPException(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        detail="Could not generate unique room code. Please try again."
    )

@router.post("/create", response_model=GameResponse)
async def create_game(
    request: GameCreateRequest,
    current_user: UserResponse = Depends(get_current_user)
):
    """Host creates a new game room"""
    db_client = get_db()
    
    room_code = await get_unique_room_code(db_client)
    
    # Insert new game
    new_game = {
        "room_code": room_code,
        "host_id": str(current_user.id),
        "status": "lobby",
        "current_round": 0,
        "total_rounds": request.total_rounds,
        "exclude_u": request.exclude_u,
        "round_duration": request.round_duration
    }
    
    game_response = db_client.table("games").insert(new_game).execute()
    if not game_response.data:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create game room."
        )
        
    game_data = game_response.data[0]
    
    # Prevent host from joining as a player
    # (Removed logic that inserted host into game_players)
    
    # Notify admin dashboard of new room
    try:
        from app.websocket.manager import socket_manager
        await socket_manager.notify_admin_dashboard()
    except Exception as ex:
        logger.warning(f"Failed to notify admin dashboard on room creation: {ex}")
        
    return game_data

@router.post("/join/{room_code}", response_model=GameStateResponse)
async def join_game(
    room_code: str,
    current_user: UserResponse = Depends(get_current_user)
):
    """Player joins an existing game room using its room code"""
    db_client = get_db()
    room_code_upper = room_code.upper()
    
    # 1. Fetch game details
    game_query = db_client.table("games").select("*").eq("room_code", room_code_upper).execute()
    if not game_query.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Game room not found."
        )
    
    game_data = game_query.data[0]
    
    if game_data["status"] != "lobby":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot join a game that has already started or completed."
        )
        
    game_id = game_data["id"]
    
    # 2. Check if player is already in game
    is_host = str(current_user.id) == game_data.get("host_id")
    if not is_host:
        player_query = db_client.table("game_players").select("*").eq("game_id", game_id).eq("user_id", str(current_user.id)).execute()
        
        if not player_query.data:
            # 2a. Check if username is already taken in this specific game room
            current_players = db_client.table("game_players").select("profiles(username)").eq("game_id", game_id).execute()
            taken_names = []
            for cp in current_players.data:
                if cp.get("profiles") and cp["profiles"].get("username"):
                    taken_names.append(cp["profiles"]["username"].strip().lower())
            
            # Also check if the host has this username
            if game_data.get("host_id"):
                host_query = db_client.table("profiles").select("username").eq("id", game_data["host_id"]).execute()
                if host_query.data:
                    taken_names.append(host_query.data[0]["username"].strip().lower())
                    
            if current_user.username.strip().lower() in taken_names:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"The username '{current_user.username}' is already taken in this room. Please choose a different name."
                )

            # Join player to game
            player_data = {
                "game_id": game_id,
                "user_id": str(current_user.id),
                "score": 0,
                "is_ready": False
            }
            db_client.table("game_players").insert(player_data).execute()
        
    # 3. Fetch all players in this game to return current state
    players_query = db_client.table("game_players").select("score, is_ready, profiles(username, id)").eq("game_id", game_id).execute()
    
    players_list = []
    for item in players_query.data:
        username = item["profiles"]["username"]
        uid = item["profiles"]["id"]
        players_list.append(PlayerResponse(
            user_id=UUID(uid),
            username=username,
            score=item["score"],
            is_ready=item["is_ready"]
        ))
        
    return GameStateResponse(
        game=GameResponse.model_validate(game_data),
        players=players_list
    )

@router.get("/state/{room_code}", response_model=GameStateResponse)
async def get_game_state(
    room_code: str,
    current_user: UserResponse = Depends(get_current_user)
):
    """Fetches the state of a game room"""
    db_client = get_db()
    room_code_upper = room_code.upper()
    
    # Fetch game details
    game_query = db_client.table("games").select("*").eq("room_code", room_code_upper).execute()
    if not game_query.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Game room not found."
        )
        
    game_data = game_query.data[0]
    game_id = game_data["id"]
    
    # Fetch players
    players_query = db_client.table("game_players").select("score, is_ready, profiles(username, id)").eq("game_id", game_id).execute()
    
    players_list = []
    for item in players_query.data:
        username = item["profiles"]["username"]
        uid = item["profiles"]["id"]
        players_list.append(PlayerResponse(
            user_id=UUID(uid),
            username=username,
            score=item["score"],
            is_ready=item["is_ready"]
        ))
        
    return GameStateResponse(
        game=GameResponse.model_validate(game_data),
        players=players_list
    )

@router.get("/admin/all")
async def get_all_games_admin(page: int = 1, size: int = 10):
    """Admin endpoint to fetch all game rooms with pagination, their players, and submissions"""
    db_client = get_db()
    max_retries = 3
    last_error = None
    offset = (page - 1) * size

    for attempt in range(1, max_retries + 1):
        try:
            response = db_client.table("games")\
                .select("*, game_players(*, profiles(username)), submissions(*, profiles(username))", count="exact")\
                .order("created_at", desc=True)\
                .range(offset, offset + size - 1)\
                .execute()
            
            return {
                "items": response.data,
                "total": response.count if response.count is not None else len(response.data),
                "page": page,
                "size": size
            }
        except Exception as e:
            last_error = e
            logger.warning(
                f"Supabase request failed (attempt {attempt}/{max_retries}): {e}"
            )
            if attempt < max_retries:
                await asyncio.sleep(2 * attempt)  # exponential backoff: 2s, 4s

    logger.error(f"All {max_retries} attempts to fetch games failed: {last_error}")
    raise HTTPException(
        status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
        detail=f"Database temporarily unavailable after {max_retries} retries. Please try again later."
    )


@router.post("/admin/start/{room_code}")
async def start_game_admin(room_code: str):
    """Admin endpoint to force start a game room"""
    db_client = get_db()
    room_code_upper = room_code.upper()
    game_query = db_client.table("games").select("id, status").eq("room_code", room_code_upper).execute()
    if not game_query.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Game room not found."
        )
    game_data = game_query.data[0]
    game_id = game_data["id"]
    game_status = game_data["status"]
    
    if game_status != "lobby":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Game has already started or completed."
        )
        
    from app.game.engine import start_game_session
    import asyncio
    asyncio.create_task(start_game_session(game_id))
    return {"status": "success", "message": f"Game room {room_code_upper} starting."}


@router.get("/admin/mapbox-logs")
async def get_mapbox_api_logs():
    """Admin endpoint to fetch Mapbox Geocoding API request/response logs"""
    from app.game.scoring import mapbox_api_logs
    # Return newest first
    return list(reversed(mapbox_api_logs))


@router.patch("/admin/update-points")
async def admin_update_points(request: AdminUpdatePointsRequest):
    """Admin endpoint to bulk-update submission points and recalculate player scores"""
    db_client = get_db()
    
    try:
        # 1. Update each submission's points
        for update in request.updates:
            db_client.table("submissions").update({
                "points": update.points
            }).eq("id", update.submission_id).execute()
        
        # 2. Recalculate total scores for affected games
        # Gather all affected submission IDs to find their games
        sub_ids = [u.submission_id for u in request.updates]
        if sub_ids:
            # Fetch submissions to find game_ids and user_ids
            subs_query = db_client.table("submissions").select("game_id, user_id").in_("id", sub_ids).execute()
            
            # Group by (game_id, user_id) to recalculate each player's total
            affected_players = set()
            for sub in subs_query.data:
                affected_players.add((sub["game_id"], sub["user_id"]))
            
            for game_id, user_id in affected_players:
                # Sum all submission points for this player in this game
                all_subs = db_client.table("submissions").select("points").eq("game_id", game_id).eq("user_id", user_id).execute()
                total_score = sum(s["points"] for s in all_subs.data)
                
                # Update game_players total score
                db_client.table("game_players").update({
                    "score": total_score
                }).eq("game_id", game_id).eq("user_id", user_id).execute()
        
        # 3. Notify admin dashboard and room players of the update
        try:
            from app.websocket.manager import socket_manager
            await socket_manager.notify_admin_dashboard()
            # Also notify the room players if they are active
            for game_id, _ in affected_players:
                # Fetch game room code to broadcast update
                game_info = db_client.table("games").select("room_code").eq("id", game_id).execute()
                if game_info.data:
                    room_code = game_info.data[0]["room_code"]
                    # Fetch latest state and broadcast
                    state = await socket_manager.get_updated_room_state(game_id, room_code)
                    if state:
                        await socket_manager.broadcast_to_room(room_code, "room_state", state)
        except Exception as ex:
            logger.warning(f"Failed to broadcast updates after points change: {ex}")

        return {"status": "success", "updated": len(request.updates)}
    except Exception as e:
        logger.error(f"Failed to update points: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to update points: {str(e)}"
        )

@router.post("/admin/declare-winner/{room_code}")
async def declare_winner_admin(room_code: str):
    """Admin endpoint to declare winner and trigger game completed animation for all players"""
    db_client = get_db()
    room_code_upper = room_code.upper()
    game_query = db_client.table("games").select("id, status").eq("room_code", room_code_upper).execute()
    if not game_query.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Game room not found."
        )
    game_data = game_query.data[0]
    game_id = game_data["id"]
    game_status = game_data["status"]
    
    if game_status == "completed":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Game has already been completed."
        )
        
    # Fetch all players and calculate final leaderboard
    players_query = db_client.table("game_players").select("score, profiles(username, id)").eq("game_id", game_id).execute()
    
    final_leaderboard = []
    for item in players_query.data:
        final_leaderboard.append({
            "user_id": item["profiles"]["id"],
            "username": item["profiles"]["username"],
            "score": item["score"]
        })
        
    # Sort by score descending
    final_leaderboard.sort(key=lambda x: x["score"], reverse=True)
    
    from app.game.engine import end_game
    await end_game(game_id, final_leaderboard)
    
    return {"status": "success", "message": "Winner declared successfully."}
