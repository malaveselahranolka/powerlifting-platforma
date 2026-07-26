// Konstanty a referenční tabulky. Žádná logika — jen čísla.

/* ---------- RPE / RTS tabulka (Tuchscherer) ----------
   Tabulka je ve skutečnosti jedna řada: každý půl-bod RPE dolů = půl opakování navíc.
   index = (reps - 1) * 2 + (10 - rpe) * 2   →   % z 1RM                            */
export const RPE_SEQ = [
  100.0, 97.8, 95.5, 94.3, 92.2, 91.0, 89.2, 88.0, 86.3, 85.0, 83.7,
  82.4, 81.1, 79.9, 78.6, 77.4, 76.2, 75.1, 73.9, 72.3, 70.7, 69.4,
  68.0, 66.7, 65.3, 64.0, 62.6, 61.3, 59.9, 58.6, 57.2, 55.9, 54.5,
];

export const RPE_STEPS = [10, 9.5, 9, 8.5, 8, 7.5, 7, 6.5, 6];
export const REP_STEPS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

/* ---------- Vzorce pro odhad 1RM ---------- */
export const FORMULAS = {
  rpe: { label: 'RPE / RTS', note: 'Potřebuje RPE. Nejpřesnější pro powerlifting.' },
  epley: { label: 'Epley', note: 'Nadhodnocuje nad 10 opakování.' },
  brzycki: { label: 'Brzycki', note: 'Dobré do 10 opakování, pak padá.' },
  lombardi: { label: 'Lombardi', note: 'Mocninný vztah, mírnější růst.' },
  oconner: { label: "O'Conner", note: 'Konzervativní, lineární.' },
  wathan: { label: 'Wathan', note: 'Exponenciální, sedí na vyšší opakování.' },
  mayhew: { label: 'Mayhew', note: 'Vyvinuto na benčpresu.' },
  landers: { label: 'Landers', note: 'Lineární, platí do ~10 opakování.' },
  weightDependent: { label: 'Váhově závislá (2026)', note: 'Jediná počítá jinak s lehkou a těžkou činkou. Preprint, ne default.' },
};

/* ---------- Kotouče ---------- */
// Barvy podle IPF kalibrovaných kotoučů. Průměr v mm kvůli vykreslení.
export const PLATES_KG = [
  { kg: 25, color: '#D8232F', mm: 450 },
  { kg: 20, color: '#1C61B8', mm: 450 },
  { kg: 15, color: '#E8B00A', mm: 450 },
  { kg: 10, color: '#178F5C', mm: 325 },
  { kg: 5, color: '#E8E3D8', mm: 228 },
  { kg: 2.5, color: '#D8232F', mm: 190 },
  { kg: 2, color: '#1C61B8', mm: 160 },
  { kg: 1.5, color: '#E8B00A', mm: 140 },
  { kg: 1.25, color: '#178F5C', mm: 125 },
  { kg: 1, color: '#E8E3D8', mm: 112 },
  { kg: 0.5, color: '#9AA3AC', mm: 100 },
  { kg: 0.25, color: '#9AA3AC', mm: 90 },
];

export const PLATES_LB = [
  { kg: 45, color: '#D8232F', mm: 450 },
  { kg: 35, color: '#1C61B8', mm: 450 },
  { kg: 25, color: '#E8B00A', mm: 400 },
  { kg: 10, color: '#178F5C', mm: 325 },
  { kg: 5, color: '#E8E3D8', mm: 228 },
  { kg: 2.5, color: '#9AA3AC', mm: 190 },
  { kg: 1.25, color: '#9AA3AC', mm: 150 },
];

export const DEFAULT_INVENTORY_KG = { 25: 8, 20: 2, 15: 1, 10: 1, 5: 1, 2.5: 1, 1.25: 1, 0.5: 1, 0.25: 1 };
export const DEFAULT_INVENTORY_LB = { 45: 8, 25: 1, 10: 1, 5: 1, 2.5: 1, 1.25: 1 };

/* ---------- Prilepinova tabulka ----------
   Zóny jsou uspořádané, ne rovnocenné kategorie: < 70 % je míň než ≥ 90 %.
   Proto jeden odstín ve čtyřech krocích (světlý → tmavý), ne čtyři různé
   barvy. Duha na uspořádaná data nutí čtenáře luštit legendu; jeden odstín
   se čte rovnou. Kotoučové barvy zůstaly tam, kde znamenají kotouč —
   na vykreslené ose a ve skladu.                                        */
export const PRILEPIN = [
  { key: 'z1', label: '< 70 %', min: 0, max: 69.999, reps: '3–6', optimal: 24, range: [18, 30], color: 'var(--zone-1)' },
  { key: 'z2', label: '70–79 %', min: 70, max: 79.999, reps: '3–6', optimal: 18, range: [12, 24], color: 'var(--zone-2)' },
  { key: 'z3', label: '80–89 %', min: 80, max: 89.999, reps: '2–4', optimal: 15, range: [10, 20], color: 'var(--zone-3)' },
  { key: 'z4', label: '≥ 90 %', min: 90, max: 999, reps: '1–2', optimal: 7, range: [4, 10], color: 'var(--zone-4)' },
];

/* ---------- Koeficienty pro skóre ---------- */
// DOTS: total * 500 / (a + b·bw + c·bw² + d·bw³ + e·bw⁴)
export const DOTS_COEF = {
  m: [-307.75076, 24.0900756, -0.1918759221, 0.0007391293, -0.000001093],
  f: [-57.96288, 13.6175032, -0.1126655495, 0.0005158568, -0.0000010706],
};

