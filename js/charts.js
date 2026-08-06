// Grafy kreslené ručně do SVG. Žádná knihovna — plná kontrola nad vzhledem.
//
// Pravidla, která tady platí všude:
//   · barvy chodí z motivu (var(--series-*), var(--zone-*)), ne z natvrdo
//     zapsaných hexů — jinak by tmavý motiv vypadal jako světlý s tmavým pozadím,
//   · mřížka a osy jsou potlačené, data jsou to jediné sytě obarvené,
//   · text nosí textové barvy, nikdy barvu řady; identitu nese značka vedle něj,
//   · každý graf má vrstvu na najetí myší — u SVG bez ní zůstane přesná hodnota
//     nedostupná.

import { s, h, num, fixed, shortDate, clear } from './ui.js';

const GRID = 'var(--grid)';
const AXIS = 'var(--axis)';
const MUTED = 'var(--ink-3)';

/* =========================================================
   Sdílený popisek
   ========================================================= */

/**
 * Připne k obalu plovoucí popisek. Vrací { show, hide } — volající si
 * rozhoduje, co se v něm ukáže, tenhle kus řeší jen umístění a schování.
 */
function tooltip(wrap) {
  const tip = h('div.viz-tip', { role: 'presentation' });
  wrap.append(tip);

  const show = (x, y, nodes) => {
    tip.replaceChildren(...nodes.filter(Boolean));
    tip.classList.add('is-on');
    // popisek se nesmí vysunout za kartu — u krajních bodů se přisaje k okraji
    const w = tip.offsetWidth;
    const half = w / 2;
    const max = wrap.clientWidth;
    tip.style.left = `${Math.min(Math.max(x, half + 2), Math.max(max - half - 2, half + 2))}px`;
    tip.style.top = `${y - 10}px`;
  };

  const hide = () => tip.classList.remove('is-on');
  wrap.addEventListener('pointerleave', hide);
  return { show, hide };
}

const tipRow = (color, label, value) =>
  h('div.viz-tip-row', color && h('i', { style: { background: color } }), h('span', label), h('b', value));

/* =========================================================
   PODPIS APLIKACE — nakládaná osa
   ========================================================= */

/**
 * Vykreslí osu s kotouči podle výsledku z calc.loadBar().
 * Symetrická, výška kotouče odpovídá skutečnému průměru.
 *
 * Tady — a jen tady — platí kotoučové barvy IPF. Nejsou to barvy „řady",
 * ale skutečná barva železa, které si závodník bere z regálu; kdyby se
 * přebarvily podle palety grafů, obrázek by přestal odpovídat realitě.
 */
export function barbell(load, { height = 84, labels = true } = {}) {
  const flat = load.plates.flatMap((p) => Array.from({ length: p.count }, () => p));
  const widthOf = (p) => Math.max(4, Math.min(14, 3.4 + p.kg * 0.44));
  const heightOf = (p) => (p.mm / 450) * (height - 14);

  const shaftHalf = 24;
  const sideW = flat.reduce((sum, p) => sum + widthOf(p) + 1.5, 0);
  const capW = 8;
  // Pevná minimální šířka: lehká a těžká osa se pak vykreslí ve stejném měřítku
  // a dvě osy vedle sebe jdou porovnat okem.
  const half = Math.max(shaftHalf + sideW + capW + 4, 150);
  const W = half * 2;
  const cy = height / 2;

  const svg = s('svg.barbell', {
    viewBox: `0 0 ${W} ${height + (labels ? 15 : 0)}`,
    preserveAspectRatio: 'xMidYMid meet',
    role: 'img',
    'aria-label': `Naloženo ${num(load.total, 2)} kg`,
  });

  // hřídel s vroubkováním
  svg.append(s('rect', { x: half - shaftHalf - sideW, y: cy - 2.5, width: (shaftHalf + sideW) * 2, height: 5, rx: 2.5, fill: 'var(--steel)' }));
  for (let x = half - shaftHalf + 3; x < half + shaftHalf - 2; x += 4) {
    svg.append(s('line', { x1: x, y1: cy - 2.5, x2: x - 2, y2: cy + 2.5, stroke: 'var(--surface)', 'stroke-width': 0.8, opacity: 0.5 }));
  }

  for (const dir of [-1, 1]) {
    let x = half + dir * shaftHalf;
    for (const p of flat) {
      const w = widthOf(p);
      const ph = heightOf(p);
      const px = dir === 1 ? x : x - w;
      svg.append(s('rect', {
        x: px, y: cy - ph / 2, width: w, height: ph, rx: 2,
        fill: p.color, stroke: 'rgba(0,0,0,.28)', 'stroke-width': 0.7,
      }, s('title', {}, `${num(p.kg, 2)} kg`)));
      x += dir * (w + 1.5);
    }
    // objímka
    const cx = dir === 1 ? x : x - capW;
    svg.append(s('rect', { x: cx, y: cy - 8, width: capW, height: 16, rx: 2, fill: 'var(--steel)' }));
  }

  if (labels) {
    const counts = load.plates.map((p) => `${p.count}× ${num(p.kg, 2)}`).join('   ');
    svg.append(s('text', {
      x: half, y: height + 10, 'text-anchor': 'middle',
      fill: MUTED, 'font-size': 10.5, 'font-family': 'var(--font-mono)',
    }, counts || 'jen osa'));
  }

  return svg;
}

