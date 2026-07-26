// Malé DOM a formátovací pomocníky. Bez frameworku.

import { parseDate } from './calc.js';

const SVG_NS = 'http://www.w3.org/2000/svg';

/** Hyperscript. h('div.card', {onclick}, ...children) */
export function h(spec, props = null, ...children) {
  const [tag, ...classes] = String(spec).split('.');
  const node = document.createElement(tag || 'div');
  if (classes.length) node.className = classes.join(' ');

  // Props je jen prostý objekt. Číslo, řetězec i DOM prvek jsou dítě —
  // včetně nuly a prázdného řetězce, které by jinak jako falsy hodnota zmizely.
  const isProps = props != null && typeof props === 'object' && !props.nodeType && !Array.isArray(props);
  if (!isProps) {
    if (props != null) children.unshift(props);
    props = null;
  }

  for (const [k, v] of Object.entries(props ?? {})) {
    if (v == null || v === false) continue;
    if (k === 'class') node.className = [node.className, v].filter(Boolean).join(' ');
    else if (k === 'style' && typeof v === 'object') setStyle(node, v);
    else if (k === 'html') node.innerHTML = v;
    else if (k === 'dataset') Object.assign(node.dataset, v);
    else if (k.startsWith('on') && typeof v === 'function') node.addEventListener(k.slice(2), v);
    else if (k in node && k !== 'list' && typeof v !== 'object') node[k] = v;
    else node.setAttribute(k, v === true ? '' : v);
  }

  add(node, children);
  return node;
}

/** Object.assign na style tiše zahodí vlastní proměnné (--x). Tohle ne. */
function setStyle(node, styles) {
  for (const [k, v] of Object.entries(styles)) {
    if (k.startsWith('--')) node.style.setProperty(k, String(v));
    else node.style[k] = v;
  }
}

function add(node, kids) {
  for (const c of kids.flat(4)) {
    // false vypadává kvůli zápisu `podmínka && prvek`; nula je platné dítě
    if (c == null || c === false || c === '') continue;
    node.append(c.nodeType ? c : document.createTextNode(String(c)));
  }
}

/** Totéž pro SVG. */
export function s(spec, props = null, ...children) {
  const [tag, ...classes] = String(spec).split('.');
  const node = document.createElementNS(SVG_NS, tag);
  if (classes.length) node.setAttribute('class', classes.join(' '));
  for (const [k, v] of Object.entries(props ?? {})) {
    if (v == null || v === false) continue;
    if (k.startsWith('on') && typeof v === 'function') node.addEventListener(k.slice(2), v);
    else node.setAttribute(k, v === true ? '' : v);
  }
  for (const c of children.flat(4)) {
    if (c == null || c === false || c === '') continue;
    node.append(c.nodeType ? c : document.createTextNode(String(c)));
  }
  return node;
}

export const clear = (node) => {
  while (node.firstChild) node.firstChild.remove();
  return node;
};

/* ---------------- formátování ---------------- */

const nf = (d) => new Intl.NumberFormat('cs-CZ', { minimumFractionDigits: d, maximumFractionDigits: d });

export function num(v, d = 1) {
  if (v == null || !Number.isFinite(v)) return '—';
  const dec = Number.isInteger(v) ? 0 : d;
  return nf(dec).format(v);
}

/** Vždy s pevným počtem desetinných míst — pro sloupce čísel pod sebou. */
export const fixed = (v, d = 1) => (v == null || !Number.isFinite(v) ? '—' : nf(d).format(v));

export const kg = (v, d = 1) => (v == null ? '—' : `${num(v, d)}`);
export const pct = (v, d = 1) => (v == null ? '—' : `${num(v, d)} %`);

export function bigNum(v) {
  if (v == null || !Number.isFinite(v)) return '—';
  if (Math.abs(v) >= 1000) return new Intl.NumberFormat('cs-CZ', { maximumFractionDigits: 0 }).format(v);
  return num(v, 1);
}

const DAYS = ['ne', 'po', 'út', 'st', 'čt', 'pá', 'so'];
export function shortDate(d) {
  const x = parseDate(d);
  return `${DAYS[x.getDay()]} ${x.getDate()}. ${x.getMonth() + 1}.`;
}

export const longDate = (d) =>
  new Intl.DateTimeFormat('cs-CZ', { day: 'numeric', month: 'long', year: 'numeric' }).format(parseDate(d));

export const weekday = (d) =>
  new Intl.DateTimeFormat('cs-CZ', { weekday: 'long', day: 'numeric', month: 'numeric' }).format(parseDate(d));

/* ---------------- ikony ---------------- */

