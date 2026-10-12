// Story page: header (+ AI panel), search, density chart, scenes (AI) / 5-min blocks (free).
// Timestamps are never shown; every unit, paragraph and search hit links to the video instead.
import { h, usd } from './dom.js';
import { buildIndex, search, highlight } from './search.js';
import { makeBlocks, analyze, density } from './algo.js';
import { phraseAlts } from './glossary.js';
import { estimate } from './scenes.js';
import { densityChart } from './chart.js';
import { modeOf } from './modes.js';

export const videoLink = (rec, t) =>
  rec.video_id && t != null ? `https://youtu.be/${rec.video_id}?t=${Math.max(0, Math.floor(t))}` : null;

// rec = one video record (generic format), sents = its segments with times filled in.
export function renderStory(root, rec, sents, { settings, glossary, runAI, saveMeta }) {
  const mode = modeOf(rec), CATS = mode.categories;
  const scenes = rec.sections;
  const free = analyze(sents, makeBlocks(sents), glossary);
  const blocks = free.blocks;
  const index = scenes ? buildIndex(scenes, CATS) : null;
  let tab = scenes ? 'scenes' : 'blocks', q = '', pick = null; // pick = {name, units:[n]}
  let chartTerm = null; // keyword clicked to chart; default = most clustered (bursty) keyword

  const go = (t, label = '▶ Mở video tại đây') => {
    const href = videoLink(rec, t);
    return href ? h('a', { class: 'go', href, target: '_blank', rel: 'noopener' }, label) : null;
  };
  const marked = text => (q ? highlight(text, q, glossary).map(p => (p.hit ? h('mark', {}, p.text) : p.text)) : text);

  function bodyOf(u, el) {
    for (let k = u.start; k <= u.end; k += 5) {
      const text = sents.slice(k, Math.min(k + 5, u.end + 1)).map(s => s.text).join(' ');
      el.append(h('p', {}, marked(text), ' ', go(sents[k].t, '▶')));
    }
  }

  // Keyword chip inside a scene/block: click = show its density chart (without closing the scene).
  const chartChip = (cls, text, title) => h('button', { class: cls + (text === chartTerm ? ' on' : ''),
    title: (title ? title + ' · ' : '') + 'Bấm để xem mật độ trên biểu đồ',
    onclick: e => { e.preventDefault(); e.stopPropagation(); chartTerm = text; drawChart(); chartBox.scrollIntoView({ behavior: 'smooth', block: 'center' }); } },
  marked(text));

  function unitEl(u, n, hit) {
    const isScene = tab === 'scenes';
    const body = h('div', { class: 'body' });
    const chips = isScene
      ? u.keywords.map(kw => chartChip('chip c' + Object.keys(CATS).indexOf(kw.category), kw.text, CATS[kw.category]))
      : u.terms.map(k => chartChip('chip', k));
    const d = h('details', { class: 'scene', id: tab + '-' + n },
      h('summary', {},
        h('div', { class: 'row' }, h('span', { class: 'num' }, isScene ? `#${n + 1}` : `Đoạn ${n + 1}`),
          isScene ? h('span', { class: 'title' }, marked(u.title)) : null, h('span', { class: 'grow' }), go(sents[u.start].t)),
        h('div', { class: 'chips' }, chips),
        isScene ? h('div', { class: 'one' }, marked(u.summary)) : null,
        !isScene && u.firsts.length ? h('div', { class: 'new' }, '🆕 Lần đầu xuất hiện: ' + u.firsts.join(', ')) : null,
        hit?.snippet && !hit.kw ? h('div', { class: 'snippet' }, marked(hit.snippet), ' ', go(sents[hit.sent].t, '▶')) : null),
      body);
    d.addEventListener('toggle', () => { if (d.open && !body.childElementCount) bodyOf(u, body); });
    return d;
  }

  const list = h('div'), count = h('p', { class: 'muted' }), idxBox = h('div'), chartBox = h('div'), tabsBox = h('div', { class: 'tabs' });

  function draw() {
    const units = tab === 'scenes' ? scenes : blocks;
    let rows = q.trim() ? search(q, units, sents, glossary) : units.map((_, n) => ({ n }));
    if (pick && pick.tab === tab) rows = rows.filter(r => pick.units.includes(r.n));
    list.replaceChildren(...rows.map(r => unitEl(units[r.n], r.n, r)));
    count.textContent = (q.trim() || pick) ? `${rows.length}/${units.length} khớp` + (pick ? ` · lọc: ${pick.name}` : '')
      : `${units.length} ${tab === 'scenes' ? mode.unit : 'đoạn ~5 phút'}`;
    drawChart(); drawIndex(); drawTabs();
  }

  function drawChart() {
    const auto = !q.trim() && !chartTerm;
    const term = q.trim() || chartTerm || free.bursty[0] || free.top[0];
    if (!term) return chartBox.replaceChildren();
    const counts = density(sents, blocks, phraseAlts(term, glossary));
    chartBox.replaceChildren(h('div', { class: 'muted' }, `Mật độ "${term}" dọc theo video`,
      auto ? ' (tự chọn từ khóa nổi bật nhất)' : '', ' · bấm cột để mở đoạn đó, bấm từ khóa bất kỳ để đổi',
      chartTerm && !q.trim() ? h('button', { class: 'chip', onclick: () => { chartTerm = null; drawChart(); } }, '↺ mặc định') : null),
      densityChart(counts, { label: term, onPick: i => { tab = 'blocks'; q = ''; input.value = ''; pick = null; draw();
        const el = document.getElementById('blocks-' + i); if (el) { el.open = true; el.scrollIntoView({ block: 'center' }); } } }));
  }

  function chip(cls, name, units, n) {
    const on = pick && pick.name === name && pick.tab === tab;
    return h('button', { class: 'chip ' + cls + (on ? ' on' : ''), onclick: () => { pick = on ? null : { tab, name, units }; chartTerm = on ? null : name; draw(); } },
      name, ' ', h('small', {}, n));
  }

  function drawIndex() {
    if (tab === 'scenes') {
      idxBox.replaceChildren(...Object.entries(CATS).filter(([cat]) => index[cat].length).map(([cat, label], i) =>
        h('details', { open: i < 2 }, h('summary', {}, `${label} (${index[cat].length})`),
          h('div', { class: 'chips' }, index[cat].slice(0, 60).map(e => chip('c' + i, e.name, e.units, e.units.length))))));
    } else {
      idxBox.replaceChildren(h('div', { class: 'chips' }, free.top.slice(0, 40).map(k => {
        const units = blocks.map((b, n) => (b.terms.includes(k) ? n : -1)).filter(n => n >= 0);
        return chip('', k, units, units.length);
      })));
    }
  }

  function drawTabs() {
    tabsBox.replaceChildren(...[
      scenes ? h('button', { class: tab === 'scenes' ? 'on' : '', onclick: () => { tab = 'scenes'; draw(); } }, `🎬 ${mode.unit[0].toUpperCase() + mode.unit.slice(1)} (AI) · ${scenes.length}`) : null,
      h('button', { class: tab === 'blocks' ? 'on' : '', onclick: () => { tab = 'blocks'; draw(); } }, `⏱ Đoạn 5 phút (miễn phí) · ${blocks.length}`)].filter(Boolean)); // null would render as text
  }

  const input = h('input', { type: 'search', placeholder: '🔎 Tìm nhân vật, sức mạnh, địa điểm, hoặc bất kỳ chữ nào… (gõ không dấu cũng được)',
    oninput: () => { q = input.value; clearTimeout(input._t); input._t = setTimeout(draw, 150); } });

  root.replaceChildren(
    header(rec, sents, mode, { settings, runAI, saveMeta }),
    h('div', { class: 'search' }, input, count),
    h('div', { class: 'card' }, chartBox),
    tabsBox,
    h('div', { class: 'card' }, h('b', {}, 'Mục lục từ khóa'), h('span', { class: 'muted' }, ' — bấm để lọc'), idxBox),
    list);
  draw();
}

