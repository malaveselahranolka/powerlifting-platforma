import { h, card, stat, icon, num, bigNum, tag, table, shortDate } from '../ui.js';
import { lineChart, stackedBars, gauge, barbell } from '../charts.js';
import * as S from '../store.js';
import * as C from '../calc.js';
import { LIFTS, COMP_LIFTS } from '../data.js';
import { W, U, Wu, liftDot, liftName, flagRow, empty } from './_util.js';

export function dashboard(nav) {
  const a = S.athlete();
  if (!a) return empty('Nejdřív si založ svěřence.', h('button.btn.btn-primary', { onclick: () => nav('athletes') }, 'Přidat svěřence'));

  const blk = S.block();
  const entries = blk ? S.blockEntries(blk.id) : [];
  const analysis = C.analyzeBlock(entries, S.blockE1rm(blk, a), blk?.start);
  const ac = C.acwr(analysis.loadsByDay, new Date());
  const acg = C.gradeAcwr(ac.ratio);
  const total = S.total(a);
  const wc = C.weightClass(a.bw, a.sex);

  const view = h('div.view');

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
      const t = C.trend((S.state.e1rmLog ?? []).filter((x) => x.athleteId === a.id && x.lift === k)
        .sort((x, y) => new Date(x.date) - new Date(y.date))
        .map((x) => ({ date: x.date, value: x.value })));
      return h('div.stat',
        h('div.stat-label', LIFTS[k].label),
        h('div.stat-value', W(a.e1rm[k]), h('span.stat-unit', U())),
        h('div.faint.mono', { style: { fontSize: '11px' } },
          t ? `${t.perMonth >= 0 ? '+' : ''}${num(t.perMonth, 1)} ${U()} / měsíc` : 'bez trendu'));
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

    card('Poměr zátěže', { eyebrow: 'ACWR · akutní 7 dní / chronická 28 dní' },
      gauge(ac.ratio, {
        max: 2,
        sub: acg.label,
        bands: [
          { from: 0, to: 0.8, color: 'var(--blue)' },
          { from: 0.8, to: 1.3, color: 'var(--green)' },
          { from: 1.3, to: 1.5, color: 'var(--yellow)' },
          { from: 1.5, to: 2, color: 'var(--red)' },
        ],
      }),
      h('div.grid.g2',
        stat('Akutní (7 dní)', bigNum(S.toDisplay(ac.acute)), U()),
        stat('Chronická (týden)', bigNum(S.toDisplay(ac.chronic)), U())),
      h('p.note', 'Pásmo 0,8–1,3 je bezpečné. Nad 1,5 rosteš rychleji, než se stíháš adaptovat.'))));

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
      ...C.blockFlags(analysis, ac.ratio, (k) => LIFTS[k]?.label ?? k).map(flagRow)));
  }

  return view;
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