/* =========================================================
   Spojnicový graf
   ========================================================= */

const path = (pts) => pts.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(' ');

/** Hezké kroky osy — 1 / 2 / 2,5 / 5 × mocnina deseti. */
function niceStep(span, target = 4) {
  const raw = span / target;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const norm = raw / mag;
  const step = norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 2.5 ? 2.5 : norm <= 5 ? 5 : 10;
  return step * mag;
}

/**
 * Spojnicový graf s křížovým zaměřovačem.
 * Body jsou buď { date, value }, nebo { x, value } pro číselnou osu.
 *
 * Plocha pod křivkou se kreslí jen u jediné řady. U víc řad by se plochy
 * překrývaly a čtenář by nepoznal, která hodnota je čí — proto tam zůstane
 * jen čára.
 */
/**
 * Spojnicový graf.
 *
 * Kreslí se až tehdy, když prvek zná svou skutečnou šířku, a v jejích
 * jednotkách — viewBox se rovná pixelům 1 : 1.
 *
 * Dřív měl graf pevný viewBox 620 jednotek roztažený na šířku karty.
 * Na širokém sloupci se popisky os nafoukly, na mobilu se z desetibodového
 * písma staly tři body a osa se změnila v šedou kaši. Písmo v SVG se
 * zmenšuje se soustavou souřadnic; jediný způsob, jak mu udržet velikost,
 * je kreslit v pixelech. Překreslení hlídá ResizeObserver, ale až od
 * dvanácti pixelů rozdílu — jinak by se graf překresloval při každém
 * cuknutí rolovací lišty.
 */
export function lineChart(series, opts = {}) {
  if (series.flatMap((sr) => sr.points).length < 2) return h('div.chart-empty', 'Málo dat na graf.');

  const host = h('div.chart-host');
  let drawn = 0;

  const paint = (px) => {
    const w = Math.max(260, Math.round(px || opts.width || 620));
    if (Math.abs(w - drawn) < 12) return;
    drawn = w;
    clear(host);
    host.append(drawLine(series, { ...opts, width: w }));
  };

  if (typeof ResizeObserver === 'function') {
    new ResizeObserver((entries) => paint(entries[0].contentRect.width)).observe(host);
  } else {
    paint(opts.width);
  }
  return host;
}

