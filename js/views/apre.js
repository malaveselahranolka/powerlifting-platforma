import { h, card, stat, icon, tag, table, field, numInput, inputNum, num, select, clear, toast } from '../ui.js';
import * as S from '../store.js';
import * as C from '../calc.js';
import { LIFTS, COMP_LIFTS } from '../data.js';
import { W, U, empty } from './_util.js';

const st = { lift: 'squat', amrap: null, override: null };

export function apreView(nav) {
  const root = h('div.view');
  const render = () => { clear(root); build(root, render, nav); };
  render();
  return root;
}

function build(root, render, nav) {
  const a = S.athlete();
  if (!a) {
    root.append(empty('Nejdřív si založ svěřence.',
      h('button.btn.btn-primary', { onclick: () => nav('athletes') }, 'Přidat svěřence')));
    return;
  }

  const saved = a.apre?.[st.lift];
  // Chybí-li uložené 6RM, odvodí se z aktuálního E1RM přes tu samou RPE
  // tabulku, kterou appka používá všude jinde — ne z libovolné konstanty.
  const derivedPct = C.rpeToPct(6, 10);
  const derived = derivedPct ? C.roundToBar(((a.e1rm[st.lift] ?? 0) * derivedPct) / 100) : 0;
  const sixRm = st.override ?? saved?.sixRm ?? derived;

  const ramp = C.apreRamp(sixRm);
  const adjust = st.amrap != null && st.amrap >= 0 ? C.apreAdjust(sixRm, st.amrap) : null;

  root.append(h('div.btn-row',
    h('div.field', { style: { minWidth: '200px' } },
      h('span.field-label', 'Cvik'),
      select(COMP_LIFTS.map((k) => ({ value: k, label: LIFTS[k].label })), {
        value: st.lift,
        onchange: (e) => { st.lift = e.target.value; st.amrap = null; st.override = null; render(); },
      }))));

  root.append(h('div.grid.g-side-l',
    card('Šestiopakovací maximum', {
      eyebrow: saved
        ? `Naposledy uloženo ${saved.updatedAt}`
        : `Odvozeno z E1RM · ${num(derivedPct, 1)} % (RPE tabulka, 6 op. @ RPE 10)`,
    },
      h('div.form-row',
        field(`6RM (${U()})`, numInput({
          value: inputNum(S.toDisplay(sixRm), 1),
          step: 2.5,
          oninput: (e) => { st.override = S.fromDisplay(Number(e.target.value)); render(); },
        }))),
      h('p.note', 'Appka odhadne 6RM z aktuálního E1RM, dokud ho sám neuložíš z výsledku série 3. Znáš-li přesnější číslo, přepiš ho ručně.')),

    card('Rozcvička a testovací série', { eyebrow: 'APRE-6 · Mann a kol. (2010)', class: 'is-flush' },
      h('div', { style: { padding: '0 24px 24px' } },
        table(
          ['Série', { label: '% ze 6RM', num: true }, { label: `Váha (${U()})`, num: true }, 'Opakování'],
          ramp.map((r) => ({
            cells: [
              h('b', `Série ${r.set}`),
              { num: true, value: `${r.pct} %` },
              { num: true, value: h('b', W(r.weight, 1)) },
              r.reps ? `${r.reps}` : h('span', { style: { color: 'var(--yellow)' } }, 'AMRAP — co nejvíc'),
            ],
          }))),
        h('p.note', { style: { marginTop: '10px' } },
          'Série 1 a 2 jsou rozcvička na pevný počet opakování. Série 3 se jede do momentu, kdy by další opakování nešlo — počet se zapíše dole.')))));

  root.append(card('Opakování na sérii 3', {
    eyebrow: 'Podle tohohle čísla appka dopočítá sérii 4 i doporučený start příště',
  },
    h('div.form-row',
      field('Skutečná opakování (AMRAP)', numInput({
        value: st.amrap ?? '', min: 0, max: 30, step: 1,
        oninput: (e) => { st.amrap = e.target.value === '' ? null : Math.max(0, Number(e.target.value)); render(); },
      }))),
    adjust && h('div', { style: { marginTop: '8px' } },
      h('div.grid.g2',
        stat('Série 4 (a start příště)', W(adjust.weight, 1), U()),
        stat('Úprava proti dnešnímu 6RM', `${adjust.adjustPct >= 0 ? '+' : ''}${adjust.adjustPct}`, '%', adjust.adjustPct < 0 ? 'warn' : 'ok')),
      h('p.note', { style: { marginTop: '10px' } }, tag(adjust.label, adjust.adjustPct < 0 ? 'warn' : 'ok'), ' na sérii 3.'),
      h('button.btn.btn-primary', {
        style: { marginTop: '10px' },
        onclick: () => {
          S.commit((s) => {
            const at = s.athletes.find((x) => x.id === s.activeAthlete);
            (at.apre ??= {})[st.lift] = { sixRm: adjust.weight, updatedAt: S.iso(new Date()) };
          });
          st.override = null;
          st.amrap = null;
          toast(`${LIFTS[st.lift].label}: nové 6RM ${W(adjust.weight, 1)} ${U()}`);
          render();
        },
      }, icon('check', 16), 'Uložit jako nové 6RM pro příště'))));

  const matchedBand = st.amrap != null ? (C.APRE_BANDS.find((b) => st.amrap <= b.max) ?? C.APRE_BANDS.at(-1)) : null;

  root.append(card('Celá adjustační tabulka', { eyebrow: 'Procentní adaptace originální (librové) tabulky', class: 'is-flush' },
    h('div', { style: { padding: '0 24px 24px' } },
      table(
        ['Opakování na sérii 3', { label: 'Úprava', num: true }, { label: `Nová váha (${U()})`, num: true }],
        C.APRE_BANDS.map((b) => ({
          class: b === matchedBand ? 'is-on' : null,
          cells: [
            b.label,
            { num: true, value: `${b.adjust >= 0 ? '+' : ''}${Math.round(b.adjust * 100)} %` },
            { num: true, value: W(C.roundToBar(sixRm * (1 + b.adjust)), 1) },
          ],
        }))),
      h('p.note', { style: { marginTop: '12px' } },
        'Originální studie měřila v librách na konkrétních strojích (bench, leg press, hang clean) — appka bere stejné pásmo jako procento aktuálního 6RM, ať jde o dřep, benč nebo mrtvý tah, v kilogramech i librách.'))));
}
