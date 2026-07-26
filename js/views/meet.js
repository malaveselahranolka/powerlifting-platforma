import { h, card, stat, icon, num, fixed, tag, table, field, numInput, select, segmented, clear, longDate } from '../ui.js';
import { barbell, lineChart } from '../charts.js';
import * as S from '../store.js';
import * as C from '../calc.js';
import { ATTEMPT_STRATEGY, ATTEMPT_JUMPS, LIFTS, COMP_LIFTS, TAPER_MODELS, TAPER_REFERENCE, MEET_TIMING, CUT_FACTS } from '../data.js';
import { W, U, Wu, liftDot, empty, flagRow } from './_util.js';

const st = {
  strategy: 'standard', date: null, overrides: {}, lift: 'squat',
  taperModel: 'exponential',
  flightStart: '10:00', lifterOrder: 5, flightSize: 12, minPerAttempt: 1, warmupSets: 5,
};

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
  root.append(h('div.grid.g-side', timelineCard(plan, render), cutCard(a, wc)));
  if (st.date) root.append(taperCard(st.date, render));

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

/* =========================================================
   Časová osa závodního dne
   ========================================================= */
function timelineCard(plan, render) {
  const tl = C.meetTimeline({
    flightStart: st.flightStart, lifterOrder: st.lifterOrder, flightSize: st.flightSize,
    minPerAttempt: st.minPerAttempt, warmupSets: st.warmupSets, lift: st.lift,
  });

  const numField = (label, key, opts) => field(label, numInput({
    value: st[key], ...opts,
    oninput: (e) => { const v = Number(e.target.value); if (v > 0) { st[key] = v; render(); } },
  }));

  return card('Kdy začít rozcvičku', {
    eyebrow: 'Počítá se pozpátku od prvního pokusu',
    action: segmented(COMP_LIFTS.map((k) => ({ value: k, label: LIFTS[k].short })), st.lift,
      (v) => { st.lift = v; render(); }),
  },
    h('div.form-row',
      field('Start flighty', h('input.input', {
        type: 'time', value: st.flightStart,
        onchange: (e) => { st.flightStart = e.target.value || '10:00'; render(); },
      })),
      numField('Pořadí v nominaci', 'lifterOrder', { step: 1, min: 1 }),
      numField('Závodníků ve flightě', 'flightSize', { step: 1, min: 1 })),
    h('div.form-row',
      numField('Minut na pokus', 'minPerAttempt', { step: 0.1, min: 0.5 }),
      numField('Rozcvičovacích sérií', 'warmupSets', { step: 1, min: 2 })),

    !tl ? h('p.note', 'Zadej platný čas startu.') : h('div',
      table(
        ['Kdy', 'Co'],
        [
          { tone: 'low', cells: [h('b', tl.warmupStart), `Začít rozcvičovat — ${st.warmupSets} sérií po ${MEET_TIMING.restBetweenWarmups} minutách`] },
          { tone: 'warn', cells: [h('b', tl.lastWarmup), `Poslední rozcvičovací série, pod ${Math.round(MEET_TIMING.lastWarmupMaxPct * 100)} % otvíráku (${Wu(plan[st.lift][0] * MEET_TIMING.lastWarmupMaxPct)})`] },
          { tone: 'ok', cells: [h('b', tl.attempts[0]), `1. pokus · ${Wu(plan[st.lift][0])}`] },
          { cells: [h('b', tl.attempts[1]), `2. pokus · ${Wu(plan[st.lift][1])}`] },
          { cells: [h('b', tl.attempts[2]), `3. pokus · ${Wu(plan[st.lift][2])}`] },
        ]),
      h('div.grid.g3', { style: { marginTop: '12px' } },
        stat('Kolo trvá', `${tl.roundMin}`, 'minut'),
        stat('Mezi pokusy', `${tl.betweenAttempts}`, 'minut'),
        stat('Okno rozcvičky', `${tl.warmupWindow}`, 'minut'))),

    h('p.note',
      'Poslední rozcvičovací série má padnout zhruba deset závodníků před vlastním pokusem — dost blízko, '
      + 'aby se nevychladlo, dost daleko, aby se stihlo dojít na plac. Mezi pokusy uplyne celé kolo, '
      + 'takže na druhý a třetí pokus se rozcvičovat nemusí.'),

    h('div.flag', { dataset: { tone: 'low' } },
      icon('info', 16),
      h('span', h('b', 'Všechna čísla jsou trenérská praxe, ne měření.'), ' '
        + 'Skutečné tempo závodu kolísá s nároky a technickými přestávkami — proto je minuta na pokus '
        + 'k přenastavení. Na velkých závodech se vyplatí připočíst rezervu.')));
}

/* =========================================================
   Taper
   ========================================================= */
/** „2026-08-29" → „29. 8." — slice na ISO řetězec dával americké pořadí. */
const dm = (isoStr) => {
  const [, mo, da] = isoStr.split('-');
  return `${Number(da)}. ${Number(mo)}.`;
};

