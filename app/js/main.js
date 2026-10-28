// App wiring: input (bookmarklet message / drop / paste), story page, AI run, settings, shelf.
import { h } from './dom.js';
import { clean, parseText, parseClock } from './cleanup.js';
import { runSections, makeWindows, partialSections, estimate } from './scenes.js';
import { modeOf, DEFAULT_MODE, MODES } from './modes.js';
import { listModels, PRESETS, DayLimit } from './ai.js';
import { askAI, checkRouter, usesRouter, forgetProbe } from './ai-provider.js';
import { pacerFor } from './pacer.js';
import { fillTimes, makeBlocks } from './algo.js';
import { parseGlossary } from './glossary.js';
import { castFor, castGlossary, parseCharacters, mergeCharacters, castUser } from './names.js';
import { loadSettings, saveSettings, getStory, putStory, patchStory, deleteStory, listStories, listJobs, storyId } from './store.js';
import { renderStory } from './view.js';

const view = document.getElementById('view');
const YT_ORIGINS = ['https://www.youtube.com', 'https://m.youtube.com', 'https://youtube.com'];
let settings = loadSettings();
const plainGlossary = () => parseGlossary(settings.glossary);
// Misheard words + character aliases: what search, free keywords and the AI all use.
const glossary = () => [...plainGlossary(), ...castGlossary(parseCharacters(settings.characters).list)];

// ---------- input ----------
let handled = null;
addEventListener('message', e => {
  if (!YT_ORIGINS.includes(e.origin) || e.data?.type !== 'ytscenes:transcript') return;
  e.source?.postMessage({ type: 'ytscenes:ack' }, e.origin);
  if (handled === e.data.nonce) return; // the bookmarklet re-sends until it gets the ack
  handled = e.data.nonce;
  openInput(e.data.meta || {}, e.data.segments || []);
});

async function openInput(meta, segments) {
  const sents = clean(segments);
  if (!sents.length) return home('Bản chép lời trống sau khi làm sạch.');
  const id = storyId(meta.videoId, sents.map(s => s.text).join(' '));
  const old = await getStory(id).catch(() => null);
  // One generic record per video; see README "Data format".
  if (!old) {
    await putStory({ id, video_id: meta.videoId || null, title: meta.title || '', channel: meta.channel || '', url: meta.url || '',
      duration: meta.duration || null, mode: DEFAULT_MODE, segments: sents, createdAt: Date.now(), updatedAt: Date.now() });
  }
  go(id);
}
const go = id => { location.hash = 'id=' + encodeURIComponent(id); };

function readFile(file) {
  file.text().then(txt => openInput({ title: file.name.replace(/\.[^.]+$/, '') }, parseText(txt)));
}

export function parseVideoId(url) {
  const m = String(url).match(/(?:youtu\.be\/|[?&]v=|\/shorts\/|\/live\/|\/embed\/)([\w-]{11})/);
  return m ? m[1] : (/^[\w-]{11}$/.test(String(url).trim()) ? String(url).trim() : null);
}

// ---------- screens ----------
function bookmarkletHref() {
  return fetch('bookmarklet.js').then(r => r.text()).then(src =>
    'javascript:' + encodeURIComponent(src.replaceAll('__APP__', () => new URL('./', location.href).href)));
}

