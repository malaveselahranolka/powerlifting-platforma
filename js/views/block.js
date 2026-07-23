import { h, card, stat, icon, num, fixed, pct, bigNum, tag, table, field, numInput, inputNum, select, clear, toast, download } from '../ui.js';
import { stackedBars, heatmap, splitBar, lineChart } from '../charts.js';
import * as S from '../store.js';
import * as C from '../calc.js';
import { LIFTS, COMP_LIFTS, PRILEPIN, SET_LANDMARKS } from '../data.js';
import { W, U, Wu, liftDot, liftName, flagRow, empty } from './_util.js';

const DAYS = ['po', 'út', 'st', 'čt', 'pá', 'so', 'ne'];
const st = { showEditor: false, filter: 'all', duplicating: false };

/* =========================================================
   Duplikace bloku
   ========================================================= */
/** „Síla (kopie)" → „Síla (kopie 2)", ne „Síla (kopie) (kopie)". */
function copyName(name) {
  const base = name.replace(/\s*\(kopie(?:\s+\d+)?\)\s*$/i, '');
  const taken = new Set(S.state.blocks.map((b) => b.name));
  let candidate = `${base} (kopie)`;
  for (let n = 2; taken.has(candidate); n++) candidate = `${base} (kopie ${n})`;
  return candidate;
}

function duplicateForm(blk, a, render, nav) {
  const draft = {
    name: copyName(blk.name),
    start: S.iso(S.mondayOf(S.addDays(new Date(), 7))),
    athleteId: a.id,
  };

  const info = h('p.note');
  const syncInfo = () => {
    const target = S.state.athletes.find((x) => x.id === draft.athleteId);
    clear(info);
    info.append(draft.athleteId === blk.athleteId
      ? 'Kopie zůstane u stejného svěřence. Váhy se přenesou beze změny, jen se posunou datumy.'
      : `Váhy se přepočítají na maxima, která má ${target.name}: z původní váhy se odvodí procento z 1RM a stejné procento se použije na nová maxima. Doplňkové cviky bez známého 1RM si váhu ponechají.`);
  };
  syncInfo();

  return card('Duplikovat blok', {
    eyebrow: `Zdroj: ${blk.name} · ${blk.weeks} týdnů`,
    action: h('button.btn.btn-ghost.btn-sm', {
      onclick: () => { st.duplicating = false; render(); },
    }, icon('x', 15), 'Zrušit'),
  },
    h('div.form-row',
      field('Název kopie', h('input.input', {
        value: draft.name, style: { fontFamily: 'var(--font-body)' },
        oninput: (e) => { draft.name = e.target.value; },
      })),
      field('Začátek (pondělí)', h('input.input', {
        type: 'date', value: draft.start,
        onchange: (e) => { draft.start = S.iso(S.mondayOf(e.target.value)); },
      })),
      field('Pro koho', select(
        S.state.athletes.map((x) => ({ value: x.id, label: x.name })),
        { value: draft.athleteId, onchange: (e) => { draft.athleteId = e.target.value; syncInfo(); } }))),
    info,
    h('div.btn-row',
      h('button.btn.btn-primary', {
        onclick: () => {
          const id = S.duplicateBlock(blk.id, draft);
          if (!id) { toast('Blok se nepodařilo zkopírovat', 'bad'); return; }
          st.duplicating = false;
          toast(`Kopie „${draft.name.trim() || blk.name}" založena`);
          render();
        },
      }, icon('copy', 16), 'Vytvořit kopii')));
}

export function blockView(nav) {
  const root = h('div.view');
  const render = () => { clear(root); build(root, render, nav); };
  render();
  return root;
}