const PATHS = {
  gauge: ['M12 14 20 6', 'M3.34 19a10 10 0 1 1 17.32 0'],
  calculator: ['M4 3h16a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z', 'M7 7h10', 'M7 12h.01', 'M12 12h.01', 'M17 12h.01', 'M7 16h.01', 'M12 16h.01', 'M17 16h.01'],
  grid: ['M3 3h18v18H3z', 'M3 9h18', 'M3 15h18', 'M9 3v18', 'M15 3v18'],
  layers: ['m12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83Z', 'm22 17.65-9.17 4.16a2 2 0 0 1-1.66 0L2 17.65', 'm22 12.65-9.17 4.16a2 2 0 0 1-1.66 0L2 12.65'],
  disc: ['M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20z', 'M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6z'],
  trophy: ['M6 9H4.5a2.5 2.5 0 0 1 0-5H6', 'M18 9h1.5a2.5 2.5 0 0 0 0-5H18', 'M4 22h16', 'M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22', 'M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22', 'M18 2H6v7a6 6 0 0 0 12 0V2Z'],
  users: ['M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2', 'M9 3a4 4 0 1 0 0 8 4 4 0 0 0 0-8z', 'M22 21v-2a4 4 0 0 0-3-3.87', 'M16 3.13a4 4 0 0 1 0 7.75'],
  calendar: ['M3 4h18v18H3z', 'M16 2v4', 'M8 2v4', 'M3 10h18'],
  sliders: ['M4 21v-7', 'M4 10V3', 'M12 21v-9', 'M12 8V3', 'M20 21v-5', 'M20 12V3', 'M1 14h6', 'M9 8h6', 'M17 16h6'],
  plus: ['M12 5v14', 'M5 12h14'],
  trash: ['M3 6h18', 'M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6', 'M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2'],
  download: ['M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4', 'm7 10 5 5 5-5', 'M12 15V3'],
  upload: ['M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4', 'm17 8-5-5-5 5', 'M12 3v12'],
  chevron: ['m6 9 6 6 6-6'],
  check: ['M20 6 9 17l-5-5'],
  alert: ['m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z', 'M12 9v4', 'M12 17h.01'],
  zap: ['M13 2 3 14h9l-1 8 10-12h-9l1-8z'],
  target: ['M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20z', 'M12 6a6 6 0 1 0 0 12 6 6 0 0 0 0-12z', 'M12 10a2 2 0 1 0 0 4 2 2 0 0 0 0-4z'],
  x: ['M18 6 6 18', 'm6 6 12 12'],
  arrow: ['M5 12h14', 'm12 5 7 7-7 7'],
  book: ['M4 19.5A2.5 2.5 0 0 1 6.5 17H20', 'M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z'],
  scale: ['m3 7 3 9h6l3-9', 'M12 3v18', 'M5 21h14', 'm15 7 3 9h3l-3-9'],
  copy: ['M9 9h11a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-9a2 2 0 0 1-2-2V9z', 'M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1'],
  trending: ['M22 7 13.5 15.5 8.5 10.5 2 17', 'M16 7h6v6'],
  search: ['M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14z', 'm21 21-4.35-4.35'],
  sun: ['M12 7a5 5 0 1 0 0 10 5 5 0 0 0 0-10z', 'M12 1v2', 'M12 21v2', 'M4.22 4.22l1.42 1.42', 'M18.36 18.36l1.42 1.42', 'M1 12h2', 'M21 12h2', 'M4.22 19.78l1.42-1.42', 'M18.36 5.64l1.42-1.42'],
  moon: ['M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z'],
  shield: ['M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z'],
  printer: ['M6 9V2h12v7', 'M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2', 'M6 14h12v8H6z'],
  activity: ['M22 12h-4l-3 9L9 3l-3 9H2'],
  heart: ['M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z'],
  info: ['M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20z', 'M12 16v-4', 'M12 8h.01'],
  gauge2: ['M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z', 'M12 12l4-4'],
};

export function icon(name, size = 18, extraClass = null) {
  return s('svg', {
    viewBox: '0 0 24 24', width: size, height: size, fill: 'none',
    stroke: 'currentColor', 'stroke-width': 1.6,
    'stroke-linecap': 'round', 'stroke-linejoin': 'round',
    class: extraClass ? `ic ${extraClass}` : 'ic', 'aria-hidden': 'true',
  }, ...(PATHS[name] ?? []).map((d) => s('path', { d })));
}

/* ---------------- prvky ---------------- */

export function field(label, input, hint, ...extra) {
  return h('label.field', h('span.field-label', label), input, hint && h('span.field-hint', hint), ...extra);
}

