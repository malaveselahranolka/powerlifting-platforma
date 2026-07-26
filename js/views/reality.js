import { h, card, stat, icon, num, fixed, tag, table, decimalInput, numInput, select, clear, weekday } from '../ui.js';
import { lineChart } from '../charts.js';
import * as S from '../store.js';
import * as C from '../calc.js';
import { LIFTS, COMP_LIFTS } from '../data.js';
import { W, U, Wu, liftDot, liftName, empty, flagRow, rpeLabel } from './_util.js';

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
      // nejlepší den, ne nejlepší série — vážený odhad dne nenadhodnocuje
      // jen proto, že se ten den zapsalo víc sérií
      const byDay = new Map();
      for (const e of done) {
        const k = `${e.lift}|${e.date}`;
        if (!byDay.has(k)) byDay.set(k, []);
        byDay.get(k).push(e);
      }
      const peaks = [...byDay.values()].map((rows) => C.sessionE1rm(rows)?.weighted).filter(Boolean);
      return stat('Nejlepší odhad 1RM', peaks.length ? W(Math.max(...peaks)) : '—', `${U()} · vážený odhad dne`);
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
                { num: true, value: h('b', { style: { color: w.avg >= 0.3 ? 'var(--warn)' : w.avg <= -0.4 ? 'var(--info)' : 'var(--ink)' } }, `${w.avg >= 0 ? '+' : '−'}${fixed(Math.abs(w.avg), 2)}`) },
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
          'Ber to jako signál, ne automatický zápis — appka nikam sama nic nepřepisuje. Plán se mění ve Stavbě bloku; tabulka týdne níž slouží k zápisu toho, co se doopravdy stalo.')));
    }
  }

  /* ---- vývoj odhadu maxima z reálných sérií ---- */
  /*
   * Z jednoho dne se bere vážený odhad, ne nejlepší série.
   *
   * Maximum z několika zašuměných odhadů je systematicky nadhodnocené: je to
   * extrémní hodnota, ne odhad středu. Kdo zapíše osm sérií, dostane vyšší
   * číslo než kdo zapíše dvě — i když zvedal totéž. Vážený průměr tenhle
   * artefakt nemá a navíc dá větší váhu sériím, u kterých je RPE
   * spolehlivější.
   */
  const dayStats = new Map();  // 'lift|date' → sessionE1rm
  const series = COMP_LIFTS.map((k) => {
    const byDate = new Map();
    for (const e of done.filter((x) => x.lift === k)) {
      if (!byDate.has(e.date)) byDate.set(e.date, []);
      byDate.get(e.date).push(e);
    }
    const points = [];
    for (const [date, rows] of [...byDate.entries()].sort((x, y) => x[0].localeCompare(y[0]))) {
      const day = C.sessionE1rm(rows);
      if (!day) continue;
      dayStats.set(`${k}|${date}`, day);
      points.push({ date, value: S.toDisplay(day.weighted) });
    }
    return { color: LIFTS[k].color, label: LIFTS[k].label, lift: k, points };
  }).filter((s) => s.points.length > 1);

  if (series.length) {
    // o kolik by nejlepší série nadhodnotila proti váženému odhadu
    const biased = [...dayStats.values()].filter((d) => d.n > 1);
    const avgBias = biased.length
      ? biased.reduce((s, d) => s + d.bias, 0) / biased.length
      : 0;

    root.append(card('Odhad maxima ze skutečných sérií', {
      eyebrow: `Vážený odhad z každého dne · ${U()}`,
    },
      lineChart(series, { height: 210, fmt: (v) => num(v, 0), unit: U() }),
      h('div.split-legend',
        ...series.map((s) => h('div.split-item',
          h('i', { style: { background: s.color } }),
          h('span.split-name', LIFTS[s.lift].label)))),
      h('p.note', 'Tohle je jediný graf v appce, který ukazuje skutečný výkon, ne plán. Roste-li, trénink funguje. Stojí-li při rostoucím objemu, něco nesedí — obvykle regenerace.'),

      biased.length > 0 && flagRow({
        tone: 'low',
        text: `Z každého dne se bere vážený odhad ze všech zapsaných sérií, ne ta nejlepší. `
          + `Nejlepší série by ${biased.length === 1 ? 'ten den' : `na těch ${biased.length} dnech, kde je sérií víc,`} `
          + `nadhodnotila v průměru o ${Wu(avgBias, 1)} — `
          + 'maximum z několika zašuměných odhadů roste s počtem sérií, i když se síla nemění.',
      }),

      h('p.note', { style: { color: 'var(--ink-3)' } },
        'Váhy jsou obrácené k rozptylu odhadu: trojka na RPE 9 nese mnohem víc informace než '
        + 'desítka na RPE 6, u které se RPE odhaduje nejhůř (směrodatná odchylka 1,18 proti 0,32 '
        + 'u těžkých sérií). Rozptyl podle intenzity měřil Zourdos a kol. (2016); samotné vážení '
        + 'obráceně k rozptylu je standardní postup, ne konstrukce této appky.')));
  }

  /* ---- relativní intenzita ---- */
  root.append(relativeCard(done, S.blockE1rm(blk, a), S.athleteVariants(a)));

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

