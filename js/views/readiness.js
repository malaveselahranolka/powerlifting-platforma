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
 *   2. Šel dnešek líp nebo hůř, než měl? (odchylka RPE od očekávání)
 *   3. Není objem za stropem regenerace? (tři nezávislé známky MRV)
 *   4. Je poslední zlepšení skutečné, nebo se vejde do šumu měření?
 *      (typická chyba a nejmenší prokazatelná změna)
 *   5. Nezaostává jeden ze tří cviků za zbytkem? (podíly na součtu proti
 *      elitním závodníkům ve stejné kategorii)
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

  const e1rms = a.e1rm ?? {};

  root.append(formCard(entries, today, nav));
  root.append(h('div.grid.g-side',
    readinessCard(entries, e1rms),
    mrvCard(a, entries)));
  root.append(noiseCard(a));
  root.append(trendCard(a));
  root.append(sfrCard(a, entries, e1rms));
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
   2 · Denní připravenost z odchylky RPE
   ========================================================= */
function readinessCard(entries, e1rms) {
  const days = C.dailyReadiness(entries, e1rms);
  const last = days.at(-1);
  const g = C.gradeReadiness(last?.z);

  if (!days.length) {
    return card('Jak šel poslední trénink', { eyebrow: 'Odchylka RPE od očekávání' },
      h('div.empty',
        icon('heart', 22),
        h('p.note', 'Zapiš u sérií skutečné RPE v Plán vs. realita. Z rozdílu proti očekávání appka dopočítá, jestli byl den těžší, než měl být.')));
  }

  const win = days.slice(-14);
  const chart = win.length > 2
    ? lineChart([{
        color: 'var(--series-2)',
        label: 'Odchylka RPE',
        points: win.map((d) => ({ date: d.date, value: d.residual })),
      }], { height: 150, fmt: (v) => fixed(v, 2) })
    : null;

  return card('Jak šel poslední trénink', {
    eyebrow: 'Odchylka RPE od očekávání · z-skóre proti vlastnímu 28dennímu oknu',
    action: tag(g.label, g.tone),
  },
    h('div.grid.g3',
      stat('Odchylka RPE', `${last.residual >= 0 ? '+' : '−'}${fixed(Math.abs(last.residual), 2)}`,
        'bodu proti očekávání', last.residual >= 0.5 ? 'warn' : null),
      stat('Z-skóre', last.z == null ? '—' : `${last.z >= 0 ? '+' : '−'}${fixed(Math.abs(last.z), 2)}`,
        last.n28 >= 3 ? `z ${last.n28} předchozích dnů` : 'málo historie'),
      stat('Poslední jednotka', C.daysBetween(last.date, new Date()) === 0 ? 'dnes' : `před ${C.daysBetween(last.date, new Date())} dny`, `${last.n} sérií`)),

    chart,

    flagRow({ tone: g.tone, text: g.note }),

    h('p.note',
      'U každé série appka z relativní intenzity a počtu opakování odvodí, na jaké RPE měla vyjít. '
      + 'Rozdíl proti nahlášenému RPE je odchylka — o kolik byl trénink těžší, než měl podle plánu být. '
      + 'Série se váží podle INOL: trojka na RPE 9 nese informaci, desítka na RPE 6 skoro žádnou, '
      + 'protože přesnost odhadu RPE prudce klesá s počtem opakování '
      + '(Zourdos a kol. 2016: odchylka 0,32 bodu při 100 % 1RM, ale 1,18 při 60 %).'),

    h('p.note', { style: { color: 'var(--ink-3)' } },
      'Čte se jako z-skóre proti vlastnímu klouzavému oknu, ne proti pevné hranici — někdo hlásí RPE '
      + 'systematicky výš než jiný a absolutní číslo by se mezi závodníky nedalo porovnat.'));
}

/* =========================================================
   3 · Strop regenerace
   ========================================================= */
