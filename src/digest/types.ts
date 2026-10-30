// Plan morning-digest § 1. The contract every part of § 2 starts against: one row per job for
// one night of `runs/<night>.jsonl`.

export type RunStatus = 'ok' | 'retry' | 'fail';

// One line of the run log, after parsing.
export type RunLine = {
  at: string;
  job: string;
  status: RunStatus;
  owner: string | null;
  error?: string;
};

export type DigestRow = {
  job: string;
  // `null` in the log stays `null` here; views render it as `—`.
  owner: string | null;
  // Lines for this job, of any status.
  runs: number;
  // Lines with status `retry`.
  retries: number;
  lastStatus: RunStatus;
  // `error` of the last line that had one, or `null`.
  lastError: string | null;
  // `at` as written in the log, offset kept (styleguide: never convert to UTC).
  firstAt: string;
  lastAt: string;
};

export type Night = {
  night: string;
  // Sorted by job.
  rows: DigestRow[];
  // Lines that didn't parse or didn't match `RunLine`. Counted, never thrown.
  badLines: number;
};

// `null` when `<runsDir>/<night>.jsonl` doesn't exist (routes answer 404). An empty file is a
// `Night` with no rows ("nothing ran").
export type ReadNight = (runsDir: string, night: string) => Night | null;
