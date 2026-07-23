import { h, card, icon, num, fixed, tag, table, field, numInput, decimalInput, select, clear, toast, weekday, longDate } from '../ui.js';
import * as S from '../store.js';
import * as C from '../calc.js';
import { BLOCK_TEMPLATES, LIFTS, COMP_LIFTS, RPE_STEPS } from '../data.js';
import { W, U, Wu, liftDot, empty, rpeLabel } from './_util.js';

const DAYS = ['po', 'út', 'st', 'čt', 'pá', 'so', 'ne'];

const freshStart = () => S.iso(S.mondayOf(S.addDays(new Date(), 7)));

// Přepisuje se hned prvním voláním build() → loadDraftFor(), jakmile je
// známý svěřenec — hodnoty tady jsou jen výchozí tvar objektu.
const st = {
  athleteId: null, // čí rozpracovaný plán je zrovna v `st` — řídí obnovu při přepnutí
  name: '',
  template: 'strength',
  start: freshStart(),
  rows: null,
  openWeek: 1,
};

/** Zapíše aktuální rozpracovaný plán do úložiště — přežije zavření prohlížeče. */
function persistDraft(a) {
  S.saveDraft(a.id, {
    name: st.name, template: st.template, start: st.start,
    openWeek: st.openWeek, rows: st.rows,
  });
}

/** Při přepnutí na jiného svěřence načte jeho rozpracovaný plán, nebo založí prázdný. */
function loadDraftFor(a) {
  const saved = S.loadDraft(a.id);
  st.athleteId = a.id;
  st.name = saved?.name ?? '';
  st.template = saved?.template ?? 'strength';
  st.start = saved?.start ?? freshStart();
  st.openWeek = saved?.openWeek ?? 1;
  st.rows = saved?.rows ?? null;
  if (saved) toast(`Načten rozpracovaný plán pro ${a.name.split(' ')[0]}`);
}

export function programView(nav) {
  const root = h('div.view');
  const render = () => { clear(root); build(root, render, nav); };
  render();
  return root;
}

/* =========================================================
   Model řádku
   ========================================================= */

/** Váha z procent a maxima. U doplňků maximum neznáme, tam se zadává ručně. */
const weightFromPct = (lift, pct, a) =>
  lift === 'accessory' ? 40 : C.roundToBar(((a.e1rm[lift] ?? 0) * pct) / 100, { unit: 'kg' });

function newRow(week, day, lift, a, o = {}) {
  const reps = o.reps ?? 5;
  const rpe = o.rpe ?? 8;
  const pct = o.pct ?? C.rpeToPct(reps, rpe) ?? 80;
  return {
    id: S.uid(),
    week,
    day,
    lift,
    name: o.name ?? null,
    sets: o.sets ?? 3,
    reps,
    rpe,
    pct,
    by: 'rpe',
    weight: o.weight ?? weightFromPct(lift, pct, a),
  };
}

/** Předvyplní matici ze šablony. Dál se to edituje po řádcích. */
function fromTemplate(key, a) {
  const tpl = BLOCK_TEMPLATES[key];
  const layout = [
    { day: 0, main: 'squat', second: 'bench', acc: ['Předkopávání', 'Veslování'] },
    { day: 2, main: 'bench', second: 'deadlift', acc: ['Tlak s jednoručkami'] },
    { day: 4, main: 'deadlift', second: 'squat', acc: ['Zákopávání', 'Hyperextenze'] },
  ];

  const out = [];
  tpl.waves.forEach((w, i) => {
    const week = i + 1;
    for (const d of layout) {
      out.push(newRow(week, d.day, d.main, a, { sets: w.sets, reps: w.reps, rpe: w.rpe }));
      out.push(newRow(week, d.day, d.second, a, { sets: 3, reps: w.reps + 2, rpe: Math.max(6, w.rpe - 1) }));
      for (const name of d.acc) out.push(newRow(week, d.day, 'accessory', a, { name, sets: 3, reps: 12, rpe: 8, weight: 40 }));
    }
  });
  return out;
}

const rows = (a) => (st.rows ??= fromTemplate(st.template, a));
const weekCount = (all) => Math.max(1, ...all.map((r) => r.week));

/* =========================================================
   Obrazovka
   ========================================================= */