function mrvCard(a, entries) {
  const blk = S.block();
  const creep = blk ? C.rpeCreep(S.blockEntries(blk.id), blk.start) : [];
  const hs = blk ? C.hardSets(S.blockEntries(blk.id), S.blockE1rm(blk, a), blk.start) : [];

  const sumSets = (w) => (w ? Object.values(w.lifts).reduce((s, v) => s + v, 0) : null);
  const today = S.iso(new Date());
  const wellness = S.athleteWellness(a.id);
  const todayWellness = wellness.find((w) => w.date === today);

  // trend nejlepšího odhadu maxima napříč historií svěřence
  const pts = (S.state.e1rmLog ?? []).filter((x) => x.athleteId === a.id)
    .sort((x, y) => x.date.localeCompare(y.date))
    .map((x) => ({ date: x.date, value: x.value }));

  const m = C.mrvSignal({
    e1rmTrend: C.plateauCheck(pts),
    creepNow: creep.at(-1)?.avg,
    creepPrev: creep.at(-2)?.avg,
    hooperNow: todayWellness ? C.hooperIndex(todayWellness) : null,
    hooperBaseline: C.hooperBaseline(wellness, today),
    hardSetsNow: sumSets(hs.at(-1)),
    hardSetsPrev: sumSets(hs.at(-2)),
  });
  const g = C.gradeMrv(m);

  return card('Strop regenerace', {
    eyebrow: 'Tři nezávislé známky · dvě naráz znamenají deload',
    action: tag(g.label, g.tone),
  },
    m.max
      ? h('div', { style: { display: 'flex', flexDirection: 'column', gap: '6px' } },
          ...m.signals.map((sig) => h('div.flag', { dataset: { tone: sig.hit ? 'warn' : 'ok' } },
            icon(sig.hit ? 'alert' : 'check', 16),
            h('span', h('b', sig.label), h('br'), h('span.faint', sig.detail)))))
      : h('p.note', 'Zatím není z čeho známky spočítat.'),

    m.max > 0 && stat('Sedících známek', `${m.score}`, `ze ${m.max}`, m.reached ? 'bad' : m.score ? 'warn' : null),

    flagRow({ tone: g.tone, text: g.note }),

    h('p.note',
      'Žádná známka sama o sobě nestačí: výkon může stát kvůli jednomu lehkému týdnu, RPE může '
      + 'vyskočit po jedné špatné jednotce a pohoda se dá zkazit prací i chřipkou. Dvě nezávislé '
      + 'naráz už ale ukazují stejným směrem — a to je moment, kdy další série nepřidá adaptaci, '
      + 'jen únavu.'),

    h('p.note', { style: { color: 'var(--ink-3)' } },
      'Objemové mezníky MEV/MAV/MRV nemají empiricky změřená čísla — jsou to trenérské odhady. '
      + 'Appka proto žádnou hranici v sériích netvrdí a místo toho hlídá důsledky: jestli se '
      + 'přestal zvedat výkon, jestli stejný plán jede na vyšší RPE a jestli spadla pohoda.'));
}

/* =========================================================
   4 · Šum měření
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
   5 · Podíly cviků na součtu
   ========================================================= */
function balanceCard(a) {
  const bal = C.sbdBalance(a.e1rm, { sex: a.sex, bw: a.bw, equipment: a.equipment });

  if (!bal) {
    return card('Rozložení součtu', { eyebrow: 'Kde zaostává' },
      h('p.note', 'Doplň maxima všech tří soutěžních cviků a tělesnou váhu v sekci Svěřenci.'));
  }

  const stateLabel = { low: 'pod pásmem', ok: 'v pásmu', high: 'nad pásmem' };
  const stateTone = { low: 'warn', ok: 'ok', high: 'neutral' };
  const eqLabel = a.equipment === 'equipped' ? 'vybavená' : 'klasika';

  return card('Rozložení součtu', {
    eyebrow: `Proti elitním závodníkům · ${eqLabel} · ${bal.classLabel} · ${a.sex === 'f' ? 'ženy' : 'muži'}`,
    action: tag(bal.balanced ? 'Vyvážené' : 'Mimo pásmo', bal.balanced ? 'ok' : 'warn'),
  },
    h('div.grid.g3',
      ...bal.lifts.map((l) =>
        h('div.stat', { dataset: l.state === 'low' ? { tone: 'warn' } : {} },
          h('div.stat-label', liftDot(l.lift), LIFTS[l.lift].label),
          h('div.stat-value', num(l.pct, 1), h('span.stat-unit', '% součtu')),
          h('div.stat-sub', `${Wu(a.e1rm[l.lift], 1)} · elita ${num(l.mean, 1)} %`)))),

    table(
      ['Cvik',
        { label: 'Podíl', num: true },
        { label: 'Pásmo elity', num: true },
        { label: 'Odchylka', num: true },
        'Stav',
        { label: `Do pásma (${U()})`, num: true }],
      bal.lifts.map((l) => ({
        tone: l.state === 'low' ? 'warn' : l.state === 'ok' ? 'ok' : null,
        cells: [
          h('span', liftDot(l.lift), LIFTS[l.lift].label),
          { num: true, value: `${num(l.pct, 1)} %` },
          { num: true, value: `${num(l.min, 1)}–${num(l.max, 1)} %` },
          { num: true, value: l.z == null ? '—' : `${l.z >= 0 ? '+' : '−'}${fixed(Math.abs(l.z), 2)} σ` },
          tag(stateLabel[l.state], stateTone[l.state]),
          { num: true, value: l.toBand === 0 ? '—' : `${l.toBand > 0 ? '+' : '−'}${W(Math.abs(l.toBand), 1)}` },
        ],
      }))),

    ...bal.lifts.filter((l) => l.state === 'low').map((l) => flagRow({
      tone: 'warn',
      text: `${LIFTS[l.lift].label} nese ${num(l.pct, 1)} % součtu — elitní závodníci ve stejné kategorii `
        + `mají ${num(l.min, 1)} až ${num(l.max, 1)} %. Do pásma by chybělo ${num(S.toDisplay(Math.abs(l.toBand)), 1)} ${U()}, `
        + 'pokud by zbylé dva cviky zůstaly, kde jsou.',
    })),

    bal.balanced && flagRow({
      tone: 'ok',
      text: `Všechny tři cviky nesou podíl, který je u elity v kategorii ${bal.classLabel} obvyklý. Na rozložení součtu není co opravovat.`,
    }),

    !bal.firm && flagRow({
      tone: 'low',
      text: `Pro kategorii ${bal.classLabel} v téhle výstroji autor studie statistickou podporu pásma nenašel. `
        + 'Ber ho jako orientační cíl, ne jako verdikt.',
    }),

    bal.approxClass && flagRow({
      tone: 'low',
      text: 'Studie tuhle váhovou kategorii nepokrývá — použil se nejbližší vyšší řádek, takže pásmo sedí jen přibližně.',
    }),

    h('p.note',
      'Součet se dá poskládat mnoha způsoby a poměry se posouvají s kategorií i výstrojí: nejlehčí muži '
      + 'dávají v klasice do mrtvého tahu skoro 40 % součtu, nejtěžší jen 37 %, a ve vybavené soutěži je to '
      + 'celé jinak, protože dres pomáhá dřepu a benči, ne tahu. Pásma proto nejsou jedno univerzální '
      + 'pravidlo typu 3:4:5, ale tabulka pro konkrétní kategorii, pohlaví a výstroj.'),

    h('p.note', { style: { color: 'var(--ink-3)' } },
      'Pozor na výklad: studie ukazuje souvislost, ne příčinu. Závodníci uvnitř pásma mají v průměru vyšší '
      + 'IPF GL, ale z toho neplyne, že se součet zvedne tím, že se poměr narovná. Délka končetin a stavba '
      + 'těla posunou podíl legitimně a natrvalo. Čti to jako otázku, ne jako předpis. Data: '
      + 'Hernández Ugalde (2023), Int J Strength Cond 3(1) — závody IPF 2012–2022, 128 tisíc startů, věk 24–39.'));
}

