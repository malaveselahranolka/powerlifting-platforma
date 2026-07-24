// Stav aplikace + uložení do localStorage. Jeden zdroj pravdy.

import { DEFAULT_INVENTORY_KG, DEFAULT_INVENTORY_LB, BLOCK_TEMPLATES } from './data.js';
import { weightFor, roundToBar, parseDate, loadBar, daysBetween } from './calc.js';
import * as cloud from './cloud.js';

const KEY = 'pwr.v1';
export const STORAGE_KEY = KEY;
const listeners = new Set();

export const uid = () => Math.random().toString(36).slice(2, 10);

/** Datum jako 'YYYY-MM-DD' v místním čase — toISOString() posouvá o časové pásmo. */
export function iso(d) {
  const x = parseDate(d);
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`;
}

/** Pondělí týdne, ve kterém datum leží. */
export function mondayOf(d) {
  const x = parseDate(d);
  const day = (x.getDay() + 6) % 7;
  x.setDate(x.getDate() - day);
  x.setHours(0, 0, 0, 0);
  return x;
}

export const addDays = (d, n) => {
  const x = parseDate(d);
  x.setDate(x.getDate() + n);
  return x;
};

/* ---------------------------------------------------------
   Ukázková data — aby appka nebyla po prvním otevření prázdná
   --------------------------------------------------------- */
function seed() {
  const athleteId = uid();
  const blockId = uid();
  const start = mondayOf(addDays(new Date(), -21));

  const e1rm = { squat: 215, bench: 145, deadlift: 255 };
  const wave = BLOCK_TEMPLATES.strength.waves;

  // Po: dřep hlavní + bench doplněk | St: bench hlavní + tah doplněk | Pá: tah hlavní + dřep doplněk
  const days = [
    { off: 0, main: 'squat', second: 'bench', acc: ['Předkopávání', 'Veslování v předklonu'] },
    { off: 2, main: 'bench', second: 'deadlift', acc: ['Tlak s jednoručkami', 'Přítahy k bradě'] },
    { off: 4, main: 'deadlift', second: 'squat', acc: ['Zákopávání', 'Hyperextenze'] },
  ];

  const entries = [];
  wave.forEach((w, wi) => {
    for (const d of days) {
      const date = iso(addDays(start, wi * 7 + d.off));

      entries.push({
        id: uid(), blockId, athleteId, date, lift: d.main, name: null,
        sets: w.sets, reps: w.reps, rpe: w.rpe,
        weight: roundToBar(weightFor(e1rm[d.main], w.reps, w.rpe)),
        actualRpe: wi < 3 ? w.rpe + (wi === 2 ? 0.5 : 0) : null,
      });

      entries.push({
        id: uid(), blockId, athleteId, date, lift: d.second, name: null,
        sets: 3, reps: w.reps + 2, rpe: w.rpe - 1,
        weight: roundToBar(weightFor(e1rm[d.second], w.reps + 2, w.rpe - 1) * 0.95),
        actualRpe: null,
      });

      for (const a of d.acc) {
        entries.push({
          id: uid(), blockId, athleteId, date, lift: 'accessory', name: a,
          sets: 3, reps: 12, rpe: 8, weight: 40, actualRpe: null,
        });
      }
    }
  });

  const bwLog = Array.from({ length: 8 }, (_, i) => ({
    date: iso(addDays(new Date(), -49 + i * 7)),
    value: Number((93.8 - i * 0.18).toFixed(1)),
  }));

  const e1rmLog = ['squat', 'bench', 'deadlift'].flatMap((lift) =>
    Array.from({ length: 6 }, (_, i) => ({
      id: uid(), athleteId, lift,
      date: iso(addDays(new Date(), -70 + i * 14)),
      value: Math.round(e1rm[lift] * (0.93 + i * 0.014)),
    })),
  );

  const meets = [
    {
      id: uid(), athleteId,
      date: iso(addDays(new Date(), -70)), name: 'Krajský pohár', bw: 91.5,
      attempts: [
        { lift: 'squat', weight: 170, made: true },
        { lift: 'squat', weight: 180, made: true },
        { lift: 'squat', weight: 187.5, made: false },
        { lift: 'bench', weight: 115, made: true },
        { lift: 'bench', weight: 122.5, made: true },
        { lift: 'bench', weight: 127.5, made: true },
        { lift: 'deadlift', weight: 200, made: true },
        { lift: 'deadlift', weight: 215, made: true },
        { lift: 'deadlift', weight: 225, made: false },
      ],
    },
  ];

  const wellnessPattern = [
    { sleep: 2, stress: 2, fatigue: 2, soreness: 2 },
    { sleep: 3, stress: 2, fatigue: 2, soreness: 3 },
    { sleep: 2, stress: 3, fatigue: 3, soreness: 2 },
    { sleep: 2, stress: 2, fatigue: 3, soreness: 3 },
    { sleep: 3, stress: 3, fatigue: 3, soreness: 3 },
    { sleep: 3, stress: 3, fatigue: 4, soreness: 3 },
    { sleep: 4, stress: 3, fatigue: 4, soreness: 4 },
    { sleep: 3, stress: 4, fatigue: 4, soreness: 4 },
    { sleep: 4, stress: 4, fatigue: 5, soreness: 4 },
    { sleep: 4, stress: 4, fatigue: 5, soreness: 5 },
  ];
  const wellness = wellnessPattern.map((w, i) => ({
    id: uid(), athleteId, date: iso(addDays(new Date(), -9 + i)), ...w,
  }));

  return {
    version: 1,
    unit: 'kg',
    bar: 20,
    collars: 5,
    inventory: { ...DEFAULT_INVENTORY_KG },
    inventoryLb: { ...DEFAULT_INVENTORY_LB },
    activeAthlete: athleteId,
    activeBlock: blockId,
    athletes: [
      {
        id: athleteId, name: 'Tomáš Novák', sex: 'm', bw: 92.4,
        equipment: 'classic', e1rm, bwLog, note: 'Mistrovství ČR za 9 týdnů.',
      },
    ],
    blocks: [
      { id: blockId, athleteId, name: 'Síla — jaro', start: iso(start), weeks: 4, template: 'strength' },
    ],
    entries,
    e1rmLog,
    meets,
    wellness,
    drafts: {},
  };
}

/* ---------------------------------------------------------
   Store
   --------------------------------------------------------- */
function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return seed();
    const data = JSON.parse(raw);
    return data?.version === 1 && Array.isArray(data.athletes) ? data : seed();
  } catch {
    return seed();
  }
}

export const state = load();

// Ukázková data se generují vůči dnešku. Kdyby se neuložila hned, po zavření
// prohlížeče by se vygenerovala znovu a všechny datumy by se posunuly.
if (!localStorage.getItem(KEY)) persist();

function persist() {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    /* plné úložiště — v paměti stav zůstává */
  }
  // pokud je zapnutá cloudová synchronizace, naplánuj sloučený upload
  cloud.schedulePush(() => JSON.stringify(state));
}

/** Zapíše změnu a upozorní posluchače. */
export function commit(fn) {
  fn?.(state);
  persist();
  for (const l of listeners) l(state);
}

export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function resetAll() {
  localStorage.removeItem(KEY);
  location.reload();
}

/* ---------------------------------------------------------
   Selektory
   --------------------------------------------------------- */
export const athlete = () =>
  state.athletes.find((a) => a.id === state.activeAthlete) ?? state.athletes[0];

/**
 * Aktivní blok, ale vždy jen ten, který patří vybranému svěřenci.
 * Bez té kontroly by se po přepnutí na závodníka bez bloku ukazoval
 * cizí blok — a analyzoval by se proti jeho maximům.
 */
export const block = () => {
  const a = athlete();
  if (!a) return null;
  return state.blocks.find((b) => b.id === state.activeBlock && b.athleteId === a.id)
    ?? state.blocks.find((b) => b.athleteId === a.id)
    ?? null;
};

/**
 * Zkopíruje blok — volitelně na jiný termín a jiného svěřence.
 *
 * Při přenosu na jiného závodníka se váhy přepočítají přes relativní intenzitu:
 * z původního maxima se odvodí procento a to se aplikuje na maximum nového.
 * Absolutní kila by jinému člověku nic neřekla. Doplňky bez známého 1RM
 * a položky bez maxima si váhu ponechají.
 */
export function duplicateBlock(blockId, { name, start, athleteId } = {}) {
  const src = state.blocks.find((b) => b.id === blockId);
  if (!src) return null;

  const target = athleteId ?? src.athleteId;
  const from = state.athletes.find((x) => x.id === src.athleteId);
  const to = state.athletes.find((x) => x.id === target);
  const newStart = start ?? src.start;
  const shift = daysBetween(src.start, newStart);
  const copied = state.entries.filter((e) => e.blockId === blockId);
  const id = uid();

  commit((s) => {
    s.blocks.push({
      id, athleteId: target, weeks: src.weeks, template: src.template,
      name: name?.trim() || `${src.name} (kopie)`,
      start: newStart,
      e1rm: { ...(to?.e1rm ?? {}) },
    });

    for (const e of copied) {
      let weight = e.weight;
      if (target !== src.athleteId) {
        const e1from = from?.e1rm[e.lift] ?? 0;
        const e1to = to?.e1rm[e.lift] ?? 0;
        if (e1from > 0 && e1to > 0) weight = roundToBar((e.weight / e1from) * e1to, { unit: 'kg' });
      }
      s.entries.push({
        ...e, id: uid(), blockId: id, athleteId: target,
        date: iso(addDays(e.date, shift)), weight, actualRpe: null,
      });
    }

    s.activeAthlete = target;
    s.activeBlock = id;
  });

  return id;
}

/**
 * Rozpracovaný plán ze Stavby bloku — jeden na svěřence, dokud se nezaloží
 * jako skutečný blok. Ukládá se do stejného úložiště jako všechno ostatní,
 * takže přežije zavření prohlížeče i přepnutí na jiného svěřence a zpátky.
 *
 * saveDraft píše přímo bez notifikace posluchačů — volá se z každého
 * stisku klávesy v plánovači a nesmí kvůli tomu překreslit celou appku,
 * jinak by se ztrácel fokus v poli uprostřed psaní.
 */
export const loadDraft = (athleteId) => state.drafts?.[athleteId] ?? null;

export function saveDraft(athleteId, draft) {
  (state.drafts ??= {})[athleteId] = draft;
  persist();
}

export function clearDraft(athleteId) {
  if (state.drafts) delete state.drafts[athleteId];
  persist();
}

/**
 * Maxima platná pro daný blok, ne dnešní.
 *
 * Intenzita v % má smysl jen proti maximu, které závodník měl v době, kdy
 * trénoval. Kdyby se historický blok počítal proti dnešnímu E1RM, vypadal by
 * po každém zlepšení zpětně lehčí, než ve skutečnosti byl — a analýza starých
 * bloků by přestala dávat smysl.
 *
 * Pořadí: snapshot uložený u bloku → poslední zápis v historii k datu startu
 * → dnešní maxima jako nouzová varianta.
 */
export function blockE1rm(blk, a = athlete()) {
  if (!blk || !a) return a?.e1rm ?? {};
  if (blk.e1rm) return blk.e1rm;

  const log = (state.e1rmLog ?? []).filter((x) => x.athleteId === a.id && x.date <= blk.start);
  if (!log.length) return a.e1rm;

  const snap = { ...a.e1rm };
  for (const lift of ['squat', 'bench', 'deadlift']) {
    const last = log.filter((x) => x.lift === lift).sort((x, y) => x.date.localeCompare(y.date)).at(-1);
    if (last) snap[lift] = last.value;
  }
  return snap;
}

/** Přepne svěřence a s ním i aktivní blok. */
export function selectAthlete(id) {
  commit((s) => {
    s.activeAthlete = id;
    s.activeBlock = s.blocks.find((b) => b.athleteId === id)?.id ?? null;
  });
}

export const blockEntries = (id = state.activeBlock) =>
  state.entries.filter((e) => e.blockId === id);

/** Všechny bloky jednoho svěřence, chronologicky podle začátku. */
export const athleteBlocks = (athleteId = state.activeAthlete) =>
  state.blocks.filter((b) => b.athleteId === athleteId).sort((x, y) => x.start.localeCompare(y.start));

export const athleteEntries = () =>
  state.entries.filter((e) => e.athleteId === state.activeAthlete);

/** Zápasy jednoho svěřence, chronologicky. */
export const athleteMeets = (athleteId = state.activeAthlete) =>
  (state.meets ?? []).filter((m) => m.athleteId === athleteId).sort((x, y) => x.date.localeCompare(y.date));

export function addMeet(meet) {
  commit((s) => { (s.meets ??= []).push({ id: uid(), ...meet }); });
}

export function deleteMeet(id) {
  commit((s) => { s.meets = (s.meets ?? []).filter((m) => m.id !== id); });
}

/** Záznamy pohody (Hooperův index) jednoho svěřence, chronologicky. */
export const athleteWellness = (athleteId = state.activeAthlete) =>
  (state.wellness ?? []).filter((w) => w.athleteId === athleteId).sort((x, y) => x.date.localeCompare(y.date));

/** Jeden záznam na den a svěřence — druhý zápis týž den přepíše první. */
export function setWellness(athleteId, date, values) {
  commit((s) => {
    (s.wellness ??= []);
    const existing = s.wellness.find((w) => w.athleteId === athleteId && w.date === date);
    if (existing) Object.assign(existing, values);
    else s.wellness.push({ id: uid(), athleteId, date, ...values });
  });
}

export const total = (a = athlete()) =>
  a ? (a.e1rm.squat ?? 0) + (a.e1rm.bench ?? 0) + (a.e1rm.deadlift ?? 0) : 0;

/* ---------------------------------------------------------
   Jednotky — vše se ukládá v kg, převádí se až při zobrazení
   --------------------------------------------------------- */
export const KG_PER_LB = 0.45359237;

export const toDisplay = (kg) => (state.unit === 'lb' ? kg / KG_PER_LB : kg);
export const fromDisplay = (v) => (state.unit === 'lb' ? v * KG_PER_LB : v);
export const unitLabel = () => state.unit;

/* ---------------------------------------------------------
   Nakládání osy vždy v zobrazované jednotce.
   V librové posilovně se nakládají librové kotouče, ne přepočtené kilové —
   proto se osa i objímky mapují na reálné librové vybavení.
   --------------------------------------------------------- */
const BAR_LB = { 20: 45, 15: 35, 25: 55 };
const COLLARS_LB = { 0: 0, 5: 11, 0.5: 1 };

/** Osa, objímky a sklad kotoučů v aktuální jednotce. */
export function barSetup({ barKg = state.bar, collarsKg = state.collars } = {}) {
  if (state.unit === 'lb') {
    return {
      unit: 'lb',
      bar: BAR_LB[barKg] ?? Math.round(barKg / KG_PER_LB / 5) * 5,
      collars: COLLARS_LB[collarsKg] ?? 0,
      inventory: state.inventoryLb ?? { ...DEFAULT_INVENTORY_LB },
    };
  }
  return { unit: 'kg', bar: barKg, collars: collarsKg, inventory: state.inventory };
}

/** Naloží zadanou váhu (v zobrazované jednotce) dostupnými kotouči. */
export function loadDisplay(target, opts = {}) {
  const setup = barSetup(opts);
  return loadBar(target, {
    bar: setup.bar,
    collars: opts.noCollars ? 0 : setup.collars,
    unit: setup.unit,
    inventory: opts.useInventory ? setup.inventory : null,
  });
}

/** Totéž, ale vstup je v kg (tak jsou uložená všechna data). */
export const loadFor = (kgValue, opts = {}) => loadDisplay(toDisplay(kgValue), opts);
