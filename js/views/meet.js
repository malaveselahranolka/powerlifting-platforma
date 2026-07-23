import { h, card, stat, icon, num, tag, table, field, numInput, select, segmented, clear, longDate } from '../ui.js';
import { barbell } from '../charts.js';
import * as S from '../store.js';
import * as C from '../calc.js';
import { ATTEMPT_STRATEGY, ATTEMPT_JUMPS, LIFTS, COMP_LIFTS } from '../data.js';
import { W, U, Wu, liftDot, empty } from './_util.js';

const st = { strategy: 'standard', date: null, overrides: {}, lift: 'squat' };

export function meetView(nav) {
  const root = h('div.view');
  const render = () => { clear(root); build(root, render, nav); };
  render();
  return root;
}

function build(root, render, nav) {
  const a = S.athlete();
  if (!a) { root.append(empty('Vyber svěřence.', h('button.btn.btn-primary', { onclick: () => nav('athletes') }, 'Přidat svěřence'))); return; }

  const strat = ATTEMPT_STRATEGY[st.strategy];
  const plan = {};
  for (const k of COMP_LIFTS) {
    plan[k] = st.overrides[k] ?? C.attempts(a.e1rm[k], strat.pct, 'kg');
  }

  const projected = COMP_LIFTS.reduce((s2, k) => s2 + plan[k][2], 0);
  const safe = COMP_LIFTS.reduce((s2, k) => s2 + plan[k][0], 0);
  const wc = C.weightClass(a.bw, a.sex);

  /* ---- strategie ---- */
  root.append(card('Plán závodu', {
    eyebrow: a.name,
    action: segmented(Object.entries(ATTEMPT_STRATEGY).map(([k, v]) => ({ value: k, label: v.label })), st.strategy,
      (v) => { st.strategy = v; st.overrides = {}; render(); }),
  },
    h('div.form-row',
      field('Datum závodu', h('input.input', {
        type: 'date', value: st.date ?? '',
        onchange: (e) => { st.date = e.target.value || null; render(); },
      })),
      field('Tělesná váha (kg)', numInput({
        value: a.bw, step: 0.1,
        oninput: (e) => { S.commit((s) => { s.athletes.find((x) => x.id === a.id).bw = Number(e.target.value); }); render(); },
      })),
      field('Kategorie', h('div.input', { style: { display: 'flex', alignItems: 'center' } },
        `${a.sex === 'm' ? 'Muži' : 'Ženy'} · ${wc.label}`))),
    h('p.note', strat.note),
    st.date && (() => {
      const days = C.daysBetween(new Date(), st.date);
      if (days < 0) return h('p.note', `Závod byl ${longDate(st.date)}. Zapiš výsledky a postav nový blok.`);
      const weeks = Math.floor(days / 7);
      return h('div.flag', { dataset: { tone: days <= 7 ? 'warn' : 'low' } },
        icon(days <= 7 ? 'alert' : 'calendar', 16),
        h('span', days === 0 ? 'Závod je dnes.'
          : `Do závodu zbývá ${days} ${days === 1 ? 'den' : days < 5 ? 'dny' : 'dní'}${weeks >= 2 ? ` (${weeks} týdny)` : ''}. `,
          days > 7 && weeks <= 3 ? 'Poslední týden nech jako taper.' : ''));
    })(),
    wc.headroom != null && h('div.flag', { dataset: { tone: wc.headroom < 1 ? 'warn' : 'ok' } },
      icon(wc.headroom < 1 ? 'alert' : 'check', 16),
      h('span', wc.headroom >= 0
        ? `Do limitu kategorie ${wc.label} zbývá ${num(wc.headroom, 1)} kg.`
        : `Nad limitem o ${num(-wc.headroom, 1)} kg.`,
        wc.cutTo != null && wc.cutTo > 0 ? ` Shodit do kategorie ${wc.cutLabel} znamená ${num(wc.cutTo, 1)} kg dolů.` : ''))));

  /* ---- souhrn ---- */
  root.append(h('div.grid.g4',
    h('div.stat', { dataset: { tone: 'hero' } },
      h('div.stat-label', 'Součet při 9 z 9'),
      h('div.stat-value', W(projected), h('span.stat-unit', U()))),
    stat('Jistý součet (otvíráky)', W(safe), U()),
    stat('DOTS při plném součtu', num(C.dots(projected, a.bw, a.sex), 1)),
    stat('IPF GL při plném součtu', num(C.ipfGL(projected, a.bw, a.sex, a.equipment), 1))));

  /* ---- pokusy ---- */
  root.append(h('div.grid.g3',
    ...COMP_LIFTS.map((k) => card(LIFTS[k].label, {
      eyebrow: `E1RM ${Wu(a.e1rm[k])}`,
      action: tag(`3. pokus ${num((plan[k][2] / a.e1rm[k]) * 100, 0)} %`, plan[k][2] > a.e1rm[k] ? 'warn' : 'neutral'),
    },
      jumpCheck(k, plan[k]),
      ...plan[k].map((wt, i) => h('div.attempt', { dataset: { n: String(i + 1) } },
        h('div.attempt-n', i + 1),
        h('div',
          h('div.attempt-w', W(wt), h('span.stat-unit', U())),
          h('div.faint.mono', { style: { fontSize: '10.5px' } }, `${num((wt / a.e1rm[k]) * 100, 1)} % z E1RM`)),
        h('div.btn-row',
          h('button.btn.btn-ghost.btn-icon', {
            'aria-label': `${LIFTS[k].label}, ${i + 1}. pokus o 2,5 kg níž`,
            onclick: () => { bump(k, i, -2.5, plan); render(); },
          }, '−'),
          h('button.btn.btn-ghost.btn-icon', {
            'aria-label': `${LIFTS[k].label}, ${i + 1}. pokus o 2,5 kg výš`,
            onclick: () => { bump(k, i, 2.5, plan); render(); },
          }, '+')))),
      h('div', h('div.eyebrow', 'Otvírák na ose'),
        barbell(S.loadFor(plan[k][0], { barKg: barFor(k, a) }), { height: 76 }))))));

  /* ---- rozcvičení ---- */
  root.append(card('Rozcvičení', {
    eyebrow: 'Žebřík k prvnímu pokusu',
    action: segmented(COMP_LIFTS.map((k) => ({ value: k, label: LIFTS[k].label })), st.lift, (v) => { st.lift = v; render(); }),
    class: 'is-flush',
  }, (() => {
    const opener = plan[st.lift][0];
    const barKg = barFor(st.lift, a);
    const ladder = C.warmupLadder(opener, barKg, 'kg');
    let elapsed = ladder.totalMin;
    return h('div', { style: { padding: '0 24px 24px' } },
      table(
        ['Série', { label: `Váha (${U()})`, num: true }, { label: 'Opakování', num: true }, { label: 'Pauza', num: true }, { label: 'Před pokusem', num: true }, 'Kotouče'],
        [
          ...ladder.sets.map((s2, i) => {
            const before = elapsed;
            elapsed -= s2.rest;
            return [
              h('span.mono', `W${i + 1}`),
              { num: true, value: W(s2.weight) },
              { num: true, value: s2.reps },
              { num: true, value: `${s2.rest} min` },
              { num: true, value: h('span.faint', `−${before} min`) },
              h('div.plate-legend', ...S.loadFor(s2.weight, { barKg, noCollars: true }).plates.map((p) =>
                h('div.plate-chip', h('i', { style: { background: p.color } }), `${p.count}×${num(p.kg, 2)}`))),
            ];
          }),
          {
            tone: 'ok',
            cells: [
              h('b', '1. pokus'),
              { num: true, value: h('b', W(opener)) },
              { num: true, value: 1 },
              { num: true, value: '—' },
              { num: true, value: h('span.mono', '0') },
              h('div.plate-legend', ...S.loadFor(opener, { barKg }).plates.map((p) =>
                h('div.plate-chip', h('i', { style: { background: p.color } }), `${p.count}×${num(p.kg, 2)}`))),
            ],
          },
        ]),
      h('p.note', { style: { marginTop: '12px' } },
        `Celé rozcvičení zabere zhruba ${ladder.totalMin} minut. Poslední rozcvičovací sérii dej maximálně 10 minut před prvním pokusem — pak už jen dýchat.`));
  })()));

  /* ---- cíle ---- */
  root.append(card('Kam to míří', { eyebrow: 'Skóre při různých součtech', class: 'is-flush' },
    h('div', { style: { padding: '0 24px 24px' } },
      table(
        [`Součet (${U()})`, { label: 'DOTS', num: true }, { label: 'IPF GL', num: true }, { label: 'Wilks', num: true }, 'Poznámka'],
        [-20, -10, 0, 10, 20, 30].map((d) => {
          const t = projected + d;
          return {
            tone: d === 0 ? 'ok' : null,
            cells: [
              h(d === 0 ? 'b' : 'span', { class: 'mono' }, W(t)),
              { num: true, value: num(C.dots(t, a.bw, a.sex), 1) },
              { num: true, value: num(C.ipfGL(t, a.bw, a.sex, a.equipment), 1) },
              { num: true, value: num(C.wilks(t, a.bw, a.sex), 1) },
              h('span.faint', { style: { fontSize: '12px' } },
                d === 0 ? 'plán 9 z 9' : d < 0 ? 'když jeden pokus nevyjde' : 'když třetí pokusy sednou nad plán'),
            ],
          };
        })))));
}