// IPF GL (platné od 1. 5. 2020): total * 100 / (A - B · e^(-C·bw))
export const IPF_GL_COEF = {
  m: {
    classic: { total: [1199.72839, 1025.18162, 0.00921], bench: [320.98041, 281.40258, 0.01008] },
    equipped: { total: [1236.25115, 1449.21864, 0.01644], bench: [381.22073, 733.79378, 0.02398] },
  },
  f: {
    classic: { total: [610.32796, 1045.59282, 0.03048], bench: [142.40398, 442.52671, 0.04724] },
    equipped: { total: [758.63878, 949.31382, 0.02435], bench: [221.82209, 357.00377, 0.02937] },
  },
};

// Wilks (originál 1994)
export const WILKS_COEF = {
  m: [-216.0475144, 16.2606339, -0.002388645, -0.00113732, 0.00000701863, -0.00000001291],
  f: [594.31747775582, -27.23842536447, 0.82112226871, -0.00930733913, 0.00004731582, -0.00000009054],
};

/* ---------- Váhové kategorie IPF (klasický i vybavený) ---------- */
export const WEIGHT_CLASSES = {
  m: [53, 59, 66, 74, 83, 93, 105, 120, Infinity],
  f: [43, 47, 52, 57, 63, 69, 76, 84, Infinity],
};

/* ---------- Kritické hodnoty t-rozdělení ----------
   Oboustranné, 95 %, pro stupně volnosti 1–30. Nad 30 se blíží 1,96.
   Používá se u intervalu spolehlivosti sklonu trendu.                       */
export const T95 = [
  12.706, 4.303, 3.182, 2.776, 2.571, 2.447, 2.365, 2.306, 2.262, 2.228,
  2.201, 2.179, 2.160, 2.145, 2.131, 2.120, 2.110, 2.101, 2.093, 2.086,
  2.080, 2.074, 2.069, 2.064, 2.060, 2.056, 2.052, 2.048, 2.045, 2.042,
];

/* ---------- Modely taperu ----------
   Grgic a Mikulic (2017), 10 chorvatských šampionů open kategorie: délka
   asi 2,5 týdne, pokles objemu 50,5 ± 11,7 %, intenzita udržená nebo zvýšená,
   vrchol intenzity 8 ± 3 dny před závodem, poslední trénink 3–4 dny předem.

   POZOR: je to dotazníkový průzkum na deseti lidech. Popisuje, co šampioni
   dělají — ne důkaz, že je to nejlepší možné.

   Řízený pokus (Frontiers in Physiology 2021, PMC8582352) porovnal krokový
   a exponenciální taper. Dřep a bench vyšly srovnatelně, ale mrtvý tah
   u krokového taperu nevzrostl vůbec (+1 %, nevýznamně) a u exponenciálního
   o 8 %. Obě skupiny přitom měly stejnou celkovou práci.                    */
export const TAPER_REFERENCE = {
  lengthWeeks: 2.5,
  volumeDrop: { mean: 50.5, sd: 11.7 },
  intensityPeakDaysBefore: { mean: 8, sd: 3 },
  lastSessionDaysBefore: [3, 4],
  n: 10,
};

export const TAPER_MODELS = {
  step: {
    label: 'Krokový',
    days: 7,
    note: 'Jednorázový škrt objemu na začátku posledního týdne, pak už se nic nemění. Jednoduchý, u benče a krátkých vrcholení stačí.',
    warn: 'V řízeném pokusu u něj mrtvý tah nevzrostl vůbec (+1 %, nevýznamně), zatímco u exponenciálního o 8 %.',
    volumeAt: () => 0.5,
  },
  linear: {
    label: 'Lineární',
    days: 14,
    note: 'Rovnoměrný pokles na polovinu. Z analytického řešení dvousložkového modelu vychází jako optimální tehdy, když kondice odeznívá exponenciálně.',
    warn: null,
    volumeAt: (d, days) => 1 - 0.5 * (d / days),
  },
  exponential: {
    label: 'Exponenciální',
    days: 21,
    note: 'Rychlý pokles na začátku, pak doznívání k polovině objemu. V řízeném pokusu jako jediný zvedl i mrtvý tah.',
    warn: null,
    /* klesá k 50 %, ne k nule — obě větve pokusu skončily na zhruba polovině
       výchozí práce, lišil se jen tvar cesty a délka */
    volumeAt: (d, days) => 0.5 + 0.5 * Math.exp(-d / (days / 3)),
  },
};

/* ---------- Časování závodního dne ----------
   Všechno jsou konstanty z trenérské praxe (EliteFTS, PowerliftingTechnique),
   žádná recenzovaná data. Tempo závodu reálně kolísá, proto jde minuta
   na pokus v UI přenastavit.                                               */
export const MEET_TIMING = {
  minPerAttempt: 1,
  restBetweenWarmups: 6,        // minut, na závodě se dělí náčiní
  lastWarmupLiftersBefore: 10,  // poslední rozcvičovací série tolik závodníků před otvírákem
  warmupRoomBefore: { squat: 30, bench: 20, deadlift: 20 },
  flightSize: [10, 15],
  lastWarmupMaxPct: 0.9,        // poslední rozcvička pod 90 % otvíráku
};

