// Where AI calls go. The app calls askAI() only; this module decides the route:
//   auto   = local router first (if configured and reachable), else the direct key (ai.js)
//   router = local router only
//   direct = the direct key only (Gemini by default; paced by pacer.js)
// A router is one object in ROUTERS ({label, defaults, call, check}); to swap in another
// OpenAI-compatible router, add an object and point settings.router at it.
import { askJSON, parseJSON, AIError } from './ai.js';

export const ROUTES = { auto: 'Tự động: FreeLLMAPI trước, lỗi thì dùng Gemini', router: 'Chỉ FreeLLMAPI', direct: 'Chỉ Gemini (key trực tiếp)' };
export const PAGE_ORIGIN = 'https://daothiphuong2010.github.io';

const trim = u => (u || '').replace(/\/+$/, '');
const sleep = ms => new Promise(r => setTimeout(r, ms));

// Router is down / refuses us: in auto mode the request goes to the direct key instead.
export class RouterDown extends Error {
  constructor(msg, kind) { super(msg); this.kind = kind; } // kind: offline | token | server | busy
}

async function timed(url, opts, ms) {
  const ac = new AbortController(), t = setTimeout(() => ac.abort(), ms);
  try { return await fetch(url, { ...opts, signal: ac.signal }); }
  finally { clearTimeout(t); }
}

const MSG = {
  offline: `Không kết nối được FreeLLMAPI. Kiểm tra: FreeLLMAPI đang chạy trên máy? Đã thêm ${PAGE_ORIGIN} vào DASHBOARD_ORIGINS? Chrome hỏi quyền "thiết bị trong mạng cục bộ" thì bấm Cho phép.`,
  token: 'FreeLLMAPI từ chối: sai token (token phải bắt đầu bằng "freellmapi-").',
};

export const ROUTERS = {
  freellmapi: {
    label: 'FreeLLMAPI',
    defaults: { routerUrl: 'http://localhost:3001/v1', routerModel: 'auto:smart' },

    // GET {base}/models: reachable? token right? 5 s timeout. Returns {ok, kind, text, models}.
    async check(s) {
      const base = trim(s.routerUrl || this.defaults.routerUrl);
      let res;
      try {
        res = await timed(base + '/models', { headers: { authorization: 'Bearer ' + (s.routerToken || '') } }, 5000);
      } catch {
        return { ok: false, kind: 'offline', text: '✗ ' + MSG.offline };
      }
      if (res.status === 401 || res.status === 403) return { ok: false, kind: 'token', text: '✗ ' + MSG.token };
      if (!res.ok) return { ok: false, kind: 'server', text: `✗ FreeLLMAPI báo lỗi ${res.status}.` };
      const d = await res.json().catch(() => ({}));
      const models = (d.data || d.models || []).map(m => m.id || m.name || m).filter(x => typeof x === 'string');
      const warn = /^freellmapi-/.test(s.routerToken || '') ? '' : ' (lưu ý: token thường bắt đầu bằng "freellmapi-")';
      return { ok: true, kind: 'ok', models, text: `✓ Kết nối được FreeLLMAPI · ${models.length} model${warn}` };
    },

    // POST {base}/chat/completions (OpenAI format). The router may take long to answer, so the
    // 5 s timeout applies to reaching it (a quick /models probe, remembered for a minute).
    async call(s, system, user, maxTokens) {
      if (!(await reachable(this, s))) throw new RouterDown(MSG.offline, 'offline');
      const base = trim(s.routerUrl || this.defaults.routerUrl);
      const body = {
        model: s.routerModel || this.defaults.routerModel,
        messages: [{ role: 'system', content: system }, { role: 'user', content: user }],
        max_tokens: maxTokens,
        response_format: { type: 'json_object' },
      };
      for (let n = 0; ; n++) {
        let res;
        try {
          res = await timed(base + '/chat/completions', {
            method: 'POST', headers: { 'content-type': 'application/json', authorization: 'Bearer ' + (s.routerToken || '') }, body: JSON.stringify(body),
          }, 300000);
        } catch {
          probe.delete(base);
          throw new RouterDown(MSG.offline, 'offline');
        }
        if (res.status === 401 || res.status === 403) throw new RouterDown(MSG.token, 'token');
        if (res.status === 400 && body.response_format && n === 0) { delete body.response_format; continue; } // model without JSON mode
        if (res.status === 429 && n < 3) { await sleep(Math.min(60, +res.headers.get('retry-after') || 10) * 1000); continue; }
        if (res.status === 429) throw new RouterDown('FreeLLMAPI đang hết lượt ở mọi nhà cung cấp.', 'busy');
        if (res.status >= 500) throw new RouterDown(`FreeLLMAPI báo lỗi ${res.status}.`, 'server');
        const d = await res.json().catch(() => ({}));
        if (!res.ok) throw new AIError(`FreeLLMAPI báo lỗi ${res.status}: ${d.error?.message || res.statusText}`);
        const c = d.choices?.[0];
        return { text: c?.message?.content || '', inTok: d.usage?.prompt_tokens || 0, outTok: d.usage?.completion_tokens || 0,
          truncated: c?.finish_reason === 'length', model: d.model || body.model };
      }
    },
  },
};

const probe = new Map(); // base URL -> {ok, at}
async function reachable(router, s) {
  const base = trim(s.routerUrl || router.defaults.routerUrl);
  const p = probe.get(base);
  if (p && Date.now() - p.at < 60000) return p.ok;
  const r = await router.check(s);
  if (r.kind === 'token') throw new RouterDown(MSG.token, 'token');
  probe.set(base, { ok: r.ok, at: Date.now() });
  return r.ok;
}

export const routerOf = s => ROUTERS[s.router || 'freellmapi'];
export const routeOf = s => (ROUTES[s.aiRoute] ? s.aiRoute : 'auto');
// Is the router part of this run? (auto only once a token is filled in)
export const usesRouter = s => routeOf(s) === 'router' || (routeOf(s) === 'auto' && !!s.routerToken);

// One AI call returning {json, text, inTok, outTok, model, via}. via = 'router' | 'direct'.
// opts are askJSON's (pacer, onWait, ignoreDay…) plus onRoute(via, why) to show the badge.
export async function askAI(s, system, user, maxTokens = 8000, opts = {}) {
  const { onRoute = () => {} } = opts;
  const direct = async why => {
    onRoute('direct', why);
    const r = await askJSON(s, system, user, maxTokens, opts);
    return { ...r, model: r.model || s.model, via: 'direct' };
  };
  if (!usesRouter(s)) return direct('');
  const router = routerOf(s);
  for (let bad = 0; ; bad++) {
    try {
      const r = await router.call(s, system, user, maxTokens);
      onRoute('router', '');
      try {
        return { ...r, json: parseJSON(r.text), via: 'router' };
      } catch (e) {
        if (bad < 1) continue; // one more try on broken JSON
        throw new RouterDown('FreeLLMAPI trả về JSON lỗi: ' + e.message, 'server');
      }
    } catch (e) {
      if (!(e instanceof RouterDown) || routeOf(s) === 'router') throw e instanceof RouterDown ? new AIError(e.message) : e;
      return direct(e.message);
    }
  }
}

export const checkRouter = s => routerOf(s).check(s);
export const forgetProbe = () => probe.clear();
