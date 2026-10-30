import { Hono } from 'hono';
import { loadConfig, type RigConfig } from './config.js';
import { readNight } from './digest/read.js';
import type { ReadNight } from './digest/types.js';
import { lane } from './lane.js';
import { readStatus } from './status.js';
import { DigestMissing, DigestPage } from './views/digest.js';
import { Layout } from './views/layout.js';
import { StatusBoard } from './views/status.js';

export function createApp(config: RigConfig = loadConfig(), deps: { readNight?: ReadNight } = {}) {
  const read = deps.readNight ?? readNight;
  const app = new Hono();

  app.get('/health', (c) => c.json({ ok: true, lane: lane().id }));

  app.get('/api/digest/:night', (c) => {
    const night = c.req.param('night');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(night)) return c.json({ error: 'not found' }, 404);
    const result = read(config.runsDir, night);
    if (!result) return c.json({ error: 'no run log', night }, 404);
    return c.json(result);
  });

  app.get('/', (c) =>
    c.html(
      <Layout title="status" lane={lane()}>
        <StatusBoard status={readStatus(config)} />
      </Layout>,
    ),
  );

  app.get('/digest/:night', (c) => {
    const night = c.req.param('night');
    const found = /^\d{4}-\d{2}-\d{2}$/.test(night) ? read(config.runsDir, night) : null;
    if (!found) {
      return c.html(
        <Layout title={`digest · ${night}`} lane={lane()}>
          <DigestMissing night={night} />
        </Layout>,
        404,
      );
    }
    return c.html(
      <Layout title={`digest · ${night}`} lane={lane()}>
        <DigestPage night={found} />
      </Layout>,
    );
  });

  return app;
}
