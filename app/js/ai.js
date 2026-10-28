// Thin AI adapter. The rest of the app only calls askJSON(settings, system, user).
// Swap provider = change settings; add a provider = add one function to PROVIDERS.
import { pacerFor, DayLimit } from './pacer.js';
export { DayLimit };

// rpm/tpm/rpd = requests per minute, input tokens per minute, requests per day (0 = no limit).
// Prefilled guesses, editable in Settings: Google doesn't publish free-tier numbers; each key's
// real limits are at https://aistudio.google.com/rate-limit . target = % of the limits to use.
export const PRESETS = {
  'gemini-free': { provider: 'gemini', baseUrl: 'https://generativelanguage.googleapis.com', model: 'gemini-2.5-flash', free: true, rpm: 5, tpm: 250000, rpd: 20, target: 80, priceIn: 0, priceOut: 0 },
  'claude-haiku': { provider: 'anthropic', baseUrl: 'https://api.anthropic.com', model: 'claude-haiku-5-5', free: false, rpm: 50, tpm: 50000, rpd: 0, target: 80, priceIn: 0.10, priceOut: 0.50 },
  'custom': { provider: 'openai', baseUrl: '', model: '', free: false, rpm: 20, tpm: 0, rpd: 0, target: 80, priceIn: 0, priceOut: 0 },
};
export const DEFAULT_PRESET = 'gemini-free';

export class AIError extends Error {
  constructor(msg, { retry = false, waitMs = 0, status = 0, daily = false } = {}) {
    super(msg); Object.assign(this, { retry, waitMs, status, daily });
  }
}

const trim = u => (u || '').replace(/\/$/, '');

async function post(url, headers, body) {
  let res;
  try {
    res = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json', ...headers }, body: JSON.stringify(body) });
  } catch (e) {
    throw new AIError('Không kết nối được tới AI (mạng?): ' + e.message, { retry: true });
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = data?.error || data?.[0]?.error || {};
    const msg = err.message || res.statusText;
    const details = JSON.stringify(err.details || '');
    const delay = (details.match(/"retryDelay":"(\d+(?:\.\d+)?)s"/) || [])[1];
    const after = res.headers.get('retry-after');
    const waitMs = delay ? delay * 1000 : after ? (+after || 0) * 1000 : 0;
    if (res.status === 429 && /PerDay/i.test(details + msg)) {
      throw new AIError('Hết lượt miễn phí hôm nay của model này.', { status: 429, daily: true, waitMs });
    }
    const retry = res.status === 429 || res.status >= 500;
    const hint = res.status === 404 ? ' (tên model sai? bấm "Kiểm tra key" trong ⚙️ Cài đặt để xem model có sẵn)' : '';
    throw new AIError(`AI báo lỗi ${res.status}: ${msg}${hint}`, { retry, waitMs, status: res.status });
  }
  return data;
}

async function gemini(s, system, user, maxTokens) {
  const d = await post(`${trim(s.baseUrl)}/v1beta/models/${encodeURIComponent(s.model)}:generateContent`,
    { 'x-goog-api-key': s.apiKey }, {
      systemInstruction: { parts: [{ text: system }] },
      contents: [{ role: 'user', parts: [{ text: user }] }],
      generationConfig: { responseMimeType: 'application/json', maxOutputTokens: Math.max(maxTokens, 8192) },
    });
  const c = d.candidates?.[0];
  if (!c && d.promptFeedback?.blockReason) throw new AIError('Gemini chặn đoạn này: ' + d.promptFeedback.blockReason);
  const text = (c?.content?.parts || []).map(p => p.text || '').join('');
  const u = d.usageMetadata || {};
  return { text, inTok: u.promptTokenCount || 0, outTok: (u.candidatesTokenCount || 0) + (u.thoughtsTokenCount || 0), truncated: c?.finishReason === 'MAX_TOKENS' };
}

async function anthropic(s, system, user, maxTokens) {
  const body = {
    model: s.model, max_tokens: maxTokens, system,
    messages: [{ role: 'user', content: user }],
    output_config: { effort: 'low' },
  };
  if (/haiku/.test(s.model)) body.thinking = { type: 'disabled' };
  const d = await post(trim(s.baseUrl) + '/v1/messages', {
    'x-api-key': s.apiKey,
    'anthropic-version': '2023-06-01',
    'anthropic-dangerous-direct-browser-access': 'true',
  }, body);
  if (d.stop_reason === 'refusal') throw new AIError('AI từ chối xử lý đoạn này.');
  const text = (d.content || []).filter(b => b.type === 'text').map(b => b.text).join('');
  return { text, inTok: d.usage?.input_tokens || 0, outTok: d.usage?.output_tokens || 0, truncated: d.stop_reason === 'max_tokens' };
}

