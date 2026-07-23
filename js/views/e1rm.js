import { h, card, stat, icon, num, pct, tag, table, field, numInput, inputNum, select, segmented, clear, toast } from '../ui.js';
import { barbell } from '../charts.js';
import * as S from '../store.js';
import * as C from '../calc.js';
import { FORMULAS, LIFTS, COMP_LIFTS, RPE_STEPS } from '../data.js';
import { W, U, Wu, liftDot, rpeLabel } from './_util.js';

const st = { mode: 'toE1rm', weight: 180, reps: 5, rpe: 8, lift: 'squat', method: 'rpe', target: { reps: 3, rpe: 8 } };

export function e1rmView() {
  const root = h('div.view');
  const render = () => {
    clear(root);
    build(root, render);
  };
  render();
  return root;
}

function build(root, render) {
  const a = S.athlete();
  const inKg = (v) => S.fromDisplay(v);

  root.append(h('div.btn-row',
    segmented([
      { value: 'toE1rm', label: 'Z výkonu → E1RM' },
      { value: 'toWeight', label: 'Z E1RM → váha na ose' },
    ], st.mode, (v) => { st.mode = v; render(); })));

  st.mode === 'toE1rm' ? forward(root, render, a, inKg) : reverse(root, render, a, inKg);
}

/* =========================================================
   Výkon → E1RM
   ========================================================= */
function forward(root, render, a, inKg) {
  const weightKg = inKg(st.weight);
  const all = C.allE1RM(weightKg, st.reps, st.rpe);
  const chosen = all[st.method];
  const consensus = C.consensusE1RM(weightKg, st.reps);
  const usedPct = st.method === 'rpe' ? C.rpeToPct(st.reps, st.rpe) : (chosen ? (weightKg / chosen) * 100 : null);
  const vals = Object.values(all).filter((v) => v != null);
  const spread = vals.length ? Math.max(...vals) - Math.min(...vals) : 0;
  const load = S.loadFor(weightKg);

  root.append(h('div.grid.g-side-l',
    card('Zadání', { eyebrow: 'Co se skutečně zvedlo' },
      h('div.form-row',
        field(`Váha (${U()})`, numInput({ value: st.weight, step: 2.5, min: 0, oninput: (e) => { st.weight = Number(e.target.value); render(); } })),
        field('Opakování', numInput({ value: st.reps, step: 1, min: 1, max: 12, oninput: (e) => { st.reps = Math.min(12, Math.max(1, Number(e.target.value))); render(); } })),
        field('RPE', select(RPE_STEPS.map((r) => ({ value: r, label: rpeLabel(r) })), {
          value: st.rpe, onchange: (e) => { st.rpe = Number(e.target.value); render(); },
        }), `${rpeLabel(C.rir(st.rpe))} v záloze`)),
      h('div.form-row',
        field('Cvik', select(Object.entries(LIFTS).map(([k, v]) => ({ value: k, label: v.label })), {
          value: st.lift, onchange: (e) => { st.lift = e.target.value; render(); },
        })),
        field('Metoda', select(Object.entries(FORMULAS).map(([k, v]) => ({ value: k, label: v.label })), {
          value: st.method, onchange: (e) => { st.method = e.target.value; render(); },
        }))),
      h('p.note', FORMULAS[st.method].note),
      a && COMP_LIFTS.includes(st.lift) && chosen &&
        h('button.btn.btn-primary', {
          onclick: () => {
            S.commit((s) => {
              const at = s.athletes.find((x) => x.id === s.activeAthlete);
              at.e1rm[st.lift] = Math.round(chosen);
              (s.e1rmLog ??= []).push({ id: S.uid(), athleteId: at.id, lift: st.lift, date: S.iso(new Date()), value: Math.round(chosen) });
            });
            toast(`${LIFTS[st.lift].label}: nové E1RM ${Wu(chosen, 0)}`);
            render();
          },
        }, icon('check', 16), `Uložit jako aktuální E1RM pro ${a.name.split(' ')[0]}`)),

    h('div.grid', { style: { gap: '16px' } },
      h('section.card', h('div.card-body',
        h('div.readout',
          h('div',
            h('div.eyebrow', `Odhad 1RM · ${FORMULAS[st.method].label}`),
            h('div.readout-num', chosen ? W(chosen, 1) : '—', h('small', U().toUpperCase())),
            h('div.readout-meta',
              usedPct && tag(`zvednuto na ${pct(usedPct, 1)}`, 'neutral'),
              st.method === 'rpe' && tag(`RIR ${C.rir(st.rpe)}`, 'low'),
              consensus && tag(`medián vzorců ${W(consensus, 0)}`, 'neutral'),
              spread > 0 && tag(`rozptyl ${W(spread, 1)} ${U()}`, spread > weightKg * 0.12 ? 'warn' : 'neutral'))),
          h('div.readout-bar',
            h('div.eyebrow', 'Nakládání osy'),
            barbell(load),
            h('div.faint.mono', { style: { fontSize: '11px', textAlign: 'center' } },
              load.delta === 0 ? `přesně ${Wu(load.total, 2)}` : `nejblíž ${Wu(load.total, 2)} (${load.delta > 0 ? '+' : ''}${num(load.delta, 2)})`))))),

      card('Srovnání vzorců', { eyebrow: 'Stejný výkon, různá matematika' },
        table(
          ['Vzorec', { label: `E1RM (${U()})`, num: true }, { label: 'Rozdíl', num: true }, 'Poznámka'],
          Object.entries(all).map(([k, v]) => ({
            class: k === st.method ? 'is-on' : null,
            cells: [
              h('span', { style: { fontWeight: k === st.method ? 600 : 400 } }, FORMULAS[k].label),
              { num: true, value: v ? W(v, 1) : '—' },
              { num: true, value: v && chosen ? `${v - chosen >= 0 ? '+' : ''}${num(S.toDisplay(v - chosen), 1)}` : '—' },
              h('span.faint', { style: { fontSize: '12px' } }, FORMULAS[k].note),
            ],
          }))),
        h('p.note', 'RPE bere v potaz, jak těžká série reálně byla. Ostatní vzorce znají jen počet opakování — na 1–5 opakování jsou blízko, výš se rozjedou.')))));

  if (chosen) root.append(prescription(chosen));
}

