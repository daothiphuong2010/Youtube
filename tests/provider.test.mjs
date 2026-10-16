import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { askAI, checkRouter, forgetProbe, usesRouter } from '../app/js/ai-provider.js';
import { Pacer } from '../app/js/pacer.js';
import { AIError } from '../app/js/ai.js';

const base = { provider: 'gemini', baseUrl: 'https://gem', model: 'gemini-2.5-flash', apiKey: 'k', routerUrl: 'http://localhost:3001/v1', routerModel: 'auto:smart' };
const gemOk = () => new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: '{"from":"gemini"}' }] } }], usageMetadata: { promptTokenCount: 5 } }), { status: 200 });
const routerOk = (model = 'groq/llama-3.3-70b') => new Response(JSON.stringify({ model, choices: [{ message: { content: '{"from":"router"}' }, finish_reason: 'stop' }], usage: { prompt_tokens: 7, completion_tokens: 3 } }), { status: 200 });
const models = () => new Response(JSON.stringify({ data: [{ id: 'auto:smart' }, { id: 'auto:fast' }] }), { status: 200 });
const opts = () => ({ pacer: new Pacer({}), wait: async () => {} });
let log;
const mock = handler => { log = []; globalThis.fetch = async (url, o = {}) => { log.push({ url: String(url), o }); return handler(String(url), o); }; };
beforeEach(() => forgetProbe());

test('no token in auto mode: straight to Gemini, router untouched', async () => {
  mock(url => (url.startsWith('https://gem') ? gemOk() : assert.fail('router called')));
  const r = await askAI({ ...base, aiRoute: 'auto', routerToken: '' }, 's', 'u', 100, opts());
  assert.equal(r.via, 'direct');
  assert.deepEqual(r.json, { from: 'gemini' });
  assert.equal(usesRouter({ aiRoute: 'auto', routerToken: '' }), false);
});

test('auto with router up: OpenAI format, Bearer token, model reported', async () => {
  mock(url => (url.endsWith('/models') ? models() : url.endsWith('/chat/completions') ? routerOk() : assert.fail(url)));
  const routes = [];
  const r = await askAI({ ...base, routerToken: 'freellmapi-abc' }, 'sys', 'user', 100, { ...opts(), onRoute: v => routes.push(v) });
  assert.equal(r.via, 'router');
  assert.equal(r.model, 'groq/llama-3.3-70b');
  assert.deepEqual(r.json, { from: 'router' });
  const call = log.find(x => x.url.endsWith('/chat/completions'));
  assert.equal(call.url, 'http://localhost:3001/v1/chat/completions');
  assert.equal(call.o.headers.authorization, 'Bearer freellmapi-abc');
  const body = JSON.parse(call.o.body);
  assert.equal(body.model, 'auto:smart');
  assert.deepEqual(body.messages.map(m => m.role), ['system', 'user']);
  assert.deepEqual(routes, ['router']);
});

for (const [name, handler] of [
  ['offline (network/CORS)', url => { if (url.includes('localhost')) throw new TypeError('Failed to fetch'); return gemOk(); }],
  ['401 wrong token', url => (url.endsWith('/models') ? models() : url.includes('localhost') ? new Response('{}', { status: 401 }) : gemOk())],
  ['5xx', url => (url.endsWith('/models') ? models() : url.includes('localhost') ? new Response('{}', { status: 502 }) : gemOk())],
]) {
  test(`auto falls back to Gemini on ${name}, shows why`, async () => {
    mock(handler);
    const routes = [];
    const r = await askAI({ ...base, routerToken: 'freellmapi-abc' }, 's', 'u', 100, { ...opts(), onRoute: (v, why) => routes.push([v, why]) });
    assert.equal(r.via, 'direct');
    assert.deepEqual(r.json, { from: 'gemini' });
    assert.equal(routes.at(-1)[0], 'direct');
    assert.ok(routes.at(-1)[1].length > 0);
  });
}

test('router-only mode never falls back; error is readable Vietnamese', async () => {
  mock(url => { if (url.includes('localhost')) throw new TypeError('Failed to fetch'); assert.fail('gemini called'); });
  await assert.rejects(askAI({ ...base, aiRoute: 'router', routerToken: 'freellmapi-abc' }, 's', 'u', 100, opts()), e => e instanceof AIError && /DASHBOARD_ORIGINS/.test(e.message));
});

test('router without JSON mode: retries once without response_format', async () => {
  let n = 0;
  mock(url => (url.endsWith('/models') ? models() : ++n === 1 ? new Response('{"error":{"message":"response_format unsupported"}}', { status: 400 }) : routerOk()));
  const r = await askAI({ ...base, routerToken: 'freellmapi-abc' }, 's', 'u', 100, opts());
  assert.equal(r.via, 'router');
  assert.equal(JSON.parse(log.at(-1).o.body).response_format, undefined);
});

test('check connection: OK / not reachable / wrong token', async () => {
  mock(() => models());
  let r = await checkRouter({ routerToken: 'freellmapi-x' });
  assert.ok(r.ok && /Kết nối được/.test(r.text) && r.models.length === 2);
  mock(() => { throw new TypeError('Failed to fetch'); });
  r = await checkRouter({ routerToken: 'freellmapi-x' });
  assert.ok(!r.ok && r.kind === 'offline' && /Cho phép/.test(r.text));
  mock(() => new Response('{}', { status: 401 }));
  r = await checkRouter({ routerToken: 'sai' });
  assert.ok(!r.ok && r.kind === 'token' && /sai token/.test(r.text));
});
