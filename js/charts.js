// Grafy kreslené ručně do SVG. Žádná knihovna — plná kontrola nad vzhledem.

import { s, h, num, fixed, shortDate } from './ui.js';

const AXIS = 'var(--line)';
const DIM = 'var(--chalk-dim)';

/* =========================================================
   PODPIS APLIKACE — nakládaná osa
   ========================================================= */

/**
 * Vykreslí osu s kotouči podle výsledku z calc.loadBar().
 * Symetrická, výška kotouče odpovídá skutečnému průměru.
 */
export function barbell(load, { height = 92, labels = true } = {}) {
  const flat = load.plates.flatMap((p) => Array.from({ length: p.count }, () => p));
  const widthOf = (p) => Math.max(4, Math.min(15, 3.6 + p.kg * 0.46));
  const heightOf = (p) => (p.mm / 450) * (height - 14);

  const shaftHalf = 26;
  const sideW = flat.reduce((sum, p) => sum + widthOf(p) + 1.5, 0);
  const capW = 9;
  // Pevná minimální šířka: lehká a těžká osa se pak vykreslí ve stejném měřítku
  // a dvě osy vedle sebe jdou porovnat okem.
  const half = Math.max(shaftHalf + sideW + capW + 4, 155);
  const W = half * 2;
  const cy = height / 2;

  const svg = s('svg.barbell', {
    viewBox: `0 0 ${W} ${height + (labels ? 16 : 0)}`,
    preserveAspectRatio: 'xMidYMid meet',
    role: 'img',
    'aria-label': `Naloženo ${num(load.total, 2)} kg`,
  });

  // hřídel s vroubkováním
  svg.append(s('rect', { x: half - shaftHalf - sideW, y: cy - 3, width: (shaftHalf + sideW) * 2, height: 6, rx: 3, fill: 'var(--steel)' }));
  for (let x = half - shaftHalf + 3; x < half + shaftHalf - 2; x += 4) {
    svg.append(s('line', { x1: x, y1: cy - 3, x2: x - 2, y2: cy + 3, stroke: 'var(--bg)', 'stroke-width': 0.8, opacity: 0.55 }));
  }

  for (const dir of [-1, 1]) {
    let x = half + dir * shaftHalf;
    for (const p of flat) {
      const w = widthOf(p);
      const ph = heightOf(p);
      const px = dir === 1 ? x : x - w;
      svg.append(s('rect', {
        x: px, y: cy - ph / 2, width: w, height: ph, rx: Math.min(2.5, w / 3),
        fill: p.color, stroke: 'rgba(0,0,0,.45)', 'stroke-width': 0.7,
      }));
      svg.append(s('rect', {
        x: px, y: cy - ph / 2, width: w, height: ph / 2.6, rx: Math.min(2.5, w / 3),
        fill: '#fff', opacity: 0.14,
      }));
      x += dir * (w + 1.5);
    }
    // objímka
    const cx = dir === 1 ? x : x - capW;
    svg.append(s('rect', { x: cx, y: cy - 9, width: capW, height: 18, rx: 2.5, fill: 'var(--steel)' }));
  }

  if (labels) {
    const counts = load.plates.map((p) => `${p.count}× ${num(p.kg, 2)}`).join('   ');
    svg.append(s('text', {
      x: half, y: height + 11, 'text-anchor': 'middle',
      fill: DIM, 'font-size': 10.5, 'font-family': 'var(--font-mono)', 'letter-spacing': '.04em',
    }, counts || 'jen osa'));
  }

  return svg;
}

/* =========================================================
   Základní grafy
   ========================================================= */

const path = (pts) => pts.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(' ');

/**
 * Spojnicový graf s plochou pod křivkou.
 * Body jsou buď { date, value }, nebo { x, value } pro číselnou osu.
 */
