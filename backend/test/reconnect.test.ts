import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import { Client, GameHub, pyramid, sipitordipit, sleep, startServer, waitFor } from './helpers.ts';

const sipHub = new GameHub(sipitordipit);
const pyrHub = new GameHub(pyramid);
let srv: Awaited<ReturnType<typeof startServer>>;

before(async () => {
  srv = await startServer([sipHub, pyrHub]);
});
after(async () => {
  await srv.close();
});

async function sipRoom(names: string[]) {
  const [hostName, ...rest] = names;
  const host = await Client.connect(srv.port, 'sipitordipit');
  const created = await host.act({ type: 'create_room', player_name: hostName });
  const code = created.room_code as string;
  const others: Client[] = [];
  for (const name of rest) {
    const c = await Client.connect(srv.port, 'sipitordipit');
    await c.act({ type: 'join_room', room_code: code, player_name: name });
    others.push(c);
  }
  return { code, clients: [host, ...others] };
}

function byId(clients: Client[], id: string) {
  return clients.find(c => c.playerId === id)!;
}

describe('routes', () => {
  test('per-game REST endpoints', async () => {
    const games: any = await (await fetch(srv.url('/api/games'))).json();
    assert.deepEqual(
      games.games.map((g: any) => g.slug),
      ['sipitordipit', 'pyramid'],
    );
    const sip: any = await (await fetch(srv.url('/api/sipitordipit'))).json();
    assert.equal(sip.cards.total, 200);
    assert.equal(sip.ws, '/api/sipitordipit/ws');
    const missing: any = await (await fetch(srv.url('/api/sipitordipit/rooms/ZZZZZZ'))).json();
    assert.equal(missing.exists, false);
    assert.equal((await fetch(srv.url('/api/nope'))).status, 404);
  });

  test('rooms are scoped to their game', async () => {
    const { code } = await sipRoom(['Ana']);
    const p = await Client.connect(srv.port, 'pyramid');
    const res = await p.act({ type: 'join_room', room_code: code, player_name: 'Beto' });
    assert.equal(res.code, 'ROOM_NOT_FOUND');
  });
});

describe('phone lock / reconnection', () => {
  test('a non-current player disconnecting does not move the turn', async () => {
    const { clients } = await sipRoom(['Ana', 'Beto', 'Caro']);
    const started = await clients[0]!.act({ type: 'start_game' });
    const turn = started.current_player_id;
    const other = clients.find(c => c.playerId !== turn)!;
    other.kill();
    const watcher = byId(clients, turn);
    const state = await watcher.next(m => m.type === 'room_state' && m.players.some((p: any) => p.presence === 'reconnecting'));
    assert.equal(state.current_player_id, turn);
  });

  test('resuming with the token keeps the seat and turn', async () => {
    const { clients } = await sipRoom(['Ana', 'Beto']);
    const started = await clients[0]!.act({ type: 'start_game' });
    const current = byId(clients, started.current_player_id);
    const token = current.token;
    await current.act({ type: 'draw_card' });
    current.kill();
    await sleep(20);

    const resumed = await Client.connect(srv.port, 'sipitordipit', token);
    const state = await resumed.next(m => m.type === 'room_state');
    assert.equal(resumed.playerId, started.current_player_id);
    assert.equal(state.current_player_id, resumed.playerId);
    assert.equal(state.card_drawn, true, 'drawn card survives the reconnect');
    const revealed = await resumed.act({ type: 'reveal_card' });
    assert.equal(revealed.card_revealed, true);
  });

  test('old socket closing after a new one connected does not kick the player', async () => {
    const { clients } = await sipRoom(['Ana', 'Beto']);
    const [ana, beto] = clients as [Client, Client];
    // Phone unlocks: a new socket connects before the old one is detected dead.
    const fresh = await Client.connect(srv.port, 'sipitordipit', beto.token);
    await fresh.next(m => m.type === 'room_state');
    await waitFor(() => beto.closeCode === 4001); // old socket is replaced
    await sleep(20);
    const state = ana.lastState()!;
    assert.equal(state.players.find((p: any) => p.id === beto.playerId).presence, 'online');
    // And the new socket still gets updates.
    const update = fresh.next(m => m.type === 'room_state' && m.status === 'playing');
    await ana.act({ type: 'start_game' });
    await update;
  });

  test('room survives everyone disconnecting', async () => {
    const { code, clients } = await sipRoom(['Ana', 'Beto']);
    for (const c of clients) c.kill();
    await sleep(30);
    sipHub.tick();
    assert.ok(sipHub.getRoom(code), 'room still exists');
    const back = await Client.connect(srv.port, 'sipitordipit', clients[0]!.token);
    const state = await back.next(m => m.type === 'room_state');
    assert.equal(state.room_code, code);
  });

  test('lost session (private tab closed) can reclaim its seat by name', async () => {
    const { code, clients } = await sipRoom(['Ana', 'Beto']);
    const [ana, beto] = clients as [Client, Client];
    await ana.act({ type: 'start_game' });
    const oldId = beto.playerId;
    beto.kill();
    await sleep(20);

    const incognito = await Client.connect(srv.port, 'sipitordipit'); // no token
    const state = await incognito.act({ type: 'join_room', room_code: code, player_name: 'beto' });
    assert.equal(state.type, 'room_state');
    assert.equal(incognito.playerId, oldId, 'got the old seat identity');
    assert.equal(state.players.length, 2);

    const thief = await Client.connect(srv.port, 'sipitordipit');
    const denied = await thief.act({ type: 'join_room', room_code: code, player_name: 'Beto' });
    assert.equal(denied.code, 'NAME_TAKEN', 'cannot take a seat that is online');
  });

  test('away current player can be skipped; host moves to someone present', async () => {
    const { clients } = await sipRoom(['Ana', 'Beto', 'Caro']);
    const started = await clients[0]!.act({ type: 'start_game' });
    const current = byId(clients, started.current_player_id);
    const others = clients.filter(c => c !== current);
    const nonHost = others.find(c => c.playerId !== started.host_id)!;

    current.kill();
    await sleep(20);
    const early = await nonHost.act({ type: 'skip_turn' });
    assert.equal(early.type, 'error', 'cannot skip someone who is only reconnecting');

    await sleep(1100); // AWAY_AFTER_SEC=1
    sipHub.tick();
    const skipped = await nonHost.act({ type: 'skip_turn' });
    assert.notEqual(skipped.current_player_id, current.playerId);
    const host = skipped.players.find((p: any) => p.is_host);
    assert.notEqual(host.presence, 'away');

    // Turns now rotate only among present players.
    const next = byId(others, skipped.current_player_id);
    const after = await next.act({ type: 'next_turn' });
    assert.notEqual(after.current_player_id, current.playerId);
  });

  test('new players can join a SipIt game in progress', async () => {
    const { code, clients } = await sipRoom(['Ana', 'Beto']);
    await clients[0]!.act({ type: 'start_game' });
    const late = await Client.connect(srv.port, 'sipitordipit');
    const state = await late.act({ type: 'join_room', room_code: code, player_name: 'Dani' });
    assert.equal(state.type, 'room_state');
    assert.ok(state.turn_order.includes(late.playerId));
  });
});

