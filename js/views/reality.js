import { h, card, stat, icon, num, fixed, tag, table, field, decimalInput, numInput, inputNum, select, clear, toast, weekday } from '../ui.js';
import { lineChart } from '../charts.js';
import * as S from '../store.js';
import * as C from '../calc.js';
import { LIFTS, COMP_LIFTS } from '../data.js';
import { W, U, Wu, liftDot, liftName, empty, rpeLabel } from './_util.js';

const st = { openWeek: null, filter: 'main' };

export function realityView(nav) {
  const root = h('div.view');
  const render = () => { clear(root); build(root, render, nav); };
  render();
  return root;
}

function build(root, render, nav) {
  const a = S.athlete();
  const blk = S.block();

  if (!a || !blk) {
    root.append(empty('Není co porovnávat — nejdřív postav blok.',
      h('button.btn.btn-primary', { onclick: () => nav('program') }, 'Postavit blok')));
    return;
  }

  const blocks = S.state.blocks.filter((b) => b.athleteId === a.id);
  const all = S.blockEntries(blk.id);
  const weeks = Math.max(1, ...all.map((e) => Math.floor(C.daysBetween(blk.start, e.date) / 7) + 1));
  if (st.openWeek == null || st.openWeek > weeks) st.openWeek = pickWeek(all, blk, weeks);

  /* ---- výběr ---- */
  root.append(h('div.btn-row',
    h('div.field', { style: { minWidth: '220px' } },
      h('span.field-label', 'Blok'),
      select(blocks.map((b) => ({ value: b.id, label: `${b.name} · ${b.weeks} týdnů` })), {
        value: blk.id,
        onchange: (e) => { S.commit((s) => { s.activeBlock = e.target.value; }); st.openWeek = null; render(); },
      })),
    h('div.field', { style: { minWidth: '190px' } },
      h('span.field-label', 'Které cviky'),
      select([
        { value: 'main', label: 'Jen soutěžní' },
        { value: 'all', label: 'Všechny včetně doplňků' },
      ], { value: st.filter, onchange: (e) => { st.filter = e.target.value; render(); } }))));

  const scoped = st.filter === 'main' ? all.filter((e) => e.lift !== 'accessory') : all;
  const done = scoped.filter((e) => e.actualRpe != null);

  /* ---- souhrn ---- */
  const creep = C.rpeCreep(scoped, blk.start);
  const last = creep.at(-1);
  const cg = C.gradeCreep(last?.avg);
  const zapsano = Math.round((done.length / Math.max(1, scoped.length)) * 100);

  root.append(h('div.grid.g4',
    stat('Zapsáno', `${zapsano}`, `% z ${scoped.length} sérií`),
    stat('Odchylka RPE', last ? `${last.avg >= 0 ? '+' : '−'}${fixed(Math.abs(last.avg), 2)}` : '—', cg.label, cg.tone),
    (() => {
      const tezsi = done.filter((e) => e.actualRpe > e.rpe).length;
      return stat('Těžších, než plán', `${tezsi}`, `z ${done.length} zapsaných`);
    })(),
    (() => {
      const real = done.map(C.setE1rm).filter(Boolean);
      return stat('Nejlepší odhad 1RM', real.length ? W(Math.max(...real)) : '—', U());
    })()));

  if (!done.length) {
    root.append(card('Zatím není co porovnávat', { eyebrow: 'Jak to rozjet' },
      h('p.note', 'Appka zná plán, ale ne to, jak trénink reálně dopadl. Zapiš u sérií skutečné RPE — jedno číslo za sérii — a od té chvíle umí říct, jestli závodník jede podle plánu, nebo se pere s únavou.'),
      h('p.note', 'Nejrychlejší cesta: dole v tabulce projeď jednu jednotku a k hlavním sériím dopiš, jak těžké byly. Doplňky nemusíš.')));
  }

  /* ---- posun RPE po týdnech ---- */
  if (creep.length > 1) {
    root.append(card('Posun RPE po týdnech', {
      eyebrow: 'Kladné číslo = těžší, než bylo v plánu',
      class: 'is-flush',
    },
      h('div', { style: { padding: '0 24px 24px' } },
        table(
          ['Týden', { label: 'Zapsáno sérií', num: true }, { label: 'Ø odchylka', num: true },
            { label: 'Těžších', num: true }, { label: 'Lehčích', num: true }, 'Stav'],
          creep.map((w) => {
            const g = C.gradeCreep(w.avg);
            return {
              tone: g.tone === 'bad' ? 'bad' : g.tone === 'warn' ? 'warn' : null,
              cells: [
                h('b', `Týden ${w.week}`),
                { num: true, value: w.n },
                { num: true, value: h('b', { style: { color: w.avg >= 0.3 ? 'var(--yellow)' : w.avg <= -0.4 ? 'var(--blue)' : 'var(--chalk)' } }, `${w.avg >= 0 ? '+' : '−'}${fixed(Math.abs(w.avg), 2)}`) },
                { num: true, value: w.harder },
                { num: true, value: w.easier },
                tag(g.label, g.tone),
              ],
            };
          })),
        h('p.note', { style: { marginTop: '12px' } },
          'Když stejný plán jede týden co týden na vyšší RPE, hromadí se únava — i když váhy na papíře sedí. Je to nejčistší signál, že je čas na deload. Naopak trvale nižší RPE znamená, že plán zaostává za formou a dá se přitlačit.'))));
  }

  /* ---- doporučení podle skutečného výkonu ---- */
  if (last) {
    const recs = COMP_LIFTS
      .map((lift) => ({ lift, adj: C.weeklyAdjustment(scoped, lift, last.week, blk.start) }))
      .filter((r) => r.adj);

    if (recs.length) {
      root.append(card('Doporučení podle skutečného výkonu', {
        eyebrow: `Podle týdne ${last.week} — poměr skutečného a plánovaného odhadu maxima, ne jen odchylka RPE`,
      },
        h('div', { style: { display: 'flex', flexDirection: 'column', gap: '10px' } },
          ...recs.map(recommendationFlag)),
        h('p.note', { style: { marginTop: '14px' } },
          'Ber to jako signál, ne automatický zápis — appka nikam sama nic nepřepisuje. Váhu uprav přímo v tabulce týdne níž, u konkrétní série, která ještě neproběhla.')));
    }
  }

  /* ---- vývoj odhadu maxima z reálných sérií ---- */
  const series = COMP_LIFTS.map((k) => {
    const pts = done
      .filter((e) => e.lift === k)
      .map((e) => ({ date: e.date, value: C.setE1rm(e) }))
      .filter((p) => p.value != null)
      .sort((x, y) => x.date.localeCompare(y.date));
    // z jednoho dne bere jen nejlepší sérii — jinak by graf skákal podle back-offů
    const best = new Map();
    for (const p of pts) best.set(p.date, Math.max(best.get(p.date) ?? 0, p.value));
    return { color: LIFTS[k].color, lift: k, points: [...best.entries()].map(([date, value]) => ({ date, value: S.toDisplay(value) })) };
  }).filter((s) => s.points.length > 1);

  if (series.length) {
    root.append(card('Odhad maxima ze skutečných sérií', {
      eyebrow: `Nejlepší série každého dne · ${U()}`,
    },
      lineChart(series, { height: 210, fmt: (v) => num(v, 0) }),
      h('div.split-legend',
        ...series.map((s) => h('div.split-item',
          h('i', { style: { background: s.color } }),
          h('span.split-name', LIFTS[s.lift].label)))),
      h('p.note', 'Tohle je jediný graf v appce, který ukazuje skutečný výkon, ne plán. Roste-li, trénink funguje. Stojí-li při rostoucím objemu, něco nesedí — obvykle regenerace.')));
  }

  /* ---- jednotky ---- */
  root.append(h('div.week-bar',
    h('div.week-tabs',
      ...Array.from({ length: weeks }, (_, i) => i + 1).map((w) => {
        const wr = scoped.filter((e) => Math.floor(C.daysBetween(blk.start, e.date) / 7) + 1 === w);
        const wd = wr.filter((e) => e.actualRpe != null).length;
        return h('button.week-tab', {
          type: 'button',
          'aria-pressed': String(w === st.openWeek),
          onclick: () => { st.openWeek = w; render(); },
        },
          h('span.week-tab-n', `Týden ${w}`),
          h('span.week-tab-sum', wr.length ? `${wd}/${wr.length} zapsáno` : 'prázdný'));
      }))));

  root.append(sessionEditor(scoped, blk, render));
}