/* =========================================================
   Relativní intenzita
   ========================================================= */

/**
 * Kolik procent to bylo z toho, co závodník zvládal *ten den*.
 *
 * Absolutní intenzita je jediné číslo, které appka dosud uměla: 170 kg je
 * pořád 85 % z dvousetkilového maxima, ať je člověk čerstvý nebo rozbitý.
 * Proti dennímu maximu to ale ve špatný den může být 92 % — a přesně proto
 * ta série jela na RPE 9 místo osmičky.
 *
 * Rozdíl mezi těmi dvěma čísly je jméno pro to, čemu se v hovoru říká
 * „špatný den". Tabulka ho ukazuje po dnech, protože jedna špatná středa
 * nic neznamená a čtyři po sobě znamenají dost.
 */
function relativeCard(done, e1rms, variants) {
  const gaps = C.intensityGap(done, e1rms, variants);

  if (gaps.length < 2) {
    return card('Relativní intenzita', { eyebrow: 'Procenta z denního maxima, ne z maxima na papíře' },
      h('p.note',
        'Zapiš skutečné RPE aspoň u dvou tréninkových dnů. Z nich se dá spočítat, co závodník ten den '
        + 'zvládal — a tedy jestli naplánovaných 85 % bylo pro něj toho dne opravdu 85 %.'));
  }

  const shown = gaps.slice(-10);
  const bad = gaps.filter((g) => g.gap >= 5).length;
  const streak = (() => {
    let n = 0;
    for (const g of [...gaps].reverse()) { if (g.gap >= 2) n++; else break; }
    return n;
  })();

  return card('Relativní intenzita', {
    eyebrow: 'Procenta z denního maxima, ne z maxima na papíře',
    class: 'is-flush',
  },
    h('div', { style: { padding: '0 24px 24px' } },
      table(
        ['Den', { label: `Denní max. (${U()})`, num: true }, { label: 'Absolutní', num: true },
          { label: 'Relativní', num: true }, { label: 'Rozdíl', num: true }, 'Stav'],
        shown.map((g) => {
          const gr = C.gradeIntensityGap(g.gap);
          return {
            tone: gr.tone === 'bad' ? 'bad' : gr.tone === 'warn' ? 'warn' : null,
            cells: [
              h('b', weekday(g.date)),
              {
                num: true,
                value: g.dayMax == null
                  ? h('span.faint', { title: `${g.lifts} cviky — jedno maximum dne neexistuje` }, `${g.lifts} cviky`)
                  : W(g.dayMax, 1),
              },
              { num: true, value: h('span.mono', `${fixed(g.absolute, 1)} %`) },
              { num: true, value: h('b.mono', `${fixed(g.relative, 1)} %`) },
              {
                num: true,
                value: h('b', {
                  style: { color: g.gap >= 5 ? 'var(--bad)' : g.gap >= 2 ? 'var(--warn)' : g.gap <= -2 ? 'var(--info)' : 'var(--ink)' },
                }, `${g.gap >= 0 ? '+' : '−'}${fixed(Math.abs(g.gap), 1)}`),
              },
              tag(gr.label, gr.tone),
            ],
          };
        })),

      streak >= 3 && flagRow({
        tone: 'bad',
        text: `${streak} dny po sobě byla stejná práce relativně těžší, než plán čekal. `
          + 'Jeden takový den je šum; tohle už je posun formy — buď se hromadí únava, nebo maximum '
          + 'v profilu přestalo platit. Zkontroluj obojí dřív, než se přidá objem.',
      }),

      streak < 3 && bad > 0 && flagRow({
        tone: 'warn',
        text: `${bad} ${bad === 1 ? 'den vyšel' : bad < 5 ? 'dny vyšly' : 'dnů vyšlo'} jako výrazně těžší, `
          + 'než plán počítal, ale nejdou po sobě. Ojedinělý špatný den má obvykle příčinu mimo trénink — '
          + 'spánek, jídlo, stres — a sám o sobě nic v plánu měnit nemusí.',
      }),

      streak === 0 && bad === 0 && flagRow({
        tone: 'ok',
        text: 'Denní maxima sedí na to, s čím plán počítá. Naplánovaná procenta odpovídají tomu, '
          + 'co ta práce pro závodníka doopravdy znamená.',
      }),

      h('p.note',
        h('b', 'Absolutní'), ' je procento z maxima v profilu — to, co je v plánu. ',
        h('b', 'Relativní'), ' je procento z maxima, které závodník ten den skutečně měl, spočítaného '
        + 'z jeho vlastních sérií. Když se ta dvě čísla rozejdou nahoru, znamená to, že plán ten den '
        + 'sedl na horší formu, než se kterou počítal.'),

      h('p.note', { style: { color: 'var(--ink-3)' } },
        'Práce s denním maximem je jádro metody RTS (Tuchscherer). Hranice ±2 a ±5 procentních bodů, '
        + 'na kterých se tady den označí za dobrý nebo špatný, ale publikované nejsou — jsou to prahy '
        + 'této appky, zvolené tak, aby seděly na běžný rozptyl formy ze dne na den. Ber je jako '
        + 'orientaci, ne jako změřenou mez.')));
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
    eyebrow: 'Vlevo plán, vpravo skutečnost. Prázdné pole znamená „šlo to podle plánu".',
    class: 'is-flush',
  }, body);
}