function taperCard(meetDate, render) {
  const plan = C.taperPlan(meetDate, { model: st.taperModel, baseVolume: 100 });
  if (!plan) return h('div');
  const g = C.gradeTaperDrop(plan.finalDrop);

  const chart = lineChart([{
    color: 'var(--series-1)', label: 'Objem',
    points: plan.days_.map((d) => ({ date: d.date, value: d.volume })),
  }], { height: 170, fmt: (v) => `${num(v, 0)} %`, unit: '% výchozího objemu' });

  return card('Ladění formy', {
    eyebrow: `${plan.days} dnů do závodu · intenzita zůstává, ubírá se práce`,
    action: segmented(Object.entries(TAPER_MODELS).map(([k, v]) => ({ value: k, label: v.label })), st.taperModel,
      (v) => { st.taperModel = v; render(); }),
  },
    h('div.grid.g4',
      stat('Začátek taperu', dm(plan.start), `${plan.days} dnů předem`),
      stat('Konečný pokles objemu', `${plan.finalDrop}`, '%', g.tone === 'ok' ? 'ok' : 'warn'),
      stat('Vrchol intenzity', dm(plan.intensityPeak), `${TAPER_REFERENCE.intensityPeakDaysBefore.mean} dnů předem`),
      stat('Poslední trénink', dm(plan.lastSession), '4 dny předem')),

    chart,

    h('p.note', plan.note),
    plan.warn && h('div.flag', { dataset: { tone: 'warn' } }, icon('alert', 16), h('span', plan.warn)),

    flagRow({
      tone: g.tone,
      text: `${g.label}. Šampioni v průzkumu ubírali ${fixed(TAPER_REFERENCE.volumeDrop.mean, 1)} ± ${fixed(TAPER_REFERENCE.volumeDrop.sd, 1)} % objemu `
        + `a taper jim trval kolem ${fixed(TAPER_REFERENCE.lengthWeeks, 1)} týdne.`,
    }),

    h('p.note',
      'Nejdůležitější a nejčastěji porušené pravidlo taperu: ubírá se práce, ne váha na ose. '
      + 'Kdo v posledním týdnu sjede i procenta, přijde o formu, ne o únavu.'),

    h('p.note', { style: { color: 'var(--ink-3)' } },
      `Referenční čísla pocházejí z dotazníku mezi ${TAPER_REFERENCE.n} chorvatskými šampiony (Grgic a Mikulic 2017) — `
      + 'popisují, co šampioni dělají, ne důkaz, že je to nejlepší možné. Rozdíl mezi modely změřil řízený pokus '
      + '(Frontiers in Physiology 2021): dřep a bench vyšly srovnatelně, ale mrtvý tah u krokového taperu '
      + 'nevzrostl vůbec, zatímco u exponenciálního o 8 %. Obě skupiny přitom odvedly stejnou celkovou práci.'));
}

/* =========================================================
   Shazování váhy
   ========================================================= */
function cutCard(a, wc) {
  if (wc.limit === Infinity) {
    return card('Shazování váhy', { eyebrow: 'Nejtěžší kategorie' },
      h('p.note', 'V nejtěžší kategorii se neshazuje — horní hranice není.'));
  }
  const cut = C.cutPlan({ bw: a.bw, limit: wc.limit });
  if (!cut) return h('div');

  if (cut.need === 0) {
    return card('Shazování váhy', { eyebrow: `Kategorie ${wc.label}`, action: tag('Sedí', 'ok') },
      h('div.grid.g2',
        stat('Do limitu zbývá', W(cut.headroom, 1), U()),
        stat('Typický shoz v poli', `${fixed(CUT_FACTS.typicalPct, 1)}`, '% hmotnosti')),
      h('p.note', 'Váha sedí do kategorie. Není co řešit.'));
  }

  return card('Shazování váhy', {
    eyebrow: `Do kategorie ${wc.label}`,
    action: tag(cut.band.label, cut.band.tone),
  },
    h('div.grid.g3',
      stat('Shodit', W(cut.need, 1), U(), cut.band.tone === 'bad' ? 'bad' : cut.band.tone === 'warn' ? 'warn' : null),
      stat('Podíl hmotnosti', `${fixed(cut.needPct, 1)}`, '%'),
      stat('Proti typickému shozu', `${cut.vsTypical >= 0 ? '+' : '−'}${fixed(Math.abs(cut.vsTypical), 1)}`, 'procentního bodu')),

    flagRow({ tone: cut.band.tone, text: cut.band.note }),

    table(
      ['Odkud', { label: `Kolik (${U()})`, num: true }, 'Jak'],
      [
        ['Dieta a vyprázdnění', { num: true, value: W(cut.passive, 1) }, 'První dvě procenta jdou srazit bez akutní dehydratace.'],
        ['Voda', { num: true, value: W(cut.water, 1) }, cut.water > 0 ? 'Zbytek už je akutní shoz tekutin. Tady je riziko.' : 'Není potřeba.'],
      ]),

    h('div.flag', { dataset: { tone: 'warn' } },
      icon('alert', 16),
      h('span', h('b', 'Tohle není návod, jak shazovat.'), ' '
        + 'Appka spočítá rozdíl a řekne, kde jsou hranice. Samotný postup má vést někdo, kdo na to má vzdělání — '
        + 'protokoly na vodní nálož kolující po internetu jsou z velké části bez dobré evidence a nesou reálné '
        + 'riziko hyponatremie.')),

    h('p.note',
      `Shazuje ${CUT_FACTS.prevalence} % trojbojařů, typicky ${fixed(CUT_FACTS.typicalPct, 1)} % hmotnosti. `
      + `Na regionálních závodech se shazuje víc než na mezinárodních (${fixed(CUT_FACTS.regional, 1)} proti ${fixed(CUT_FACTS.international, 1)} %). `
      + `Zhruba ${CUT_FACTS.negativePsych} % závodníků přitom popisuje psychický dopad jako negativní — únavu, úzkost, podrážděnost.`),

    h('p.note', { style: { color: 'var(--ink-3)' } },
      'Zásadní proměnná, kterou appka nezná, je čas mezi vážením a startem: IPF váží dvě hodiny předem, '
      + 'jiné federace čtyřiadvacet. Řízený pokus ukázal, že při zhruba pěti procentech a dostatečné regeneraci '
      + 'se maximální síla udrží — bez toho času ale ta věta neplatí. Ověř si pravidlo v aktuálním rulebooku '
      + 'své federace. Data: Campbell a kol. (2025).'));
}