/** Ženy jedou benčpres na 15kg ose, zbytek na dvacítce. */
const barFor = (lift, a) => (lift === 'bench' && a.sex === 'f' ? 15 : S.state.bar);

/**
 * Skoky mezi pokusy. Na dřepu a tahu se běžně jde po 5 až 7,5 %,
 * na benči po 3 až 5 % — tam menší přírůstek znamená větší rozdíl.
 */
function jumpCheck(lift, attempts) {
  const [lo, hi] = ATTEMPT_JUMPS[lift];
  const jumps = [1, 2].map((i) => ({
    from: i,
    pct: ((attempts[i] - attempts[i - 1]) / attempts[i - 1]) * 100,
    kg: attempts[i] - attempts[i - 1],
  }));

  const off = jumps.filter((j) => j.pct < lo - 0.5 || j.pct > hi + 0.5);
  const tone = off.length ? 'warn' : 'ok';

  return h('div.jumps', { dataset: { tone } },
    ...jumps.map((j) => h('div.jump',
      h('span.jump-arrow', `${j.from}. → ${j.from + 1}.`),
      h('span.jump-val', `+${num(S.toDisplay(j.kg), 1)} ${U()}`),
      h('span.jump-pct', { dataset: { off: String(j.pct < lo - 0.5 || j.pct > hi + 0.5) } }, `${num(j.pct, 1)} %`))),
    h('span.jump-ref', `doporučeno ${lo}–${hi} %`));
}

function bump(lift, idx, deltaKg, plan) {
  const next = [...plan[lift]];
  next[idx] = C.roundToBar(next[idx] + deltaKg, { unit: 'kg' });
  st.overrides[lift] = next;
}