export function lineChart(series, opts = {}) {
  const {
    width = 620, height = 180, pad = { t: 14, r: 12, b: 24, l: 44 },
    yZero = false, fmt = (v) => num(v, 0), xFmt = null,
  } = opts;
  const all = series.flatMap((sr) => sr.points);
  if (all.length < 2) return h('div.chart-empty', 'Málo dat na graf.');

  const numeric = all[0].x != null;
  const xOf = (p) => (numeric ? p.x : new Date(p.date).getTime());
  const xs = all.map(xOf);
  const ys = all.map((p) => p.value);
  const x0 = Math.min(...xs);
  const x1 = Math.max(...xs);
  let y0 = yZero ? 0 : Math.min(...ys);
  let y1 = Math.max(...ys);
  const padY = (y1 - y0) * 0.15 || 1;
  y0 = yZero ? 0 : y0 - padY;
  y1 += padY;

  const iw = width - pad.l - pad.r;
  const ih = height - pad.t - pad.b;
  const sx = (t) => pad.l + (x1 === x0 ? iw / 2 : ((t - x0) / (x1 - x0)) * iw);
  const sy = (v) => pad.t + ih - ((v - y0) / (y1 - y0)) * ih;

  // bez preserveAspectRatio="none" — jinak se na úzké obrazovce roztáhne i popis os
  const svg = s('svg.chart', { viewBox: `0 0 ${width} ${height}`, role: 'img' });
  const defs = s('defs');
  svg.append(defs);

  for (let i = 0; i <= 3; i++) {
    const v = y0 + ((y1 - y0) * i) / 3;
    const y = sy(v);
    svg.append(s('line', { x1: pad.l, y1: y, x2: width - pad.r, y2: y, stroke: AXIS, 'stroke-width': 1 }));
    svg.append(s('text', { x: pad.l - 8, y: y + 3.5, 'text-anchor': 'end', fill: DIM, 'font-size': 10, 'font-family': 'var(--font-mono)' }, fmt(v)));
  }

  series.forEach((sr, i) => {
    const pts = sr.points.map((p) => [sx(xOf(p)), sy(p.value)]);
    const gid = `grad${i}-${Math.random().toString(36).slice(2, 6)}`;
    if (sr.area !== false) {
      defs.append(s('linearGradient', { id: gid, x1: 0, y1: 0, x2: 0, y2: 1 },
        s('stop', { offset: '0%', 'stop-color': sr.color, 'stop-opacity': 0.28 }),
        s('stop', { offset: '100%', 'stop-color': sr.color, 'stop-opacity': 0 })));
      svg.append(s('path', {
        d: `${path(pts)} L${pts.at(-1)[0]} ${pad.t + ih} L${pts[0][0]} ${pad.t + ih} Z`,
        fill: `url(#${gid})`,
      }));
    }
    svg.append(s('path', {
      d: path(pts), fill: 'none', stroke: sr.color, 'stroke-width': 2,
      'stroke-linecap': 'round', 'stroke-linejoin': 'round',
      'vector-effect': 'non-scaling-stroke',
    }));
    if (sr.dots !== false) {
      sr.points.forEach((p, idx) => {
        const [cx, cy] = pts[idx];
        const xLabel = numeric ? (xFmt ? xFmt(p.x) : num(p.x, 0)) : shortDate(p.date);
        svg.append(s('circle', {
          cx, cy, r: 2.6, fill: 'var(--bg)', stroke: sr.color, 'stroke-width': 1.8, style: 'cursor: pointer',
        }, s('title', {}, `${xLabel}: ${fmt(p.value)}`)));
      });
    }
  });

  const wrap = h('div.chart-wrap', svg);
  const first = series[0].points;
  const label = numeric ? (xFmt ?? ((v) => num(v, 0))) : shortDate;
  wrap.append(h('div.chart-x',
    h('span', label(numeric ? first[0].x : first[0].date)),
    h('span', label(numeric ? first.at(-1).x : first.at(-1).date))));
  return wrap;
}

/** Skládané sloupce — objem po týdnech rozdělený na intenzitní zóny. */
export function stackedBars(rows, keys, opts = {}) {
  const { height = 190, fmt = (v) => num(v, 0), label = (r) => r.label } = opts;
  const max = Math.max(...rows.map((r) => keys.reduce((sum, k) => sum + (r.values[k.key] ?? 0), 0)), 1);

  const wrap = h('div.bars');
  for (const r of rows) {
    const totalV = keys.reduce((sum, k) => sum + (r.values[k.key] ?? 0), 0);
    const col = h('div.bar-col', { title: `${label(r)}: ${fmt(totalV)}` });
    const stack = h('div.bar-stack', { style: { height: `${height}px` } });
    const inner = h('div.bar-inner', { style: { height: `${(totalV / max) * 100}%` } });
    for (const k of keys) {
      const v = r.values[k.key] ?? 0;
      if (v <= 0) continue;
      inner.append(h('div.bar-seg', {
        style: { height: `${(v / totalV) * 100}%`, background: k.color },
        title: `${k.label}: ${fmt(v)}`,
      }));
    }
    stack.append(inner);
    col.append(h('div.bar-val', fmt(totalV)), stack, h('div.bar-label', label(r)));
    wrap.append(col);
  }
  return wrap;
}