function drawLine(series, opts) {
  /**
   * bare = jiskřička: bez mřížky, popisků osy y a svislé osy.
   * V malém grafu na jeden cvik nemá osa co říct — tvar křivky se čte
   * i bez ní a hodnotu si čtenář vytáhne zaměřovačem.
   */
  const {
    width = 620, height = 190, bare = false,
    pad = bare ? { t: 8, r: 6, b: 14, l: 6 } : { t: 12, r: 14, b: 26, l: 46 },
    yZero = false, fmt = (v) => num(v, 0), xFmt = null, unit = '',
  } = opts;
  const all = series.flatMap((sr) => sr.points);
  const numeric = all[0].x != null;
  const xOf = (p) => (numeric ? p.x : new Date(p.date).getTime());
  const xs = all.map(xOf);
  const ys = all.map((p) => p.value);
  const x0 = Math.min(...xs);
  const x1 = Math.max(...xs);

  // Osa y na hezkých číslech: čtenář si má odečíst hodnotu, ne luštit „117,3".
  const lo = yZero ? 0 : Math.min(...ys);
  const hi = Math.max(...ys);
  const step = niceStep((hi - lo) || Math.abs(hi) || 1);
  const y0 = yZero ? 0 : Math.floor(lo / step) * step - (lo === hi ? step : 0);
  const y1 = Math.ceil(hi / step) * step + (lo === hi ? step : 0);
  const span = y1 - y0 || 1;

  const iw = width - pad.l - pad.r;
  const ih = height - pad.t - pad.b;
  const sx = (t) => pad.l + (x1 === x0 ? iw / 2 : ((t - x0) / (x1 - x0)) * iw);
  const sy = (v) => pad.t + ih - ((v - y0) / span) * ih;

  // bez preserveAspectRatio="none" — jinak se na úzké obrazovce roztáhne i popis os
  const svg = s('svg.chart', { viewBox: `0 0 ${width} ${height}`, role: 'img' });
  const defs = s('defs');
  svg.append(defs);

  if (!bare) {
    for (let v = y0; v <= y1 + 1e-9; v += step) {
      const y = sy(v);
      svg.append(s('line', {
        x1: pad.l, y1: y, x2: width - pad.r, y2: y,
        stroke: Math.abs(v) < 1e-9 && y0 < 0 ? AXIS : GRID, 'stroke-width': 1,
      }));
      svg.append(s('text', {
        x: pad.l - 8, y: y + 3.5, 'text-anchor': 'end', fill: MUTED,
        'font-size': 10, 'font-family': 'var(--font-mono)',
      }, fmt(v)));
    }
    svg.append(s('line', { x1: pad.l, y1: pad.t, x2: pad.l, y2: pad.t + ih, stroke: AXIS, 'stroke-width': 1 }));
  }

  const wrap = h('div.chart-wrap', svg);

  series.forEach((sr, i) => {
    const pts = sr.points.map((p) => [sx(xOf(p)), sy(p.value)]);
    if (series.length === 1 && sr.area !== false) {
      const gid = `ar${i}-${Math.random().toString(36).slice(2, 7)}`;
      defs.append(s('linearGradient', { id: gid, x1: 0, y1: 0, x2: 0, y2: 1 },
        s('stop', { offset: '0%', 'stop-color': sr.color, 'stop-opacity': 0.18 }),
        s('stop', { offset: '100%', 'stop-color': sr.color, 'stop-opacity': 0 })));
      svg.append(s('path', {
        d: `${path(pts)} L${pts.at(-1)[0]} ${pad.t + ih} L${pts[0][0]} ${pad.t + ih} Z`,
        fill: `url(#${gid})`,
      }));
    }
    svg.append(s('path', {
      d: path(pts), fill: 'none', stroke: sr.color, 'stroke-width': sr.dash ? 1.5 : 2,
      // čárkovaná řada je referenční — plán, norma, práh. Nikdy naměřená data.
      'stroke-dasharray': sr.dash ? '5 4' : null,
      'stroke-linecap': 'round', 'stroke-linejoin': 'round',
      'vector-effect': 'non-scaling-stroke',
    }));
  });

  /* ---- zaměřovač ---- */
  const cross = s('line', { y1: pad.t, y2: pad.t + ih, stroke: AXIS, 'stroke-width': 1, opacity: 0 });
  svg.append(cross);
  const dots = series.map((sr) =>
    s('circle', { r: 4, fill: 'var(--surface)', stroke: sr.color, 'stroke-width': 2, opacity: 0 }));
  for (const d of dots) svg.append(d);

  const tip = tooltip(wrap);
  // Osa x je společná: hledá se nejbližší x, ne nejbližší bod — jinak by
  // zaměřovač u víc řad poskakoval mezi nimi.
  const keys = [...new Set(all.map(xOf))].sort((a, b) => a - b);

  const at = (ev) => {
    const box = svg.getBoundingClientRect();
    if (!box.width) return;
    const vx = ((ev.clientX - box.left) / box.width) * width;
    const key = keys.reduce((best, k) => (Math.abs(sx(k) - vx) < Math.abs(sx(best) - vx) ? k : best), keys[0]);
    const cx = sx(key);

    cross.setAttribute('x1', cx);
    cross.setAttribute('x2', cx);
    cross.setAttribute('opacity', 1);

    const rows = [];
    series.forEach((sr, i) => {
      const p = sr.points.find((q) => xOf(q) === key);
      if (!p) { dots[i].setAttribute('opacity', 0); return; }
      dots[i].setAttribute('cx', cx);
      dots[i].setAttribute('cy', sy(p.value));
      dots[i].setAttribute('opacity', 1);
      rows.push(tipRow(sr.color, sr.label ?? '', `${fmt(p.value)}${unit ? ` ${unit}` : ''}`));
    });

    const head = numeric ? (xFmt ? xFmt(key) : num(key, 0)) : shortDate(new Date(key));
    const py = (Math.min(...dots.filter((d) => d.getAttribute('opacity') === '1').map((d) => +d.getAttribute('cy'))) / height) * svg.getBoundingClientRect().height;
    tip.show((cx / width) * box.width, Number.isFinite(py) ? py : 40, [h('div.viz-tip-head', head), ...rows]);
  };

  svg.addEventListener('pointermove', at);
  svg.addEventListener('pointerleave', () => {
    cross.setAttribute('opacity', 0);
    for (const d of dots) d.setAttribute('opacity', 0);
  });

  // krajní popisky se berou z celého grafu, ne z první řady — u řad, které
  // nezačínají a nekončí ve stejný den, by první řada mluvila za všechny
  const label = numeric ? (xFmt ?? ((v) => num(v, 0))) : shortDate;
  wrap.append(h('div.chart-x',
    h('span', label(numeric ? x0 : new Date(x0))),
    h('span', label(numeric ? x1 : new Date(x1)))));
  return wrap;
}

