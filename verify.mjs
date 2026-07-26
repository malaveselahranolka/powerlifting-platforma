/**
 * Ověření výpočtů proti oficiálním zdrojům.
 *
 *   node verify.mjs
 *
 * Referenční hodnoty se počítají nezávisle přímo ze zveřejněných koeficientů,
 * ne z aplikace — kdyby se v calc.js něco rozbilo, test to chytí.
 *
 * Zdroje:
 *   RPE tabulka   Tuchscherer / RTS, hodnoty publikované v RPE kalkulačkách
 *   IPF GL        IPF, tabulka koeficientů platná od 1. 5. 2020
 *   DOTS, Wilks   referenční implementace OpenPowerlifting
 *   INOL          Hristov, „Designing Strength Programs with Prilepin's Table"
 *   ACWR / EWMA   Gabbett (2016), Williams a kol. (2017)
 *   Monotonie     Foster (1998)
 */

import * as C from './js/calc.js';
import { SBD_RATIOS as SBD, AGE_COEFF as AGE, LOAD_VELOCITY as LV, MVT,
  TAPER_REFERENCE, ATTEMPT_BENCHMARK, STRENGTH_P90, WENDLER_531, CUT_FACTS } from './js/data.js';

let failed = 0;
let passed = 0;

const near = (name, got, want, tol = 0.01) => {
  const ok = got != null && Number.isFinite(got) && Math.abs(got - want) <= tol;
  if (ok) { passed++; console.log(`  ok    ${name}`); }
  else { failed++; console.log(`  CHYBA ${name}: vyšlo ${got}, čekáno ${want} ±${tol}`); }
};

const group = (title) => console.log(`\n${title}`);

