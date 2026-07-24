import { h, card, stat, icon, num, fixed, tag, table, field, numInput, clear, toast, shortDate } from '../ui.js';
import { lineChart } from '../charts.js';
import * as S from '../store.js';
import * as C from '../calc.js';
import { LIFTS, COMP_LIFTS, BLOCK_TEMPLATES, BLOCK_PHASES } from '../data.js';
import { W, U, empty } from './_util.js';

const st = { showMeetForm: false, meetDraft: null };

export function macroView(nav) {
  const root = h('div.view');
  const render = () => { clear(root); build(root, render, nav); };
  render();
  return root;
}

/* =========================================================
   Souhrn za jeden blok — znovu použije analyzeBlock/taperCheck/gradeWeek,
   nic nepočítá nanovo.
   ========================================================= */
function summarizeBlock(b, a) {
  const entries = S.blockEntries(b.id);
  const e1rm = S.blockE1rm(b, a);
  const an = C.analyzeBlock(entries, e1rm, b.start);
  const weeks = an.weeks;
  const avgTonnage = weeks.length ? weeks.reduce((s, w) => s + w.tonnage, 0) / weeks.length : 0;
  const peak = Math.max(0, ...weeks.map((w) => w.peakIntensity ?? 0));
  const deloadWeeks = weeks.filter((w) => C.gradeWeek(w).label === 'Deload').length;
  const taper = weeks.length >= 2 ? C.taperCheck(weeks) : null;

  // která konkrétní série špičku způsobila — appka to jinak jen vypočítá,
  // nikde neukáže z čeho, a číslo pak vypadá jako z čistého vzduchu
  let peakSource = null;
  for (const e of entries) {
    const e1 = e1rm[e.lift] ?? 0;
    if (!(e1 > 0)) continue;
    const pct = C.intensity(e, e1);
    if (!peakSource || pct > peakSource.pct) peakSource = { pct, lift: e.lift, date: e.date, weight: e.weight };
  }

  return { block: b, an, avgTonnage, peak, deloadWeeks, taper, peakSource };
}

/** Všechny týdny všech bloků na skutečné kalendářní datum, chronologicky. */
function weeksChronological(blockStats) {
  const out = [];
  for (const bs of blockStats) {
    for (const w of bs.an.weeks) {
      const date = S.iso(S.addDays(bs.block.start, (w.week - 1) * 7));
      out.push({ date, grade: C.gradeWeek(w) });
    }
  }
  return out.sort((a, b) => a.date.localeCompare(b.date));
}

function build(root, render, nav) {
  const a = S.athlete();
  if (!a) {
    root.append(empty('Nejdřív si založ svěřence.', h('button.btn.btn-primary', { onclick: () => nav('athletes') }, 'Přidat svěřence')));
    return;
  }

  const blocks = S.athleteBlocks(a.id);
  if (!blocks.length) {
    root.append(empty('Makrocyklus se skládá z víc bloků v čase — tenhle svěřenec zatím žádný nemá.',
      h('button.btn.btn-primary', { onclick: () => nav('program') }, 'Postavit první blok')));
    return;
  }

  const blockStats = blocks.map((b) => summarizeBlock(b, a));

  root.append(timelineCard(blockStats));
  if (blockStats.length >= 2) root.append(trendCards(blockStats));
  root.append(deloadCard(blockStats));
  root.append(meetCard(a, render));
}

/* =========================================================
   Bloky v čase
   ========================================================= */
function timelineCard(blockStats) {
  return card('Bloky v čase', {
    eyebrow: `${blockStats.length} ${blockStats.length === 1 ? 'mezocyklus' : blockStats.length < 5 ? 'mezocykly' : 'mezocyklů'} makrocyklu — chronologicky`,
    class: 'is-flush',
  },
    h('div', { style: { padding: '0 24px 24px' } },
      table(
        ['Blok', 'Fáze', { label: 'Týdnů', num: true }, { label: `Ø tonáž (${U()})`, num: true },
          { label: 'Špička', num: true }, { label: 'Deload týdnů', num: true }, 'Taper'],
        blockStats.map(blockRow)),
      h('p.note', { style: { marginTop: '12px' } },
        'Fáze vychází ze šablony, kterou byl blok postavený (Issurin — akumulace → transmutace → realizace). Objem a špička jsou průměr přes celý blok — podrobný rozpad po týdnech je v Analýze bloku.')));
}

