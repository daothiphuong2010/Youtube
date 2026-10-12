// Thin AI adapter. The rest of the app only calls askJSON(settings, system, user).
// Swap provider = change settings; add a provider = add one function to PROVIDERS.

export const PRESETS = {
  'gemini-free': { provider: 'gemini', baseUrl: 'https://generativelanguage.googleapis.com', model: 'gemini-2.5-flash', free: true, rpm: 10, priceIn: 0, priceOut: 0 },
  'claude-haiku': { provider: 'anthropic', baseUrl: 'https://api.anthropic.com', model: 'claude-haiku-5-5', free: false, rpm: 50, priceIn: 0.10, priceOut: 0.50 },
  'custom': { provider: 'openai', baseUrl: '', model: '', free: false, rpm: 20, priceIn: 0, priceOut: 0 },
};
export const DEFAULT_PRESET = 'gemini-free';

export class AIError extends Error {
  constructor(msg, { retry = false, waitMs = 0 } = {}) { super(msg); this.retry = retry; this.waitMs = waitMs; }
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
    if (res.status === 429 && /PerDay/i.test(details + msg)) {
      throw new AIError('Hết lượt miễn phí hôm nay của model này. Phần đã xong được giữ lại; mai bấm chạy tiếp, hoặc đổi model trong ⚙️ Cài đặt.');
    }
    const delay = (details.match(/"retryDelay":"(\d+(?:\.\d+)?)s"/) || [])[1];
    const after = res.headers.get('retry-after');
    const waitMs = delay ? delay * 1000 : after ? (+after || 0) * 1000 : 0;
    const retry = res.status === 429 || res.status >= 500;
    const hint = res.status === 404 ? ' (tên model sai? bấm "Kiểm tra key" trong ⚙️ Cài đặt để xem model có sẵn)' : '';
    throw new AIError(`AI báo lỗi ${res.status}: ${msg}${hint}`, { retry, waitMs });
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
  const a = text.indexOf('{'), b = text.lastIndexOf('}');
  if (a < 0 || b < a) throw new AIError('AI không trả về JSON.');
  return JSON.parse(text.slice(a, b + 1));
}

const sleep = ms => new Promise(r => setTimeout(r, ms));
let lastCall = 0;

// Queue + pacing (requests per minute) + retry with backoff for free-tier limits.
// onWait(seconds, reason) lets the UI show "waiting".
export async function askJSON(s, system, user, maxTokens = 8000, { onWait = () => {}, tries = 7, wait = sleep } = {}) {
  if (!s.apiKey) throw new AIError('Chưa có API key. Mở ⚙️ Cài đặt để dán key.');
  const fn = PROVIDERS[s.provider];
  if (!fn) throw new AIError('Provider không hỗ trợ: ' + s.provider);
  for (let n = 1; ; n++) {
    const gap = 60000 / Math.max(1, +s.rpm || 10) - (Date.now() - lastCall);
    if (gap > 0) { onWait(Math.ceil(gap / 1000), 'giãn nhịp theo hạn mức'); await wait(gap); }
    lastCall = Date.now();
    try {
      const r = await fn(s, system, user, maxTokens);
      try {
        return { ...r, json: parseJSON(r.text) };
      } catch (e) {
        throw new AIError((r.truncated ? 'Câu trả lời bị cắt. ' : '') + 'JSON lỗi: ' + e.message, { retry: true });
      }
    } catch (e) {
      if (!(e instanceof AIError) || !e.retry || n >= tries) throw e;
      const ms = Math.min(120000, e.waitMs || 2000 * 2 ** n) + Math.random() * 1000;
      onWait(Math.ceil(ms / 1000), 'AI bận/hết hạn mức phút, thử lại lần ' + (n + 1));
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
