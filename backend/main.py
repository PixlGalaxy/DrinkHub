import asyncio
import os
from contextlib import asynccontextmanager

from dotenv import load_dotenv
from fastapi import APIRouter, FastAPI
from fastapi.middleware.cors import CORSMiddleware

from routers.ws import router as ws_router
from services.room_service import cleanup_expired_rooms, get_all_rooms, hydrate_rooms
from services.persistence import load_rooms, save_rooms
from games.registry import list_games

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
            await asyncio.sleep(60)
            cleanup_expired_rooms()

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
    allow_methods=["*"],
    allow_headers=["*"],
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
