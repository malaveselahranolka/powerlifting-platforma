import { h, card, icon, num, bigNum, select, table, clear, weekday, shortDate } from '../ui.js';
import * as S from '../store.js';
import * as C from '../calc.js';
import { LIFTS, COMP_LIFTS } from '../data.js';
import { W, U, liftName, liftDot, empty } from './_util.js';

/**
 * Porovnání.
 *
 * Analýza bloku ukazuje blok jako celek, Grafy jako křivku. Tady se dvě
 * konkrétní věci postaví vedle sebe a odečte se rozdíl — dva týdny, dvě
 * jednotky, dva bloky.
 *
 * Trenérská otázka, na kterou to odpovídá, zní „bylo to těžší, než minule".
 * Z jedné křivky se to odhaduje; z dvou sloupců čísel vedle sebe se to
 * přečte. Rozdíl se proto ukazuje i jako pruh od středu, aby bylo poznat,
 * o kolik — ne jen kterým směrem.
 *
 * Nikde tu není hodnocení. Vyšší tonáž není lepší ani horší, jen vyšší;
 * co to znamená, ví trenér, který ví, v jaké fázi ten blok je.
 */

const st = {
  scope: 'weeks',
  a: null,
  b: null,
};

const SCOPES = [
  { value: 'weeks', label: 'Týdny' },
  { value: 'sessions', label: 'Jednotky' },
  { value: 'blocks', label: 'Bloky' },
];

/* ---------------------------------------------------------
   Profil — jedna sada čísel z libovolné hromádky položek
   --------------------------------------------------------- */

/**
 * Spočítá z položek všechno, co jde porovnávat.
 *
 * Intenzita se váží počtem opakování, ne sériemi: prostý průměr by dal
 * jedné trojce stejnou váhu jako desítce. Doplňky bez známého maxima do
 * intenzity nevstupují vůbec — počítat procenta z čísla, které neexistuje,
 * by celý průměr posunulo dolů bez důvodu.
 */
function profile(entries, e1rms, variants) {
  const p = {
    sessions: new Set(), items: entries.length,
    tonnage: 0, reps: 0, hard: 0, inol: 0, peak: 0,
    intSum: 0, intReps: 0,
    driftSum: 0, driftN: 0, loggedSets: 0,
    lifts: {},
  };

  for (const e of entries) {
    const e1 = C.entryE1rm(e, e1rms, variants);
    const reps = C.nl(e);
    const ton = C.tonnage(e);

    p.sessions.add(e.date);
    p.tonnage += ton;
    p.reps += reps;
    p.lifts[e.lift] = (p.lifts[e.lift] ?? 0) + ton;
    if (C.isHardSet(e, e1)) p.hard += e.sets;

    if (e1 > 0) {
      const int = C.intensity(e, e1);
      p.intSum += int * reps;
      p.intReps += reps;
      p.inol += C.inol(reps, int);
      p.peak = Math.max(p.peak, int);
    }

    if (e.actualRpe != null) {
      p.loggedSets += e.sets;
      if (e.rpe != null) { p.driftSum += e.actualRpe - e.rpe; p.driftN++; }
    }
  }

  return {
    ...p,
    sessions: p.sessions.size,
    avgIntensity: p.intReps ? p.intSum / p.intReps : null,
    peak: p.peak || null,
    drift: p.driftN ? p.driftSum / p.driftN : null,
  };
}

/* ---------------------------------------------------------
   Metriky
   --------------------------------------------------------- */

/**
 * `tone` má jen odchylka RPE — je to jediné číslo v tabulce, u kterého
 * appka jinde tvrdí, kterým směrem je horší. U tonáže nebo objemu by
 * zelená a červená lhaly: v akumulaci se přidává, v tapéru ubírá.
 */