function header(rec, sents, mode, { settings, runAI, saveMeta }) {
  const { overview, usage } = rec, V = mode.verdict;
  const card = h('div', { class: 'card stack' },
    h('div', { class: 'row' },
      overview ? h('div', { class: 'score', title: V.score }, overview.score) : null,
      h('div', { class: 'grow' }, h('h1', {}, rec.title || 'Không có tiêu đề'),
        h('div', { class: 'muted' }, rec.channel || '', rec.video_id ? [rec.channel ? ' · ' : '', h('a', { href: 'https://youtu.be/' + rec.video_id, target: '_blank', rel: 'noopener' }, 'YouTube')] : null))),
    overview?.why ? h('p', {}, h('b', {}, V.why + ': '), overview.why) : null,
    overview?.plot?.length ? h('details', { open: true }, h('summary', {}, V.lines), h('ol', { class: 'plot' }, overview.plot.map(l => h('li', {}, l)))) : null,
    usage ? h('p', { class: 'muted' }, `AI đã dùng ${usage.inTok.toLocaleString()} token vào · ${usage.outTok.toLocaleString()} ra · chi phí ${usage.free ? '$0 (miễn phí)' : '≈ ' + usd(usage.usd || 0)}`) : null);

  if (!rec.video_id) {
    const link = h('input', { placeholder: 'Link video YouTube (để có nút Mở video)', value: rec.url || '' });
    const dur = h('input', { placeholder: 'Thời lượng, vd 20:15:00', value: rec.durationText || '' });
    card.append(h('div', { class: 'fields' }, link, dur, h('button', { onclick: () => saveMeta(link.value, dur.value) }, 'Lưu')));
  }
  if (!rec.sections) {
    const est = estimate(sents, settings);
    const status = h('div', { class: 'muted' });
    const bar = h('div'), prog = h('div', { class: 'progress', hidden: true }, bar);
    const btn = h('button', { class: 'primary', onclick: async () => {
      btn.disabled = true; prog.hidden = false;
      await runAI({ status: t => { status.textContent = t; }, frac: f => { bar.style.width = (100 * f) + '%'; } });
      btn.disabled = false;
    } }, `Chia ${mode.unit} + chấm điểm bằng AI`);
    card.append(h('div', { class: 'stack' },
      h('div', {}, `AI: ${est.requests} lượt gọi ${settings.model}, khoảng ${est.minutes} phút · chi phí `,
        h('b', {}, settings.free ? '$0 (gói miễn phí)' : '≈ ' + usd(est.usd))),
      settings.apiKey ? null : h('p', { class: 'err' }, 'Chưa có key AI → bấm ⚙️ Cài đặt (hướng dẫn lấy key Gemini miễn phí trong README). Phần miễn phí bên dưới vẫn dùng được.'),
      settings.free ? h('p', { class: 'note' }, 'Lưu ý: ở gói miễn phí, Google có thể dùng nội dung gửi lên để cải thiện sản phẩm. Đừng dùng cho tài liệu riêng tư.') : null,
      rec.parts ? h('p', { class: 'muted' }, `Đã xong ${rec.parts.filter(Boolean).length} đoạn lần trước — chạy tiếp không làm lại.`) : null,
      h('div', { class: 'row' }, btn), prog, status));
  }
  return card;
}
