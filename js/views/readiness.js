import { h, card, stat, icon, num, fixed, bigNum, tag, table, clear } from '../ui.js';
import { lineChart } from '../charts.js';
import * as S from '../store.js';
import * as C from '../calc.js';
import { LIFTS, COMP_LIFTS } from '../data.js';
import { W, U, Wu, liftDot, empty, flagRow } from './_util.js';

/**
 * Únava a forma.
 *
 * Ostatní obrazovky se dívají na jeden blok. Tahle bere celou historii
 * svěřence a odpovídá na tři otázky, na které jedno číslo z jednoho týdne
 * nestačí:
 *
 *   1. Kde je závodník na křivce kondice a únavy — je zahrabaný, nebo
 *      nabroušený? (dvousložkový model odezvy)
 *   2. Je poslední zlepšení skutečné, nebo se vejde do šumu měření?
 *      (typická chyba a nejmenší prokazatelná změna)
 *   3. Nezaostává jeden ze tří cviků za zbytkem? (poměry mezi cviky)
 */
export function readinessView(nav) {
  const root = h('div.view');
  const render = () => { clear(root); build(root, render, nav); };
  render();
  return root;
}

function build(root, render, nav) {
  const a = S.athlete();
  if (!a) {
    root.append(empty('Nejdřív si založ svěřence.', h('button.btn.btn-primary', { onclick: () => nav('athletes') }, 'Přidat svěřence')));
    return;
  }

  const entries = S.state.entries.filter((e) => e.athleteId === a.id);
  const today = S.iso(new Date());

  root.append(formCard(entries, today, nav));
  root.append(noiseCard(a));
  root.append(balanceCard(a));
}

/* =========================================================
   1 · Kondice, únava, forma
   ========================================================= */
function formCard(entries, today, nav) {
  // Denní zátěž podle Fostera: sRPE × počet sérií. Model potřebuje jedno
  // číslo na den, ne rozpis sérií.
  const daily = C.sessionLoads(entries);
  const loads = Object.fromEntries(Object.values(daily).map((d) => [d.date, d.load]));
  const series = C.fitnessFatigue(loads, today);
  const state = C.formState(series);
  const g = C.gradeForm(state);

  if (!state) {
    return card('Kondice, únava a forma', { eyebrow: 'Dvousložkový model odezvy' },
      h('div.empty',
        icon('activity', 24),
        h('p.note', 'Model potřebuje zapsané tréninky s RPE. Až jich bude pár týdnů, objeví se tu křivka.'),
        h('button.btn.btn-sm', { onclick: () => nav('program') }, 'Postavit blok')));
  }

  // Posledních ~120 dnů; delší okno křivku jen zmenší.
  const win = series.slice(-120);
  const chart = win.length > 2
    ? lineChart([
        { color: 'var(--series-1)', label: 'Kondice', points: win.map((d) => ({ date: d.date, value: d.fitness })), area: false },
        { color: 'var(--series-2)', label: 'Únava', points: win.map((d) => ({ date: d.date, value: d.fatigue })), area: false },
        { color: 'var(--series-3)', label: 'Forma', points: win.map((d) => ({ date: d.date, value: d.form })), area: false },
      ], { height: 220, fmt: (v) => num(v, 0) })
    : h('div.chart-empty', 'Málo dat na graf.');

  return card('Kondice, únava a forma', {
    eyebrow: 'Dvousložkový model odezvy · bezrozměrné jednotky',
    action: tag(g.label, g.tone),
  },
    h('div.grid.g4',
      stat('Forma dnes', fixed(state.form, 0), `${state.percentile}. percentil`, g.tone === 'bad' ? 'bad' : g.tone === 'warn' ? 'warn' : null),
      stat('Za posledních 7 dnů', `${state.delta7 >= 0 ? '+' : '−'}${fixed(Math.abs(state.delta7), 0)}`, state.delta7 >= 0 ? 'forma roste' : 'forma klesá'),
      stat('Kondice', fixed(state.fitness, 0), 'pomalá složka'),
      stat('Únava', fixed(state.fatigue, 0), 'rychlá složka')),

    chart,

    h('div.split-legend',
      h('div.split-item', h('i', { style: { background: 'var(--series-1)' } }), h('span.split-name', 'Kondice — roste pomalu, odeznívá pomalu (τ 42 dnů)')),
      h('div.split-item', h('i', { style: { background: 'var(--series-2)' } }), h('span.split-name', 'Únava — roste rychle, odeznívá rychle (τ 7 dnů)')),
      h('div.split-item', h('i', { style: { background: 'var(--series-3)' } }), h('span.split-name', 'Forma — jejich rozdíl, to je to, co se ukáže na platformě'))),

    flagRow({ tone: g.tone, text: g.note }),

    h('p.note',
      'Jedna dávka tréninku nastartuje dvě věci naráz: kondici, která roste i odeznívá pomalu, '
      + 'a únavu, která roste i mizí rychle. Výkon je jejich rozdíl — proto se po odlehčení zvedne, '
      + 'i když se v tom týdnu nic těžkého nezvedlo: únava spadla dřív, než stihla spadnout kondice.'),

    h('p.note', { style: { color: 'var(--ink-3)' } },
      'Čísla jsou bezrozměrná a dávají smysl jen proti vlastní historii, ne proti jinému závodníkovi. '
      + 'Časové konstanty (42 a 7 dnů) pocházejí z vytrvalostních sportů — pro silový trénink '
      + 'individuálně ověřené hodnoty publikované nejsou. Appka proto kreslí tvar křivky a nikdy '
      + 'nepředpovídá kilogramy.'));
}