/* ---------- Srovnání úspěšnosti pokusů ----------
   Rozbor mistrovství světa IPF. Čísla 91 a 96 % jsou POdmíněná úspěchem —
   počítala se jen ze závodníků, kteří třetí pokus dali. Neznamenají tedy,
   že otvírák na 91 % maximalizuje součet.                                  */
export const ATTEMPT_BENCHMARK = {
  winners: 8.46,
  average: 6.66,
  outOf: 9,
  thirdAttemptSuccess: [0.5, 0.8],
  secondAttemptSuccess: [0.75, 1.0],
};

/* ---------- Percentily relativní síly ----------
   Normativní data z 809 986 startů (J Sci Med Sport 2024,
   doi 10.1016/j.jsams.2024.06.008), testovaní na doping, klasika.

   POZOR: z placeného textu se podařilo ověřit JEN 90. percentil a jen pro dvě
   věkové skupiny. Zbytek tabulky appka nedopočítává — interpolovat chybějící
   percentily a vydávat je za data by byl výmysl. Proto se tu neukazuje
   „jsi na 63. percentilu", ale jen jestli je závodník nad hranicí, nebo pod ní. */
export const STRENGTH_P90 = {
  young: {
    label: '18–35 let',
    m: { squat: 2.83, bench: 1.95, deadlift: 3.25 },
    f: { squat: 2.26, bench: 1.35, deadlift: 2.66 },
  },
  old: {
    label: 'nad 80 let',
    m: { squat: 1.72, bench: 1.31, deadlift: 2.30 },
    f: { squat: 1.01, bench: 0.92, deadlift: 1.68 },
  },
};

/* ---------- Sheikova distribuce objemu ----------
   Normy z programů Sheika a rozborů PowerliftingToWin. Byly psané pro
   sovětské a ruské profesionály, často farmakologicky podpořené — slepé
   kopírování počtu zvedů je běžná chyba.                                   */
export const SHEIKO_NORMS = {
  mainBand: [70, 80],
  repsPerSetMax: 5,
  liftsPerLiftPerMonth: [300, 350],
  frequency: { squat: 2, bench: 3, deadlift: 1 },
};

/* ---------- 5/3/1 (Wendler) ----------
   Procenta se počítají z tréninkového maxima (90 % skutečného 1RM),
   ne ze skutečného maxima.                                                 */
export const WENDLER_531 = {
  tmPct: 0.9,
  weeks: [
    { label: '5', sets: [[65, 5], [75, 5], [85, '5+']] },
    { label: '3', sets: [[70, 3], [80, 3], [90, '3+']] },
    { label: '5/3/1', sets: [[75, 5], [85, 3], [95, '1+']] },
    { label: 'deload', sets: [[40, 5], [50, 5], [60, 5]] },
  ],
  progressKg: { squat: 5, deadlift: 5, bench: 2.5 },
  /* očekávaná opakování na poslední sérii; míň znamená, že je maximum nadsazené */
  amrapFloor: { '5': 5, '3': 3, '5/3/1': 1 },
};

/* ---------- Další šablony ----------
   Texas i vlnové zatížení jsou trenérská praxe bez přímé evidence. Denní
   maxima mají jen pilotní data a pro naprostou většinu naturálních závodníků
   se nedoporučují — appka je nabízí, ale s varováním.                       */
export const OTHER_TEMPLATES = {
  texas: {
    label: 'Texas Method',
    note: 'Pondělí objem 5×5 na 90 % pondělního pětkového maxima, středa lehce 2×5 na 80 % pondělní váhy, pátek nové pětkové maximum.',
    warn: 'Pro pokročilé trojbojaře je to už překonané — týdenní progrese nevydrží.',
    evidence: 'Rippetoe a Baker, Practical Programming — trenérská praxe.',
  },
  wave: {
    label: 'Vlnové zatížení',
    note: 'Dvě vlny 3–2–1, druhá o 2,5 kg těžší než první.',
    warn: 'Žádná přímá evidence. Ber to jako generátor sérií, ne jako doporučení.',
    evidence: 'Trenérská praxe.',
  },
  dailymax: {
    label: 'Denní maximum',
    note: 'Každý trénink se jde na maximum dne, pak pár zpětných sérií.',
    warn: 'VYSOKÉ RIZIKO. Jen pilotní data na malém vzorku. Pro drtivou většinu naturálních závodníků se nedoporučuje.',
    evidence: 'Pilotní studie PMC6162635, malý vzorek.',
  },
};

/* ---------- Bloková periodizace (Issurin) ---------- */
export const ISSURIN_BLOCKS = [
  { key: 'akumulace', label: 'Akumulace', weeks: 6, intensity: [60, 75], note: 'Vysoký objem, nízká až střední intenzita.' },
  { key: 'transmutace', label: 'Transmutace', weeks: 6, intensity: [75, 87.5], note: 'Tři až šest opakování, delší pauzy.' },
  { key: 'realizace', label: 'Realizace', weeks: 4, intensity: [85, 100], note: 'Nízký objem, nejvyšší intenzita, taper.' },
];

/* ---------- Shazování váhy ----------
   Campbell a kol. (2025): shazuje 97 % trojbojařů, typicky 4,2 % hmotnosti.
   Relativně bezpečné pásmo z přehledů je 3–5 %. Řízený pokus (PMC12392435)
   ukázal, že při zhruba pěti procentech a krátké regeneraci se maximální síla
   udrží — ale délka mezi vážením a startem je zásadní proměnná a liší se
   federaci od federace.                                                    */
