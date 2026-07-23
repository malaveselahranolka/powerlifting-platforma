import { h, card, stat, icon, num, fixed, tag, table, field, numInput, inputNum, select, segmented, clear } from '../ui.js';
import { lineChart } from '../charts.js';
import * as S from '../store.js';
import * as C from '../calc.js';
import { LIFTS, COMP_LIFTS, WEIGHT_CLASSES } from '../data.js';
import { W, U, Wu } from './_util.js';

const st = { sex: null, bw: null, equipment: null, lifts: null, source: 'athlete' };

export function scoreView() {
  const root = h('div.view');
  const render = () => { clear(root); build(root, render); };
  render();
  return root;
}

function build(root, render) {
  const a = S.athlete();
  const sex = st.sex ?? a?.sex ?? 'm';
  const bw = st.bw ?? a?.bw ?? 90;
  const equipment = st.equipment ?? a?.equipment ?? 'classic';
  const lifts = st.lifts ?? { ...(a?.e1rm ?? { squat: 200, bench: 130, deadlift: 240 }) };
  const total = COMP_LIFTS.reduce((s2, k) => s2 + (lifts[k] || 0), 0);

  const d = C.dots(total, bw, sex);
  const gl = C.ipfGL(total, bw, sex, equipment);
  const wk = C.wilks(total, bw, sex);
  const wc = C.weightClass(bw, sex);

  root.append(h('div.grid.g-side-l',
    card('Zadání', { eyebrow: 'Závodník a výkony' },
      h('div.form-row',
        field('Pohlaví', segmented([{ value: 'm', label: 'Muži' }, { value: 'f', label: 'Ženy' }], sex, (v) => { st.sex = v; render(); })),
        field('Provedení', segmented([{ value: 'classic', label: 'Klasika' }, { value: 'equipped', label: 'Vybavení' }], equipment, (v) => { st.equipment = v; render(); }))),
      field(`Tělesná váha (${U()})`, numInput({
        value: inputNum(S.toDisplay(bw), 1), step: 0.1,
        oninput: (e) => { st.bw = S.fromDisplay(Number(e.target.value)); render(); },
      })),
      h('div.form-row',
        ...COMP_LIFTS.map((k) => field(`${LIFTS[k].label} (${U()})`, numInput({
          value: inputNum(S.toDisplay(lifts[k]), 1), step: 2.5,
          oninput: (e) => { st.lifts = { ...lifts, [k]: S.fromDisplay(Number(e.target.value)) }; render(); },
        })))),
      a && h('button.btn', { onclick: () => { st.sex = null; st.bw = null; st.equipment = null; st.lifts = null; render(); } },
        icon('users', 15), `Načíst z profilu · ${a.name}`)),

    h('div.grid', { style: { gap: '16px' } },
      h('section.card', h('div.card-body',
        h('div.readout',
          h('div',
            h('div.eyebrow', `Součet · ${sex === 'm' ? 'muži' : 'ženy'} · ${equipment === 'classic' ? 'klasika' : 'vybavení'}`),
            h('div.readout-num', W(total), h('small', U().toUpperCase())),
            h('div.readout-meta',
              tag(`${Wu(bw, 1)} · ${wc.label}`, 'low'),
              wc.headroom != null && tag(`${num(wc.headroom, 1)} kg do limitu`, wc.headroom < 1 ? 'warn' : 'neutral')))))),
      h('div.grid.g3',
        h('div.stat', { dataset: { tone: 'hero' } }, h('div.stat-label', 'IPF GL Points'), h('div.stat-value', num(gl, 2)), h('div.faint.mono', { style: { fontSize: '11px' } }, 'oficiální od 2020')),
        h('div.stat', h('div.stat-label', 'DOTS'), h('div.stat-value', num(d, 2)), h('div.faint.mono', { style: { fontSize: '11px' } }, 'nezávislý standard')),
        h('div.stat', h('div.stat-label', 'Wilks'), h('div.stat-value', num(wk, 2)), h('div.faint.mono', { style: { fontSize: '11px' } }, 'původní, 1994'))))));

  /* ---- vliv tělesné váhy ---- */
  // GL se pohybuje kolem 80, DOTS kolem 400 — na společné ose by obě křivky
  // vyšly ploché. Proto se kreslí procentní změna proti dnešní váze.
  const bws = [];
  for (let x = Math.max(45, Math.round(bw) - 10); x <= Math.round(bw) + 10; x += 1) bws.push(x);
  const rel = (fn, base) => bws.map((x) => ({ x, value: ((fn(x) - base) / base) * 100 }));

  root.append(card('Vliv tělesné váhy', {
    eyebrow: `Stejný součet ${Wu(total)}, jiná tělesná váha`,
  },
    lineChart([
      { color: 'var(--red)', points: rel((x) => C.ipfGL(total, x, sex, equipment), gl), dots: false },
      { color: 'var(--blue)', points: rel((x) => C.dots(total, x, sex), d), area: false, dots: false },
    ], {
      height: 200,
      fmt: (v) => `${v >= 0 ? '+' : ''}${fixed(v, 1)} %`,
      xFmt: (v) => `${fixed(v, 0)} ${U()}`,
    }),
    h('div.split-legend',
      h('div.split-item', h('i', { style: { background: 'var(--red)' } }), h('span.split-name', 'IPF GL')),
      h('div.split-item', h('i', { style: { background: 'var(--blue)' } }), h('span.split-name', 'DOTS')),
      h('span.faint', { style: { fontSize: '12px' } }, `Nula = dnešních ${Wu(bw, 1)}`)),
    table(
      [`Tělesná váha (${U()})`, { label: 'IPF GL', num: true }, { label: 'DOTS', num: true }, { label: 'Wilks', num: true }],
      [-4, -2, 0, 2, 4].map((delta) => {
        const b = bw + delta;
        const g2 = C.ipfGL(total, b, sex, equipment);
        return {
          tone: delta === 0 ? 'ok' : null,
          cells: [
            h(delta === 0 ? 'b' : 'span', { class: 'mono' }, `${fixed(S.toDisplay(b), 1)}${delta ? ` (${delta > 0 ? '+' : ''}${delta})` : ''}`),
            { num: true, value: h('span', fixed(g2, 2), h('span.faint', { style: { marginLeft: '6px' } }, delta ? `${g2 - gl >= 0 ? '+' : '−'}${fixed(Math.abs(g2 - gl), 2)}` : '')) },
            { num: true, value: fixed(C.dots(total, b, sex), 2) },
            { num: true, value: fixed(C.wilks(total, b, sex), 2) },
          ],
        };
      })),
    h('p.note', 'Shazovat se vyplatí jen tehdy, když součet neklesne o víc, než kolik získáš na koeficientu. U těžších závodníků je křivka plošší — tam shazování skoro nic nepřinese.')));

  /* ---- kolik je potřeba ---- */
  root.append(h('div.grid.g-side',
    card('Kolik je potřeba', { eyebrow: 'Součet na kulaté skóre', class: 'is-flush' },
      h('div', { style: { padding: '0 24px 24px' } },
        table(
          ['Cíl IPF GL', { label: `Součet (${U()})`, num: true }, { label: 'Rozdíl', num: true }, { label: 'DOTS', num: true }],
          [60, 70, 80, 90, 100, 110].map((targetGl) => {
            const need = neededTotal(targetGl, bw, sex, equipment);
            return {
              tone: Math.abs(need - total) < 5 ? 'ok' : null,
              cells: [
                h('b', String(targetGl)),
                { num: true, value: fixed(S.toDisplay(need), 1) },
                { num: true, value: h('span', { style: { color: need > total ? 'var(--yellow)' : 'var(--green)' } }, `${need > total ? '+' : '−'}${fixed(Math.abs(S.toDisplay(need - total)), 1)}`) },
                { num: true, value: fixed(C.dots(need, bw, sex), 1) },
              ],
            };
          })))),

    card('Váhové kategorie', { eyebrow: `IPF · ${sex === 'm' ? 'muži' : 'ženy'}`, class: 'is-flush' },
      h('div', { style: { padding: '0 24px 24px' } },
        table(
          ['Kategorie', { label: 'GL při stejném součtu', num: true }, { label: 'Rozdíl', num: true }],
          WEIGHT_CLASSES[sex].map((limit, i, arr) => {
            const ref = limit === Infinity ? arr[i - 1] + 20 : limit;
            const v = C.ipfGL(total, ref, sex, equipment);
            const isMine = wc.limit === limit;
            return {
              tone: isMine ? 'ok' : null,
              cells: [
                h(isMine ? 'b' : 'span', limit === Infinity ? `${arr[i - 1]}+ kg` : `do ${limit} kg`),
                { num: true, value: fixed(v, 2) },
                { num: true, value: h('span.faint', `${v - gl >= 0 ? '+' : '−'}${fixed(Math.abs(v - gl), 2)}`) },
              ],
            };
          }))))));
}

/** Zpětně: jaký součet je potřeba na dané IPF GL body. */
function neededTotal(targetGl, bw, sex, equipment) {
  const one = C.ipfGL(1000, bw, sex, equipment);
  if (!one) return 0;
  return C.round((targetGl / one) * 1000, 1);
}