/* =========================================================
   6 · Trend, jeho nejistota a okamžik zlomu
   ========================================================= */
function trendCard(a) {
  const log = (S.state.e1rmLog ?? []).filter((x) => x.athleteId === a.id);

  const rows = COMP_LIFTS.map((k) => {
    const pts = log.filter((x) => x.lift === k)
      .sort((x, y) => x.date.localeCompare(y.date))
      .map((x) => ({ date: x.date, value: x.value }));
    return { lift: k, pts, ols: C.trendWithBand(pts), ts: C.theilSen(pts), mk: C.mannKendall(pts.map((p) => p.value)), cu: C.cusum(pts), pl: C.plateauCheck(pts) };
  }).filter((r) => r.ols);

  if (!rows.length) {
    return card('Trend a jeho nejistota', { eyebrow: 'Interval spolehlivosti, robustní odhad, detekce zlomu' },
      h('p.note', 'Zapiš aspoň tři maxima u jednoho cviku.'));
  }

  return card('Trend a jeho nejistota', {
    eyebrow: 'Interval spolehlivosti sklonu · robustní odhad · detekce zlomu',
  },
    table(
      ['Cvik',
        { label: `Sklon (${U()}/týden)`, num: true },
        { label: '95% interval', num: true },
        { label: 'Theil–Sen', num: true },
        { label: 'Mann–Kendall', num: true },
        'Závěr'],
      rows.map((r) => {
        const g = C.gradePlateau(r.pl);
        return {
          tone: g.tone === 'ok' ? 'ok' : g.tone === 'bad' ? 'bad' : g.tone === 'warn' ? 'warn' : null,
          cells: [
            h('span', liftDot(r.lift), LIFTS[r.lift].label),
            { num: true, value: `${r.ols.perWeek >= 0 ? '+' : '−'}${fixed(Math.abs(S.toDisplay(r.ols.perWeek)), 2)}` },
            { num: true, value: `${fixed(S.toDisplay(r.ols.perWeekCI[0]), 1)} až ${fixed(S.toDisplay(r.ols.perWeekCI[1]), 1)}` },
            { num: true, value: r.ts ? `${r.ts.perWeek >= 0 ? '+' : '−'}${fixed(Math.abs(S.toDisplay(r.ts.perWeek)), 2)}` : '—' },
            { num: true, value: r.mk ? `Z ${fixed(r.mk.Z, 2)}${r.mk.significant ? ' *' : ''}` : '—' },
            tag(g.label, g.tone),
          ],
        };
      })),

    ...rows.filter((r) => r.cu?.breakAt).map((r) => flagRow({
      tone: r.cu.breakAt.direction === 'down' ? 'warn' : 'ok',
      text: `${LIFTS[r.lift].label}: úroveň se odchýlila od výchozí u zápisu z ${r.cu.breakAt.date} `
        + `(${r.cu.breakAt.direction === 'down' ? 'propad' : 'skok nahoru'} proti průměru ${num(S.toDisplay(r.cu.mean), 1)} ${U()} `
        + 'z první poloviny řady). Detekce zlomu neříká proč — jen kdy.',
    })),

    ...rows.filter((r) => r.ts && r.ols && Math.abs(r.ts.perWeek - r.ols.perWeek) > Math.max(1, Math.abs(r.ols.perWeek) * 0.5)).map((r) => flagRow({
      tone: 'low',
      text: `${LIFTS[r.lift].label}: obyčejná regrese a Theil–Sen se výrazně liší (${fixed(r.ols.perWeek, 2)} proti ${fixed(r.ts.perWeek, 2)} ${U()}/týden). `
        + 'To samo o sobě znamená, že v datech sedí odlehlá hodnota — nemoc, zkažený pokus, špatně odhadnuté RPE. '
        + 'Robustnímu odhadu se dá věřit víc.',
    })),

    h('p.note',
      'Sklon spočítaný ze šesti zápisů je sám o sobě odhad se svou nejistotou. Interval spolehlivosti říká, '
      + 'v jakém rozmezí ten skutečný sklon leží. Obsahuje-li nulu, data prostě neumí rozhodnout, jestli '
      + 'výkon roste, nebo stojí — a tvrdit směr by bylo víc, než unesou.'),

    h('p.note',
      'Theil–Sen je medián všech párových sklonů: jeden špatný den ho nevychýlí, protože ho ostatní dvojice '
      + 'přehlasují. Mann–Kendall se neptá na tvar křivky, jen jestli hodnoty spíš rostou, nebo klesají — '
      + 'hvězdička znamená průkazný trend na hladině 5 %.'),

    h('p.note', { style: { color: 'var(--ink-3)' } },
      'Detekce zlomu (CUSUM) hledá okamžik, kdy se úroveň odchýlila od té výchozí. Referenční průměr se bere '
      + 'z první poloviny řady, ne z celku — kdyby se počítal ze všeho, přišel by poplach už v rostoucí části '
      + 'jen proto, že leží nad celkovým průměrem. Prahy jsou zvyklosti statistického řízení jakosti, '
      + 'ne hodnoty odvozené ze silového tréninku.'));
}