function build(root, render, nav) {
  const a = S.athlete();
  const blocks = S.state.blocks.filter((b) => b.athleteId === a?.id);
  const blk = S.block();

  if (!a || !blk) {
    root.append(empty('Žádný blok k analýze.', h('button.btn.btn-primary', { onclick: () => nav('program') }, 'Postavit blok')));
    return;
  }

  const all = S.blockEntries(blk.id);
  const entries = st.filter === 'all' ? all : all.filter((e) => e.lift === st.filter);
  // maxima platná v době bloku, ne dnešní — jinak by starý blok po zlepšení
  // zpětně vypadal lehčí, než byl
  const blkE1rm = S.blockE1rm(blk, a);
  const an = C.analyzeBlock(entries, blkE1rm, blk.start);
  const ac = C.acwr(an.loadsByDay, new Date());

  /* ---- výběr bloku ---- */
  root.append(h('div.btn-row',
    h('div.field', { style: { minWidth: '220px' } },
      h('span.field-label', 'Blok'),
      select(blocks.map((b) => ({ value: b.id, label: `${b.name} · ${b.weeks} týdnů` })), {
        value: blk.id, onchange: (e) => { S.commit((s) => { s.activeBlock = e.target.value; }); render(); },
      })),
    h('div.field', { style: { minWidth: '180px' } },
      h('span.field-label', 'Filtr cviku'),
      select([{ value: 'all', label: 'Všechny cviky' }, ...Object.entries(LIFTS).map(([k, v]) => ({ value: k, label: v.label }))], {
        value: st.filter, onchange: (e) => { st.filter = e.target.value; render(); },
      })),
    h('div', { style: { flex: 1 } }),
    h('button.btn', {
      onclick: () => { st.duplicating = !st.duplicating; render(); },
    }, icon('copy', 16), 'Duplikovat blok'),
    h('button.btn', { onclick: () => exportCsv(all, blk) }, icon('download', 16), 'Export CSV'),
    h('button.btn', { onclick: () => importCsv(blk, render) }, icon('upload', 16), 'Import CSV'),
    h('button.btn.btn-primary', { onclick: () => { st.showEditor = !st.showEditor; render(); } },
      icon(st.showEditor ? 'check' : 'sliders', 16), st.showEditor ? 'Hotovo' : 'Upravit jednotky')));

  if (st.duplicating) root.append(duplicateForm(blk, a, render, nav));

  if (!entries.length) {
    root.append(empty('V tomhle bloku nejsou žádné položky.', h('button.btn.btn-primary', { onclick: () => nav('program') }, 'Vygenerovat blok')));
    return;
  }

  /* ---- souhrn ---- */
  const peak = Math.max(0, ...an.weeks.map((w) => w.peakIntensity ?? 0));
  const peakTone = peak >= 90 ? 'bad' : peak >= 85 ? 'warn' : null;
  root.append(h('div.grid.g4',
    stat('Celková tonáž', bigNum(S.toDisplay(an.total.tonnage)), U()),
    stat('Zvedů v hlavních cvicích', bigNum(an.total.nlMain), `z ${bigNum(an.total.nl)} NL`),
    stat('Průměrná intenzita', num(an.total.avgIntensity, 1), '% z E1RM'),
    stat('Nejtěžší série bloku', num(peak, 1), '% z 1RM', peakTone)));

  /* ---- heatmapa ---- */
  const cells = [];
  const byDay = new Map();
  for (const e of entries) {
    const wk = Math.max(1, Math.floor(C.daysBetween(blk.start, e.date) / 7) + 1);
    const day = DAYS[(C.parseDate(e.date).getDay() + 6) % 7];
    const key = `${wk}|${day}`;
    if (!byDay.has(key)) byDay.set(key, { week: wk, day, ton: 0, intSum: 0, nl: 0, date: e.date });
    const d = byDay.get(key);
    const e1 = blkE1rm[e.lift] ?? 0;
    d.ton += C.tonnage(e);
    if (e1 > 0) { d.intSum += C.intensity(e, e1) * C.nl(e); d.nl += C.nl(e); }
  }
  // Sytost se škáluje mezi nejlehčím a nejtěžším dnem bloku — jinak by při
  // vyrovnaném objemu vyšly všechny buňky stejně a mapa by neřekla nic.
  const tons = [...byDay.values()].map((d) => d.ton);
  const minTon = Math.min(...tons, 0);
  const spanTon = Math.max(...tons, 1) - minTon || 1;

  for (const d of byDay.values()) {
    const avgInt = d.nl ? d.intSum / d.nl : 0;
    const zone = C.prilepinZone(avgInt);
    cells.push({
      week: d.week, day: d.day,
      color: avgInt ? zone.color : 'var(--steel)',
      weight: 0.28 + 0.72 * ((d.ton - minTon) / spanTon),
      label: avgInt ? `${Math.round(avgInt)} %` : '—',
      title: avgInt
        ? `Týden ${d.week}, ${d.day} — tonáž ${bigNum(S.toDisplay(d.ton))} ${U()}, průměrná intenzita ${num(avgInt, 1)} % (${zone.label})`
        : `Týden ${d.week}, ${d.day} — jen doplňkové cviky, tonáž ${bigNum(S.toDisplay(d.ton))} ${U()}`,
    });
  }

  root.append(card('Mapa bloku', {
    eyebrow: 'Barva = intenzitní zóna · sytost = objem dne',
    class: 'is-flush',
    action: h('div.zone-legend', ...PRILEPIN.map((z) => h('div.zone-item', h('i', { style: { background: z.color } }), z.label))),
  },
    h('div', { style: { padding: '0 24px 24px', overflowX: 'auto' } },
      heatmap(cells, { weeks: an.weeks.map((w) => w.week), days: DAYS }))));

  /* ---- objem + zátěž ---- */
  root.append(h('div.grid.g2',
    card('Tonáž po týdnech', { eyebrow: `Rozdělená podle cviku · ${U()}`, class: 'is-flush' },
      h('div', { style: { padding: '0 24px 24px' } },
        stackedBars(
          an.weeks.map((w) => ({ label: `T${w.week}`, values: w.lifts })),
          [...COMP_LIFTS, 'accessory'].map((k) => ({ key: k, label: LIFTS[k].label, color: LIFTS[k].color })),
          { fmt: (v) => bigNum(S.toDisplay(v)) }))),

    card('Rozpad podle cviku', { eyebrow: 'Kam jde objem' },
      splitBar(an.lifts.map((l) => ({
        label: LIFTS[l.lift]?.label ?? l.lift,
        value: l.tonnage,
        color: LIFTS[l.lift]?.color ?? 'var(--steel)',
      })), { fmt: (v) => `${bigNum(S.toDisplay(v))} ${U()}` }),
      table(['Cvik', { label: 'NL', num: true }, { label: 'Ø int.', num: true }, { label: 'INOL/týd.', num: true }, { label: `Top (${U()})`, num: true }],
        an.lifts.map((l) => [
          h('span', liftDot(l.lift), LIFTS[l.lift]?.label ?? l.lift),
          { num: true, value: l.nl },
          { num: true, value: l.measured ? `${fixed(l.avgIntensity, 0)} %` : h('span.faint', '—') },
          { num: true, value: l.measured ? fixed(l.inolPerWeek, 2) : '—' },
          { num: true, value: W(l.top, 1) },
        ])))));

  /* ---- týdenní tabulka ---- */
  root.append(card('Týden po týdnu', { eyebrow: 'Objem a intenzita zvlášť — jedno číslo týden nepopíše', class: 'is-flush' },
    h('div', { style: { padding: '0 24px 24px' } },
      table(
        ['Týden', { label: 'Tvrdých sérií / cvik', num: true }, { label: 'Ø int.', num: true },
          { label: 'Špička', num: true }, 'Charakter týdne',
          { label: `Tonáž (${U()})`, num: true }, { label: 'Změna objemu', num: true }],
        an.weeks.map((w, i) => {
          const g = C.gradeWeek(w);
          const prev = an.weeks[i - 1];
          const delta = prev && prev.tonnage ? ((w.tonnage - prev.tonnage) / prev.tonnage) * 100 : null;
          return {
            tone: g.tone === 'bad' ? 'bad' : g.tone === 'warn' ? 'warn' : null,
            cells: [
              h('b', `Týden ${w.week}`),
              { num: true, value: h('b', fixed(w.hardSetsPerLift, 1)) },
              { num: true, value: w.nlMain ? `${fixed(w.avgIntensity, 0)} %` : '—' },
              {
                num: true,
                value: w.nlMain
                  ? h('b', { style: { color: w.peakIntensity >= 90 ? 'var(--red-lit)' : w.peakIntensity >= 85 ? 'var(--yellow)' : 'var(--chalk)' } }, `${fixed(w.peakIntensity, 0)} %`)
                  : '—',
              },
              h('span', { title: g.note }, tag(g.label, g.tone)),
              { num: true, value: h('span.faint', bigNum(S.toDisplay(w.tonnage))) },
              { num: true, value: delta == null ? '—' : h('span.faint', `${delta >= 0 ? '+' : ''}${fixed(delta, 0)} %`) },
            ],
          };
        })),
      h('p.note', { style: { marginTop: '14px' } },
        h('b', 'Tvrdá série'), ' je série na RPE 7 a výš — jen ty tvoří podnět. Je to objemová metrika, na které se současná praxe sjednotila; tonáž je vedle jen pro orientaci, protože odmění i nekonečné lehké série. ',
        h('b', 'Špička'), ' je nejtěžší série týdne v procentech z 1RM. Týden s maximálními singly může mít málo sérií a přesto být nejnáročnější v bloku — objem netlačí, ale nervová soustava jede naplno.'))));

  /* ---- odchylka od plánu ---- */
  const creep = C.rpeCreep(entries, blk.start);
  if (creep.length) {
    const lastCreep = creep.at(-1);
    const cg = C.gradeCreep(lastCreep.avg);
    root.append(card('Jak to reálně šlo', {
      eyebrow: 'Skutečné RPE proti plánu',
      action: h('button.btn.btn-sm', { onclick: () => nav('realita') }, icon('target', 14), 'Otevřít porovnání'),
    },
      h('div.grid.g3',
        stat('Odchylka RPE poslední týden',
          `${lastCreep.avg >= 0 ? '+' : '−'}${fixed(Math.abs(lastCreep.avg), 2)}`, cg.label, cg.tone),
        stat('Zapsaných sérií', creep.reduce((s2, w) => s2 + w.n, 0), `z ${entries.length}`),
        (() => {
          const real = entries.filter((e) => e.actualRpe != null).map(C.setE1rm).filter(Boolean);
          return stat('Nejlepší odhad 1RM', real.length ? W(Math.max(...real)) : '—', U());
        })()),
      h('p.note', 'Když stejný plán jede týden co týden na vyšší RPE, hromadí se únava — i když váhy na papíře sedí. Je to nejpřímější signál, který z tréninku dostaneš.')));
  }

  /* ---- tvrdé série ---- */
  const hs = C.hardSets(entries, blkE1rm, blk.start);
  const usedLifts = COMP_LIFTS.filter((k) => hs.some((w) => w.lifts[k]));
  if (usedLifts.length) {
    root.append(card('Tvrdé série po týdnech', {
      eyebrow: 'Série na RPE 7 a výš — jen ty tvoří podnět',
      class: 'is-flush',
    },
      h('div', { style: { padding: '0 24px 24px' } },
        table(
          ['Týden', ...usedLifts.map((k) => ({ label: LIFTS[k].label, num: true })), { label: 'Celkem', num: true }, 'Hodnocení'],
          hs.map((w) => {
            const totalSets = usedLifts.reduce((s2, k) => s2 + (w.lifts[k] ?? 0), 0);
            const perLift = totalSets / usedLifts.length;
            const g2 = SET_LANDMARKS.find((b) => perLift < b.max) ?? SET_LANDMARKS.at(-1);
            return {
              tone: g2.tone === 'bad' ? 'bad' : g2.tone === 'warn' ? 'warn' : null,
              cells: [
                h('b', `Týden ${w.week}`),
                ...usedLifts.map((k) => ({ num: true, value: w.lifts[k] ?? h('span.faint', '0') })),
                { num: true, value: h('b', totalSets) },
                tag(g2.label, g2.tone),
              ],
            };
          })),
        h('p.note', { style: { marginTop: '12px' } },
          'Hodnocení bere průměr na jeden soutěžní cvik. Běžné pásmo je zhruba 6 až 14 tvrdých sérií týdně — zbytek objemu dodají varianty a doplňky, které se sem nepočítají. Nula v deloadovém týdnu je v pořádku: série na RPE 6 podnět netvoří, a přesně o to při odlehčení jde.'))));
  }

  /* ---- Prilepin ---- */
  root.append(h('div.grid.g-side',
    card('Prilepinova tabulka', { eyebrow: 'Kolik zvedů padlo do které zóny', class: 'is-flush' },
      h('div', { style: { padding: '0 24px 24px' } },
        table(
          ['Zóna', { label: 'Op./série', num: true }, { label: 'Zvedů', num: true }, { label: 'Ø / jednotku', num: true }, { label: 'Pásmo', num: true }, 'Stav'],
          PRILEPIN.map((z) => {
            const repsTotal = an.weeks.reduce((s2, w) => s2 + w.zones[z.key], 0);
            const sessionsWithZone = countSessionsInZone(entries, blkE1rm, z);
            const avg = sessionsWithZone ? repsTotal / sessionsWithZone : 0;
            const inRange = avg >= z.range[0] && avg <= z.range[1];
            return [
              h('span', h('i.lift-dot', { style: { background: z.color } }), z.label),
              { num: true, value: z.reps },
              { num: true, value: repsTotal },
              { num: true, value: repsTotal ? fixed(avg, 1) : '—' },
              { num: true, value: h('span', `${z.range[0]}–${z.range[1]}`, h('span.faint', { style: { marginLeft: '5px' } }, `⌀${z.optimal}`)) },
              repsTotal === 0 ? tag('nevyužito', 'neutral')
                : inRange ? tag('v pásmu', 'ok')
                  : avg > z.range[1] ? tag('nad pásmem', 'warn') : tag('pod pásmem', 'low'),
            ];
          })),
        h('p.note', { style: { marginTop: '12px' } },
          'Pásma platí na ', h('b', 'jeden cvik v jedné jednotce'), ', ne na týden. Dvě věci, kvůli kterým „pod pásmem" často neznamená chybu: rozcvičovací série se sem nepočítají (appka vidí jen to, co je zapsané), a Prilepin vznikl na vzpírání, kde se v zóně nad 90 % dělalo víc těžkých jednotek za sebou. ',
          h('b', 'Vrcholení s jedním top singlem'), ' bude v téhle zóně pod pásmem vždycky a je to v pořádku.'))),

    card('Co si hlídat', { eyebrow: 'Automatická kontrola' },
      ...C.blockFlags(an, ac.ratio, (k) => LIFTS[k]?.label ?? k).map(flagRow),
      h('p.note', 'Kontrola vychází z INOL (opakování ÷ (100 − intenzita)), Prilepinových pásem a poměru akutní ku chronické zátěži. Doplňkové cviky se do intenzitních metrik nepočítají — nemají 1RM.'))));

  /* ---- editor ---- */
  if (st.showEditor) root.append(editor(all, blk, a, render));
}