function blockRow(bs) {
  const t = bs.taper;
  const phase = BLOCK_TEMPLATES[bs.block.template]?.phase;
  const ph = BLOCK_PHASES[phase];
  return {
    cells: [
      h('div', h('b', bs.block.name), h('div.faint.mono', { style: { fontSize: '11px' } }, `${shortDate(bs.block.start)} · ${bs.block.weeks} týdnů`)),
      ph ? h('span.zone-pill', { style: { '--c': ph.color } }, ph.label) : h('span.faint', '—'),
      { num: true, value: bs.an.weeks.length },
      { num: true, value: W(bs.avgTonnage, 0) },
      {
        num: true,
        value: h('b', {
          style: { color: bs.peak >= 90 ? 'var(--red-lit)' : bs.peak >= 85 ? 'var(--yellow)' : 'var(--chalk)' },
          title: bs.peakSource
            ? `${LIFTS[bs.peakSource.lift]?.label ?? bs.peakSource.lift}, ${shortDate(bs.peakSource.date)}: ${W(bs.peakSource.weight, 1)} ${U()} (${fixed(bs.peakSource.pct, 1)} % z tehdejšího maxima)`
            : undefined,
        }, `${fixed(bs.peak, 0)} %`),
      },
      { num: true, value: bs.deloadWeeks || h('span.faint', '0') },
      t ? tag(t.label, t.tone) : h('span.faint', '—'),
    ],
  };
}

/* =========================================================
   Trend mezi bloky — objem a intenzita
   ========================================================= */
function trendCards(blockStats) {
  const tonnageSeries = [{ color: 'var(--red)', points: blockStats.map((bs) => ({ date: bs.block.start, value: S.toDisplay(bs.avgTonnage) })) }];
  const peakSeries = [{ color: 'var(--blue)', points: blockStats.map((bs) => ({ date: bs.block.start, value: bs.peak })) }];

  return h('div.grid.g-side',
    card('Objem mezi bloky', { eyebrow: `Průměrná týdenní tonáž na blok · ${U()}` },
      lineChart(tonnageSeries, { height: 190, fmt: (v) => num(v, 0) })),
    card('Intenzita mezi bloky', { eyebrow: 'Nejtěžší série bloku, v % z 1RM' },
      lineChart(peakSeries, { height: 190, fmt: (v) => `${num(v, 0)} %` })));
}

/* =========================================================
   Odlehčení v čase
   ========================================================= */
function deloadCard(blockStats) {
  const weeks = weeksChronological(blockStats);
  const deloads = weeks.filter((w) => w.grade.label === 'Deload');
  const gaps = [];
  for (let i = 1; i < deloads.length; i++) {
    gaps.push(C.daysBetween(deloads[i - 1].date, deloads[i].date) / 7);
  }
  const avgGap = gaps.length ? gaps.reduce((s, g) => s + g, 0) / gaps.length : null;

  return card('Odlehčení v čase', {
    eyebrow: `${deloads.length} odlehčovacích ${deloads.length === 1 ? 'týden' : deloads.length < 5 ? 'týdny' : 'týdnů'} za ${weeks.length} sledovaných`,
  },
    h('div.grid.g2',
      stat('Odlehčovacích týdnů', deloads.length, `z ${weeks.length} celkem`),
      stat('Průměrná mezera mezi nimi', avgGap != null ? fixed(avgGap, 1) : '—', 'týdnů')),
    deloads.length
      ? h('div', { style: { display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '14px' } },
          ...deloads.map((d) => tag(shortDate(d.date), 'low')))
      : null,
    h('p.note', { style: { marginTop: '14px' } },
      'Odlehčení je záměrné, periodické snížení objemu a intenzity, aby únava stihla odeznít dřív než forma (Helms a kol. 2022, průzkum mezi kouči síly a kondice). Appka tu jen ukazuje, jak často a jak pravidelně se to reálně děje — publikované „správné" rozmezí mezer mezi odlehčeními neexistuje, posuď to podle toho, jak závodník na blok reaguje.'));
}

/* =========================================================
   Zápasy
   ========================================================= */
function meetCard(a, render) {
  const meets = S.athleteMeets(a.id);

  const rows = meets.map((m) => {
    const total = C.meetTotal(m.attempts);
    const sr = C.meetSuccessRate(m.attempts);
    return {
      cells: [
        h('div', h('b', m.name), h('div.faint.mono', { style: { fontSize: '11px' } }, shortDate(m.date))),
        { num: true, value: W(m.bw, 1) },
        { num: true, value: h('b', total ? W(total) : '—') },
        { num: true, value: total ? num(C.dots(total, m.bw, a.sex), 1) : '—' },
        { num: true, value: total ? num(C.ipfGL(total, m.bw, a.sex, a.equipment), 1) : '—' },
        { num: true, value: sr ? `${sr.made} / ${sr.total}` : '—' },
        h('div.row-actions', h('button.btn.btn-ghost.btn-icon', {
          'aria-label': 'Smazat zápas',
          onclick: () => { if (confirm(`Smazat zápas „${m.name}"?`)) { S.deleteMeet(m.id); render(); } },
        }, icon('trash', 15))),
      ],
    };
  });

  return card('Zápasy', {
    eyebrow: meets.length ? `${meets.length} zaznamenaných — přirozené uzly makrocyklu` : 'Zatím žádné zaznamenané',
    class: 'is-flush',
    action: h('button.btn.btn-sm', {
      onclick: () => {
        if (!st.showMeetForm) st.meetDraft = freshMeetDraft(a);
        st.showMeetForm = !st.showMeetForm;
        render();
      },
    }, icon(st.showMeetForm ? 'x' : 'plus', 14), st.showMeetForm ? 'Zrušit' : 'Přidat zápas'),
  },
    h('div', { style: { padding: '0 24px 24px' } },
      meets.length
        ? table(['Zápas', { label: `BW (${U()})`, num: true }, { label: `Součet (${U()})`, num: true },
            { label: 'DOTS', num: true }, { label: 'IPF GL', num: true }, { label: 'Pokusy', num: true }, ''], rows)
        : h('p.note', 'Rozbor MS IPF: vítězové dávají v průměru 8,46 z 9 pokusů, průměrný závodník 6,66 z 9. Appka tuhle úspěšnost počítá napříč zápasy, jakmile je zapíšeš.'),
      meets.length >= 2 && meetTrend(meets, a)),
    st.showMeetForm && meetForm(a, render));
}

