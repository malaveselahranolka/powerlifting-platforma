// Sdílené drobnosti mezi obrazovkami.

import { h, num, icon } from '../ui.js';
import * as S from '../store.js';
import { LIFTS } from '../data.js';

/** Jednotka k zobrazení. */
export const U = () => S.state.unit;

/** Váha z kg do zvolené jednotky, jako text. */
export const W = (kgVal, d = 1) => (kgVal == null ? '—' : num(S.toDisplay(kgVal), d));

/** Váha i s jednotkou. */
export const Wu = (kgVal, d = 1) => `${W(kgVal, d)} ${U()}`;

/** Barevná tečka cviku. */
export const liftDot = (lift) =>
  h('i.lift-dot', { style: { background: LIFTS[lift]?.color ?? 'var(--steel)' } });

export const liftName = (e) => (e.lift === 'accessory' ? e.name || 'Doplňkový cvik' : LIFTS[e.lift]?.label ?? e.lift);

export const initials = (name) =>
  name.split(/\s+/).filter(Boolean).slice(0, 2).map((x) => x[0]).join('').toUpperCase();

export function flagRow(f) {
  return h('div.flag', { dataset: { tone: f.tone } },
    icon(f.tone === 'ok' ? 'check' : 'alert', 16),
    h('span', f.text));
}

export function empty(text, action) {
  return h('div.empty', icon('layers', 26), h('p.note', text), action);
}

/** RPE česky — desetinná čárka. */
export const rpeLabel = (r) => String(r).replace('.', ',');

/** Nastaví hodnotu a překreslí. */
export const bind = (obj, key, cast = Number) => (ev) => {
  const v = cast(ev.target.value);
  obj[key] = Number.isNaN(v) ? obj[key] : v;
};