/* =========================================================
   Skládané sloupce
   ========================================================= */

/** Skládané sloupce — objem po týdnech rozdělený podle cviku. */
export function stackedBars(rows, keys, opts = {}) {
  const { height = 170, fmt = (v) => num(v, 0), label = (r) => r.label, unit = '' } = opts;
  const max = Math.max(...rows.map((r) => keys.reduce((sum, k) => sum + (r.values[k.key] ?? 0), 0)), 1);

  const wrap = h('div.chart-wrap');
  const bars = h('div.bars');
  const tip = tooltip(wrap);

  for (const r of rows) {
    const totalV = keys.reduce((sum, k) => sum + (r.values[k.key] ?? 0), 0);
    const col = h('div.bar-col');
    const stack = h('div.bar-stack', { style: { height: `${height}px` } });
    const inner = h('div.bar-inner', { style: { height: `${(totalV / max) * 100}%` } });

    for (const k of keys) {
      const v = r.values[k.key] ?? 0;
      if (v <= 0) continue;
      inner.append(h('div.bar-seg', { style: { height: `${(v / totalV) * 100}%`, background: k.color } }));
    }

    stack.append(inner);
    col.append(h('div.bar-val', fmt(totalV)), stack, h('div.bar-label', label(r)));

    col.addEventListener('pointerenter', () => {
      col.dataset.on = 'true';
      const box = wrap.getBoundingClientRect();
      const cb = col.getBoundingClientRect();
      tip.show(cb.left - box.left + cb.width / 2, cb.top - box.top + 6, [
        h('div.viz-tip-head', `${label(r)} · ${fmt(totalV)}${unit ? ` ${unit}` : ''}`),
        ...keys
          .filter((k) => (r.values[k.key] ?? 0) > 0)
          .map((k) => tipRow(k.color, k.label, fmt(r.values[k.key]))),
      ]);
    });
    col.addEventListener('pointerleave', () => { col.dataset.on = 'false'; });

    bars.append(col);
  }

  wrap.append(bars);
  return wrap;
}

