import { h, card, stat, icon, num, fixed, bigNum, tag, table, clear, shortDate } from '../ui.js';
import { lineChart, stackedBars, barbell } from '../charts.js';
import * as S from '../store.js';
import * as C from '../calc.js';
import { LIFTS, COMP_LIFTS, WELLNESS_ITEMS } from '../data.js';
import { W, U, Wu, liftDot, liftName, empty } from './_util.js';
import { adviceFor } from './advice.js';

export function dashboard(nav) {
  const root = h('div.view');
  const render = () => { clear(root); build(root, render, nav); };
  render();
  return root;
}

function build(view, render, nav) {
  const a = S.athlete();
  if (!a) { view.append(empty('Nejdřív si založ svěřence.', h('button.btn.btn-primary', { onclick: () => nav('athletes') }, 'Přidat svěřence'))); return; }

  const blk = S.block();
  const entries = blk ? S.blockEntries(blk.id) : [];
  const analysis = C.analyzeBlock(entries, S.blockE1rm(blk, a), blk?.start, S.athleteVariants(a));
  const creep = blk ? C.rpeCreep(entries, blk.start) : [];
  const lastCreep = creep.at(-1);
  const cg = lastCreep ? C.gradeCreep(lastCreep.avg) : null;
  const total = S.total(a);
  const wc = C.weightClass(a.bw, a.sex);

  /* ---- hlavní odečet ---- */
  const nextSet = upcomingTopSet(entries);
  view.append(h('section.card',
    h('div.card-body',
      h('div.readout',
        h('div',
          h('div.eyebrow', `Součet trojboje · ${a.name}`),
          h('div.readout-num', W(total, 1), h('small', U().toUpperCase())),
          h('div.readout-meta',
            tag(`DOTS ${num(C.dots(total, a.bw, a.sex), 1)}`, 'neutral'),
            tag(`IPF GL ${num(C.ipfGL(total, a.bw, a.sex, a.equipment), 1)}`, 'neutral'),
            tag(`${Wu(a.bw, 1)} · ${wc.label}`, 'low'),
            a.note && tag(a.note, 'warn'))),
        nextSet && h('div.readout-bar',
          h('div.eyebrow', `Další top série · ${shortDate(nextSet.date)}`),
          barbell(S.loadFor(nextSet.weight)),
          h('div.faint.mono', { style: { fontSize: '11px', textAlign: 'center' } },
            `${liftName(nextSet)} · ${nextSet.sets}×${nextSet.reps} @ ${Wu(nextSet.weight)} · RPE ${nextSet.rpe}`))))));

  /* ---- co je potřeba řešit ---- */
  view.append(triage(a, nav));

  /* ---- osobní maxima ---- */
  view.append(h('div.grid.g4',
    ...COMP_LIFTS.map((k) => {
      const pts = (S.state.e1rmLog ?? []).filter((x) => x.athleteId === a.id && x.lift === k)
        .sort((x, y) => new Date(x.date) - new Date(y.date))
        .map((x) => ({ date: x.date, value: x.value }));
      const p = C.plateauCheck(pts);
      const g = C.gradePlateau(p);
      return h('div.stat',
        h('div.stat-label', LIFTS[k].label),
        h('div.stat-value', W(a.e1rm[k]), h('span.stat-unit', U())),
        h('div.faint.mono', { style: { fontSize: '11px' } },
          p ? `${p.perMonth >= 0 ? '+' : ''}${num(p.perMonth, 1)} ${U()} / měsíc` : 'bez trendu'),
        p && h('div', { style: { marginTop: '4px' } }, tag(g.label, g.tone)));
    }),
    (() => {
      if (!blk) {
        return h('div.stat', { dataset: { tone: 'hero' } },
          h('div.stat-label', 'Žádný blok'),
          h('div.stat-value', '—'),
          h('div.faint.mono', { style: { fontSize: '11px' } }, 'Postav blok ve Stavbě bloku'));
      }
      // rozlišit běžící blok od dokončeného — „4 / 4 týdnů" u hotového bloku mate
      const uply = C.daysBetween(blk.start, new Date());
      const raw = Math.floor(uply / 7) + 1;
      const hotovo = raw > blk.weeks;
      const week = Math.min(blk.weeks, Math.max(1, raw));
      return h('div.stat', { dataset: { tone: 'hero' } },
        h('div.stat-label', hotovo ? 'Blok dokončen' : uply < 0 ? 'Blok začíná' : 'Blok'),
        hotovo
          ? h('div.stat-value', blk.weeks, h('span.stat-unit', 'týdnů hotovo'))
          : h('div.stat-value', `${week}`, h('span.stat-unit', `/ ${blk.weeks} týdnů`)),
        h('div.faint.mono', { style: { fontSize: '11px' } }, blk.name));
    })()));

  /* ---- objem bloku + co je tenhle týden ---- */
  view.append(h('div.grid.g-side',
    card(blk ? blk.name : 'Blok', { eyebrow: 'Tonáž po týdnech', class: 'is-flush' },
      analysis.weeks.length
        ? h('div', { style: { padding: '0 24px 24px' } },
            stackedBars(
              analysis.weeks.map((w) => ({ label: `T${w.week}`, values: w.lifts })),
              [...COMP_LIFTS, 'accessory'].map((k) => ({ key: k, label: LIFTS[k].label, color: LIFTS[k].color })),
              { fmt: (v) => `${bigNum(S.toDisplay(v))}`, unit: U() }),
            h('div.split-legend', { style: { marginTop: '16px' } },
              ...[...COMP_LIFTS, 'accessory'].map((k) =>
                h('div.split-item', h('i', { style: { background: LIFTS[k].color } }), h('span.split-name', LIFTS[k].label)))))
        : h('div.chart-empty', 'Blok zatím nemá žádné jednotky.')),

    card('Tento týden', { eyebrow: 'Dnes a zbytek týdne' },
      thisWeek(entries, nav))));

  /* ---- trend E1RM ---- */
  const logs = (S.state.e1rmLog ?? []).filter((x) => x.athleteId === a.id);
  const series = COMP_LIFTS.map((k) => ({
    color: LIFTS[k].color,
    label: LIFTS[k].label,
    points: logs.filter((x) => x.lift === k)
      .sort((x, y) => new Date(x.date) - new Date(y.date))
      .map((x) => ({ date: x.date, value: S.toDisplay(x.value) })),
  })).filter((s) => s.points.length > 1);

  view.append(h('div.grid.g-side',
    card('Vývoj maxim', { eyebrow: `E1RM v čase · ${U()}` },
      series.length
        ? h('div', lineChart(series, { height: 210, fmt: (v) => num(v, 0), unit: U() }),
            h('div.split-legend', { style: { marginTop: '10px' } },
              ...COMP_LIFTS.map((k) => h('div.split-item', h('i', { style: { background: LIFTS[k].color } }), h('span.split-name', LIFTS[k].label)))))
        : h('div.chart-empty', 'Zapiš aspoň dvě maxima, ať je co kreslit.')),

    h('div.stack',
      card('Jak to reálně šlo', {
        eyebrow: 'Skutečné RPE proti plánu',
        action: h('button.btn.btn-sm', { onclick: () => nav('realita') }, icon('target', 14), 'Otevřít'),
      },
        lastCreep
          ? h('div',
              h('div.grid.g2',
                stat('Odchylka RPE (poslední týden)', `${lastCreep.avg >= 0 ? '+' : '−'}${num(Math.abs(lastCreep.avg), 2)}`, cg.label, cg.tone),
                stat('Zapsaných sérií', creep.reduce((s, w) => s + w.n, 0), `z ${entries.length}`)),
              h('p.note', 'Když stejný plán jede týden co týden na vyšší RPE, hromadí se únava — i když váhy na papíře sedí.'))
          : h('div.chart-empty', 'Zatím žádné zapsané skutečné RPE. Přidej ho v Plán vs. realita.')),

      wellnessCard(a, render, nav))));
}

