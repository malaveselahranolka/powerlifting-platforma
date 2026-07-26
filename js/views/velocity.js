import { h, card, stat, icon, num, fixed, tag, table, field, numInput, inputNum, select, segmented, decimalInput, clear } from '../ui.js';
import { lineChart } from '../charts.js';
import * as S from '../store.js';
import * as C from '../calc.js';
import { LIFTS, LOAD_VELOCITY, VELOCITY_AT_1RM, MVT, VELOCITY_LOSS } from '../data.js';
import { W, U, Wu, liftDot, empty, flagRow } from './_util.js';

/**
 * Rychlost tyče.
 *
 * Nejdřív na rovinu, co appka měřit neumí a co ne: nemá měřák, takže rychlost
 * musí někdo zadat ručně. Užitečné jsou tři věci a čtvrtá funguje i bez
 * jakéhokoli přístroje:
 *
 *   1. referenční tabulka rychlostí podle intenzity,
 *   2. odhad maxima z vlastního profilu (mrtvý tah vyloučen — nefunguje),
 *   3. práh poklesu rychlosti v sérii,
 *   4. tentýž práh přečtený z propadu opakování a skoku RPE — bez měřáku.
 */

const st = {
  lift: 'squat',
  profile: [
    { weight: 100, velocity: 0.8 },
    { weight: 130, velocity: 0.6 },
    { weight: 160, velocity: 0.4 },
    { weight: 180, velocity: 0.3 },
  ],
  vFirst: 0.62,
  vLast: 0.48,
};

export function velocityView(nav) {
  const root = h('div.view');
  const render = () => { clear(root); build(root, render, nav); };
  render();
  return root;
}

function build(root, render, nav) {
  const a = S.athlete();
  root.append(referenceCard(a, render));
  root.append(h('div.grid.g-side', profileCard(render), lossCard(render)));
  root.append(dropoffCard(a, nav));
  root.append(caveatCard());
}

/* =========================================================
   1 · Referenční tabulka
   ========================================================= */
function referenceCard(a, render) {
  const sex = a?.sex ?? 'm';
  const lift = st.lift === 'deadlift' ? 'squat' : st.lift;
  const rows = LOAD_VELOCITY[lift][sex];
  const e1 = a?.e1rm?.[lift] ?? 0;

  const series = ['squat', 'bench'].map((k) => ({
    color: LIFTS[k].color,
    label: LIFTS[k].label,
    points: LOAD_VELOCITY[k][sex].map(([pct, v]) => ({ x: pct, value: v })),
    area: false,
  }));

  return card('Rychlost podle intenzity', {
    eyebrow: `Průměrná propulzní rychlost · ${sex === 'f' ? 'ženy' : 'muži'} · m·s⁻¹`,
    action: segmented(
      [{ value: 'squat', label: 'Dřep' }, { value: 'bench', label: 'Benčpres' }],
      lift, (v) => { st.lift = v; render(); }),
  },
    lineChart(series, { height: 190, fmt: (v) => fixed(v, 2), xFmt: (x) => `${x} %`, unit: 'm·s⁻¹' }),

    h('div.split-legend',
      ...['squat', 'bench'].map((k) =>
        h('div.split-item', h('i', { style: { background: LIFTS[k].color } }), h('span.split-name', LIFTS[k].label)))),

    table(
      ['% z 1RM',
        { label: 'Rychlost', num: true },
        { label: 'Rozptyl', num: true },
        e1 > 0 ? { label: `Váha (${U()})`, num: true } : { label: '', num: true }],
      rows.map(([pct, v, sd]) => [
        `${pct} %`,
        { num: true, value: fixed(v, 2) },
        { num: true, value: `± ${fixed(sd, 2)}` },
        { num: true, value: e1 > 0 ? W(C.roundToBar((e1 * pct) / 100), 1) : '—' },
      ])),

    h('p.note',
      'Tabulka slouží ke srovnání: když stejná váha jede pomaleji než obvykle, je to signál únavy '
      + 'ještě dřív, než se projeví na počtu opakování. Mezi jednotlivci ale rychlost kolísá o 11 až 25 %, '
      + 'takže vlastní změřený profil je vždycky lepší než tahle čísla.'),

    h('div.flag', { dataset: { tone: 'warn' } },
      icon('alert', 16),
      h('span', h('b', 'Data jsou ze Smithova stroje, ne z volné osy.'), ' ',
        'Naměřilo se to na mladých rekreačně trénovaných lidech. Na volnou osu se hodnoty '
        + 'nepřenášejí jedna k jedné — ber je jako orientaci v řádu, ne jako cíl na desetinu.')),

    h('div.hr'),

    h('div.eyebrow', 'Skutečná rychlost při maximu — elitní trojbojaři, volná osa'),
    table(
      ['Cvik', { label: 'Rychlost při 1RM', num: true }, { label: 'RPE', num: true }],
      Object.entries(VELOCITY_AT_1RM).map(([k, v]) => [
        h('span', liftDot(k), LIFTS[k].label),
        { num: true, value: `${fixed(v.v, 2)} ± ${fixed(v.sd, 2)}` },
        { num: true, value: fixed(v.rpe, 1) },
      ])),
    h('p.note', { style: { color: 'var(--ink-3)' } },
      'Helms a kol. (2017), JSCR 31(2):292–7, n = 15. Tohle je něco jiného než minimální prahová '
      + 'rychlost z profilu níž — nepleť si je. Maximum se zvedá pomalu, ale ne tak pomalu, jak vychází '
      + 'práh z vyčerpaných sérií.'));
}

