from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import logging

from app.core.config import settings
from app.api.auth import router as auth_router
from app.api.games import router as games_router
from app.websocket.manager import socket_manager

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)

app = FastAPI(
    title=settings.PROJECT_NAME,
    openapi_url=f"{settings.API_V1_STR}/openapi.json"
)

# Set CORS origins
origins = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "https://think-and-type.vercel.app",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include API routers
app.include_router(auth_router, prefix=settings.API_V1_STR)
app.include_router(games_router, prefix=settings.API_V1_STR)

@app.get("/")
async def root():
    return {"status": "active", "message": "Think & Type API is running"}

@app.get("/health")
async def health_check():
    return {"status": "healthy", "project": settings.PROJECT_NAME}

# Wrap FastAPI app with Socket.IO ASGI app
asgi_app = socket_manager.get_asgi_app(app)