/** i-tý den od 1. 1. 2026 jako 'YYYY-MM-DD'. */
const isoDay = (i) => {
  const d = new Date(2026, 0, 1 + i);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

/* ---------------------------------------------------------------- */
group('RPE tabulka (Tuchscherer / RTS)');
const RPE_REF = {
  10: [100.0, 95.5, 92.2, 89.2, 86.3, 83.7, 81.1, 78.6],
  9: [95.5, 92.2, 89.2, 86.3, 83.7, 81.1, 78.6, 76.2],
  8: [92.2, 89.2, 86.3, 83.7, 81.1, 78.6, 76.2, 73.9],
  7: [89.2, 86.3, 83.7, 81.1, 78.6, 76.2, 73.9, 70.7],
};
for (const [rpe, row] of Object.entries(RPE_REF)) {
  row.forEach((want, i) => near(`RPE ${rpe} × ${i + 1} op. = ${want} %`, C.rpeToPct(i + 1, Number(rpe)), want, 0.001));
}
near('mimo tabulku vrací null', C.rpeToPct(20, 10) === null ? 1 : 0, 1, 0);

/* ---------------------------------------------------------------- */
group('IPF GL Points (IPF, koeficienty 2020)');
const gl = (t, bw, A, B, Cc) => t * (100 / (A - B * Math.exp(-Cc * bw)));
near('muži klasika 700 @ 93', C.ipfGL(700, 93, 'm', 'classic'), gl(700, 93, 1199.72839, 1025.18162, 0.00921));
near('ženy klasika 400 @ 63', C.ipfGL(400, 63, 'f', 'classic'), gl(400, 63, 610.32796, 1045.59282, 0.03048));
near('muži vybavení 900 @ 120', C.ipfGL(900, 120, 'm', 'equipped'), gl(900, 120, 1236.25115, 1449.21864, 0.01644));
near('ženy vybavení 500 @ 76', C.ipfGL(500, 76, 'f', 'equipped'), gl(500, 76, 758.63878, 949.31382, 0.02435));
near('muži bench klasika 200 @ 93', C.ipfGL(200, 93, 'm', 'classic', 'bench'), gl(200, 93, 320.98041, 281.40258, 0.01008));
near('ženy bench klasika 110 @ 63', C.ipfGL(110, 63, 'f', 'classic', 'bench'), gl(110, 63, 142.40398, 442.52671, 0.04724));
near('pod 35 kg vrací null', C.ipfGL(300, 30, 'm', 'classic') === null ? 1 : 0, 1, 0);

/* ---------------------------------------------------------------- */
group('DOTS (referenční koeficienty OpenPowerlifting)');
const poly4 = (bw, c) => c[0] + c[1] * bw + c[2] * bw ** 2 + c[3] * bw ** 3 + c[4] * bw ** 4;
const DOTS_M = [-307.75076, 24.0900756, -0.1918759221, 0.0007391293, -0.000001093];
const DOTS_F = [-57.96288, 13.6175032, -0.1126655495, 0.0005158568, -0.0000010706];
near('muži 700 @ 93', C.dots(700, 93, 'm'), (700 * 500) / poly4(93, DOTS_M));
near('ženy 400 @ 63', C.dots(400, 63, 'f'), (400 * 500) / poly4(63, DOTS_F));
near('ořez muži 250 kg → 210', C.dots(700, 250, 'm'), (700 * 500) / poly4(210, DOTS_M));
near('ořez ženy 200 kg → 150', C.dots(400, 200, 'f'), (400 * 500) / poly4(150, DOTS_F));

/* ---------------------------------------------------------------- */
group('Wilks 1994 (referenční koeficienty OpenPowerlifting)');
const poly5 = (bw, c) => c.reduce((s, k, i) => s + k * bw ** i, 0);
const W_M = [-216.0475144, 16.2606339, -0.002388645, -0.00113732, 0.00000701863, -0.00000001291];
const W_F = [594.31747775582, -27.23842536447, 0.82112226871, -0.00930733913, 0.00004731582, -0.00000009054];
near('muži 700 @ 93', C.wilks(700, 93, 'm'), (700 * 500) / poly5(93, W_M));
near('ženy 400 @ 63', C.wilks(400, 63, 'f'), (400 * 500) / poly5(63, W_F));
near('ořez muži 220 → 201,9', C.wilks(700, 220, 'm'), (700 * 500) / poly5(201.9, W_M));
near('ořez ženy 160 → 154,53', C.wilks(400, 160, 'f'), (400 * 500) / poly5(154.53, W_F));

/* ---------------------------------------------------------------- */
group('Vzorce pro odhad 1RM');
near('Epley 100 × 5', C.E1RM.epley(100, 5), 100 * (1 + 5 / 30), 0.001);
near('Epley na jedno opakování vrací váhu', C.E1RM.epley(100, 1), 100, 0.001);
near('Brzycki 100 × 5', C.E1RM.brzycki(100, 5), 100 * (36 / 32), 0.001);
near('Lombardi 100 × 5', C.E1RM.lombardi(100, 5), 100 * 5 ** 0.1, 0.001);
near("O'Conner 100 × 5", C.E1RM.oconner(100, 5), 100 * 1.125, 0.001);
near('Wathan 100 × 5', C.E1RM.wathan(100, 5), 10000 / (48.8 + 53.8 * Math.exp(-0.375)), 0.001);
near('Mayhew 100 × 5', C.E1RM.mayhew(100, 5), 10000 / (52.2 + 41.9 * Math.exp(-0.275)), 0.001);
near('Landers 100 × 5', C.E1RM.landers(100, 5), 10000 / (101.3 - 2.67123 * 5), 0.001);
near('RPE 180 × 5 @ 8', C.E1RM.rpe(180, 5, 8), (180 / 81.1) * 100, 0.05);
near('zpětně: E1RM 221,9 → 5 op. @ 8', C.weightFor(221.9482, 5, 8), 180, 0.01);

/* ---------------------------------------------------------------- */
group('INOL (Hristov)');
near('10 opakování na 70 %', C.inol(10, 70), 10 / 30, 0.0001);
near('10 opakování na 90 %', C.inol(10, 90), 10 / 10, 0.0001);
near('nad 95 % se drží strop', C.inol(5, 98), 5 / 5, 0.0001);

/* ---------------------------------------------------------------- */
group('Prilepinovy zóny');
near('69 % → pod 70', C.prilepinZone(69).key === 'z1' ? 1 : 0, 1, 0);
near('75 % → 70–79', C.prilepinZone(75).key === 'z2' ? 1 : 0, 1, 0);
near('85 % → 80–89', C.prilepinZone(85).key === 'z3' ? 1 : 0, 1, 0);
near('92 % → 90 a výš', C.prilepinZone(92).key === 'z4' ? 1 : 0, 1, 0);

/* ---------------------------------------------------------------- */
group('ACWR (Gabbett 2016 / Williams 2017)');
const flat = {};
for (let i = 0; i < 28; i++) flat[`2026-01-${String(1 + i).padStart(2, '0')}`] = 100;
near('konstantní zátěž → klouzavý 1,00', C.acwr(flat, new Date(2026, 0, 28)).ratio, 1.0, 0.02);
near('konstantní zátěž → EWMA 1,00', C.acwrEwma(flat, new Date(2026, 0, 28)).ratio, 1.0, 0.02);

const spike = {};
for (let i = 0; i < 28; i++) spike[`2026-01-${String(1 + i).padStart(2, '0')}`] = i < 21 ? 100 : 250;
const rollSpike = C.acwr(spike, new Date(2026, 0, 28)).ratio;
const ewmaSpike = C.acwrEwma(spike, new Date(2026, 0, 28)).ratio;
near('skok zátěže zvedne klouzavý nad 1,5', rollSpike > 1.5 ? 1 : 0, 1, 0);
near('EWMA na stejný skok reaguje mírněji', ewmaSpike < rollSpike ? 1 : 0, 1, 0);

/* ---------------------------------------------------------------- */
group('Monotonie a strain (Foster 1998)');
const week = { '2026-03-02': 300, '2026-03-04': 300, '2026-03-06': 300 };
const vals = [300, 0, 300, 0, 300, 0, 0];
const mean = vals.reduce((a, b) => a + b) / 7;
const sd = Math.sqrt(vals.reduce((s, v) => s + (v - mean) ** 2, 0) / 7);
const m = C.monotony(week, '2026-03-08');
near('monotonie = průměr ÷ směrodatná odchylka', m.monotony, mean / sd, 0.01);
near('strain = týdenní zátěž × monotonie', m.strain, 900 * (mean / sd), 1);

/* ---------------------------------------------------------------- */
group('APRE (Mann a kol. 2010)');
const ramp100 = C.apreRamp(100);
near('série 1 = 50 % ze 6RM', ramp100[0].weight, 50, 0.01);
near('série 2 = 75 % ze 6RM', ramp100[1].weight, 75, 0.01);
near('série 3 = 100 % ze 6RM', ramp100[2].weight, 100, 0.01);
near('0–2 opakování → −10 %', C.apreAdjust(100, 1).weight, 90, 0.01);
near('3–4 opakování → −5 %', C.apreAdjust(100, 4).weight, 95, 0.01);
near('5–7 opakování → beze změny', C.apreAdjust(100, 6).weight, 100, 0.01);
near('8–12 opakování → +5 %', C.apreAdjust(100, 10).weight, 105, 0.01);
near('13 a víc opakování → +10 %', C.apreAdjust(100, 15).weight, 110, 0.01);

/* ---------------------------------------------------------------- */
group('Těžké expozice (85 / 90 / 95 %)');
const hxE1rm = { squat: 200, bench: 100 };
const hxEntries = [
  { date: '2026-01-05', lift: 'squat', sets: 3, reps: 5, weight: 160 }, // 80 % — pod všemi prahy
  { date: '2026-01-12', lift: 'squat', sets: 1, reps: 1, weight: 172 }, // 86 % — jen ≥85
  { date: '2026-01-12', lift: 'bench', sets: 2, reps: 1, weight: 91 },  // 91 % — ≥85 i ≥90
  { date: '2026-01-19', lift: 'squat', sets: 1, reps: 1, weight: 192 }, // 96 % — všechny tři
];
const hx = C.heavyExposures(hxEntries, hxE1rm, '2026-01-05');
const hxW = (n) => hx.find((w) => w.week === n);
near('týden 1 (80 %) — žádná expozice', hxW(1).exposures[85], 0, 0);
near('týden 2 — 2 expozice ≥85 % (dřep i benč)', hxW(2).exposures[85], 2, 0);
near('týden 2 — 1 expozice ≥90 % (jen benč)', hxW(2).exposures[90], 1, 0);
near('týden 2 — 0 expozic ≥95 %', hxW(2).exposures[95], 0, 0);
near('týden 3 — 96 % projde přes všechny tři prahy', hxW(3).exposures[95], 1, 0);
near('týden 2 — 3 série dohromady nad 85 % (1 dřep + 2 benč)', hxW(2).sets[85], 3, 0);
near('týden 3 — 1 série nad 95 %', hxW(3).sets[95], 1, 0);

/* ---------------------------------------------------------------- */
group('Výsledky ze zápasu');
const meetAttempts = [
  { lift: 'squat', weight: 180, made: true },
  { lift: 'squat', weight: 190, made: false },
  { lift: 'squat', weight: 185, made: true },
  { lift: 'bench', weight: 120, made: true },
  { lift: 'bench', weight: 127.5, made: true },
  { lift: 'bench', weight: 132.5, made: false },
  { lift: 'deadlift', weight: 220, made: true },
  { lift: 'deadlift', weight: 230, made: true },
  { lift: 'deadlift', weight: 240, made: false },
];
near('součet = nejtěžší povedené pokusy (185+127,5+230)', C.meetTotal(meetAttempts), 542.5, 0.001);
near('nepovedený, i když těžší, se do součtu nepočítá', C.meetTotal([{ lift: 'squat', weight: 200, made: false }]), 0, 0);
const msr = C.meetSuccessRate(meetAttempts);
near('úspěšnost — počet povedených', msr.made, 6, 0);
near('úspěšnost — počet platných pokusů', msr.total, 9, 0);
near('úspěšnost — procento (6 z 9)', msr.pct, 67, 0.5);

/* ---------------------------------------------------------------- */
group('Doporučená úprava příštího týdne (RTS reprice)');
const waEntries = [
  { date: '2026-01-05', lift: 'squat', weight: 170, reps: 5, rpe: 8, actualRpe: 9 },
  { date: '2026-01-06', lift: 'squat', weight: 170, reps: 5, rpe: 8, actualRpe: 9 },
  { date: '2026-01-12', lift: 'squat', weight: 175, reps: 5, rpe: 8, actualRpe: 6 }, // týden 2 — nesmí ovlivnit týden 1
];
const wa = C.weeklyAdjustment(waEntries, 'squat', 1, '2026-01-05');
near('bere jen zapsané série z cílového týdne', wa.n, 2, 0);
near('plánovaný odhad maxima (170 kg @ RPE 8, 5 op. = 81,1 %)', wa.avgPlan, 17000 / 81.1, 0.05);
near('skutečný odhad maxima (170 kg @ RPE 9, 5 op. = 83,7 %)', wa.avgReal, 17000 / 83.7, 0.05);
near('poměr real ÷ plán', wa.ratio, (17000 / 83.7) / (17000 / 81.1), 0.001);
near('bez zapsaných dat pro cvik/týden vrací null', C.weeklyAdjustment(waEntries, 'bench', 1, '2026-01-05') === null ? 1 : 0, 1, 0);

/* ---------------------------------------------------------------- */
group('Hooperův index (Hooper a Mackinnon 1995)');
near('součet 4 položek (1–7)', C.hooperIndex({ sleep: 2, stress: 3, fatigue: 4, soreness: 3 }), 12, 0);
near('mimo rozsah 1–7 vrací null', C.hooperIndex({ sleep: 0, stress: 3, fatigue: 4, soreness: 3 }) === null ? 1 : 0, 1, 0);
const hooperHistory = [
  { date: '2026-02-01', sleep: 2, stress: 2, fatigue: 2, soreness: 2 }, // index 8
  { date: '2026-02-02', sleep: 3, stress: 2, fatigue: 3, soreness: 2 }, // index 10
  { date: '2026-02-03', sleep: 2, stress: 3, fatigue: 2, soreness: 3 }, // index 10
];
near('klouzavý průměr posledních záznamů (8,10,10 → 9,3)', C.hooperBaseline(hooperHistory, '2026-02-04'), (8 + 10 + 10) / 3, 0.05);
near('dnešní záznam se do vlastního průměru nepočítá', C.hooperBaseline(hooperHistory, '2026-02-03'), (8 + 10) / 2, 0.01);
near('o 3 body hůř než obvykle → varování', C.gradeHooper(13, 10).tone === 'warn' ? 1 : 0, 1, 0);
near('o 3 body líp než obvykle → v pořádku', C.gradeHooper(7, 10).tone === 'ok' ? 1 : 0, 1, 0);

/* ---------------------------------------------------------------- */
group('Detekce plateau na E1RM (šum vs. reálný trend)');
const flatPts = [
  { date: '2026-01-01', value: 200 },
  { date: '2026-01-11', value: 202 },
  { date: '2026-01-21', value: 198 },
  { date: '2026-01-31', value: 202 },
  { date: '2026-02-10', value: 198 },
];
const flatCheck = C.plateauCheck(flatPts);
near('šum kolem konstanty — reziduální rozptyl', flatCheck.residualSd, Math.sqrt(4.8), 0.01);
near('šum kolem konstanty — celkový posun přímky', flatCheck.totalMove, 1.6, 0.01);
near('šum kolem konstanty — appka to pozná jako plateau', flatCheck.plateau ? 1 : 0, 1, 0);

const risingPts = [
  { date: '2026-01-01', value: 200 },
  { date: '2026-01-11', value: 206 },
  { date: '2026-01-21', value: 212 },
  { date: '2026-01-31', value: 218 },
  { date: '2026-02-10', value: 224 },
];
const risingCheck = C.plateauCheck(risingPts);
near('čistý lineární růst — nulový reziduální rozptyl', risingCheck.residualSd, 0, 0.01);
near('čistý lineární růst — appka to nepozná jako plateau', risingCheck.plateau ? 0 : 1, 1, 0);
near('méně než 3 body vrací null', C.plateauCheck([{ date: '2026-01-01', value: 100 }, { date: '2026-01-11', value: 105 }]) === null ? 1 : 0, 1, 0);

/* ---------------------------------------------------------------- */
group('Nakládání osy');
const kg180 = C.loadBar(180, { bar: 20, collars: 5, unit: 'kg' });
near('180 kg vyjde přesně', kg180.total, 180, 0.001);
near('77,5 kg na jednu stranu', kg180.perSide, 77.5, 0.001);
near('holá osa s objímkami', C.loadBar(25, { bar: 20, collars: 5, unit: 'kg' }).total, 25, 0.001);
const lb396 = C.loadBar(396.83, { bar: 45, collars: 11, unit: 'lb' });
near('librové kotouče na librovou osu', lb396.total, 396, 0.001);
near('omezený sklad nedosáhne na cíl', C.loadBar(300, { bar: 20, collars: 0, unit: 'kg', inventory: { 25: 2 } }).total, 120, 0.001);

/* ---------------------------------------------------------------- */
group('Váhové kategorie a zaokrouhlení');
near('92,4 kg muž → do 93 kg', C.weightClass(92.4, 'm').limit, 93, 0);
near('zbývá 0,6 kg do limitu', C.weightClass(92.4, 'm').headroom, 0.6, 0.001);
near('do 83 kg znamená 9,4 kg dolů', C.weightClass(92.4, 'm').cutTo, 9.4, 0.001);
near('zaokrouhlení na 2,5 kg', C.roundToBar(181.3, { unit: 'kg' }), 182.5, 0.001);
near('zaokrouhlení na 5 lb', C.roundToBar(183, { unit: 'lb', step: 5 }), 185, 0.001);

/* ---------------------------------------------------------------- */
group('Kondice a únava (Banisterův dvousložkový model)');
{
  // Rekurzivní tvar se musí shodovat se součtem exponenciál — ověřuje se
  // proti nezávisle spočítané sumě, ne proti appce.
  const start = '2026-01-01';
  const loads = { '2026-01-01': 100, '2026-01-02': 50, '2026-01-05': 80 };
  const end = '2026-01-10';
  const tau1 = 42;
  const tau2 = 7;
  const dayIdx = (d) => C.daysBetween(start, d);
  const sumExp = (tau, t) => Object.entries(loads)
    .filter(([d]) => dayIdx(d) <= t)
    .reduce((s, [d, w]) => s + w * Math.exp(-(t - dayIdx(d)) / tau), 0);

  const series = C.fitnessFatigue(loads, end, { tau1, tau2, k1: 1, k2: 2 });
  near('řada pokrývá všechny dny včetně dnů volna', series.length, 10, 0);
  const last = series.at(-1);
  near('kondice odpovídá sumě exponenciál', last.fitness, sumExp(tau1, 9), 0.1);
  near('únava odpovídá sumě exponenciál × k2', last.fatigue, 2 * sumExp(tau2, 9), 0.1);
  near('forma je rozdíl obou složek', last.form, sumExp(tau1, 9) - 2 * sumExp(tau2, 9), 0.1);

  // Ihned po dávce převáží únava; s odstupem odezní rychleji než kondice
  // a forma se dostane nad nulu. To je celý smysl modelu.
  const single = C.fitnessFatigue({ '2026-01-01': 100 }, '2026-03-01', { tau1, tau2, k1: 1, k2: 2 });
  near('den po zátěži je forma záporná', single[0].form < 0 ? 1 : 0, 1, 0);
  near('po odeznění únavy je forma kladná', single.at(-1).form > 0 ? 1 : 0, 1, 0);
  // Analyticky: forma protne nulu, když k1·e^(−t/τ1) = k2·e^(−t/τ2),
  // tedy t = ln(k2/k1) / (1/τ2 − 1/τ1) = ln 2 / (1/7 − 1/42) ≈ 5,8 dne.
  const crossAt = Math.log(2) / (1 / tau2 - 1 / tau1);
  const cross = single.findIndex((d) => d.form > 0);
  near('přechod do kladné formy sedí na analytické řešení', cross, Math.ceil(crossAt), 0);

  near('prázdný vstup vrací prázdnou řadu', C.fitnessFatigue({}, end).length, 0, 0);
  near('formState u prázdné řady vrací null', C.formState([]) === null ? 1 : 0, 1, 0);
  const st = C.formState(series);
  near('formState hlásí krátkou historii pod 42 dnů', st.reliable ? 0 : 1, 1, 0);
}

/* ---------------------------------------------------------------- */
group('Šum měření a nejmenší prokazatelná změna');
{
  const iso = (n) => `2026-0${1 + Math.floor(n / 28)}-${String((n % 28) + 1).padStart(2, '0')}`;

  // Čistě lineární řada nemá rozptyl — bez spodní meze by SDC vyšlo nula
  // a appka by prohlásila za prokazatelný i posun o gram.
  const linear = [0, 1, 2, 3, 4, 5].map((i) => ({ date: iso(i * 5), value: 200 + i * 2 }));
  const nLinear = C.measurementNoise(linear);
  near('nulový rozptyl se nahradí spodní mezí', nLinear.observedError, 0, 0.001);
  near('spodní mez je 3 % z průměru', nLinear.typicalError, (205 * C.E1RM_NOISE_FLOOR_PCT) / 100, 0.05);
  near('appka to přizná příznakem floored', nLinear.floored ? 1 : 0, 1, 0);

  // Rozptyl kolem přímky se ověří vlastní nezávislou regresí, ne odhadem
  // od oka — u střídavých odchylek proložená přímka nevyjde vodorovná.
  const scatter = [6, -6, 6, -6, 6, -6].map((d, i) => ({ date: iso(i * 5), value: 200 + d }));
  const ols = (pts) => {
    const xs = pts.map((_, i) => i * 5);
    const ys = pts.map((p) => p.value);
    const mx = xs.reduce((a, b) => a + b) / xs.length;
    const my = ys.reduce((a, b) => a + b) / ys.length;
    const slope = xs.reduce((s, x, i) => s + (x - mx) * (ys[i] - my), 0)
      / xs.reduce((s, x) => s + (x - mx) ** 2, 0);
    const intercept = my - slope * mx;
    const res = xs.map((x, i) => ys[i] - (intercept + slope * x));
    return Math.sqrt(res.reduce((s, r) => s + r ** 2, 0) / (pts.length - 2));
  };
  const refSd = ols(scatter);
  const nScatter = C.measurementNoise(scatter);
  near('rozptyl kolem proložené přímky sedí na nezávislou regresi', nScatter.observedError, refSd, 0.05);
  near('skutečný rozptyl přebije spodní mez', nScatter.floored ? 0 : 1, 1, 0);
  near('SDC je 1,96 · √2 násobek typické chyby', nScatter.sdc, 1.96 * Math.SQRT2 * refSd, 0.05);

  near('pod 4 body vrací null', C.measurementNoise(linear.slice(0, 3)) === null ? 1 : 0, 1, 0);

  const noise = { sdc: 10 };
  near('změna menší než SDC není prokazatelná', C.isRealChange(200, 208, noise).real ? 0 : 1, 1, 0);
  near('změna větší než SDC prokazatelná je', C.isRealChange(200, 212, noise).real ? 1 : 0, 1, 0);
  near('propad se pozná podle směru', C.isRealChange(200, 180, noise).direction === 'down' ? 1 : 0, 1, 0);
}

/* ---------------------------------------------------------------- */
group('Podíly cviků na součtu (Hernández Ugalde 2023)');
{
  // Muž 93 kg, klasika: elitní pásmo dřepu 33,77–38,15 %, benče 21,45–26,48 %,
  // tahu 37,52–42,62 %. Součet 600 rozdělený 210 / 145 / 245 dá 35,0 / 24,2 / 40,8 %.
  const b = C.sbdBalance({ squat: 210, bench: 145, deadlift: 245 }, { sex: 'm', bw: 93, equipment: 'classic' });
  near('kategorie se určí z tělesné váhy', b.classLabel === 'do 93 kg' ? 1 : 0, 1, 0);
  const sq = b.lifts.find((l) => l.lift === 'squat');
  near('podíl dřepu 210 z 600', sq.pct, 35.0, 0.05);
  near('35,0 % je uvnitř pásma 33,77–38,15', sq.state === 'ok' ? 1 : 0, 1, 0);
  near('z-skóre proti elitnímu průměru', sq.z, (35.0 - 35.96) / 1.69, 0.01);
  near('vyvážený trojboj má kód MMM', b.code === 'MMM' ? 1 : 0, 1, 0);
  near('93 kg klasika má statistickou podporu', b.firm ? 1 : 0, 1, 0);

  // Slabý benč: 600 = 230 / 100 / 270 → benč 16,7 %, hluboko pod 21,45 %
  const weak = C.sbdBalance({ squat: 230, bench: 100, deadlift: 270 }, { sex: 'm', bw: 93, equipment: 'classic' });
  const bp = weak.lifts.find((l) => l.lift === 'bench');
  near('slabý benč se pozná', bp.state === 'low' ? 1 : 0, 1, 0);
  near('kód hlásí slabý prostřední cvik', weak.code[1] === 'L' ? 1 : 0, 1, 0);
  // Podíly dávají 100 %, takže propadlý benč nutně vytlačí zbylé dva nahoru —
  // kód proto vyjde HLH, ne MLM. Je to vlastnost měřítka, ne chyba: slabý cvik
  // se nedá mít bez toho, aby ostatní vypadaly relativně silné.
  near('slabý cvik vytlačí zbylé dva nad pásmo', weak.code === 'HLH' ? 1 : 0, 1, 0);
  // do dolní hranice: x = zbytek · min / (100 − min), zbytek = 500
  near('kolik kg chybí do pásma', bp.toBand, (500 * 21.45) / (100 - 21.45) - 100, 0.1);

  // Vybavená soutěž má jiné poměry — dres pomáhá dřepu a benči, ne tahu
  const eq = C.sbdBalance({ squat: 210, bench: 145, deadlift: 245 }, { sex: 'm', bw: 93, equipment: 'equipped' });
  near('ve vybavené je stejný tah nad pásmem', eq.lifts.find((l) => l.lift === 'deadlift').state === 'high' ? 1 : 0, 1, 0);

  // Nejlehčí kategorie appky studie nepokrývá
  const light = C.sbdBalance({ squat: 120, bench: 80, deadlift: 140 }, { sex: 'm', bw: 52, equipment: 'classic' });
  near('kategorie mimo studii se označí', light.approxClass ? 1 : 0, 1, 0);
  near('bez tělesné váhy vrací null', C.sbdBalance({ squat: 200, bench: 130, deadlift: 240 }, { sex: 'm', bw: 0 }) === null ? 1 : 0, 1, 0);

  // Řádky tabulky musí dát dohromady 100 %
  for (const eqp of ['classic', 'equipped']) {
    for (const sx of ['m', 'f']) {
      const bad = SBD[eqp][sx].filter((r) => Math.abs(r.sq[0] + r.bp[0] + r.dl[0] - 100) > 0.02).length;
      near(`${eqp} ${sx}: průměry v každém řádku dají 100 %`, bad, 0, 0);
    }
  }
}

/* ---------------------------------------------------------------- */
group('Věkové koeficienty (McCulloch / Foster)');
{
  near('30 let je bez úpravy', C.ageCoefficient(30).coeff, 1.0, 0.0001);
  near('18 let podle Fostera', C.ageCoefficient(18).coeff, 1.06, 0.0001);
  near('50 let podle McCullocha', C.ageCoefficient(50).coeff, 1.130, 0.0001);
  near('70 let', C.ageCoefficient(70).coeff, 1.645, 0.0001);
  near('90 let (USAPL)', C.ageCoefficient(90).coeff, 2.549, 0.0001);
  near('nad 100 let se zastropuje', C.ageCoefficient(120).coeff, 3.154, 0.0001);

  near('14 až 90 je spolehlivé pásmo', C.ageCoefficient(60).solid ? 1 : 0, 1, 0);
  near('10 let je jen odhad', C.ageCoefficient(10).solid ? 0 : 1, 1, 0);
  near('95 let je extrapolace', C.ageCoefficient(95).solid ? 0 : 1, 1, 0);

  // přibližný věk: u mladších se předpokládá vyšší, u masters nižší
  near('přibližný věk 20 bere koeficient 21 let', C.ageCoefficient(20, { approximate: true }).coeff, AGE[21], 0.0001);
  near('přibližný věk 50 zůstává na 50', C.ageCoefficient(50, { approximate: true }).coeff, AGE[50], 0.0001);

  near('neznámý věk vrací null', C.ageCoefficient(null) === null ? 1 : 0, 1, 0);

  const adj = C.ageAdjusted(500, 50);
  near('body se násobí koeficientem', adj.adjusted, 500 * 1.130, 0.01);
  near('původní body zůstávají k dispozici', adj.points, 500, 0.001);
}

/* ---------------------------------------------------------------- */
group('Denní připravenost z odchylky RPE');
{
  const e1 = { squat: 200 };
  // 160 kg = 80 % z 200; podle tabulky je 80 % na 5 opakování zhruba RPE 8
  const expected = C.rpeFromPct(5, 80);
  near('očekávané RPE pro 80 % × 5 vyjde z tabulky', expected != null ? 1 : 0, 1, 0);

  const mk = (date, actualRpe) => ({ date, lift: 'squat', sets: 3, reps: 5, weight: 160, rpe: expected, actualRpe });
  const days = C.dailyReadiness(
    [mk('2026-03-02', expected), mk('2026-03-04', expected), mk('2026-03-06', expected),
      mk('2026-03-09', expected), mk('2026-03-11', expected + 2)],
    e1,
  );
  near('jeden záznam na den', days.length, 5, 0);
  near('trénink podle plánu má nulové reziduum', days[0].residual, 0, 0.001);
  near('těžší den má kladné reziduum', days.at(-1).residual, 2, 0.001);
  near('první dny nemají dost historie na z-skóre', days[0].z === null ? 1 : 0, 1, 0);
  // Historie bez jakéhokoli rozptylu se nedá standardizovat — dělilo by se nulou.
  // Appka v tom případě z-skóre nevrátí a nechá mluvit surové reziduum.
  near('nulový rozptyl historie z-skóre nevrací', days.at(-1).z === null ? 1 : 0, 1, 0);

  const varied = C.dailyReadiness(
    [mk('2026-03-02', expected), mk('2026-03-04', expected + 0.5), mk('2026-03-06', expected - 0.5),
      mk('2026-03-09', expected), mk('2026-03-11', expected + 2)],
    e1,
  );
  near('při nenulovém rozptylu z-skóre vyjde', varied.at(-1).z === null ? 0 : 1, 1, 0);
  near('výrazně těžší den má z-skóre nad 1', varied.at(-1).z > 1 ? 1 : 0, 1, 0);

  near('bez skutečného RPE se nepočítá nic',
    C.dailyReadiness([{ date: '2026-03-02', lift: 'squat', sets: 3, reps: 5, weight: 160, rpe: 8 }], e1).length, 0, 0);
  near('cvik bez známého 1RM se přeskočí',
    C.dailyReadiness([{ date: '2026-03-02', lift: 'accessory', sets: 3, reps: 12, weight: 40, actualRpe: 8 }], e1).length, 0, 0);

  near('z-skóre nad 1 hlásí těžší den', C.gradeReadiness(1.2).tone === 'warn' ? 1 : 0, 1, 0);
  near('z-skóre pod −1 hlásí lehčí den', C.gradeReadiness(-1.4).tone === 'ok' ? 1 : 0, 1, 0);
  near('bez z-skóre hlásí málo dat', C.gradeReadiness(null).tone === 'low' ? 1 : 0, 1, 0);
}

/* ---------------------------------------------------------------- */
group('Signál stropu regenerace (MRV)');
{
  const stalled = { plateau: true, slope: 0 };
  const rising = { plateau: false, slope: 0.5 };

  const all = C.mrvSignal({
    e1rmTrend: stalled, hardSetsNow: 12, hardSetsPrev: 10,
    creepNow: 0.8, creepPrev: 0.1,
    hooperNow: 20, hooperBaseline: 14,
  });
  near('všechny tři známky sedí', all.score, 3, 0);
  near('strop je dosažen', all.reached ? 1 : 0, 1, 0);
  near('hodnocení hlásí strop', C.gradeMrv(all).tone === 'bad' ? 1 : 0, 1, 0);

  const one = C.mrvSignal({
    e1rmTrend: rising, hardSetsNow: 12, hardSetsPrev: 10,
    creepNow: 0.8, creepPrev: 0.1,
    hooperNow: 14, hooperBaseline: 14,
  });
  near('jedna známka nestačí', one.reached ? 0 : 1, 1, 0);
  near('jedna známka se hlásí jako varování', C.gradeMrv(one).tone === 'warn' ? 1 : 0, 1, 0);

  const none = C.mrvSignal({
    e1rmTrend: rising, hardSetsNow: 12, hardSetsPrev: 10,
    creepNow: 0.1, creepPrev: 0.1,
    hooperNow: 13, hooperBaseline: 14,
  });
  near('bez známek je prostor', C.gradeMrv(none).tone === 'ok' ? 1 : 0, 1, 0);

  // pokles objemu vysvětlí stagnaci sám o sobě — nesmí se počítat jako známka
  const deload = C.mrvSignal({
    e1rmTrend: stalled, hardSetsNow: 4, hardSetsPrev: 12,
    creepNow: 0.1, creepPrev: 0.1,
    hooperNow: 13, hooperBaseline: 14,
  });
  near('stagnace při sníženém objemu není známka stropu', deload.score, 0, 0);

  near('bez dat hlásí málo dat', C.gradeMrv(C.mrvSignal({})).tone === 'low' ? 1 : 0, 1, 0);
}

group('Rychlost tyče (VBT)');
{
  // tabulkové body musí sedět přesně
  near('dřep muži 70 % → 0,61 m/s', C.velocityAtPct('squat', 'm', 70).v, 0.61, 0.0001);
  near('bench ženy 80 % → 0,36 m/s', C.velocityAtPct('bench', 'f', 80).v, 0.36, 0.0001);
  // mezi body se interpoluje lineárně: 65 % leží v půli mezi 60 (0,70) a 70 (0,61)
  near('dřep muži 65 % je půl cesty mezi 60 a 70', C.velocityAtPct('squat', 'm', 65).v, (0.70 + 0.61) / 2, 0.0001);
  near('mimo rozsah tabulky vrací null', C.velocityAtPct('squat', 'm', 40) === null ? 1 : 0, 1, 0);
  near('mrtvý tah v tabulce není', C.velocityAtPct('deadlift', 'm', 70) === null ? 1 : 0, 1, 0);

  // odhad 1RM: dokonale lineární profil musí trefit dosazení MVT přesně.
  // váha = 250 − 200 · rychlost  ⇒  při MVT 0,25 vyjde 200
  const pts = [0.8, 0.6, 0.4, 0.3].map((v) => ({ velocity: v, weight: 250 - 200 * v }));
  const prof = C.lvProfile1RM(pts, 'squat');
  near('sklon regrese', prof.slope, -200, 0.01);
  near('průsečík regrese', prof.intercept, 250, 0.01);
  near('odhad 1RM = sklon · MVT + průsečík', prof.e1rm, -200 * MVT.squat.v + 250, 0.05);
  near('dokonalá přímka má r² = 1', prof.r2, 1, 0.0001);
  near('dřep je pro tuhle metodu použitelný', prof.reliable ? 1 : 0, 1, 0);

  // mrtvý tah musí přijít označený jako nepoužitelný — studie metodu odmítá
  near('mrtvý tah je označen jako nespolehlivý', C.lvProfile1RM(pts, 'deadlift').reliable ? 0 : 1, 1, 0);
  near('pod tři série vrací null', C.lvProfile1RM(pts.slice(0, 2), 'squat') === null ? 1 : 0, 1, 0);
  near('neznámý cvik vrací null', C.lvProfile1RM(pts, 'benchpress') === null ? 1 : 0, 1, 0);

  // pásma poklesu rychlosti
  near('pokles 5 % je málo únavy', C.gradeVelocityLoss(5).tone === 'low' ? 1 : 0, 1, 0);
  near('pokles 20 % sedí na maximální sílu', C.gradeVelocityLoss(20).tone === 'ok' ? 1 : 0, 1, 0);
  near('pokles 30 % je hypertrofie', C.gradeVelocityLoss(30).tone === 'warn' ? 1 : 0, 1, 0);
  near('pokles 50 % už nic nepřidá', C.gradeVelocityLoss(50).tone === 'bad' ? 1 : 0, 1, 0);

  // bezpřístrojová obdoba z deníku
  const mk = (reps, actualRpe, weight = 150) => ({ date: '2026-04-06', lift: 'squat', sets: 1, reps, weight, rpe: 7, actualRpe });
  const big = C.setDropoff([mk(8, 7), mk(7, 8), mk(5, 9)], 'squat', '2026-04-06');
  near('propad z 8 na 5 opakování je 37,5 %', big.repDrop, 37.5, 0.01);
  near('skok RPE ze 7 na 9 jsou 2 body', big.rpeJump, 2, 0.001);
  near('propad nad 20 % znamená konec', big.stop ? 1 : 0, 1, 0);

  const small = C.setDropoff([mk(8, 7), mk(8, 7.5), mk(7, 8)], 'squat', '2026-04-06');
  near('propad z 8 na 7 je 12,5 %', small.repDrop, 12.5, 0.01);
  near('malý propad i malý skok RPE = pokračovat', small.stop ? 0 : 1, 1, 0);

  // série na jiné váze se nesmí porovnávat — nižší opakování tam znamenají
  // jen to, že se přidalo na ose
  const ramp = C.setDropoff([mk(8, 7, 150), mk(3, 9, 190)], 'squat', '2026-04-06');
  near('rampa na různých vahách se nepočítá', ramp === null ? 1 : 0, 1, 0);
  near('jediná série nedá pokles', C.setDropoff([mk(8, 7)], 'squat', '2026-04-06') === null ? 1 : 0, 1, 0);

  // skutečná váha má přednost před plánovanou
  const withActual = C.setDropoff([
    { date: '2026-04-06', lift: 'squat', sets: 1, reps: 8, weight: 150, actualWeight: 140, rpe: 7, actualRpe: 7 },
    { date: '2026-04-06', lift: 'squat', sets: 1, reps: 6, weight: 150, actualWeight: 140, rpe: 7, actualRpe: 9 },
  ], 'squat', '2026-04-06');
  near('pokles se počítá ze skutečné váhy', withActual.weight, 140, 0.001);
}

group('Interval spolehlivosti trendu');
{
  // skutečná datová aritmetika — dřív tu byl vzoreček, který přes konec měsíce
  // dělal z týdenního rozestupu desetidenní a rozbíjel sklon
  const day = isoDay;
  // dokonalá přímka: nulová rezidua ⇒ nulová chyba sklonu ⇒ interval je bod
  const clean = [0, 1, 2, 3, 4, 5].map((i) => ({ date: day(i * 7), value: 200 + i * 5 }));
  const t = C.trendWithBand(clean);
  near('sklon 5 kg za 7 dnů', t.perWeek, 5, 0.001);
  near('reziduální rozptyl je nulový', t.residualSd, 0, 0.001);
  near('interval sklonu je degenerovaný na bod', t.slopeCI[1] - t.slopeCI[0], 0, 0.0001);
  near('interval neobsahuje nulu', (t.slopeCI[0] <= 0 && t.slopeCI[1] >= 0) ? 0 : 1, 1, 0);

  // t kritické hodnoty
  near('t(0,95; df=4) = 2,776', C.tCrit95(4), 2.776, 0.0001);
  near('t(0,95; df=30) = 2,042', C.tCrit95(30), 2.042, 0.0001);
  near('nad 30 stupňů volnosti se blíží 1,96', C.tCrit95(200), 1.96, 0.0001);

  // ověřit směrodatnou chybu sklonu nezávislým výpočtem
  const noisy = [0, 5, 10, 15, 20, 25, 30].map((d, i) => ({ date: day(d), value: 200 + i * 3 + (i % 2 ? 4 : -4) }));
  const tn = C.trendWithBand(noisy);
  {
    const xs = [0, 5, 10, 15, 20, 25, 30];
    const ys = noisy.map((p) => p.value);
    const n = xs.length;
    const mx = xs.reduce((a, b) => a + b) / n;
    const my = ys.reduce((a, b) => a + b) / n;
    const Sxx = xs.reduce((s2, x) => s2 + (x - mx) ** 2, 0);
    const slope = xs.reduce((s2, x, i) => s2 + (x - mx) * (ys[i] - my), 0) / Sxx;
    const inter = my - slope * mx;
    const se = Math.sqrt(xs.reduce((s2, x, i) => s2 + (ys[i] - (inter + slope * x)) ** 2, 0) / (n - 2));
    near('směrodatná chyba sklonu proti nezávislému výpočtu', tn.seSlope, se / Math.sqrt(Sxx), 1e-9);
  }
  // předpovědní pás je nejužší v těžišti dat a širší po krajích
  near('pás je v těžišti užší než na kraji', tn.band(tn.mx) < tn.band(tn.xs.at(-1)) ? 1 : 0, 1, 0);

  // plateau: obě podmínky musí platit naráz
  const flat = [0, 1, 2, 3, 4, 5].map((i) => ({ date: day(i * 7), value: 200 + (i % 2 ? 1 : -1) }));
  near('šum kolem konstanty je plateau', C.plateauCheck(flat).plateau ? 1 : 0, 1, 0);
  near('čistý růst plateau není', C.plateauCheck(clean).plateau ? 0 : 1, 1, 0);
  near('čistý růst má průkazný interval', C.plateauCheck(clean).ciCrossesZero ? 0 : 1, 1, 0);
  near('hodnocení čistého růstu je „Roste"', C.gradePlateau(C.plateauCheck(clean)).label === 'Roste' ? 1 : 0, 1, 0);
}

/* ---------------------------------------------------------------- */
group('Robustní trend a detekce zlomu');
{
  const day = isoDay;
  const base = [0, 1, 2, 3, 4, 5, 6].map((i) => ({ date: day(i * 4), value: 200 + i * 4 }));
  near('Theil–Sen na čisté přímce dá stejný sklon jako regrese', C.theilSen(base).perWeek, C.trendWithBand(base).perWeek, 0.01);

  // Jeden odlehlý bod. Musí sedět na kraji řady — bod přesně v těžišti nemá
  // na sklon regrese žádnou páku a posunul by jen průsečík, takže by test
  // neukázal nic.
  const withOutlier = base.map((p, i) => (i === 6 ? { ...p, value: p.value - 60 } : p));
  const olsShift = Math.abs(C.trendWithBand(withOutlier).perWeek - C.trendWithBand(base).perWeek);
  const tsShift = Math.abs(C.theilSen(withOutlier).perWeek - C.theilSen(base).perWeek);
  near('odlehlá hodnota regresi vychýlí', olsShift > 5 ? 1 : 0, 1, 0);
  near('Theil–Sen ji ustojí beze změny', tsShift, 0, 0.001);
  near('počet párů je n(n−1)/2', C.theilSen(base).pairs, (7 * 6) / 2, 0);

  // Mann–Kendall
  const up = C.mannKendall([1, 2, 3, 4, 5, 6, 7, 8]);
  near('rostoucí řada má S = n(n−1)/2', up.S, (8 * 7) / 2, 0);
  near('rostoucí řada je průkazná', up.significant ? 1 : 0, 1, 0);
  near('směr je nahoru', up.direction === 'up' ? 1 : 0, 1, 0);
  const down = C.mannKendall([8, 7, 6, 5, 4, 3, 2, 1]);
  near('klesající řada má opačné S', down.S, -(8 * 7) / 2, 0);
  near('krátká řada vrací null', C.mannKendall([1, 2, 3]) === null ? 1 : 0, 1, 0);

  // CUSUM najde bod, kde se úroveň posune. Základ musí mít nějaký rozptyl —
  // dokonale plochá řada se nedá standardizovat a appka na ni vrátí null.
  const jitter = [2, -3, 1, -1, 3, -2, 1, -1];
  const shift = [...jitter.map((j) => 200 + j), ...jitter.map((j) => 170 + j)]
    .map((v, i) => ({ date: day(i), value: v }));
  const cu = C.cusum(shift, { k: 0.5, h: 2 });
  near('CUSUM najde zlom', cu.breakAt ? 1 : 0, 1, 0);
  near('zlom leží až po posunu úrovně', cu.breakAt.i >= 8 ? 1 : 0, 1, 0);
  near('a hlásí, že šlo o propad', cu.breakAt.direction === 'down' ? 1 : 0, 1, 0);
  near('referenční úroveň se bere z počátku řady', cu.mean, 200, 0.5);
  near('dokonale plochá řada vrací null', C.cusum(Array.from({ length: 12 }, (_, i) => ({ date: day(i), value: 200 }))) === null ? 1 : 0, 1, 0);
  near('krátká řada vrací null', C.cusum(shift.slice(0, 4)) === null ? 1 : 0, 1, 0);
}

/* ---------------------------------------------------------------- */
group('Taper a závodní den');
{
  const plan = C.taperPlan('2026-05-30', { model: 'exponential', baseVolume: 100 });
  near('exponenciální taper trvá 21 dnů', plan.days, 21, 0);
  near('začíná 21 dnů před závodem', C.daysBetween(plan.start, '2026-05-30'), 21, 0);
  near('první den drží plný objem', plan.days_[0].fraction, 1, 0.001);
  near('objem po celou dobu klesá',
    plan.days_.every((d, i) => i === 0 || d.fraction <= plan.days_[i - 1].fraction) ? 1 : 0, 1, 0);
  // všechny tři modely končí na zhruba polovině výchozího objemu — v řízeném
  // pokusu skončily obě větve na −50 % práce, lišil se jen tvar cesty
  near('na konci zbyde zhruba polovina objemu', plan.days_.at(-1).fraction, 0.5, 0.03);
  near('konečný pokles odpovídá praxi šampionů', C.gradeTaperDrop(plan.finalDrop).tone === 'ok' ? 1 : 0, 1, 0);

  const lin = C.taperPlan('2026-05-30', { model: 'linear' });
  near('lineární taper trvá 14 dnů', lin.days, 14, 0);
  const step = C.taperPlan('2026-05-30', { model: 'step' });
  near('krokový taper trvá 7 dnů', step.days, 7, 0);
  near('krokový drží polovinu objemu po celou dobu',
    step.days_.every((x) => Math.abs(x.fraction - 0.5) < 0.001) ? 1 : 0, 1, 0);
  near('lineární klesá na polovinu rovnoměrně', lin.days_[7].fraction, 0.75, 0.01);
  near('neznámý model vrací null', C.taperPlan('2026-05-30', { model: 'xxx' }) === null ? 1 : 0, 1, 0);

  near('vrchol intenzity 8 dnů před závodem', C.daysBetween(plan.intensityPeak, '2026-05-30'), TAPER_REFERENCE.intensityPeakDaysBefore.mean, 0);
  near('poslední trénink 4 dny před závodem', C.daysBetween(plan.lastSession, '2026-05-30'), 4, 0);

  near('pokles 50 % odpovídá praxi šampionů', C.gradeTaperDrop(50).tone === 'ok' ? 1 : 0, 1, 0);
  near('pokles 20 % je málo', C.gradeTaperDrop(20).tone === 'warn' ? 1 : 0, 1, 0);

  // časová osa
  const tl = C.meetTimeline({ flightStart: '10:00', lifterOrder: 5, flightSize: 12, minPerAttempt: 1, warmupSets: 5 });
  near('kolo trvá tolik minut, kolik je závodníků', tl.roundMin, 12, 0);
  near('první pokus je 4 minuty po startu flighty', tl.attempts[0] === '10:04' ? 1 : 0, 1, 0);
  near('druhý pokus o kolo později', tl.attempts[1] === '10:16' ? 1 : 0, 1, 0);
  near('třetí pokus o další kolo', tl.attempts[2] === '10:28' ? 1 : 0, 1, 0);
  near('poslední rozcvička 10 závodníků před pokusem', tl.lastWarmup === '09:54' ? 1 : 0, 1, 0);
  near('rozcvička začíná o 4 pauzy dřív', tl.warmupStart === '09:30' ? 1 : 0, 1, 0);
  near('bez času startu vrací null', C.meetTimeline({ flightStart: 'nesmysl' }) === null ? 1 : 0, 1, 0);
}

/* ---------------------------------------------------------------- */
group('Benchmark pokusů a percentily síly');
{
  const b = C.attemptBenchmark(9, 9);
  near('9 z 9 je nad úrovní medailistů', b.level === 'winners' ? 1 : 0, 1, 0);
  near('6 z 9 je pod průměrem', C.attemptBenchmark(6, 9).level === 'below' ? 1 : 0, 1, 0);
  near('přepočet na devítku', C.attemptBenchmark(4, 6).outOf9, 6, 0.001);
  near('hodnocení pod průměrem varuje', C.gradeAttempts(C.attemptBenchmark(5, 9)).tone === 'warn' ? 1 : 0, 1, 0);

  // percentily — jen ověřený 90. percentil
  const sq = C.strengthPercentile('squat', 283, 100, 'm');
  near('dřep 2,83× tělesné váhy je přesně na 90. percentilu', sq.ratio, STRENGTH_P90.young.m.squat, 0.001);
  near('a tedy je na hranici nebo nad ní', sq.above ? 1 : 0, 1, 0);
  const weak = C.strengthPercentile('squat', 200, 100, 'm');
  near('slabší dřep je pod hranicí', weak.above ? 0 : 1, 1, 0);
  near('chybí 83 kg do 90. percentilu', weak.gapKg, 83, 0.1);
  near('nad 80 let platí jiná tabulka', C.strengthPercentile('squat', 172, 100, 'm', 85).p90, STRENGTH_P90.old.m.squat, 0.001);
  near('mezi 35 a 80 lety se použije mladší skupina s příznakem', C.strengthPercentile('squat', 250, 100, 'm', 50).approxAge ? 1 : 0, 1, 0);
}

/* ---------------------------------------------------------------- */
group('Šablony progrese');
{
  const w = C.wendler531(200);
  near('tréninkové maximum je 90 % z maxima', w.tm, 180, 0.01);
  // týden 1, série 3: 85 % z TM = 153 → zaokrouhleno na 2,5 kg
  near('týden 1 poslední série = 85 % z TM', w.weeks[0].sets[2].weight, C.roundToBar(180 * 0.85), 0.01);
  near('a je to AMRAP', w.weeks[0].sets[2].amrap ? 1 : 0, 1, 0);
  near('týden 3 poslední série = 95 % z TM', w.weeks[2].sets[2].weight, C.roundToBar(180 * 0.95), 0.01);
  near('čtvrtý týden je deload', w.weeks[3].deload ? 1 : 0, 1, 0);
  near('procenta jdou z TM, ne z 1RM', w.weeks[0].sets[2].weight < 200 * 0.85 ? 1 : 0, 1, 0);

  near('málo opakování na AMRAP sníží maximum', C.wendlerCheck('5', 3).adjust, -10, 0);
  near('dost opakování maximum nemění', C.wendlerCheck('5', 8).adjust, 0, 0);
  near('neznámý týden vrací null', C.wendlerCheck('xx', 5) === null ? 1 : 0, 1, 0);
}

/* ---------------------------------------------------------------- */
group('Distribuce, specifičnost a shazování');
{
  const e1 = { squat: 200 };
  const mk = (weight, sets, reps) => ({ date: '2026-04-06', lift: 'squat', sets, reps, weight, rpe: 8 });
  const hist = C.intensityHistogram([mk(150, 5, 5), mk(160, 3, 3), mk(190, 1, 1)], e1);
  near('zvedy se sečtou', hist.total, 25 + 9 + 1, 0);
  // 150/200 = 75 % → pásmo 75; 160/200 = 80 % → pásmo 80; 190/200 = 95 % → pásmo 95
  near('pásmo 75 % nese 25 zvedů', hist.rows.find((r) => r.from === 75).reps, 25, 0);
  near('pásmo 95 % nese 1 zvedu', hist.rows.find((r) => r.from === 95).reps, 1, 0);
  near('v Sheikově hlavním pásmu 70–80 % je 25 z 35 zvedů', hist.mainBandPct, (25 / 35) * 100, 0.1);

  const spec = C.specificityIndex([
    { lift: 'squat', sets: 5, reps: 5, weight: 100 },
    { lift: 'accessory', sets: 3, reps: 10, weight: 50 },
  ]);
  near('specifičnost = tonáž soutěžních ÷ celková', spec.pct, (2500 / (2500 + 1500)) * 100, 0.1);
  near('62,5 % odpovídá transmutaci', spec.phase === 'transmutace' ? 1 : 0, 1, 0);

  const ramp = C.rampRate([{ week: 1, tonnage: 1000 }, { week: 2, tonnage: 1100 }, { week: 3, tonnage: 990 }]);
  near('první týden nemá s čím srovnávat', ramp[0].change === null ? 1 : 0, 1, 0);
  near('nárůst o 10 %', ramp[1].change, 10, 0.01);
  near('pokles o 10 %', ramp[2].change, -10, 0.01);

  const cut = C.cutPlan({ bw: 100, limit: 93 });
  near('chybí 7 kg', cut.need, 7, 0.001);
  near('to je 7 % tělesné váhy', cut.needPct, 7, 0.001);
  near('nad 5 % je vysoké riziko', cut.band.tone === 'bad' ? 1 : 0, 1, 0);
  near('první 2 % jdou pasivně', cut.passive, 2, 0.001);
  near('zbytek je voda', cut.water, 5, 0.001);
  near('4 % je střední riziko', C.cutPlan({ bw: 100, limit: 96 }).band.tone === 'warn' ? 1 : 0, 1, 0);
  near('kdo je pod limitem, nemá co shazovat', C.cutPlan({ bw: 90, limit: 93 }).need, 0, 0.001);
  near('srovnání s typickým shozem 4,2 %', cut.vsTypical, 7 - CUT_FACTS.typicalPct, 0.01);
}

/* ---------------------------------------------------------------- */
group('Poměr podnětu k únavě a osmá rovnice 1RM');
{
  const e1 = { squat: 200 };
  const sets = [
    { date: '2026-04-06', lift: 'squat', sets: 4, reps: 5, weight: 160, rpe: 8 },
    { date: '2026-04-08', lift: 'squat', sets: 3, reps: 3, weight: 180, rpe: 9 },
  ];
  const sfr = C.stimulusFatigue(sets, e1, 'squat');
  near('tvrdé série se sečtou', sfr.hardSets, 7, 0);
  near('poměr je kladný', sfr.ratio > 0 ? 1 : 0, 1, 0);
  near('cvik bez maxima vrací null', C.stimulusFatigue(sets, {}, 'squat') === null ? 1 : 0, 1, 0);

  // rovnice 2026 — ověřena proti kontrolním hodnotám z rešerše
  near('100 kg × 5 → 117,5', C.E1RM.weightDependent(100, 5), 117.5, 0.1);
  near('40 kg × 10 → 58,0', C.E1RM.weightDependent(40, 10), 58.0, 0.1);
  near('na jedno opakování vrací váhu', C.E1RM.weightDependent(100, 1), 100, 0.001);
  near('pod hranicí kladného jmenovatele vrací null', C.E1RM.weightDependent(1.5, 5) === null ? 1 : 0, 1, 0);
  // tohle je ta vlastnost, kvůli které rovnice vznikla
  const lightRatio = C.E1RM.weightDependent(40, 10) / 40;
  const heavyRatio = C.E1RM.weightDependent(200, 10) / 200;
  near('lehká činka dostane větší převodní faktor než těžká', lightRatio > heavyRatio ? 1 : 0, 1, 0);

  // Rovnice je závislá na jednotkách. Appka drží všechno v kilogramech a
  // převádí až při zobrazení, takže do ní kg dorazí i v librovém režimu —
  // kdyby se do ní poslaly libry, vyšlo by něco úplně jiného.
  const inLb = C.E1RM.weightDependent(100 / 0.45359237, 5) * 0.45359237;
  near('poslat libry místo kg dá jiný výsledek (proto se převádí předem)',
    Math.abs(inLb - C.E1RM.weightDependent(100, 5)) > 1 ? 1 : 0, 1, 0);
}

/* ---------------------------------------------------------------- */
console.log(
  failed
    ? `\n${failed} z ${failed + passed} kontrol neprošlo.\n`
    : `\nVšech ${passed} kontrol prošlo.\n`,
);
process.exit(failed ? 1 : 0);