/* =========================================================
   7 · Poměr podnětu k únavě
   ========================================================= */
function sfrCard(a, entries, e1rms) {
  const rows = COMP_LIFTS.map((k) => C.stimulusFatigue(entries, e1rms, k)).filter(Boolean);
  if (!rows.length) return h('div');

  const best = rows.reduce((m, r) => (r.ratio > m.ratio ? r : m), rows[0]);

  return card('Poměr podnětu k únavě', {
    eyebrow: 'Který cvik vrací nejvíc za nejmíň · vlastní heuristika appky',
  },
    table(
      ['Cvik', { label: 'Tvrdých sérií', num: true }, { label: 'Ø intenzita', num: true }, { label: 'INOL', num: true }, { label: 'Poměr', num: true }],
      rows.map((r) => ({
        tone: r === best ? 'ok' : null,
        cells: [
          h('span', liftDot(r.lift), LIFTS[r.lift].label),
          { num: true, value: r.hardSets },
          { num: true, value: `${fixed(r.avgIntensity, 1)} %` },
          { num: true, value: fixed(r.inol, 2) },
          { num: true, value: h('b', fixed(r.ratio, 2)) },
        ],
      }))),

    h('div.flag', { dataset: { tone: 'warn' } },
      icon('alert', 16),
      h('span', h('b', 'Tohle je konstrukce appky, ne převzatá metoda.'), ' '
        + 'V původní podobě je poměr podnětu k únavě subjektivní škála, kterou kouč vyplní podle pocitu. '
        + 'Číselná verze nikdy nebyla proti ničemu ověřená. Slouží k tomu, aby šlo porovnat dva cviky '
        + 'mezi sebou — ne k tomu, aby se z absolutní hodnoty dělaly závěry.')),

    h('p.note',
      'Podnět se počítá jako počet tvrdých sérií vážený průměrnou intenzitou, únava jako součet INOL. '
      + 'Vyšší poměr znamená, že cvik vrací víc adaptace za stejnou cenu. Mezi závodníky se ta čísla '
      + 'porovnávat nedají, mezi cviky jednoho člověka ano.'));
}