export const CUT_BANDS = [
  { max: 2, label: 'Nízké riziko', tone: 'ok', note: 'Zvládne se dietou a vyprázdněním střev, bez akutní dehydratace.' },
  { max: 5, label: 'Střední riziko', tone: 'warn', note: 'Uvnitř pásma, které přehledy považují za relativně bezpečné. Regenerace po vážení je zásadní.' },
  { max: 999, label: 'Vysoké riziko', tone: 'bad', note: 'Nad 5 % tělesné hmotnosti. Mimo doporučené pásmo — reálné riziko poklesu výkonu i zdravotních potíží.' },
];

export const CUT_FACTS = {
  prevalence: 97,
  typicalPct: 4.2,
  regional: 5.5,
  international: 3.3,
  womenMax: 6.7,
  menMax: 5.3,
  negativePsych: 70,
};

/* ---------- Varianty soutěžních cviků ----------
   Pauzovaný dřep, deficitní tah nebo bench úzkým úchopem nemají vlastní
   změřené maximum a nikdo je kvůli tomu netestuje — odvozují se procentem
   ze soutěžního cviku. Bez toho spadnou do „doplňkových cviků" a vypadnou
   z intenzity, INOL, Prilepina i tvrdých sérií podle intenzity, přestože
   tvoří většinu práce v seriózním bloku.

   POZOR: žádná recenzovaná tabulka těchhle koeficientů neexistuje. Jsou to
   hodnoty z trenérské praxe a mezi zdroji se liší, u některých variant
   klidně o deset procentních bodů. Slouží jako výchozí odhad, který se má
   u konkrétního závodníka doladit — proto jdou v profilu přepsat.

   `range` je rozptyl, který se v praxi uvádí, aby bylo poznat, kde je
   shoda a kde ne. Nad 100 % jsou varianty se zkráceným rozsahem pohybu.  */
export const VARIANTS = {
  /* dřep */
  pauseSquat: { label: 'Pauzovaný dřep', base: 'squat', pct: 0.88, range: [0.85, 0.90] },
  boxSquat: { label: 'Box squat', base: 'squat', pct: 0.92, range: [0.90, 0.95] },
  frontSquat: { label: 'Přední dřep', base: 'squat', pct: 0.82, range: [0.80, 0.85] },
  tempoSquat: { label: 'Tempo dřep', base: 'squat', pct: 0.82, range: [0.80, 0.85] },
  /* benčpres */
  closeGrip: { label: 'Bench úzkým úchopem', base: 'bench', pct: 0.92, range: [0.90, 0.95] },
  spotoPress: { label: 'Spoto press', base: 'bench', pct: 0.91, range: [0.90, 0.93] },
  pinPress: { label: 'Pin press', base: 'bench', pct: 0.90, range: [0.88, 0.93] },
  larsenPress: { label: 'Larsen press', base: 'bench', pct: 0.90, range: [0.88, 0.92] },
  /* mrtvý tah */
  deficitDeadlift: { label: 'Deficitní tah', base: 'deadlift', pct: 0.90, range: [0.88, 0.92] },
  blockPull: { label: 'Tah z bloků', base: 'deadlift', pct: 1.07, range: [1.05, 1.10] },
  rackPull: { label: 'Rack pull', base: 'deadlift', pct: 1.15, range: [1.10, 1.20] },
  pauseDeadlift: { label: 'Pauzovaný tah', base: 'deadlift', pct: 0.88, range: [0.85, 0.90] },
};

/* ---------- Spolehlivost nahlášeného RPE ----------
   Zourdos a kol. (2016): směrodatná odchylka nahlášeného RPE u zkušených
   dřepařů podle relativní intenzity. Čím lehčí série, tím hůř se RPE
   odhaduje — desítka na šestce nese skoro nulovou informaci.

   Používá se k vážení odhadů maxima: série se spolehlivějším RPE má
   v souhrnu větší váhu.                                                  */
export const RPE_SD_BY_PCT = [[60, 1.18], [75, 0.97], [90, 0.92], [100, 0.32]];

/* ---------- Rychlost tyče (VBT) ----------
   Průměrná propulzní rychlost v m·s⁻¹ podle relativní intenzity.

   POZOR na původ dat: tahle tabulka pochází od mladých rekreačně trénovaných
   lidí a měřilo se na Smithově stroji, ne na volné ose („Bar Load-Velocity
   Profile of Full Squat and Bench Press", PMC9180020). Na volnou osu se
   nepřenáší jedna k jedné a mezi jednotlivci kolísá o 11 až 25 % — proto
   je to referenční orientace, ne předpis. Vlastní změřený profil je vždycky
   lepší než tabulka.

   Mrtvý tah tady schválně není: publikovaná data pro něj v týhle podobě
   nejsou a profilování rychlosti u něj navíc nefunguje (viz MVT níž).       */
export const LOAD_VELOCITY = {
  squat: {
    m: [[50, 0.87, 0.08], [60, 0.70, 0.07], [70, 0.61, 0.09], [80, 0.49, 0.12], [100, 0.26, 0.11]],
    f: [[50, 0.81, 0.09], [60, 0.64, 0.11], [70, 0.55, 0.10], [80, 0.42, 0.11], [100, 0.23, 0.06]],
  },
  bench: {
    m: [[50, 0.92, 0.10], [60, 0.70, 0.10], [70, 0.57, 0.10], [80, 0.42, 0.09], [100, 0.21, 0.10]],
    f: [[50, 0.82, 0.09], [60, 0.63, 0.09], [70, 0.51, 0.10], [80, 0.36, 0.08], [100, 0.19, 0.07]],
  },
};

