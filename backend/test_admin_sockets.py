import asyncio
import socketio
import httpx

async def main():
    sio = socketio.AsyncClient()
    updated = asyncio.Event()

    @sio.on('admin_update')
    def on_admin_update(data):
        print("Received admin_update event!")
        updated.set()

    print("Connecting to Socket.IO...")
    await sio.connect('http://127.0.0.1:8000', transports=['websocket'])
    
    print("Emitting join_admin...")
    await sio.emit('join_admin', {})
    
    # Trigger an update by creating a game lobby via REST API
    print("Creating game room to trigger update...")
    async with httpx.AsyncClient() as client:
        # First login guest to get a token
        login_res = await client.post('http://127.0.0.1:8000/api/v1/auth/guest-login', json={"username": "TestPlayer"})
        token = login_res.json()["access_token"]
        
        # Create game
        headers = {"Authorization": f"Bearer {token}"}
        game_res = await client.post('http://127.0.0.1:8000/api/v1/games/create', 
                                    json={"total_rounds": 5, "exclude_u": False, "round_duration": 15},
                                    headers=headers)
        print("Game created:", game_res.json()["room_code"])

    try:
        # Wait for the update event to be received by our socket client
        await asyncio.wait_for(updated.wait(), timeout=5.0)
        print("Test passed: Admin Panel received live updates successfully!")
    except asyncio.TimeoutError:
        print("Test failed: Did not receive admin_update event.")
        
    await sio.disconnect()

if __name__ == '__main__':
    asyncio.run(main())