function build(root, render, nav) {
  const a = S.athlete();
  if (!a) {
    root.append(empty('Nejdřív svěřenec, potom blok.',
      h('button.btn.btn-primary', { onclick: () => nav('athletes') }, 'Přidat svěřence')));
    return;
  }

  if (st.athleteId !== a.id) loadDraftFor(a);

  const all = rows(a);
  const weeks = weekCount(all);
  if (st.openWeek > weeks) st.openWeek = weeks;
  persistDraft(a); // pokrývá i případ, kdy `rows(a)` teď poprvé vygenerovala šablonu

  /* ---- základ ---- */
  root.append(card('Zadání bloku', { eyebrow: 'Základ' },
    h('div.form-row',
      field('Název', h('input.input', {
        value: st.name,
        placeholder: BLOCK_TEMPLATES[st.template].label,
        style: { fontFamily: 'var(--font-body)' },
        oninput: (e) => { st.name = e.target.value; persistDraft(a); },
      })),
      field('Začátek (pondělí)', h('input.input', {
        type: 'date', value: st.start,
        onchange: (e) => { st.start = S.iso(S.mondayOf(e.target.value)); persistDraft(a); render(); },
      })),
      field('Předvyplnit ze šablony', select(
        Object.entries(BLOCK_TEMPLATES).map(([k, v]) => ({ value: k, label: v.label })),
        {
          value: st.template,
          onchange: (e) => {
            if (!confirm('Načíst šablonu? Ruční úpravy se přepíšou.')) { e.target.value = st.template; return; }
            st.template = e.target.value;
            st.rows = fromTemplate(st.template, a);
            st.openWeek = 1;
            persistDraft(a);
            render();
          },
        }))),
    h('p.note', BLOCK_TEMPLATES[st.template].note, ' Šablona je jen startovní bod — každý řádek se dá přepsat.')));

  /* ---- výběr týdne ---- */
  root.append(h('div.week-bar',
    h('div.week-tabs',
      ...Array.from({ length: weeks }, (_, i) => i + 1).map((w) =>
        h('button.week-tab', {
          type: 'button',
          'aria-pressed': String(w === st.openWeek),
          onclick: () => { st.openWeek = w; render(); },
        },
          h('span.week-tab-n', `Týden ${w}`),
          h('span.week-tab-sum', weekSummary(all.filter((r) => r.week === w), a))))),
    h('div.btn-row',
      h('button.btn.btn-sm', {
        onclick: () => {
          const src = all.filter((r) => r.week === weeks);
          st.rows = [...all, ...src.map((r) => ({ ...r, id: S.uid(), week: weeks + 1 }))];
          st.openWeek = weeks + 1;
          persistDraft(a);
          render();
        },
      }, icon('plus', 14), 'Přidat týden'),
      h('button.btn.btn-sm', {
        title: `Vloží kopii týdne ${st.openWeek} hned za něj`,
        onclick: () => { duplicateWeek(all, st.openWeek); persistDraft(a); render(); },
      }, icon('copy', 14), `Duplikovat týden ${st.openWeek}`),
      weeks > 1 && h('button.btn.btn-sm', {
        onclick: () => {
          st.rows = all.filter((r) => r.week !== weeks);
          st.openWeek = Math.min(st.openWeek, weeks - 1);
          persistDraft(a);
          render();
        },
      }, 'Ubrat poslední'))));

  /* ---- editor týdne ---- */
  root.append(weekEditor(all, a, render));

  /* ---- náhled ---- */
  const preview = toEntries(all, a);
  const an = C.analyzeBlock(preview, a.e1rm, st.start);
  const g = C.gradeInol(an.total.inolPerLiftWeek, 'week');

  root.append(card('Náhled zátěže', { eyebrow: 'Celý blok, než ho založíš', class: 'is-flush' },
    h('div', { style: { padding: '0 24px 24px', display: 'flex', flexDirection: 'column', gap: '16px' } },
      h('div.grid.g4',
        h('div.stat', h('div.stat-label', 'Tonáž celkem'), h('div.stat-value', num(S.toDisplay(an.total.tonnage), 0), h('span.stat-unit', U()))),
        h('div.stat', h('div.stat-label', 'Zvedů v hlavních cvicích'), h('div.stat-value', an.total.nlMain), h('div.faint.mono', { style: { fontSize: '11px' } }, `z ${an.total.nl} celkem`)),
        h('div.stat', h('div.stat-label', 'Ø intenzita'), h('div.stat-value', fixed(an.total.avgIntensity, 1), h('span.stat-unit', '%'))),
        h('div.stat', { dataset: { tone: g.tone } },
          h('div.stat-label', 'INOL / cvik / týden'),
          h('div.stat-value', fixed(an.total.inolPerLiftWeek, 2)),
          h('div.faint.mono', { style: { fontSize: '11px' } }, g.note))),
      table(
        ['Týden', { label: `Tonáž (${U()})`, num: true }, { label: 'NL hlavní', num: true }, { label: 'Ø intenzita', num: true }, { label: 'INOL / cvik', num: true }, { label: 'Změna objemu', num: true }],
        an.weeks.map((wk, i) => {
          const prev = an.weeks[i - 1];
          const delta = prev?.tonnage ? ((wk.tonnage - prev.tonnage) / prev.tonnage) * 100 : null;
          return {
            tone: wk.week === st.openWeek ? 'ok' : null,
            cells: [
              h('b', `Týden ${wk.week}`),
              { num: true, value: num(S.toDisplay(wk.tonnage), 0) },
              { num: true, value: wk.nlMain },
              { num: true, value: `${fixed(wk.avgIntensity, 1)} %` },
              { num: true, value: fixed(wk.inolPerLift, 2) },
              { num: true, value: delta == null ? '—' : h('span', { style: { color: Math.abs(delta) > 30 ? 'var(--yellow)' : 'var(--chalk-dim)' } }, `${delta >= 0 ? '+' : '−'}${fixed(Math.abs(delta), 0)} %`) },
            ],
          };
        })))));

  /* ---- založit ---- */
  root.append(h('div.btn-row',
    h('button.btn.btn-primary', {
      onclick: () => {
        if (!all.length) { toast('Blok nemá jedinou položku', 'bad'); return; }
        const id = S.uid();
        const name = st.name.trim()
          || `${BLOCK_TEMPLATES[st.template].label} · ${new Intl.DateTimeFormat('cs-CZ', { month: 'long' }).format(C.parseDate(st.start))}`;
        S.commit((s) => {
          s.blocks.push({ id, athleteId: a.id, name, start: st.start, weeks, template: st.template });
          for (const e of toEntries(all, a)) s.entries.push({ ...e, id: S.uid(), blockId: id, athleteId: a.id });
          s.activeBlock = id;
        });
        // rozpracovaný plán je teď skutečný blok — smazat draft, ať příště naskočí prázdný
        S.clearDraft(a.id);
        st.athleteId = null;
        toast(`Blok „${name}" založen`);
        nav('block');
      },
    }, icon('check', 16), 'Založit blok'),
    h('span.faint', { style: { fontSize: '13px' } },
      `${weeks} týdnů · ${all.length} položek · začátek ${longDate(st.start)}`)));
}