function countSessionsInZone(entries, e1rms, zone) {
  const set = new Set();
  for (const e of entries) {
    const e1 = e1rms[e.lift] ?? 0;
    if (!e1) continue;
    const i = C.intensity(e, e1);
    if (i >= zone.min && i <= zone.max) set.add(`${e.date}|${e.lift}`);
  }
  return set.size;
}

/* =========================================================
   Editor položek
   ========================================================= */
function editor(entries, blk, a, render) {
  const draft = { date: S.iso(new Date()), lift: 'squat', name: '', sets: 3, reps: 5, weight: 100, rpe: 8 };

  const update = (id, key, value) => {
    S.commit((s) => {
      const e = s.entries.find((x) => x.id === id);
      if (e) e[key] = value;
    });
  };

  const rows = [...entries].sort((x, y) => x.date.localeCompare(y.date) || x.lift.localeCompare(y.lift)).map((e) => ({
    cells: [
      h('input.inline-input', { type: 'date', value: e.date, style: { textAlign: 'left' }, onchange: (ev) => { update(e.id, 'date', ev.target.value); render(); } }),
      select(Object.entries(LIFTS).map(([k, v]) => ({ value: k, label: v.label })), {
        value: e.lift, class: 'inline-input', style: { textAlign: 'left' },
        onchange: (ev) => { update(e.id, 'lift', ev.target.value); render(); },
      }),
      h('input.inline-input', { value: e.name ?? '', placeholder: '—', style: { textAlign: 'left' }, onchange: (ev) => update(e.id, 'name', ev.target.value || null) }),
      h('input.inline-input', { type: 'number', value: e.sets, min: 1, onchange: (ev) => { update(e.id, 'sets', Number(ev.target.value)); render(); } }),
      h('input.inline-input', { type: 'number', value: e.reps, min: 1, onchange: (ev) => { update(e.id, 'reps', Number(ev.target.value)); render(); } }),
      h('input.inline-input', { type: 'number', value: inputNum(S.toDisplay(e.weight), 2), step: 2.5, onchange: (ev) => { update(e.id, 'weight', S.fromDisplay(Number(ev.target.value))); render(); } }),
      h('input.inline-input', { type: 'number', value: e.rpe ?? '', step: 0.5, min: 5, max: 10, onchange: (ev) => { update(e.id, 'rpe', ev.target.value === '' ? null : Number(ev.target.value)); render(); } }),
      h('div.row-actions', h('button.btn.btn-ghost.btn-icon', {
        'aria-label': 'Smazat položku',
        onclick: () => { S.commit((s) => { s.entries = s.entries.filter((x) => x.id !== e.id); }); render(); },
      }, icon('trash', 15))),
    ],
  }));

  const form = h('div.form-row',
    field('Datum', h('input.input', { type: 'date', value: draft.date, oninput: (e) => { draft.date = e.target.value; } })),
    field('Cvik', select(Object.entries(LIFTS).map(([k, v]) => ({ value: k, label: v.label })), { value: draft.lift, onchange: (e) => { draft.lift = e.target.value; } })),
    field('Název', h('input.input', { placeholder: 'jen u doplňků', oninput: (e) => { draft.name = e.target.value; } })),
    field('Série', numInput({ value: draft.sets, min: 1, oninput: (e) => { draft.sets = Number(e.target.value); } })),
    field('Opakování', numInput({ value: draft.reps, min: 1, oninput: (e) => { draft.reps = Number(e.target.value); } })),
    field(`Váha (${U()})`, numInput({ value: draft.weight, step: 2.5, oninput: (e) => { draft.weight = Number(e.target.value); } })),
    field('RPE', numInput({ value: draft.rpe, step: 0.5, min: 5, max: 10, oninput: (e) => { draft.rpe = Number(e.target.value); } })));

  return card('Položky bloku', {
    eyebrow: `${entries.length} řádků · hodnoty se ukládají hned`,
    class: 'is-flush',
    action: h('button.btn.btn-primary.btn-sm', {
      onclick: () => {
        S.commit((s) => {
          s.entries.push({
            id: S.uid(), blockId: blk.id, athleteId: a.id,
            date: draft.date, lift: draft.lift, name: draft.name || null,
            sets: draft.sets, reps: draft.reps, weight: S.fromDisplay(draft.weight), rpe: draft.rpe, actualRpe: null,
          });
        });
        toast('Položka přidána');
        render();
      },
    }, icon('plus', 15), 'Přidat'),
  },
    h('div', { style: { padding: '0 24px 20px' } }, form),
    h('div', { style: { padding: '0 24px 24px', maxHeight: '520px', overflowY: 'auto' } },
      table(['Datum', 'Cvik', 'Název', { label: 'Sér.', num: true }, { label: 'Op.', num: true }, { label: `Váha`, num: true }, { label: 'RPE', num: true }, ''], rows)));
}