/**
 * Přepínač, který si přepíná stav sám — bez překreslení celého pohledu.
 * Ve formulářích je to nutné, jinak by změna volby smazala rozepsaná pole.
 */
export function segmentedLive(options, value, onchange) {
  const wrap = h('div.seg', { role: 'group' });
  const buttons = [];
  for (const o of options) {
    const btn = h('button.seg-btn', {
      type: 'button',
      'aria-pressed': String(o.value === value),
      onclick: () => {
        for (const b of buttons) b.setAttribute('aria-pressed', String(b === btn));
        onchange(o.value);
      },
    }, o.label);
    buttons.push(btn);
    wrap.append(btn);
  }
  return wrap;
}

export function numInput(props = {}) {
  return h('input.input', { type: 'number', inputmode: 'decimal', ...props });
}

/**
 * Hodnota do <input type="number">. Musí mít desetinnou tečku a být bez mezer —
 * české „82,5" nebo „1 000" prohlížeč odmítne a pole zůstane prázdné.
 */
export const inputNum = (v, d = 2) =>
  v == null || !Number.isFinite(v) ? '' : String(Number(Number(v).toFixed(d)));

/** Číselné pole, které bere čárku i tečku. Zobrazuje se česky s čárkou. */
export function decimalInput({ value, onvalue, ...props } = {}) {
  const el = h('input.input', {
    type: 'text', inputmode: 'decimal', autocomplete: 'off',
    value: value ?? '', ...props,
  });
  el.addEventListener('input', () => {
    const n = Number(el.value.replace(/\s/g, '').replace(',', '.'));
    if (el.value.trim() !== '' && Number.isFinite(n)) onvalue?.(n);
  });
  return el;
}

export function select(options, props = {}) {
  const sel = h('select.input.select', props);
  for (const o of options) {
    sel.append(h('option', { value: o.value, selected: o.value === props.value }, o.label));
  }
  return sel;
}

export function segmented(options, value, onchange) {
  const wrap = h('div.seg', { role: 'group' });
  for (const o of options) {
    wrap.append(h('button.seg-btn', {
      type: 'button',
      'aria-pressed': String(o.value === value),
      onclick: () => onchange(o.value),
    }, o.label));
  }
  return wrap;
}

export function stat(label, value, unit, tone) {
  return h('div.stat', { dataset: tone ? { tone } : {} },
    h('div.stat-label', label),
    h('div.stat-value', value, unit && h('span.stat-unit', unit)));
}

export function card(title, opts = {}, ...body) {
  return h('section.card', { class: opts.class },
    (title || opts.action) && h('header.card-head',
      h('div',
        opts.eyebrow && h('div.eyebrow', opts.eyebrow),
        title && h('h2.card-title', title)),
      opts.action),
    h('div.card-body', ...body));
}

export function tag(text, tone = 'neutral') {
  return h('span.tag', { dataset: { tone } }, text);
}

/**
 * Buňka je buď hodnota, nebo popis { value, num }.
 * Pozor: DOM prvky jako <button> nebo <input> mají vlastní .value — musí se
 * poznat podle nodeType, jinak by se vykreslila jejich hodnota místo prvku.
 */
const asCell = (c) =>
  c && typeof c === 'object' && !c.nodeType && ('value' in c || 'num' in c) ? c : { value: c };

export function table(headers, rows, opts = {}) {
  return h('div.table-wrap',
    h('table.table', { class: opts.class },
      h('thead', h('tr', ...headers.map((x) => {
        const head = asCell(typeof x === 'object' && !x.nodeType ? { value: x.label, num: x.num } : x);
        return h('th', { class: head.num ? 'num' : null }, head.value);
      }))),
      h('tbody', ...rows.map((r) => {
        const row = Array.isArray(r) ? { cells: r } : r;
        return h('tr', { dataset: row.tone ? { tone: row.tone } : {}, class: row.class },
          ...row.cells.map((c) => {
            const cell = asCell(c);
            return h('td', { class: cell.num ? 'num' : null }, cell.value);
          }));
      }))));
}

let toastTimer;
export function toast(msg, tone = 'ok') {
  let el = document.querySelector('.toast');
  if (!el) {
    el = h('div.toast', { role: 'status' });
    document.body.append(el);
  }
  clear(el);
  el.dataset.tone = tone;
  el.append(icon(tone === 'bad' ? 'alert' : 'check', 16), h('span', msg));
  el.classList.add('is-on');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('is-on'), 2600);
}

/* ---------------- motiv ---------------- */

const THEME_KEY = 'pwr.theme';

