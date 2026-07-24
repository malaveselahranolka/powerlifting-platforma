import { h, card, stat, icon, num, fixed, bigNum, tag, table, field, select, clear, shortDate } from '../ui.js';
import { lineChart, stackedBars, barbell } from '../charts.js';
import * as S from '../store.js';
import * as C from '../calc.js';
import { LIFTS, COMP_LIFTS, WELLNESS_ITEMS } from '../data.js';
import { W, U, Wu, liftDot, liftName, flagRow, empty } from './_util.js';

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
  const analysis = C.analyzeBlock(entries, S.blockE1rm(blk, a), blk?.start);
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

  /* ---- objem bloku + zatížení ---- */
  view.append(h('div.grid.g-side',
    card(blk ? blk.name : 'Blok', { eyebrow: 'Tonáž po týdnech', class: 'is-flush' },
      analysis.weeks.length
        ? h('div', { style: { padding: '0 24px 24px' } },
            stackedBars(
              analysis.weeks.map((w) => ({ label: `T${w.week}`, values: w.lifts })),
              [...COMP_LIFTS, 'accessory'].map((k) => ({ key: k, label: LIFTS[k].label, color: LIFTS[k].color })),
              { fmt: (v) => `${bigNum(S.toDisplay(v))}` }),
            h('div.split-legend', { style: { marginTop: '16px' } },
              ...[...COMP_LIFTS, 'accessory'].map((k) =>
                h('div.split-item', h('i', { style: { background: LIFTS[k].color } }), h('span.split-name', LIFTS[k].label)))))
        : h('div.chart-empty', 'Blok zatím nemá žádné jednotky.')),

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
        : h('div.chart-empty', 'Zatím žádné zapsané skutečné RPE. Přidej ho v Plán vs. realita.'))));

  /* ---- pohoda (Hooperův index) ---- */
  view.append(wellnessCard(a, render));

  /* ---- trend E1RM ---- */
  const logs = (S.state.e1rmLog ?? []).filter((x) => x.athleteId === a.id);
  const series = COMP_LIFTS.map((k) => ({
    color: LIFTS[k].color,
    points: logs.filter((x) => x.lift === k)
      .sort((x, y) => new Date(x.date) - new Date(y.date))
      .map((x) => ({ date: x.date, value: S.toDisplay(x.value) })),
  })).filter((s) => s.points.length > 1);

  view.append(h('div.grid.g-side',
    card('Vývoj maxim', { eyebrow: `E1RM v čase · ${U()}` },
      series.length
        ? h('div', lineChart(series, { height: 210, fmt: (v) => num(v, 0) }),
            h('div.split-legend', { style: { marginTop: '10px' } },
              ...COMP_LIFTS.map((k) => h('div.split-item', h('i', { style: { background: LIFTS[k].color } }), h('span.split-name', LIFTS[k].label)))))
        : h('div.chart-empty', 'Zapiš aspoň dvě maxima, ať je co kreslit.')),

    card('Tento týden', { eyebrow: 'Naplánováno' },
      thisWeek(entries, nav))));

  /* ---- hlášky ---- */
  if (analysis.weeks.length) {
    view.append(card('Co si hlídat', { eyebrow: 'Automatická kontrola bloku', action: h('button.btn.btn-sm', { onclick: () => nav('block') }, 'Otevřít analýzu') },
      ...C.blockFlags(analysis, (k) => LIFTS[k]?.label ?? k).map(flagRow)));
  }
}

/**
 * Hooper a Mackinnon (1995) — čtyři položky na škále 1–7. Appka ukládá
 * jeden záznam na den, přepisuje ho druhý zápis týž den, a čte dnešní
 * součet proti vlastnímu klouzavému průměru — žádná pevná hranice tu
 * neplatí univerzálně.
 */
function wellnessCard(a, render) {
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

  return card('Jak se dnes cítíš', { eyebrow: 'Hooperův dotazník — spánek, stres, únava, bolestivost' },
    h('div.form-row',
      ...WELLNESS_ITEMS.map((item) => field(item.label,
        select([{ value: 0, label: '—' }, ...[1, 2, 3, 4, 5, 6, 7].map((n) => ({ value: n, label: String(n) }))], {
          value: todayEntry[item.key] || 0,
          onchange: (e) => save({ [item.key]: Number(e.target.value) }),
        }),
        item.hint))),
    todayIndex != null
      ? h('div', { style: { marginTop: '14px', display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap' } },
          stat('Dnešní index', todayIndex, 'ze 4–28'),
          baseline != null && stat('Vlastní průměr', fixed(baseline, 1), `posledních ${Math.min(history.filter((w) => w.date < today).length, 7)} dnů`),
          tag(g.label, g.tone))
      : h('p.note', { style: { marginTop: '14px' } }, 'Vyplň všechny čtyři položky, ať appka spočítá dnešní index.'),
    h('p.note', { style: { marginTop: '14px' } },
      'Hooper a Mackinnon (1995) tohle ověřili u plavců proti fyziologickým markerům přetrénování (76 % rozptylu). Na rozdíl od RPE nezachytí jen trénink — i to, co se do posilovny přineslo zvenku. Appka ho čte proti tvému vlastnímu průměru, ne proti univerzální hranici — ta neexistuje.'));
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

function thisWeek(entries, nav) {
  const start = S.iso(S.mondayOf(new Date()));
  const end = S.iso(S.addDays(S.mondayOf(new Date()), 7));
  const week = entries
    .filter((e) => e.date >= start && e.date < end)
    .sort((x, y) => x.date.localeCompare(y.date));

  if (!week.length) {
    return h('div.empty',
      h('p.note', 'Tento týden nic naplánováno.'),
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
