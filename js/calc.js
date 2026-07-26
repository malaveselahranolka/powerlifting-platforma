// Veškerá matematika. Čisté funkce, žádný DOM.

import {
  RPE_SEQ, RPE_STEPS, PRILEPIN,
  DOTS_COEF, IPF_GL_COEF, WILKS_COEF, WEIGHT_CLASSES,
  PLATES_KG, PLATES_LB, SBD_RATIOS, AGE_COEFF, AGE_COEFF_SOLID,
  LOAD_VELOCITY, MVT, VELOCITY_LOSS, T95, VARIANTS, RPE_SD_BY_PCT,
  TAPER_MODELS, TAPER_REFERENCE, MEET_TIMING, ATTEMPT_BENCHMARK,
  STRENGTH_P90, SHEIKO_NORMS, WENDLER_531, CUT_BANDS, CUT_FACTS,
} from './data.js';

export const LB_PER_KG = 2.2046226218;

export const round = (n, d = 1) => {
  const f = 10 ** d;
  return Math.round((n + Number.EPSILON) * f) / f;
};

/**
 * 'YYYY-MM-DD' se přes new Date() parsuje jako UTC a v jiném časovém pásmu
 * z toho vyjde jiný den. Tohle drží datum v místním čase a vždy vrací kopii.
 */
export function parseDate(d) {
  if (d instanceof Date) return new Date(d.getTime());
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(d));
  return m ? new Date(+m[1], +m[2] - 1, +m[3]) : new Date(d);
}

const DAY_MS = 86400000;

/** Celé dny mezi dvěma daty, bez ohledu na čas. */
export const daysBetween = (a, b) => {
  const x = parseDate(a); x.setHours(0, 0, 0, 0);
  const y = parseDate(b); y.setHours(0, 0, 0, 0);
  return Math.round((y - x) / DAY_MS);
};

/* =========================================================
   RPE ↔ % 1RM
   ========================================================= */

/** % z 1RM pro dané opakování a RPE. Vrací null mimo rozsah tabulky. */
export function rpeToPct(reps, rpe) {
  const i = Math.round((reps - 1) * 2 + (10 - rpe) * 2);
  if (i < 0 || i >= RPE_SEQ.length) return null;
  return RPE_SEQ[i];
}

/** Kolik opakování zbývá do selhání při daném RPE. */
export const rir = (rpe) => round(10 - rpe, 1);

/**
 * Opačný směr: z procent a opakování zpět na RPE.
 * Tabulka má jen půlbodové kroky, takže se hledá nejbližší. Když je zadané
 * procento dál než 2,5 bodu od kterékoli buňky, vrací null — mimo tabulku
 * by odhad RPE už jen lhal.
 */
export function rpeFromPct(reps, pct) {
  let best = null;
  let bestDiff = Infinity;
  for (const rpe of RPE_STEPS) {
    const p = rpeToPct(reps, rpe);
    if (p == null) continue;
    const diff = Math.abs(p - pct);
    if (diff < bestDiff) { bestDiff = diff; best = rpe; }
  }
  return bestDiff <= 2.5 ? best : null;
}

/* =========================================================
   Odhad 1RM (E1RM)
   ========================================================= */

export const E1RM = {
  epley: (w, r) => (r === 1 ? w : w * (1 + r / 30)),
  brzycki: (w, r) => (r >= 37 ? null : w * (36 / (37 - r))),
  lombardi: (w, r) => w * r ** 0.1,
  oconner: (w, r) => w * (1 + 0.025 * r),
  wathan: (w, r) => (100 * w) / (48.8 + 53.8 * Math.exp(-0.075 * r)),
  mayhew: (w, r) => (100 * w) / (52.2 + 41.9 * Math.exp(-0.055 * r)),
  landers: (w, r) => (100 * w) / (101.3 - 2.67123 * r),
  rpe: (w, r, rpe) => {
    const pct = rpeToPct(r, rpe);
    return pct == null ? null : (w / pct) * 100;
  },
  /**
   * Marzagão (2026), arXiv:2603.17495 — optimalizováno na 303 494 sérií
   * blízko selhání. Jako jediná z těch osmi ví, že 20 kg × 10 a 200 kg × 10
   * nejsou totéž: převodní faktor závisí na velikosti zátěže.
   *
   * Rovnice obsahuje ln(w), takže je závislá na jednotkách — abstrakt je
   * neuvádí. Ověřil jsem je proti kontrolním hodnotám z rešerše: pro 100 kg
   * na 5 opakování vychází 117,5 a pro 40 kg na 10 opakování 58,0, což obojí
   * sedí. Jednotka je tedy kilogram a appka do rovnice vždycky posílá kg,
   * i když se na obrazovce ukazují libry.
   *
   * Jmenovatel je záporný pod 1,75 kg, proto ten ořez.
   *
   * Preprint, nerecenzovaný, a optimalizovaný na vnitřní konzistenci, ne
   * proti změřeným maximům — v datech žádná skutečná maxima nebyla. Proto
   * je to volitelná osmá varianta, ne výchozí.
   */
  weightDependent: (w, r) => {
    if (!(w > 1.75) || !(r >= 1)) return null;
    const denom = -2.55 + 4.58 * Math.log(w);
    if (!(denom > 0)) return null;
    return w * (1 + (r - 1) ** 0.85 / denom);
  },
};

/** Spočítá všechny vzorce naráz. Vrací { key: value|null }. */
export function allE1RM(weight, reps, rpe) {
  const out = {};
  for (const [key, fn] of Object.entries(E1RM)) {
    const v = key === 'rpe' ? fn(weight, reps, rpe) : fn(weight, reps);
    out[key] = Number.isFinite(v) && v > 0 ? round(v, 1) : null;
  }
  return out;
}

/** Medián ze vzorců bez RPE — robustnější než průměr vůči odlehlým hodnotám. */
export function consensusE1RM(weight, reps) {
  const vals = Object.entries(E1RM)
    .filter(([k]) => k !== 'rpe')
    .map(([, fn]) => fn(weight, reps))
    .filter((v) => Number.isFinite(v) && v > 0)
    .sort((a, b) => a - b);
  if (!vals.length) return null;
  const mid = vals.length >> 1;
  return round(vals.length % 2 ? vals[mid] : (vals[mid - 1] + vals[mid]) / 2, 1);
}

/** Zpětný výpočet: z E1RM na váhu na ose pro cílové opakování × RPE. */
export function weightFor(e1rm, reps, rpe) {
  const pct = rpeToPct(reps, rpe);
  return pct == null ? null : round((e1rm * pct) / 100, 2);
}

/* =========================================================
   Nakládání osy
   ========================================================= */

/**
 * Rozloží cílovou váhu na kotouče (na jednu stranu osy).
 * inventory = { '25': početParu, ... }. Vrací nejbližší dosažitelnou váhu.
 */
export function loadBar(target, { bar = 20, collars = 0, unit = 'kg', inventory = null } = {}) {
  const table = unit === 'lb' ? PLATES_LB : PLATES_KG;
  const base = bar + collars;
  let perSide = (target - base) / 2;

  if (perSide < 0) return { plates: [], total: base, delta: round(target - base, 2), perSide: 0, impossible: true };

  const plates = [];
  for (const p of table) {
    const avail = inventory ? (inventory[p.kg] ?? 0) : 99;
    if (avail <= 0) continue;
    const n = Math.min(Math.floor((perSide + 1e-9) / p.kg), avail);
    if (n > 0) {
      plates.push({ ...p, count: n });
      perSide = round(perSide - n * p.kg, 4);
    }
  }

  const loaded = base + 2 * plates.reduce((s, p) => s + p.kg * p.count, 0);
  return {
    plates,
    total: round(loaded, 2),
    perSide: round(plates.reduce((s, p) => s + p.kg * p.count, 0), 2),
    delta: round(loaded - target, 2),
    impossible: false,
  };
}

/** Zaokrouhlí na nejmenší reálný krok (2× nejmenší kotouč). */
export function roundToBar(weight, { unit = 'kg', step = null } = {}) {
  const s = step ?? (unit === 'lb' ? 5 : 2.5);
  return round(Math.round(weight / s) * s, 2);
}

/* =========================================================
   Metriky bloku
   ========================================================= */

/**
 * Váha, se kterou se počítá.
 *
 * Plán a skutečnost jsou dvě různá čísla a appka si je nepřepisuje: `weight`
 * drží, co bylo napsané, `actualWeight` to, co se doopravdy naložilo. Všechno,
 * co popisuje odvedený trénink — tonáž, intenzita, odhad maxima, únava —
 * bere skutečnou váhu, pokud je zapsaná. Kde zapsaná není, zůstává plán,
 * takže se nic nerozbije u sérií, které teprve přijdou.
 */
export const liftedWeight = (e) => e.actualWeight ?? e.weight;

/** Opakování, která se doopravdy udělala. */
export const liftedReps = (e) => e.actualReps ?? e.reps;

/**
 * Maximum platné pro tuhle konkrétní položku.
 *
 * U soutěžního cviku je to prostě jeho maximum. U varianty se odvodí
 * procentem — pauzovaný dřep se netestuje, ale ví se, že jede kolem 88 %
 * soutěžního. Bez tohohle kroku varianta nemá intenzitu vůbec a vypadne
 * ze všeho, co se od intenzity odvíjí.
 *
 * `variants` je přepis koeficientů u konkrétního závodníka; co v něm není,
 * se vezme z výchozí tabulky.
 */
export function entryE1rm(e, e1rms = {}, variants = {}) {
  const v = e.variant;
  if (!v) return e1rms[e.lift] ?? 0;
  const def = VARIANTS[v];
  const base = e1rms[def?.base ?? e.lift] ?? 0;
  if (!(base > 0)) return 0;
  const pct = variants[v] ?? def?.pct;
  return pct > 0 ? round(base * pct, 1) : base;
}

/** Tonáž jedné položky = série × opakování × váha. */
export const tonnage = (e) => e.sets * liftedReps(e) * liftedWeight(e);

/** Počet zvedů (NL). */
export const nl = (e) => e.sets * liftedReps(e);

/** Relativní intenzita v % z E1RM. */
export const intensity = (e, e1rm) => (e1rm > 0 ? (liftedWeight(e) / e1rm) * 100 : 0);

/**
 * INOL = počet opakování / (100 − intenzita v %).
 * Nad 95 % strop, jinak jmenovatel utíká do nekonečna.
 */
export function inol(reps, intensityPct) {
  const i = Math.min(intensityPct, 95);
  if (i <= 0) return 0;
  return reps / (100 - i);
}

export const entryInol = (e, e1rm) => inol(nl(e), intensity(e, e1rm));

/** Do které Prilepinovy zóny položka spadá. */
export const prilepinZone = (pct) => PRILEPIN.find((z) => pct >= z.min && pct <= z.max) ?? PRILEPIN[0];

/**
 * Charakter týdne. Objem a intenzita jsou dvě nezávislé osy a jedno číslo
 * je nepopíše.
 *
 * Objem se měří tvrdými sériemi na cvik a týden — to je metrika, na kterou
 * se současná praxe sjednotila (Helms, Schoenfeld). Tonáž ani INOL to
 * nezvládnou: tonáž odmění nekonečné lehké série, INOL zase podhodnotí
 * maximální singly. Vrcholící týden se singly nad 90 % by podle INOL vyšel
 * jako „lehký", přitom je na nervovou soustavu nejnáročnější v bloku.
 * Proto se čte i špičková intenzita.
 *
 * Vrací { label, tone, volume, intensity, note }.
 */
export function gradeWeek(week) {
  const sets = week.hardSetsPerLift ?? 0;
  const peak = week.peakIntensity ?? 0;

  // osa objemu — tvrdé série na jeden soutěžní cvik za týden
  const volume = sets < 3 ? 'velmi nízký'
    : sets < 6 ? 'nízký'
      : sets < 12 ? 'střední'
        : sets < 18 ? 'vysoký' : 'extrémní';

  // osa intenzity — špička rozhoduje, ne průměr
  const intensity = peak >= 90 ? 'maximální'
    : peak >= 85 ? 'těžká'
      : peak >= 75 ? 'střední' : 'lehká';

  const lowVol = sets < 6;
  const midVol = sets >= 6 && sets < 12;
  const highVol = sets >= 12;
  const extremeVol = sets >= 18;

  // Maximální intenzita není nikdy „lehký týden", ať je objemu jakkoli málo.
  if (peak >= 90) {
    if (highVol) return { label: 'Velmi náročné', tone: 'bad', volume, intensity, note: 'Maximální váhy i vysoký objem naráz. Nedávej dva týdny po sobě.' };
    if (sets < 3) return { label: 'Ostré, málo objemu', tone: 'warn', volume, intensity, note: 'Typické vrcholení: nervová soustava jede naplno, svaly skoro nic nedostanou. Málo sérií tady neznamená lehký trénink.' };
    return { label: 'Ostrý týden', tone: 'warn', volume, intensity, note: 'Maximální váhy k tomu slušný objem. Náročné na hlavu i tělo.' };
  }

  if (peak >= 85) {
    if (extremeVol) return { label: 'Za hranicí', tone: 'bad', volume, intensity, note: 'Těžké váhy a objem nad hranicí regenerace.' };
    if (highVol) return { label: 'Náročné', tone: 'warn', volume, intensity, note: 'Těžké váhy a hodně jich. Sleduj regeneraci.' };
    // těžké váhy dělají práci i při malém objemu — není to deficit, jen jiný typ týdne
    if (lowVol) return { label: 'Těžké, málo objemu', tone: 'ok', volume, intensity, note: 'Intenzita drží formu, objem netlačí. Sedí do taperu nebo mezi objemové týdny.' };
    return { label: 'Standard', tone: 'ok', volume, intensity, note: 'Vyvážený týden — těžké váhy s udržitelným objemem.' };
  }

  // střední a nižší intenzita — rozhoduje objem
  if (extremeVol) return { label: 'Objem za hranicí', tone: 'bad', volume, intensity, note: 'Nad 18 tvrdých sérií na cvik se to nedá odregenerovat ani na středních vahách.' };
  if (highVol) return { label: 'Objemová práce', tone: 'warn', volume, intensity, note: 'Hodně tvrdých sérií na středních vahách. Únava se hromadí ve svalech.' };
  if (midVol) return { label: 'Udržitelné', tone: 'ok', volume, intensity, note: 'Slušná dávka objemu, ze které se dá týden co týden regenerovat.' };
  if (sets < 1) return { label: 'Deload', tone: 'low', volume, intensity, note: 'Žádná série na RPE 7 a výš. Odlehčení, přesně jak má vypadat.' };
  return { label: 'Lehký týden', tone: 'low', volume, intensity, note: 'Málo tvrdých sérií. Uprostřed bloku je to na adaptaci málo.' };
}

/**
 * ACWR = akutní (7 dní) / chronická (klouzavý průměr 28 dní) zátěž.
 * Bezpečné pásmo 0,8–1,3. Nad 1,5 skok v zátěži.
 */
export function acwr(loadsByDay, today) {
  let acute = 0;
  let chronic = 0;
  for (const [date, load] of Object.entries(loadsByDay)) {
    const diff = daysBetween(date, today);
    if (diff < 0) continue;
    if (diff < 7) acute += load;
    if (diff < 28) chronic += load;
  }
  const chronicWeekly = chronic / 4;
  return {
    acute: round(acute),
    chronic: round(chronicWeekly),
    ratio: chronicWeekly > 0 ? round(acute / chronicWeekly, 2) : null,
  };
}

/**
 * ACWR přes exponenciálně vážený klouzavý průměr.
 * Williams a kol. (2017) ukázali, že EWMA zachytí nárůst zátěže citlivěji než
 * prosté klouzavé průměry — čerstvé dny váží víc a únava přirozeně odeznívá.
 * λ = 2 / (N + 1)
 */
