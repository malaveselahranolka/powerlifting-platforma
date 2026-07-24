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

/* ---------- Prilepinova tabulka ---------- */
export const PRILEPIN = [
  { key: 'z1', label: '< 70 %', min: 0, max: 69.999, reps: '3–6', optimal: 24, range: [18, 30], color: '#178F5C' },
  { key: 'z2', label: '70–79 %', min: 70, max: 79.999, reps: '3–6', optimal: 18, range: [12, 24], color: '#E8B00A' },
  { key: 'z3', label: '80–89 %', min: 80, max: 89.999, reps: '2–4', optimal: 15, range: [10, 20], color: '#1C61B8' },
  { key: 'z4', label: '≥ 90 %', min: 90, max: 999, reps: '1–2', optimal: 7, range: [4, 10], color: '#D8232F' },
];

/* ---------- INOL pásma ---------- */
export const INOL_SESSION = [
  { max: 0.4, label: 'Málo', tone: 'low', note: 'Podnět nestačí na adaptaci.' },
  { max: 1.0, label: 'Optimální', tone: 'ok', note: 'Zvládnutelná dávka, dobrá regenerace.' },
  { max: 2.0, label: 'Náročné', tone: 'warn', note: 'Sedí do akumulační fáze.' },
  { max: 99, label: 'Extrém', tone: 'bad', note: 'Přetížení. Použij výjimečně.' },
];

export const INOL_WEEK = [
  { max: 2.0, label: 'Lehký týden', tone: 'low', note: 'Deload nebo úvod bloku.' },
  { max: 3.0, label: 'Udržitelné', tone: 'ok', note: 'Náročné, ale opakovatelné.' },
  { max: 4.0, label: 'Vysoká zátěž', tone: 'warn', note: 'Max 1–2 týdny v řadě.' },
  { max: 99, label: 'Nedoporučeno', tone: 'bad', note: 'Riziko přetrénování.' },
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

/* ---------- Cviky ---------- */
export const LIFTS = {
  squat: { label: 'Dřep', short: 'DŘ', comp: true, color: '#D8232F' },
  bench: { label: 'Benčpres', short: 'BP', comp: true, color: '#1C61B8' },
  deadlift: { label: 'Mrtvý tah', short: 'MT', comp: true, color: '#E8B00A' },
  accessory: { label: 'Doplňkový cvik', short: 'DOP', comp: false, color: '#178F5C' },
};

export const COMP_LIFTS = ['squat', 'bench', 'deadlift'];

/* ---------- Šablony bloků ---------- */
export const BLOCK_TEMPLATES = {
  hypertrophy: {
    label: 'Akumulace / objem',
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