describe('pyramid', () => {
  test('votes resolve without players who are away', async () => {
    const host = await Client.connect(srv.port, 'pyramid');
    const code = (await host.act({ type: 'create_room', player_name: 'Ana' })).room_code;
    const b = await Client.connect(srv.port, 'pyramid');
    await b.act({ type: 'join_room', room_code: code, player_name: 'Beto' });
    const c = await Client.connect(srv.port, 'pyramid');
    await c.act({ type: 'join_room', room_code: code, player_name: 'Caro' });
    const started = await host.act({ type: 'start_game' });
    assert.equal(started.viewer_hand.length, 3);

    const cToken = c.token;
    const cHand = (await c.next(m => m.type === 'room_state' && m.status === 'playing')).viewer_hand;
    c.kill();
    await host.act({ type: 'pyramid_vote_next' });
    const afterB = await b.act({ type: 'pyramid_vote_next' });
    assert.equal(afterB.pyramid_data.current_pyramid_index, -1, 'waits for a player who is only reconnecting');

    await sleep(1100);
    pyrHub.tick();
    await waitFor(() => host.lastState()!.pyramid_data.current_pyramid_index === 0);

    const back = await Client.connect(srv.port, 'pyramid', cToken);
    const resumed = await back.next(m => m.type === 'room_state');
    assert.deepEqual(resumed.viewer_hand, cHand, 'hand is kept across reconnects');
  });

  test('rooms (including hands) survive a server restart', async () => {
    const host = await Client.connect(srv.port, 'pyramid');
    const code = (await host.act({ type: 'create_room', player_name: 'Ana' })).room_code;
    const b = await Client.connect(srv.port, 'pyramid');
    await b.act({ type: 'join_room', room_code: code, player_name: 'Beto' });
    const started = await host.act({ type: 'start_game' });
    pyrHub.flush();

    const reloaded = new GameHub(pyramid, undefined);
    const room = reloaded.getRoom(code)!;
    assert.equal(room.status, 'playing');
    assert.deepEqual(room.state.hands[host.playerId], started.viewer_hand);
    assert.ok(room.players.every(p => !p.connected));
    reloaded.store.close();
  });
});

describe('leaving and the lobby reconnect check', () => {
  const summary = async (code: string, token?: string | null) =>
    (await fetch(srv.url(`/api/sipitordipit/rooms/${code}`), {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    }).then(r => r.json())) as any;

  test('room summary says whether the caller still has a seat', async () => {
    const { code, clients } = await sipRoom(['Ana', 'Beto']);
    const [ana] = clients as [Client];
    assert.equal((await summary(code, ana.token)).seat, true);
    assert.equal((await summary(code)).seat, null, 'unknown without a token');
    const stranger = await Client.connect(srv.port, 'sipitordipit');
    assert.equal((await summary(code, stranger.token)).seat, false);
    assert.deepEqual(await summary('ZZZZZZ', ana.token), { exists: false, seat: false });
  });

  test('leave_room frees the seat and an empty room is deleted', async () => {
    const { code, clients } = await sipRoom(['Ana', 'Beto']);
    const [ana, beto] = clients as [Client, Client];
    const left = beto.next(m => m.type === 'left_room', beto.messages.length);
    beto.send({ type: 'leave_room' });
    await left;
    assert.equal((await summary(code, beto.token)).seat, false);
    const state = await ana.next(m => m.type === 'room_state' && m.players.length === 1);
    assert.equal(state.host_id, ana.playerId);

    const anaLeft = ana.next(m => m.type === 'left_room', ana.messages.length);
    ana.send({ type: 'leave_room' });
    await anaLeft;
    assert.equal((await summary(code)).exists, false);
  });
});
