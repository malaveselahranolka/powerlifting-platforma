import { h, card, icon, num, pct, tag, field, numInput, inputNum, select, clear, table } from '../ui.js';
import { barbell } from '../charts.js';
import * as S from '../store.js';
import * as C from '../calc.js';
import { RPE_STEPS, REP_STEPS, LIFTS, COMP_LIFTS, PRILEPIN } from '../data.js';
import { W, U, Wu, rpeLabel } from './_util.js';

const st = { lift: 'squat', e1rm: null, pick: { reps: 3, rpe: 8 } };

export function rpeView() {
  const root = h('div.view');
  const render = () => { clear(root); build(root, render); };
  render();
  return root;
}

function build(root, render) {
  const a = S.athlete();
  const e1 = st.e1rm ?? (a?.e1rm[st.lift] ?? 200);
  const pickPct = C.rpeToPct(st.pick.reps, st.pick.rpe);
  const pickWeight = pickPct ? C.roundToBar((e1 * pickPct) / 100, { unit: 'kg' }) : null;
  const load = pickWeight ? S.loadFor(pickWeight) : null;

  /* ---- ovládání ---- */
  root.append(card('Základ', { eyebrow: 'Z čeho se počítá' },
    h('div.form-row',
      field('Cvik', select(COMP_LIFTS.map((k) => ({ value: k, label: LIFTS[k].label })), {
        value: st.lift, onchange: (e) => { st.lift = e.target.value; st.e1rm = null; render(); },
      })),
      field(`E1RM (${U()})`, numInput({
        value: inputNum(S.toDisplay(e1), 1),
        step: 2.5,
        oninput: (e) => { st.e1rm = S.fromDisplay(Number(e.target.value)); render(); },
      })),
      a && field('Převzít od svěřence', h('button.btn', { onclick: () => { st.e1rm = null; render(); } }, `${a.name} · ${Wu(a.e1rm[st.lift])}`)))));

  /* ---- mřížka ---- */
  const grid = h('div.rpe-grid');
  grid.append(h('div.rpe-h.is-row', 'RPE ↓'));
  for (const r of REP_STEPS) grid.append(h('div.rpe-h', `${r}`));

  for (const rpe of RPE_STEPS) {
    grid.append(h('div.rpe-h.is-row', rpeLabel(rpe)));
    for (const reps of REP_STEPS) {
      const p = C.rpeToPct(reps, rpe);
      if (p == null) { grid.append(h('div.rpe-h', '·')); continue; }
      const wt = C.roundToBar((e1 * p) / 100, { unit: 'kg' });
      const zone = C.prilepinZone(p);
      const on = st.pick.reps === reps && st.pick.rpe === rpe;
      grid.append(h('button.rpe-cell', {
        type: 'button',
        class: on ? 'is-on' : null,
        dataset: { zone: zone.key },
        title: `${reps} opakování @ RPE ${rpe} = ${num(p, 1)} % → ${Wu(wt)}`,
        onclick: () => { st.pick = { reps, rpe }; render(); },
      }, h('b', W(wt, 0)), h('span', `${num(p, 1)} %`)));
    }
  }

  root.append(card('RPE tabulka', {
    eyebrow: `Sloupce = opakování, řádky = RPE · hodnoty pro E1RM ${Wu(e1)}`,
    class: 'is-flush',
    action: h('div.zone-legend',
      ...PRILEPIN.map((z) => h('div.zone-item', h('i', { style: { background: z.color } }), z.label))),
  },
    h('div', { style: { padding: '0 24px 24px', overflowX: 'auto' } }, grid)));

  /* ---- vybraná buňka ---- */
  root.append(h('div.grid.g-side',
    h('section.card', h('div.card-body',
      h('div.readout',
        h('div',
          h('div.eyebrow', `${LIFTS[st.lift].label} · ${st.pick.reps} opakování @ RPE ${rpeLabel(st.pick.rpe)}`),
          h('div.readout-num', pickWeight ? W(pickWeight) : '—', h('small', U().toUpperCase())),
          h('div.readout-meta',
            tag(`${pct(pickPct, 1)} z 1RM`, 'neutral'),
            tag(`RIR ${C.rir(st.pick.rpe)}`, 'low'),
            tag(C.prilepinZone(pickPct).label, 'neutral'))),
        load && h('div.readout-bar', h('div.eyebrow', 'Nakládání'), barbell(load))))),

    card('Jak RPE číst', { eyebrow: 'Škála podle Tuchscherera' },
      table(['RPE', 'Co to znamená'], [
        ['10', 'Maximum. Nic dalšího by nevyjelo.'],
        ['9,5', 'Možná ještě jedno, určitě ne dvě.'],
        ['9', 'Zbývalo přesně jedno opakování.'],
        ['8,5', 'Jedno jistě, druhé možná.'],
        ['8', 'Zbývala dvě opakování.'],
        ['7', 'Zbývala tři. Rychlost tyče ještě svižná.'],
        ['6', 'Čtyři a víc. Technická práce.'],
      ]),
      h('p.note', 'Tabulka není zákon. U každého závodníka si po pár týdnech ověř, jestli jeho RPE 8 opravdu odpovídá dvěma opakováním v záloze — někdo systematicky podhodnocuje.'))));
}