/**
 * Vloží kopii týdne hned za původní. Následující týdny se posunou o jedna,
 * aby pořadí zůstalo souvislé.
 */
function duplicateWeek(all, week) {
  const copy = all.filter((r) => r.week === week).map((r) => ({ ...r, id: S.uid(), week: week + 1 }));
  st.rows = [
    ...all.map((r) => (r.week > week ? { ...r, week: r.week + 1 } : r)),
    ...copy,
  ].sort((x, y) => x.week - y.week || x.day - y.day);
  st.openWeek = week + 1;
  toast(`Týden ${week} zduplikován`);
}

/** Krátký souhrn do záložky týdne. */
function weekSummary(weekRows, a) {
  const main = weekRows.filter((r) => r.lift !== 'accessory');
  if (!main.length) return 'prázdný';
  const sets = main.reduce((s, r) => s + r.sets, 0);
  const avg = main.reduce((s, r) => s + r.pct * r.sets, 0) / (sets || 1);
  return `${sets} sérií · Ø ${fixed(avg, 0)} %`;
}

/* =========================================================
   Editor jednoho týdne
   ========================================================= */

function weekEditor(all, a, render) {
  const week = st.openWeek;
  const weekRows = all.filter((r) => r.week === week);
  const byDay = new Map();
  for (const r of weekRows) {
    if (!byDay.has(r.day)) byDay.set(r.day, []);
    byDay.get(r.day).push(r);
  }
  const days = [...byDay.keys()].sort((x, y) => x - y);

  const body = h('div', { style: { padding: '0 24px 24px', display: 'flex', flexDirection: 'column', gap: '20px' } });

  if (!weekRows.length) {
    body.append(h('div.empty',
      h('p.note', `Týden ${week} je prázdný.`),
      h('button.btn.btn-primary.btn-sm', {
        onclick: () => { st.rows = [...all, newRow(week, 0, 'squat', a)]; persistDraft(a); render(); },
      }, icon('plus', 14), 'Přidat cvik')));
  }

  for (const day of days) {
    const date = S.iso(S.addDays(st.start, (week - 1) * 7 + day));
    body.append(h('div.day-block',
      h('header.day-head',
        h('div',
          h('div.eyebrow', weekday(date)),
          h('span.day-count', `${byDay.get(day).length} položek`)),
        h('button.btn.btn-ghost.btn-sm', {
          onclick: () => { st.rows = [...all, newRow(week, day, 'accessory', a, { name: 'Nový cvik' })]; persistDraft(a); render(); },
        }, icon('plus', 14), 'Řádek')),
      rowTable(byDay.get(day), all, a, render)));
  }

  return card(`Týden ${week}`, {
    eyebrow: 'Série, opakování, RPE a intenzitu nastav zvlášť pro každý cvik',
    class: 'is-flush',
    action: h('div.btn-row',
      h('button.btn.btn-sm', {
        onclick: () => {
          const next = Math.max(0, ...weekRows.map((r) => r.day)) + 2;
          st.rows = [...all, newRow(week, Math.min(6, next), 'squat', a)];
          persistDraft(a);
          render();
        },
      }, icon('plus', 14), 'Přidat den'),
      week > 1 && h('button.btn.btn-sm', {
        onclick: () => {
          const src = all.filter((r) => r.week === week - 1);
          st.rows = [...all.filter((r) => r.week !== week), ...src.map((r) => ({ ...r, id: S.uid(), week }))];
          persistDraft(a);
          render();
        },
      }, 'Zkopírovat z týdne ' + (week - 1))),
  }, body);
}