/* =========================================================
   CSV
   ========================================================= */
function exportCsv(entries, blk) {
  const head = 'datum;cvik;nazev;serie;opakovani;vaha_kg;rpe';
  const body = entries
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((e) => [e.date, e.lift, e.name ?? '', e.sets, e.reps, e.weight, e.rpe ?? ''].join(';'));
  download(`${blk.name.replace(/\s+/g, '-').toLowerCase()}.csv`, [head, ...body].join('\n'));
  toast('CSV staženo');
}

function importCsv(blk, render) {
  const input = h('input', { type: 'file', accept: '.csv,text/csv', style: { display: 'none' } });
  input.addEventListener('change', async () => {
    const file = input.files?.[0];
    if (!file) return;
    const text = await file.text();
    const lines = text.replace(/^﻿/, '').trim().split(/\r?\n/).slice(1);
    let n = 0;
    S.commit((s) => {
      for (const line of lines) {
        const [date, lift, name, sets, reps, weight, rpe] = line.split(/[;,\t]/).map((x) => x?.trim());
        if (!date || !sets) continue;
        s.entries.push({
          id: S.uid(), blockId: blk.id, athleteId: blk.athleteId,
          date, lift: LIFTS[lift] ? lift : 'accessory', name: name || null,
          sets: Number(sets), reps: Number(reps), weight: Number(weight),
          rpe: rpe ? Number(rpe) : null, actualRpe: null,
        });
        n++;
      }
    });
    toast(n ? `Načteno ${n} řádků` : 'Nic k načtení', n ? 'ok' : 'bad');
    render();
  });
  document.body.append(input);
  input.click();
  input.remove();
}
