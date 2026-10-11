import { config } from './server/config.ts';
import { createHttpServer } from './server/http.ts';
import { GameHub } from './server/hub.ts';
import { createLogger } from './server/log.ts';
import { pyramid } from './pyramid/index.ts';
import { sipitordipit } from './sipitordipit/index.ts';

const log = createLogger('main');

// Register games here. Each one gets /api/<slug>, /api/<slug>/ws and its own DB.
const hubs = [new GameHub(sipitordipit), new GameHub(pyramid)];

const server = createHttpServer(hubs);
for (const hub of hubs) hub.start();

server.listen(config.port, config.host, () => {
  log.info(`DrinkHub backend listening on http://${config.host}:${config.port}`);
  for (const hub of hubs) log.info(`  ${hub.game.name}: /api/${hub.game.slug} (db: ${hub.store.path})`);
});

let stopping = false;
function shutdown(signal: string) {
  if (stopping) return;
  stopping = true;
  log.info(`${signal} received, saving rooms and closing connections`);
  for (const hub of hubs) {
    try {
      hub.shutdown();
    } catch (err) {
      log.error(`shutdown of ${hub.game.slug} failed`, err);
    }
  }
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 3000).unref();
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('unhandledRejection', err => log.error('unhandled rejection', err));
process.on('uncaughtException', err => log.error('uncaught exception', err));
