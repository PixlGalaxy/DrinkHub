import asyncio
import os
from contextlib import asynccontextmanager

from dotenv import load_dotenv
from fastapi import APIRouter, FastAPI
from fastapi.middleware.cors import CORSMiddleware

from routers.ws import router as ws_router
from services.room_service import cleanup_expired_rooms, cleanup_disconnected_players, get_all_rooms, hydrate_rooms
from services.persistence import load_rooms, save_rooms
from services.security import rate_limiter
from games.registry import list_games
from websocket.manager import manager

load_dotenv()

ALLOWED_ORIGINS = [o.strip() for o in os.getenv("ALLOWED_ORIGINS", "http://localhost:5173").split(",")]
SAVE_INTERVAL_SEC = int(os.getenv("SAVE_INTERVAL_SEC", "5"))


@asynccontextmanager
async def lifespan(_app: FastAPI):
    # Load any persisted rooms on startup
    persisted = load_rooms()
    if persisted:
        hydrate_rooms(persisted)

    async def cleanup_loop():
        while True:
            await asyncio.sleep(30)
            expired = cleanup_expired_rooms()
            removed = cleanup_disconnected_players()
            for code in expired + removed:
                manager.cleanup_room(code)
            rate_limiter.cleanup()

    async def save_loop():
        while True:
            await asyncio.sleep(SAVE_INTERVAL_SEC)
            try:
                save_rooms(get_all_rooms())
            except Exception as e:
                print(f"[main] save_loop error: {e}")

    cleanup_task = asyncio.create_task(cleanup_loop())
    save_task = asyncio.create_task(save_loop())
    try:
        yield
    finally:
        cleanup_task.cancel()
        save_task.cancel()
        # Final save on shutdown
        save_rooms(get_all_rooms())


app = FastAPI(title="DrinkHub API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["Content-Type", "Authorization"],
)

app.include_router(ws_router)

api_router = APIRouter(prefix="/api")

@api_router.get("/health")
def health():
    return {"status": "ok", "rooms_active": len(get_all_rooms())}

@api_router.get("/games")
def games():
    return {"games": list_games()}

app.include_router(api_router)
