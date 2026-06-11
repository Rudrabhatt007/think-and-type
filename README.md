# Think & Type - Multiplayer Word Game

Think & Type is a fast-paced, real-time multiplayer word game based on the classic "Name, Place, Animal, Thing" formula.

## Architecture Overview

```
                          ┌──────────────────────────┐
                          │    Nginx Reverse Proxy   │
                          └─────────────┬────────────┘
                                        │
                         ┌──────────────┴──────────────┐
                         ▼                             ▼
              ┌────────────────────┐         ┌────────────────────┐
              │  FastAPI (REST)    │         │  Socket.IO Server  │
              └──────────┬─────────┘         └──────────┬─────────┘
                         │                              │
                         └──────────────┬───────────────┘
                                        │
                   ┌────────────────────┴────────────────────┐
                   ▼                                         ▼
         ┌───────────────────┐                     ┌──────────────────┐
         │Supabase PostgreSQL│                     │Redis State/PubSub│
         └───────────────────┘                     └──────────────────┘
```

### Key Components

1. **Frontend**: Vite + React + TypeScript with Tailwind CSS & ShadCN UI for the design system. Animations are handled by Framer Motion. Communication with the backend is done via Axios (for REST) and Socket.IO client (for realtime events).
2. **Backend**: FastAPI (Python) hosting REST endpoints and a python-socketio server.
3. **Database**: Supabase PostgreSQL for persistence of users, games, rounds, submissions, and challenges.
4. **Caching & Queue**: Redis is used for keeping current room states, counting active timer ticks, storing answers before database bulk commits, and synchronization across WebSocket nodes.
5. **Reverse Proxy & Routing**: Nginx routes standard HTTP traffic to FastAPI and upgrade requests (`/socket.io`) to the Socket.IO worker thread.

---

## Getting Started

### Local Development (Docker-Compose)

Run the entire suite locally using Docker Compose:

```bash
docker-compose up --build
```

- Frontend: http://localhost
- Backend: http://localhost:8000
- Database: Supabase PostgreSQL (configured through env)
- Cache: Redis (running in container)
