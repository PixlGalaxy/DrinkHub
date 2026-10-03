# DrinkHub backend

TypeScript on Node (≥ 22.18). Node strips the types at runtime, so there is no
build step: `npm start` runs `index.ts` directly. `npm run typecheck` runs `tsc`.

```
backend/
├── index.ts              # boot: registers the games, starts HTTP + WS
├── server/               # shared by every game
│   ├── config.ts         # env vars, per-module storage dirs
│   ├── hub.ts            # realtime server: sessions, seats, presence, host, persistence
│   ├── http.ts           # REST router + WS upgrade routing
│   ├── room.ts           # presence / host / turn-order helpers
│   ├── security.ts       # session tokens, input sanitizing, rate limits, client IP
│   ├── store.ts          # SQLite store (one DB per game)
│   └── types.ts          # Room, Player, GameModule contract
├── sipitordipit/
│   ├── index.ts          # game rules (GameModule)
│   └── cards.ts          # the 200 cards
├── pyramid/
│   └── index.ts
├── storage/              # runtime data (the only volume), one folder per module
│   ├── server/           # session.secret
│   ├── sipitordipit/     # sipitordipit.db
│   └── pyramid/          # pyramid.db
└── test/                 # node:test integration tests (real sockets)
```

In Docker, mount a single volume at `/app/backend/storage`. `DATA_DIR` can
move the storage root elsewhere; the per-module folders are created on start.

## Routes

| Route | |
|---|---|
| `GET /api/health` | status + rooms/players online per game |
| `GET /api/games` | registered games |
| `GET /api/<slug>` | game info (SipIt also returns card counts) |
| `GET /api/<slug>/stats` | counters stored in the game's DB |
| `GET /api/<slug>/rooms/:code` | `{ exists, seat, status, players, joinable }`; `seat` needs `Authorization: Bearer <session token>` |
| `WS  /api/<slug>/ws` | realtime endpoint of that game |

Slugs: `sipitordipit`, `pyramid`.

## Adding a game

1. Create `backend/<slug>/index.ts` exporting a `GameModule` (see `server/types.ts`).
2. Register it in `index.ts`: `new GameHub(myGame)`.
3. Nothing to add for storage: its DB is created in `storage/<slug>/` automatically.

The hub gives the game rooms, seats, host handover, reconnection and
persistence for free; the module only implements `start`, its `actions` and
`view` (what each player sees).

## WebSocket protocol

Client → server: `hello {token?}`, `ping`, `sync`, `create_room`, `join_room`,
`leave_room`, `delete_room`, `start_game`, `restart_game`, plus game actions
(`draw_card`, `reveal_card`, `next_turn`, `skip_turn`, `pyramid_vote_next`).

Server → client: `session {token, player_id}`, `welcome {room_code|null}`,
`room_state {version, ...}`, `error {code, message}`, `room_deleted`, `pong`.

## Connection lifecycle

- **online**: socket open. The server pings every 15s and drops sockets that
  stop answering; the client sends app-level pings every 10s.
- **reconnecting** (`AWAY_AFTER_SEC`, default 30s): socket dropped recently
  (locked phone, app switch). Still counts for turns and votes.
- **away**: skipped for turns/votes; others can skip their turn; host role
  moves to someone present. The seat (turn, hand) is kept.
- **removed** after `SEAT_TTL_SEC` (default 30 min) without reconnecting.
- Rooms are never deleted because everyone disconnected; only when empty or
  idle for `ROOM_IDLE_TTL_SEC` (default 12h).

Resuming uses the signed session token. If it's lost (private tab closed),
joining the same room with the same name reclaims the seat, as long as that
seat is not currently online.

## Env

See `.env.example`.