/* =========================================================
   2 · Odhad maxima z profilu
   ========================================================= */
function profileCard(render) {
  const lift = st.lift;
  const res = C.lvProfile1RM(st.profile, lift);
  const mvt = MVT[lift];

  const setAt = (i, key, v) => { st.profile[i] = { ...st.profile[i], [key]: v }; render(); };

  return card('Odhad maxima z profilu', {
    eyebrow: 'Proloží se přímka a dosadí minimální prahová rychlost',
    action: select(
      Object.keys(MVT).map((k) => ({ value: k, label: LIFTS[k].label })),
      { value: lift, onchange: (e) => { st.lift = e.target.value; render(); } }),
  },
    table(
      ['Série', { label: `Váha (${U()})`, num: true }, { label: 'Rychlost (m·s⁻¹)', num: true }, ''],
      st.profile.map((p, i) => [
        `${i + 1}.`,
        {
          num: true,
          value: numInput({
            class: 'inline-input', value: inputNum(S.toDisplay(p.weight), 1), step: 2.5,
            oninput: (e) => setAt(i, 'weight', S.fromDisplay(Number(e.target.value))),
          }),
        },
        {
          num: true,
          value: decimalInput({
            class: 'inline-input', value: String(p.velocity).replace('.', ','),
            onvalue: (v) => setAt(i, 'velocity', v),
          }),
        },
        h('button.btn.btn-sm.btn-icon.btn-ghost', {
          title: 'Smazat řádek',
          disabled: st.profile.length <= 3,
          onclick: () => { st.profile.splice(i, 1); render(); },
        }, icon('trash', 14)),
      ])),

    h('div.btn-row',
      h('button.btn.btn-sm', {
        onclick: () => { st.profile.push({ weight: 0, velocity: 0 }); render(); },
      }, icon('plus', 14), 'Přidat sérii')),

    !res
      ? h('p.note', 'Zadej aspoň tři postupně těžší série s naměřenou rychlostí.')
      : !res.reliable
        ? h('div.flag', { dataset: { tone: 'bad' } },
            icon('alert', 16),
            h('span',
              h('b', 'Na mrtvý tah se tohle nepoužívá.'), ' ',
              'Studie, která to testovala, zjistila, že všechny varianty prahu podhodnotily skutečné '
              + 'maximum o 9 až 15 % — tedy o 16 až 28 kg. Autoři výslovně píší, že individuální profily '
              + 'rychlosti se k odhadu maxima v mrtvém tahu používat nemají. Appka proto číslo neukáže.'))
        : h('div',
            h('div.grid.g3',
              stat('Odhad 1RM', W(res.e1rm, 1), U(), 'hero'),
              stat('Prahová rychlost', fixed(res.mvt, 2), 'm·s⁻¹'),
              stat('Těsnost proložení', res.r2 == null ? '—' : fixed(res.r2, 3), 'r²',
                res.r2 != null && res.r2 < 0.95 ? 'warn' : null)),
            res.r2 != null && res.r2 < 0.95 && flagRow({
              tone: 'warn',
              text: `Body leží na přímce jen volně (r² ${fixed(res.r2, 3)}). Pod 0,95 se odhad `
                + 'nedá brát vážně — přeměř profil, ideálně na čerstvo a se stejnou technikou u všech sérií.',
            }),
            h('p.note', `Prahová rychlost pro ${LIFTS[lift].label.toLowerCase()}: ${mvt.note}.`)),

    h('p.note', { style: { color: 'var(--ink-3)' } },
      'Validace na benčpresu vyšla dobře — korelace 0,98 a průměrná odchylka 3,5 ± 2,9 kg na 68 lidech. '
      + 'To ale platí pro benčpres, ne pro každý cvik.'));
}