export function acwrEwma(loadsByDay, today, { acuteDays = 7, chronicDays = 28 } = {}) {
  const days = Object.keys(loadsByDay);
  if (!days.length) return { acute: null, chronic: null, ratio: null };

  const first = days.reduce((min, d) => (d < min ? d : min), days[0]);
  const span = daysBetween(first, today);
  if (span < 0) return { acute: null, chronic: null, ratio: null };

  const la = 2 / (acuteDays + 1);
  const lc = 2 / (chronicDays + 1);

  // Obě řady se seedují prvním pozorováním. Kdyby startovaly z nuly, pomalejší
  // chronická by se dotahovala déle než akutní a poměr by první měsíc uměle
  // přestřeloval — u konstantní zátěže by vyšel 1,16 místo 1,00.
  const seed = loadsByDay[iso(first)] ?? 0;
  let acute = seed;
  let chronic = seed;

  for (let i = 1; i <= span; i++) {
    const date = iso(addDaysLocal(first, i));
    const load = loadsByDay[date] ?? 0;
    acute = load * la + acute * (1 - la);
    chronic = load * lc + chronic * (1 - lc);
  }

  return {
    acute: round(acute),
    chronic: round(chronic),
    ratio: chronic > 0 ? round(acute / chronic, 2) : null,
    // pod 28 dní historie je chronická zátěž jen odhad
    days: span + 1,
    reliable: span + 1 >= chronicDays,
  };
}

const addDaysLocal = (d, n) => {
  const x = parseDate(d);
  x.setDate(x.getDate() + n);
  return x;
};