/* =========================================================
   2 · Šum měření
   ========================================================= */
function noiseCard(a) {
  const log = (S.state.e1rmLog ?? []).filter((x) => x.athleteId === a.id);

  const rows = [];
  const flags = [];
  const floored = [];
  for (const k of COMP_LIFTS) {
    const pts = log.filter((x) => x.lift === k)
      .sort((x, y) => x.date.localeCompare(y.date))
      .map((x) => ({ date: x.date, value: x.value }));
    const noise = C.measurementNoise(pts);
    if (!noise) {
      rows.push({ cells: [
        h('span', liftDot(k), LIFTS[k].label),
        { num: true, value: '—' }, { num: true, value: '—' }, { num: true, value: '—' },
        h('span.faint', `${pts.length} z 4 zápisů`),
      ] });
      continue;
    }

    if (noise.floored) floored.push(LIFTS[k].label);

    // Poslední zápis proti předchozímu — to je otázka, kterou si kouč klade.
    const prev = pts.at(-2)?.value;
    const chg = C.isRealChange(prev, noise.latest, noise);

    rows.push({
      tone: chg ? (chg.real ? (chg.direction === 'up' ? 'ok' : 'bad') : null) : null,
      cells: [
        h('span', liftDot(k), LIFTS[k].label),
        { num: true, value: W(noise.typicalError, 1) },
        { num: true, value: noise.cv == null ? '—' : `${num(noise.cv, 1)} %` },
        { num: true, value: W(noise.sdc, 1) },
        chg
          ? h('span', { class: 'nowrap' },
              `${chg.diff >= 0 ? '+' : '−'}${W(Math.abs(chg.diff), 1)} ${U()} · `,
              tag(chg.real ? (chg.direction === 'up' ? 'prokazatelné' : 'prokazatelný propad') : 'v šumu',
                chg.real ? (chg.direction === 'up' ? 'ok' : 'bad') : 'neutral'))
          : h('span.faint', '—'),
      ],
    });

    if (chg && !chg.real && Math.abs(chg.diff) > 0) {
      flags.push({
        tone: 'low',
        text: `${LIFTS[k].label}: poslední změna ${chg.diff >= 0 ? '+' : '−'}${num(Math.abs(S.toDisplay(chg.diff)), 1)} ${U()} se vejde do šumu. `
          + `Prokazatelné by bylo až ${num(S.toDisplay(noise.sdc), 1)} ${U()} a víc — do té doby to může být jen den.`,
      });
    }
  }

  return card('Kdy je zlepšení skutečné', {
    eyebrow: 'Typická chyba odhadu a nejmenší prokazatelná změna',
  },
    table(
      ['Cvik',
        { label: `Typická chyba (${U()})`, num: true },
        { label: 'V procentech', num: true },
        { label: `Prokazatelná změna (${U()})`, num: true },
        'Poslední posun'],
      rows),

    ...flags.map(flagRow),

    floored.length > 0 && h('p.note', { style: { color: 'var(--ink-3)' } },
      `${floored.join(', ')}: zápisy sedí na přímce tak přesně, že by z nich vyšel nulový rozptyl. `
      + `Appka místo něj použila spodní mez ${num(C.E1RM_NOISE_FLOOR_PCT, 1)} % — samotný test maxima `
      + 'se mezi dvěma dny liší řádově o jednotky procent a odhad z RPE ještě víc, takže nulová chyba '
      + 'by lhala.'),

    h('p.note',
      'Odhad maxima se houpe, i když se síla nezmění — jiný den, jinak sedící pás, '
      + 'RPE odhadnuté o půl bodu vedle. Typická chyba je rozptyl zápisů kolem proložené přímky: '
      + 'kolik ten odhad běžně kolísá sám od sebe. Nejmenší prokazatelná změna je 2,77násobek '
      + 'té chyby (1,96 · √2) — teprve větší posun se dá s 95% jistotou označit za skutečný, '
      + 'ne za dobrý den.'),

    h('p.note', { style: { color: 'var(--ink-3)' } },
      'Praktický dopad: netestuj maximum častěji, než o kolik se dá čekat zlepšení nad tímhle prahem. '
      + 'Když typická chyba vyjde na 4 kg, týdenní test nemá co změřit.'));
}