async function home(error) {
  const link = h('a', { class: 'bookmarklet', href: '#', onclick: e => { e.preventDefault(); alert('Đừng bấm ở đây — hãy KÉO nút này lên thanh dấu trang (bookmark bar).'); } }, '🎬 YT Scenes');
  bookmarkletHref().then(href => { link.href = href; });
  const drop = h('div', { class: 'drop' }, 'Hoặc kéo thả file .txt bản chép lời vào đây');
  drop.addEventListener('dragover', e => { e.preventDefault(); drop.classList.add('over'); });
  drop.addEventListener('dragleave', () => drop.classList.remove('over'));
  drop.addEventListener('drop', e => { e.preventDefault(); drop.classList.remove('over'); const f = e.dataTransfer.files[0]; if (f) readFile(f); });
  const paste = h('textarea', { rows: 4, placeholder: '…hoặc dán bản chép lời vào đây' });
  const shelf = h('ul', { class: 'shelf' });
  listStories().then(items => shelf.replaceChildren(...(items.length ? items.map(it => h('li', {},
    h('a', { href: '#id=' + encodeURIComponent(it.id) }, `${it.overview ? it.overview.score + '/10 · ' : ''}${it.title || it.id}`),
    it.aiJob ? h('span', { class: 'muted' }, ' · ' + (jobs.has(it.id) || it.aiJob.state === 'running' ? `⏳ AI đang chạy (xong ${it.nParts} phần)`
      : it.aiJob.state === 'day' ? `⏸ AI tiếp tục lúc ${fmtWhen(it.aiJob.resumeAt)}` : '⚠️ AI tạm dừng, mở để chạy tiếp')) : null,
    h('span', { class: 'muted' }, ` · ${it.channel ? it.channel + ' · ' : ''}${it.nSections ? it.nSections + ' ' + modeOf(it).unit + ' AI' : 'chỉ phần miễn phí'} `),
    h('button', { onclick: async () => { if (confirm('Xóa truyện này khỏi máy?')) { await deleteStory(it.id); home(); } } }, '🗑')))
    : [h('li', { class: 'muted' }, 'Chưa có truyện nào.')]))).catch(() => {});
  view.replaceChildren(
    h('div', {}, error ? h('p', { class: 'err' }, error) : null),
    h('div', { class: 'card stack' },
      h('h2', {}, '1 lần duy nhất'), h('div', {}, 'Kéo nút này lên thanh dấu trang của Chrome (Ctrl+Shift+B để hiện thanh):'),
      h('div', {}, link),
      h('h2', {}, 'Mỗi lần dùng'), h('div', {}, 'Mở video YouTube → bấm dấu trang 🎬 YT Scenes → trang này tự mở, có ngay mục lục từ khóa miễn phí. Muốn chia cảnh + chấm điểm: bấm nút AI (Gemini miễn phí).')),
    h('div', { class: 'card stack' }, drop, paste,
      h('div', { class: 'row' }, h('span', { class: 'grow' }), h('button', { onclick: () => paste.value.trim() && openInput({ title: 'Dán tay' }, parseText(paste.value)) }, 'Dùng đoạn đã dán'))),
    h('div', { class: 'card' }, h('h2', {}, '📚 Kệ truyện'), shelf));
}

// ---------- AI jobs ----------
// One job per story. It keeps running if you go back to the shelf (the tab must stay open, in
// the background is fine). Progress is saved on the story after every chunk (parts + aiJob), so
// a closed tab or an empty daily quota never loses finished chunks: the next page open resumes.
const jobs = new Map();   // story id -> {progress()}
const timers = new Map(); // story id -> timer that resumes after the daily quota resets
let screen = null;        // {id, api} of the story on screen
const report = (id, fn) => { if (screen?.id === id) fn(screen.api); };
const fmtWhen = t => { const d = new Date(t), p = n => String(n).padStart(2, '0'); return `${p(d.getHours())}:${p(d.getMinutes())} ngày ${d.getDate()}/${d.getMonth() + 1}`; };
const fmtDur = sec => (sec < 90 ? `${Math.round(sec)} giây` : sec < 5400 ? `${Math.round(sec / 60)} phút` : `${(sec / 3600).toFixed(1)} giờ`);
const pausedText = (job, done, total) => `⏸ Hết lượt miễn phí hôm nay (đã xong ${done}/${total}). Tiếp tục lúc ${fmtWhen(job.resumeAt)}: tự chạy nếu trang đang mở, hoặc khi bạn mở lại trang.`;

function schedule(rec) {
  clearTimeout(timers.get(rec.id));
  if (rec.aiJob?.state !== 'day') return;
  timers.set(rec.id, setTimeout(() => getStory(rec.id).then(r => r && !r.sections && run(r)), Math.max(0, rec.aiJob.resumeAt - Date.now())));
}

