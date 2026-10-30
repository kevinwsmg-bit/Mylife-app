// Minimal SVG line chart. series: [{label, color, points: [{t (ms), y}]}]
const NS = 'http://www.w3.org/2000/svg';
const svg = (tag, attrs = {}, text) => {
  const el = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  if (text != null) el.textContent = text;
  return el;
};

export function lineChart(series, { height = 190 } = {}) {
  const W = 320;
  const H = height;
  const m = { l: 34, r: 10, t: 12, b: 24 };
  const all = series.flatMap((s) => s.points);
  const root = svg('svg', { viewBox: `0 0 ${W} ${H}`, class: 'chart', role: 'img', 'aria-label': 'Trend chart' });
  if (!all.length) return root;

  const ts = all.map((p) => p.t);
  const ys = all.map((p) => p.y);
  const t0 = Math.min(...ts);
  const t1 = Math.max(...ts);
  let y0 = Math.min(...ys);
  let y1 = Math.max(...ys);
  const pad = Math.max(2, (y1 - y0) * 0.15);
  y0 -= pad;
  y1 += pad;
  const x = (t) => m.l + (t1 === t0 ? (W - m.l - m.r) / 2 : ((t - t0) / (t1 - t0)) * (W - m.l - m.r));
  const y = (v) => m.t + (1 - (v - y0) / (y1 - y0)) * (H - m.t - m.b);

  for (let i = 0; i <= 3; i++) {
    const v = y0 + ((y1 - y0) * i) / 3;
    root.append(svg('line', { x1: m.l, x2: W - m.r, y1: y(v), y2: y(v), class: 'grid' }));
    root.append(svg('text', { x: m.l - 4, y: y(v) + 4, class: 'axis', 'text-anchor': 'end' }, Math.round(v)));
  }
  const fmt = (t) => new Date(t).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  root.append(svg('text', { x: m.l, y: H - 6, class: 'axis' }, fmt(t0)));
  if (t1 !== t0) root.append(svg('text', { x: W - m.r, y: H - 6, class: 'axis', 'text-anchor': 'end' }, fmt(t1)));

  for (const s of series) {
    const pts = [...s.points].sort((a, b) => a.t - b.t);
    if (pts.length > 1) {
      root.append(svg('polyline', {
        points: pts.map((p) => `${x(p.t)},${y(p.y)}`).join(' '),
        class: 'line',
        style: `stroke:${s.color}`,
      }));
    }
    for (const p of pts) root.append(svg('circle', { cx: x(p.t), cy: y(p.y), r: 3.2, style: `fill:${s.color}` }));
  }
  return root;
}