/* Skutečná průměrná koncentrická rychlost při 1RM u elitních trojbojařů na
   volné ose — Helms a kol. (2017), JSCR 31(2):292–7, n = 15. Tohle je jiná
   veličina než MVT z profilu níž a nesmí se s ní plést.                     */
export const VELOCITY_AT_1RM = {
  squat: { v: 0.23, sd: 0.05, rpe: 9.6 },
  bench: { v: 0.10, sd: 0.04, rpe: 9.7 },
  deadlift: { v: 0.14, sd: 0.05, rpe: 9.6 },
};

/* Minimální prahová rychlost — rychlost posledního zvládnutého opakování.
   Do odhadu 1RM z profilu se dosazuje právě tahle hodnota.                  */
export const MVT = {
  bench: { v: 0.15, sd: 0.03, note: 'n = 68 profesionálních ragbistů', usable: true },
  squat: { v: 0.25, sd: 0.03, note: 'box squat, n = 12; literatura uvádí 0,27–0,30', usable: true },
  deadlift: { v: 0.31, sd: null, note: 'z profilu 0,28–0,34 — pro odhad 1RM se NEPOUŽÍVÁ, viz varování', usable: false },
};

/* Práh poklesu rychlosti v sérii — nejlíp podložená část VBT.
   Jukic a kol. (2023), Sports Medicine, doi 10.1007/s40279-022-01754-4.     */
export const VELOCITY_LOSS = [
  { max: 10, label: 'Málo únavy', tone: 'low', note: 'Pod 10 % je podnět na adaptaci slabý.' },
  { max: 25, label: 'Maximální síla', tone: 'ok', note: '10–25 % je pásmo, ve kterém síla roste nejefektivněji.' },
  { max: 40, label: 'Hypertrofie', tone: 'warn', note: 'Nad 25 % se nabírá objem, za cenu vyšší únavy.' },
  { max: 999, label: 'Bez dalšího přínosu', tone: 'bad', note: 'Nad 40 % už se nic navíc nezíská, jen se hromadí únava.' },
];

/* ---------- Podíly cviků na součtu ----------
   Hernández Ugalde (2023), „Powerlifting Balance Of SBD Disciplines Ratio To
   Total Score", Int J Strength Cond 3(1), doi 10.47206/ijsc.v3i1.198.
   Data z OpenPowerlifting, závody IPF 2012–2022, věk 24–39;
   n = 65 867 ♂ klasika, 35 679 ♀ klasika, 19 295 ♂ vybavení, 7 426 ♀ vybavení.

   `mean` a `sd` jsou z elitní skupiny (90.–100. kvantil IPF GL), `min` a `max`
   ohraničují „Optimal Ratio Range" = mean ± f · sd, kde f autor optimalizoval
   zvlášť pro každou kategorii.

   Zápis: [mean, sd, min, max] v procentech součtu.

   `firm` říká, jestli autor pro danou kategorii našel statistickou podporu.
   U mužské klasiky ji uvádí jen pro 66, 74, 93, 105 a +120 kg — jinde se
   pásmo bere jako orientační cíl, ne jako verdikt.                       */