/* =========================================================
   3 · Poměry mezi cviky
   ========================================================= */
function balanceCard(a) {
  const bal = C.liftBalance(a.e1rm);
  const split = C.totalSplit(a.e1rm);

  if (!bal.length || !split) {
    return card('Rovnováha mezi cviky', { eyebrow: 'Kde zaostává' },
      h('p.note', 'Doplň maxima všech tří soutěžních cviků v sekci Svěřenci.'));
  }

  const toneOf = (s) => (s === 'ok' ? 'ok' : 'warn');
  const stateLabel = { low: 'pod pásmem', ok: 'v pásmu', high: 'nad pásmem' };

  return card('Rovnováha mezi cviky', {
    eyebrow: 'Poměry z klasického trojboje · orientační pásma',
  },
    h('div.grid.g3',
      ...COMP_LIFTS.map((k) =>
        h('div.stat',
          h('div.stat-label', h('span', liftDot(k)), LIFTS[k].label),
          h('div.stat-value', num(split[k], 1), h('span.stat-unit', '% součtu')),
          h('div.stat-sub', Wu(a.e1rm[k], 1))))),

    table(
      ['Poměr', { label: 'Teď', num: true }, { label: 'Pásmo', num: true }, 'Stav', { label: `Do pásma (${U()})`, num: true }],
      bal.map((r) => ({
        tone: r.state === 'ok' ? 'ok' : 'warn',
        cells: [
          r.label,
          { num: true, value: `${num(r.pct, 0)} %` },
          { num: true, value: `${num(r.low * 100, 0)}–${num(r.high * 100, 0)} %` },
          tag(stateLabel[r.state], toneOf(r.state)),
          { num: true, value: r.toBand === 0 ? '—' : `${r.toBand > 0 ? '+' : '−'}${W(Math.abs(r.toBand), 1)}` },
        ],
      }))),

    ...bal.filter((r) => r.state !== 'ok').map((r) => flagRow({
      tone: 'warn',
      text: r.state === 'low'
        ? `${r.label} je ${num(r.pct, 0)} % — pod obvyklým pásmem. Buď má ${LIFTS[r.of].label.toLowerCase()} co dohánět, nebo je ${LIFTS[r.per].label.toLowerCase()} nadprůměrně silný. Rozdíl pozná jen kouč, ne appka.`
        : `${r.label} je ${num(r.pct, 0)} % — nad obvyklým pásmem. Bývá to silná stránka, ale stojí za pohled, jestli druhý cvik nezaostává.`,
    })),

    bal.every((r) => r.state === 'ok') && flagRow({ tone: 'ok', text: 'Všechny tři cviky drží v obvyklých poměrech — žádný z nich viditelně nezaostává.' }),

    h('p.note',
      'Pásma vycházejí z rozborů veřejné databáze OpenPowerlifting nad klasickým trojbojem. '
      + 'Nejsou to normy, které by se měly dohánět za každou cenu: délka končetin a stavba těla '
      + 'posunou poměr legitimně a natrvalo. Berou se jako otázka — proč zrovna tenhle cvik '
      + 'zaostává? — ne jako diagnóza.'));
}