async function run(rec, { ignoreDay = false } = {}) {
  if (jobs.has(rec.id)) return;
  const job = {};
  jobs.set(rec.id, job);
  // Only one tab works on a story at a time (two open tabs would double the requests).
  const locked = fn => (navigator.locks ? navigator.locks.request('ytscenes:' + rec.id, { ifAvailable: true }, l => (l ? fn() : null)) : fn());
  try { await locked(() => work(rec, job, ignoreDay)); }
  catch (e) { report(rec.id, a => a.status('⚠️ ' + e.message)); }
  finally { jobs.delete(rec.id); report(rec.id, a => a.running(false)); }
}

async function work(rec, job, ignoreDay) {
  clearTimeout(timers.get(rec.id));
  const s = { ...settings };
  const sents = fillTimes(rec.segments, rec.duration);
  const winMin = rec.winMin || +s.winMin || 60; // fixed per story, so a resume lines up with saved chunks
  const total = makeWindows(sents, winMin).length + 1;
  const pacer = pacerFor(s);
  const est = estimate(sents, { ...s, winMin });
  const parts = rec.parts ? [...rec.parts] : [];
  let usage = { ...(rec.usage || {}) };
  const n0 = parts.filter(Boolean).length, t0 = Date.now();
  const answeredBy = [...(rec.answeredBy || [])]; // [n] = {via, model}: which AI answered each chunk
  let done = n0, cur = n0;
  let storageFailed = false;
  const save = async patch => {
    try { Object.assign(rec, await patchStory(rec.id, patch)); }
    catch { storageFailed = true; throw Error('Không lưu được tiến độ vào máy. AI đã dừng; giữ tab mở và sao lưu trước khi thử lại.'); }
  };
  await save({ winMin, aiJob: { state: 'running' } });
  const status = t => report(rec.id, a => a.status(t));
  job.progress = () => {
    const left = total - done;
    const per = done > n0 ? (Date.now() - t0) / 1000 / (done - n0) : est.minutes * 60 / est.requests;
    const dayLeft = ignoreDay || usesRouter(s) ? Infinity : pacer.dayLeft(); // the router has its own quotas
    const eta = left > dayLeft ? `cần thêm ${Math.ceil((left - dayLeft) / Math.max(1, pacer.rpd))} ngày nữa (hạn mức ${pacer.rpd} lượt/ngày)` : `còn khoảng ${fmtDur(left * per)}`;
    report(rec.id, a => { a.running(true); a.progress(done, total, eta); });
    document.title = `(${done}/${total}) ${rec.title || 'Video'} · YT Scenes`;
  };
  const ask = async (sys, user, max) => {
    const r = await askAI(s, sys, user, max, { pacer, ignoreDay, onWait: (sec, why) => status(`Đang chờ ${sec}s (${why})…`),
      onRoute: (via, why) => report(rec.id, a => a.route(via, why)) });
    answeredBy[cur] = { via: r.via, model: r.model };
    report(rec.id, a => a.answered(answeredBy));
    return r;
  };
  try {
    const res = await runSections({
      sents, rec, mode: modeOf(rec), ask, glossary: glossary(), winMin,
      saved: { parts, inTok: usage.inTok, outTok: usage.outTok },
      onProgress: n => { done = cur = n; job.progress(); status(n < total - 1 ? `Đang gửi phần ${n + 1}/${total - 1}…` : 'Đang viết tóm tắt + chấm điểm…'); },
      onWindow: async (n, part, u) => {
        parts[n] = part; usage = { ...u }; done = n + 1;
        await save({ parts, usage, answeredBy });
        report(rec.id, a => a.sections(partialSections(sents, parts, winMin)));
        job.progress();
      },
    });
    res.usage.free = !!s.free;
    res.usage.usd = s.free ? 0 : (res.usage.inTok * s.priceIn + res.usage.outTok * s.priceOut) / 1e6;
    await save({ ...res, glossary: glossary(), model: s.model, answeredBy, parts: undefined, aiJob: undefined });
    document.title = (rec.title || 'Video') + ' · YT Scenes';
    if (screen?.id === rec.id) show(rec);
  } catch (e) {
    if (storageFailed) { status('⚠️ ' + e.message); return; }
    if (e instanceof DayLimit) {
      await save({ aiJob: { state: 'day', resumeAt: e.resumeAt } });
      schedule(rec);
      status(pausedText(rec.aiJob, done, total));
      report(rec.id, a => a.paused());
    } else {
      await save({ aiJob: { state: 'error', message: e.message } });
      status('⚠️ ' + e.message + ' (phần đã xong được giữ lại; bấm "Chạy tiếp AI" để chạy tiếp)');
    }
  }
}

