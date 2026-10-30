import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import type { Night } from '../src/digest/types.js';

const base = { adapter: 'shim', installed: '2026-10-29T14:06:00+01:00', beatEverySeconds: 60 };

const line = (job: string, status: string, at: string, extra: Record<string, unknown> = {}) =>
  JSON.stringify({ at, job, status, owner: 'rook', ...extra });

let dir: string;
let app: ReturnType<typeof createApp>;

beforeAll(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rig-digest-'));
  // Written out of job order on purpose: output must be sorted by job.
  fs.writeFileSync(
    path.join(dir, '2030-01-01.jsonl'),
    [
      line('zeta-job', 'ok', '2030-01-01T23:00:00+01:00'),
      line('alpha-job', 'retry', '2030-01-02T00:00:00+01:00', { error: 'boom' }),
      line('alpha-job', 'ok', '2030-01-02T00:01:00+01:00'),
      line('mid-job', 'fail', '2030-01-02T01:00:00+01:00', { error: 'quota' }),
    ].join('\n') + '\n',
  );
  fs.writeFileSync(path.join(dir, '2030-01-02.jsonl'), '');
  fs.writeFileSync(
    path.join(dir, '2030-01-03.jsonl'),
    [
      line('zeta-job', 'ok', '2030-01-03T23:00:00+01:00'),
      'this is not json',
      line('alpha-job', 'ok', '2030-01-04T00:00:00+01:00'),
    ].join('\n') + '\n',
  );
  app = createApp({ ...base, runsDir: dir });
});

afterAll(() => {
  fs.rmSync(dir, { recursive: true, force: true });
});

// Positions of each job name in the html; fails if any is missing.
const positionsOf = (html: string, jobs: string[]) => {
  const positions = jobs.map((j) => html.indexOf(j));
  expect(positions.every((p) => p >= 0)).toBe(true);
  return positions;
};

describe('digest page', () => {
  it('renders one table with every job', async () => {
    const res = await app.request('/digest/2030-01-01');
    const html = await res.text();
    expect(res.status).toBe(200);
    expect(html.match(/<table/g)).toHaveLength(1);
    for (const job of ['alpha-job', 'mid-job', 'zeta-job']) expect(html).toContain(job);
  });

  it('404s for a night with no file', async () => {
    const res = await app.request('/digest/2030-12-31');
    expect(res.status).toBe(404);
  });

  it('says "nothing ran" for an empty file', async () => {
    const res = await app.request('/digest/2030-01-02');
    expect(res.status).toBe(200);
    expect(await res.text()).toContain('nothing ran');
  });

  it('still renders the good jobs when a line is bad', async () => {
    const res = await app.request('/digest/2030-01-03');
    const html = await res.text();
    expect(res.status).toBe(200);
    expect(html).toContain('alpha-job');
    expect(html).toContain('zeta-job');
  });
});

describe('digest json', () => {
  it('returns night, rows sorted by job, and badLines', async () => {
    const res = await app.request('/api/digest/2030-01-01');
    const body = (await res.json()) as Night;
    expect(res.status).toBe(200);
    expect(body.night).toBe('2030-01-01');
    expect(body.badLines).toBe(0);
    expect(body.rows.map((r) => r.job)).toEqual(['alpha-job', 'mid-job', 'zeta-job']);
    const alpha = body.rows[0];
    expect(alpha.runs).toBe(2);
    expect(alpha.retries).toBe(1);
    expect(alpha.lastStatus).toBe('ok');
  });

  it('404s for a night with no file', async () => {
    const res = await app.request('/api/digest/2030-12-31');
    expect(res.status).toBe(404);
  });

  it('returns no rows for an empty file', async () => {
    const res = await app.request('/api/digest/2030-01-02');
    const body = (await res.json()) as Night;
    expect(res.status).toBe(200);
    expect(body.rows).toEqual([]);
    expect(body.badLines).toBe(0);
  });

  it('counts a bad line and keeps the good jobs', async () => {
    const res = await app.request('/api/digest/2030-01-03');
    const body = (await res.json()) as Night;
    expect(res.status).toBe(200);
    expect(body.badLines).toBe(1);
    expect(body.rows.map((r) => r.job)).toEqual(['alpha-job', 'zeta-job']);
  });
});

describe('page and JSON agree', () => {
  it.each(['2030-01-01', '2030-01-03'])('same jobs in the same order for %s', async (night) => {
    const html = await (await app.request(`/digest/${night}`)).text();
    const body = (await (await app.request(`/api/digest/${night}`)).json()) as Night;
    const positions = positionsOf(html, body.rows.map((r) => r.job));
    expect(positions).toEqual([...positions].sort((a, b) => a - b));
  });
});

describe('real night (read-only)', () => {
  it('2026-10-28 has 5 rows and 1 bad line, and the page matches', async () => {
    const real = createApp({ ...base, runsDir: 'runs' });
    const body = (await (await real.request('/api/digest/2026-10-28')).json()) as Night;
    expect(body.rows).toHaveLength(5);
    expect(body.badLines).toBe(1);
    const html = await (await real.request('/digest/2026-10-28')).text();
    const positions = positionsOf(html, body.rows.map((r) => r.job));
    expect(positions).toEqual([...positions].sort((a, b) => a - b));
  });
});
