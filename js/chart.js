// Keyword density along the video timeline: one bar per ~5-min block. SVG, no library.
const NS = 'http://www.w3.org/2000/svg';
const el = (tag, attrs) => { const e = document.createElementNS(NS, tag); for (const k in attrs) e.setAttribute(k, attrs[k]); return e; };

export function densityChart(counts, { label, onPick }) {
  const W = 1000, H = 120, max = Math.max(1, ...counts), bw = W / Math.max(1, counts.length);
  const svg = el('svg', { viewBox: `0 0 ${W} ${H + 4}`, class: 'chart', role: 'img', 'aria-label': 'Mật độ: ' + label, preserveAspectRatio: 'none' });
  svg.append(el('line', { x1: 0, x2: W, y1: H, y2: H, class: 'axis' }));
  counts.forEach((c, i) => {
    const h = c ? Math.max(4, (c / max) * (H - 6)) : 0;
    const g = el('g', { class: 'bar' });
    const hit = el('rect', { x: i * bw, y: 0, width: bw, height: H, class: 'hit' });
    const r = el('rect', { x: i * bw + bw * 0.12, y: H - h, width: bw * 0.76, height: h, rx: Math.min(3, bw / 4) });
    const t = el('title', {}); t.textContent = `Đoạn ${i + 1}: ${c} lần`;
    g.append(hit, r, t);
    if (c) g.addEventListener('click', () => onPick(i));
    svg.append(g);
  });
  return svg;
}
