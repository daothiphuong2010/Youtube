// App wiring: input (bookmarklet message / drop / paste), story page, AI run, settings, shelf.
import { h } from './dom.js';
import { clean, parseText, parseClock } from './cleanup.js';
import { runSections } from './scenes.js';
import { modeOf, DEFAULT_MODE } from './modes.js';
import { askJSON, listModels, PRESETS } from './ai.js';
import { fillTimes } from './algo.js';
import { parseGlossary } from './glossary.js';
import { loadSettings, saveSettings, getStory, putStory, deleteStory, listStories, storyId } from './store.js';
import { renderStory } from './view.js';

const view = document.getElementById('view');
const YT_ORIGINS = ['https://www.youtube.com', 'https://m.youtube.com', 'https://youtube.com'];
let settings = loadSettings();
const glossary = () => parseGlossary(settings.glossary);

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
    h('span', { class: 'muted' }, ` · ${it.channel || ''} · ${it.nSections ? it.nSections + ' ' + modeOf(it).unit + ' AI' : 'chỉ phần miễn phí'} `),
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

function show(rec) {
  const sents = fillTimes(rec.segments, rec.duration);
  renderStory(view, rec, sents, {
    settings, glossary: glossary(),
    saveMeta: async (url, dur) => {
      const videoId = parseVideoId(url);
      const sec = /^\d+(:\d{1,2}){0,2}$/.test(dur.trim()) ? parseClock(dur) : null;
      Object.assign(rec, { url: url.trim(), durationText: dur.trim(), ...(videoId ? { video_id: videoId } : {}), ...(sec ? { duration: sec } : {}) });
      await putStory({ ...rec, updatedAt: Date.now() });
      show(rec);
    },
    runAI: ui => run(rec, sents, ui),
  });
  document.title = (rec.title || 'Video') + ' · YT Scenes';
}

async function run(story, sents, ui) {
  const s = { ...settings };
  const ask = (sys, user, max) => askJSON(s, sys, user, max, { onWait: (sec, why) => ui.status(`Đang chờ ${sec}s (${why})…`) });
  try {
    const res = await runSections({
      sents, rec: story, mode: modeOf(story), ask, glossary: glossary(),
      saved: { parts: story.parts, inTok: story.usage?.inTok, outTok: story.usage?.outTok },
      onProgress: (n, total) => { ui.frac(n / total); ui.status(n < total ? `Đoạn ${n + 1}/${total}…` : 'Đang viết tóm tắt + chấm điểm…'); },
      onWindow: async (n, part, usage) => {
        story.parts = story.parts || []; story.parts[n] = part; story.usage = { ...usage };
        await putStory({ ...story, updatedAt: Date.now() }).catch(() => {});
      },
    });
    res.usage.free = !!s.free;
    res.usage.usd = s.free ? 0 : (res.usage.inTok * s.priceIn + res.usage.outTok * s.priceOut) / 1e6;
    Object.assign(story, res, { glossary: glossary(), model: s.model, updatedAt: Date.now() });
    delete story.parts;
    await putStory(story);
    show(story);
  } catch (e) {
    ui.status('⚠️ ' + e.message + ' (phần đã xong được giữ lại; bấm lại để chạy tiếp)');
  }
}

// ---------- routing ----------
async function route() {
  const m = location.hash.match(/^#id=(.+)$/);
  if (!m) return home();
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
document.getElementById('btn-settings').onclick = () => { fillForm(settings); dlg.showModal(); };
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
  settings = { ...f, free: F.free.checked, apiKey: (f.apiKey || '').trim(), rpm: +f.rpm || 10, priceIn: +f.priceIn || 0, priceOut: +f.priceOut || 0 };
  saveSettings(settings);
  route();
});

if (location.hash === '#yt') { history.replaceState(null, '', location.pathname); view.replaceChildren(h('p', { class: 'card' }, '⏳ Đang chờ bản chép lời từ YouTube…')); }
else route();
