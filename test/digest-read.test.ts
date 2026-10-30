import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { readNight } from '../src/digest/read.js';

describe('readNight on runs/2026-10-28.jsonl', () => {
  const night = readNight('runs', '2026-10-28');
  const row = (job: string) => night?.rows.find((r) => r.job === job);

  it('has 5 jobs, sorted by job, and 1 bad line', () => {
    expect(night).not.toBeNull();
    expect(night?.badLines).toBe(1);
    const jobs = night?.rows.map((r) => r.job) ?? [];
    expect(jobs).toHaveLength(5);
    expect(jobs).toEqual([...jobs].sort());
  });

  it('fixtures/refresh: 3 retries, then ok; times kept as written', () => {
    expect(row('fixtures/refresh')).toMatchObject({
      owner: 'rook',
      runs: 4,
      retries: 3,
      lastStatus: 'ok',
      lastError: 'upstream 503',
      firstAt: '2026-10-29T01:30:00+01:00',
      lastAt: '2026-10-29T01:37:00+01:00',
    });
  });

  it('notes/backup failed', () => {
    expect(row('notes/backup')).toMatchObject({ lastStatus: 'fail', lastError: 'quota exceeded' });
  });

  it('digest/render keeps a null owner', () => {
    expect(row('digest/render')).toBeDefined();
    expect(row('digest/render')?.owner).toBeNull();
  });
});

describe('readNight edge cases', () => {
  let dir: string;
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'rig-runs-'));
  });
  afterEach(() => rmSync(dir, { recursive: true, force: true }));

  it('missing file is null', () => {
    expect(readNight(dir, '2026-01-01')).toBeNull();
  });

  it('empty file is a night with no rows', () => {
    writeFileSync(join(dir, '2026-01-01.jsonl'), '');
    expect(readNight(dir, '2026-01-01')).toEqual({ night: '2026-01-01', rows: [], badLines: 0 });
  });

  it('counts lines that parse but do not match RunLine; blank lines are not bad', () => {
    const lines = [
      '{"at":"2026-01-01T00:00:00+02:00","job":"a","status":"ok","owner":"x"}',
      '{"at":"2026-01-01T00:01:00+02:00","job":"a","status":"weird","owner":"x"}',
      '{"at":"2026-01-01T00:02:00+02:00","job":"a","status":"ok","owner":5}',
      '[]',
      '',
    ];
    writeFileSync(join(dir, '2026-01-01.jsonl'), lines.join('\n') + '\n');
    const night = readNight(dir, '2026-01-01');
    expect(night?.badLines).toBe(3);
    expect(night?.rows).toHaveLength(1);
    expect(night?.rows[0]?.firstAt).toBe('2026-01-01T00:00:00+02:00');
  });
});