const iso = (d) => {
  const x = parseDate(d);
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`;
};

export function gradeAcwr(r) {
  if (r == null) return { label: 'Málo dat', tone: 'low' };
  // Pod 0,8 může být plánovaný deload i ztráta formy — rozhodne kontext, ne číslo
  if (r < 0.8) return { label: 'Zátěž klesá', tone: 'low' };
  if (r <= 1.3) return { label: 'Bezpečné pásmo', tone: 'ok' };
  if (r <= 1.5) return { label: 'Zvýšené riziko', tone: 'warn' };
  return { label: 'Skok v zátěži', tone: 'bad' };
}

/**
 * Souhrn bloku: agreguje položky po týdnech a cvicích.
 * entries: [{ date, lift, sets, reps, weight, rpe }]
 * e1rms:   { squat: 200, bench: 140, deadlift: 240 }
 *
 * Tonáž počítá všechno včetně doplňků. Intenzita, INOL a Prilepinovy zóny
 * dávají smysl jen tam, kde známe 1RM — doplňkové cviky se do nich nepletou.
 */
export function analyzeBlock(entries, e1rms, startDate, variants = {}) {
  const weekOf = (d) => (startDate ? Math.floor(daysBetween(startDate, d) / 7) + 1 : 1);

  const weeks = new Map();
  const byLift = new Map();
  const loadsByDay = {};

  for (const e of entries) {
    const w = Math.max(1, weekOf(e.date));
    const e1 = entryE1rm(e, e1rms, variants);
    const measured = e1 > 0;
    const int = measured ? intensity(e, e1) : 0;
    const ton = tonnage(e);
    const reps = nl(e);

    loadsByDay[e.date] = (loadsByDay[e.date] ?? 0) + ton;

    if (!weeks.has(w)) {
      weeks.set(w, {
        week: w, tonnage: 0, nl: 0, nlMain: 0, inol: 0, intSum: 0, peak: 0, hardSets: 0,
        sessions: new Set(), measuredLifts: new Set(),
        zones: Object.fromEntries(PRILEPIN.map((z) => [z.key, 0])), lifts: {},
      });
    }
    const wk = weeks.get(w);
    wk.tonnage += ton;
    wk.nl += reps;
    wk.sessions.add(e.date);
    wk.lifts[e.lift] = (wk.lifts[e.lift] ?? 0) + ton;
    if (measured) {
      wk.nlMain += reps;
      wk.intSum += int * reps;
      wk.inol += inol(reps, int);
      wk.zones[prilepinZone(int).key] += reps;
      wk.measuredLifts.add(e.lift);
      wk.peak = Math.max(wk.peak, int);
      if (isHardSet(e, e1)) wk.hardSets += e.sets;
    }

    if (!byLift.has(e.lift)) {
      byLift.set(e.lift, { lift: e.lift, measured, tonnage: 0, nl: 0, nlMain: 0, inol: 0, intSum: 0, top: 0, weeks: new Set() });
    }
    const lf = byLift.get(e.lift);
    lf.tonnage += ton;
    lf.nl += reps;
    lf.top = Math.max(lf.top, e.weight);
    lf.weeks.add(w);
    if (measured) {
      lf.nlMain += reps;
      lf.intSum += int * reps;
      lf.inol += inol(reps, int);
    }
  }

  const weekList = [...weeks.values()]
    .sort((a, b) => a.week - b.week)
    .map((w) => ({
      ...w,
      sessions: w.sessions.size,
      mainLifts: w.measuredLifts.size,
      avgIntensity: w.nlMain ? round(w.intSum / w.nlMain, 1) : 0,
      peakIntensity: round(w.peak, 1),
      hardSetsPerLift: round(w.hardSets / Math.max(1, w.measuredLifts.size), 1),
      tonnage: round(w.tonnage),
      inol: round(w.inol, 2),
      inolPerLift: round(w.inol / Math.max(1, w.measuredLifts.size), 2),
    }));

  const liftList = [...byLift.values()].map((l) => ({
    ...l,
    weeks: l.weeks.size,
    avgIntensity: l.nlMain ? round(l.intSum / l.nlMain, 1) : 0,
    tonnage: round(l.tonnage),
    inol: round(l.inol, 2),
    inolPerWeek: round(l.inol / Math.max(1, l.weeks.size), 2),
  }));

  const totalNlMain = weekList.reduce((s, w) => s + w.nlMain, 0);
  const totalIntSum = weekList.reduce((s, w) => s + w.intSum, 0);

  return {
    weeks: weekList,
    lifts: liftList,
    mainLifts: liftList.filter((l) => l.measured),
    loadsByDay,
    total: {
      tonnage: round(weekList.reduce((s, w) => s + w.tonnage, 0)),
      nl: weekList.reduce((s, w) => s + w.nl, 0),
      nlMain: totalNlMain,
      avgIntensity: totalNlMain ? round(totalIntSum / totalNlMain, 1) : 0,
      sessions: new Set(entries.map((e) => e.date)).size,
      inol: round(weekList.reduce((s, w) => s + w.inol, 0), 2),
      inolPerLiftWeek: round(
        weekList.reduce((s, w) => s + w.inolPerLift, 0) / Math.max(1, weekList.length), 2),
    },
  };
}

/**
 * Kontrolní seznam nad výsledkem analýzy — u každé sledované věci appka řekne,
 * jestli je v pořádku, nebo ne. Ne jen samá varování s jednou souhrnnou
 * hláškou na konci: kouč má vidět i to, co v bloku sedí, ne jen co nesedí.
 *
 * ACWR se tu záměrně nepočítá (viz vysvětlivky, heslo „Co v appce záměrně
 * není") — appka navíc vidí jen entries aktuálního bloku, ne souvislou
 * historii závodníka. I naprosto rovná, neměnící se zátěž na začátku
 * každého nového bloku proto vychází jako „skok v zátěži" jen proto, že
 * appka nezná týdny před blokem — číslo by lhalo, ne radilo.
 *
 * liftLabel dovolí pojmenovat cvik česky, aniž by calc.js znal texty UI.
 */
export function blockFlags(analysis, liftLabel = (k) => k) {
  const flags = [];
  const lastWeek = analysis.weeks.at(-1)?.week;
  const measuredWeeks = analysis.weeks.filter((w) => w.mainLifts);

  /* ---- objem: tvrdé série na cvik a týden ---- */
  let volumeIssue = false;
  for (const w of measuredWeeks) {
    const sets = w.hardSetsPerLift ?? 0;

    if (sets >= 18) {
      flags.push({ tone: 'bad', text: `Týden ${w.week}: ${num2(sets, 1)} tvrdých sérií na hlavní cvik. Nad 18 se to už nedá odregenerovat — uber sérii nebo sjeď intenzitu.` });
      volumeIssue = true;
    } else if (sets >= 12) {
      flags.push({ tone: 'warn', text: `Týden ${w.week}: ${num2(sets, 1)} tvrdých sérií na hlavní cvik. Vysoká zátěž, nedávej ji dva týdny po sobě.` });
      volumeIssue = true;
    } else if (w.peakIntensity >= 90 && sets < 3) {
      flags.push({ tone: 'warn', text: `Týden ${w.week}: špička ${num2(w.peakIntensity, 0)} % z 1RM při ${num2(sets, 1)} tvrdých sériích. Objem je nízký, ale nervová soustava dostává zabrat — po takovém týdnu potřebuje závodník víc spánku, ne víc práce.` });
    } else if (sets < 1 && w.peakIntensity < 85 && w.week !== lastWeek && w.week !== 1) {
      // úvodní a poslední týden mají být lehké — hlásit se má jen propad uprostřed
      flags.push({ tone: 'low', text: `Týden ${w.week}: jen ${num2(sets, 1)} tvrdých sérií a špička ${num2(w.peakIntensity, 0)} %. Uprostřed bloku je to na adaptaci málo.` });
      volumeIssue = true;
    }
  }
  if (!volumeIssue && measuredWeeks.length) {
    const avgSets = measuredWeeks.reduce((s, w) => s + (w.hardSetsPerLift ?? 0), 0) / measuredWeeks.length;
    flags.push({ tone: 'ok', text: `Objem sedí: v průměru ${num2(avgSets, 1)} tvrdých sérií na cvik a týden, žádný týden nepřestřelil ani nepropadl.` });
  }

  /* ---- skok objemu mezi týdny ---- */
  let jumpIssue = false;
  for (let i = 1; i < analysis.weeks.length; i++) {
    const prev = analysis.weeks[i - 1];
    const cur = analysis.weeks[i];
    if (prev.tonnage > 0) {
      const jump = (cur.tonnage - prev.tonnage) / prev.tonnage;
      if (jump > 0.3) {
        flags.push({ tone: 'warn', text: `Objem skočil o ${Math.round(jump * 100)} % mezi týdnem ${prev.week} a ${cur.week}. Bezpečný přírůstek je do 10 % týdně.` });
        jumpIssue = true;
      }
    }
  }
  if (!jumpIssue && analysis.weeks.length >= 2) {
    flags.push({ tone: 'ok', text: 'Objem mezi týdny neskáče — největší mezitýdenní nárůst je v bezpečném pásmu.' });
  }

  /* ---- průměrná intenzita po cvicích ---- */
  for (const l of analysis.mainLifts) {
    if (!(l.avgIntensity > 0)) continue;
    if (l.avgIntensity < 65) {
      flags.push({ tone: 'low', text: `${liftLabel(l.lift)}: průměrná intenzita ${num2(l.avgIntensity, 1)} %. Na rozvoj síly je to málo, sedí spíš do objemové fáze.` });
    } else if (l.avgIntensity >= 87) {
      flags.push({ tone: 'warn', text: `${liftLabel(l.lift)}: průměrná intenzita ${num2(l.avgIntensity, 1)} %. Dlouhodobě to jede přes CNS — hlídej techniku a spánek.` });
    } else {
      flags.push({ tone: 'ok', text: `${liftLabel(l.lift)}: průměrná intenzita ${num2(l.avgIntensity, 1)} % — udržitelné pásmo na rozvoj síly.` });
    }
  }

  /* ---- taper ---- */
  if (analysis.weeks.length >= 3) {
    const t = taperCheck(analysis.weeks);
    if (t) {
      if (t.drop < 30) {
        // záporný drop znamená, že objem naopak narostl — „ubral −2 %" je nesmysl
        const zmena = t.drop < 0
          ? `naopak přidal ${num2(-t.drop, 0)} % objemu`
          : `ubral jen ${num2(t.drop, 0)} % objemu`;
        flags.push({ tone: 'warn', text: `Poslední týden ${zmena}. Před testem nebo závodem se snižuje o 41 až 50 % při zachované intenzitě.` });
      } else if (!t.intensityKept) {
        flags.push({ tone: 'warn', text: `Objem klesl o ${num2(t.drop, 0)} %, ale spadla i intenzita. Při vrcholení se od těžkých vah neodchází — jinak přijdeš o formu, ne o únavu.` });
      } else if (t.drop > 65) {
        flags.push({ tone: 'warn', text: `Poslední týden ubral ${num2(t.drop, 0)} % objemu — víc, než doporučuje výzkum (41–50 %). Tolik odpočinku může stát formu stejně jako moc práce.` });
      } else {
        flags.push({ tone: 'ok', text: `Poslední týden ubral ${num2(t.drop, 0)} % objemu a držel intenzitu — sedí to na taper.` });
      }
    }
  }

  return flags.slice(0, 8);
}

const num2 = (v, d = 2) => (v == null ? '—' : String(round(v, d)).replace('.', ','));

/* =========================================================
   Plán versus realita
   ========================================================= */

/**
 * E1RM ze skutečně odvedené série.
 * Tohle je v RTS hlavní signál: nesleduje se, kolik kilogramů se nazvedalo,
 * ale jak se chová odhad maxima. Když stejná váha na stejná opakování jede
 * na vyšší RPE, forma klesá — i bez jediného testu.
 */
export function setE1rm(e) {
  const rpe = e.actualRpe ?? e.rpe;
  const w = liftedWeight(e);
  const r = liftedReps(e);
  if (!(w > 0) || !(r > 0) || !(rpe > 0)) return null;
  const v = E1RM.rpe(w, r, rpe);
  return v == null ? null : round(v, 1);
}

/**
 * Porovnání plánu se skutečností, položka po položce — a to na obou osách,
 * na kterých se trénink může rozejít s plánem: kolik se naložilo a jak těžké
 * to bylo. Kladná odchylka RPE znamená, že série byla těžší, než měla být;
 * kladná odchylka váhy, že se naložilo víc, než bylo napsané.
 */
export function planVsActual(entries) {
  return entries
    .filter((e) => e.actualRpe != null || e.actualWeight != null)
    .map((e) => {
      const plan = e.rpe == null ? null : E1RM.rpe(e.weight, e.reps, e.rpe);
      return {
        ...e,
        planWeight: round(e.weight, 2),
        realWeight: round(liftedWeight(e), 2),
        weightDelta: round(liftedWeight(e) - e.weight, 2),
        rpeDelta: e.actualRpe != null && e.rpe != null ? round(e.actualRpe - e.rpe, 1) : null,
        e1rmPlan: plan == null ? null : round(plan, 1),
        e1rmReal: setE1rm(e),
      };
    });
}

/**
 * Doporučená úprava příštího týdne podle skutečného výkonu.
 *
 * rpeCreep/gradeCreep řeknou, že týden šel na vyšší RPE, než měl — tohle
 * jde o krok dál a řekne o kolik procent přepočítat váhy dál. Princip je
 * stejný, jako appka používá při duplikaci bloku na jiného závodníka
 * (relativní intenzita se přenese na nové maximum): tady se stejná logika
 * použije v čase — z toho, jak se aktuálně choval odhad maxima, se
 * přepočítá plán na příště, místo aby zůstal u čísla z počátku bloku.
 * Poměr < 1 znamená, že příští týden vyjde levnější; > 1, že jde přidat.
 */
export function weeklyAdjustment(entries, lift, week, startDate) {
  const weekOf = (d) => Math.max(1, Math.floor(daysBetween(startDate, d) / 7) + 1);
  const done = entries.filter((e) => e.lift === lift && e.actualRpe != null && weekOf(e.date) === week);
  if (!done.length) return null;

  const pairs = done
    .map((e) => ({ plan: E1RM.rpe(e.weight, e.reps, e.rpe), real: setE1rm(e) }))
    .filter((p) => p.plan != null && p.real != null);
  if (!pairs.length) return null;

  const avgPlan = pairs.reduce((s, p) => s + p.plan, 0) / pairs.length;
  const avgReal = pairs.reduce((s, p) => s + p.real, 0) / pairs.length;
  return {
    n: pairs.length,
    avgPlan: round(avgPlan, 1),
    avgReal: round(avgReal, 1),
    ratio: round(avgReal / avgPlan, 4),
    pctChange: round((avgReal / avgPlan - 1) * 100, 1),
  };
}

/**
 * Jak nespolehlivé je nahlášené RPE při dané relativní intenzitě.
 *
 * Zourdos a kol. (2016) naměřili u zkušených dřepařů směrodatnou odchylku
 * 0,32 bodu při 100 % maxima, ale 1,18 při 60 %. Mezi tabulkovými body se
 * interpoluje lineárně, za krajními se drží krajní hodnota.
 */
export function rpeSd(pct) {
  if (!(pct > 0)) return RPE_SD_BY_PCT[0][1];
  const t = RPE_SD_BY_PCT;
  if (pct <= t[0][0]) return t[0][1];
  if (pct >= t.at(-1)[0]) return t.at(-1)[1];
  for (let i = 0; i < t.length - 1; i++) {
    const [p0, s0] = t[i];
    const [p1, s1] = t[i + 1];
    if (pct >= p0 && pct <= p1) return s0 + ((s1 - s0) * (pct - p0)) / (p1 - p0);
  }
  return t.at(-1)[1];
}

/**
 * Odhad maxima ze série i s tím, jak přesný ten odhad je.
 *
 * Nejistota se nebere odhadem, ale spočítá se: RPE se posune o svou
 * směrodatnou odchylku nahoru a dolů a z rozdílu vyjde, o kolik kilogramů
 * se odhad rozhoupe. Relativní intenzita, podle které se ta odchylka hledá,
 * plyne přímo z tabulky (opakování × RPE → procento), takže k tomu není
 * potřeba znát maximum — jinak by výpočet byl kruhový.
 */
export function setE1rmWithError(e) {
  const rpe = e.actualRpe ?? e.rpe;
  const w = liftedWeight(e);
  const r = liftedReps(e);
  if (!(w > 0) || !(r > 0) || !(rpe > 0)) return null;

  const value = E1RM.rpe(w, r, rpe);
  if (value == null) return null;

  const pct = rpeToPct(r, rpe);
  const sd = rpeSd(pct);
  const hi = E1RM.rpe(w, r, Math.max(1, rpe - sd));
  const lo = E1RM.rpe(w, r, Math.min(10, rpe + sd));
  // krajní kombinace vypadnou z tabulky — pak zbyde aspoň polovina rozpětí
  const spread = hi != null && lo != null ? Math.abs(hi - lo) / 2 : Math.abs(value) * 0.05;

  return {
    value: round(value, 1),
    sd: round(Math.max(spread, 0.5), 2),
    pct: round(pct, 1),
    rpe,
    reps: r,
  };
}

/**
 * Maximum dne z několika sérií — vážené podle spolehlivosti, ne to nejvyšší.
 *
 * Dřív se z jednoho dne brala nejlepší série. Maximum z několika zašuměných
 * odhadů je ale systematicky nadhodnocené: je to extrémní hodnota, ne odhad
 * středu. Čím víc sérií se zapíše, tím vyšší číslo z toho vyjde, i když se
 * síla nezměnila vůbec.
 *
 * Správně se odhady váží obráceně k jejich rozptylu — trojka na RPE 9 nese
 * mnohem víc informace než desítka na RPE 6 a má tomu odpovídat její váha:
 *
 *   maximum = Σ(hodnota ÷ σ²) ÷ Σ(1 ÷ σ²)
 *   chyba   = 1 ÷ √Σ(1 ÷ σ²)
 *
 * Vedle váženého odhadu se vrací i to nejvyšší, aby šlo vidět, o kolik se
 * ta dvě čísla liší.
 */
export function sessionE1rm(entries) {
  const est = entries.map(setE1rmWithError).filter(Boolean);
  if (!est.length) return null;

  let wSum = 0;
  let vSum = 0;
  for (const x of est) {
    const w = 1 / x.sd ** 2;
    wSum += w;
    vSum += x.value * w;
  }
  if (!(wSum > 0)) return null;

  const weighted = vSum / wSum;
  const best = Math.max(...est.map((x) => x.value));
  return {
    n: est.length,
    weighted: round(weighted, 1),
    se: round(1 / Math.sqrt(wSum), 2),
    best: round(best, 1),
    // o kolik by nejlepší série nadhodnotila proti váženému odhadu
    bias: round(best - weighted, 1),
    sets: est,
  };
}

/* =========================================================
   Relativní intenzita k dennímu maximu
   ========================================================= */

/**
 * Procenta z toho, co závodník zvládal *ten den* — ne z maxima na papíře.
 *
 * Tohle je vlastní jádro metody RTS a appka ho dosud nepoužívala: počítala
 * všechno jako procento z 1RM. Rozdíl je podstatný. Naplánovaných 170 kg je
 * pořád 85 % z dvousetkilového maxima, ať je člověk čerstvý nebo rozbitý.
 * Proti dennímu maximu to ale ve špatný den může být 92 % — a právě proto
 * ta série jede na RPE 9 místo 8.
 *
 * Absolutní intenzita říká, co bylo v plánu. Relativní říká, co to pro
 * závodníka toho dne doopravdy znamenalo. Rozdíl mezi nimi je jméno pro to,
 * čemu se říká „špatný den".
 */
export function relativeIntensity(entries, e1rms = {}, variants = {}) {
  const byKey = new Map();
  for (const e of entries) {
    if (e.actualRpe == null) continue;
    const key = `${e.date}|${e.lift}|${e.variant ?? ''}`;
    if (!byKey.has(key)) byKey.set(key, []);
    byKey.get(key).push(e);
  }

  const out = [];
  for (const [key, group] of byKey) {
    const day = sessionE1rm(group);
    if (!day) continue;
    const [date, lift, variant] = key.split('|');
    const planned = entryE1rm(group[0], e1rms, variants);

    for (const e of group) {
      const w = liftedWeight(e);
      out.push({
        date,
        lift,
        variant: variant || null,
        weight: round(w, 2),
        dayMax: day.weighted,
        absolute: planned > 0 ? round((w / planned) * 100, 1) : null,
        relative: round((w / day.weighted) * 100, 1),
      });
    }
  }

  return out.sort((a, b) => a.date.localeCompare(b.date));
}

/**
 * Souhrn po dnech: o kolik se relativní intenzita rozešla s absolutní.
 *
 * Kladný rozdíl znamená, že série byly ten den těžší, než plán čekal —
 * denní maximum bylo pod papírovým. Záporný, že šlo o dobrý den.
 *
 * Procenta se přes cviky průměrovat dají, protože obě jsou normalizovaná —
 * 85 % dřepu a 85 % benče znamenají totéž. Denní maximum v kilech ale ne:
 * ve dni, kde se dřepalo i benčovalo, žádné jedno „maximum dne" neexistuje.
 * Proto se `dayMax` vrací jen tehdy, když měl den jediný cvik, a jinak je
 * null — lepší nic, než číslo, které patří jinam.
 */
export function intensityGap(entries, e1rms = {}, variants = {}) {
  const rows = relativeIntensity(entries, e1rms, variants).filter((r) => r.absolute != null);
  const byDay = new Map();
  for (const r of rows) {
    if (!byDay.has(r.date)) byDay.set(r.date, { date: r.date, absSum: 0, relSum: 0, n: 0, maxes: new Map() });
    const d = byDay.get(r.date);
    d.absSum += r.absolute;
    d.relSum += r.relative;
    d.n++;
    d.maxes.set(`${r.lift}|${r.variant ?? ''}`, r.dayMax);
  }
  return [...byDay.values()].map((d) => ({
    date: d.date,
    lifts: d.maxes.size,
    dayMax: d.maxes.size === 1 ? [...d.maxes.values()][0] : null,
    absolute: round(d.absSum / d.n, 1),
    relative: round(d.relSum / d.n, 1),
    gap: round((d.relSum - d.absSum) / d.n, 1),
  }));
}

export function gradeIntensityGap(gap) {
  if (gap == null) return { label: 'Bez dat', tone: 'low', note: 'Potřeba zapsané skutečné RPE.' };
  if (gap >= 5) return { label: 'Špatný den', tone: 'bad', note: 'Denní maximum bylo výrazně pod papírovým — série byly relativně mnohem těžší, než plán čekal.' };
  if (gap >= 2) return { label: 'Těžší den', tone: 'warn', note: 'Závodník byl pod svým obvyklým stavem. Jednou se to stane, opakovaně je to signál.' };
  if (gap <= -2) return { label: 'Dobrý den', tone: 'ok', note: 'Denní maximum bylo nad papírovým — plán byl relativně lehčí, než měl být. Dá se přitlačit.' };
  return { label: 'Podle plánu', tone: 'ok', note: 'Denní maximum sedí na to, s čím plán počítal.' };
}

/**
 * Únavové procento podle RTS: o kolik klesl odhad maxima od nejlepší série
 * dne. Počítá se zvlášť pro každý cvik a den — porovnávat dřep s benčem
 * nedává smysl.
 *
 * Tuchscherer bere 5 % jako běžný cíl pro pracovní sérii; nad 10 % už
 * série nepřidávají kvalitu, jen únavu.
 */
export function fatigueDrop(entries, lift, date) {
  const day = entries
    .filter((e) => e.lift === lift && e.date === date)
    .map((e) => ({ e, v: setE1rm(e) }))
    .filter((x) => x.v != null);
  if (day.length < 2) return null;

  const peak = Math.max(...day.map((x) => x.v));
  const last = day.at(-1).v;
  return { peak: round(peak, 1), last: round(last, 1), drop: round(((peak - last) / peak) * 100, 1) };
}

export function gradeFatigueDrop(pct) {
  if (pct == null) return { label: 'Málo dat', tone: 'low' };
  if (pct < 2) return { label: 'Skoro bez únavy', tone: 'low' };
  if (pct <= 6) return { label: 'Běžná dávka', tone: 'ok' };
  if (pct <= 10) return { label: 'Hodně únavy', tone: 'warn' };
  return { label: 'Přes hranu', tone: 'bad' };
}

/**
 * Posun RPE po týdnech — kolik navíc oproti plánu závodník reálně vydal.
 * Rostoucí odchylka při stejném plánu je nejčistší známka hromadící se únavy.
 */
export function rpeCreep(entries, startDate) {
  const weeks = new Map();
  for (const e of entries) {
    if (e.actualRpe == null || e.rpe == null) continue;
    const w = Math.max(1, Math.floor(daysBetween(startDate, e.date) / 7) + 1);
    if (!weeks.has(w)) weeks.set(w, { week: w, sum: 0, n: 0, harder: 0, easier: 0 });
    const row = weeks.get(w);
    const d = e.actualRpe - e.rpe;
    row.sum += d;
    row.n++;
    if (d > 0) row.harder++;
    else if (d < 0) row.easier++;
  }
  return [...weeks.values()]
    .sort((a, b) => a.week - b.week)
    .map((w) => ({ ...w, avg: round(w.sum / w.n, 2) }));
}

export function gradeCreep(avg) {
  if (avg == null) return { label: 'Bez dat', tone: 'low' };
  if (avg <= -0.4) return { label: 'Lehčí, než plán', tone: 'low' };
  if (avg < 0.3) return { label: 'Podle plánu', tone: 'ok' };
  if (avg < 0.7) return { label: 'Těžší, než plán', tone: 'warn' };
  return { label: 'Výrazně těžší', tone: 'bad' };
}

/* =========================================================
   Vnímaná zátěž — Fosterova metoda
   ========================================================= */

/**
 * Zátěž jednotky podle session RPE.
 * Foster (2001) definoval sRPE × trvání v minutách. U silového tréninku se
 * místo minut běžně dosazuje počet sérií (McGuigan), protože délka jednotky
 * závisí hlavně na pauzách.
 *
 * RPE se tu odvozuje z jednotlivých položek, ne z toho, co závodník nahlásil
 * po tréninku — je to odhad, ne měření.
 */
export function sessionLoads(entries) {
  const byDate = {};
  for (const e of entries) {
    const rpe = e.actualRpe ?? e.rpe;
    if (!(byDate[e.date])) byDate[e.date] = { date: e.date, sets: 0, rpeSum: 0, rpeSets: 0 };
    const d = byDate[e.date];
    d.sets += e.sets;
    if (rpe > 0) { d.rpeSum += rpe * e.sets; d.rpeSets += e.sets; }
  }
  for (const d of Object.values(byDate)) {
    d.rpe = d.rpeSets ? round(d.rpeSum / d.rpeSets, 1) : null;
    d.load = d.rpe ? round(d.rpe * d.sets) : 0;
  }
  return byDate;
}

/**
 * Monotonie = průměr denní zátěže ÷ její směrodatná odchylka za 7 dní.
 * Dny volna se počítají jako nula — právě ony dělají trénink pestrým.
 * Strain = týdenní zátěž × monotonie.
 * Foster: monotonie nad 2,0 spolu s vysokou zátěží zvyšuje riziko přetížení.
 */
export function monotony(dailyLoads, endDate, days = 7) {
  const vals = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = addDaysLocal(endDate, -i);
    vals.push(dailyLoads[iso(d)] ?? 0);
  }
  const total = vals.reduce((s, v) => s + v, 0);
  if (total === 0) return { mean: 0, sd: 0, monotony: null, strain: null, total: 0 };

  const mean = total / days;
  const sd = Math.sqrt(vals.reduce((s, v) => s + (v - mean) ** 2, 0) / days);
  const mono = sd > 0 ? mean / sd : null;
  return {
    mean: round(mean),
    sd: round(sd),
    monotony: mono == null ? null : round(mono, 2),
    strain: mono == null ? null : round(total * mono),
    total: round(total),
  };
}

export function gradeMonotony(m) {
  if (m == null) return { label: 'Málo dat', tone: 'low' };
  if (m < 1.5) return { label: 'Pestrý týden', tone: 'ok' };
  if (m < 2) return { label: 'Sledovat', tone: 'warn' };
  return { label: 'Jednotvárné', tone: 'bad' };
}

/* =========================================================
   Hooperův index — kvantifikovaná pohoda
   ========================================================= */

/**
 * Hooper a Mackinnon (1995): čtyři položky — spánek, stres, únava,
 * bolestivost svalů — každá na škále 1 (velmi dobré/nízké) až 7 (velmi
 * špatné/vysoké). Součet 4–28 předpověděl v jejich studii u plavců 76 %
 * rozptylu fyziologických markerů přetrénování. Na rozdíl od RPE neřeší
 * jen trénink — zachytí i to, co se do posilovny přineslo zvenku.
 */
export function hooperIndex(w) {
  const vals = [w.sleep, w.stress, w.fatigue, w.soreness];
  if (vals.some((v) => !(v >= 1 && v <= 7))) return null;
  return vals.reduce((s, v) => s + v, 0);
}

/**
 * Hooperův index se validoval jako individuální monitorovací nástroj, ne
 * jako škála s pevnými prahy pro celou populaci — appka ho proto čte proti
 * vlastnímu klouzavému průměru posledních záznamů, ne proti univerzálnímu
 * číslu. days = kolik předchozích záznamů se bere do průměru.
 */
export function hooperBaseline(history, date, days = 7) {
  const past = history
    .filter((w) => w.date < date)
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, days)
    .map(hooperIndex)
    .filter((v) => v != null);
  if (!past.length) return null;
  return round(past.reduce((s, v) => s + v, 0) / past.length, 1);
}

export function gradeHooper(today, baseline) {
  if (today == null) return { label: 'Bez dat', tone: 'low' };
  if (baseline == null) return { label: 'První záznam', tone: 'low' };
  const diff = round(today - baseline, 1);
  // ±2 body je appkou zvolený orientační práh, ne publikovaná hranice —
  // Hooperův index nemá žádnou obecně platnou.
  if (diff >= 2) return { label: 'Hůř než obvykle', tone: 'warn', diff };
  if (diff <= -2) return { label: 'Lépe než obvykle', tone: 'ok', diff };
  return { label: 'Podle obvyklého', tone: 'ok', diff };
}

/* =========================================================
   Tvrdé série
   ========================================================= */

/**
 * Tvrdá série = série blízko selhání, která reálně tvoří podnět.
 * Bere se RPE ≥ 7 (tři a méně opakování v záloze), u položek bez RPE
 * intenzita ≥ 70 % z E1RM.
 */
export const isHardSet = (e, e1rm) => {
  const rpe = e.actualRpe ?? e.rpe;
  if (rpe > 0) return rpe >= 7;
  return e1rm > 0 && intensity(e, e1rm) >= 70;
};

/** Tvrdé série po týdnech a cvicích. */
export function hardSets(entries, e1rms, startDate, variants = {}) {
  const weeks = new Map();
  for (const e of entries) {
    const e1 = entryE1rm(e, e1rms, variants);
    if (!isHardSet(e, e1)) continue;
    const w = Math.max(1, Math.floor(daysBetween(startDate, e.date) / 7) + 1);
    if (!weeks.has(w)) weeks.set(w, {});
    const row = weeks.get(w);
    row[e.lift] = (row[e.lift] ?? 0) + e.sets;
  }
  return [...weeks.entries()].sort((a, b) => a[0] - b[0]).map(([week, lifts]) => ({ week, lifts }));
}

/* =========================================================
   Těžké expozice
   ========================================================= */

export const EXPOSURE_THRESHOLDS = [85, 90, 95];

/**
 * Těžké expozice — kolikrát (kolik samostatných dnů u daného cviku) se
 * série dotkla dané hranice intenzity nebo šla nad ni. Bloková periodizace
 * počítá s tím, že akumulace má expozic málo a realizace před závodem hodně —
 * appka tohle jen počítá, žádná hranice tu není bezpečná/nebezpečná sama
 * o sobě, jde o to, jestli nárůst k vrcholu bloku vůbec nastal.
 *
 * Exposice = samostatný den u cviku (ne série) — pár sérií nad 90 % ve
 * stejné jednotce je pořád jedna "těžká expozice", ne tři.
 */
export function heavyExposures(entries, e1rms, startDate, variants = {}) {
  const weeks = new Map();
  for (const e of entries) {
    const e1 = entryE1rm(e, e1rms, variants);
    if (!(e1 > 0)) continue;
    const pct = intensity(e, e1);
    const w = Math.max(1, Math.floor(daysBetween(startDate, e.date) / 7) + 1);
    if (!weeks.has(w)) {
      weeks.set(w, {
        week: w,
        sessions: Object.fromEntries(EXPOSURE_THRESHOLDS.map((t) => [t, new Set()])),
        sets: Object.fromEntries(EXPOSURE_THRESHOLDS.map((t) => [t, 0])),
      });
    }
    const wk = weeks.get(w);
    for (const t of EXPOSURE_THRESHOLDS) {
      if (pct < t) continue;
      wk.sessions[t].add(`${e.date}|${e.lift}`);
      wk.sets[t] += e.sets;
    }
  }
  return [...weeks.values()]
    .sort((a, b) => a.week - b.week)
    .map((w) => ({
      week: w.week,
      exposures: Object.fromEntries(EXPOSURE_THRESHOLDS.map((t) => [t, w.sessions[t].size])),
      sets: Object.fromEntries(EXPOSURE_THRESHOLDS.map((t) => [t, w.sets[t]])),
    }));
}

/* =========================================================
   Taper
   ========================================================= */

/**
 * Kontrola vrcholení. Systematický přehled (Grgic a Mikulic 2020) a průzkum
 * mezi 364 závodníky: krokový taper 7–10 dní se snížením objemové zátěže
 * o 41–50 % při zachované intenzitě.
 */
export function taperCheck(weeks) {
  if (weeks.length < 2) return null;
  const last = weeks.at(-1);
  const prev = weeks.at(-2);
  if (!prev.tonnage) return null;

  const drop = ((prev.tonnage - last.tonnage) / prev.tonnage) * 100;
  const intensityKept = last.avgIntensity >= prev.avgIntensity - 3;

  let tone = 'ok';
  let label = 'Sedí na taper';
  if (drop < 30) { tone = 'warn'; label = 'Málo ubráno'; }
  else if (drop > 65) { tone = 'warn'; label = 'Ubráno moc'; }
  if (!intensityKept && drop >= 30) { tone = 'warn'; label = 'Spadla intenzita'; }

  return { drop: round(drop, 0), intensityKept, tone, label };
}

/* =========================================================
   APRE — Autoregulatory Progressive Resistance Exercise
   ========================================================= */

/**
 * Mann, Thyfault, Ivey, Sayers (2010): místo pevných kilo předem se série 3
 * jede na AMRAP (co nejvíc opakování) na 100 % odhadovaného šestiopakovacího
 * maxima. Podle skutečných opakování appka dopočítá váhu série 4 i doporučený
 * start příště. Jiný princip než RPE/RTS — tady rozhoduje počet opakování
 * proti cíli, ne subjektivní pocit.
 */
export function apreRamp(sixRm) {
  return [
    { set: 1, pct: 50, reps: 10, weight: roundToBar(sixRm * 0.5) },
    { set: 2, pct: 75, reps: 6, weight: roundToBar(sixRm * 0.75) },
    { set: 3, pct: 100, reps: null, weight: roundToBar(sixRm) },
  ];
}

/**
 * Pásma jsou procentní adaptace originální (librové, na konkrétní stroje)
 * tabulky z originální studie — napříč cviky a v kilogramech dávají smysl
 * jen jako procenta z aktuálního 6RM, ne jako pevné přírůstky v kg.
 */
export const APRE_BANDS = [
  { max: 2, adjust: -0.10, label: '0–2 opakování' },
  { max: 4, adjust: -0.05, label: '3–4 opakování' },
  { max: 7, adjust: 0, label: '5–7 opakování' },
  { max: 12, adjust: 0.05, label: '8–12 opakování' },
  { max: Infinity, adjust: 0.10, label: '13 a víc opakování' },
];

/** Váha série 4 (a doporučený start příště) podle opakování dosažených na sérii 3. */
export function apreAdjust(sixRm, repsAchieved) {
  const band = APRE_BANDS.find((b) => repsAchieved <= b.max) ?? APRE_BANDS.at(-1);
  return {
    label: band.label,
    adjustPct: round(band.adjust * 100, 0),
    weight: roundToBar(sixRm * (1 + band.adjust)),
  };
}

/* =========================================================
   Výsledky ze zápasu
   ========================================================= */

/**
 * Součet ze zápasu — z každého cviku se počítá nejtěžší povedený pokus.
 * Neplatný pokus se do součtu nepočítá, i kdyby byl na papíře těžší.
 * attempts: [{ lift, weight, made }]
 */
export function meetTotal(attempts) {
  const best = {};
  for (const a of attempts) {
    if (!a.made || !(a.weight > 0)) continue;
    best[a.lift] = Math.max(best[a.lift] ?? 0, a.weight);
  }
  return Object.values(best).reduce((s, w) => s + w, 0);
}

/**
 * Úspěšnost pokusů — kolik z devíti (nebo míň, pokud cvik chybí) sedlo.
 * Rozbor MS IPF: vítězové dávají v průměru 8,46 z 9 pokusů, průměrný
 * závodník 6,66 z 9 — je to metrika, kterou špičkoví koučové sledují
 * napříč víc zápasy, ne jen v rámci jednoho.
 */
export function meetSuccessRate(attempts) {
  const valid = attempts.filter((a) => a.weight > 0);
  if (!valid.length) return null;
  const made = valid.filter((a) => a.made).length;
  return { made, total: valid.length, pct: round((made / valid.length) * 100, 0) };
}

/* =========================================================
   Závodní skóre
   ========================================================= */

export function dots(total, bw, sex = 'm') {
  const c = DOTS_COEF[sex];
  if (!(bw > 0) || !(total > 0)) return null;
  const b = Math.min(Math.max(bw, 40), sex === 'm' ? 210 : 150);
  const denom = c[0] + c[1] * b + c[2] * b ** 2 + c[3] * b ** 3 + c[4] * b ** 4;
  return denom > 0 ? round((total * 500) / denom, 2) : null;
}

export function ipfGL(total, bw, sex = 'm', equipment = 'classic', event = 'total') {
  const [A, B, C] = IPF_GL_COEF[sex][equipment][event];
  // IPF vzorec je regresí na dospělých závodnících — pod 35 kg nedává smysl
  if (!(bw >= 35) || !(total > 0)) return null;
  const denom = A - B * Math.exp(-C * bw);
  return denom > 0 ? round(total * (100 / denom), 2) : null;
}

// Meze podle referenční implementace OpenPowerlifting: horní brání asymptotě
// polynomu, dolní obřím koeficientům u dětských vah.
const WILKS_RANGE = { m: [40, 201.9], f: [26.51, 154.53] };

export function wilks(total, bw, sex = 'm') {
  const c = WILKS_COEF[sex];
  if (!(bw > 0) || !(total > 0)) return null;
  const [lo, hi] = WILKS_RANGE[sex];
  const b = Math.min(Math.max(bw, lo), hi);
  const denom = c.reduce((s, k, i) => s + k * b ** i, 0);
  return denom > 0 ? round((total * 500) / denom, 2) : null;
}

/** Do jaké váhové kategorie závodník patří a kolik kg zbývá do limitu. */
export function weightClass(bw, sex = 'm') {
  const classes = WEIGHT_CLASSES[sex];
  const idx = classes.findIndex((c) => bw <= c);
  const limit = classes[idx];
  const below = idx > 0 ? classes[idx - 1] : null;
  return {
    label: limit === Infinity ? `${classes.at(-2)}+ kg` : `do ${limit} kg`,
    limit,
    headroom: limit === Infinity ? null : round(limit - bw, 2),
    cutTo: below ? round(bw - below, 2) : null,
    cutLabel: below ? `do ${below} kg` : null,
  };
}

/* =========================================================
   Závodní den
   ========================================================= */

/** Tři pokusy z E1RM podle strategie. */
export function attempts(e1rm, pct, unit = 'kg') {
  const step = unit === 'lb' ? 5 : 2.5;
  return pct.map((p) => roundToBar(e1rm * p, { step }));
}

/**
 * Rozcvičovací žebřík k prvnímu pokusu.
 * Procenta z otvíráku, poslední skok je malý — nesmí unavit.
 */
export function warmupLadder(opener, bar = 20, unit = 'kg') {
  const step = unit === 'lb' ? 5 : 2.5;
  const plan = [
    { pct: 0.4, reps: 5, rest: 2 },
    { pct: 0.55, reps: 3, rest: 3 },
    { pct: 0.7, reps: 2, rest: 3 },
    { pct: 0.82, reps: 1, rest: 4 },
    { pct: 0.91, reps: 1, rest: 5 },
  ];
  const sets = plan.map((p) => ({
    weight: Math.max(bar, roundToBar(opener * p.pct, { step })),
    reps: p.reps,
    rest: p.rest,
  }));
  const totalMin = sets.reduce((s, x) => s + x.rest, 0) + 4;
  return { sets, totalMin };
}

/* =========================================================
   Trendy
   ========================================================= */

/** Lineární regrese — vrací sklon za den a projekci. */
export function trend(points) {
  const n = points.length;
  if (n < 2) return null;
  const t0 = new Date(points[0].date).getTime();
  const xs = points.map((p) => (new Date(p.date).getTime() - t0) / 86400000);
  const ys = points.map((p) => p.value);
  const mx = xs.reduce((a, b) => a + b) / n;
  const my = ys.reduce((a, b) => a + b) / n;
  const num = xs.reduce((s, x, i) => s + (x - mx) * (ys[i] - my), 0);
  const den = xs.reduce((s, x) => s + (x - mx) ** 2, 0);
  if (den === 0) return null;
  const slope = num / den;
  return {
    perWeek: round(slope * 7, 2),
    perMonth: round(slope * 30, 1),
    intercept: my - slope * mx,
    slope,
  };
}

/**
 * Je ten sklon trendu reálný posun, nebo jen šum kolem nuly?
 * Neporovnává se s vymyšlenou hranicí v kg za měsíc — bere se rozptyl
 * bodů kolem proložené přímky (typický šum jednotlivých odhadů E1RM) a
 * porovná se s tím, o kolik se přímka za celé sledované období posunula.
 * Pohne-li se přímka míň, než je běžný rozptyl bodů kolem ní, není to
 * prokazatelný trend — přesně ten samý princip jako u statistické
 * významnosti signálu proti šumu, jen bez p-hodnoty. Potřebuje aspoň tři
 * body — se dvěma padne přímka přesně na ně a šum vyjde nulový.
 */
/** Kritická hodnota t pro 95% oboustranný interval. */
export const tCrit95 = (df) => (df <= 0 ? T95[0] : df <= 30 ? T95[df - 1] : 1.96);

/**
 * Trend i s tím, jak jistý si jím vůbec můžeme být.
 *
 * `trend()` vrátí sklon, ale sklon spočítaný ze šesti bodů je sám o sobě
 * odhad se svou vlastní nejistotou. Interval spolehlivosti říká, v jakém
 * rozmezí ten skutečný sklon leží — a jestli mezi ně patří i nula. Pokud
 * ano, data neumí rozhodnout, jestli se závodník zlepšuje, nebo stojí.
 *
 *   směrodatná chyba sklonu = reziduální rozptyl ÷ √Sxx
 *   interval = sklon ± t(0,95; n−2) · směrodatná chyba
 *
 * Předpovědní pás kolem přímky se rozšiřuje směrem od těžiště dat — proto
 * ta odmocnina: čím dál od průměrného data, tím míň přímka ví.
 */
export function trendWithBand(points) {
  const n = points?.length ?? 0;
  if (n < 3) return null;

  const t0 = new Date(points[0].date).getTime();
  const xs = points.map((p) => (new Date(p.date).getTime() - t0) / 86400000);
  const ys = points.map((p) => p.value);
  const mx = xs.reduce((a, b) => a + b, 0) / n;
  const my = ys.reduce((a, b) => a + b, 0) / n;
  const Sxx = xs.reduce((s, x) => s + (x - mx) ** 2, 0);
  if (Sxx === 0) return null;

  const slope = xs.reduce((s, x, i) => s + (x - mx) * (ys[i] - my), 0) / Sxx;
  const intercept = my - slope * mx;
  const resid = xs.map((x, i) => ys[i] - (intercept + slope * x));
  const se = Math.sqrt(resid.reduce((s, r) => s + r ** 2, 0) / (n - 2));
  const seSlope = se / Math.sqrt(Sxx);
  const t = tCrit95(n - 2);

  return {
    n,
    slope,
    intercept,
    residualSd: round(se, 2),
    seSlope,
    slopeCI: [slope - t * seSlope, slope + t * seSlope],
    perWeek: round(slope * 7, 2),
    perWeekCI: [round((slope - t * seSlope) * 7, 2), round((slope + t * seSlope) * 7, 2)],
    perMonth: round(slope * 30, 1),
    /** polovina šířky předpovědního pásu v daném dni od prvního zápisu */
    band: (x) => t * se * Math.sqrt(1 + 1 / n + (x - mx) ** 2 / Sxx),
    xs,
    mx,
  };
}

/**
 * Stojí to, nebo se to hýbe?
 *
 * Dřív tu bylo pravidlo, které jsem si vymyslel: „posunula se přímka za celé
 * období víc, než je rozptyl bodů kolem ní?". Fungovalo, ale je to jen
 * přibližná náhražka za věc, na kterou existuje standardní statistika.
 *
 * Teď se rozhoduje podle intervalu spolehlivosti sklonu, a to ve dvou
 * krocích, protože „nedá se to poznat" a „stojí to" jsou dvě různé odpovědi:
 *
 *   · interval obsahuje nulu  →  data neumí rozhodnout, jestli se něco děje,
 *   · posun za čtyři týdny je menší než nejmenší prokazatelná změna
 *     →  i kdyby trend byl skutečný, prakticky nic nepřinese.
 *
 * Za plateau se prohlásí jen případ, kdy platí obojí naráz. Kdyby stačila
 * první podmínka, appka by za stagnaci označila i pomalý, ale vytrvalý růst
 * u závodníka s rozházenými zápisy — a to je přesně ten člověk, kterému se
 * nemá říkat, že se nikam neposouvá.
 */
export function plateauCheck(points) {
  const t = trendWithBand(points);
  if (!t) return null;

  const [lo, hi] = t.slopeCI;
  const ciCrossesZero = lo <= 0 && hi >= 0;
  const noise = measurementNoise(points);
  const monthlyMove = Math.abs(t.slope * 28);
  const tooSmall = noise != null && monthlyMove < noise.sdc;

  return {
    ...t,
    totalMove: round(Math.abs(t.slope * (t.xs.at(-1) - t.xs[0])), 1),
    monthlyMove: round(monthlyMove, 1),
    ciCrossesZero,
    tooSmall,
    plateau: ciCrossesZero && tooSmall,
  };
}

export function gradePlateau(p) {
  if (!p) return { label: 'Málo dat', tone: 'low' };
  if (p.plateau) {
    return { label: 'Beze změny', tone: 'warn', note: 'Trend není průkazný a i kdyby byl, za čtyři týdny by nedal prokazatelnou změnu.' };
  }
  if (p.ciCrossesZero) {
    // sklon vychází kladně nebo záporně, ale interval obsahuje nulu —
    // tvrdit směr by bylo víc, než data unesou
    return { label: 'Neprůkazné', tone: 'low', note: 'Data zatím neumí rozhodnout, jestli jde výkon nahoru, nebo dolů. Přibude-li pár zápisů, vyjasní se to.' };
  }
  if (p.tooSmall) {
    return { label: p.slope > 0 ? 'Roste pomalu' : 'Klesá pomalu', tone: 'warn', note: 'Trend je průkazný, ale za čtyři týdny nedá ani nejmenší prokazatelnou změnu.' };
  }
  return { label: p.slope > 0 ? 'Roste' : 'Klesá', tone: p.slope > 0 ? 'ok' : 'bad' };
}

/* =========================================================
   Robustní trend — když jeden špatný den nemá rozhodovat
   ========================================================= */

/**
 * Theil–Sen: sklon jako medián všech párových sklonů.
 *
 * Obyčejná regrese se dá vychýlit jediným bodem — nemocí, zkaženým pokusem,
 * dnem, kdy se špatně spalo. Medián párových sklonů takový bod prostě
 * přehlasuje. Když se Theil–Sen a obyčejná regrese výrazně liší, je to samo
 * o sobě informace: v datech sedí odlehlá hodnota.
 */
export function theilSen(points) {
  const n = points?.length ?? 0;
  if (n < 3) return null;
  const t0 = new Date(points[0].date).getTime();
  const xs = points.map((p) => (new Date(p.date).getTime() - t0) / 86400000);
  const ys = points.map((p) => p.value);

  const slopes = [];
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      if (xs[j] !== xs[i]) slopes.push((ys[j] - ys[i]) / (xs[j] - xs[i]));
    }
  }
  if (!slopes.length) return null;
  const med = (arr) => {
    const a = [...arr].sort((p, q) => p - q);
    const m = a.length >> 1;
    return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2;
  };
  const slope = med(slopes);
  return {
    slope,
    intercept: med(xs.map((x, i) => ys[i] - slope * x)),
    perWeek: round(slope * 7, 2),
    perMonth: round(slope * 30, 1),
    pairs: slopes.length,
  };
}

/**
 * Mann–Kendall: existuje monotónní trend?
 *
 * Neptá se, jestli data leží na přímce — jen jestli spíš rostou, nebo spíš
 * klesají. Nepředpokládá žádný tvar ani rozdělení, takže na krátké a
 * rozházené řady sedí líp než regrese.
 */
export function mannKendall(values) {
  const n = values?.length ?? 0;
  if (n < 4) return null;
  let S = 0;
  for (let i = 0; i < n - 1; i++) {
    for (let j = i + 1; j < n; j++) S += Math.sign(values[j] - values[i]);
  }
  const varS = (n * (n - 1) * (2 * n + 5)) / 18;
  const Z = S > 0 ? (S - 1) / Math.sqrt(varS) : S < 0 ? (S + 1) / Math.sqrt(varS) : 0;
  return {
    S,
    Z: round(Z, 2),
    significant: Math.abs(Z) > 1.96,
    direction: S > 0 ? 'up' : S < 0 ? 'down' : 'flat',
  };
}

/**
 * CUSUM — kdy přesně se to zlomilo.
 *
 * Detekce plateau řekne, že se progres zastavil. Tohle řekne, ve kterém
 * zápisu. Sčítá se odchylka od průměru; dokud se hodnoty drží kolem něj,
 * součet se drží u nuly, ale jakmile se úroveň posune, začne utíkat jedním
 * směrem. Překročení prahu je poplach.
 *
 * k je mrtvé pásmo v jednotkách směrodatné odchylky (kolik se toleruje),
 * h je práh poplachu. Obojí jsou zvyklosti řízení jakosti, ne hodnoty
 * odvozené ze silového tréninku.
 */
export function cusum(points, { k = 0.5, h = 4, baseline = null } = {}) {
  const vals = points?.map((p) => (typeof p === 'number' ? p : p.value)) ?? [];
  const n = vals.length;
  if (n < 6) return null;

  // Referenční úroveň se bere z počátku řady, ne z celého průměru.
  // Kdyby se počítala ze všeho, pak by u řady, která nejdřív roste a pak
  // spadne, přišel poplach už v té rostoucí části — jen proto, že leží nad
  // celkovým průměrem. Tady se ptáme na něco jiného: kdy se výkon odchýlil
  // od toho, na co byl závodník rozjetý.
  const base = Math.max(4, Math.min(baseline ?? Math.floor(n / 2), n - 2));
  const head = vals.slice(0, base);
  const mean = head.reduce((a, b) => a + b, 0) / head.length;
  const sd = Math.sqrt(head.reduce((s, v) => s + (v - mean) ** 2, 0) / head.length);
  if (!(sd > 0)) return null;

  let cPos = 0;
  let cNeg = 0;
  const series = vals.map((v, i) => {
    const z = (v - mean) / sd;
    cPos = Math.max(0, cPos + z - k);
    cNeg = Math.min(0, cNeg + z + k);
    const alarm = i >= base && (cPos > h || cNeg < -h);
    return {
      i,
      date: typeof points[i] === 'number' ? null : points[i].date,
      value: v,
      cPos: round(cPos, 2),
      cNeg: round(cNeg, 2),
      alarm,
      direction: cNeg < -h ? 'down' : cPos > h ? 'up' : null,
    };
  });
  const first = series.find((x) => x.alarm) ?? null;
  return { series, baseline: base, mean: round(mean, 1), sd: round(sd, 2), breakAt: first };
}

/* =========================================================
   Kondice, únava a forma — dvousložkový model odezvy
   ========================================================= */

/**
 * Banisterův model (Banister a kol. 1975, Calvert a kol. 1976): jedna
 * tréninková dávka nastartuje dvě věci naráz — pomalu rostoucí a pomalu
 * odeznívající *kondici* a rychle rostoucí, rychle odeznívající *únavu*.
 * Co závodník předvede, je jejich rozdíl:
 *
 *   forma(t) = k1 · Σ zátěž(i) · e^(−(t−i)/τ1)  −  k2 · Σ zátěž(i) · e^(−(t−i)/τ2)
 *
 * Prakticky se to počítá rekurzivně, den po dni — každý den obě složky
 * odezní o svůj podíl a přičte se dnešní zátěž:
 *
 *   kondice(t) = kondice(t−1) · e^(−1/τ1) + zátěž(t)
 *   únava(t)   = únava(t−1)   · e^(−1/τ2) + zátěž(t)
 *
 * POZOR NA VÝKLAD. Konstanty τ1 = 42 a τ2 = 7 dní a poměr k2/k1 = 2 pocházejí
 * z vytrvalostních sportů; pro silový trénink individuálně nastavené hodnoty
 * publikované nejsou. Appka proto nikdy netvrdí „budeš mít 187,5 kg" — model
 * kreslí *tvar* křivky: kdy únava odezní rychleji než kondice a otevře se okno
 * formy. Číslo samo je v bezrozměrných jednotkách a má smysl jen proti
 * vlastní historii závodníka, ne proti jinému člověku.
 *
 * loadsByDay: { 'YYYY-MM-DD': zátěž }. Vrací řadu den po dni.
 */
export function fitnessFatigue(loadsByDay, endDate, { tau1 = 42, tau2 = 7, k1 = 1, k2 = 2 } = {}) {
  const days = Object.keys(loadsByDay).filter((d) => loadsByDay[d] > 0);
  if (!days.length) return [];

  const first = days.reduce((min, d) => (d < min ? d : min), days[0]);
  const span = daysBetween(first, endDate);
  if (span < 0) return [];

  const d1 = Math.exp(-1 / tau1);
  const d2 = Math.exp(-1 / tau2);

  const out = [];
  let fitness = 0;
  let fatigue = 0;

  for (let i = 0; i <= span; i++) {
    const date = iso(addDaysLocal(first, i));
    const load = loadsByDay[date] ?? 0;
    fitness = fitness * d1 + load;
    fatigue = fatigue * d2 + load;
    out.push({
      date,
      load: round(load),
      fitness: round(k1 * fitness, 1),
      fatigue: round(k2 * fatigue, 1),
      form: round(k1 * fitness - k2 * fatigue, 1),
    });
  }
  return out;
}

/**
 * Kde forma stojí v rámci vlastní historie. Absolutní hodnota nic neříká —
 * záleží, jestli je dnešek nahoře nebo dole proti tomu, na co je závodník
 * zvyklý. Percentil se počítá z posledních `window` dnů.
 */
export function formState(series, { window: win = 90 } = {}) {
  if (!series.length) return null;
  const recent = series.slice(-win);
  const today = series.at(-1);
  const sorted = recent.map((r) => r.form).sort((a, b) => a - b);
  const below = sorted.filter((v) => v < today.form).length;
  const pct = Math.round((below / Math.max(1, sorted.length - 1)) * 100);

  // Trend za poslední týden řekne, jestli se forma zvedá, nebo padá.
  const weekAgo = series.at(-8) ?? series[0];
  return {
    ...today,
    percentile: pct,
    delta7: round(today.form - weekAgo.form, 1),
    ratio: today.fitness > 0 ? round(today.fatigue / today.fitness, 2) : null,
    days: series.length,
    reliable: series.length >= 42,   // kratší historie než τ1 kondici podhodnotí
  };
}

export function gradeForm(state) {
  if (!state) return { label: 'Málo dat', tone: 'low', note: 'Zapiš aspoň pár týdnů tréninku.' };
  if (!state.reliable) {
    return { label: 'Krátká historie', tone: 'low', note: 'Model potřebuje aspoň šest týdnů dat, jinak kondici podhodnotí — únava se načte hned, kondice se teprve staví.' };
  }
  if (state.percentile >= 80) return { label: 'Nahoře', tone: 'ok', note: 'Forma je vysoko proti vlastnímu obvyklému stavu. Tady se testuje maximum nebo závodí.' };
  if (state.percentile >= 45) return { label: 'Obvyklý stav', tone: 'ok', note: 'Únava a kondice jsou v rovnováze, na kterou je závodník zvyklý. Tak vypadá běžný tréninkový týden.' };
  if (state.percentile >= 20) return { label: 'Zahrabaný', tone: 'warn', note: 'Únava přerůstá kondici. V akumulaci to tak má být — před testem ne.' };
  return { label: 'Hluboko', tone: 'bad', note: 'Forma je na dně vlastní historie. Buď je to naplánovaný nálož, nebo je čas na odlehčení.' };
}

/* =========================================================
   Šum měření — kdy je změna skutečná
   ========================================================= */

/**
 * Odhad maxima se ze dne na den houpe, i když se síla nezmění: jinak sedící
 * pás, horší spánek, RPE odhadnuté o půl bodu vedle. Než se zlepšení začne
 * slavit, musí být větší než tenhle šum.
 *
 * `typická chyba` (TE) se odhaduje jako směrodatná odchylka bodů kolem
 * proložené přímky — přímka drží skutečný trend, rozptyl kolem ní je šum
 * měření. Nejmenší prokazatelná změna (SDC, také MDC95) pak je:
 *
 *   SDC = 1,96 · √2 · TE ≈ 2,77 · TE
 *
 * 1,96 je 95% kvantil normálního rozdělení, √2 tam je proto, že rozdíl dvou
 * měření nese chybu obou. (Hopkins 2000; Weir 2005 pro MDC95.) Menší posun
 * než SDC appka odmítne prohlásit za zlepšení — může to být jen den.
 */
/**
 * Spodní mez typické chyby, v procentech z průměru.
 *
 * Bez ní by pár zápisů, které náhodou padnou na přímku, dalo nulový rozptyl
 * a appka by pak prohlásila za prokazatelné i zlepšení o 100 gramů. Žádné
 * měření není přesnější než svoje vlastní opakovatelnost.
 *
 * Publikovaná variabilita odhadu 1RM z predikčních rovnic je 4,5 až 13,2 %
 * a v platném rozsahu opakování se odhad od změřeného maxima liší zhruba
 * o ±5 %. K tomu přibývá chyba odhadu samotného RPE: Helms a kol. (2017)
 * naměřili u powerlifterů odchylku nahlášeného RPE od cíleného 0,33 ± 0,28
 * bodu.
 *
 * 3 % je tedy hranice na spodním okraji publikovaného rozpětí — appka spíš
 * podstřelí, než aby prohlásila šum za zlepšení. Když z dat vyjde rozptyl
 * větší, použije se ten skutečný; menší appka neuzná.
 */
export const E1RM_NOISE_FLOOR_PCT = 3;

export function measurementNoise(points) {
  if (!points || points.length < 4) return null;
  const t = trend(points);
  if (!t) return null;

  const t0 = new Date(points[0].date).getTime();
  const xs = points.map((p) => (new Date(p.date).getTime() - t0) / 86400000);
  const ys = points.map((p) => p.value);
  const residuals = xs.map((x, i) => ys[i] - (t.intercept + t.slope * x));
  const observed = Math.sqrt(residuals.reduce((s, r) => s + r ** 2, 0) / (points.length - 2));
  const mean = ys.reduce((a, b) => a + b, 0) / ys.length;

  const floor = (mean * E1RM_NOISE_FLOOR_PCT) / 100;
  const te = Math.max(observed, floor);

  return {
    n: points.length,
    typicalError: round(te, 1),
    observedError: round(observed, 1),
    floored: observed < floor,
    cv: mean > 0 ? round((te / mean) * 100, 1) : null,
    sdc: round(1.96 * Math.SQRT2 * te, 1),
    latest: round(ys.at(-1), 1),
    best: round(Math.max(...ys), 1),
  };
}

/**
 * Je rozdíl mezi dvěma odhady maxima prokazatelný, nebo se vejde do šumu?
 * Vrací i samotné SDC, aby šlo v UI napsat „potřebuješ aspoň +5,2 kg".
 */
export function isRealChange(from, to, noise) {
  if (!noise || from == null || to == null) return null;
  const diff = round(to - from, 1);
  return {
    diff,
    sdc: noise.sdc,
    real: Math.abs(diff) >= noise.sdc,
    direction: diff > 0 ? 'up' : diff < 0 ? 'down' : 'flat',
  };
}

/* =========================================================
   Poměry mezi cviky — kde je slabé místo
   ========================================================= */

/**
 * Rozpad součtu na tři cviky v procentech.
 */
export function totalSplit(e1rm) {
  const total = ['squat', 'bench', 'deadlift'].reduce((s, k) => s + (e1rm[k] ?? 0), 0);
  if (!(total > 0)) return null;
  return {
    total: round(total, 1),
    squat: round(((e1rm.squat ?? 0) / total) * 100, 1),
    bench: round(((e1rm.bench ?? 0) / total) * 100, 1),
    deadlift: round(((e1rm.deadlift ?? 0) / total) * 100, 1),
  };
}

const SBD_KEYS = { squat: 'sq', bench: 'bp', deadlift: 'dl' };

/**
 * Kde se podíly tří cviků na součtu drží proti elitním závodníkům ve stejné
 * váhové kategorii, se stejným pohlavím a stejnou výstrojí.
 *
 * Tohle je jiná otázka než „kolik dřepneš". Součet se dá poskládat mnoha
 * způsoby a bro pravidla typu 3:4:5 ignorují, že poměry se posouvají
 * s kategorií: nejlehčí muži dávají v klasice do mrtvého tahu skoro 40 %
 * součtu, nejtěžší jen 37 %, a ve vybavené soutěži je to celé jinak, protože
 * dres pomáhá dřepu a benči, ne tahu.
 *
 * Vrací u každého cviku podíl, pásmo, z-skóre proti elitnímu průměru a kolik
 * kilogramů dělí závodníka od spodní hranice pásma.
 *
 * DŮLEŽITÉ K VÝKLADU: studie ukazuje asociaci, ne příčinu. Závodníci uvnitř
 * pásma mají vyšší IPF GL, ale to neznamená, že se součet zvedne tím, že se
 * poměr narovná. Formulace v UI proto zní „mimo pásmo elitních závodníků",
 * ne „musíš víc dřepovat".
 */
export function sbdBalance(e1rm, { sex = 'm', bw = 0, equipment = 'classic' } = {}) {
  const split = totalSplit(e1rm);
  if (!split || !(bw > 0)) return null;

  const table = SBD_RATIOS[equipment]?.[sex];
  if (!table) return null;

  // Nejlehčí kategorie appky (53 kg muži, 43 kg ženy) studie nepokrývá —
  // vezme se nejbližší vyšší řádek a příznak řekne, že jde o přiblížení.
  const row = table.find((r) => bw <= r.limit) ?? table.at(-1);
  const approxClass = bw <= (table[0].limit - 6);

  const lifts = ['squat', 'bench', 'deadlift'].map((lift) => {
    const [mean, sd, min, max] = row[SBD_KEYS[lift]];
    const pct = split[lift];
    const state = pct < min ? 'low' : pct > max ? 'high' : 'ok';
    // o kolik kg by cvik musel povyrůst k dolní hranici, při zbytku beze změny.
    // podíl = x / (x + zbytek) = min/100  ⇒  x = zbytek · min / (100 − min)
    const rest = split.total - (e1rm[lift] ?? 0);
    const toBand = state === 'low'
      ? round((rest * min) / (100 - min) - (e1rm[lift] ?? 0), 1)
      : state === 'high'
        ? round((rest * max) / (100 - max) - (e1rm[lift] ?? 0), 1)
        : 0;
    return {
      lift, pct, mean, sd, min, max, state, toBand,
      z: sd > 0 ? round((pct - mean) / sd, 2) : null,
      toMean: round((rest * mean) / (100 - mean) - (e1rm[lift] ?? 0), 1),
    };
  });

  return {
    total: split.total,
    classLabel: row.limit === Infinity ? `${table.at(-2).limit}+ kg` : `do ${row.limit} kg`,
    firm: row.firm,
    approxClass,
    lifts,
    balanced: lifts.every((l) => l.state === 'ok'),
    // "MMM" vyvážený, "LMH" slabý dřep a silný tah — zkratka do jednoho řetězce
    code: lifts.map((l) => (l.state === 'low' ? 'L' : l.state === 'high' ? 'H' : 'M')).join(''),
  };
}

/* =========================================================
   Věkové koeficienty
   ========================================================= */

/**
 * Násobitel bodů podle věku. Pozor na pořadí: násobí se výsledné body
 * (DOTS / Wilks / IPF GL), ne součet v kilogramech.
 *
 * `approximate` řeší případ, kdy je známý jen ročník, ne datum narození.
 * OpenPowerlifting to řeší asymetricky: u mladších než 30 se předpokládá
 * vyšší věk z rozsahu, u masters nižší — v obou případech tak koeficient
 * spíš podstřelí, než aby závodníka zvýhodnil.
 */
export function ageCoefficient(age, { approximate = false } = {}) {
  if (age == null || !Number.isFinite(age) || age < 0) return null;
  const a = Math.floor(age);
  if (a > 100) return { coeff: AGE_COEFF.at(-1), solid: false, age: a };
  const idx = approximate && a < 30 ? a + 1 : a;
  const coeff = AGE_COEFF[Math.min(idx, AGE_COEFF.length - 1)];
  if (!(coeff > 0)) return null;
  return {
    coeff,
    age: a,
    // krajní úseky tabulky jsou ve zdroji odhad, ne dohodnutá federační hodnota
    solid: a >= AGE_COEFF_SOLID.min && a <= AGE_COEFF_SOLID.max,
  };
}

/** Body přepočtené na věk. Vrací null, když věk není zadaný. */
export function ageAdjusted(points, age, opts) {
  const c = ageCoefficient(age, opts);
  if (c == null || points == null || !Number.isFinite(points)) return null;
  return { ...c, points: round(points, 2), adjusted: round(points * c.coeff, 2) };
}

/* =========================================================
   Denní připravenost z odchylky RPE
   ========================================================= */

/**
 * Nejlepší odhad připravenosti, který jde z tréninkového deníku vytáhnout
 * bez jediného přístroje navíc.
 *
 * Princip: pro každou sérii se z relativní intenzity a počtu opakování
 * odvodí, na jaké RPE *měla* vyjít. Rozdíl proti nahlášenému RPE je
 * reziduum — o kolik byl dnešek těžší, než měl být. Denní skóre je vážený
 * průměr reziduí a čte se jako z-skóre proti vlastnímu klouzavému oknu,
 * ne proti univerzální hranici.
 *
 * Váhy: série se váží podle INOL, protože přesnost odhadu RPE prudce klesá
 * s počtem opakování — Zourdos a kol. (2016) naměřili u zkušených dřepařů
 * směrodatnou odchylku nahlášeného RPE 0,32 při 100 % 1RM, ale 1,18 při
 * 60 %. Trojka na RPE 9 nese informaci, desítka na RPE 6 skoro žádnou, a
 * INOL tenhle poměr přirozeně kopíruje.
 *
 * Tohle je per-jednotka a z-skórovaná obdoba rpeCreep(), který totéž počítá
 * po týdnech a bez normalizace.
 */
export function dailyReadiness(entries, e1rms, { window: win = 28, variants = {} } = {}) {
  const byDate = new Map();

  for (const e of entries) {
    const actual = e.actualRpe;
    const e1 = entryE1rm(e, e1rms, variants);
    if (!(actual > 0) || !(e1 > 0) || !(liftedWeight(e) > 0) || !(liftedReps(e) > 0)) continue;

    const pct = intensity(e, e1);
    const expected = rpeFromPct(liftedReps(e), pct);
    if (expected == null) continue;   // mimo tabulku — odhad by lhal

    const w = Math.max(0.01, entryInol(e, e1));
    if (!byDate.has(e.date)) byDate.set(e.date, { date: e.date, sum: 0, weight: 0, n: 0 });
    const d = byDate.get(e.date);
    d.sum += (actual - expected) * w;
    d.weight += w;
    d.n++;
  }

  const days = [...byDate.values()]
    .filter((d) => d.weight > 0)
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((d) => ({ date: d.date, n: d.n, residual: round(d.sum / d.weight, 2) }));

  // z-skóre proti předchozím dnům uvnitř okna — bez normalizace by se
  // reziduum nedalo porovnat mezi závodníky ani mezi fázemi bloku
  return days.map((d, i) => {
    const past = days.slice(0, i).filter((p) => daysBetween(p.date, d.date) <= win);
    if (past.length < 3) return { ...d, z: null, mean: null, sd: null, n28: past.length };
    const mean = past.reduce((s, p) => s + p.residual, 0) / past.length;
    const sd = Math.sqrt(past.reduce((s, p) => s + (p.residual - mean) ** 2, 0) / past.length);
    return {
      ...d,
      mean: round(mean, 2),
      sd: round(sd, 2),
      n28: past.length,
      z: sd > 0 ? round((d.residual - mean) / sd, 2) : null,
    };
  });
}

export function gradeReadiness(z) {
  if (z == null) return { label: 'Málo dat', tone: 'low', note: 'Potřeba aspoň čtyři jednotky se zapsaným skutečným RPE.' };
  if (z >= 1.5) return { label: 'Výrazně těžší', tone: 'bad', note: 'Trénink šel podstatně hůř, než u tohohle závodníka bývá zvykem. Podívej se na spánek, jídlo a co se děje mimo posilovnu.' };
  if (z >= 1) return { label: 'Těžší než obvykle', tone: 'warn', note: 'Den byl náročnější, než měl podle plánu být. Jednou se to stane; třikrát po sobě je to signál.' };
  if (z <= -1) return { label: 'Lehčí než obvykle', tone: 'ok', note: 'Šlo to líp, než plán čekal. Buď je závodník odpočatý, nebo se plán začíná podceňovat.' };
  return { label: 'Podle očekávání', tone: 'ok', note: 'Trénink sedí na to, jak byl napsaný.' };
}

/* =========================================================
   Kalendář a jednotky
   ========================================================= */

/**
 * Souhrn jedné tréninkové jednotky — co se ten den dělá a co už je odvedené.
 *
 * `done` je podíl sérií, u kterých je zapsaná skutečnost. Nula znamená
 * naplánováno, jednička hotovo, mezi tím rozdělaná jednotka.
 */
export function sessionSummary(entries, e1rms = {}, variants = {}) {
  if (!entries.length) return null;
  const lifts = new Map();
  let tonnageSum = 0;
  let sets = 0;
  let logged = 0;
  let peak = 0;

  for (const e of entries) {
    const e1 = entryE1rm(e, e1rms, variants);
    tonnageSum += tonnage(e);
    sets += e.sets;
    if (e.actualRpe != null || e.actualWeight != null) logged += e.sets;
    if (e1 > 0) peak = Math.max(peak, intensity(e, e1));
    if (!lifts.has(e.lift)) lifts.set(e.lift, { lift: e.lift, sets: 0, top: 0 });
    const l = lifts.get(e.lift);
    l.sets += e.sets;
    l.top = Math.max(l.top, liftedWeight(e));
  }

  return {
    date: entries[0].date,
    items: entries.length,
    sets,
    tonnage: round(tonnageSum),
    peak: round(peak, 1),
    lifts: [...lifts.values()].sort((a, b) => b.sets - a.sets),
    done: sets > 0 ? round(logged / sets, 2) : 0,
    complete: sets > 0 && logged === sets,
  };
}

/**
 * Frekvence na cvik — kolik samostatných dnů týdně se cvik trénuje.
 *
 * Současná praxe se sjednotila na dvou až třech jednotkách na soutěžní cvik
 * týdně; pod jednou se technika neudrží, nad čtyři se u naturálních závodníků
 * přestává vracet. Není to změřená optimální hodnota, je to pásmo, ve kterém
 * se pohybuje většina programů, které něco dokázaly.
 */
export function liftFrequency(entries, startDate, lifts = ['squat', 'bench', 'deadlift']) {
  const weekOf = (d) => Math.max(1, Math.floor(daysBetween(startDate, d) / 7) + 1);
  const weeks = new Set();
  const byLift = new Map(lifts.map((k) => [k, new Set()]));

  for (const e of entries) {
    if (!byLift.has(e.lift)) continue;
    const w = weekOf(e.date);
    weeks.add(w);
    byLift.get(e.lift).add(`${w}|${e.date}`);
  }
  const weekCount = Math.max(1, weeks.size);

  return lifts.map((k) => ({
    lift: k,
    sessions: byLift.get(k).size,
    perWeek: round(byLift.get(k).size / weekCount, 1),
  }));
}

export function gradeFrequency(perWeek) {
  if (!(perWeek > 0)) return { label: 'Netrénuje se', tone: 'bad', note: 'Cvik v bloku vůbec není.' };
  if (perWeek < 1) return { label: 'Málo často', tone: 'warn', note: 'Míň než jednou týdně. Technika se na takové frekvenci drží těžko.' };
  if (perWeek <= 3.4) return { label: 'Obvyklé pásmo', tone: 'ok', note: 'Dvě až tři jednotky týdně jsou frekvence, na které stojí většina programů.' };
  return { label: 'Vysoká frekvence', tone: 'warn', note: 'Nad tři jednotky týdně na jeden cvik. Jde to, ale objem v jednotce musí odpovídajícím způsobem klesnout.' };
}

/**
 * Rozestup mezi těžkými expozicemi stejného cviku.
 *
 * Dvě těžké jednotky téhož cviku po sobě jdoucí dny jsou skoro vždycky
 * plánovací chyba — regenerace nervové soustavy i pojiva potřebuje víc.
 * Appka tu nehodnotí, kolik dní je „správně", protože publikovaná hodnota
 * neexistuje; ukazuje jen skutečné rozestupy, aby byla vidět jednodenní
 * mezera, která tam většinou být neměla.
 */
export function heavySpacing(entries, e1rms, { threshold = 85, variants = {} } = {}) {
  const byLift = new Map();
  for (const e of entries) {
    const e1 = entryE1rm(e, e1rms, variants);
    if (!(e1 > 0) || intensity(e, e1) < threshold) continue;
    if (!byLift.has(e.lift)) byLift.set(e.lift, new Set());
    byLift.get(e.lift).add(e.date);
  }

  return [...byLift.entries()].map(([lift, dates]) => {
    const sorted = [...dates].sort();
    const gaps = sorted.slice(1).map((d, i) => daysBetween(sorted[i], d));
    return {
      lift,
      dates: sorted,
      gaps,
      minGap: gaps.length ? Math.min(...gaps) : null,
      avgGap: gaps.length ? round(gaps.reduce((s, g) => s + g, 0) / gaps.length, 1) : null,
      tight: gaps.filter((g) => g <= 1).length,
    };
  });
}

/* =========================================================
   Doporučení
   ========================================================= */

/* Názvy cviků česky. calc.js nezná texty UI, ale doporučení jsou věty —
   bez skloňování by z nich lezlo „Dvě těžké jednotky squat po sobě". */
const LIFT_CS = { squat: 'Dřep', bench: 'Benčpres', deadlift: 'Mrtvý tah' };
const LIFT_GEN = { squat: 'dřepu', bench: 'benče', deadlift: 'mrtvého tahu' };

/**
 * Poskládá z toho, co appka počítá jinde, seřazený seznam „co s tím".
 *
 * ZÁMĚRNĚ NIC NEPŘEPISUJE. Appka umí spočítat, že příští týden vychází o čtyři
 * procenta levněji — ale jestli se to má promítnout do plánu, ví jenom kouč.
 * Zná věci, které v datech nejsou: že závodník minulý týden stěhoval, že ho
 * bolí rameno, že za měsíc jede na dovolenou. Automatický přepis by tyhle
 * informace přebil čísly, která je neznají.
 *
 * Každé doporučení proto nese tři věci: co se stalo, co s tím, a jak silný
 * je pro to důvod. Poslední z nich je nejdůležitější — bez ní by pásmo
 * převzaté z dotazníku na deseti lidech vypadalo stejně závazně jako
 * koeficient z osmisettisícového vzorku.
 *
 * `weight` je síla důvodu:
 *   'studie' — recenzovaný zdroj
 *   'praxe'  — trenérská konvence nebo federační norma
 *   'appka'  — konstrukce této aplikace
 */
export function recommendations({
  athlete, block, entries = [], e1rms = {}, meets = [], wellness = [], e1rmLog = [], today = null,
} = {}) {
  const now = today ?? iso(new Date());
  const out = [];
  const add = (r) => out.push(r);

  const blockEntries = block ? entries.filter((e) => e.blockId === block.id) : entries;
  const hasLogs = entries.some((e) => e.actualRpe != null);

  /* ---- 1. závod na obzoru ---- */
  const nextMeet = meets.filter((m) => m.date >= now).sort((a, b) => a.date.localeCompare(b.date))[0];
  if (nextMeet) {
    const days = daysBetween(now, nextMeet.date);
    if (athlete?.bw > 0) {
      const wc = weightClass(athlete.bw, athlete.sex);
      if (wc.headroom != null && wc.headroom < 0.5 && days <= 42) {
        add({
          id: 'vaha-limit', priority: 1, tone: 'bad', weight: 'studie',
          title: `Do limitu kategorie zbývá ${num2(wc.headroom, 1)} kg`,
          why: `Závod je za ${days} dnů a váha je prakticky na hraně. Každé kolísání přes noc znamená riziko, že se závodník neváží.`,
          action: 'Rozhodni teď, jestli se drží kategorie, nebo jde nahoru — na poslední týden je na to pozdě.',
          screen: 'meet',
        });
      }
    }
    if (days <= 28 && days >= 7) {
      const t = blockEntries.length >= 2 ? taperCheck(analyzeBlock(blockEntries, e1rms, block?.start).weeks) : null;
      if (!t || t.drop < 30) {
        add({
          id: 'taper', priority: 1, tone: 'warn', weight: 'studie',
          title: `Závod za ${days} dnů, taper zatím nesedí`,
          why: t
            ? `Poslední týden ubral ${num2(t.drop, 0)} % objemu. Šampioni v průzkumu ubírali kolem 50 %.`
            : 'V plánu zatím není vidět snížení objemu před závodem.',
          action: 'Otevři ladění formy a vyber model. Pokud je slabinou mrtvý tah, ber exponenciální — v řízeném pokusu jako jediný zvedl i tah.',
          screen: 'meet',
        });
      }
    }
  }

  /* ---- 2. strop regenerace ---- */
  if (hasLogs && block) {
    const creep = rpeCreep(blockEntries, block.start);
    const hs = hardSets(blockEntries, e1rms, block.start);
    const sumSets = (w) => (w ? Object.values(w.lifts).reduce((s, v) => s + v, 0) : null);
    // trend nejlepšího odhadu maxima — bez něj by signál stál jen na dvou
    // známkách ze tří a „dvě ze dvou" by znamenalo něco jiného než „dvě ze tří"
    const trendPts = e1rmLog
      .slice()
      .sort((x, y) => x.date.localeCompare(y.date))
      .map((x) => ({ date: x.date, value: x.value }));
    const m = mrvSignal({
      e1rmTrend: trendPts.length >= 4 ? plateauCheck(trendPts) : null,
      creepNow: creep.at(-1)?.avg,
      creepPrev: creep.at(-2)?.avg,
      hooperNow: (() => { const w = wellness.find((x) => x.date === now); return w ? hooperIndex(w) : null; })(),
      hooperBaseline: hooperBaseline(wellness, now),
      hardSetsNow: sumSets(hs.at(-1)),
      hardSetsPrev: sumSets(hs.at(-2)),
    });
    if (m.reached) {
      add({
        id: 'mrv', priority: 1, tone: 'bad', weight: 'appka',
        title: 'Objem přerostl regeneraci',
        why: `Sedí ${m.score} ze ${m.max} nezávislých známek naráz: ${m.signals.filter((x) => x.hit).map((x) => x.label).join(', ')}.`,
        action: 'Týden odlehčení — objem dolů zhruba o polovinu, intenzitu držet. Další série teď nepřidá adaptaci, jen únavu.',
        screen: 'forma',
      });
    }
  }

  /* ---- 3. rozestupy těžkých jednotek ---- */
  for (const s of heavySpacing(blockEntries, e1rms)) {
    if (s.tight > 0) {
      add({
        id: `rozestup-${s.lift}`, priority: 1, tone: 'warn', weight: 'praxe',
        title: `Dvě těžké jednotky ${LIFT_GEN[s.lift]} po sobě`,
        why: `${s.tight}× jdou dvě jednotky nad 85 % maxima den po dni.`,
        action: 'Přetáhni jednu z nich v kalendáři na jiný den. Publikovaný správný rozestup neexistuje, ale jednodenní tam většinou být neměl.',
        screen: 'kalendar',
      });
    }
  }

  /* ---- 4. úprava příštího týdne ---- */
  if (hasLogs && block) {
    const creep = rpeCreep(blockEntries, block.start);
    const lastWeek = creep.at(-1)?.week;
    if (lastWeek) {
      for (const lift of ['squat', 'bench', 'deadlift']) {
        const adj = weeklyAdjustment(blockEntries, lift, lastWeek, block.start);
        if (!adj || Math.abs(adj.pctChange) < 2) continue;
        add({
          id: `uprava-${lift}`, priority: 2, tone: adj.pctChange < 0 ? 'warn' : 'ok', weight: 'appka',
          title: `${LIFT_CS[lift]}: příští týden ${adj.pctChange < 0 ? 'ubrat' : 'přidat'} ${num2(Math.abs(adj.pctChange), 1)} %`,
          why: `Skutečný odhad maxima z odvedených sérií je ${num2(adj.avgReal, 1)} kg proti plánovaným ${num2(adj.avgPlan, 1)} kg (${adj.n} ${adj.n === 1 ? 'série' : 'sérií'}).`,
          action: 'Uprav váhy ve Stavbě bloku. Appka to schválně nepřepisuje sama — ty víš, jestli za tím byl špatný týden, nebo skutečný posun formy.',
          screen: 'program',
        });
      }
    }
  }

  /* ---- 5. zaostávající cvik ---- */
  if (athlete) {
    const bal = sbdBalance(athlete.e1rm ?? {}, { sex: athlete.sex, bw: athlete.bw, equipment: athlete.equipment });
    for (const l of bal?.lifts.filter((x) => x.state === 'low') ?? []) {
      add({
        id: `zaostava-${l.lift}`, priority: 2, tone: 'warn', weight: 'studie',
        title: `${LIFT_CS[l.lift]} nese ${num2(l.pct, 1)} % součtu`,
        why: `Elitní závodníci ve stejné kategorii mají ${num2(l.min, 1)} až ${num2(l.max, 1)} %.`,
        action: 'Ber to jako otázku, ne jako cíl. Studie ukazuje souvislost, ne příčinu — a délka končetin poměr posune legitimně a natrvalo.',
        screen: 'forma',
      });
    }
  }

  /* ---- 6. frekvence ---- */
  if (block) {
    for (const f of liftFrequency(blockEntries, block.start)) {
      const g = gradeFrequency(f.perWeek);
      if (g.tone === 'ok') continue;
      add({
        id: `frekvence-${f.lift}`, priority: 2, tone: 'warn', weight: 'praxe',
        title: `${LIFT_CS[f.lift]}: ${num2(f.perWeek, 1)}× týdně`,
        why: g.note,
        action: f.perWeek < 1
          ? 'Přidej druhou jednotku týdně — v kalendáři na den, kde není nic těžkého.'
          : 'Když je jednotek hodně, musí objem v každé z nich odpovídajícím způsobem klesnout.',
        screen: 'kalendar',
      });
    }
  }

  /* ---- 7. chybějící zápisy ---- */
  const missing = [...new Set(entries.filter((e) => e.date < now && e.actualRpe == null).map((e) => e.date))];
  if (missing.length >= 3) {
    add({
      id: 'zapisy', priority: 2, tone: 'low', weight: 'appka',
      title: `${missing.length} proběhlých jednotek nemá zápis`,
      why: 'Bez skutečného RPE neběží odchylka RPE, denní připravenost ani model únavy — polovina appky zůstane slepá.',
      action: 'Dopiš je v Plán vs. realita. Stačí RPE; váhu a opakování jen tam, kde se lišily.',
      screen: 'realita',
    });
  }

  /* ---- 8. trend a šum ---- */
  return out.sort((a, b) => a.priority - b.priority);
}

/**
 * Doporučení, která vyžadují historii maxim — jsou oddělená, protože
 * pracují s jiným zdrojem dat než trénink v bloku.
 */
export function trendRecommendations(e1rmLog, lifts = ['squat', 'bench', 'deadlift']) {
  const out = [];
  for (const lift of lifts) {
    const pts = e1rmLog.filter((x) => x.lift === lift)
      .sort((a, b) => a.date.localeCompare(b.date))
      .map((x) => ({ date: x.date, value: x.value }));
    if (pts.length < 4) continue;

    const pl = plateauCheck(pts);
    const noise = measurementNoise(pts);
    const label = LIFT_CS[lift];

    if (pl?.plateau) {
      out.push({
        id: `plateau-${lift}`, priority: 2, tone: 'warn', weight: 'appka',
        title: `${label} stojí`,
        why: 'Trend není průkazný a i kdyby byl, za čtyři týdny by nedal prokazatelnou změnu.',
        action: 'Zvaž změnu podnětu: jinou variantu, jiný rozsah opakování, nebo víc objemu — podle toho, co dosud dostával.',
        screen: 'forma',
      });
    }
    if (noise?.floored) {
      out.push({
        id: `sum-${lift}`, priority: 3, tone: 'low', weight: 'studie',
        title: `${label}: maxima se testují moc často`,
        why: `Prokazatelná změna je ${num2(noise.sdc, 1)} kg. Menší posun se nedá odlišit od dobrého dne.`,
        action: 'Nech mezi testy tolik času, kolik zabere zlepšení nad tímhle prahem.',
        screen: 'forma',
      });
    }
  }
  return out;
}


/* =========================================================
   Taper — plán posledních týdnů
   ========================================================= */

/**
 * Vygeneruje průběh objemu do dne závodu podle zvoleného modelu.
 *
 * Intenzita se v žádném z modelů nesnižuje. To je na taperu ta nejdůležitější
 * a nejčastěji porušená věc: ubírá se práce, ne váha na ose. Kdo v posledním
 * týdnu sjede i procenta, přijde o formu, ne o únavu.
 */
export function taperPlan(meetDate, { model = 'exponential', baseVolume = 100 } = {}) {
  const m = TAPER_MODELS[model];
  if (!m) return null;

  const days = m.days;
  const start = addDaysLocal(meetDate, -days);
  const out = [];
  for (let i = 0; i <= days; i++) {
    const d = iso(addDaysLocal(start, i));
    const frac = Math.max(0, Math.min(1, m.volumeAt(i, days)));
    out.push({
      date: d,
      daysBefore: days - i,
      fraction: round(frac, 3),
      volume: round(baseVolume * frac, 1),
    });
  }

  const last = out.at(-1);
  return {
    model,
    label: m.label,
    note: m.note,
    warn: m.warn,
    days,
    start: iso(start),
    days_: out,
    finalDrop: round((1 - last.fraction) * 100, 0),
    /* referenční body z praxe šampionů */
    intensityPeak: iso(addDaysLocal(meetDate, -TAPER_REFERENCE.intensityPeakDaysBefore.mean)),
    lastSession: iso(addDaysLocal(meetDate, -TAPER_REFERENCE.lastSessionDaysBefore[1])),
  };
}

/** Sedí navržený pokles objemu na to, co dělají šampioni? */
export function gradeTaperDrop(dropPct) {
  if (dropPct == null) return { label: 'Bez dat', tone: 'low' };
  const { mean, sd } = TAPER_REFERENCE.volumeDrop;
  if (Math.abs(dropPct - mean) <= sd) return { label: 'Odpovídá praxi šampionů', tone: 'ok' };
  if (dropPct < mean - sd) return { label: 'Ubráno málo', tone: 'warn' };
  return { label: 'Ubráno hodně', tone: 'warn' };
}

/* =========================================================
   Časová osa závodního dne
   ========================================================= */

/**
 * Kdy začít rozcvičku, aby poslední série padla v ten správný okamžik.
 *
 * Počítá se pozpátku od prvního pokusu: kolo trvá tolik minut, kolik je
 * závodníků ve flightě, a poslední rozcvičovací série má padnout zhruba
 * deset závodníků před tím vlastním pokusem. Od toho se odečte počet
 * rozcvičovacích sérií krát pauza mezi nimi.
 *
 * Všechny konstanty jsou trenérská praxe, ne měření — proto jde minuta na
 * pokus přenastavit. Reálné tempo kolísá s nároky a technickými přestávkami.
 */
export function meetTimeline({
  flightStart,
  lifterOrder = 1,
  flightSize = 12,
  minPerAttempt = MEET_TIMING.minPerAttempt,
  warmupSets = 5,
  rest = MEET_TIMING.restBetweenWarmups,
  lift = 'squat',
} = {}) {
  if (!(flightSize > 0) || !(lifterOrder > 0)) return null;

  const toMin = (t) => {
    const m = /^(\d{1,2}):(\d{2})$/.exec(String(t ?? '').trim());
    return m ? Number(m[1]) * 60 + Number(m[2]) : null;
  };
  const fmt = (mins) => {
    const x = ((Math.round(mins) % 1440) + 1440) % 1440;
    return `${String(Math.floor(x / 60)).padStart(2, '0')}:${String(x % 60).padStart(2, '0')}`;
  };

  const startMin = toMin(flightStart);
  if (startMin == null) return null;

  const roundMin = flightSize * minPerAttempt;
  // vlastní pokus přijde na řadu podle pořadí v nominaci
  const attempt1 = startMin + (lifterOrder - 1) * minPerAttempt;
  const attempt2 = attempt1 + roundMin;
  const attempt3 = attempt2 + roundMin;

  const lastWarmup = attempt1 - MEET_TIMING.lastWarmupLiftersBefore * minPerAttempt;
  const warmupStart = lastWarmup - (warmupSets - 1) * rest;

  return {
    lift,
    roundMin,
    flightStart: fmt(startMin),
    warmupStart: fmt(warmupStart),
    lastWarmup: fmt(lastWarmup),
    attempts: [fmt(attempt1), fmt(attempt2), fmt(attempt3)],
    betweenAttempts: roundMin,
    warmupWindow: Math.round(lastWarmup - warmupStart),
    // varování, když rozcvička vychází dřív, než se otevře rozcvičovna
    tight: warmupStart < startMin - MEET_TIMING.warmupRoomBefore[lift] - 5,
  };
}

/* =========================================================
   Srovnání úspěšnosti pokusů
   ========================================================= */

/**
 * Kolik z devíti pokusů sedlo proti tomu, co dávají medailisté.
 *
 * Pozor na výklad procent 91 a 96 u výběru pokusů: počítala se jen ze
 * závodníků, kteří třetí pokus dali. Je v nich tedy zabudované přežití —
 * neříkají, že otvírák na 91 % třetího pokusu maximalizuje součet.
 */
export function attemptBenchmark(made, total = ATTEMPT_BENCHMARK.outOf) {
  if (!(total > 0) || made == null) return null;
  const scaled = (made / total) * ATTEMPT_BENCHMARK.outOf;
  const { winners, average } = ATTEMPT_BENCHMARK;
  return {
    made,
    total,
    outOf9: round(scaled, 2),
    winners,
    average,
    vsWinners: round(scaled - winners, 2),
    vsAverage: round(scaled - average, 2),
    level: scaled >= winners ? 'winners' : scaled >= average ? 'above' : 'below',
  };
}

export function gradeAttempts(b) {
  if (!b) return { label: 'Bez dat', tone: 'low', note: 'Zapiš aspoň jeden zápas.' };
  if (b.level === 'winners') {
    return { label: 'Na úrovni medailistů', tone: 'ok', note: `${num2(b.outOf9, 1)} z 9 — vítězové mistrovství světa dávají v průměru ${winnersLabel()}.` };
  }
  if (b.level === 'above') {
    return { label: 'Nad průměrem', tone: 'ok', note: `${num2(b.outOf9, 1)} z 9. Průměrný závodník dává ${num2(ATTEMPT_BENCHMARK.average, 2)}, medailisté ${num2(ATTEMPT_BENCHMARK.winners, 2)}.` };
  }
  return {
    label: 'Pod průměrem',
    tone: 'warn',
    note: `${num2(b.outOf9, 1)} z 9 je pod průměrem startovního pole (${num2(ATTEMPT_BENCHMARK.average, 2)}). Nejčastější příčina jsou příliš agresivní třetí pokusy — každá nula je pokus, který se do součtu nezapočítá.`,
  };
}

const winnersLabel = () => num2(ATTEMPT_BENCHMARK.winners, 2);

/* =========================================================
   Percentily relativní síly
   ========================================================= */

/**
 * Kde leží výkon proti populaci 810 tisíc startů.
 *
 * Z placeného textu se podařilo ověřit jen 90. percentil a jen pro dvě
 * věkové skupiny. Appka proto neříká „jsi na 63. percentilu" — dopočítat
 * chybějící percentily interpolací a vydávat je za data by byl výmysl.
 * Říká jen, jestli je závodník nad hranicí nejlepší desetiny, nebo pod ní,
 * a o kolik.
 */
export function strengthPercentile(lift, kg, bw, sex = 'm', age = null) {
  if (!(kg > 0) || !(bw > 0)) return null;
  const group = age != null && age > 80 ? 'old' : 'young';
  const ref = STRENGTH_P90[group]?.[sex]?.[lift];
  if (!(ref > 0)) return null;

  const ratio = kg / bw;
  return {
    lift,
    group,
    groupLabel: STRENGTH_P90[group].label,
    ratio: round(ratio, 2),
    p90: ref,
    above: ratio >= ref,
    gapKg: round((ref - ratio) * bw, 1),
    pctOfP90: round((ratio / ref) * 100, 0),
    // mimo 18–35 a nad 80 se použije mladší skupina, což je přísnější měřítko
    approxAge: age != null && age > 35 && age <= 80,
  };
}

/* =========================================================
   Šablony progrese
   ========================================================= */

/**
 * 5/3/1 podle Wendlera. Procenta jdou z tréninkového maxima, tedy z 90 %
 * skutečného maxima — ne ze samotného maxima. Nejčastější chyba při
 * zavádění téhle šablony je právě tahle záměna.
 */
export function wendler531(oneRm, { unit = 'kg', tmPct = WENDLER_531.tmPct } = {}) {
  if (!(oneRm > 0)) return null;
  const tm = roundToBar(oneRm * tmPct, { unit });
  const step = unit === 'lb' ? 5 : 2.5;
  return {
    oneRm: round(oneRm, 1),
    tm,
    tmPct: round(tmPct * 100, 0),
    weeks: WENDLER_531.weeks.map((w, i) => ({
      week: i + 1,
      label: w.label,
      deload: w.label === 'deload',
      sets: w.sets.map(([pct, reps]) => ({
        pct,
        reps,
        amrap: typeof reps === 'string',
        weight: roundToBar((tm * pct) / 100, { unit, step }),
      })),
    })),
  };
}

/**
 * Kontrola, jestli není tréninkové maximum nadsazené.
 * Wendler doporučuje: když poslední série nedá ani předepsaný počet
 * opakování, maximum se snižuje o desetinu.
 */
export function wendlerCheck(weekLabel, repsAchieved) {
  const floor = WENDLER_531.amrapFloor[weekLabel];
  if (floor == null || repsAchieved == null) return null;
  const short = repsAchieved < floor;
  return {
    floor,
    achieved: repsAchieved,
    short,
    adjust: short ? -10 : 0,
    note: short
      ? `Poslední série dala ${repsAchieved} místo ${floor}. Tréninkové maximum je nadsazené — sniž ho o 10 %.`
      : `Poslední série dala ${repsAchieved} při minimu ${floor}. Maximum sedí, pokračuj v progresi.`,
  };
}

/* =========================================================
   Distribuce intenzit a specifičnost
   ========================================================= */

/**
 * Histogram zvedů po pětiprocentních pásmech intenzity.
 *
 * Prilepinova tabulka rozdělí práci do čtyř hrubých zón; tohle je jemnější
 * pohled na tutéž věc a dá se porovnat se Sheikovou normou, podle které
 * většina práce leží mezi 70 a 80 % maxima a série zřídka přesáhnou pět
 * opakování.
 */
export function intensityHistogram(entries, e1rms, { bin = 5, variants = {} } = {}) {
  const bins = new Map();
  let total = 0;
  let inMain = 0;
  let overFive = 0;
  let mainReps = 0;

  for (const e of entries) {
    const e1 = entryE1rm(e, e1rms, variants);
    if (!(e1 > 0)) continue;
    const pct = intensity(e, e1);
    if (!(pct > 0)) continue;
    const reps = nl(e);
    const key = Math.floor(pct / bin) * bin;
    bins.set(key, (bins.get(key) ?? 0) + reps);
    total += reps;
    mainReps += reps;
    if (pct >= SHEIKO_NORMS.mainBand[0] && pct < SHEIKO_NORMS.mainBand[1]) inMain += reps;
    if (liftedReps(e) > SHEIKO_NORMS.repsPerSetMax) overFive += reps;
  }

  if (!total) return null;
  const rows = [...bins.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([from, reps]) => ({ from, to: from + bin, reps, pct: round((reps / total) * 100, 1) }));

  return {
    rows,
    total,
    mainBandPct: round((inMain / total) * 100, 1),
    overFivePct: round((overFive / Math.max(1, mainReps)) * 100, 1),
    norm: SHEIKO_NORMS,
  };
}

/**
 * Index specifičnosti — jaká část práce padne na samotné soutěžní cviky.
 * Bloková periodizace čeká, že v akumulaci bude nižší a k závodu poroste.
 */
export function specificityIndex(entries) {
  let comp = 0;
  let all = 0;
  for (const e of entries) {
    const t = tonnage(e);
    all += t;
    if (e.lift !== 'accessory') comp += t;
  }
  if (!(all > 0)) return null;
  const pct = round((comp / all) * 100, 1);
  return {
    pct,
    comp: round(comp),
    all: round(all),
    phase: pct >= 80 ? 'realizace' : pct >= 60 ? 'transmutace' : 'akumulace',
  };
}

/** Týdenní tempo nárůstu zátěže v procentech. */
export function rampRate(weeks) {
  return weeks.map((w, i) => {
    const prev = weeks[i - 1];
    const change = prev && prev.tonnage > 0
      ? round(((w.tonnage - prev.tonnage) / prev.tonnage) * 100, 1)
      : null;
    return { week: w.week, tonnage: w.tonnage, change };
  });
}

/**
 * Poměr podnětu k únavě.
 *
 * VAROVÁNÍ K VÝKLADU: v původní podobě je tohle subjektivní škála, kterou
 * kouč vyplní podle pocitu. Číselná verze níž je konstrukce appky, ne
 * převzatá metoda — nikdy nebyla proti ničemu validovaná. Slouží k tomu,
 * aby šlo dva cviky porovnat mezi sebou, ne k tomu, aby se z ní dělaly
 * závěry o absolutní hodnotě.
 */
export function stimulusFatigue(entries, e1rms, lift, variants = {}) {
  const own = entries.filter((e) => e.lift === lift);
  if (!own.length) return null;
  if (!(e1rms[lift] > 0)) return null;

  let hardSetCount = 0;
  let intSum = 0;
  let inolSum = 0;
  for (const e of own) {
    // varianta má vlastní odvozené maximum, takže se intenzita počítá proti němu
    const e1 = entryE1rm(e, e1rms, variants);
    if (!(e1 > 0)) continue;
    if (isHardSet(e, e1)) hardSetCount += e.sets;
    intSum += intensity(e, e1) * nl(e);
    inolSum += entryInol(e, e1);
  }
  const reps = own.reduce((s, e) => s + nl(e), 0);
  if (!reps || !inolSum) return null;

  const avgInt = intSum / reps;
  const stimulus = hardSetCount * (avgInt / 100);
  return {
    lift,
    hardSets: hardSetCount,
    avgIntensity: round(avgInt, 1),
    inol: round(inolSum, 2),
    stimulus: round(stimulus, 2),
    ratio: round(stimulus / inolSum, 2),
  };
}

/* =========================================================
   Shazování váhy
   ========================================================= */

/**
 * Kolik zbývá do limitu a jak riskantní to je.
 *
 * TOHLE NENÍ NÁVOD, JAK SHAZOVAT. Appka spočítá rozdíl, zařadí ho do pásma
 * rizika a upozorní, kde jsou hranice — samotný postup je věc, kterou má
 * vést někdo, kdo na to má vzdělání. Protokoly na vodní nálož, které kolují
 * po internetu, jsou z velké části bez dobré evidence a nesou reálné riziko
 * hyponatremie.
 *
 * Klíčová proměnná, kterou appka nezná, je čas mezi vážením a startem:
 * IPF váží dvě hodiny předem, jiné federace čtyřiadvacet. Bez toho čísla
 * o „udržení výkonu" neplatí, a proto se na to ptá.
 */
export function cutPlan({ bw, limit, hoursToWeighIn = null } = {}) {
  if (!(bw > 0) || !(limit > 0)) return null;
  const need = round(bw - limit, 2);
  if (need <= 0) {
    return { need: 0, needPct: 0, band: { label: 'Kategorie sedí', tone: 'ok', note: 'Není co shazovat.' }, headroom: round(limit - bw, 2) };
  }
  const needPct = round((need / bw) * 100, 2);
  const band = CUT_BANDS.find((b) => needPct <= b.max) ?? CUT_BANDS.at(-1);

  // orientační rozpad: první dvě procenta jde srazit dietou a vyprázdněním,
  // zbytek už je akutní voda
  const passive = round(Math.min(need, bw * 0.02), 2);
  return {
    need,
    needPct,
    band,
    passive,
    water: round(Math.max(0, need - passive), 2),
    hoursToWeighIn,
    shortRecovery: hoursToWeighIn != null && hoursToWeighIn <= 2,
    typical: CUT_FACTS.typicalPct,
    vsTypical: round(needPct - CUT_FACTS.typicalPct, 2),
  };
}

/* =========================================================
   Rychlost tyče (VBT)
   ========================================================= */

/**
 * Očekávaná rychlost tyče pro danou relativní intenzitu.
 * Mezi tabulkovými body se lineárně interpoluje; mimo rozsah vrací null,
 * protože extrapolovat pětibodovou tabulku by byl výmysl.
 */
export function velocityAtPct(lift, sex, pct) {
  const rows = LOAD_VELOCITY[lift]?.[sex];
  if (!rows || !(pct > 0)) return null;
  if (pct < rows[0][0] || pct > rows.at(-1)[0]) return null;

  for (let i = 0; i < rows.length - 1; i++) {
    const [p0, v0, sd0] = rows[i];
    const [p1, v1, sd1] = rows[i + 1];
    if (pct >= p0 && pct <= p1) {
      const t = p1 === p0 ? 0 : (pct - p0) / (p1 - p0);
      return { v: round(v0 + (v1 - v0) * t, 3), sd: round(sd0 + (sd1 - sd0) * t, 3) };
    }
  }
  return null;
}

/**
 * Odhad 1RM z naměřeného profilu zatížení a rychlosti.
 *
 * Přes dvojice (váha, rychlost) se proloží přímka a dosadí se do ní minimální
 * prahová rychlost cviku:  1RM = sklon · MVT + průsečík.
 *
 * NA MRTVÝ TAH SE TOHLE NESMÍ POUŽÍT. Studie, která to testovala (PMC5968962),
 * zjistila, že všechny varianty prahu podhodnotily skutečné maximum o 9 až 15 %,
 * tedy o 16 až 28 kg, a autoři výslovně píší, že se individuální profily
 * k odhadu maxima v mrtvém tahu používat nemají. Funkce proto u tahu vrací
 * výsledek s příznakem `reliable: false` a UI ho odmítne ukázat jako číslo.
 *
 * points: [{ weight, velocity }] — aspoň tři postupně těžší série.
 */
export function lvProfile1RM(points, lift) {
  const pts = (points ?? []).filter((p) => p.weight > 0 && p.velocity > 0);
  if (pts.length < 3) return null;

  const mvt = MVT[lift];
  if (!mvt) return null;

  // regrese váhy na rychlosti — rychlost je tu nezávislá proměnná,
  // protože se do přímky dosazuje právě rychlost (MVT)
  const n = pts.length;
  const mx = pts.reduce((s, p) => s + p.velocity, 0) / n;
  const my = pts.reduce((s, p) => s + p.weight, 0) / n;
  const den = pts.reduce((s, p) => s + (p.velocity - mx) ** 2, 0);
  if (den === 0) return null;
  const slope = pts.reduce((s, p) => s + (p.velocity - mx) * (p.weight - my), 0) / den;
  const intercept = my - slope * mx;

  // jak těsně body na přímce leží — volný profil s r² pod 0,95 nemá cenu dosazovat
  const ssTot = pts.reduce((s, p) => s + (p.weight - my) ** 2, 0);
  const ssRes = pts.reduce((s, p) => s + (p.weight - (intercept + slope * p.velocity)) ** 2, 0);
  const r2 = ssTot > 0 ? 1 - ssRes / ssTot : null;

  return {
    n,
    mvt: mvt.v,
    slope: round(slope, 2),
    intercept: round(intercept, 2),
    r2: r2 == null ? null : round(r2, 3),
    e1rm: round(slope * mvt.v + intercept, 1),
    reliable: mvt.usable,
    note: mvt.note,
  };
}

export function gradeVelocityLoss(pct) {
  if (pct == null || !Number.isFinite(pct)) return { label: 'Bez dat', tone: 'low', note: 'Zadej rychlost první a poslední série.' };
  return VELOCITY_LOSS.find((b) => pct < b.max) ?? VELOCITY_LOSS.at(-1);
}

/**
 * Bezpřístrojová obdoba prahu poklesu rychlosti.
 *
 * Kdo nemá měřák, může stejnou otázku — „kdy sérii ukončit" — číst z toho, co
 * appka stejně zapisuje: kolik opakování se při stejné váze udrželo a na jaké
 * RPE. Propad opakování o víc než pětinu proti první sérii nebo skok RPE
 * o dva body a víc odpovídá zhruba dvaceti až pětadvaceti procentům poklesu
 * rychlosti.
 *
 * POZOR: tohle je převodní pravidlo z trenérské praxe, ne změřená ekvivalence.
 * Nikdo neporovnal obě veličiny na stejném vzorku — je to rozumná analogie,
 * ne validovaný přepočet, a appka to tak i pojmenuje.
 */
export function setDropoff(entries, lift, date) {
  const day = entries
    .filter((e) => e.lift === lift && e.date === date && e.sets > 0)
    .filter((e) => liftedWeight(e) > 0);
  if (day.length < 2) return null;

  const weightOf = liftedWeight;
  // porovnávají se jen série na stejné váze — jinak by pokles opakování
  // znamenal jen to, že se přidalo na ose
  const first = day[0];
  const same = day.filter((e) => Math.abs(weightOf(e) - weightOf(first)) < 0.01);
  if (same.length < 2) return null;

  const last = same.at(-1);
  const fr = liftedReps(first);
  const lr = liftedReps(last);
  const repDrop = fr > 0 ? ((fr - lr) / fr) * 100 : null;
  const rpeFirst = first.actualRpe ?? first.rpe;
  const rpeLast = last.actualRpe ?? last.rpe;
  const rpeJump = rpeFirst > 0 && rpeLast > 0 ? round(rpeLast - rpeFirst, 1) : null;

  return {
    weight: round(weightOf(first), 2),
    sets: same.length,
    firstReps: fr,
    lastReps: lr,
    repDrop: repDrop == null ? null : round(repDrop, 1),
    rpeJump,
    // kterákoli z obou podmínek stačí — měří totéž z jiné strany
    stop: (repDrop != null && repDrop > 20) || (rpeJump != null && rpeJump >= 2),
  };
}

/* =========================================================
   Signál dosaženého stropu regenerace (MRV)
   ========================================================= */

/**
 * Tři nezávislé známky toho, že objem přerostl schopnost regenerace.
 * Žádná sama o sobě nestačí — každá má jiný důvod, proč může lhát:
 *
 *   1. Odhad maxima neroste, přestože objem drží nebo stoupá.
 *      Sám o sobě to může být jen týden bez těžké série.
 *   2. Posun RPE: stejný plán jede na vyšší RPE než minule.
 *      Sám o sobě to může být jedna špatná jednotka.
 *   3. Hooperův index se zhoršil o 15 % a víc proti vlastnímu průměru.
 *      Sám o sobě to může být chřipka nebo práce, ne trénink.
 *
 * Dvě ze tří naráz už dávají smysl číst jako „tady je strop".
 *
 * Skládá dohromady věci, které appka počítá jinde (plateauCheck, rpeCreep,
 * hooperIndex) — nová je jen ta kombinace a její převod na doporučení.
 */
export function mrvSignal({ e1rmTrend, creepNow, creepPrev, hooperNow, hooperBaseline, hardSetsNow, hardSetsPrev }) {
  const signals = [];

  if (e1rmTrend && hardSetsNow != null && hardSetsPrev != null) {
    const stalled = e1rmTrend.plateau || e1rmTrend.slope <= 0;
    const volumeHeld = hardSetsNow >= hardSetsPrev;
    signals.push({
      key: 'vykon',
      label: 'Výkon proti objemu',
      hit: stalled && volumeHeld,
      detail: stalled
        ? (volumeHeld
            ? 'Odhad maxima stojí, objem přitom neklesl — práce se přestala vracet.'
            : 'Odhad maxima stojí, ale objem se snížil. To stagnaci vysvětlí samo.')
        : 'Odhad maxima roste.',
    });
  }

  if (creepNow != null && creepPrev != null) {
    const hit = creepNow - creepPrev >= 0.5;
    signals.push({
      key: 'rpe',
      label: 'Posun RPE proti minulému týdnu',
      hit,
      detail: hit
        ? `Stejný plán jede o ${round(creepNow - creepPrev, 2)} bodu RPE dráž než minulý týden.`
        : `Odchylka RPE se posunula o ${round(creepNow - creepPrev, 2)} bodu — pod hranicí 0,5.`,
    });
  }

  if (hooperNow != null && hooperBaseline > 0) {
    const hit = hooperNow >= hooperBaseline * 1.15;
    signals.push({
      key: 'pohoda',
      label: 'Pohoda proti vlastnímu průměru',
      hit,
      detail: `Hooperův index ${round(hooperNow, 0)} proti vlastnímu průměru ${round(hooperBaseline, 1)}`
        + `${hit ? ' — o 15 % a víc horší.' : ' — v obvyklém rozmezí.'}`,
    });
  }

  const score = signals.filter((s) => s.hit).length;
  return {
    signals,
    score,
    max: signals.length,
    // dvě ze tří: jedna známka je šum, dvě nezávislé už ne
    reached: signals.length >= 2 && score >= 2,
  };
}

export function gradeMrv(m) {
  if (!m || m.max < 2) return { label: 'Málo dat', tone: 'low', note: 'Potřeba aspoň dva týdny tréninku se zapsaným skutečným RPE.' };
  if (m.reached) {
    return {
      label: 'Strop regenerace',
      tone: 'bad',
      note: `Sedí ${m.score} ze ${m.max} známek naráz. Tady se objem už nevyplácí přidávat — týden odlehčení (objem dolů o polovinu, intenzitu držet) vrátí víc než další série.`,
    };
  }
  if (m.score === 1) return { label: 'Jedna známka', tone: 'warn', note: 'Jedna známka sama o sobě bývá šum. Stojí za to sledovat, jestli se k ní příští týden přidá druhá.' };
  return { label: 'Prostor je', tone: 'ok', note: 'Žádná ze sledovaných známek nesedí — objem je zatím v mezích regenerace.' };
}
