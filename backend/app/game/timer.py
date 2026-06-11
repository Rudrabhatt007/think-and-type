import asyncio
from typing import Dict, Callable, Any, Awaitable
import logging

logger = logging.getLogger(__name__)

class GameTimerManager:
    def __init__(self):
        # Maps game_id (UUID or str) -> asyncio.Task
        self.active_timers: Dict[str, asyncio.Task] = {}

    def start_timer(
        self, 
        game_id: str, 
        duration: int, 
        on_tick: Callable[[int], Awaitable[None]], 
        on_expire: Callable[[], Awaitable[None]]
    ):
        """Start a countdown timer for a game. Cancels existing timer if active."""
        self.cancel_timer(game_id)
        
        # Create a new background task
        task = asyncio.create_task(
            self._run_timer(game_id, duration, on_tick, on_expire)
        )
        self.active_timers[game_id] = task
        logger.info(f"Started timer for game {game_id} with duration {duration}s")

    def cancel_timer(self, game_id: str):
        """Cancel an active timer for a game if it exists"""
        task = self.active_timers.pop(game_id, None)
        if task:
            task.cancel()
            logger.info(f"Cancelled timer for game {game_id}")

    async def _run_timer(
        self, 
        game_id: str, 
        duration: int, 
        on_tick: Callable[[int], Awaitable[None]], 
        on_expire: Callable[[], Awaitable[None]]
    ):
        try:
            for remaining in range(duration, -1, -1):
                try:
                    await on_tick(remaining)
                except Exception as e:
                    logger.error(f"Error in timer tick callback for game {game_id}: {e}")
                
                if remaining == 0:
                    break
                await asyncio.sleep(1)
                
            # Timer expired
            self.active_timers.pop(game_id, None)
            try:
                await on_expire()
            except Exception as e:
                logger.error(f"Error in timer expire callback for game {game_id}: {e}")
                
        except asyncio.CancelledError:
            logger.info(f"Timer for game {game_id} was cancelled during execution")
        except Exception as e:
            logger.error(f"Unexpected error running timer for game {game_id}: {e}")
            self.active_timers.pop(game_id, None)

# Global timer manager
timer_manager = GameTimerManager()