async function openai(s, system, user, maxTokens) {
  const body = {
    model: s.model,
    response_format: { type: 'json_object' },
    messages: [{ role: 'system', content: system }, { role: 'user', content: user }],
  };
  // OpenAI's newer models want max_completion_tokens; most compatible APIs want max_tokens.
  body[/api\.openai\.com/.test(s.baseUrl) ? 'max_completion_tokens' : 'max_tokens'] = maxTokens;
  const d = await post(trim(s.baseUrl) + '/chat/completions', { authorization: 'Bearer ' + s.apiKey }, body);
  const c = d.choices?.[0];
  return { text: c?.message?.content || '', inTok: d.usage?.prompt_tokens || 0, outTok: d.usage?.completion_tokens || 0, truncated: c?.finish_reason === 'length' };
}

const PROVIDERS = { gemini, anthropic, openai };

// Pull the first JSON object out of a reply (tolerates ```json fences).
export function parseJSON(text) {
  // Braces inside strings/prose must not expand a valid JSON reply.
  const objects = [];
  let start = -1, depth = 0, quoted = false, escaped = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (start < 0) { if (c !== '{') continue; start = i; }
    if (quoted) {
      if (escaped) escaped = false;
      else if (c === '\\') escaped = true;
      else if (c === '"') quoted = false;
    } else if (c === '"') quoted = true;
    else if (c === '{') depth++;
    else if (c === '}' && --depth === 0) {
      objects.push(JSON.parse(text.slice(start, i + 1))); start = -1;
    }
  }
  if (objects.length > 1) throw new AIError('AI trả về nhiều đối tượng JSON; cần một đối tượng duy nhất.');
  if (!objects.length || start >= 0) throw new AIError('AI không trả về JSON đầy đủ.');
  return objects[0];
}

const sleep = ms => new Promise(r => setTimeout(r, ms));

// Paced call with retries. The pacer (one per model) keeps requests and input tokens per minute
// under the limits; a 429 honors the server's retryDelay and slows the pace; other transient
// errors back off exponentially. A daily-quota stop throws DayLimit (with resumeAt).
// onWait(seconds, reason) lets the UI show "waiting".
export async function askJSON(s, system, user, maxTokens = 8000, { onWait = () => {}, tries = 6, wait = sleep, pacer = pacerFor(s), ignoreDay = false } = {}) {
  if (!s.apiKey) throw new AIError('Chưa có API key. Mở ⚙️ Cài đặt để dán key.');
  const fn = PROVIDERS[s.provider];
  if (!fn) throw new AIError('Provider không hỗ trợ: ' + s.provider);
  const chars = system.length + user.length;
  let fails = 0, limited = 0;
  for (;;) {
    const tok = pacer.tokensFor(chars);
    for (let d; (d = pacer.delay(tok, { ignoreDay })) > 0;) {
      onWait(Math.ceil(d / 1000), limited ? 'AI báo quá tải, đang giãn nhịp' : 'giữ dưới hạn mức mỗi phút');
      await wait(Math.min(d, 30000)); // re-check at least every 30 s
    }
    const entry = pacer.record(tok);
    try {
      const r = await fn(s, system, user, maxTokens);
      pacer.onSuccess(entry, chars, r.inTok);
      try {
        return { ...r, json: parseJSON(r.text) };
      } catch (e) {
        throw new AIError((r.truncated ? 'Câu trả lời bị cắt. ' : '') + 'JSON lỗi: ' + e.message, { retry: true });
      }
    } catch (e) {
      if (e instanceof AIError && e.daily) {
        pacer.exhaustDay();
        throw new DayLimit(Math.max(pacer.resumeAt(), pacer.now() + (e.waitMs || 0)), e.message);
      }
      if (e instanceof AIError && e.status === 429) {
        // Per-minute limit: wait as told, slow down, try again (no fixed cap; the pacer spaces it).
        if (++limited > 40) throw e;
        pacer.on429(e.waitMs);
        continue;
      }
      if (!(e instanceof AIError) || !e.retry || ++fails >= tries) throw e;
      const ms = Math.min(120000, 2000 * 2 ** fails) + Math.random() * 1000;
      onWait(Math.ceil(ms / 1000), 'AI lỗi tạm thời, thử lại lần ' + (fails + 1));
      await wait(ms);
    }
  }
}

// Validate a key and list usable models (Gemini only; others return []).
export async function listModels(s) {
  if (s.provider !== 'gemini' || !s.apiKey) return [];
  const r = await fetch(`${trim(s.baseUrl)}/v1beta/models?pageSize=200`, { headers: { 'x-goog-api-key': s.apiKey } });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new AIError('Key không dùng được: ' + (d.error?.message || r.status));
  return (d.models || []).filter(m => (m.supportedGenerationMethods || []).includes('generateContent'))
    .map(m => m.name.replace(/^models\//, ''));
}
