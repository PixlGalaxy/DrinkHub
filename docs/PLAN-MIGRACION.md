# Plan de migración del backend: Python → TypeScript

## 1. Diagnóstico: por qué se caía el juego

| Síntoma | Causa en el backend Python |
|---|---|
| **"Se pasa el turno a otro"** al bloquear el celular | El turno era un índice sobre la lista de jugadores *conectados* (`current_player_index % len(connected)`). Si alguien se desconectaba, la lista se achicaba y el mismo índice apuntaba a otra persona. |
| **"Se loquea"**: un jugador deja de recibir actualizaciones | Al desbloquear, el celular abría un socket nuevo antes de que el servidor detectara que el viejo estaba muerto. Cuando el viejo cerraba, su `finally` hacía `manager.disconnect(player_id)`, que **borraba el socket nuevo** y marcaba al jugador como desconectado. |
| La sala desaparece | Si todos bloqueaban el celular al mismo tiempo, la sala se borraba al instante. Quien pasaba más de 2 minutos bloqueado perdía su lugar. |
| Reconexiones rechazadas | Detrás de nginx todas las IP son `127.0.0.1`, así que el límite de 15 conexiones por minuto era **global** para todos los usuarios. |
| No se detectaba el socket muerto | No había heartbeat: el socket de un celular dormido quedaba "abierto" indefinidamente. |
| No pueden entrar en navegación privada | `sessionStorage.setItem(...)` sin `try/catch` en el lobby. Safari privado lanza una excepción y el botón de crear/unirse fallaba. El token vivía solo en una cookie. |
| Pyramid perdía las manos al reiniciar | `persistence.py` no guardaba `game_data`. |

## 2. Nueva arquitectura

```
backend/
├── index.ts          → registra los juegos y levanta el servidor
├── server/           → todo lo compartido (sockets, sesiones, DB, seguridad)
├── sipitordipit/     → reglas + cartas
├── pyramid/          → reglas
└── storage/          → único volumen: server/, sipitordipit/, pyramid/
```

- **TypeScript sobre Node**, sin paso de compilación (Node ejecuta `.ts` directo). `tsc` solo hace el typecheck.
- **Rutas por juego**: `/api/sipitordipit`, `/api/pyramid`, cada una con su WebSocket (`/api/<juego>/ws`), `/stats` y `/rooms/:code`.
- **Una base SQLite por juego**, dentro de `backend/storage/`, con una carpeta por módulo: `storage/server/` (secreto de sesión), `storage/sipitordipit/sipitordipit.db` y `storage/pyramid/pyramid.db`. En Docker basta **un solo volumen** en `/app/backend/storage`. Hay un `docker-compose.yml` de ejemplo.
- **Contrato `GameModule`**: un juego nuevo es una carpeta con `start`, `actions` y `view`. El hub compartido le da salas, reconexión, anfitrión y persistencia.

## 3. Cómo se resuelve el celular bloqueado

**Servidor**
1. **Turnos por id de jugador**, con un orden fijo de asientos. Una desconexión nunca mueve el turno.
2. **Un socket activo por jugador**: si llega uno nuevo, el viejo se cierra con código `4001`, y el cierre del viejo **ya no afecta** al jugador.
3. **Presencia en 3 estados**: `online` → `reconnecting` (menos de 30 s, sigue contando para turnos y votos) → `away` (se salta su turno; en Pyramid no bloquea la votación). El asiento, con su turno y su mano, se guarda **30 minutos**.
4. **Saltar turno**: si el jugador de turno está `away`, cualquiera puede saltarlo. El anfitrión puede hacerlo siempre.
5. **Anfitrión automático**: si el anfitrión está `away`, el rol pasa a alguien presente.
6. **Heartbeat** cada 15 s: los sockets zombis se cierran y la presencia es real.
7. **Salas persistentes**: no se borran porque todos se desconecten, solo si quedan vacías o pasan 12 h sin actividad.
8. **Límites por IP real** (`X-Real-IP`) y más altos, pensados para grupos detrás del mismo WiFi.
9. **Guardado en SQLite** menos de 500 ms después de cada cambio, y al apagarse (`SIGTERM`). Tras un reinicio todos retoman la partida.
10. **Secreto de sesión persistente** en `storage/server/session.secret`: los tokens siguen siendo válidos después de reiniciar o actualizar el contenedor.

**Cliente** (`useWebSocket` + `useGameRoom`)
1. Ping de aplicación cada 10 s. Si pasan 25 s sin respuesta, reconecta.
2. Al volver a la app (`visibilitychange`, `pageshow`, `focus`, `online`): si el socket está cerrado, reconecta **al instante**. Si parece abierto, pide un `pong` y el estado actualizado; sin respuesta en 3,5 s, reconecta.
3. Backoff con jitter (0,5 s → 8 s), para que toda la mesa no reconecte en el mismo milisegundo.
4. En cada reconexión, `hello` con token → el servidor reanuda el asiento. Si no lo reconoce, el cliente reenvía `join_room` con su nombre.
5. Mientras reconecta **no se pierde la pantalla**: aparece un aviso flotante sobre la partida.
6. Si el mismo usuario abre otra pestaña, las pestañas no se pelean: la vieja muestra "Jugar aquí".
7. Los estados llevan `version` y el cliente descarta los viejos.

## 4. Navegación privada

- `session.ts`: almacenamiento que **nunca lanza excepciones** (localStorage → sessionStorage → cookie → memoria).
- Si se pierde el token (se cerró la pestaña privada), **entrar con el mismo código y el mismo nombre recupera el asiento**, siempre que ese asiento no esté `online` en ese momento.

## 5. Otras mejoras

- Mazo guardado como ids de carta, lo que da una DB pequeña y reglas siempre actualizadas.
- En SipIt se puede entrar a mitad de partida (se agrega al final del orden de turnos). En Pyramid también, mientras queden cartas para repartir una mano.
- Errores con `code` (`ROOM_NOT_FOUND`, `NAME_TAKEN`, ...) además del mensaje.
- Un error en una acción ya no cierra el socket.
- `HEALTHCHECK` en Docker, apagado limpio y logs con timestamp.
- CI: typecheck y tests del backend antes de construir la imagen. Dependabot pasa de pip a npm.
- Tests de integración con sockets reales, que cubren todos los escenarios de la sección 1.

## 6. Despliegue

1. Construir la imagen (el CI lo hace en `main`).
2. Montar un solo volumen en `/app/backend/storage` (ver `docker-compose.yml`). Es la misma ruta del backend Python, así que puedes reutilizar ese volumen: el `rooms.json` viejo se ignora y **las partidas que estaban en curso no se migran**.
3. Opcional: definir `SESSION_SECRET`. Si no se define, se genera y se guarda en `storage/server/` dentro del volumen.
4. Si hay otro proxy delante (Cloudflare, Traefik), debe permitir WebSocket en `/api/*/ws`.

## 7. Siguientes pasos sugeridos

- Arreglar los 2 errores de lint que ya existían (`setState` dentro de un effect en los lobbies).
- Poner el código de sala en la URL (`/pyramid/room/ABCDEF`) para compartir el link directo.
- Métricas simples por juego a partir de la tabla `stats` (partidas jugadas).