/* =========================================================
   3 · Práh poklesu rychlosti
   ========================================================= */
function lossCard(render) {
  const drop = st.vFirst > 0 ? ((st.vFirst - st.vLast) / st.vFirst) * 100 : null;
  const g = C.gradeVelocityLoss(drop);

  return card('Práh poklesu rychlosti', {
    eyebrow: 'Kdy sérii ukončit · nejlíp podložená část VBT',
    action: tag(g.label, g.tone),
  },
    h('div.form-row',
      field('Nejrychlejší opakování', decimalInput({
        value: String(st.vFirst).replace('.', ','),
        onvalue: (v) => { st.vFirst = v; render(); },
      }), 'm·s⁻¹'),
      field('Poslední opakování', decimalInput({
        value: String(st.vLast).replace('.', ','),
        onvalue: (v) => { st.vLast = v; render(); },
      }), 'm·s⁻¹')),

    stat('Pokles rychlosti', drop == null ? '—' : `${fixed(drop, 1)}`, '%',
      g.tone === 'ok' ? 'ok' : g.tone === 'bad' ? 'bad' : g.tone === 'warn' ? 'warn' : null),

    flagRow({ tone: g.tone, text: g.note }),

    table(
      ['Pokles', 'Co z toho plyne'],
      VELOCITY_LOSS.map((b, i) => ({
        tone: b.tone,
        cells: [
          i === 0 ? `do ${b.max} %`
            : b.max === 999 ? `nad ${VELOCITY_LOSS[i - 1].max} %`
              : `${VELOCITY_LOSS[i - 1].max}–${b.max} %`,
          b.note,
        ],
      }))),

    h('p.note',
      'Jukic a kol. (2023), Sports Medicine — systematický přehled s metaanalýzou. '
      + 'Z celého VBT je tohle část s nejlepším důkazem: nižší práh poklesu je pro rozvoj síly '
      + 'efektivnější než vydřená série do selhání.'));
}

/* =========================================================
   4 · Totéž bez měřáku — z vlastního deníku
   ========================================================= */
