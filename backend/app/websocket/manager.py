import logging
import socketio
from jose import jwt, JWTError
from uuid import UUID
from typing import Dict, Any

from app.core.config import settings
from app.core.db import get_db
from app.core.redis import get_redis

logger = logging.getLogger(__name__)

# Initialize Socket.IO server
sio = socketio.AsyncServer(async_mode='asgi', cors_allowed_origins='*')

class SocketIOManager:
    def __init__(self, server: socketio.AsyncServer):
        self.sio = server
        # In-memory session tracking mapping sid -> session_dict
        # session_dict: {"user_id": str, "username": str, "room_code": str, "game_id": str}
        self.sessions: Dict[str, Dict[str, Any]] = {}

    def get_asgi_app(self, fastapi_app):
        """Wrap FastAPI application with ASGI wrapper for socketio"""
        return socketio.ASGIApp(self.sio, fastapi_app)

    async def broadcast_to_room(self, room_code: str, event: str, data: Any):
        """Helper to broadcast event to a specific room"""
        await self.sio.emit(event, data, room=room_code)

    async def notify_admin_dashboard(self):
        """Notify the admin dashboard to refresh its data"""
        await self.sio.emit("admin_update", {}, room="admin_dashboard")

    def decode_token(self, token: str) -> Dict[str, str]:
        """Decode and validate user JWT token"""
        try:
            payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
            return {"user_id": payload.get("sub"), "username": payload.get("username")}
        except (JWTError, ValueError) as e:
            logger.error(f"JWT Token validation failed: {e}")
            raise ValueError("Invalid credentials token.")

    async def get_updated_room_state(self, game_id: str, room_code: str) -> Dict[str, Any]:
        """Retrieve latest details for a room to broadcast to clients"""
        db_client = get_db()
        
        # Get game room
        game_query = db_client.table("games").select("*").eq("id", game_id).execute()
        if not game_query.data:
            return {}
        game_data = game_query.data[0]
        
        # Get players
        players_query = db_client.table("game_players").select("score, is_ready, profiles(username, id)").eq("game_id", game_id).execute()
        
        redis_client = await get_redis()
        players_list = []
        for item in players_query.data:
            user_id = item["profiles"]["id"]
            avatar = await redis_client.get(f"avatar:{user_id}")
            players_list.append({
                "user_id": user_id,
                "username": item["profiles"]["username"],
                "score": item["score"],
                "is_ready": item["is_ready"],
                "avatar": avatar
            })
            
        return {
            "game": game_data,
            "players": players_list
        }

# Global socket manager wrapper instance
socket_manager = SocketIOManager(sio)

@sio.event
async def connect(sid, environ):
    logger.info(f"Socket connection established: {sid}")

@sio.event
async def join_admin(sid, data):
    """Admin joins the admin dashboard room"""
    await sio.enter_room(sid, "admin_dashboard")
    logger.info(f"Admin joined admin dashboard: {sid}")

@sio.event
async def disconnect(sid):
    logger.info(f"Socket disconnected: {sid}")
    session = socket_manager.sessions.pop(sid, None)
    if session:
        room_code = session.get("room_code")
        game_id = session.get("game_id")
        user_id = session.get("user_id")
        username = session.get("username")
        
        # Remove from socket room
        await sio.leave_room(sid, room_code)
        await sio.leave_room(sid, str(game_id))
        
        # Remove player from game_players table if status is lobby,
        # or mark offline if active. Let's delete them from game_players if it's still a lobby.
        db_client = get_db()
        game_query = db_client.table("games").select("status, host_id").eq("id", game_id).execute()
        if game_query.data:
            status = game_query.data[0]["status"]
            host_id = game_query.data[0]["host_id"]
            
            if status == "lobby":
                db_client.table("game_players").delete().eq("game_id", game_id).eq("user_id", user_id).execute()
                
                # If host left, assign a new host if players remain, otherwise close room
                if str(host_id) == str(user_id):
                    remaining = db_client.table("game_players").select("user_id").eq("game_id", game_id).execute()
                    if remaining.data:
                        new_host = remaining.data[0]["user_id"]
                        db_client.table("games").update({"host_id": new_host}).eq("id", game_id).execute()
                    else:
                        db_client.table("games").update({"status": "completed"}).eq("id", game_id).execute()
            
            # Broadcast updated room state
            state = await socket_manager.get_updated_room_state(game_id, room_code)
            if state:
                await socket_manager.broadcast_to_room(room_code, "room_state", state)
            await socket_manager.notify_admin_dashboard()