/**
 * Nejnaléhavější doporučení rovnou na Přehledu.
 *
 * Dřív tady byla „Automatická kontrola bloku" — seznam, ve kterém pět
 * řádků z šesti hlásilo, že je všechno v pořádku. Zelená fajfka za nic
 * neplatí: kdo ji vidí pokaždé, přestane číst i ten šestý řádek, na
 * kterém záleží. Teď se ukazuje jen to, co hoří, a zbytek je jedno číslo
 * s odkazem.
 */
function triage(a, nav) {
  const all = adviceFor(a);
  const urgent = all.filter((r) => r.priority === 1);
  const rest = all.length - urgent.length;

  const open = h('button.btn.btn-sm', { onclick: () => nav('prehled/doporuceni') },
    all.length ? `Všech ${all.length} doporučení` : 'Otevřít doporučení', icon('arrow', 13));

  if (!urgent.length) {
    return h('section.card.triage', { dataset: { tone: 'calm' } },
      h('div.card-body.triage-body',
        icon('check', 18),
        h('div.triage-text',
          h('b', 'Nic, co by hořelo.'),
          ' ',
          rest ? `${rest} ${rest === 1 ? 'poznámka' : rest < 5 ? 'poznámky' : 'poznámek'} k dalšímu bloku.` : 'Appka zatím nemá dost zápisů, aby měla co říct.'),
        open));
  }

  return h('section.card.triage', { dataset: { tone: 'hot' } },
    h('header.card-head',
      h('div',
        h('div.eyebrow', 'Co je potřeba řešit'),
        h('h2.card-title', urgent.length === 1 ? 'Jedna věc nepočká' : `${urgent.length} věci nepočkají`)),
      open),
    h('div.card-body',
      ...urgent.slice(0, 3).map((r) => h('div.triage-row',
        icon('alert', 16),
        h('div.triage-row-text',
          h('b', r.title),
          h('span', r.action)),
        r.screen && h('button.btn.btn-sm.btn-ghost', { onclick: () => nav(r.screen) }, 'Otevřít', icon('arrow', 13))))));
}