function dayTable(dayRows, render) {
  return h('div.table-wrap',
    h('table.table.plan-table',
      h('thead',
        h('tr',
          h('th', { rowspan: 2 }, 'Cvik'),
          h('th.num', { rowspan: 2 }, 'Série'),
          h('th.num.col-plan', { colspan: 2 }, 'Plán'),
          h('th.num.col-real', { colspan: 3 }, 'Skutečnost'),
          h('th.num', { rowspan: 2 }, 'Odchylka'),
          h('th.num', { rowspan: 2 }, `Odhad 1RM (${U()})`),
          h('th', { rowspan: 2 }, '')),
        h('tr',
          h('th.num.col-plan', `Váha (${U()})`),
          h('th.num.col-plan', 'RPE'),
          h('th.num.col-real', `Váha (${U()})`),
          h('th.num.col-real', 'Opak.'),
          h('th.num.col-real', 'RPE'))),
      h('tbody', ...dayRows.map((e) => realRow(e, render)))));
}

/**
 * Jeden řádek: plán vlevo jako pevné číslo, skutečnost vpravo k vyplnění.
 *
 * Plánovaná váha se tady záměrně nedá přepsat. Dřív se přepisovala a tím
 * zmizelo to jediné, proti čemu se dá skutečnost porovnat — po zápisu už
 * nikdo nezjistil, že se místo naplánovaných 170 zvedlo 160. Plán se mění
 * ve Stavbě bloku, tady se zapisuje, co se doopravdy stalo.
 */