/** Jeden řádek doporučení — čistě informativní, nic sám nepřepisuje. */
function recommendationFlag({ lift, adj }) {
  const tone = adj.pctChange <= -1 ? 'warn' : adj.pctChange >= 1 ? 'ok' : 'low';
  return h('div.flag', { dataset: { tone } },
    icon(tone === 'warn' ? 'alert' : 'check', 16),
    h('span',
      h('b', LIFTS[lift].label), ': skutečný odhad maxima ', h('b', Wu(adj.avgReal)),
      ' proti plánovanému ', Wu(adj.avgPlan),
      ` (${adj.n} ${adj.n === 1 ? 'zapsaná série' : 'zapsané série'}) — `,
      h('b', `${adj.pctChange >= 0 ? '+' : ''}${fixed(adj.pctChange, 1)} %`), '.'));
}

/** Otevře týden, kde se naposledy něco dělo — ne vždycky první. */
function pickWeek(all, blk, weeks) {
  const withActual = all.filter((e) => e.actualRpe != null);
  const src = withActual.length ? withActual : all;
  const lastDate = src.map((e) => e.date).sort().at(-1);
  if (!lastDate) return 1;
  return Math.min(weeks, Math.max(1, Math.floor(C.daysBetween(blk.start, lastDate) / 7) + 1));
}

