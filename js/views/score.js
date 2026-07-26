import { h, card, stat, icon, num, fixed, tag, table, field, numInput, inputNum, select, segmented, clear } from '../ui.js';
import { lineChart } from '../charts.js';
import * as S from '../store.js';
import * as C from '../calc.js';
import { LIFTS, COMP_LIFTS, WEIGHT_CLASSES, STRENGTH_P90 } from '../data.js';
import { W, U, Wu, liftDot, flagRow } from './_util.js';

const st = { sex: null, bw: null, equipment: null, lifts: null, age: null, source: 'athlete' };

export function scoreView() {
  const root = h('div.view');
  const render = () => { clear(root); build(root, render); };
  render();
  return root;
}

/**
 * Věkový koeficient. Násobí se body, ne kilogramy — je to úprava skóre,
 * ne přepočet součtu.
 */
function ageCoeffCard(adj, dotsPoints, wilksPoints) {
  return card('Věkový koeficient', {
    eyebrow: `${adj.age} let · McCulloch / Foster ve variantě OpenPowerlifting`,
    action: tag(adj.coeff === 1 ? 'Bez úpravy' : `× ${fixed(adj.coeff, 3)}`, adj.coeff === 1 ? 'neutral' : 'ok'),
  },
    table(
      ['Skóre', { label: 'Bez úpravy', num: true }, { label: 'Po úpravě na věk', num: true }],
      [
        ['IPF GL', { num: true, value: num(adj.points, 2) }, { num: true, value: h('b', num(adj.adjusted, 2)) }],
        ['DOTS', { num: true, value: num(dotsPoints, 2) }, { num: true, value: h('b', num(dotsPoints == null ? null : dotsPoints * adj.coeff, 2)) }],
        ['Wilks', { num: true, value: num(wilksPoints, 2) }, { num: true, value: h('b', num(wilksPoints == null ? null : wilksPoints * adj.coeff, 2)) }],
      ]),

    adj.coeff === 1 && h('p.note', 'Mezi 23 a 40 lety je koeficient 1,000 — v tomhle věku se skóre neupravuje.'),

    !adj.solid && h('div.flag', { dataset: { tone: 'warn' } },
      icon('alert', 16),
      h('span', `Pro věk ${adj.age} let je koeficient ve zdroji označený jako odhad, ne jako dohodnutá federační hodnota. `
        + 'Spolehlivé pásmo tabulky je 14 až 90 let.')),

    h('p.note',
      'Koeficient se násobí body, ne součtem v kilogramech — je to úprava skóre, ne přepočet výkonu. '
      + 'Tabulka nemá publikovanou odvozovací rovnici: je to historicky dohodnutá federační norma '
      + 'odvozená z výsledků, ne výsledek výzkumu.'),

    h('p.note', { style: { color: 'var(--ink-3)' } },
      'Appka počítá variantu OpenPowerlifting (Fosterovy koeficienty pro dorost 14–22, Glossbrennerem '
      + 'opravený McCulloch pro 41–80, USAPL pro 81–90). WRPF používá pro stejné věky jiná čísla — '
      + 'například v 60 letech 1,380 místo 1,340 — a nad 80 let tabulku zastropuje. Před nominací '
      + 'si ověř, kterou variantu federace, kde startuješ, uznává.'));
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
  const age = st.age;
  const ageAdj = age ? C.ageAdjusted(gl, age) : null;

  root.append(h('div.grid.g-side-l',
    card('Zadání', { eyebrow: 'Závodník a výkony' },
      h('div.form-row',
        field('Pohlaví', segmented([{ value: 'm', label: 'Muži' }, { value: 'f', label: 'Ženy' }], sex, (v) => { st.sex = v; render(); })),
        field('Provedení', segmented([{ value: 'classic', label: 'Klasika' }, { value: 'equipped', label: 'Vybavení' }], equipment, (v) => { st.equipment = v; render(); }))),
      h('div.form-row',
        field(`Tělesná váha (${U()})`, numInput({
          value: inputNum(S.toDisplay(bw), 1), step: 0.1,
          oninput: (e) => { st.bw = S.fromDisplay(Number(e.target.value)); render(); },
        })),
        field('Věk', numInput({
          value: age ?? '', step: 1, min: 5, max: 100, placeholder: 'nepovinné',
          oninput: (e) => { const v = Number(e.target.value); st.age = v > 0 ? v : null; render(); },
        }), 'Jen pro masters a dorost — koeficient se jinak neuplatní.')),
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
        h('div.stat', h('div.stat-label', 'Wilks'), h('div.stat-value', num(wk, 2)), h('div.faint.mono', { style: { fontSize: '11px' } }, 'původní, 1994'))),
      ageAdj && ageCoeffCard(ageAdj, d, wk))));

  root.append(percentileCard(lifts, bw, sex, age));

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
      { color: 'var(--series-1)', label: 'IPF GL', points: rel((x) => C.ipfGL(total, x, sex, equipment), gl), area: false },
      { color: 'var(--series-2)', label: 'DOTS', points: rel((x) => C.dots(total, x, sex), d), area: false },
    ], {
      height: 200,
      fmt: (v) => `${v >= 0 ? '+' : ''}${fixed(v, 1)} %`,
      xFmt: (v) => `${fixed(v, 0)} ${U()}`,
    }),
    h('div.split-legend',
      h('div.split-item', h('i', { style: { background: 'var(--series-1)' } }), h('span.split-name', 'IPF GL')),
      h('div.split-item', h('i', { style: { background: 'var(--series-2)' } }), h('span.split-name', 'DOTS')),
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
                { num: true, value: h('span', { style: { color: need > total ? 'var(--warn)' : 'var(--ok)' } }, `${need > total ? '+' : '−'}${fixed(Math.abs(S.toDisplay(need - total)), 1)}`) },
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

/* =========================================================
   Percentily relativní síly
   ========================================================= */
function percentileCard(lifts, bw, sex, age) {
  const rows = COMP_LIFTS
    .map((k) => C.strengthPercentile(k, lifts[k], bw, sex, age))
    .filter(Boolean);
  if (!rows.length) return h('div');

  const above = rows.filter((r) => r.above).length;
  const group = rows[0];

  return card('Proti populaci', {
    eyebrow: `90. percentil · ${group.groupLabel} · ${sex === 'f' ? 'ženy' : 'muži'} · násobky tělesné váhy`,
    action: tag(`${above} ze 3 nad hranicí`, above === 3 ? 'ok' : above ? 'neutral' : 'warn'),
  },
    table(
      ['Cvik',
        { label: 'Násobek váhy', num: true },
        { label: '90. percentil', num: true },
        { label: `Chybí (${U()})`, num: true },
        'Stav'],
      rows.map((r) => ({
        tone: r.above ? 'ok' : null,
        cells: [
          h('span', liftDot(r.lift), LIFTS[r.lift].label),
          { num: true, value: `${fixed(r.ratio, 2)}×` },
          { num: true, value: `${fixed(r.p90, 2)}×` },
          { num: true, value: r.above ? '—' : W(r.gapKg, 1) },
          tag(r.above ? 'v nejlepší desetině' : `${r.pctOfP90} % hranice`, r.above ? 'ok' : 'neutral'),
        ],
      }))),

    group.approxAge && flagRow({
      tone: 'low',
      text: 'Ověřená data existují jen pro 18–35 let a pro věk nad 80. Pro tenhle věk se použila mladší skupina, '
        + 'což je přísnější měřítko — skutečná hranice pro daný věk bude o něco níž.',
    }),

    h('p.note',
      'Normativní data z 809 986 startů (J Sci Med Sport 2024). Je to jiný pohled než DOTS nebo IPF GL: '
      + 'ty normalizují na tělesnou váhu koeficientem, tohle je prostý násobek. Pro laika je srozumitelnější, '
      + 'na srovnání napříč kategoriemi je ale horší.'),

    h('p.note', { style: { color: 'var(--ink-3)' } },
      'Appka ukazuje jen 90. percentil, protože jen ten se podařilo z placeného textu ověřit — a jen pro dvě '
      + 'věkové skupiny. Dopočítat zbytek tabulky interpolací a vydávat ho za data by byl výmysl, takže se tu '
      + 'nedozvíš „jsi na 63. percentilu", jen jestli jsi nad hranicí nejlepší desetiny, nebo pod ní.'));
}