@sio.event
async def join_room(sid, data):
    """
    Player joins the websocket room.
    data: {"room_code": "...", "token": "..."}
    """
    room_code = data.get("room_code", "").upper()
    token = data.get("token")
    
    if not room_code or not token:
        await sio.emit("error", "Room code and token are required.", to=sid)
        return
        
    try:
        user_info = socket_manager.decode_token(token)
        user_id = user_info["user_id"]
        username = user_info["username"]
    except ValueError as e:
        await sio.emit("error", str(e), to=sid)
        return
        
    db_client = get_db()
    
    # Verify game exists
    game_query = db_client.table("games").select("id, status, host_id").eq("room_code", room_code).execute()
    if not game_query.data:
        await sio.emit("error", "Game room not found.", to=sid)
        return
        
    game_id = game_query.data[0]["id"]
    game_status = game_query.data[0]["status"]
    host_id = game_query.data[0]["host_id"]
    
    # Associate user session
    socket_manager.sessions[sid] = {
        "user_id": user_id,
        "username": username,
        "room_code": room_code,
        "game_id": game_id,
        "is_host": str(host_id) == str(user_id)
    }
    
    # Enter the socketio room
    await sio.enter_room(sid, room_code)
    await sio.enter_room(sid, str(game_id))
    
    # Check if already registered in game_players, otherwise register
    # PREVENT HOST FROM BEING ADDED AS A PLAYER
    is_host = str(host_id) == str(user_id)
    if not is_host:
        gp_query = db_client.table("game_players").select("*").eq("game_id", game_id).eq("user_id", user_id).execute()
        if not gp_query.data and game_status == "lobby":
            db_client.table("game_players").insert({
                "game_id": game_id,
                "user_id": user_id,
                "score": 0,
                "is_ready": False
            }).execute()
        
    # Broadcast updated room state to room
    state = await socket_manager.get_updated_room_state(game_id, room_code)
    await socket_manager.broadcast_to_room(room_code, "room_state", state)
    await socket_manager.notify_admin_dashboard()

@sio.event
async def start_game(sid, data):
    """
    Host starts the game.
    data: {"room_code": "..."}
    """
    session = socket_manager.sessions.get(sid)
    if not session:
        await sio.emit("error", "Session not found.", to=sid)
        return
        
    room_code = session["room_code"]
    game_id = session["game_id"]
    user_id = session["user_id"]
    
    db_client = get_db()
    game_query = db_client.table("games").select("host_id, status").eq("id", game_id).execute()
    
    if not game_query.data:
        await sio.emit("error", "Game not found.", to=sid)
        return
        
    host_id = game_query.data[0]["host_id"]
    game_status = game_query.data[0]["status"]
    
    if str(host_id) != str(user_id):
        await sio.emit("error", "Only the host can start the game.", to=sid)
        return
        
    if game_status != "lobby":
        await sio.emit("error", "Game has already started.", to=sid)
        return
        
    # Import locally to trigger start
    from app.game.engine import start_game_session
    import asyncio
    asyncio.create_task(start_game_session(game_id))

@sio.event
async def submit_answers(sid, data):
    """
    Submit typed answers for a round.
    data: {"round_number": 1, "answers": {"name": "...", "place": "...", "animal": "...", "thing": "..."}}
    """
    session = socket_manager.sessions.get(sid)
    if not session:
        await sio.emit("error", "Session not found.", to=sid)
        return
        
    game_id = session["game_id"]
    room_code = session["room_code"]
    user_id = session["user_id"]
    
    round_number = data.get("round_number")
    answers = data.get("answers", {})
    
    redis = await get_redis()
    phase = await redis.get(f"game:{game_id}:phase")
    
    if phase != "typing":
        await sio.emit("error", "Cannot submit answers outside the typing phase.", to=sid)
        return
        
    # Insert or update answer submissions in database
    db_client = get_db()
    categories = ["name", "place", "animal", "thing"]
    
    for cat in categories:
        val = answers.get(cat, "").strip()
        
        # Use upsert (ON CONFLICT unique_submission DO UPDATE)
        insert_data = {
            "game_id": game_id,
            "round_number": round_number,
            "user_id": user_id,
            "category": cat,
            "answer_text": val,
            "is_valid": True if val else False,  # Blank is automatically invalid
            "points": 0
        }
        
        try:
            db_client.table("submissions").upsert(insert_data, on_conflict="game_id, round_number, user_id, category").execute()
        except Exception as e:
            logger.error(f"Error saving submission for {cat}: {e}")
            
    # Notify room that this player has submitted
    await socket_manager.broadcast_to_room(room_code, "player_submitted", {
        "user_id": user_id,
        "username": session["username"]
    })
    await socket_manager.notify_admin_dashboard()