/* =========================================================
   Ukazatel
   ========================================================= */

/** Půlkruhový ukazatel — jedno číslo proti pásmům. */
export function gauge(value, { min = 0, max = 2, bands = [], size = 190, label = '', sub = '' } = {}) {
  const cx = size / 2;
  const cy = size * 0.6;
  const r = size * 0.38;
  const a0 = Math.PI;
  const a1 = 0;
  const ang = (v) => a0 + ((Math.min(Math.max(v, min), max) - min) / (max - min)) * (a1 - a0);
  const pt = (a, rr = r) => [cx + Math.cos(a) * rr, cy + Math.sin(a) * rr];
  const arc = (from, to, rr) => {
    const [ax, ay] = pt(ang(from), rr);
    const [bx, by] = pt(ang(to), rr);
    return `M${ax} ${ay} A${rr} ${rr} 0 0 1 ${bx} ${by}`;
  };

  const svg = s('svg.gauge', { viewBox: `0 0 ${size} ${size * 0.74}`, role: 'img', 'aria-label': `${label} ${value ?? '—'}` });
  svg.append(s('path', { d: arc(min, max, r), fill: 'none', stroke: GRID, 'stroke-width': 10, 'stroke-linecap': 'round' }));
  for (const b of bands) {
    svg.append(s('path', { d: arc(b.from, b.to, r), fill: 'none', stroke: b.color, 'stroke-width': 10 },
      b.label && s('title', {}, b.label)));
  }
  if (value != null) {
    const a = ang(value);
    const [nx, ny] = pt(a, r + 7);
    const [ix, iy] = pt(a, r - 14);
    svg.append(s('line', { x1: ix, y1: iy, x2: nx, y2: ny, stroke: 'var(--ink)', 'stroke-width': 2.5, 'stroke-linecap': 'round' }));
    svg.append(s('circle', { cx, cy, r: 4, fill: 'var(--ink)' }));
  }
  svg.append(s('text', {
    x: cx, y: cy - 14, 'text-anchor': 'middle', fill: 'var(--ink)',
    'font-size': 26, 'font-family': 'var(--font-body)', 'font-weight': 620, 'letter-spacing': '-.02em',
  }, value == null ? '—' : fixed(value, 2)));

  const wrap = h('div.gauge-wrap', svg);
  if (sub) wrap.append(h('div.gauge-sub', sub));
  return wrap;
}

/* =========================================================
   Mapa bloku
   ========================================================= */

/**
 * Mřížka týden × den.
 *
 * Dvě veličiny, dvě značky: výplň buňky je krok intenzitní škály (pořadí),
 * proužek u spodní hrany je objem dne (velikost). Dřív obojí neslo jedno
 * pole — barva zóny modulovaná průhledností podle tonáže — a nešlo z něj
 * přečíst ani jedno: světlá buňka mohla znamenat lehký den i málo práce.
 */
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
        style: { '--c': c.color, '--heat-ink': c.ink ?? 'var(--ink)' },
        title: c.title,
        onclick: () => onpick?.(c),
      },
        h('span.heat-val', c.label),
        c.weight > 0 && h('span', {
          style: {
            position: 'absolute', left: '4px', bottom: '4px', height: '3px', borderRadius: '2px',
            width: `calc((100% - 8px) * ${c.weight.toFixed(3)})`,
            background: 'currentColor', color: c.ink ?? 'var(--ink)', opacity: .55,
          },
        })));
    }
  }
  return grid;
}

/** Vodorovný pruh pro rozpad podle cviku. */
export function splitBar(parts, { fmt = (v) => num(v, 0) } = {}) {
  const total = parts.reduce((sum, p) => sum + p.value, 0) || 1;
  return h('div.split',
    h('div.split-track', ...parts.map((p) =>
      h('div.split-seg', { style: { width: `${(p.value / total) * 100}%`, background: p.color }, title: `${p.label}: ${fmt(p.value)}` }))),
    h('div.split-legend', ...parts.map((p) =>
      h('div.split-item',
        h('i', { style: { background: p.color } }),
        h('span.split-name', p.label),
        h('span.split-val', fmt(p.value))))));
}