const METRICS = () => [
  { key: 'sessions', label: 'Jednotek', d: 0, skip: ['sessions'] },
  { key: 'items', label: 'Položek', d: 0 },
  { key: 'tonnage', label: 'Tonáž', unit: U(), conv: true, big: true },
  { key: 'reps', label: 'Zvedy', d: 0, hint: 'série × opakování' },
  { key: 'hard', label: 'Tvrdé série', d: 0, hint: 'RPE ≥ 7' },
  { key: 'avgIntensity', label: 'ø intenzita', unit: '%', d: 1 },
  { key: 'peak', label: 'Špička', unit: '%', d: 1, hint: 'nejtěžší série' },
  { key: 'inol', label: 'INOL', d: 2, hint: 'objem vážený intenzitou' },
  { key: 'loggedSets', label: 'Zapsaných sérií', d: 0 },
  { key: 'drift', label: 'Odchylka RPE', d: 2, signed: true, tone: 'up-bad', hint: 'skutečnost minus plán' },
];

const liftMetrics = () => [...COMP_LIFTS, 'accessory'].map((k) => ({
  key: `lifts.${k}`, label: LIFTS[k].label, unit: U(), conv: true, big: true, dot: LIFTS[k].color,
}));

const read = (p, key) => (key.startsWith('lifts.') ? (p.lifts[key.slice(6)] ?? 0) : p[key]);

function show(m, v) {
  if (v == null || !Number.isFinite(v)) return '—';
  const x = m.conv ? S.toDisplay(v) : v;
  if (m.big) return bigNum(x);
  return m.signed && x > 0 ? `+${num(x, m.d)}` : num(x, m.d ?? 1);
}

/* ---------------------------------------------------------
   Tabulka rozdílů
   --------------------------------------------------------- */

function deltaTable(metrics, A, B, labels) {
  const rows = metrics.filter((m) => !(m.skip ?? []).includes(st.scope));

  // pruhy se škálují na největší relativní změnu v tabulce, ne každý sám
  // za sebe — jinak by pětiprocentní posun vypadal stejně jako dvojnásobek
  const rels = rows.map((m) => {
    const a = read(A, m.key);
    const b = read(B, m.key);
    if (a == null || b == null || !Number.isFinite(a) || !Number.isFinite(b) || a === 0) return 0;
    return Math.abs((b - a) / Math.abs(a));
  });
  const scale = Math.max(...rels, 0.2);

  return h('div.table-wrap',
    h('table.table.cmp',
      h('thead', h('tr',
        h('th', 'Metrika'),
        h('th.num', labels[0]),
        h('th.num', labels[1]),
        h('th.num', 'Rozdíl'),
        h('th', { style: { width: '34%' } }, ''))),
      h('tbody', ...rows.map((m) => {
        const a = read(A, m.key);
        const b = read(B, m.key);
        const known = a != null && b != null && Number.isFinite(a) && Number.isFinite(b);
        const diff = known ? b - a : null;
        const pct = known && a !== 0 ? (diff / Math.abs(a)) * 100 : null;

        return h('tr',
          h('td', m.dot && h('i.cmp-dot', { style: { background: m.dot } }),
            h('span', m.label),
            m.hint && h('span.cmp-hint', m.hint)),
          h('td.num', show(m, a), m.unit && h('span.cmp-unit', m.unit)),
          h('td.num', show(m, b), m.unit && h('span.cmp-unit', m.unit)),
          h('td.num', diffCell(m, diff, pct)),
          h('td', diffBar(diff, pct, scale, m)));
      }))));
}

function diffCell(m, diff, pct) {
  if (diff == null) return h('span.faint', '—');
  if (Math.abs(diff) < 1e-9) return h('span.faint', 'beze změny');

  const up = diff > 0;
  const bad = m.tone === 'up-bad' ? up : m.tone === 'down-bad' ? !up : null;
  const value = m.big
    ? bigNum(m.conv ? S.toDisplay(Math.abs(diff)) : Math.abs(diff))
    : num(Math.abs(m.conv ? S.toDisplay(diff) : diff), m.d ?? 1);

  return h('span.cmp-diff', { dataset: bad == null ? {} : { tone: bad ? 'bad' : 'ok' } },
    up ? '+' : '−', value,
    pct != null && h('span.cmp-pct', `${up ? '+' : '−'}${num(Math.abs(pct), 0)} %`));
}