/* =========================================================
   Zápis skutečnosti
   ========================================================= */

function sessionEditor(scoped, blk, render) {
  const week = st.openWeek;
  const rows = scoped.filter((e) => Math.floor(C.daysBetween(blk.start, e.date) / 7) + 1 === week);
  const days = [...new Set(rows.map((e) => e.date))].sort();

  const body = h('div', { style: { padding: '0 24px 24px', display: 'flex', flexDirection: 'column', gap: '20px' } });

  if (!days.length) {
    body.append(h('div.empty', h('p.note', `Týden ${week} nemá žádné série.`)));
  }

  for (const date of days) {
    const dayRows = rows.filter((e) => e.date === date);

    // únava dne podle RTS — jen tam, kde je aspoň dvě zapsané série jednoho cviku
    const drops = COMP_LIFTS
      .map((k) => ({ lift: k, f: C.fatigueDrop(dayRows, k, date) }))
      .filter((x) => x.f);

    body.append(h('div.day-block',
      h('header.day-head',
        h('div',
          h('div.eyebrow', weekday(date)),
          h('span.day-count', `${dayRows.filter((e) => e.actualRpe != null).length} z ${dayRows.length} zapsáno`)),
        drops.length ? h('div.btn-row', ...drops.map(({ lift, f }) => {
          const g = C.gradeFatigueDrop(f.drop);
          return h('span', { title: `${LIFTS[lift].label}: odhad maxima klesl z ${W(f.peak)} na ${W(f.last)} ${U()}` },
            tag(`${LIFTS[lift].short} únava ${fixed(f.drop, 1)} %`, g.tone));
        })) : null),
      dayTable(dayRows, render)));
  }

  return card(`Týden ${week} — co se reálně stalo`, {
    eyebrow: 'Dopiš skutečné RPE. Váhu a opakování měň jen tam, kde se lišily od plánu.',
    class: 'is-flush',
  }, body);
}