// One AI call: sampled excerpts -> [{name, aliases, role}] merged into the Settings list.
async function aiCast(rec, sents, people) {
  const say = t => report(rec.id, a => a.castStatus(t));
  const s = { ...settings };
  const sys = modeOf(rec).castSystem || MODES.fanfic.castSystem;
  say('Đang gửi vài đoạn trích cho AI (1 lượt)…');
  try {
    const r = await askAI(s, sys, castUser(sents, people.detected), 3000, { pacer: pacerFor(s), onWait: (sec, why) => say(`Đang chờ ${sec}s (${why})…`),
      onRoute: (via, why) => report(rec.id, a => a.route(via, why)) });
    const found = Array.isArray(r.json?.characters) ? r.json.characters : [];
    settings = { ...settings, characters: mergeCharacters(settings.characters, found) };
    saveSettings(settings);
    if (screen?.id === rec.id) { show(rec); report(rec.id, a => a.castStatus(`✓ AI tìm được ${found.length} nhân vật, đã thêm vào danh sách (⚙️ Cài đặt → Nhân vật để sửa).`)); }
  } catch (e) {
    say(e instanceof DayLimit ? `⏸ Hết lượt hôm nay. Thử lại sau ${fmtWhen(e.resumeAt)}.` : '⚠️ ' + e.message);
  }
}

// On page open: resume runs that were interrupted or are waiting for a new day.
async function resumeJobs() {
  for (const r of await listJobs().catch(() => [])) {
    // With the local router on, a run paused by Gemini's daily quota can try again right away.
    if (r.aiJob.state === 'running' || (r.aiJob.state === 'day' && (r.aiJob.resumeAt <= Date.now() || usesRouter(settings)))) run(r);
    else schedule(r);
  }
}

let shown = null; // {rec, people} of the story on screen (Settings can copy its detected names)

function show(rec) {
  const sents = fillTimes(rec.segments, rec.duration);
  const blocks = makeBlocks(sents);
  const people = { blocks, ...castFor(sents, blocks, settings.characters, plainGlossary()) };
  shown = { rec, people, sents };
  const api = renderStory(view, rec, sents, {
    settings, people,
    castActions: {
      hide: name => { settings = { ...settings, characters: ((settings.characters || '').trim() + '\n- ' + name).trim() }; saveSettings(settings); show(rec); },
      edit: () => openSettings('characters'),
      ai: () => aiCast(rec, sents, people),
    },
    partial: rec.sections ? null : partialSections(sents, rec.parts, rec.winMin || settings.winMin),
    saveMeta: async (url, dur) => {
      const videoId = parseVideoId(url);
      const sec = /^\d+(:\d{1,2}){0,2}$/.test(dur.trim()) ? parseClock(dur) : null;
      show(await patchStory(rec.id, { url: url.trim(), durationText: dur.trim(), ...(videoId ? { video_id: videoId } : {}), ...(sec ? { duration: sec } : {}) }));
    },
    runAI: opts => getStory(rec.id).then(r => run(r || rec, opts)),
  });
  screen = { id: rec.id, api };
  document.title = (rec.title || 'Video') + ' · YT Scenes';
  if (jobs.has(rec.id)) jobs.get(rec.id).progress?.();
  else if (rec.aiJob?.state === 'day') {
    api.status(pausedText(rec.aiJob, rec.parts?.filter(Boolean).length || 0, makeWindows(sents, rec.winMin || settings.winMin).length + 1));
    api.paused();
  }
  else if (rec.aiJob?.state === 'error') api.status('⚠️ Lần trước dừng vì: ' + rec.aiJob.message);
}