/** Pruh od středu — vlevo úbytek, vpravo přírůstek. */
function diffBar(diff, pct, scale, m) {
  if (diff == null || pct == null || Math.abs(diff) < 1e-9) return h('div.cmp-bar');
  const w = Math.min(50, (Math.abs(pct) / 100 / scale) * 50);
  const up = diff > 0;
  const bad = m.tone === 'up-bad' ? up : m.tone === 'down-bad' ? !up : null;
  return h('div.cmp-bar',
    h('span.cmp-fill', {
      dataset: { dir: up ? 'up' : 'down', tone: bad == null ? 'flat' : bad ? 'bad' : 'ok' },
      style: { width: `${w}%` },
    }));
}

/* ---------------------------------------------------------
   Rozdělení bloku na porovnatelné kusy
   --------------------------------------------------------- */

const weekOf = (date, start) => Math.max(1, Math.floor(C.daysBetween(start, date) / 7) + 1);

function weekUnits(entries, blk) {
  const map = new Map();
  for (const e of entries) {
    const w = weekOf(e.date, blk.start);
    if (!map.has(w)) map.set(w, []);
    map.get(w).push(e);
  }
  return [...map.entries()].sort((x, y) => x[0] - y[0])
    .map(([w, list]) => ({ id: String(w), label: `Týden ${w}`, short: `T${w}`, entries: list }));
}

function sessionUnits(entries) {
  const map = new Map();
  for (const e of entries) {
    if (!map.has(e.date)) map.set(e.date, []);
    map.get(e.date).push(e);
  }
  // v hlavičkách sloupců se používá krátký tvar — „pondělí 13. 7." třikrát
  // za sebou rozhodí tabulku do šířky a odsune sloupec s rozdílem z obrazu
  return [...map.entries()].sort((x, y) => x[0].localeCompare(y[0]))
    .map(([date, list]) => ({ id: date, label: weekday(date), short: shortDate(date), entries: list, date }));
}

/* =========================================================
   Pohled
   ========================================================= */

export function compareView(nav) {
  const root = h('div.view');
  const render = () => { clear(root); build(root, render, nav); };
  render();
  return root;
}

function build(root, render, nav) {
  const a = S.athlete();
  if (!a) {
    root.append(empty('Nejdřív si založ svěřence.',
      h('button.btn.btn-primary', { onclick: () => nav('athletes') }, 'Přidat svěřence')));
    return;
  }

  const blocks = S.athleteBlocks(a.id);
  const blk = S.block() ?? blocks.at(-1) ?? null;
  if (!blk) {
    root.append(empty('Zatím není co porovnávat — svěřenec nemá blok.',
      h('button.btn.btn-primary', { onclick: () => nav('program') }, 'Postavit blok')));
    return;
  }

  const e1rms = S.blockE1rm(blk, a);
  const variants = S.athleteVariants(a);
  const entries = S.blockEntries(blk.id);

  /* ---- z čeho se vybírá ---- */
  let units;
  if (st.scope === 'blocks') {
    units = blocks.map((b) => ({
      id: b.id,
      label: b.name,
      short: b.name,
      entries: S.blockEntries(b.id),
      e1rms: S.blockE1rm(b, a),
    }));
  } else if (st.scope === 'sessions') {
    units = sessionUnits(entries);
  } else {
    units = weekUnits(entries, blk);
  }

  /* Výchozí volba je první proti poslednímu — a musí se dopočítat dřív,
     než se vykreslí lišta, jinak by seznamy dostaly prázdnou hodnotu
     a spadly obě na první položku. */
  const has = (id) => units.some((u) => u.id === id);
  if (!has(st.a)) st.a = units[0]?.id ?? null;
  if (!has(st.b) || st.b === st.a) st.b = units.at(-1)?.id === st.a ? units[0]?.id : units.at(-1)?.id;

  root.append(scopeBar(units, render));

  if (units.length < 2) {
    root.append(card('Není co s čím porovnat', { eyebrow: SCOPES.find((s) => s.value === st.scope).label },
      h('p.note', st.scope === 'blocks'
        ? 'Tenhle svěřenec má zatím jediný blok. Porovnávat se dá až druhý — dá se založit ve Stavbě bloku nebo zkopírovat tlačítkem Duplikovat blok v Analýze.'
        : 'V bloku je zatím jen jedna položka téhle úrovně.'),
      h('button.btn', { onclick: () => nav('program') }, 'Otevřít Stavbu bloku')));
    return;
  }

  const A = units.find((u) => u.id === st.a);
  const B = units.find((u) => u.id === st.b);

  const pa = profile(A.entries, A.e1rms ?? e1rms, variants);
  const pb = profile(B.entries, B.e1rms ?? e1rms, variants);

  /* ---- přehled všech kusů najednou ---- */
  root.append(overview(units, e1rms, variants, render));

  /* ---- hlava proti hlavě ---- */
  root.append(card(`${A.label} proti ${B.label}`, {
    eyebrow: 'Rozdíl je vždycky B minus A — kladné číslo znamená, že v B toho bylo víc',
    action: h('button.btn.btn-sm', {
      title: 'Prohodit A a B',
      onclick: () => { const t = st.a; st.a = st.b; st.b = t; render(); },
    }, icon('copy', 13), 'Prohodit'),
    class: 'is-flush',
  },
    deltaTable(METRICS(), pa, pb, [A.short, B.short])));

  root.append(card('Kam šel objem', { eyebrow: 'Tonáž po cvicích', class: 'is-flush' },
    deltaTable(liftMetrics(), pa, pb, [A.short, B.short])));

  /* ---- u jednotek ještě cvik po cviku ---- */
  if (st.scope === 'sessions') root.append(sessionDetail(A, B));
}