export const SBD_RATIOS = {
  classic: {
    m: [
      { limit: 59, firm: false, sq: [36.29, 2.55, 31.71, 40.87], bp: [24.57, 1.77, 21.40, 27.75], dl: [39.13, 2.98, 33.76, 44.51] },
      { limit: 66, firm: true, sq: [35.53, 1.76, 32.72, 38.34], bp: [24.11, 1.84, 21.17, 27.05], dl: [40.36, 1.94, 37.25, 43.47] },
      { limit: 74, firm: true, sq: [35.67, 1.56, 33.17, 38.17], bp: [23.69, 1.99, 20.51, 26.87], dl: [40.64, 2.15, 37.20, 44.07] },
      { limit: 83, firm: false, sq: [35.75, 1.64, 33.45, 38.05], bp: [23.80, 2.03, 20.95, 26.64], dl: [40.45, 2.16, 37.43, 43.47] },
      { limit: 93, firm: true, sq: [35.96, 1.69, 33.77, 38.15], bp: [23.97, 1.94, 21.45, 26.48], dl: [40.07, 1.96, 37.52, 42.62] },
      { limit: 105, firm: true, sq: [36.17, 1.70, 34.14, 38.21], bp: [24.19, 1.84, 21.99, 26.40], dl: [39.64, 2.11, 37.11, 42.16] },
      { limit: 120, firm: false, sq: [36.83, 1.83, 35.00, 38.66], bp: [24.51, 1.92, 22.59, 26.42], dl: [38.67, 2.08, 36.58, 40.75] },
      { limit: Infinity, firm: true, sq: [37.99, 2.22, 36.44, 39.54], bp: [24.73, 2.01, 23.32, 26.14], dl: [37.28, 2.39, 35.60, 38.95] },
    ],
    f: [
      { limit: 47, firm: true, sq: [35.46, 2.04, 32.19, 38.73], bp: [20.96, 2.27, 17.32, 24.60], dl: [43.58, 2.39, 39.76, 47.40] },
      { limit: 52, firm: true, sq: [35.67, 1.97, 32.72, 38.62], bp: [21.21, 2.33, 17.72, 24.70], dl: [43.12, 2.48, 39.41, 46.84] },
      { limit: 57, firm: true, sq: [36.01, 1.92, 33.32, 38.70], bp: [21.49, 2.31, 18.26, 24.73], dl: [42.50, 2.45, 39.07, 45.93] },
      { limit: 63, firm: true, sq: [36.38, 1.96, 33.83, 38.93], bp: [21.49, 2.31, 18.49, 24.49], dl: [42.13, 2.37, 39.05, 45.21] },
      { limit: 69, firm: true, sq: [36.46, 1.81, 34.11, 38.81], bp: [21.31, 2.19, 18.46, 24.16], dl: [42.23, 2.26, 39.29, 45.17] },
      { limit: 76, firm: true, sq: [36.70, 1.81, 34.52, 38.87], bp: [21.13, 2.10, 18.61, 23.65], dl: [42.17, 2.29, 39.42, 44.92] },
      { limit: 84, firm: true, sq: [37.17, 2.08, 35.09, 39.26], bp: [20.77, 2.21, 18.56, 22.98], dl: [42.06, 2.35, 39.71, 44.40] },
      { limit: Infinity, firm: true, sq: [38.79, 2.36, 36.66, 40.91], bp: [21.43, 2.48, 19.20, 23.65], dl: [39.79, 2.75, 37.31, 42.26] },
    ],
  },
  equipped: {
    m: [
      { limit: 59, firm: true, sq: [39.01, 1.24, 35.91, 42.11], bp: [25.47, 1.42, 21.93, 29.01], dl: [35.52, 1.93, 30.70, 40.34] },
      { limit: 66, firm: true, sq: [37.93, 1.91, 32.95, 42.91], bp: [25.88, 1.89, 20.96, 30.80], dl: [36.19, 1.89, 31.28, 41.10] },
      { limit: 74, firm: true, sq: [37.87, 1.36, 34.34, 41.41], bp: [26.10, 2.31, 20.11, 32.10], dl: [36.02, 2.34, 29.93, 42.12] },
      { limit: 83, firm: true, sq: [38.23, 1.56, 34.48, 41.97], bp: [26.84, 2.20, 21.55, 32.13], dl: [34.93, 2.10, 29.89, 39.97] },
      { limit: 93, firm: true, sq: [38.21, 1.52, 35.01, 41.41], bp: [27.11, 1.91, 23.10, 31.11], dl: [34.68, 1.87, 30.74, 38.62] },
      { limit: 105, firm: true, sq: [38.16, 1.43, 35.58, 40.74], bp: [27.79, 2.37, 23.52, 32.07], dl: [34.05, 2.33, 29.85, 38.25] },
      { limit: 120, firm: true, sq: [38.61, 1.40, 36.51, 40.72], bp: [28.10, 2.10, 24.95, 31.24], dl: [33.29, 2.28, 29.87, 36.72] },
      { limit: Infinity, firm: true, sq: [38.91, 1.29, 37.48, 40.33], bp: [29.23, 1.82, 27.23, 31.23], dl: [31.86, 1.81, 29.88, 33.85] },
    ],
    f: [
      { limit: 47, firm: true, sq: [39.13, 2.19, 35.40, 42.85], bp: [24.25, 3.22, 18.77, 29.72], dl: [36.63, 1.92, 33.37, 39.89] },
      { limit: 52, firm: true, sq: [39.22, 1.81, 36.32, 42.12], bp: [24.43, 2.59, 20.29, 28.57], dl: [36.35, 2.00, 33.16, 39.54] },
      { limit: 57, firm: true, sq: [38.86, 2.08, 35.73, 41.99], bp: [24.90, 2.51, 21.13, 28.67], dl: [36.24, 1.95, 33.31, 39.17] },
      { limit: 63, firm: true, sq: [38.45, 1.86, 35.66, 41.24], bp: [25.42, 2.82, 21.19, 29.66], dl: [36.13, 2.14, 32.92, 39.33] },
      { limit: 69, firm: true, sq: [38.49, 1.51, 36.54, 40.45], bp: [26.23, 2.43, 23.07, 29.38], dl: [35.28, 2.53, 31.99, 38.57] },
      { limit: 76, firm: true, sq: [39.19, 1.60, 37.58, 40.79], bp: [25.42, 2.51, 22.90, 27.93], dl: [35.40, 2.82, 32.58, 38.22] },
      { limit: 84, firm: true, sq: [39.86, 2.08, 38.19, 41.53], bp: [25.90, 2.98, 23.51, 28.28], dl: [34.24, 2.08, 32.58, 35.91] },
      { limit: Infinity, firm: true, sq: [39.70, 1.44, 38.39, 41.00], bp: [26.45, 3.50, 23.29, 29.60], dl: [33.86, 2.68, 31.45, 36.27] },
    ],
  },
};