function realRow(e, render) {
  const deltaCell = h('td.num');
  const e1Cell = h('td.num');
  const wDeltaHint = h('span.faint.mono', { style: { fontSize: '10.5px' } });

  const commit = (patch) => {
    Object.assign(e, patch);
    S.commit((s) => {
      const t = s.entries.find((x) => x.id === e.id);
      if (t) Object.assign(t, patch);
    });
    refresh();
  };

  const rpeInput = decimalInput({
    value: e.actualRpe == null ? '' : rpeLabel(e.actualRpe),
    class: 'inline-input',
    placeholder: '—',
    'aria-label': 'Skutečné RPE',
  });

  rpeInput.addEventListener('input', () => {
    const raw = rpeInput.value.trim();
    if (raw === '') { commit({ actualRpe: null }); return; }
    const v = Number(raw.replace(',', '.'));
    if (!Number.isFinite(v) || v <= 0) return;
    commit({ actualRpe: Math.min(10, Math.max(5, Math.round(v * 2) / 2)) });
  });

  const weightInput = h('input.input.inline-input', {
    type: 'text', inputmode: 'decimal', autocomplete: 'off',
    value: e.actualWeight == null ? '' : W(e.actualWeight, 1),
    placeholder: W(e.weight, 1),
    'aria-label': `Skutečná váha (${U()})`,
  });

  weightInput.addEventListener('input', () => {
    const raw = weightInput.value.trim();
    if (raw === '') { commit({ actualWeight: null }); return; }
    const v = S.fromDisplay(Number(raw.replace(/\s/g, '').replace(',', '.')));
    if (!(v > 0)) return;
    commit({ actualWeight: v });
  });

  const repsInput = numInput({
    value: e.actualReps == null ? '' : String(e.actualReps),
    step: 1, min: 1, class: 'inline-input', placeholder: String(e.reps),
    style: { width: '48px' }, 'aria-label': 'Skutečná opakování',
    oninput: (ev) => {
      const raw = ev.target.value.trim();
      if (raw === '') { commit({ actualReps: null }); return; }
      const v = Math.round(Number(raw));
      if (!(v > 0)) return;
      commit({ actualReps: v });
    },
  });

  function refresh() {
    clear(deltaCell);
    clear(e1Cell);
    clear(wDeltaHint);

    // odchylka váhy se ukáže jen tehdy, když se od plánu liší
    const wd = C.round(C.liftedWeight(e) - e.weight, 2);
    if (e.actualWeight != null && Math.abs(wd) > 0.001) {
      wDeltaHint.append(`${wd > 0 ? '+' : '−'}${W(Math.abs(wd), 1)}`);
      wDeltaHint.style.color = wd > 0 ? 'var(--ok)' : 'var(--warn)';
    }

    if (e.actualRpe == null) {
      deltaCell.append(h('span.faint', '—'));
      e1Cell.append(h('span.faint', '—'));
      return;
    }

    const d = C.round(e.actualRpe - e.rpe, 1);
    deltaCell.append(h('b', {
      style: { color: d > 0 ? 'var(--warn)' : d < 0 ? 'var(--info)' : 'var(--ok)' },
    }, d === 0 ? 'přesně' : `${d > 0 ? '+' : '−'}${fixed(Math.abs(d), 1)}`));

    const v = C.setE1rm(e);
    e1Cell.append(v == null ? h('span.faint', 'mimo tabulku') : h('b', W(v, 1)));
  }

  refresh();

  const changed = e.actualWeight != null || e.actualReps != null || e.actualRpe != null;

  return h('tr', { class: changed ? 'is-logged' : null },
    h('td', h('span', liftDot(e.lift), liftName(e))),
    h('td.num', h('span.mono.faint', `${e.sets}×${e.reps}`)),
    h('td.num.col-plan', h('span.mono', W(e.weight, 1))),
    h('td.num.col-plan', h('span.mono', e.rpe == null ? '—' : rpeLabel(e.rpe))),
    h('td.num.col-real', weightInput, wDeltaHint),
    h('td.num.col-real', repsInput),
    h('td.num.col-real', rpeInput),
    deltaCell,
    e1Cell,
    h('td', h('div.row-actions',
      h('button.btn.btn-ghost.btn-sm', {
        title: 'Šlo přesně podle plánu — doplní váhu, opakování i RPE',
        onclick: () => {
          commit({ actualWeight: e.weight, actualReps: e.reps, actualRpe: e.rpe });
          weightInput.value = W(e.weight, 1);
          repsInput.value = String(e.reps);
          rpeInput.value = e.rpe == null ? '' : rpeLabel(e.rpe);
        },
      }, icon('check', 14)))));
}