/* ---------------------------------------------------------
   Lišta voleb
   --------------------------------------------------------- */

function scopeBar(units, render) {
  const opts = units.map((u) => ({ value: u.id, label: u.label }));

  return h('div.gbar',
    h('div.gbar-field',
      h('span.gbar-label', 'Porovnávat'),
      h('div.seg', { role: 'group' }, ...SCOPES.map((s) => h('button.seg-btn', {
        type: 'button',
        'aria-pressed': String(s.value === st.scope),
        onclick: () => { st.scope = s.value; st.a = null; st.b = null; render(); },
      }, s.label)))),

    h('label.gbar-field',
      h('span.gbar-label', 'A'),
      select(opts, { value: st.a, onchange: (e) => { st.a = e.target.value; render(); } })),

    h('label.gbar-field',
      h('span.gbar-label', 'B'),
      select(opts, { value: st.b, onchange: (e) => { st.b = e.target.value; render(); } })));
}

/* ---------------------------------------------------------
   Přehled všech kusů — klikací
   --------------------------------------------------------- */

/**
 * Všechny týdny (jednotky, bloky) pod sebou s klíčovými čísly a změnou
 * proti předchozímu. Slouží k výběru: kdo v něm uvidí, že třetí týden
 * vyskočil, klepne na něj a porovná ho s druhým.
 */
function overview(units, e1rms, variants, render) {
  const profiles = units.map((u) => ({ u, p: profile(u.entries, u.e1rms ?? e1rms, variants) }));

  const pick = (id, slot) => { st[slot] = id; render(); };

  return card('Všechno vedle sebe', {
    eyebrow: `${units.length} ${units.length < 5 ? 'položky' : 'položek'} · klepnutím vybereš A nebo B`,
    class: 'is-flush',
  },
    h('div.table-wrap',
      h('table.table.cmp-all',
        h('thead', h('tr',
          h('th', ''),
          h('th', ''),
          h('th.num', `Tonáž (${U()})`),
          h('th.num', 'Zvedy'),
          h('th.num', 'Tvrdé s.'),
          h('th.num', 'ø int.'),
          h('th.num', 'Špička'),
          h('th.num', 'Odch. RPE'),
          h('th.num', 'Změna objemu'))),
        h('tbody', ...profiles.map(({ u, p }, i) => {
          const prev = i > 0 ? profiles[i - 1].p : null;
          const change = prev && prev.tonnage > 0 ? ((p.tonnage - prev.tonnage) / prev.tonnage) * 100 : null;
          const role = u.id === st.a ? 'a' : u.id === st.b ? 'b' : null;

          return h('tr', { dataset: role ? { role } : {} },
            h('td.cmp-pick',
              h('button.cmp-slot', {
                type: 'button', 'aria-pressed': String(role === 'a'),
                title: `Nastavit ${u.label} jako A`,
                onclick: () => pick(u.id, 'a'),
              }, 'A'),
              h('button.cmp-slot', {
                type: 'button', 'aria-pressed': String(role === 'b'),
                title: `Nastavit ${u.label} jako B`,
                onclick: () => pick(u.id, 'b'),
              }, 'B')),
            h('td', h('b', u.label)),
            h('td.num', bigNum(S.toDisplay(p.tonnage))),
            h('td.num', num(p.reps, 0)),
            h('td.num', num(p.hard, 0)),
            h('td.num', p.avgIntensity == null ? '—' : `${num(p.avgIntensity, 1)} %`),
            h('td.num', p.peak == null ? '—' : `${num(p.peak, 1)} %`),
            h('td.num', p.drift == null ? '—' : `${p.drift > 0 ? '+' : ''}${num(p.drift, 2)}`),
            h('td.num', change == null
              ? h('span.faint', '—')
              : h('span.cmp-diff', `${change > 0 ? '+' : change < 0 ? '−' : ''}${num(Math.abs(change), 0)} %`)));
        })))));
}