/* ---------- Věkové koeficienty (McCulloch / Foster) ----------
   Index = věk v letech, hodnota = násobitel bodů (DOTS / Wilks / IPF GL),
   ne kilogramů. Varianta OpenPowerlifting: Fosterovy koeficienty pro dorost
   14–22, Glossbrennerem opravený McCulloch pro 41–80, USAPL pro 81–90.

   Nejsou to výsledky výzkumu — je to historicky dohodnutá federační tabulka
   bez publikované odvozovací rovnice. Krajní úseky (do 13 let a nad 90) jsou
   ve zdroji označené jako odhad a extrapolace; appka je proto při zobrazení
   označí za nespolehlivé.

   Pozor: WRPF používá pro stejné věky jiná čísla (např. 60 let: 1,340 vs
   1,380) a nad 80 let tabulku zastropuje. Appka jede variantu
   OpenPowerlifting a říká to.                                            */
export const AGE_COEFF = [
  0, 0, 0, 0, 0,
  1.73, 1.67, 1.61, 1.55, 1.49, 1.43, 1.38, 1.33, 1.28,
  1.23, 1.18, 1.13, 1.08, 1.06, 1.04, 1.03, 1.02, 1.01,
  1.00, 1.00, 1.00, 1.00, 1.00, 1.00, 1.00, 1.00,
  1.00, 1.00, 1.00, 1.00, 1.00, 1.00, 1.00, 1.00, 1.00, 1.00,
  1.010, 1.020, 1.031, 1.043, 1.055, 1.068, 1.082, 1.097, 1.113, 1.130,
  1.147, 1.165, 1.184, 1.204, 1.225, 1.246, 1.268, 1.291, 1.315, 1.340,
  1.366, 1.393, 1.421, 1.450, 1.480, 1.511, 1.543, 1.576, 1.610, 1.645,
  1.681, 1.718, 1.756, 1.795, 1.835, 1.876, 1.918, 1.961, 2.005, 2.050,
  2.096, 2.143, 2.190, 2.238, 2.287, 2.337, 2.388, 2.440, 2.494, 2.549,
  2.605, 2.662, 2.720, 2.779, 2.839, 2.900, 2.962, 3.025, 3.089, 3.154,
];

/** Věky, pro které je koeficient ve zdroji jen odhad nebo extrapolace. */
export const AGE_COEFF_SOLID = { min: 14, max: 90 };

/* ---------- Cviky ----------
   Tři soutěžní cviky jsou kategorie — dostanou tři odstíny ověřené na
   odlišitelnost i při barvosleposti (validátor: nejhorší pár ΔE 9,2 světlý
   / 9,4 tmavý motiv). Doplňky nejsou čtvrtá rovnocenná kategorie, ale
   „zbytek", takže jdou do neutrální šedé a nesoutěží o pozornost.       */
export const LIFTS = {
  squat: { label: 'Dřep', short: 'DŘ', comp: true, color: 'var(--series-1)' },
  bench: { label: 'Benčpres', short: 'BP', comp: true, color: 'var(--series-2)' },
  deadlift: { label: 'Mrtvý tah', short: 'MT', comp: true, color: 'var(--series-3)' },
  accessory: { label: 'Doplňkový cvik', short: 'DOP', comp: false, color: 'var(--series-other)' },
};

export const COMP_LIFTS = ['squat', 'bench', 'deadlift'];

/* ---------- Fáze mezocyklu ----------
   Blokovou periodizaci (Issurin) tvoří tři fáze, které se v makrocyklu
   opakují: akumulace (objem, work capacity) → transmutace (objem dolů,
   intenzita nahoru) → realizace (vrcholení, nejvyšší intenzita, nejnižší
   objem). Fáze jdou po sobě, takže berou stejnou pořadovou škálu jako
   intenzitní zóny — od nejsvětlejšího kroku k nejtmavšímu.              */
export const BLOCK_PHASES = {
  akumulace: { label: 'Akumulace', color: 'var(--zone-1)' },
  transmutace: { label: 'Transmutace', color: 'var(--zone-3)' },
  realizace: { label: 'Realizace', color: 'var(--zone-4)' },
};

/* ---------- Šablony bloků ---------- */
export const BLOCK_TEMPLATES = {
  hypertrophy: {
    label: 'Akumulace / objem',
    phase: 'akumulace',
    weeks: 4,
    note: 'Nižší intenzita, vyšší objem. Konec bloku deload.',
    waves: [
      { sets: 4, reps: 8, rpe: 7 },
      { sets: 4, reps: 8, rpe: 8 },
      { sets: 5, reps: 8, rpe: 8.5 },
      { sets: 3, reps: 6, rpe: 6 },
    ],
  },
  strength: {
    label: 'Síla',
    phase: 'transmutace',
    weeks: 4,
    note: 'Střední objem, rostoucí intenzita.',
    waves: [
      { sets: 4, reps: 5, rpe: 7 },
      { sets: 4, reps: 5, rpe: 8 },
      { sets: 5, reps: 4, rpe: 8.5 },
      { sets: 3, reps: 4, rpe: 6 },
    ],
  },
  peaking: {
    label: 'Vrcholení na závod',
    phase: 'realizace',
    weeks: 5,
    note: 'Klesající objem, rostoucí intenzita, poslední týden taper.',
    waves: [
      { sets: 4, reps: 3, rpe: 8 },
      { sets: 4, reps: 2, rpe: 8.5 },
      { sets: 3, reps: 2, rpe: 9 },
      { sets: 3, reps: 1, rpe: 9 },
      { sets: 2, reps: 1, rpe: 7 },
    ],
  },
};