/* =========================================================
   E1RM → váha na ose
   ========================================================= */
function reverse(root, render, a, inKg) {
  const base = st.baseE1rm ?? (a ? a.e1rm[COMP_LIFTS.includes(st.lift) ? st.lift : 'squat'] : 200);
  const e1 = inKg(st.baseE1rm ?? S.toDisplay(base));
  const raw = C.weightFor(e1, st.target.reps, st.target.rpe);
  const rounded = raw != null ? C.roundToBar(raw, { unit: 'kg' }) : null;
  const load = rounded != null ? S.loadFor(rounded) : null;
  const p = C.rpeToPct(st.target.reps, st.target.rpe);

  root.append(h('div.grid.g-side-l',
    card('Zadání', { eyebrow: 'Předpis pro trénink' },
      h('div.form-row',
        field('Cvik', select(Object.entries(LIFTS).map(([k, v]) => ({ value: k, label: v.label })), {
          value: st.lift,
          onchange: (e) => { st.lift = e.target.value; st.baseE1rm = null; render(); },
        })),
        field(`E1RM (${U()})`, numInput({
          value: inputNum(S.toDisplay(e1), 1),
          step: 2.5,
          oninput: (e) => { st.baseE1rm = Number(e.target.value); render(); },
        }))),
      h('div.form-row',
        field('Cílová opakování', numInput({ value: st.target.reps, min: 1, max: 12, step: 1, oninput: (e) => { st.target.reps = Math.min(12, Math.max(1, Number(e.target.value))); render(); } })),
        field('Cílové RPE', select(RPE_STEPS.map((r) => ({ value: r, label: rpeLabel(r) })), {
          value: st.target.rpe, onchange: (e) => { st.target.rpe = Number(e.target.value); render(); },
        }))),
      h('p.note', 'Zaokrouhluje se na 2,5 kg — nejmenší krok, který se dá reálně naložit párem kotoučů.')),

    h('section.card', h('div.card-body',
      h('div.readout',
        h('div',
          h('div.eyebrow', `${LIFTS[st.lift].label} · ${st.target.reps}×${st.target.reps === 1 ? 'jednička' : 'opakování'} @ RPE ${st.target.rpe}`),
          h('div.readout-num', rounded != null ? W(rounded, 1) : '—', h('small', U().toUpperCase())),
          h('div.readout-meta',
            p && tag(`${pct(p, 1)} z 1RM`, 'neutral'),
            raw != null && tag(`přesně ${W(raw, 2)}`, 'neutral'),
            tag(`RIR ${C.rir(st.target.rpe)}`, 'low'))),
        load && h('div.readout-bar',
          h('div.eyebrow', 'Nakládání osy'),
          barbell(load)))))));

  if (e1 > 0) root.append(prescription(e1));
}

/* =========================================================
   Předpisová tabulka pod výsledkem
   ========================================================= */
function prescription(e1) {
  const rows = [];
  for (let r = 1; r <= 10; r++) {
    const cells = [h('span.mono', `${r} op.`)];
    for (const rpe of [10, 9, 8, 7, 6]) {
      const p = C.rpeToPct(r, rpe);
      if (p == null) { cells.push({ num: true, value: '—' }); continue; }
      const wt = C.roundToBar((e1 * p) / 100, { unit: 'kg' });
      const zone = C.prilepinZone(p);
      cells.push({
        num: true,
        value: h('span', { style: { color: zone.color } }, W(wt, 1), h('span.faint', { style: { fontSize: '10.5px', marginLeft: '6px' } }, `${num(p, 0)} %`)),
      });
    }
    rows.push(cells);
  }

  return card('Předpisová tabulka', {
    eyebrow: `Váha na ose podle E1RM ${Wu(e1, 1)} · zaokrouhleno na 2,5 kg`,
    class: 'is-flush',
  },
    h('div', { style: { padding: '0 24px 12px' } },
      table(['Opakování', { label: 'RPE 10', num: true }, { label: 'RPE 9', num: true }, { label: 'RPE 8', num: true }, { label: 'RPE 7', num: true }, { label: 'RPE 6', num: true }], rows)),
    h('div.zone-legend', { style: { padding: '0 24px 20px' } },
      ...[
        { c: 'var(--green)', t: 'pod 70 %' },
        { c: 'var(--yellow)', t: '70–79 %' },
        { c: 'var(--blue)', t: '80–89 %' },
        { c: 'var(--red)', t: '90 % a výš' },
      ].map((z) => h('div.zone-item', h('i', { style: { background: z.c } }), z.t))));
}