// ---------- routing ----------
async function route() {
  const m = location.hash.match(/^#id=(.+)$/);
  if (!m) { screen = null; shown = null; return home(); }
  const story = await getStory(decodeURIComponent(m[1])).catch(() => null);
  if (!story) return home('Không tìm thấy truyện này trong máy.');
  show(story);
}
addEventListener('hashchange', route);
document.addEventListener('dragover', e => e.preventDefault());
document.addEventListener('drop', e => { e.preventDefault(); const f = e.dataTransfer?.files?.[0]; if (f) readFile(f); });

// ---------- settings ----------
const dlg = document.getElementById('settings');
const form = dlg.querySelector('form');
const F = form.elements;
function fillForm(s) {
  for (const el of F) {
    if (!el.name || s[el.name] == null) continue;
    if (el.type === 'checkbox') el.checked = !!s[el.name]; else el.value = s[el.name];
  }
}
F.preset.addEventListener('change', () => fillForm({ ...PRESETS[F.preset.value] }));
function openSettings(focus) {
  fillForm(settings);
  dlg.showModal();
  if (focus) { const el = F[focus]; el?.closest('details')?.setAttribute('open', ''); el?.focus(); }
}
document.getElementById('btn-settings').onclick = () => openSettings();
document.getElementById('btn-router').onclick = async () => {
  const out = document.getElementById('router-out');
  out.textContent = 'Đang kiểm tra…';
  forgetProbe();
  const r = await checkRouter({ routerUrl: F.routerUrl.value.trim(), routerToken: F.routerToken.value.trim() });
  out.textContent = r.text;
};
// Copy names found in the open video into the character list (then edit/merge by hand).
document.getElementById('btn-add-detected').onclick = () => {
  if (!shown) { document.getElementById('cast-out').textContent = 'Mở một video trước đã.'; return; }
  const before = F.characters.value;
  F.characters.value = mergeCharacters(before, shown.people.detected);
  document.getElementById('cast-out').textContent = F.characters.value === before ? 'Không có tên mới.' : 'Đã thêm. Bấm Lưu để dùng.';
};
document.getElementById('btn-check').onclick = async () => {
  const out = document.getElementById('check-out');
  out.textContent = 'Đang kiểm tra…';
  try {
    const models = await listModels({ provider: F.provider.value, baseUrl: F.baseUrl.value, apiKey: F.apiKey.value.trim() });
    document.getElementById('models').replaceChildren(...models.map(m => h('option', { value: m })));
    out.textContent = models.length ? `Key dùng được ✓ · ${models.length} model. ${models.includes(F.model.value) ? 'Model hiện tại có sẵn.' : '⚠️ Model hiện tại không có — chọn trong danh sách.'}`
      : 'Chỉ kiểm tra được key Gemini.';
  } catch (e) { out.textContent = '⚠️ ' + e.message; }
};
dlg.addEventListener('close', () => {
  if (dlg.returnValue !== 'save') return;
  const f = Object.fromEntries(new FormData(form));
  const num = (k, d) => (f[k] === '' || f[k] == null || Number.isNaN(+f[k]) ? d : +f[k]);
  forgetProbe();
  settings = { ...f, v: 2, routerToken: (f.routerToken || '').trim(), routerUrl: (f.routerUrl || '').trim(), free: F.free.checked, apiKey: (f.apiKey || '').trim(), rpm: num('rpm', 5), tpm: num('tpm', 0), rpd: num('rpd', 0),
    target: Math.min(100, Math.max(10, num('target', 80))), winMin: Math.max(10, num('winMin', 60)), priceIn: num('priceIn', 0), priceOut: num('priceOut', 0) };
  saveSettings(settings);
  route();
});

if (location.hash === '#yt') { history.replaceState(null, '', location.pathname); view.replaceChildren(h('p', { class: 'card' }, '⏳ Đang chờ bản chép lời từ YouTube…')); }
else route();
resumeJobs();