/* ---------- Rozvržení tréninkového týdne ----------
   Podle počtu tréninkových dní přiřadí soutěžní cviky na jednotlivé dny.
   Cíl je každý soutěžní cvik zhruba dvakrát týdně — frekvence, kterou
   současná praxe považuje za rozumný základ. `main` jede hlavní vlnu
   (série/opakování/RPE ze šablony), `second` je lehčí doplňková práce,
   `acc` jsou doplňkové cviky bez měřeného 1RM.                          */
export const WEEK_SPLITS = {
  1: [
    { main: 'squat', second: 'bench', acc: ['Veslování', 'Hyperextenze'] },
  ],
  2: [
    { main: 'squat', second: 'bench', acc: ['Předkopávání', 'Hyperextenze'] },
    { main: 'deadlift', second: 'bench', acc: ['Veslování', 'Tlak s jednoručkami'] },
  ],
  3: [
    { main: 'squat', second: 'bench', acc: ['Předkopávání', 'Veslování'] },
    { main: 'bench', second: 'deadlift', acc: ['Tlak s jednoručkami'] },
    { main: 'deadlift', second: 'squat', acc: ['Zákopávání', 'Hyperextenze'] },
  ],
  4: [
    { main: 'squat', acc: ['Předkopávání', 'Zákopávání'] },
    { main: 'bench', acc: ['Tlak s jednoručkami', 'Triceps'] },
    { main: 'deadlift', acc: ['Hyperextenze', 'Veslování'] },
    { main: 'bench', second: 'squat', acc: ['Stahování kladky'] },
  ],
  5: [
    { main: 'squat', acc: ['Předkopávání'] },
    { main: 'bench', acc: ['Tlak s jednoručkami'] },
    { main: 'deadlift', acc: ['Hyperextenze'] },
    { main: 'squat', second: 'bench', acc: ['Zákopávání'] },
    { main: 'bench', acc: ['Triceps', 'Veslování'] },
  ],
  6: [
    { main: 'squat', acc: ['Předkopávání'] },
    { main: 'bench', acc: ['Tlak s jednoručkami'] },
    { main: 'deadlift', acc: ['Hyperextenze'] },
    { main: 'squat', acc: ['Zákopávání'] },
    { main: 'bench', acc: ['Triceps'] },
    { main: 'deadlift', second: 'squat', acc: ['Veslování'] },
  ],
};

/** Výchozí dny v týdnu podle počtu (0 = pondělí … 6 = neděle). */
export const DEFAULT_WEEKDAYS = {
  1: [0],
  2: [0, 3],
  3: [0, 2, 4],
  4: [0, 1, 3, 4],
  5: [0, 1, 2, 3, 4],
  6: [0, 1, 2, 3, 4, 5],
};

export const WEEKDAY_LABELS = ['Po', 'Út', 'St', 'Čt', 'Pá', 'So', 'Ne'];

/* ---------- Strategie pokusů na závodě ----------
   Kalibrováno podle rozboru mistrovství světa IPF v klasickém trojboji
   2012–2019: závodníci, kteří zvládli třetí pokus, otevírali v průměru
   na 91 % třetího pokusu a druhý brali na 96 %.                         */
export const ATTEMPT_STRATEGY = {
  safe: { label: 'Jistota', pct: [0.88, 0.945, 1.0], note: 'Otvírák sedne i ve špatný den — v tréninku by šel na trojku. Cíl je 9 z 9.' },
  standard: { label: 'Standard', pct: [0.91, 0.965, 1.02], note: 'Rozložení, které vychází z dat mistrovství světa IPF. Třetí pokus je mírné PR.' },
  aggressive: { label: 'Útok', pct: [0.93, 0.99, 1.05], note: 'Jde se na velké PR. Otvírák už není zadarmo — riziko nuly je reálné.' },
};

/* ---------- Doporučené skoky mezi pokusy ---------- */
export const ATTEMPT_JUMPS = {
  squat: [5, 7.5],
  deadlift: [5, 7.5],
  bench: [3, 5],
};

/* ---------- Hooperův dotazník pohody (Hooper a Mackinnon 1995) ---------- */
export const WELLNESS_ITEMS = [
  { key: 'sleep', label: 'Kvalita spánku', hint: '1 = výborná, 7 = velmi špatná' },
  { key: 'stress', label: 'Stres', hint: '1 = žádný, 7 = extrémní' },
  { key: 'fatigue', label: 'Únava', hint: '1 = žádná, 7 = extrémní' },
  { key: 'soreness', label: 'Bolestivost svalů', hint: '1 = žádná, 7 = extrémní' },
];

/* ---------- Tvrdé série na soutěžní cvik a týden ----------
   Mezníky MEV/MAV/MRV jsou původně na svalovou skupinu, kam se sčítají
   i doplňky a varianty. Na jeden soutěžní cvik proto platí nižší čísla —
   trojbojař běžně dělá 6 až 12 tvrdých sérií dřepu týdně a zbytek objemu
   dodají varianty. Popisky jsou orientační, ne předpis.                 */
export const SET_LANDMARKS = [
  { max: 0.5, label: 'Deload nebo volno', tone: 'low' },
  { max: 3, label: 'Udržovací dávka', tone: 'low' },
  { max: 6, label: 'Nízký objem', tone: 'warn' },
  { max: 14, label: 'Běžné pásmo', tone: 'ok' },
  { max: 22, label: 'Vysoký objem', tone: 'warn' },
  { max: 999, label: 'Velmi vysoký objem', tone: 'bad' },
];