@sio.event
async def submit_challenge(sid, data):
    """
    Submit an answer validation challenge.
    data: {"round_number": 1, "target_user_id": "...", "category": "...", "answer_text": "..."}
    """
    session = socket_manager.sessions.get(sid)
    if not session:
        await sio.emit("error", "Session not found.", to=sid)
        return
        
    game_id = session["game_id"]
    room_code = session["room_code"]
    challenger_id = session["user_id"]
    
    round_number = data.get("round_number")
    target_user_id = data.get("target_user_id")
    category = data.get("category")
    answer_text = data.get("answer_text")
    
    redis = await get_redis()
    phase = await redis.get(f"game:{game_id}:phase")
    
    if phase != "challenge":
        await sio.emit("error", "Challenges can only be submitted during the challenge phase.", to=sid)
        return
        
    db_client = get_db()
    
    challenge_data = {
        "game_id": game_id,
        "round_number": round_number,
        "challenger_id": challenger_id,
        "target_user_id": target_user_id,
        "category": category,
        "answer_text": answer_text,
        "status": "pending",
        "yes_votes": 0,
        "no_votes": 0
    }
    
    try:
        # Create challenge record
        challenge_res = db_client.table("challenges").insert(challenge_data).execute()
        if challenge_res.data:
            # Broadcast update
            await broadcast_challenges_list(game_id, room_code, round_number)
    except Exception as e:
        logger.warning(f"Challenge already created or error: {e}")

@sio.event
async def submit_vote(sid, data):
    """
    Submit a vote on a challenge.
    data: {"challenge_id": "...", "vote": bool}  # True = Invalid, False = Valid
    """
    session = socket_manager.sessions.get(sid)
    if not session:
        await sio.emit("error", "Session not found.", to=sid)
        return
        
    game_id = session["game_id"]
    room_code = session["room_code"]
    voter_id = session["user_id"]
    
    challenge_id = data.get("challenge_id")
    vote = data.get("vote")
    
    redis = await get_redis()
    phase = await redis.get(f"game:{game_id}:phase")
    
    if phase != "challenge":
        await sio.emit("error", "Voting is only allowed during the challenge phase.", to=sid)
        return
        
    db_client = get_db()
    
    # 1. Register vote
    vote_data = {
        "challenge_id": challenge_id,
        "voter_id": voter_id,
        "vote": vote
    }
    
    try:
        db_client.table("challenge_votes").insert(vote_data).execute()
        
        # 2. Update vote counts on challenges table
        challenge_query = db_client.table("challenges").select("yes_votes, no_votes, round_number").eq("id", challenge_id).execute()
        if challenge_query.data:
            round_number = challenge_query.data[0]["round_number"]
            yes = challenge_query.data[0]["yes_votes"]
            no = challenge_query.data[0]["no_votes"]
            
            if vote:
                db_client.table("challenges").update({"yes_votes": yes + 1}).eq("id", challenge_id).execute()
            else:
                db_client.table("challenges").update({"no_votes": no + 1}).eq("id", challenge_id).execute()
                
            # Broadcast updated challenge list
            await broadcast_challenges_list(game_id, room_code, round_number)
    except Exception as e:
        logger.warning(f"Voter already voted or error: {e}")

async def broadcast_challenges_list(game_id: str, room_code: str, round_number: int):
    """Fetch all challenges for this round and broadcast to room"""
    db_client = get_db()
    challenges_query = db_client.table("challenges").select("*, profiles!challenges_target_user_id_fkey(username)").eq("game_id", game_id).eq("round_number", round_number).execute()
    
    list_to_send = []
    for chal in challenges_query.data:
        list_to_send.append({
            "id": chal["id"],
            "target_user_id": chal["target_user_id"],
            "target_username": chal["profiles"]["username"] if chal.get("profiles") else "Unknown",
            "category": chal["category"],
            "answer_text": chal["answer_text"],
            "yes_votes": chal["yes_votes"],
            "no_votes": chal["no_votes"],
            "status": chal["status"]
        })
        
    await socket_manager.broadcast_to_room(room_code, "challenge_update", {
        "challenges": list_to_send
    })
    await socket_manager.notify_admin_dashboard()