function dropoffCard(a, nav) {
  if (!a) return empty('Nejdřív si založ svěřence.', h('button.btn.btn-primary', { onclick: () => nav('athletes') }, 'Přidat svěřence'));

  const entries = S.state.entries.filter((e) => e.athleteId === a.id);
  const rows = [];

  // poslední dny, kde na jednom cviku padlo víc sérií na stejné váze
  const days = [...new Set(entries.map((e) => e.date))].sort().reverse().slice(0, 40);
  for (const date of days) {
    for (const lift of ['squat', 'bench', 'deadlift']) {
      const d = C.setDropoff(entries, lift, date);
      if (d && d.sets >= 2 && (d.repDrop != null || d.rpeJump != null)) rows.push({ date, lift, ...d });
    }
    if (rows.length >= 8) break;
  }

  return card('Totéž bez měřáku', {
    eyebrow: 'Propad opakování a skok RPE z vlastního deníku',
    action: h('button.btn.btn-sm', { onclick: () => nav('realita') }, icon('target', 14), 'Doplnit skutečné hodnoty'),
  },
    rows.length
      ? table(
          ['Datum', 'Cvik', { label: `Váha (${U()})`, num: true }, { label: 'Sérií', num: true },
            { label: 'Opakování', num: true }, { label: 'Propad', num: true }, { label: 'Skok RPE', num: true }, 'Stav'],
          rows.map((r) => ({
            tone: r.stop ? 'warn' : 'ok',
            cells: [
              r.date,
              h('span', liftDot(r.lift), LIFTS[r.lift].label),
              { num: true, value: W(r.weight, 1) },
              { num: true, value: r.sets },
              { num: true, value: `${r.firstReps} → ${r.lastReps}` },
              { num: true, value: r.repDrop == null ? '—' : `${fixed(r.repDrop, 0)} %` },
              { num: true, value: r.rpeJump == null ? '—' : `${r.rpeJump >= 0 ? '+' : '−'}${fixed(Math.abs(r.rpeJump), 1)}` },
              tag(r.stop ? 'tady končit' : 'v pořádku', r.stop ? 'warn' : 'ok'),
            ],
          })))
      : h('div.empty',
          icon('activity', 22),
          h('p.note', 'Zatím není žádný den, kde by u jednoho cviku padlo víc sérií na stejné váze. '
            + 'Až takové budou, appka tu spočítá, kde se série začaly propadat.')),

    h('p.note',
      'Kdo nemá měřák, může stejnou otázku číst z toho, co se stejně zapisuje: kolik opakování se '
      + 'při stejné váze udrželo a na jaké RPE. Propad opakování o víc než pětinu proti první sérii '
      + 'nebo skok RPE o dva body a víc odpovídá zhruba dvaceti až pětadvaceti procentům poklesu rychlosti.'),

    h('div.flag', { dataset: { tone: 'low' } },
      icon('info', 16),
      h('span', h('b', 'Tohle je převodní pravidlo z praxe, ne změřená ekvivalence.'), ' ',
        'Nikdo obě veličiny na stejném vzorku neporovnal. Je to rozumná analogie, ne validovaný přepočet — '
        + 'appka ho proto nabízí jako vodítko, ne jako náhradu měření.')));
}

/* =========================================================
   Poctivé shrnutí
   ========================================================= */
function caveatCard() {
  return card('Co tahle obrazovka neumí', { eyebrow: 'Kde metoda končí' },
    h('p.note',
      'Appka rychlost neměří — musí ji někdo zadat z měřáku. Bez něj zůstává použitelná poslední karta, '
      + 'která tutéž otázku čte z propadu opakování a skoku RPE.'),
    h('p.note',
      'Polynomiální rovnice pro převod rychlosti na procenta z maxima (González-Badillo, Sánchez-Medina) '
      + 'se v appce nepočítají. Koeficienty se mi nepodařilo ověřit z původního zdroje a vymýšlet si je '
      + 'by bylo horší než je neuvádět — místo nich je tu tabulka naměřených hodnot.'),
    h('p.note',
      'U mrtvého tahu se odhad maxima z profilu neukazuje vůbec. Není to opomenutí: publikovaná data '
      + 'ukazují, že tam metoda systematicky podhodnocuje, a autoři ji pro tenhle cvik odmítají.'));
}
