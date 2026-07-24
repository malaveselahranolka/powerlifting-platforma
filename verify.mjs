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

let failed = 0;
let passed = 0;

const near = (name, got, want, tol = 0.01) => {
  const ok = got != null && Number.isFinite(got) && Math.abs(got - want) <= tol;
  if (ok) { passed++; console.log(`  ok    ${name}`); }
  else { failed++; console.log(`  CHYBA ${name}: vyšlo ${got}, čekáno ${want} ±${tol}`); }
};

const group = (title) => console.log(`\n${title}`);

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
console.log(
  failed
    ? `\n${failed} z ${failed + passed} kontrol neprošlo.\n`
    : `\nVšech ${passed} kontrol prošlo.\n`,
);
process.exit(failed ? 1 : 0);