/** 'light' | 'dark' — buď vlastní volba, nebo to, co říká systém. */
export function readTheme() {
  const stored = document.documentElement.dataset.theme;
  if (stored === 'light' || stored === 'dark') return stored;
  return matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export function setTheme(theme) {
  document.documentElement.dataset.theme = theme;
  try { localStorage.setItem(THEME_KEY, theme); } catch { /* zakázané úložiště */ }
  const meta = document.querySelector('meta[name="theme-color"]:not([media])');
  if (meta) meta.content = theme === 'dark' ? '#0d0e10' : '#f4f5f6';
}

/**
 * Nasadí uložený motiv. Inline skript v index.html to udělá dřív, aby
 * stránka neproblikla — tohle jen dorovná stav po startu modulu a udrží
 * appku v souladu, když si uživatel přepne motiv v systému.
 */
export function applyTheme() {
  try {
    const stored = localStorage.getItem(THEME_KEY);
    if (stored === 'light' || stored === 'dark') document.documentElement.dataset.theme = stored;
  } catch { /* zakázané úložiště */ }
}

/* ---------------- paleta příkazů ---------------- */

let paletteOpen = false;

/**
 * ⌘K / Ctrl+K. Skupiny jsou [{ group, items: [{ label, hint, ic, keywords, run }] }].
 *
 * Klávesnice je tady rovnocenná myši: šipky, Enter, Esc. Filtruje se přes
 * `keywords`, takže „tonáž" najde Analýzu bloku, i když to slovo není
 * v názvu obrazovky.
 */
export function cmdPalette(groups) {
  if (paletteOpen) return;
  paletteOpen = true;

  const restore = document.activeElement;
  const input = h('input', { type: 'text', placeholder: 'Hledej obrazovku, svěřence nebo akci…', 'aria-label': 'Hledat', autocomplete: 'off' });
  const list = h('div.cmdk-list', { role: 'listbox' });
  const panel = h('div.cmdk', { role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Paleta příkazů' },
    h('div.cmdk-search', icon('search', 16), input),
    list,
    h('div.cmdk-foot',
      h('span', h('span.kbd', '↑↓'), 'pohyb'),
      h('span', h('span.kbd', '↵'), 'otevřít'),
      h('span', h('span.kbd', 'esc'), 'zavřít')));

  const scrim = h('div.cmdk-scrim', {
    onpointerdown: (e) => { if (e.target === scrim) close(); },
  }, panel);

  let matches = [];
  let cursor = 0;

  const close = () => {
    paletteOpen = false;
    scrim.remove();
    document.removeEventListener('keydown', onKey, true);
    restore?.focus?.();
  };

  const runAt = (i) => {
    const m = matches[i];
    if (!m) return;
    close();
    m.run();
  };

  const draw = () => {
    const q = input.value.trim().toLowerCase();
    matches = [];
    clear(list);

    for (const g of groups) {
      const hits = g.items.filter((it) =>
        !q || `${it.label} ${it.keywords ?? ''}`.toLowerCase().includes(q));
      if (!hits.length) continue;
      list.append(h('div.cmdk-group', g.group));
      for (const it of hits) {
        const idx = matches.length;
        matches.push(it);
        list.append(h('button.cmdk-item', {
          type: 'button', role: 'option',
          dataset: { on: String(idx === cursor) },
          onpointerenter: () => { cursor = idx; mark(); },
          onclick: () => runAt(idx),
        }, icon(it.ic ?? 'arrow', 16), h('span', it.label), it.hint && h('span.cmdk-hint', it.hint)));
      }
    }

    if (!matches.length) list.append(h('div.cmdk-empty', 'Nic takového tu není.'));
    cursor = Math.min(cursor, Math.max(0, matches.length - 1));
    mark();
  };

  const mark = () => {
    const items = [...list.querySelectorAll('.cmdk-item')];
    items.forEach((el, i) => { el.dataset.on = String(i === cursor); });
    items[cursor]?.scrollIntoView({ block: 'nearest' });
  };

  const onKey = (e) => {
    if (e.key === 'Escape') { e.preventDefault(); close(); }
    else if (e.key === 'ArrowDown') { e.preventDefault(); cursor = (cursor + 1) % Math.max(1, matches.length); mark(); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); cursor = (cursor - 1 + matches.length) % Math.max(1, matches.length); mark(); }
    else if (e.key === 'Enter') { e.preventDefault(); runAt(cursor); }
  };

  input.addEventListener('input', () => { cursor = 0; draw(); });
  document.addEventListener('keydown', onKey, true);
  document.body.append(scrim);
  draw();
  input.focus();
}

export function download(filename, text, type = 'text/csv;charset=utf-8') {
  const url = URL.createObjectURL(new Blob(['﻿' + text], { type }));
  const a = h('a', { href: url, download: filename });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
