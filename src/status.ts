import { readdirSync } from 'node:fs';
import type { RigConfig } from './config.js';
import { readNight } from './digest/read.js';
import { lastBeat, type Beat } from './heartbeat.js';

export type Status = {
  adapter: string;
  installed: string;
  lastBeat: Beat | null;
  nights: NightSummary[];
};

export type NightCounts = { ok: number; retry: number; fail: number };

// `counts` is null when the night can't be read (rendered as `—`).
export type NightSummary = { night: string; counts: NightCounts | null };

// Per job: ok / fail by last status, retry = total retry lines.
export function nightCounts(runsDir: string, night: string): NightCounts | null {
  const n = readNight(runsDir, night);
  if (!n) return null;
  return {
    ok: n.rows.filter((r) => r.lastStatus === 'ok').length,
    retry: n.rows.reduce((sum, r) => sum + r.retries, 0),
    fail: n.rows.filter((r) => r.lastStatus === 'fail').length,
  };
}

// Nights on disk = runs/<YYYY-MM-DD>.jsonl, newest first.
export function nightsOnDisk(runsDir: string): string[] {
  try {
    return readdirSync(runsDir)
      .filter((f) => /^\d{4}-\d{2}-\d{2}\.jsonl$/.test(f))
      .map((f) => f.slice(0, 10))
      .sort()
      .reverse();
  } catch {
    return [];
  }
}

export function readStatus(config: RigConfig): Status {
  return {
    adapter: config.adapter,
    installed: config.installed,
    lastBeat: lastBeat(),
    nights: nightsOnDisk(config.runsDir).map((night) => ({ night, counts: nightCounts(config.runsDir, night) })),
  };
}