function dayTable(dayRows, render) {
  return h('div.table-wrap',
    h('table.table.plan-table',
      h('thead', h('tr',
        h('th', 'Cvik'),
        h('th.num', 'Plán'),
        h('th.num', 'Plán RPE'),
        h('th.num', 'Skutečné RPE'),
        h('th.num', 'Odchylka'),
        h('th.num', `Odhad 1RM (${U()})`),
        h('th', ''))),
      h('tbody', ...dayRows.map((e) => realRow(e, render)))));
}

function realRow(e, render) {
  const deltaCell = h('td.num');
  const e1Cell = h('td.num');

  const input = decimalInput({
    value: e.actualRpe == null ? '' : rpeLabel(e.actualRpe),
    class: 'inline-input',
    placeholder: '—',
    'aria-label': 'Skutečné RPE',
  });

  const refresh = () => {
    clear(deltaCell);
    clear(e1Cell);

    if (e.actualRpe == null) {
      deltaCell.append(h('span.faint', '—'));
      e1Cell.append(h('span.faint', '—'));
      return;
    }

    const d = C.round(e.actualRpe - e.rpe, 1);
    deltaCell.append(h('b', {
      style: { color: d > 0 ? 'var(--yellow)' : d < 0 ? 'var(--blue)' : 'var(--green)' },
    }, d === 0 ? 'přesně' : `${d > 0 ? '+' : '−'}${fixed(Math.abs(d), 1)}`));

    const v = C.setE1rm(e);
    e1Cell.append(v == null ? h('span.faint', 'mimo tabulku') : h('b', W(v, 1)));
  };

  input.addEventListener('input', () => {
    const raw = input.value.trim();
    if (raw === '') {
      S.commit((s) => { const t = s.entries.find((x) => x.id === e.id); if (t) t.actualRpe = null; });
      e.actualRpe = null;
      refresh();
      return;
    }
    const v = Number(raw.replace(',', '.'));
    if (!Number.isFinite(v) || v <= 0) return;
    const rounded = Math.min(10, Math.max(5, Math.round(v * 2) / 2));
    e.actualRpe = rounded;
    S.commit((s) => { const t = s.entries.find((x) => x.id === e.id); if (t) t.actualRpe = rounded; });
    refresh();
  });

  const weightInput = numInput({
    value: inputNum(S.toDisplay(e.weight), 1), step: 2.5, class: 'inline-input',
    style: { width: '72px' }, 'aria-label': `Váha (${U()})`,
    onchange: (ev) => {
      const v = S.fromDisplay(Number(ev.target.value));
      if (!(v > 0)) return;
      e.weight = v;
      S.commit((s) => { const t = s.entries.find((x) => x.id === e.id); if (t) t.weight = v; });
      refresh();
    },
  });

  refresh();

  return h('tr',
    h('td', h('span', liftDot(e.lift), liftName(e))),
    h('td.num', h('span.mono', `${e.sets}×${e.reps} @ `), weightInput, h('span.faint', ` ${U()}`)),
    h('td.num', h('span.faint', e.rpe == null ? '—' : rpeLabel(e.rpe))),
    h('td.num', input),
    deltaCell,
    e1Cell,
    h('td', h('div.row-actions',
      h('button.btn.btn-ghost.btn-sm', {
        title: 'Šlo přesně podle plánu',
        onclick: () => {
          e.actualRpe = e.rpe;
          S.commit((s) => { const t = s.entries.find((x) => x.id === e.id); if (t) t.actualRpe = e.rpe; });
          input.value = e.rpe == null ? '' : rpeLabel(e.rpe);
          refresh();
        },
      }, icon('check', 14)))));
}