/** Půlkruhový ukazatel — ACWR. */
export function gauge(value, { min = 0, max = 2, bands = [], size = 190, label = '', sub = '' } = {}) {
  const cx = size / 2;
  const cy = size * 0.62;
  const r = size * 0.4;
  const a0 = Math.PI;
  const a1 = 0;
  const ang = (v) => a0 + ((Math.min(Math.max(v, min), max) - min) / (max - min)) * (a1 - a0);
  const pt = (a, rr = r) => [cx + Math.cos(a) * rr, cy + Math.sin(a) * rr];
  const arc = (from, to, rr) => {
    const [x0, y0] = pt(ang(from), rr);
    const [x1, y1] = pt(ang(to), rr);
    return `M${x0} ${y0} A${rr} ${rr} 0 0 1 ${x1} ${y1}`;
  };

  const svg = s('svg.gauge', { viewBox: `0 0 ${size} ${size * 0.78}`, role: 'img', 'aria-label': `${label} ${value ?? '—'}` });
  svg.append(s('path', { d: arc(min, max, r), fill: 'none', stroke: 'var(--line)', 'stroke-width': 13, 'stroke-linecap': 'round' }));
  for (const b of bands) {
    svg.append(s('path', { d: arc(b.from, b.to, r), fill: 'none', stroke: b.color, 'stroke-width': 13, opacity: 0.85 }));
  }
  if (value != null) {
    const a = ang(value);
    const [nx, ny] = pt(a, r + 10);
    const [ix, iy] = pt(a, r - 16);
    svg.append(s('line', { x1: ix, y1: iy, x2: nx, y2: ny, stroke: 'var(--chalk)', 'stroke-width': 2.5, 'stroke-linecap': 'round' }));
    svg.append(s('circle', { cx, cy, r: 5, fill: 'var(--chalk)' }));
  }
  svg.append(s('text', {
    x: cx, y: cy - 16, 'text-anchor': 'middle', fill: 'var(--chalk)',
    'font-size': 30, 'font-family': 'var(--font-display)', 'font-weight': 700, 'letter-spacing': '-.02em',
  }, value == null ? '—' : fixed(value, 2)));

  const wrap = h('div.gauge-wrap', svg);
  if (sub) wrap.append(h('div.gauge-sub', sub));
  return wrap;
}

/** Mřížka týden × den, buňka obarvená podle intenzitní zóny. */
export function heatmap(cells, { weeks, days, onpick } = {}) {
  const grid = h('div.heat', { style: { '--cols': days.length } });
  grid.append(h('div.heat-corner', ''));
  for (const d of days) grid.append(h('div.heat-head', d));

  for (const w of weeks) {
    grid.append(h('div.heat-week', `T${w}`));
    for (const d of days) {
      const c = cells.find((x) => x.week === w && x.day === d);
      if (!c) {
        grid.append(h('div.heat-cell.is-empty'));
        continue;
      }
      grid.append(h('button.heat-cell', {
        type: 'button',
        style: { '--c': c.color, '--fill': c.weight.toFixed(3) },
        title: c.title,
        onclick: () => onpick?.(c),
      }, h('span.heat-val', c.label)));
    }
  }
  return grid;
}

/** Vodorovný pruh pro rozpad podle cviku. */
export function splitBar(parts, { fmt = (v) => num(v, 0) } = {}) {
  const total = parts.reduce((s2, p) => s2 + p.value, 0) || 1;
  return h('div.split',
    h('div.split-track', ...parts.map((p) =>
      h('div.split-seg', { style: { width: `${(p.value / total) * 100}%`, background: p.color }, title: `${p.label}: ${fmt(p.value)}` }))),
    h('div.split-legend', ...parts.map((p) =>
      h('div.split-item',
        h('i', { style: { background: p.color } }),
        h('span.split-name', p.label),
        h('span.split-val', fmt(p.value))))));
}
