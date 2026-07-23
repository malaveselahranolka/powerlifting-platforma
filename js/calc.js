// Veškerá matematika. Čisté funkce, žádný DOM.

import {
  RPE_SEQ, RPE_STEPS, PRILEPIN, INOL_SESSION, INOL_WEEK,
  DOTS_COEF, IPF_GL_COEF, WILKS_COEF, WEIGHT_CLASSES,
  PLATES_KG, PLATES_LB,
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

/** Tonáž jedné položky = série × opakování × váha. */
export const tonnage = (e) => e.sets * e.reps * e.weight;

/** Počet zvedů (NL). */
export const nl = (e) => e.sets * e.reps;

/** Relativní intenzita v % z E1RM. */
export const intensity = (e, e1rm) => (e1rm > 0 ? (e.weight / e1rm) * 100 : 0);

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

/** Hodnocení INOL — pro jednu jednotku nebo celý týden. */
export const gradeInol = (v, scope = 'session') =>
  (scope === 'week' ? INOL_WEEK : INOL_SESSION).find((b) => v < b.max) ?? INOL_SESSION.at(-1);

/**
 * Charakter týdne. Objem a intenzita jsou dvě nezávislé osy a jedno číslo
 * je nepopíše.
 *
 * INOL je vážený objemem: jednička na 90 % přidá 0,1, ale 5×5 na 75 % přidá
 * 1,0. Kdyby se týden hodnotil jen podle INOL, vrcholící týden s maximálními
 * singly by vyšel jako „lehký" — přitom je na nervovou soustavu nejnáročnější
 * v celém bloku. Proto se tady čte i špičková intenzita.
 *
 * Vrací { label, tone, volume, intensity, note }.
 */
export function gradeWeek(week) {
  const inolLevel = week.inolPerLift;
  const peak = week.peakIntensity ?? 0;

  // osa objemu
  const volume = inolLevel < 1 ? 'velmi nízký'
    : inolLevel < 2 ? 'nízký'
      : inolLevel < 3 ? 'střední'
        : inolLevel < 4 ? 'vysoký' : 'extrémní';

  // osa intenzity — špička rozhoduje, ne průměr
  const intensity = peak >= 90 ? 'maximální'
    : peak >= 85 ? 'těžká'
      : peak >= 75 ? 'střední' : 'lehká';

  // Objemová pásma podle Hristova: do 2 lehké, 2–3 udržitelné,
  // 3–4 vysoká zátěž, nad 4 za hranicí regenerace.
  const lowVol = inolLevel < 2;
  const midVol = inolLevel >= 2 && inolLevel < 3;
  const highVol = inolLevel >= 3;
  const extremeVol = inolLevel >= 4;

  // Maximální intenzita není nikdy „lehký týden", ať je objemu jakkoli málo.
  if (peak >= 90) {
    if (highVol) return { label: 'Velmi náročné', tone: 'bad', volume, intensity, note: 'Maximální váhy i vysoký objem naráz. Nedávej dva týdny po sobě.' };
    // „málo objemu" musí opravdu znamenat málo — nad INOL 1 je to plnohodnotný ostrý týden
    if (inolLevel < 1) return { label: 'Ostré, málo objemu', tone: 'warn', volume, intensity, note: 'Typické vrcholení: nervová soustava jede naplno, svaly skoro nic nedostanou. Nízký INOL tady neznamená lehký trénink.' };
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
  if (extremeVol) return { label: 'Objem za hranicí', tone: 'bad', volume, intensity, note: 'Nad 4 INOL se to nedá odregenerovat ani na středních vahách.' };
  if (highVol) return { label: 'Objemová práce', tone: 'warn', volume, intensity, note: 'Hodně opakování na středních vahách. Únava se hromadí ve svalech.' };
  if (midVol) return { label: 'Udržitelné', tone: 'ok', volume, intensity, note: 'Slušná dávka objemu, ze které se dá týden co týden regenerovat.' };
  if (inolLevel < 1) return { label: 'Deload', tone: 'low', volume, intensity, note: 'Nízký objem i intenzita. Odlehčení, nebo úvod bloku.' };
  return { label: 'Lehký týden', tone: 'low', volume, intensity, note: 'Malá dávka. Uprostřed bloku je to na adaptaci málo.' };
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
export function analyzeBlock(entries, e1rms, startDate) {
  const weekOf = (d) => (startDate ? Math.floor(daysBetween(startDate, d) / 7) + 1 : 1);

  const weeks = new Map();
  const byLift = new Map();
  const loadsByDay = {};

  for (const e of entries) {
    const w = Math.max(1, weekOf(e.date));
    const e1 = e1rms[e.lift] ?? 0;
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
 * Varovné hlášky nad výsledkem analýzy.
 * liftLabel dovolí pojmenovat cvik česky, aniž by calc.js znal texty UI.
 */
export function blockFlags(analysis, acwrRatio, liftLabel = (k) => k) {
  const flags = [];
  const lastWeek = analysis.weeks.at(-1)?.week;

  for (const w of analysis.weeks) {
    if (!w.mainLifts) continue;
    const g = gradeWeek(w);

    if (w.inolPerLift >= 4) {
      flags.push({ tone: 'bad', text: `Týden ${w.week}: INOL ${num2(w.inolPerLift)} na hlavní cvik. Nad 4 se to už nedá odregenerovat — uber sérii nebo sjeď intenzitu.` });
    } else if (w.inolPerLift >= 3) {
      flags.push({ tone: 'warn', text: `Týden ${w.week}: INOL ${num2(w.inolPerLift)} na hlavní cvik. Vysoká zátěž, nedávej ji dva týdny po sobě.` });
    } else if (g.tone === 'warn' && w.peakIntensity >= 90) {
      flags.push({ tone: 'warn', text: `Týden ${w.week}: špička ${num2(w.peakIntensity, 0)} % z 1RM. Objem je nízký (INOL ${num2(w.inolPerLift)}), ale nervová soustava dostává zabrat — po takovém týdnu potřebuje závodník víc spánku, ne víc práce.` });
    } else if (w.inolPerLift < 1 && w.peakIntensity < 85 && w.week !== lastWeek && w.week !== 1) {
      // úvodní a poslední týden mají být lehké — hlásit se má jen propad uprostřed
      flags.push({ tone: 'low', text: `Týden ${w.week}: INOL jen ${num2(w.inolPerLift)} a špička ${num2(w.peakIntensity, 0)} %. Uprostřed bloku je to na adaptaci málo.` });
    }
  }

  for (let i = 1; i < analysis.weeks.length; i++) {
    const prev = analysis.weeks[i - 1];
    const cur = analysis.weeks[i];
    if (prev.tonnage > 0) {
      const jump = (cur.tonnage - prev.tonnage) / prev.tonnage;
      if (jump > 0.3) {
        flags.push({ tone: 'warn', text: `Objem skočil o ${Math.round(jump * 100)} % mezi týdnem ${prev.week} a ${cur.week}. Bezpečný přírůstek je do 10 % týdně.` });
      }
    }
  }

  for (const l of analysis.mainLifts) {
    if (l.avgIntensity > 0 && l.avgIntensity < 65) {
      flags.push({ tone: 'low', text: `${liftLabel(l.lift)}: průměrná intenzita ${num2(l.avgIntensity, 1)} %. Na rozvoj síly je to málo, sedí spíš do objemové fáze.` });
    }
    if (l.avgIntensity >= 87) {
      flags.push({ tone: 'warn', text: `${liftLabel(l.lift)}: průměrná intenzita ${num2(l.avgIntensity, 1)} %. Dlouhodobě to jede přes CNS — hlídej techniku a spánek.` });
    }
  }

  const g = gradeAcwr(acwrRatio);
  if (g.tone === 'bad' || g.tone === 'warn') {
    flags.push({ tone: g.tone, text: `Poměr akutní ku chronické zátěži je ${num2(acwrRatio)} — ${g.label.toLowerCase()}. Bezpečné pásmo je 0,8 až 1,3.` });
  }

  if (analysis.weeks.length >= 3) {
    const t = taperCheck(analysis.weeks);
    if (t && t.drop < 30) {
      flags.push({ tone: 'warn', text: `Poslední týden ubral jen ${num2(t.drop, 0)} % objemu. Před testem nebo závodem se snižuje o 41 až 50 % při zachované intenzitě.` });
    } else if (t && !t.intensityKept && t.drop >= 30) {
      flags.push({ tone: 'warn', text: `Objem klesl o ${num2(t.drop, 0)} %, ale spadla i intenzita. Při vrcholení se od těžkých vah neodchází — jinak přijdeš o formu, ne o únavu.` });
    }
  }

  if (!flags.some((f) => f.tone === 'bad' || f.tone === 'warn')) {
    flags.unshift({
      tone: 'ok',
      text: `Blok drží pohromadě: průměrná intenzita ${num2(analysis.total.avgIntensity, 1)} %, INOL ${num2(analysis.total.inolPerLiftWeek)} na cvik a týden, objem roste postupně.`,
    });
  }
  return flags.slice(0, 6);
}

const num2 = (v, d = 2) => (v == null ? '—' : String(round(v, d)).replace('.', ','));

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
export function hardSets(entries, e1rms, startDate) {
  const weeks = new Map();
  for (const e of entries) {
    const e1 = e1rms[e.lift] ?? 0;
    if (!isHardSet(e, e1)) continue;
    const w = Math.max(1, Math.floor(daysBetween(startDate, e.date) / 7) + 1);
    if (!weeks.has(w)) weeks.set(w, {});
    const row = weeks.get(w);
    row[e.lift] = (row[e.lift] ?? 0) + e.sets;
  }
  return [...weeks.entries()].sort((a, b) => a[0] - b[0]).map(([week, lifts]) => ({ week, lifts }));
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