/**
 * Hooper a Mackinnon (1995) — čtyři položky na škále 1–7. Appka ukládá
 * jeden záznam na den, přepisuje ho druhý zápis týž den, a čte dnešní
 * součet proti vlastnímu klouzavému průměru — žádná pevná hranice tu
 * neplatí univerzálně.
 */
function wellnessCard(a, render, nav) {
  const today = S.iso(new Date());
  const history = S.athleteWellness(a.id);
  const todayEntry = history.find((w) => w.date === today) ?? {};
  const todayIndex = C.hooperIndex(todayEntry);
  const baseline = C.hooperBaseline(history, today);
  const g = C.gradeHooper(todayIndex, baseline);

  const save = (patch) => {
    S.setWellness(a.id, today, {
      sleep: todayEntry.sleep, stress: todayEntry.stress, fatigue: todayEntry.fatigue, soreness: todayEntry.soreness,
      ...patch,
    });
    render();
  };

  return card('Jak se dnes cítíš', {
    eyebrow: 'Hooperův dotazník · 1 = nejlíp, 7 = nejhůř',
    action: h('button.btn.btn-sm.btn-ghost', {
      title: 'Co Hooperův index znamená a odkud se bere',
      onclick: () => nav('slovnik'),
    }, icon('info', 14), 'Co to je'),
  },
    h('div.scales',
      ...WELLNESS_ITEMS.map((item) => h('div.scale-row',
        h('span.scale-label', item.label),
        scale(todayEntry[item.key] || 0, (n) => save({ [item.key]: n }), item.label)))),

    todayIndex != null
      ? h('div.scale-out',
          stat('Dnešní index', todayIndex, 'ze 4–28'),
          baseline != null && stat('Vlastní průměr', fixed(baseline, 1), `posledních ${Math.min(history.filter((w) => w.date < today).length, 7)} dnů`),
          tag(g.label, g.tone))
      : h('p.note', 'Vyplň všechny čtyři, ať appka spočítá dnešní index.'));
}

/**
 * Škála 1–7 jako sedm tlačítek.
 *
 * Bývalo to rozbalovací pole: otevřít, sjet, vybrat, a to čtyřikrát.
 * Denní zápis, který zabere šestnáct kliknutí, se prostě nedělá —
 * a bez něj appka nemá z čeho počítat připravenost.
 */
function scale(value, onpick, label) {
  return h('div.scale', { role: 'radiogroup', 'aria-label': label },
    ...[1, 2, 3, 4, 5, 6, 7].map((n) => h('button.scale-dot', {
      type: 'button',
      role: 'radio',
      'aria-checked': String(n === value),
      'aria-label': `${label}: ${n} ze 7`,
      onclick: () => onpick(n),
    }, n)));
}

/** Nejtěžší série z nejbližší budoucí (nebo poslední) jednotky. */
function upcomingTopSet(entries) {
  if (!entries.length) return null;
  const today = S.iso(new Date());
  const future = entries.filter((e) => e.date >= today && e.lift !== 'accessory');
  const pool = future.length ? future : entries.filter((e) => e.lift !== 'accessory');
  const day = pool.reduce((min, e) => (min == null || (future.length ? e.date < min : e.date > min) ? e.date : min), null);
  const sameDay = pool.filter((e) => e.date === day);
  return sameDay.reduce((best, e) => (!best || e.weight > best.weight ? e : best), null);
}

/**
 * Dnes a zbytek týdne — ne celý týden od pondělí. Kdo se podívá ve čtvrtek,
 * nezajímá ho, co bylo v pondělí; to už proběhlo.
 */
function thisWeek(entries, nav) {
  const start = S.iso(new Date());
  const end = S.iso(S.addDays(S.mondayOf(new Date()), 7));
  const week = entries
    .filter((e) => e.date >= start && e.date < end)
    .sort((x, y) => x.date.localeCompare(y.date));

  if (!week.length) {
    return h('div.empty',
      h('p.note', 'Do konce týdne už nic naplánováno.'),
      h('button.btn.btn-sm', { onclick: () => nav('program') }, 'Postavit blok'));
  }

  const days = [...new Set(week.map((e) => e.date))];
  return h('div', { style: { display: 'flex', flexDirection: 'column', gap: '12px' } },
    ...days.map((d) => h('div',
      h('div.eyebrow', shortDate(d)),
      table(
        ['Cvik', { label: 'Sér.×op.', num: true }, { label: `Váha`, num: true }, { label: 'RPE', num: true }],
        week.filter((e) => e.date === d).map((e) => [
          h('span', liftDot(e.lift), liftName(e)),
          { num: true, value: `${e.sets}×${e.reps}` },
          { num: true, value: W(e.weight) },
          { num: true, value: e.rpe ?? '—' },
        ])))));
}
