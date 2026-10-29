// Pacing for free-tier quotas, so a long run finishes instead of hammering the API:
// - requests/min and input tokens/min, kept to `target` (default 80%) of the limits over a
//   rolling 60 s window (a token bucket that can never burst past the per-minute limit);
// - after a 429 the rate drops (×0.6, min 25%) and creeps back (+5% per success);
// - requests/day counted per model until midnight Pacific (when Gemini resets the daily quota).
// Limits come from Settings; 0 = no limit. Pure logic: clock and storage are injectable for tests.

const MIN = 60000;
// Settings hold the target as a percent (80); accept a fraction (0.8) too.
const frac = v => { v = +v || 80; return Math.min(1, Math.max(0.1, v > 1 ? v / 100 : v)); };

const memStore = () => { const m = new Map(); return { get: k => m.get(k), set: (k, v) => m.set(k, v) }; };
export const localStore = {
  get: k => { try { return JSON.parse(localStorage.getItem(k)); } catch { return null; } },
  set: (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* ignore */ } },
};

// Calendar day in Pacific time ("2026-10-12") and ms until the next Pacific midnight.
export function pacificDay(t) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Los_Angeles', year: 'numeric', month: '2-digit', day: '2-digit' }).format(t);
}
export function nextPacificMidnight(t) {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-US', { timeZone: 'America/Los_Angeles', hourCycle: 'h23', hour: 'numeric', minute: 'numeric', second: 'numeric' })
    .formatToParts(t).map(x => [x.type, +x.value || 0]));
  const passed = (p.hour * 3600 + p.minute * 60 + p.second) * 1000 + (t % 1000);
  return t - passed + 24 * 3600 * 1000 + 5 * MIN; // +5 min margin (and covers DST shifts)
}

export class DayLimit extends Error {
  constructor(resumeAt, msg) { super(msg || 'Hết lượt hôm nay.'); this.resumeAt = resumeAt; }
}

export class Pacer {
  constructor({ model = '', rpm = 0, tpm = 0, rpd = 0, target = 80 } = {}, { now = Date.now, store = memStore() } = {}) {
    Object.assign(this, { model, rpm: +rpm || 0, tpm: +tpm || 0, rpd: +rpd || 0, target: frac(target), now, store });
    this.factor = 1;        // adaptive multiplier, lowered by 429s
    this.log = [];          // [{t, tok}] requests sent in the last minute
    this.pauseUntil = 0;    // server's retryDelay
    this.cpt = 2;           // characters per input token, learned from real responses
  }
  setLimits({ rpm, tpm, rpd, target }) {
    Object.assign(this, { rpm: +rpm || 0, tpm: +tpm || 0, rpd: +rpd || 0, target: frac(target) });
  }
  // Effective per-minute budgets right now.
  get rpmNow() { return this.rpm ? Math.max(1, this.rpm * this.target * this.factor) : Infinity; }
  get tpmNow() { return this.tpm ? this.tpm * this.target * this.factor : Infinity; }

  tokensFor(chars) { return Math.ceil(chars / this.cpt * 1.1); }

  get dayKey() { return 'ytscenes.day.' + this.model; }
  dayUsed() {
    const d = this.store.get(this.dayKey);
    return d && d.day === pacificDay(this.now()) ? d.n : 0;
  }
  dayLeft() { return this.rpd ? Math.max(0, this.rpd - this.dayUsed()) : Infinity; }
  exhaustDay() { this.store.set(this.dayKey, { day: pacificDay(this.now()), n: Math.max(this.rpd, this.dayUsed()) }); }
  resumeAt() { return nextPacificMidnight(this.now()); }

  // ms to wait before a request of `tok` input tokens may go (0 = now). Throws DayLimit.
  delay(tok, { ignoreDay = false } = {}) {
    const t = this.now();
    if (!ignoreDay && !this.dayLeft()) throw new DayLimit(this.resumeAt());
    this.log = this.log.filter(e => e.t > t - MIN);
    let at = Math.max(t, this.pauseUntil);
    // Requests: the oldest entries must leave the window until one more fits.
    const rLimit = Math.floor(this.rpmNow);
    if (this.log.length >= rLimit) at = Math.max(at, this.log[this.log.length - rLimit].t + MIN);
    // Tokens: drop oldest entries until this request fits (a request bigger than the whole
    // budget waits for an empty window, then goes alone).
    const budget = this.tpmNow;
    let sum = this.log.reduce((a, e) => a + e.tok, 0), k = 0;
    while (k < this.log.length && sum + tok > budget) { sum -= this.log[k].tok; at = Math.max(at, this.log[k].t + MIN); k++; }
    return Math.max(0, Math.ceil(at - t));
  }
  // Call right after delay() returned 0 (same tick).
  record(tok) {
    const e = { t: this.now(), tok };
    this.log.push(e);
    this.store.set(this.dayKey, { day: pacificDay(e.t), n: this.dayUsed() + 1 });
    return e;
  }
  onSuccess(entry, chars, realTok) {
    if (realTok > 0) { entry.tok = realTok; this.cpt = 0.7 * this.cpt + 0.3 * Math.max(0.8, Math.min(6, chars / realTok)); }
    this.factor = Math.min(1, this.factor + 0.05);
  }
  on429(waitMs = 0) {
    const d = this.store.get(this.dayKey); // a rejected call doesn't use the daily quota
    if (d && d.day === pacificDay(this.now()) && d.n > 0) this.store.set(this.dayKey, { ...d, n: d.n - 1 });
    this.factor = Math.max(0.25, this.factor * 0.6);
    this.pauseUntil = Math.max(this.pauseUntil, this.now() + (waitMs || 15000));
  }
  // Rough seconds per request at the current pace (for ETA), excluding the AI's own latency.
  secsPer(tok) {
    return Math.max(this.rpm ? 60 / this.rpmNow : 0, this.tpm ? 60 * tok / this.tpmNow : 0);
  }
}

// One pacer per model for the whole page, so parallel runs share the same budget.
const pacers = new Map();
export function pacerFor(s, opts) {
  const key = s.provider + ':' + s.model;
  if (!pacers.has(key)) pacers.set(key, new Pacer({ model: key, rpm: s.rpm, tpm: s.tpm, rpd: s.rpd, target: s.target }, opts || { store: localStore }));
  const p = pacers.get(key);
  p.setLimits(s);
  return p;
}