/* ---------------------------------------------------------
   Cvik po cviku u dvou jednotek
   --------------------------------------------------------- */

/**
 * Dvě jednotky vedle sebe, řádek na cvik.
 *
 * Páruje se podle jména cviku, ne podle pořadí: kdo v úterý prohodil dřep
 * s benčem, pořád porovnává dřep s dřepem. Cvik, který je jen v jedné
 * jednotce, se ukáže taky — chybějící cvik je informace, ne prázdné místo.
 */
function sessionDetail(A, B) {
  const names = [...new Set([...A.entries, ...B.entries].map(liftName))];

  const sum = (list) => {
    if (!list.length) return null;
    const sets = list.reduce((s, e) => s + e.sets, 0);
    const top = list.reduce((m, e) => Math.max(m, C.liftedWeight(e)), 0);
    const rpe = list.map((e) => e.actualRpe ?? e.rpe).filter((v) => v != null);
    return {
      sets,
      reps: list.reduce((s, e) => s + C.nl(e), 0),
      ton: list.reduce((s, e) => s + C.tonnage(e), 0),
      top,
      rpe: rpe.length ? Math.max(...rpe) : null,
      lift: list[0].lift,
    };
  };

  const rows = names.map((name) => {
    const x = sum(A.entries.filter((e) => liftName(e) === name));
    const y = sum(B.entries.filter((e) => liftName(e) === name));
    const cell = (v, f) => (v == null ? h('span.faint', '—') : f(v));
    const dTon = x && y ? y.ton - x.ton : null;

    return [
      h('span', liftDot((x ?? y).lift), name),
      { num: true, value: cell(x, (v) => `${v.sets}×${Math.round(v.reps / v.sets)}`) },
      { num: true, value: cell(x, (v) => W(v.top)) },
      { num: true, value: cell(x, (v) => (v.rpe ?? '—')) },
      { num: true, value: cell(y, (v) => `${v.sets}×${Math.round(v.reps / v.sets)}`) },
      { num: true, value: cell(y, (v) => W(v.top)) },
      { num: true, value: cell(y, (v) => (v.rpe ?? '—')) },
      {
        num: true,
        value: dTon == null
          ? h('span.faint', x ? 'chybí v B' : 'chybí v A')
          : h('span.cmp-diff', `${dTon > 0 ? '+' : dTon < 0 ? '−' : ''}${bigNum(S.toDisplay(Math.abs(dTon)))}`),
      },
    ];
  });

  return card('Cvik po cviku', {
    eyebrow: `${A.label} vlevo, ${B.label} vpravo · páruje se podle jména cviku`,
    class: 'is-flush',
  },
    table(
      ['Cvik',
        { label: `${A.short} sér.×op.`, num: true }, { label: `${A.short} top (${U()})`, num: true }, { label: `${A.short} RPE`, num: true },
        { label: `${B.short} sér.×op.`, num: true }, { label: `${B.short} top (${U()})`, num: true }, { label: `${B.short} RPE`, num: true },
        { label: `Δ tonáž (${U()})`, num: true }],
      rows,
      { class: 'cmp-detail' }));
}