function meetTrend(meets, a) {
  const totalSeries = [{ color: 'var(--red)', points: meets.map((m) => ({ date: m.date, value: S.toDisplay(C.meetTotal(m.attempts)) })) }];
  const srSeries = [{
    color: 'var(--blue)',
    points: meets.map((m) => { const sr = C.meetSuccessRate(m.attempts); return { date: m.date, value: sr ? sr.pct : 0 }; }),
  }];
  return h('div.grid.g-side', { style: { marginTop: '16px' } },
    h('div', h('div.eyebrow', { style: { marginBottom: '8px' } }, `Součet v čase · ${U()}`), lineChart(totalSeries, { height: 160, fmt: (v) => num(v, 0) })),
    h('div', h('div.eyebrow', { style: { marginBottom: '8px' } }, 'Úspěšnost pokusů v čase'), lineChart(srSeries, { height: 160, fmt: (v) => `${num(v, 0)} %`, yZero: true })));
}

function freshMeetDraft(a) {
  return {
    name: '', date: S.iso(new Date()), bw: a.bw,
    attempts: COMP_LIFTS.flatMap((lift) => [1, 2, 3].map((n) => ({ lift, num: n, weight: 0, made: null }))),
  };
}

function meetForm(a, render) {
  const d = st.meetDraft;

  const save = () => {
    const attempts = d.attempts.filter((x) => x.weight > 0 && x.made != null).map(({ lift, weight, made }) => ({ lift, weight, made }));
    if (!attempts.length) { toast('Zadej aspoň jeden pokus s výsledkem', 'bad'); return; }
    S.addMeet({ athleteId: a.id, name: d.name.trim() || 'Zápas', date: d.date, bw: d.bw, attempts });
    st.showMeetForm = false;
    st.meetDraft = null;
    toast('Zápas uložen');
    render();
  };

  return h('div', { style: { padding: '0 24px 24px', borderTop: '1px solid var(--line)' } },
    h('div.form-row', { style: { marginTop: '18px' } },
      field('Název', h('input.input', {
        value: d.name, placeholder: 'Mistrovství ČR', style: { fontFamily: 'var(--font-body)' },
        oninput: (e) => { d.name = e.target.value; },
      })),
      field('Datum', h('input.input', { type: 'date', value: d.date, onchange: (e) => { d.date = e.target.value; } })),
      field(`Tělesná váha (${U()})`, numInput({
        value: S.toDisplay(d.bw), step: 0.1,
        oninput: (e) => { d.bw = S.fromDisplay(Number(e.target.value)); },
      }))),
    table(['Pokus', ...COMP_LIFTS.map((k) => LIFTS[k].label)],
      [1, 2, 3].map((n) => [
        h('b', `${n}. pokus`),
        ...COMP_LIFTS.map((lift) => attemptCell(d.attempts.find((x) => x.lift === lift && x.num === n), render)),
      ])),
    h('div.btn-row', { style: { marginTop: '16px' } },
      h('button.btn.btn-primary', { onclick: save }, icon('check', 16), 'Uložit zápas')));
}

function attemptCell(row, render) {
  const input = numInput({
    value: row.weight || '', step: 2.5, min: 0, style: { width: '86px' }, placeholder: '—',
    oninput: (e) => { row.weight = Number(e.target.value) || 0; },
  });
  const madeBtn = h('button.attempt-toggle', {
    type: 'button', 'data-made': String(row.made),
    title: 'Povedl se pokus?',
    onclick: () => { row.made = row.made === true ? false : row.made === false ? null : true; render(); },
  }, row.made == null ? '?' : row.made ? '✓' : '✗');

  return h('div', { style: { display: 'flex', alignItems: 'center', gap: '6px' } }, input, madeBtn);
}