/* =========================================================
   Tabulka řádků — jádro plánovače
   ========================================================= */

function rowTable(dayRows, all, a, render) {
  const head = ['Cvik', { label: 'Série', num: true }, { label: 'Opakování', num: true },
    { label: 'RPE', num: true }, { label: 'Intenzita', num: true },
    { label: `Váha (${U()})`, num: true }, { label: 'Zóna', num: true }, ''];

  return h('div.table-wrap',
    h('table.table.plan-table',
      h('thead', h('tr', ...head.map((x) =>
        h('th', { class: typeof x === 'object' && x.num ? 'num' : null }, typeof x === 'object' ? x.label : x)))),
      h('tbody', ...dayRows.map((r) => planRow(r, all, a, render)))));
}

function planRow(r, all, a, render) {
  const isAcc = r.lift === 'accessory';

  // RPE i intenzita berou čárku i tečku — proto textová pole, ne type="number"
  const rpeInput = decimalInput({ value: rpeLabel(r.rpe ?? ''), class: 'inline-input', 'aria-label': 'RPE' });

  // Doplňky nemají změřené 1RM, takže procento z maxima u nich nic neznamená —
  // váha se u nich zadává přímo. RPE dává smysl dál.
  const pctInput = isAcc
    ? h('span.faint', '—')
    : decimalInput({ value: fixed(r.pct, 1), class: 'inline-input', 'aria-label': 'Intenzita v procentech' });

  const weightInput = decimalInput({
    value: fixed(S.toDisplay(r.weight), 1), class: 'inline-input', 'aria-label': `Váha v ${U()}`,
  });
  const zoneCell = h('td.num');

  // RPE, intenzita a váha jsou tři pohledy na totéž. Co se zrovna píše, to vede,
  // zbylá dvě se dopočítají. Přepisují se jen odvozené buňky — kdyby se
  // překreslil celý pohled, ztratil by se fokus v poli uprostřed psaní.
  function refresh({ skip } = {}) {
    if (skip !== 'rpe') rpeInput.value = r.rpe == null ? '' : rpeLabel(r.rpe);
    if (skip !== 'pct' && !isAcc) pctInput.value = fixed(r.pct, 1);
    if (skip !== 'weight') weightInput.value = fixed(S.toDisplay(r.weight), 1);

    // Nad RPE 10 pro daný počet opakování už tabulka nesahá — předpis je těžší,
    // než co by závodník na tolik opakování vůbec zvedl.
    const offTable = !isAcc && r.rpe == null;
    rpeInput.placeholder = offTable ? 'mimo' : '';
    rpeInput.classList.toggle('is-warn', offTable);
    rpeInput.title = offTable
      ? `${fixed(r.pct, 1)} % je na ${r.reps} opakování nad hranicí RPE 10 — mimo tabulku.`
      : '';

    clear(zoneCell);
    if (isAcc) zoneCell.append(h('span.faint', '—'));
    else {
      const z = C.prilepinZone(r.pct);
      zoneCell.append(h('span.zone-pill', { style: { '--c': z.color } }, z.label));
    }
  }

  rpeInput.addEventListener('input', () => {
    const v = Number(rpeInput.value.replace(',', '.'));
    if (!Number.isFinite(v) || v <= 0) return;
    r.rpe = Math.min(10, Math.max(5, Math.round(v * 2) / 2));
    r.by = 'rpe';
    r.pct = C.rpeToPct(r.reps, r.rpe) ?? r.pct;
    if (!isAcc) r.weight = weightFromPct(r.lift, r.pct, a);
    refresh({ skip: 'rpe' });
    persistDraft(a);
  });

  if (!isAcc) {
    pctInput.addEventListener('input', () => {
      const v = Number(pctInput.value.replace(',', '.'));
      if (!Number.isFinite(v) || v <= 0) return;
      r.pct = v;
      r.by = 'pct';
      r.rpe = C.rpeFromPct(r.reps, r.pct);
      r.weight = weightFromPct(r.lift, r.pct, a);
      refresh({ skip: 'pct' });
      persistDraft(a);
    });
  }

  // Napsaná váha je nadřazená — dopočítá se z ní intenzita i RPE.
  weightInput.addEventListener('input', () => {
    const v = Number(weightInput.value.replace(',', '.'));
    if (!Number.isFinite(v) || v < 0) return;
    r.weight = S.fromDisplay(v);
    r.by = 'weight';
    const e1 = a.e1rm[r.lift] ?? 0;
    if (!isAcc && e1 > 0) {
      r.pct = (r.weight / e1) * 100;
      r.rpe = C.rpeFromPct(r.reps, r.pct);
    }
    refresh({ skip: 'weight' });
    persistDraft(a);
  });

  refresh();

  return h('tr',
    h('td',
      h('div.plan-lift',
        h('i.lift-dot', { style: { background: LIFTS[r.lift].color } }),
        select(Object.entries(LIFTS).map(([k, v]) => ({ value: k, label: v.label })), {
          value: r.lift, class: 'inline-input inline-select',
          onchange: (e) => {
            r.lift = e.target.value;
            if (r.lift !== 'accessory') r.name = null;
            persistDraft(a);
            render();
          },
        }),
        isAcc && h('input.inline-input.plan-name', {
          value: r.name ?? '', placeholder: 'název cviku',
          oninput: (e) => { r.name = e.target.value || null; persistDraft(a); },
        }))),

    h('td.num', numInput({
      value: r.sets, min: 1, max: 15, step: 1, class: 'inline-input',
      oninput: (e) => { r.sets = Math.max(1, Number(e.target.value) || 1); persistDraft(a); },
    })),

    h('td.num', numInput({
      value: r.reps, min: 1, max: 12, step: 1, class: 'inline-input',
      oninput: (e) => {
        r.reps = Math.min(12, Math.max(1, Number(e.target.value) || 1));
        // opakování mění vztah mezi RPE a procenty — dopočítá se to, co nevede
        if (r.by === 'rpe') {
          r.pct = C.rpeToPct(r.reps, r.rpe) ?? r.pct;
          if (!isAcc) r.weight = weightFromPct(r.lift, r.pct, a);
        } else {
          r.rpe = C.rpeFromPct(r.reps, r.pct);
        }
        refresh({ skip: 'reps' });
        persistDraft(a);
      },
    })),

    h('td.num', rpeInput),
    h('td.num', pctInput),
    h('td.num', weightInput),
    zoneCell,

    h('td', h('div.row-actions',
      h('button.btn.btn-ghost.btn-icon', {
        'aria-label': 'Smazat řádek',
        onclick: () => { st.rows = all.filter((x) => x.id !== r.id); persistDraft(a); render(); },
      }, icon('trash', 15)))));
}

/* =========================================================
   Převod na položky bloku
   ========================================================= */

function toEntries(all, a) {
  return all.map((r) => ({
    date: S.iso(S.addDays(st.start, (r.week - 1) * 7 + r.day)),
    lift: r.lift,
    name: r.lift === 'accessory' ? (r.name || 'Doplňkový cvik') : null,
    sets: r.sets,
    reps: r.reps,
    rpe: r.rpe,
    weight: r.weight,
    actualRpe: null,
  }));
}
