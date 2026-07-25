# RESEARCH — co v Platformě chybí

Rešerše metod, vzorců a algoritmů, které elitní trenéři a závodníci v powerliftingu
reálně používají a které **zatím v aplikaci nejsou**. Zaměřeno výhradně na věci
spočitatelné z tréninkového deníku (datum, cvik, série, opakování, váha, RPE,
tělesná hmotnost, pohlaví, výsledky ze závodu).

Datum rešerše: **2026-07-25**.

## Jak číst tento dokument

Každá položka má:

- **Název / Czech name**
- **Co to trenérovi řekne**
- **Přesná matematika** — vzorce se všemi konstantami nebo tabulkové hodnoty
- **Zdroj** a jeho úroveň důkazu:
  - `[PR]` peer-reviewed
  - `[PR-weak]` peer-reviewed, ale malý vzorek / průzkum / pilot
  - `[COACH]` trenérská praxe, kniha, blog — bez recenzovaného důkazu
  - `[ENG]` čistě inženýrská/statistická metoda (není to sportovní věda, je to matematika — a to je v pořádku)
- **Vstupní data**
- **Priorita** HIGH / MEDIUM / LOW
- **Výhrady** — kde je metoda sporná, slabě podložená nebo bro-science

Už implementované (a tedy zde **nerešeršované**): RPE tabulka, 7 vzorců E1RM,
tonáž, INOL, Prilepin, hard sets, těžké expozice, ACWR (rolling + EWMA), sRPE,
monotonie, strain, Hooper, taper guidance, APRE, výběr pokusů 91/96,5/102,
DOTS, IPF GL, Wilks, detekce plateau, nakládání osy, váhové kategorie.

---

# 1. Modelování únavy a připravenosti

## 1.1 Banisterův model kondice–únavy (Fitness–Fatigue Model, FFM)

**Czech:** Model kondice a únavy (Banister)

**Co to trenérovi řekne:** Rozloží jednu časovou řadu tréninkové zátěže na dvě
protichůdné složky — pomalu rostoucí/pomalu klesající "kondici" a rychle
rostoucí/rychle klesající "únavu". Rozdíl je predikovaný výkon. Na rozdíl od ACWR
to dává **jedno číslo, které se dá kreslit do grafu vedle E1RM** a odpovídá na
otázku "kdy budu nejsilnější, když teď zkrátím objem".

### Přesná matematika

Spojitá forma:

```
p(t) = p0 + ∫₀ᵗ w(t′) · g(t − t′) dt′
g(t) = k1 · exp(−t/τ1) − k2 · exp(−t/τ2)
```

Diskrétní (sumační) forma, kterou budeš implementovat:

```
p(n) = p0 + Σᵢ₌₁ⁿ⁻¹ w(i) · [ k1·exp(−(n−i)/τ1) − k2·exp(−(n−i)/τ2) ]
```

Rekurzivní forma — **toto použij v JS**, je O(n) místo O(n²):

```js
// w[] = denní tréninková zátěž (sRPE = trvání[min] × RPE, nebo tonáž, nebo INOL)
// den bez tréninku => w = 0 (NE mezera v poli!)
function banister(w, { p0 = 0, k1 = 1, k2 = 2, tau1 = 42, tau2 = 7 }) {
  const d1 = Math.exp(-1 / tau1);
  const d2 = Math.exp(-1 / tau2);
  let fit = 0, fat = 0;
  const out = [];
  for (let i = 0; i < w.length; i++) {
    fit = fit * d1 + w[i];
    fat = fat * d2 + w[i];
    out.push({ fitness: k1 * fit, fatigue: k2 * fat, perf: p0 + k1 * fit - k2 * fat });
  }
  return out;
}
```

Dva analyticky užitečné časy pro **jeden** trénink (odvozené z `g(t) = 0` a `g′(t) = 0`):

```
break-even (kdy se z tréninku stane čistý zisk):
  t_r = (τ1·τ2 / (τ1 − τ2)) · ln(k2 / k1)

vrchol (kdy je čistý přínos jednoho tréninku největší):
  t_p = (τ1·τ2 / (τ1 − τ2)) · ln( k2·τ1 / (k1·τ2) )
```

Kontrolní příklad: k1=1, k2=2, τ1=42, τ2=7 → t_r ≈ 5,8 dne, t_p ≈ 20,9 dne.

### Parametry — POZOR

Publikované hodnoty (žádná z nich **není** z powerliftingu):

| Zdroj | p0 | k1 | k2 | τ1 (dny) | τ2 (dny) |
|---|---|---|---|---|---|
| Banister originál (běh/plavání) | — | 1,0 | 1,8–2,0 | 49–50 | 11 |
| Běžně citovaná "učebnicová" sada | — | 1 | 1,5 | 20 | 7 |
| Cyklo-ergometr, průměr 8 subjektů (Clark & Skiba / arXiv 2505.20859) | 104,8 | 0,048 | 0,117 | 38 | 1,9 |

**Parametry pro silové sportovce jsem nenašel — "not found".** Nevymýšlej si je.
Správný postup: nech je fitovat na datech konkrétního svěřence.

Fitování v JS (bez knihovny): mřížka + lokální zjemnění.

```js
// Fit p0,k1,k2 lineárně (OLS) při daných tau1,tau2 => mřížka jen přes 2 parametry.
// pro každý (tau1, tau2) z mřížky:
//   spočti fit_i, fat_i (rekurze výše s k1=k2=1)
//   OLS: perf_obs ≈ b0 + b1*fit − b2*fat   (b1,b2 > 0 vynuť clampem)
//   ulož SSE; vyber minimum
// mřížka: tau1 ∈ [15..60] krok 1, tau2 ∈ [2..20] krok 0.5
```

Cílová proměnná `perf_obs` = denní nejlepší E1RM daného cviku (viz §7.1 pro
vyhlazení). Fituj jen na dnech, kdy existuje těžká série (RPE ≥ 7), jinak model
fituje šum.

**Minimum dat pro smysluplný fit: ~12 týdnů souvislého logu a ≥ 20 dní s měřením
výkonu.** Pod tím parametry divoce oscilují (identifikovatelnost je známý problém FFM).

**Zdroj:** Banister et al. 1975; Calvert et al. 1976; Morton, Fitz-Clarke & Banister 1990,
*J Appl Physiol* 69(3):1171–7 `[PR]`.
Rovnice a analytické časy ověřeny v: *Mathematical Modelling and Optimisation of
Athletic Performance: Tapering and Periodisation*, arXiv:2505.20859 (2025) `[PR]`.
Kritika parametrizace: Vermeire et al., *IJSPP* 2021;16(9):1261–9 a 2022;17(5):810–3 `[PR]`.

**Vstupní data:** datum + denní zátěž (sRPE nebo tonáž nebo INOL) + série výkonu (E1RM).

**Priorita: HIGH** — je to jediná v dokumentu chybějící věc, která dává trenérovi
předpověď *dopředu* ("za 10 dní budeš na vrcholu"), ne jen popis minulosti.

**Výhrady:**
- FFM je **silně přeparametrizovaný**. Různé sady (k1,k2,τ1,τ2) dávají skoro
  identickou shodu s daty, ale úplně jiné predikce do budoucna. Vermeire 2022
  přímo varuje, že "hodnoty parametrů" se nemají interpretovat fyziologicky.
- Model je citlivý na to, **čím** kvantifikuješ zátěž. Vermeire 2021: různé metody
  kvantifikace zátěže dávají různé modely; musí být konzistentní napříč tréninky.
- Pro powerlifting **není validován vůbec**. Prezentuj v UI jako "orientační model,
  ne měření". Nikdy z něj nedělej tvrdé doporučení bez potvrzení z E1RM/RPE dat.
- Nedávej `p0` z hlavy — nastav `p0` = medián E1RM v prvních 2 týdnech okna.

---

## 1.2 CTL / ATL / TSB pro silový trénink (Performance Management Chart)

**Czech:** Dlouhodobá zátěž (CTL) / Krátkodobá zátěž (ATL) / Forma (TSB)

**Co to trenérovi řekne:** Zjednodušený Banister (k1=k2=1). Praktičtější,
robustnější, nepotřebuje fit. "Forma" je jediné číslo, které řekne, jestli je
svěřenec zaválcovaný, nebo připravený.

### Přesná matematika

Kanonická TrainingPeaks rekurze (τ_CTL = 42 dnů, τ_ATL = 7 dnů):

```
CTL(d) = CTL(d−1) + (L(d) − CTL(d−1)) / 42
ATL(d) = ATL(d−1) + (L(d) − ATL(d−1)) / 7
TSB(d) = CTL(d−1) − ATL(d−1)          // POZOR: včerejší hodnoty!
```

Přesnější exponenciální varianta (matematicky "správnější" EWMA):

```
CTL(d) = CTL(d−1)·e^(−1/42) + L(d)·(1 − e^(−1/42))
ATL(d) = ATL(d−1)·e^(−1/7)  + L(d)·(1 − e^(−1/7))
```

Inicializace: `CTL(0) = ATL(0) = průměrná denní zátěž prvních 7 dní` (jinak model
prvních ~6 týdnů "najíždí" a TSB je nesmyslně pozitivní).

`L(d)` = denní zátěž. Pro powerlifting doporučuji **sRPE** (už máš) nebo INOL
(taky máš) — tonáž je špatná, protože nadhodnocuje objemové dny s lehkou vahou.

Interpretace TSB (převzato z vytrvalostní praxe, **není** to validované pro sílu):

| TSB | Stav |
|---|---|
| > +25 | Detrénink / příliš dlouhý taper |
| +5 až +25 | Závodní forma („peaked") |
| −10 až +5 | Neutrální / udržovací |
| −30 až −10 | Produktivní tréninkové okno |
| < −30 | Riziko přetížení |

Návrh úpravy časových konstant pro powerlifting: silová únava po těžkém dřepu
odeznívá typicky **48–96 h**, ne 7 dní. Nabídni v nastavení τ_ATL v rozsahu
3–10 dní a τ_CTL 28–56 dní, default 7/42.

**Zdroj:** TrainingPeaks Performance Manager (Coggan/Allen), `[COACH]` co do
konstant, `[PR]` co do matematiky (je to Banister s k1=k2=1).
<https://help.trainingpeaks.com/hc/en-us/articles/204071884-Fitness-CTL>

**Vstupní data:** datum + denní sRPE nebo INOL.

**Priorita: HIGH** — nízká složitost, vysoká hodnota, přímo doplňuje ACWR.

**Výhrady:**
- Prahy (+25/−30) pocházejí z cyklistiky s TSS škálou 0–300/den. **Musíš je
  přeškálovat** na svou jednotku zátěže, jinak jsou to náhodná čísla. Doporučení:
  vyjádři TSB jako **z-skóre** vůči vlastní historii svěřence (`TSB / SD(TSB za 6 měsíců)`),
  a barvi podle toho — to je přenositelné napříč jednotkami.
- CTL/ATL/TSB je popis, ne predikce. Nedělá nic, co by Banister neuměl líp,
  ale nepotřebuje fit.

---

## 1.3 Výhrady k už implementovanému ACWR (doplnit do UI)

ACWR je v aplikaci **už hotový**, ale zaslouží si upřímný disclaimer, protože se
od roku 2020 hodně otřásl:

- Impellizzeri, Tenan et al. (2020), *Acute:Chronic Workload Ratio: Conceptual
  Issues and Fundamental Pitfalls*, **IJSPP 15(6):907–913** `[PR]`: ACWR je poměr
  dvou korelovaných veličin (akutní zátěž je *součástí* chronické) → matematicky
  vzniká falešná korelace i z náhodných dat.
- Kategorizace do "sweet spot" pásem je artefakt binningu; po odstranění outlierů
  a při spojitém zpracování vztah k zranění mizí.
- Žádná studie neodhadla kauzální efekt — manipulace ACWR pro snížení zranění je
  domněnka.

**Doporučení:** ACWR nech, ale v glosáři napiš rovnou, že jde o *heuristiku pro
detekci skoků v objemu*, ne o prediktor zranění. To zvýší důvěryhodnost celé
aplikace víc, než kdyby ses tvářil, že je to věda.

---

# 2. Objemové mezníky a řízení objemu

## 2.1 MEV / MAV / MRV (volume landmarks)

**Czech:** Objemové mezníky — MV / MEV / MAV / MRV

**Co to trenérovi řekne:** Kolik tvrdých sérií týdně na sval/cvik je málo, akorát
a moc. Aplikace už počítá hard sets — chybí jen **cílová pásma** a progresní pravidlo.

### Definice a hodnoty

| Mezník | Význam | Typický rozsah (série/sval/týden) |
|---|---|---|
| MV — Maintenance Volume | udrží, co je | ~6 (často 1/3 MEV) |
| MEV — Minimum Effective Volume | nejmenší objem, který ještě roste | 8–12 (hrudník uváděn 6–8) |
| MAV — Maximum Adaptive Volume | pásmo nejrychlejšího růstu | 12–20 |
| MRV — Maximum Recoverable Volume | strop regenerace | 18–25+ |

**Pro powerlifting** (per lift, ne per sval) neexistuje publikovaná tabulka —
Israetel sám říká, že "squat MRV" se od "quad MRV" liší. **Not found.**
Prakticky použitelná heuristika z RP materiálů `[COACH]`:
soutěžní cvik 3–6 tvrdých sérií na sezení, 2–3× týdně → 8–18 tvrdých sérií/týden
na dřep a bench, 6–12 na mrtvý tah.

### Progresní algoritmus mezocyklu

```
týden 1: začni na MEV (nebo na 60–70 % MRV z minulého bloku)
každý další týden: přidej 1–3 série na svalovou skupinu / cvik
poslední týden: dosáhni MRV
pak: deload (objem −50 %, intenzita −10 %) na 1 týden
```

Paralelně RIR progrese uvnitř mezocyklu: **4 RIR → 3 → 2 → 1 → deload**
(tj. RPE 6 → 7 → 8 → 9).

Detekce dosaženého MRV — implementovatelné z logu, **toto je ta cenná část**:

```js
// MRV signál: skóre 0-3, MRV dosaženo při >= 2 body ze 3
function mrvSignals(week, prevWeek) {
  let s = 0;
  // 1) výkon nešel nahoru navzdory stejnému nebo většímu objemu
  if (week.bestE1rm <= prevWeek.bestE1rm && week.hardSets >= prevWeek.hardSets) s++;
  // 2) RPE creep: stejná relativní intenzita, ale vyšší RPE (>= +0.5)
  if (week.avgRpeAtSameLoad - prevWeek.avgRpeAtSameLoad >= 0.5) s++;
  // 3) subjektivní: Hooper index zhoršen o >= 15 % proti baseline
  if (week.hooper >= prevWeek.hooperBaseline * 1.15) s++;
  return s;
}
```

Body 1 a 2 už z aplikace máš (`plateauCheck`, `rpeCreep`), bod 3 taky (`hooperIndex`).
**Chybí jen jejich sloučení do jednoho MRV signálu a napojení na doporučení deloadu.**

**Zdroj:** Israetel, Hoffmann, Smith — *Scientific Principles of Strength Training*
(RP, 2015) a RP blog `[COACH]`. Dose-response podklad: Pelland, Schoenfeld et al.,
*The Resistance Training Dose Response: Meta-Regressions...*, **Sports Medicine 2025**
(doi 10.1007/s40279-025-02344-w) `[PR]` — 67 studií, 2058 účastníků; ~0,24 % přírůstku
hypertrofie na sérii navíc při průměru 12,25 sérií/týden; **u síly jsou klesající
výnosy výrazně strmější než u hypertrofie**.

**Vstupní data:** cvik, série, RPE, datum, E1RM, Hooper.

**Priorita: HIGH** pro MRV signál a deload trigger. **MEDIUM** pro samotná pásma
MEV/MAV/MRV (viz výhrady).

**Výhrady:**
- **Konkrétní čísla MEV/MAV/MRV nejsou nikde empiricky změřená.** Jsou to
  praktické odhady z koučování, které RP prezentuje s větší jistotou, než jakou
  data unesou. Prezentuj je jako **výchozí odhad k individuálnímu doladění**,
  ne jako normu. Označ v UI (`odhad, ne měření`).
- Dose-response meta-regrese ukazuje, že u **síly** je přínos objemu nad ~10 sérií
  týdně malý — powerlifter nemá stejnou křivku jako kulturista. Nepřenášej
  hypertrofická čísla 1:1 na dřep.
- Nepočítej "sérii" bez definice hard setu. Tvoje definice (RPE ≥ 7 nebo ≥ 70 %)
  je rozumná a lepší, než co většina appek dělá.

---

## 2.2 Stimulus-to-Fatigue Ratio (SFR) — spočitatelná varianta

**Czech:** Poměr podnětu k únavě

**Co to trenérovi řekne:** Který cvik/varianta dává nejvíc adaptace za nejmíň
únavy. V RP je to subjektivní škála; z logu se dá udělat objektivní proxy.

### Přesná matematika (návrh `[ENG]`, ne z literatury)

```
SFR(cvik, okno) = Δ E1RM soutěžního cviku za okno  /  suma INOL toho cviku za okno
```

nebo robustněji, per session:

```
stimulus  = počet hard setů × průměrná relativní intenzita
fatigue   = fatigue percent v sezení (§ 9.1) + následný pokles E1RM za 48 h
SFR       = stimulus / fatigue
```

**Priorita: LOW–MEDIUM.** Koncept je populární, ale číselně nikdy nebyl validovaný.
Označ jasně jako vlastní heuristiku.

**Výhrady:** SFR je v původní podobě **čistě subjektivní hodnocení `[COACH]`**.
Jakákoli číselná verze je tvoje konstrukce, ne převzatá věda. Neprodávej ji jako výzkum.

---

# 3. Velocity-Based Training (VBT)

Aplikace nemá měřák rychlosti — ale VBT tabulky jsou i tak užitečné jako
**druhý nezávislý odhad relativní intenzity** a jako vzdělávací obsah.
A pokud někdy přibude ruční pole "rychlost prvního opakování", je to připravené.

## 3.1 Load–velocity profil: tabulkové hodnoty

**Czech:** Profil zatížení a rychlosti

### Ověřená data (bar/MPV — mean propulsive velocity, m·s⁻¹)

Mladí rekreačně trénovaní; **Smith machine**, ne volná osa:

| %1RM | Dřep ♂ (n=259) | Dřep ♀ (n=96) | Bench ♂ | Bench ♀ |
|---|---|---|---|---|
| 50 % | 0,87 ± 0,08 | 0,81 ± 0,09 | 0,92 ± 0,10 | 0,82 ± 0,09 |
| 60 % | 0,70 ± 0,07 | 0,64 ± 0,11 | 0,70 ± 0,10 | 0,63 ± 0,09 |
| 70 % | 0,61 ± 0,09 | 0,55 ± 0,10 | 0,57 ± 0,10 | 0,51 ± 0,10 |
| 80 % | 0,49 ± 0,12 | 0,42 ± 0,11 | 0,42 ± 0,09 | 0,36 ± 0,08 |
| 100 % | 0,26 ± 0,11 | 0,23 ± 0,06 | 0,21 ± 0,10 | 0,19 ± 0,07 |

Korelace load–velocity: bench r = 0,880 (♂) / 0,872 (♀); dřep r = 0,832 / 0,806.
**Variabilita mezi jedinci: CV 11,3–25,2 %** — proto individuální profil > skupinová tabulka.

Elitní/pokročilí **powerlifteři, volná osa**, průměrná koncentrická rychlost při 1RM
(Helms et al. 2017, n = 15):

| Cvik | ACV při 1RM (m·s⁻¹) | RPE při 1RM |
|---|---|---|
| Dřep | 0,23 ± 0,05 | 9,6 ± 0,5 |
| Bench | 0,10 ± 0,04 | 9,7 ± 0,4 |
| Mrtvý tah | 0,14 ± 0,05 | 9,6 ± 0,5 |

Korelace %1RM ↔ RPE: **r = 0,88–0,91**; rychlost ↔ %1RM: r = −0,90 až −0,92.

**Zdroj:**
- Bar Load-Velocity Profile of Full Squat and Bench Press, PMC9180020 `[PR]`
- Helms, Storey, Cross, Brown, Lenetsky, Ramsay, Dillen, Zourdos (2017),
  *RPE and Velocity Relationships for the Back Squat, Bench Press, and Deadlift
  in Powerlifters*, **JSCR 31(2):292–7**, PMID 27243918 `[PR]`

**Priorita: MEDIUM** (bez měřáku je to hlavně edukační / validační obsah).

**Výhrady:**
- **Polynomiální rovnice %1RM ↔ rychlost (González-Badillo / Sánchez-Medina) jsem
  z primárního zdroje NEOVĚŘIL — koeficienty neuvádím, abych si je nevymýšlel.**
  Používej výše uvedené tabulkové hodnoty a proklad si dodělej sám (kvadratika
  přes 5 bodů).
- Publikované rovnice vznikly na **Smith machine**; letter-to-editor (PMC6225955)
  upozorňuje, že (a) nejsou přenositelné na volnou osu a (b) R² > 0,94 je
  nadhodnocené kvůli autokorelaci (víc měření na osobu).
- Mezijedincová variabilita je velká → skupinová tabulka je pro **jednotlivce**
  jen orientační.

---

## 3.2 Minimální prahová rychlost (MVT)

**Czech:** Minimální prahová rychlost

| Cvik | MVT (m·s⁻¹) | Poznámka |
|---|---|---|
| Bench press | 0,15 ± 0,03 | n = 68 profi ragbisté |
| Dřep (box squat) | 0,25 ± 0,03 | n = 12 |
| Dřep (literatura) | 0,27–0,30 | |
| Mrtvý tah — MVT z LV profilu | 0,28–0,34 | **rozporuplné, viz níže** |
| Mrtvý tah — skutečná rychlost při 1RM | 0,16 ± 0,05 (MPV) | |

Odhad 1RM z LV profilu:

```
1RM = slope × MVT + intercept
kde slope, intercept = lineární regrese (váha ~ rychlost) z 4–6 postupných sérií
```

Validace na benchi: r = 0,98, průměrný rozdíl 3,5 ± 2,9 kg (n = 68).

**Zdroj:** Sportsmith, *An applied guide to velocity based training for maximal
strength* `[COACH]`, opřený o `[PR]` zdroje.
Mrtvý tah: *Comparison of Different Minimal Velocity Thresholds to Establish
Deadlift One Repetition Maximum*, PMC5968962 `[PR]`.

**Priorita: LOW** bez měřáku.

**Výhrady — důležité:**
- **Pro mrtvý tah LV profilování NEFUNGUJE.** PMC5968962: všechny predikce
  podhodnotily skutečné 1RM o **9–15 %** (16,3–27,8 kg, d = 1,03–1,75). Autoři
  explicitně píší, že individualizované LV profily se pro predikci 1RM v mrtvém
  tahu **nemají používat**. Kdybys VBT někdy přidával, mrtvý tah vynech nebo
  označ varováním.
- MVT z "volitional fatigue" sérií (0,28–0,34) je podstatně vyšší než skutečná
  rychlost při 1RM (0,16) — to jsou dvě různé veličiny, nepleť je.

---

## 3.3 Práh poklesu rychlosti v sérii (velocity loss)

**Czech:** Práh poklesu rychlosti

**Co to trenérovi řekne:** Kdy sérii ukončit. Nejlépe podložená část VBT.

| Cíl | Doporučený pokles rychlosti od nejrychlejšího opakování |
|---|---|
| Maximální síla | **10–25 %** (nižší = efektivnější pro sílu) |
| Hypertrofie | **> 20–25 %** (větší akumulovaný objem) |
| Neúčinně nízké | < 10 % (příliš málo únavy pro adaptaci) |
| Bez dalšího přínosu | > 40 % |
| Praktické prahy z praxe | dřep 30 %, bench 35 % |

Alternativa "individual velocity stops": ukonči sérii při 80 % očekávané rychlosti
pro danou zátěž (např. při 80 % 1RM očekáváš 0,70 → stop na 0,56 m·s⁻¹).

**Zdroj:** Jukic et al. (2023), *The Acute and Chronic Effects of Implementing
Velocity Loss Thresholds During Resistance Training: A Systematic Review,
Meta-Analysis, and Critical Evaluation*, **Sports Medicine**,
doi 10.1007/s40279-022-01754-4 `[PR]`; Pareja-Blanco et al. `[PR]`.

**Priorita: LOW** bez měřáku, ale **je to použitelné jako RPE analogie** — viz níže.

### Bezpřístrojová náhrada: pokles opakování / RPE v sérii

Prakticky ekvivalentní pravidlo, které jde z tvého logu:
- Ukonči cvik, když se v opakovacích sériích při stejné váze počet opakování
  propadne o **> 20 %** proti první sérii (≈ 20–25 % velocity loss).
- Nebo: ukonči, když RPE při stejné váze vyskočí o **≥ 2 body** proti první sérii.

Toto je `[COACH]`/`[ENG]` mapování, ne měřená ekvivalence — označ tak.

---

# 4. Peaking a příprava na závod

## 4.1 Modely taperu s čísly (rozšíření stávající taper guidance)

**Czech:** Modely ladění formy

### Data z praxe elitních powerliterů

Grgic & Mikulic (2017), 10 chorvatských open-class šampionů `[PR-weak]`:

| Parametr | Hodnota |
|---|---|
| Délka taperu | ~2,5 týdne |
| Pokles objemu | **50,5 ± 11,7 %** (rozsah 51–59 %) |
| Intenzita | udržena nebo **zvýšena** |
| Vrchol intenzity | **8 ± 3 dny** před závodem |
| Poslední trénink | **3–4 dny** před závodem |
| Typ taperu | step 40 %, exponenciální s rychlým poklesem 60 % |

### RCT: step vs. exponenciální taper

Frontiers in Physiology 2021 (PMC8582352), silový sportovci `[PR]`:

| | Step taper | Exponenciální taper |
|---|---|---|
| Struktura | 1 týden overreach + **1 týden** taper | 1 týden overreach + **3 týdny** taper |
| Objem v posledním týdnu | ~−50 % volume-load | ~−50 % volume-load |
| Relativní intenzita | 77,5–95 % 1RM (obě skupiny) | 77,5–95 % 1RM |
| Dřep | +8 % (g = 0,54) | +10 % (g = 0,54) |
| Bench | +10 % (g = 0,38) | +9 % (g = 0,35) |
| **Mrtvý tah** | **+1 % (n.s.)** | **+8 % (g = 0,48)** |

**Praktický závěr pro algoritmus:** exponenciální taper preferuj, pokud je slabinou
mrtvý tah; step taper stačí u benchařů / krátkých peaků.

### Implementovatelné vzorce

```js
// Lineární taper
volume(d) = V0 * (1 - d / D)                  // d = den taperu, D = délka

// Exponenciální taper (fast decay) — τ ≈ 3–5 dní pro rychlý, 7–10 pro pomalý
volume(d) = V0 * Math.exp(-d / tau)

// Step taper — jednorázový skok
volume(d) = d < D ? V0 * (1 - stepFrac) : V0   // stepFrac ≈ 0.5
```

Analytické řešení optimálního taperu z FFM (arXiv:2505.20859) `[PR]`:

```
exponenciální rozpad kondice → OPTIMÁLNÍ taper je LINEÁRNÍ:
  w(j) = k3·ln(k1/k2) + j·k3·(τ1 − τ2)/(τ1·τ2)

mocninný rozpad → OPTIMÁLNÍ taper je EXPONENCIÁLNÍ:
  w(j) = (k1/k2)^(1/k3) · exp[ (j/k3)·(τ1 − τ2)/(τ1·τ2) ] − 1
```

**Vstupní data:** datum závodu, historie objemu/intenzity po týdnech.

**Priorita: HIGH** — máš taper guidance, ale konkrétní čísla (−50,5 %, vrchol
intenzity 8 dní, poslední trénink 3–4 dny, exponenciální > step pro DL) jsou
přesně to, co trenér chce vidět jako **generovaný plán posledních 3 týdnů**.

**Výhrady:**
- Grgic & Mikulic 2017 je **dotazníkový průzkum na n = 10**. Je to popis toho, co
  šampioni dělají, ne důkaz, že je to optimální.
- RCT (n malé, PMC8582352) měřil jen 6 týdnů a obě skupiny měly stejný celkový
  volume-load — nejde z toho odvodit, že exponenciální taper je univerzálně lepší.
- Optimální taper z FFM závisí na parametrech, které pro powerlifting neznáme (§1.1).

---

## 4.2 Timing rozcvičení a pokusů na závodě

**Czech:** Časování rozcvičení a pokusů

### Matematika, kterou lze v appce spočítat

```
attemptsPerRound   = lifterCount               // v jedné flightě
secPerAttempt      ≈ 60 s                      // konzervativní odhad, 1 lifter ≈ 1 min
roundDuration      = lifterCount × 60 s

// kdy začít rozcvičku
minutesBeforeFlight = warmupSets × restBetween      // restBetween: 5–7 min u singlů,
                                                    // 6–8 min na závodě (sdílené náčiní)
lastWarmupAt       = openerTime − 10 min            // ≈ 10 lifterů před tvým 1. pokusem

// odhad délky celého závodu
totalAttempts      = flights × liftersPerFlight × 9
meetDurationMin   ≈ totalAttempts × 1 min + přestávky mezi disciplínami
```

Praktické konstanty `[COACH]`:

| Parametr | Hodnota |
|---|---|
| Flighta | typicky 10–15 závodníků |
| Čas na pokus | ~1 min/závodník |
| Rozcvička před dřepem (single flight) | 30 min po vážení |
| Rozcvička před benchem / mrtvým tahem | 20 min |
| Rozestup mezi rozcvičovacími singly | 5–7 min (na závodě 6–8 min) |
| Poslední rozcvičovací série | ~10 min / ~10 závodníků před 1. pokusem |
| Počet rozcvičovacích sérií | 4–6 |
| Poslední rozcvička vs. opener | **< 90 % otvíracího pokusu** |
| Interval mezi vlastními pokusy (stejná flighta) | ≈ délka kola |

**Zdroj:** EliteFTS *Meet Management 101: Warm Up Timing*, PowerliftingTechnique,
PRS on the Platform — vše `[COACH]`, žádná peer-reviewed data.

**Vstupní data:** počet flight, počet závodníků, pořadí, čas startu, otvírací pokusy.

**Priorita: HIGH** — "generátor meet-day timeline" je funkce, kterou trenéři
opravdu na závodě potřebují a žádná free appka ji pořádně nemá. Máš už
`warmupLadder()` — chybí jen **osa času**.

**Výhrady:** Všechny konstanty jsou trenérská praxe. Reálné tempo závodu kolísá
(mezizvedací pauzy, nároky, technické prodlevy). Nabídni v UI posuvník
"min/pokus" 0,8–1,5 a přepočítávej.

---

## 4.3 Statistika výběru pokusů — benchmarking (rozšíření stávajícího)

Aplikace už používá 91 / 96,5 / 102 %. Doplň **srovnávací statistiku**:

| Metrika | Hodnota | Zdroj |
|---|---|---|
| Vítězové IPF World Classic 2016: úspěšné pokusy | **8,46 z 9** | analýza výsledků `[COACH]` |
| Průměrný závodník | **6,66 z 9** | tamtéž |
| Lifteři, kteří dali 3. pokus: opener | **91 %** třetího pokusu | IPF MS 2012–2019 `[COACH]` |
| Lifteři, kteří dali 3. pokus: 2. pokus | **96 %** třetího pokusu | tamtéž |
| Typický skok 1→2 | dřep/mrtvý tah 5–7,5 %, bench 3–5 % | `[COACH]` |
| Úspěšnost 3. pokusu | 0,5–0,8 | vs. 2. pokus 0,75–1,0 |

**Priorita: MEDIUM.** Máš success rate — přidej **porovnání s benchmarkem**
("tvůj svěřenec dává 6,2/9, medailisté dávají 8,5/9 → jsi příliš agresivní ve
třetích pokusech").

**Výhrady:** Čísla 91/96 jsou **podmíněná úspěchem** (survivorship bias — počítána
jen z lifterů, kteří třetí pokus dali). Neznamenají, že 91 % opener maximalizuje
totál. Napiš to v glosáři.

---

# 5. Silové standardy a benchmarky

## 5.1 Poměry S : B : D k totálu podle váhové kategorie — TOHLE JE PERLA

**Czech:** Poměry disciplín k totálu / detekce slabého článku

**Co to trenérovi řekne:** Jestli je totál vyvážený, nebo jestli má svěřenec
disproporčně slabou disciplínu — a to **normalizovaně na váhovou kategorii,
pohlaví a výstroj**, ne podle bro pravidla "3:4:5".

### Data

Hernández Ugalde (2023), *Powerlifting Balance Of SBD Disciplines Ratio To Total
Score*, **Int J Strength Cond 3(1)**, doi 10.47206/ijsc.v3i1.198 `[PR]`.
Zdroj dat: OpenPowerlifting, IPF závody 2012–2022, věk 24–39.
n = 65 867 ♂ classic, 35 679 ♀ classic, 19 295 ♂ equipped, 7 426 ♀ equipped.

Mean/SD jsou z **elitní skupiny (90.–100. kvantil GLP)**. MIN/MAX je "Optimal
Ratio Range" (ORR) = mean ± f·SD, kde f je optimalizovaný faktor.

Vzorec: `ratio_disciplína = disciplína / totál × 100`

#### Muži — RAW / classic

| Kat. | f | SQ mean | SQ SD | SQ min | SQ max | BP mean | BP SD | BP min | BP max | DL mean | DL SD | DL min | DL max |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 59 | 1,8 | 36,29 | 2,55 | 31,71 | 40,87 | 24,57 | 1,77 | 21,40 | 27,75 | 39,13 | 2,98 | 33,76 | 44,51 |
| 66 | 1,6 | 35,53 | 1,76 | 32,72 | 38,34 | 24,11 | 1,84 | 21,17 | 27,05 | 40,36 | 1,94 | 37,25 | 43,47 |
| 74 | 1,6 | 35,67 | 1,56 | 33,17 | 38,17 | 23,69 | 1,99 | 20,51 | 26,87 | 40,64 | 2,15 | 37,20 | 44,07 |
| 83 | 1,4 | 35,75 | 1,64 | 33,45 | 38,05 | 23,80 | 2,03 | 20,95 | 26,64 | 40,45 | 2,16 | 37,43 | 43,47 |
| 93 | 1,3 | 35,96 | 1,69 | 33,77 | 38,15 | 23,97 | 1,94 | 21,45 | 26,48 | 40,07 | 1,96 | 37,52 | 42,62 |
| 105 | 1,2 | 36,17 | 1,70 | 34,14 | 38,21 | 24,19 | 1,84 | 21,99 | 26,40 | 39,64 | 2,11 | 37,11 | 42,16 |
| 120 | 1,0 | 36,83 | 1,83 | 35,00 | 38,66 | 24,51 | 1,92 | 22,59 | 26,42 | 38,67 | 2,08 | 36,58 | 40,75 |
| +120 | 0,7 | 37,99 | 2,22 | 36,44 | 39,54 | 24,73 | 2,01 | 23,32 | 26,14 | 37,28 | 2,39 | 35,60 | 38,95 |

#### Ženy — RAW / classic

| Kat. | f | SQ mean | SQ SD | SQ min | SQ max | BP mean | BP SD | BP min | BP max | DL mean | DL SD | DL min | DL max |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 47 | 1,6 | 35,46 | 2,04 | 32,19 | 38,73 | 20,96 | 2,27 | 17,32 | 24,60 | 43,58 | 2,39 | 39,76 | 47,40 |
| 52 | 1,5 | 35,67 | 1,97 | 32,72 | 38,62 | 21,21 | 2,33 | 17,72 | 24,70 | 43,12 | 2,48 | 39,41 | 46,84 |
| 57 | 1,4 | 36,01 | 1,92 | 33,32 | 38,70 | 21,49 | 2,31 | 18,26 | 24,73 | 42,50 | 2,45 | 39,07 | 45,93 |
| 63 | 1,3 | 36,38 | 1,96 | 33,83 | 38,93 | 21,49 | 2,31 | 18,49 | 24,49 | 42,13 | 2,37 | 39,05 | 45,21 |
| 69 | 1,3 | 36,46 | 1,81 | 34,11 | 38,81 | 21,31 | 2,19 | 18,46 | 24,16 | 42,23 | 2,26 | 39,29 | 45,17 |
| 76 | 1,2 | 36,70 | 1,81 | 34,52 | 38,87 | 21,13 | 2,10 | 18,61 | 23,65 | 42,17 | 2,29 | 39,42 | 44,92 |
| 84 | 1,0 | 37,17 | 2,08 | 35,09 | 39,26 | 20,77 | 2,21 | 18,56 | 22,98 | 42,06 | 2,35 | 39,71 | 44,40 |
| +84 | 0,9 | 38,79 | 2,36 | 36,66 | 40,91 | 21,43 | 2,48 | 19,20 | 23,65 | 39,79 | 2,75 | 37,31 | 42,26 |

#### Muži — equipped

| Kat. | f | SQ mean | SQ SD | SQ min | SQ max | BP mean | BP SD | BP min | BP max | DL mean | DL SD | DL min | DL max |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 59 | 2,5 | 39,01 | 1,24 | 35,91 | 42,11 | 25,47 | 1,42 | 21,93 | 29,01 | 35,52 | 1,93 | 30,70 | 40,34 |
| 66 | 2,6 | 37,93 | 1,91 | 32,95 | 42,91 | 25,88 | 1,89 | 20,96 | 30,80 | 36,19 | 1,89 | 31,28 | 41,10 |
| 74 | 2,6 | 37,87 | 1,36 | 34,34 | 41,41 | 26,10 | 2,31 | 20,11 | 32,10 | 36,02 | 2,34 | 29,93 | 42,12 |
| 83 | 2,4 | 38,23 | 1,56 | 34,48 | 41,97 | 26,84 | 2,20 | 21,55 | 32,13 | 34,93 | 2,10 | 29,89 | 39,97 |
| 93 | 2,1 | 38,21 | 1,52 | 35,01 | 41,41 | 27,11 | 1,91 | 23,10 | 31,11 | 34,68 | 1,87 | 30,74 | 38,62 |
| 105 | 1,8 | 38,16 | 1,43 | 35,58 | 40,74 | 27,79 | 2,37 | 23,52 | 32,07 | 34,05 | 2,33 | 29,85 | 38,25 |
| 120 | 1,5 | 38,61 | 1,40 | 36,51 | 40,72 | 28,10 | 2,10 | 24,95 | 31,24 | 33,29 | 2,28 | 29,87 | 36,72 |
| +120 | 1,1 | 38,91 | 1,29 | 37,48 | 40,33 | 29,23 | 1,82 | 27,23 | 31,23 | 31,86 | 1,81 | 29,88 | 33,85 |

#### Ženy — equipped

| Kat. | f | SQ mean | SQ SD | SQ min | SQ max | BP mean | BP SD | BP min | BP max | DL mean | DL SD | DL min | DL max |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 47 | 1,7 | 39,13 | 2,19 | 35,40 | 42,85 | 24,25 | 3,22 | 18,77 | 29,72 | 36,63 | 1,92 | 33,37 | 39,89 |
| 52 | 1,6 | 39,22 | 1,81 | 36,32 | 42,12 | 24,43 | 2,59 | 20,29 | 28,57 | 36,35 | 2,00 | 33,16 | 39,54 |
| 57 | 1,5 | 38,86 | 2,08 | 35,73 | 41,99 | 24,90 | 2,51 | 21,13 | 28,67 | 36,24 | 1,95 | 33,31 | 39,17 |
| 63 | 1,5 | 38,45 | 1,86 | 35,66 | 41,24 | 25,42 | 2,82 | 21,19 | 29,66 | 36,13 | 2,14 | 32,92 | 39,33 |
| 69 | 1,3 | 38,49 | 1,51 | 36,54 | 40,45 | 26,23 | 2,43 | 23,07 | 29,38 | 35,28 | 2,53 | 31,99 | 38,57 |
| 76 | 1,0 | 39,19 | 1,60 | 37,58 | 40,79 | 25,42 | 2,51 | 22,90 | 27,93 | 35,40 | 2,82 | 32,58 | 38,22 |
| 84 | 0,8 | 39,86 | 2,08 | 38,19 | 41,53 | 25,90 | 2,98 | 23,51 | 28,28 | 34,24 | 2,08 | 32,58 | 35,91 |
| +84 | 0,9 | 39,70 | 1,44 | 38,39 | 41,00 | 26,45 | 3,50 | 23,29 | 29,60 | 33,86 | 2,68 | 31,45 | 36,27 |

*(Sanity check: mean SQ + mean BP + mean DL = 100,0 ± 0,01 v každém řádku.)*

### Implementace

```js
function sbdBalance({ squat, bench, deadlift, sex, bodyweight, equipment }) {
  const total = squat + bench + deadlift;
  const r = { sq: squat/total*100, bp: bench/total*100, dl: deadlift/total*100 };
  const row = SBD_RATIOS[equipment][sex][weightClass(bodyweight, sex)];
  const code = ['sq','bp','dl'].map(k =>
    r[k] < row[k].min ? 'L' : r[k] > row[k].max ? 'H' : 'M'
  ).join('');            // "MMM" = vyvážený; "LMH" = slabý dřep, silný tah
  const z = { sq: (r.sq - row.sq.mean)/row.sq.sd, /* ... */ };
  return { ratios: r, code, z, balanced: code === 'MMM' };
}
```

**Vstupní data:** výsledky ze závodu (nebo E1RM tří cviků), pohlaví, tělesná
hmotnost, výstroj.

**Priorita: HIGH** — velký, čistý dataset (128 k záznamů), přímo použitelná
tabulka, řeší reálný trenérský problém ("na čem mám pracovat?"), a v žádné
konkurenční appce to není.

**Výhrady:**
- Studie ukazuje **asociaci, ne kauzalitu**. Lifteři uvnitř ORR mají vyšší GLP,
  ale to nedokazuje, že narovnáním poměru totál poroste. Formuluj v UI opatrně
  ("tvůj poměr je mimo pásmo elitních lifterů", ne "musíš víc dřepovat").
- Z 64 testovaných kombinací bylo 48 statisticky významných, 15 jen numericky
  vyšších, 1 zamítnuto. U kategorií bez podpory (autor jmenuje ♂ classic mimo
  66/74/93/105/+120) použij jen mean elitních lifterů jako cíl, ORR nezobrazuj
  jako tvrdý verdikt.
- Věk 24–39 → nepoužívej beze změny na masters a dorost.
- Váhové kategorie odpovídají IPF 2011–2025 rozdělení; při změně kategorií je
  třeba přepočítat.

---

## 5.2 Percentily relativní síly (populace 810 tisíc startů)

**Czech:** Percentily relativní síly

Meta-normativa z 809 986 startů (571 650 ♂, 238 336 ♀), drug-tested raw:

**90. percentil, mladí dospělí (18–35 let), násobky tělesné hmotnosti:**

| Cvik | Muži | Ženy |
|---|---|---|
| Dřep | 2,83 | 2,26 |
| Bench | 1,95 | 1,35 |
| Mrtvý tah | 3,25 | 2,66 |

**90. percentil, > 80 let:**

| Cvik | Muži | Ženy |
|---|---|---|
| Dřep | 1,72 | 1,01 |
| Bench | 1,31 | 0,92 |
| Mrtvý tah | 2,30 | 1,68 |

**Zdroj:** *Normative data for the squat, bench press and deadlift exercises in
powerlifting: Data from 809,986 competition entries*, **J Sci Med Sport (2024)**,
doi 10.1016/j.jsams.2024.06.008 `[PR]`. Online nástroj autorů:
`thestrengthinitiative.com`.

**Vstupní data:** výsledek, hmotnost, pohlaví, věk.

**Priorita: MEDIUM** (máš DOTS/IPF GL, což je lepší normalizace, ale percentily
jsou pro laika srozumitelnější).

**Výhrady:** Plnou tabulku 10.–90. percentilu po věkových skupinách jsem
z paywallu nedostal — **v dokumentu jsou jen ověřené hodnoty pro 90. percentil**
u dvou věkových skupin. Zbytek: `not found`. Nedopočítávej ho interpolací a
nevydávej za data.

**Lepší alternativa:** stáhni si CSV z OpenPowerlifting (veřejné, CC0) a
percentily DOTS/GL si spočítej sám pro přesně tu populaci, která tě zajímá
(federace, výstroj, rok, kategorie). To je pár set kB dat a přesně odpovídá tvé
uživatelské základně.

---

## 5.3 Věkové koeficienty — McCulloch / Foster (KOMPLETNÍ TABULKA)

**Czech:** Věkové koeficienty (masters a dorost)

**Co to trenérovi řekne:** Srovná výkon napříč věkem. Nutné pro masters i dorost.
Násobí se **body** (DOTS/Wilks/GL), typicky: `McCulloch points = DOTS × ageCoeff × totál`.

### Kanonická tabulka (OpenPowerlifting — Foster 14–22 + Glossbrenner-opravený McCulloch 41–80 + USAPL 81–90)

```js
// index = věk v letech; hodnota = koeficient
export const AGE_COEFF = [
  0,0,0,0,0,                                            // 0–4 (nesmysl)
  1.73,1.67,1.61,1.55,1.49,1.43,1.38,1.33,1.28,         // 5–13 (ODHAD, nestandardní)
  1.23,1.18,1.13,1.08,1.06,1.04,1.03,1.02,1.01,         // 14–22 Foster
  1.00,1.00,1.00,1.00,1.00,1.00,1.00,1.00,              // 23–30
  1.00,1.00,1.00,1.00,1.00,1.00,1.00,1.00,1.00,1.00,    // 31–40
  1.010,1.020,1.031,1.043,1.055,1.068,1.082,1.097,1.113,1.130, // 41–50
  1.147,1.165,1.184,1.204,1.225,1.246,1.268,1.291,1.315,1.340, // 51–60
  1.366,1.393,1.421,1.450,1.480,1.511,1.543,1.576,1.610,1.645, // 61–70
  1.681,1.718,1.756,1.795,1.835,1.876,1.918,1.961,2.005,2.050, // 71–80
  2.096,2.143,2.190,2.238,2.287,2.337,2.388,2.440,2.494,2.549, // 81–90
  2.605,2.662,2.720,2.779,2.839,2.900,2.962,3.025,3.089,3.154  // 91–100 (EXTRAPOLACE)
];
```

Pravidla zaokrouhlení při neznámém přesném věku (OpenPowerlifting):
- přesný věk → přímý lookup, nad 100 → 3.154
- přibližný věk < 30 → použij `AGE_COEFF[age + 1]` (u juniorů předpokládej vyšší věk)
- přibližný věk ≥ 30 → použij `AGE_COEFF[age]` (u masters předpokládej nižší věk)
- neznámý věk → 1,0

### POZOR: existují nekompatibilní varianty téže tabulky

WRPF (edice 2022) používá **jiná čísla** pro stejné věky:

| Věk | OpenPowerlifting | WRPF 2022 |
|---|---|---|
| 41 | 1,010 | 1,005 |
| 45 | 1,055 | 1,060 |
| 50 | 1,130 | 1,150 |
| 60 | 1,340 | 1,380 |
| 70 | 1,645 | 1,700 |
| 79 | 2,005 | 2,060 |
| 80+ | 2,050 → 2,549 (roste do 90) | **2,060 (zastropováno pro 80–90)** |

**Doporučení:** implementuj OpenPowerlifting variantu jako výchozí (je to
nejrozšířenější a je opravená proti chybám v původní USAPL-SD tabulce podle
Glossbrennerových masters koeficientů), ale **napiš v UI, kterou variantu používáš**,
a případně nabídni WRPF jako přepínač pro lifterů startující ve WRPF.

**Zdroj:** OpenPowerlifting `crates/coefficients/src/mcculloch.rs` (MIT) — ověřeno
přímo ze zdrojáku `[COACH]` (federační norma, ne věda); Foster koeficienty
z USAPL `[COACH]`; WRPF McCulloch Coefficients for Masters, edice 2022 `[COACH]`.

**Vstupní data:** věk, pohlaví, hmotnost, totál.

**Priorita: HIGH** — máš DOTS/Wilks/GL, ale bez věkového koeficientu neumíš
obsloužit masters ani dorost, což je velká část členské základny v ČR.

**Výhrady:**
- Koeficienty **nemají publikovanou odvozovací rovnici**; jsou to historicky
  dohodnuté tabulky odvozené z výsledků. Nejsou to výsledky výzkumu.
- Hodnoty 5–13 a 91–100 jsou v OpenPowerlifting explicitně označené jako
  odhad/extrapolace. **Nepoužívej je bez varování v UI.**
- Věkové koeficienty se aplikují na body, ne na totál v kg — dej pozor na pořadí
  násobení.

---

# 6. Progresní modely a šablony

Které z nich stojí za zakódování jako **šablona s automatickým výpočtem vah**:

## 6.1 5/3/1 (Wendler) — DOPORUČUJI ZAKÓDOVAT

**Czech:** 5/3/1

```
Training Max (TM) = 90 % 1RM (nebo 85 % pro konzervativní verzi)

Týden 1 („5"):     65 % ×5, 75 % ×5, 85 % ×5+   (poslední série AMRAP)
Týden 2 („3"):     70 % ×3, 80 % ×3, 90 % ×3+
Týden 3 („5/3/1"): 75 % ×5, 85 % ×3, 95 % ×1+
Týden 4 (deload):  40 % ×5, 50 % ×5, 60 % ×5

Všechna % z TM, ne z 1RM.

Progrese po každém 4týdenním cyklu:
  dřep, mrtvý tah: TM += 5 kg  (10 lb)
  bench, tlak:     TM += 2,5 kg (5 lb)

Odhad E1RM z AMRAP série: Epley → e1RM = w × (1 + reps/30)
```

**Zdroj:** Wendler, *5/3/1* (2009/2011) `[COACH]`.
**Priorita: MEDIUM–HIGH** — nejrozšířenější šablona na světě, triviální na
zakódování, uživatelé ji čekají.
**Výhrady:** Progrese TM je fixní a lineární — pro pokročilé powerliftery je
příliš pomalá / příliš rychlá. Zabuduj kontrolu: pokud AMRAP v týdnu 3 nedá
alespoň TM/1RM očekávaný počet opakování, TM sniž o 10 %.

## 6.2 Texas Method

```
Pondělí (objem):   5×5 @ 90 % pondělního 5RM
Středa (lehké):    2×5 @ 80 % pondělní váhy
Pátek (intenzita): 1×5 nové 5RM (týdenní PR), +2,5 kg horní / +5 kg dolní partie
```
**Zdroj:** Rippetoe & Baker, *Practical Programming* `[COACH]`.
**Priorita: LOW–MEDIUM.** Pro pokročilé powerliftery už je to překonané.

## 6.3 Sheiko-styl — distribuce objemu (užitečnější jako METRIKA než jako šablona)

Sheiko se nedá dost dobře „vygenerovat", ale jeho **normy distribuce jde použít
jako benchmark pro cizí program**:

| Metrika | Sheikova norma |
|---|---|
| Počet zvedů (NL) za 4 týdny — elitní | ~300–350 na cvik/měsíc; celkově 900–1900 |
| Většina sezení | 70–80 % 1RM |
| Opakování v sérii | zřídka > 5 |
| Frekvence | dřep 2×/týden, bench 3×/týden, mrtvý tah 1×/týden |
| Typické sekvence | 6×5@60, 5×5@65, 5×4@70, 4×4@75, 6×3@80, 5×2@85 |

Implementace jako **histogram intenzit** (už máš Prilepin — přidej srovnání
skutečné distribuce zvedů po 5% pásmech proti Sheikově normě).

**Zdroj:** Sheiko programy, PowerliftingToWin analýzy `[COACH]`.
**Priorita: MEDIUM** pro histogram distribuce, **LOW** pro šablonu.
**Výhrady:** Sheikovy objemy byly psané pro (často farmakologicky podpořené)
sovětské/ruské profesionály. Slepé kopírování NL norem je běžná chyba.

## 6.4 Blokové periodizace (Issurin)

| Blok | Délka (powerlifting) | Charakter |
|---|---|---|
| Akumulace | ~6 týdnů | vysoký objem, 60–75 % |
| Transmutace | ~6 týdnů | 3–6 opak., 75–87,5 %, delší pauzy |
| Realizace | ~4 týdny | nízký objem, 85–100 %, taper |

**Zdroj:** Issurin, *Block Periodization* `[COACH]` + elitefts aplikace na PL.
**Priorita: MEDIUM** — jako **generátor kostry makrocyklu** z data závodu.
Máš už `analyzeBlock` a `macro` view; chybí generování.

## 6.5 Bulharsky / daily max — ZAKÓDOVAT S VAROVÁNÍM

Pilotní studie (PMC6162635) porovnávala nízkoobjemový daily-max s objemovou
periodizací u powerlifterů před závodem `[PR-weak]`.
**Priorita: LOW.** Vysoké riziko, pilotní data, nevhodné jako výchozí doporučení.
**Výhrady:** Denní maxima jsou pro drtivou většinu naturálních lifterů
nedoporučitelná. Pokud to zakóduješ, dej varování.

## 6.6 Wave loading

`[COACH]`, žádná přímá evidence. Např. 3-2-1 / 3-2-1 s +2,5 kg mezi vlnami.
**Priorita: LOW.** Zakóduj nanejvýš jako generátor sérií, ne jako doporučení.

---

# 7. Statistika pro trenéra — odlišit skutečný pokrok od šumu

**Toto je celá kategorie, která v aplikaci úplně chybí, a přitom má nejlepší
poměr hodnota/pracnost.**

## 7.1 Typická chyba měření a nejmenší smysluplná změna

**Czech:** Typická chyba (TE) a nejmenší smysluplná změna (SWC)

### Přesná matematika

```
Typická chyba (Hopkins):
  TE = SD(rozdílů mezi dvěma měřeními) / √2

Jako CV %:
  CV = SD(ln(x2) − ln(x1)) / √2 × 100     // log-transformace, protože chyba je
                                          // proporcionální k váze

SWC — populační (Cohen):
  SWC = 0,2 × SD_mezi_sportovci

SWC — individuální (Hopkins, pro elitního jedince):
  SWC ≈ 0,5 × typická variabilita výkonu mezi závody
      ≈ 0,3 × TE  (konzervativní), běžně se používá 0,5 × TE

Rozhodovací pravidlo:
  Δ > SWC + TE           → pravděpodobně skutečné zlepšení
  |Δ| ≤ TE               → šum, nedělej nic
  Δ < −(SWC + TE)        → pravděpodobný pokles
```

### Čísla, která máš k dispozici

| Veličina | Hodnota | Zdroj |
|---|---|---|
| CV predikce 1RM z rovnic | **4,5–13,2 %** | přehled predikčních studií `[PR]` |
| SD odhadu vs. změřené 1RM | **±5 %** v platném rozsahu opak. | `[PR]` |
| Přesnost při ≤ 10 opak. | ±5 % | `[PR]` |
| Přesnost při > 10 opak. | ±15–20 % | `[PR]` |
| Přesnost RPE u powerlifterů (odchylka reportovaného od cíleného) | **0,33 ± 0,28 RPE** (rozsah 0,22–0,44) | Helms et al. 2017, PMID 28933716 `[PR]` |
| SD reportovaného RPE u zkušených dřepařů | 0,32 @100 %, 0,92 @90 %, 0,97 @75 %, 1,18 @60 % 1RM | Zourdos et al. 2016 `[PR]` |
| CV 1RM z multi-point / 2-point LV metody | < 10 % (dřep, mrtvý tah) | PMC8898007 `[PR]` |

**Praktický default pro aplikaci: TE(E1RM) ≈ 3–5 % pro série 1–5 opakování při
RPE ≥ 7; ≈ 8 % pro 6–10 opakování; > 10 opakování nepoužívej pro trendy vůbec.**

Ale **nejlepší je počítat TE z vlastních dat svěřence:**

```js
// TE z opakovaných měření E1RM v „stabilním" období (např. baseline týden)
function typicalErrorPct(e1rms) {          // pole E1RM z blízkých dní bez trendu
  const logs = e1rms.map(Math.log);
  const diffs = [];
  for (let i = 1; i < logs.length; i++) diffs.push(logs[i] - logs[i-1]);
  const m = diffs.reduce((a,b)=>a+b,0)/diffs.length;
  const sd = Math.sqrt(diffs.reduce((a,b)=>a+(b-m)**2,0)/(diffs.length-1));
  return (sd / Math.SQRT2) * 100;          // % CV
}
```

**Zdroj:** Hopkins, *How to Interpret Changes in an Athletic Performance Test*,
Sportscience 8:1–7 (2004) `[PR]`; Cohen 1988 `[PR]`.

**Vstupní data:** série E1RM (už počítáš).

**Priorita: HIGH.** Toto je ta věc, která odliší seriózní trenérský nástroj od
appky s hezkými grafy. Bez pásma nejistoty je každý graf E1RM zavádějící.

**Výhrady:**
- SWC = 0,2 × SD je Cohenova konvence, **ne empiricky odvozený práh** pro
  powerlifting. Je to rozumná heuristika, ne zákon.
- CV odhadu 1RM se **liší podle cviku** — mrtvý tah je nejhorší (rovnice ho
  systematicky podhodnocují), bench nejlepší. Dej per-lift TE.

## 7.2 Pásmo spolehlivosti kolem trendu E1RM

**Czech:** Interval spolehlivosti trendu

Máš `trend()` (lineární regrese) a `plateauCheck()`. Chybí **kvantifikace nejistoty**.

```js
// OLS + 95% predikční pás; x = dny od začátku, y = E1RM
function trendWithBand(points) {
  const n = points.length;
  const mx = mean(points.map(p=>p.x)), my = mean(points.map(p=>p.y));
  const Sxx = sum(points.map(p => (p.x-mx)**2));
  const Sxy = sum(points.map(p => (p.x-mx)*(p.y-my)));
  const slope = Sxy / Sxx;
  const intercept = my - slope*mx;
  const resid = points.map(p => p.y - (intercept + slope*p.x));
  const se = Math.sqrt(sum(resid.map(r=>r*r)) / (n-2));   // reziduální SD
  const seSlope = se / Math.sqrt(Sxx);
  const t = tCrit95(n-2);                                  // ≈ 2 pro n ≥ 20
  return {
    slope, intercept,
    slopeCI: [slope - t*seSlope, slope + t*seSlope],
    // pás okolo predikce v bodě x:
    band: (x) => t * se * Math.sqrt(1 + 1/n + (x-mx)**2 / Sxx)
  };
}
// t kritické hodnoty (dvoustranné, 95 %) pro df = 1..30
const T95 = [12.706,4.303,3.182,2.776,2.571,2.447,2.365,2.306,2.262,2.228,
             2.201,2.179,2.160,2.145,2.131,2.120,2.110,2.101,2.093,2.086,
             2.080,2.074,2.069,2.064,2.060,2.056,2.052,2.048,2.045,2.042];
function tCrit95(df){ return df<=0?12.706 : df<=30?T95[df-1] : 1.96; }
```

**Rozhodovací pravidlo pro plateau (lepší než současné):**
plateau = `slopeCI` obsahuje 0 **a** `|slope| × 28 dní < SWC` (tj. i kdyby trend
byl skutečný, za 4 týdny nedá smysluplný přírůstek).

**Priorita: HIGH.** Malá práce, přímé vylepšení už existující funkce.

**Zdroj:** standardní OLS statistika `[ENG]`.

## 7.3 Robustní trend: Theil–Sen + Mann–Kendall

**Czech:** Robustní odhad trendu

OLS je citlivá na jeden špatný den (nemoc, zkažený pokus). Theil–Sen je medián
všech párových sklonů — outliery ho neovlivní.

```js
function theilSen(points) {
  const slopes = [];
  for (let i=0;i<points.length;i++)
    for (let j=i+1;j<points.length;j++)
      if (points[j].x !== points[i].x)
        slopes.push((points[j].y-points[i].y)/(points[j].x-points[i].x));
  slopes.sort((a,b)=>a-b);
  const slope = slopes[Math.floor(slopes.length/2)];
  const inters = points.map(p => p.y - slope*p.x).sort((a,b)=>a-b);
  return { slope, intercept: inters[Math.floor(inters.length/2)] };
}

// Mann–Kendall: existuje monotónní trend? (neparametrický, nepředpokládá linearitu)
function mannKendall(y) {
  let S = 0;
  for (let i=0;i<y.length-1;i++)
    for (let j=i+1;j<y.length;j++) S += Math.sign(y[j]-y[i]);
  const n = y.length;
  const varS = n*(n-1)*(2*n+5)/18;                 // bez korekce na shody
  const Z = S > 0 ? (S-1)/Math.sqrt(varS) : S < 0 ? (S+1)/Math.sqrt(varS) : 0;
  return { S, Z, significant: Math.abs(Z) > 1.96 };  // p < 0.05
}
```

**Priorita: MEDIUM–HIGH.** `[ENG]`, standardní statistika, ale v silových appkách
prakticky neviděná.

## 7.4 CUSUM — detekce okamžiku zlomu

**Czech:** Detekce zlomu (CUSUM)

Odpoví na "**kdy přesně** se progres zastavil", ne jen "zastavil se".

```js
// standardizovaná CUSUM na E1RM
function cusum(y, k = 0.5, h = 4) {         // k v jednotkách SD, h = práh
  const m = mean(y), sd = stdev(y);
  let cPos = 0, cNeg = 0;
  return y.map((v,i) => {
    const z = (v - m)/sd;
    cPos = Math.max(0, cPos + z - k);
    cNeg = Math.min(0, cNeg + z + k);
    return { i, cPos, cNeg, alarm: cPos > h || cNeg < -h };
  });
}
```

**Priorita: MEDIUM.** `[ENG]`.

---

# 8. Metriky spočitatelné z logu, které nikde nemáš

## 8.1 Procento únavy (RTS Fatigue Percent) — HIGH

**Czech:** Procento únavy v sezení

**Co to trenérovi řekne:** Kolik síly svěřenec v rámci jednoho sezení ztratil.
Přímá, okamžitá míra "kolik toho dnes bylo".

### Přesná matematika

```
fatiguePercent = (E1RM_nejvyšší_v_sezení − E1RM_poslední_série) / E1RM_nejvyšší × 100
```

E1RM se počítá z každé série pomocí RPE (váha, opak., RPE) — to už umíš (`setE1rm`).

Cílová pásma podle Tuchscherera `[COACH]`:

| Cíl bloku | Cílové % únavy |
|---|---|
| Bez únavy (peaking, speed work) | 0 % |
| Minimální | 2 % |
| Střední (většina objemové práce) | 5 % |
| Vysoká (akumulace) | 7 % |

Ekvivalence RPE ↔ % únavy (RTS): RPE 8→8,5 = 3 %; RPE 8→9 = 5 %; RPE 8→10 = 7 %.

Dvě metody, obě se dají z logu detekovat automaticky:
- **Load drop** — po dosažení cílového RPE sniž váhu o X % a opakuj série na stejné RPE
- **Repeats** — opakuj stejnou váhu/opakování, sleduj růst RPE

**Zdroj:** Tuchscherer, Reactive Training Systems, *Fatigue Percents Revisited* (2016)
a *RTS Manual* `[COACH]`. Není peer-reviewed.

**Vstupní data:** série, opakování, váha, RPE, datum (vše už máš).

**Priorita: HIGH** — implementace je ~30 řádků, koncept je mezi vážnými
powerliftery velmi rozšířený, a přirozeně navazuje na už hotovou RPE tabulku.

**Výhrady:**
- Čistě trenérská praxe. Cílové hodnoty (2/5/7 %) nejsou empiricky odvozené.
- Metrika je citlivá na chybu odhadu RPE — při TE ≈ 3–5 % na E1RM je rozdíl mezi
  „2 %" a „5 %" únavy na hranici šumu. **Zobrazuj s pásmem nejistoty** (§7.1) a
  nedělej z toho tvrdé pravidlo.
- Nefunguje u sezení s jediným typem série.

## 8.2 Index specifičnosti — MEDIUM

**Czech:** Index specifičnosti

```
specificity = tonáž(soutěžní varianta SBD) / tonáž(všechno) × 100
```
Počítej po týdnech a po blocích. Očekávaný vývoj: v akumulaci 40–60 %,
v realizaci 80–95 %. `[COACH]` (odvozeno z blokové periodizace).

Doplněk: **frekvence na cvik/týden** a **rozestup mezi těžkými expozicemi** —
obojí triviální z dat a nikde to nemáš.

## 8.3 Týdenní tempo nárůstu zátěže (ramp rate) — MEDIUM

**Czech:** Týdenní nárůst zátěže

```
rampRate(t) = (load_týden_t − load_týden_t−1) / load_týden_t−1 × 100
```
Praktické pravidlo z vytrvalostní praxe: > +10 %/týden = riziko. **Pozor:**
„10% rule" je opakovaně vyvrácená u běžců `[PR]`; použij jen jako informativní
graf, ne jako varování. Lepší je sledovat ramp rate CTL (§1.2): růst CTL
> 5–7 jednotek/týden se ve vytrvalostní praxi považuje za agresivní `[COACH]`.

## 8.4 Reziduum RPE vs. relativní intenzita (denní připravenost) — HIGH

**Czech:** Odchylka RPE od očekávání (denní připravenost)

**Co to trenérovi řekne:** Jestli byl dnešek těžší nebo lehčí, než měl být.
Nejlepší bezpřístrojová proxy pro readiness, kterou z logu dostaneš.

```js
// 1) postav si osobní RPE model svěřence: očekávané RPE pro (%1RM, reps)
//    — buď z tvé RPE tabulky, nebo (lépe) z jeho vlastní historie regresí
// 2) reziduum jedné série:
//      resid = RPE_reportované − RPE_očekávané(pct, reps)
// 3) denní skóre = vážený průměr reziduí (váha = INOL série)
// 4) z-skóre proti rolling 28dennímu oknu:
//      readiness_z = (denníReziduum − mean28) / sd28
//    readiness_z > +1  => dnes to bylo těžší než obvykle (únava/nemoc)
//    readiness_z < −1  => dnes to šlo lépe než obvykle (superkompenzace)
```

Máš už `rpeCreep()` po týdnech — tohle je **per-session, z-skórovaná** verze,
která funguje jako denní semafor a jde ji kombinovat s Hooperem.

**Zdroj:** `[ENG]` konstrukce nad `[PR]` základem (Helms 2017: %1RM↔RPE r=0,88–0,91;
Zourdos 2016 SD reportovaných RPE).

**Priorita: HIGH** — nulová nová data, velká informační hodnota.

**Výhrady:** Přesnost RPE klesá s počtem opakování (SD 0,32 při 100 % 1RM vs. 1,18
při 60 %). **Váž rezidua obráceně k SD** — série s 1–3 opakováními při RPE ≥ 8
jsou spolehlivé, série s 10 opakováními při RPE 6 nesou skoro nulovou informaci.

## 8.5 Alternativní odhad E1RM závislý na váze (2026) — MEDIUM

**Czech:** Odhad 1RM závislý na velikosti zátěže

Marzagão, T. (2026), *A Weight-Dependent 1RM Prediction Equation Optimized on
303,494 Near-Failure Sets Across 388 Exercises*, arXiv:2603.17495 `[PR]` (preprint).

```
1RM = w × ( 1 + (r − 1)^0.85 / ( −2.55 + 4.58 · ln(w) ) )
```

- w = zvednutá váha, r = počet opakování do (téměř) selhání
- Data: 303 494 sérií, 14 966 uživatelů, 388 cviků, 16 svalových skupin
- Snížení nekonzistence o **17–22 %** proti čtyřem klasickým rovnicím
- Rozklad zlepšení: **91 %** z váhově závislého konverzního faktoru, **9 %**
  ze sublineárního exponentu opakování
- 5-fold cross-validace: téměř nulový overfitting

**Priorita: MEDIUM** — máš už 7 rovnic; tahle je zajímavá jako 8., protože je
jediná, která ví, že 20 kg × 10 a 200 kg × 10 nejsou totéž.

**Výhrady — DŮLEŽITÉ:**
- **Jednotky w nejsou v abstraktu uvedené a plný text jsem z PDF nedostal.**
  Rovnice obsahuje `ln(w)`, takže je **jednotkově závislá** — v kg a v lb dá
  různé výsledky. Před nasazením ověř v plném textu (arXiv:2603.17495).
  Kontrolní hodnoty: pro w = 100, r = 5 dává 117,5 (Epley 116,7); pro w = 40,
  r = 10 dává 58,0 (Epley 53,3).
- Jmenovatel `−2,55 + 4,58·ln(w)` je záporný pro w < 1,75 → **oříznout** vstup.
- Optimalizováno na kritérium **vnitřní konzistence**, ne proti změřenému 1RM
  (v datech žádná skutečná maxima nebyla). Není to validace proti pravdě.
- Preprint, není recenzovaný. Nasazuj jako volitelnou variantu, ne jako default.

---

# 9. Závodní logistika a shazování váhy

## 9.1 Rychlé shazování váhy (RWL / water cut)

**Czech:** Rychlé shazování hmotnosti

### Data

| Metrika | Hodnota | Zdroj |
|---|---|---|
| Podíl powerlifterů, kteří shazují | **97 %** | Campbell et al. 2025 `[PR]` |
| Typický shoz před závodem | **4,2 %** hmotnosti | tamtéž |
| Regionální vs. mezinárodní | 5,5 % vs. 3,3 % (p = 0,004) | tamtéž |
| Ženy vs. muži (nejvyšší shoz) | 6,7 % vs. 5,3 % (p = 0,028) | tamtéž |
| Nejčastější metody | omezení tekutin 86,5 %, water loading 67,2 %, cvičení 49,2 % | tamtéž |
| Relativně bezpečné pásmo | **3–5 %** hmotnosti | přehledy `[PR]`/`[COACH]` |
| Dopad na výkon při ~5 % + krátká regenerace | maximální síla **udržena** | RCT, PMC12392435 `[PR]` |
| Psychologický dopad | ~70 % odpovědí negativní (únava, úzkost, podrážděnost) | Campbell et al. `[PR]` |

### Implementovatelná matematika

```js
// jednoduchý plánovač shozu
function cutPlan({ currentBw, targetClass, weighInAt, now }) {
  const need   = currentBw - targetClass;
  const needPct= need / currentBw * 100;
  const hours  = (weighInAt - now) / 36e5;
  return {
    needKg: need, needPct,
    risk: needPct <= 2 ? 'nízké' : needPct <= 5 ? 'střední' : 'vysoké',
    // orientační rozpad: pasivní (dieta+střeva) vs. akutní voda
    passiveKg: Math.min(need, currentBw * 0.02),
    waterKg:   Math.max(0, need - currentBw * 0.02),
    warn: needPct > 5 ? 'Nad 5 % TH — mimo doporučené pásmo, riziko poklesu výkonu' : null,
    rehydrationHours: hours >= 2 ? 'IPF-style 2h vážení: prioritizuj sacharidy + Na⁺' : null
  };
}
```

**Priorita: MEDIUM–HIGH** — powerlifteři to dělají skoro všichni a přesto to
většina apek ignoruje. Kalkulačka + varovný práh 5 % je levná a užitečná.

**Výhrady:**
- **Nedělej z toho návod, jak shazovat.** Uveď procenta, riziko a odkaz na
  odborníka. Water loading protokoly na internetu jsou z velké části `[COACH]`
  bez dobré evidence a s reálným rizikem hyponatremie.
- Délka regenerace mezi vážením a startem je zásadní proměnná (IPF 2 h, některé
  federace 24 h) — bez ní čísla o „udržení výkonu" neplatí. **Ověř aktuální
  pravidlo v platném rulebooku** své federace; já jsem přesné znění časů vážení
  z rulebooku neověřil (`not found`).

## 9.2 Pravidla stojanů a náčiní (nízká priorita)

Ověřeno z IPF Technical Rules: výška stojanů na dřep **nastavitelná 75–110 cm**
(od podlahy k uložení osy); bezpečnostní stojany min. 50 cm, 10 otvorů po 2,5 cm.
Váhy elektronické, přesnost na 2 desetinná místa, do 180 kg.

**Priorita: LOW.** Pravidla se mění každou sezónu; udržovat je v appce je závazek.
Pokud ano, tak jen jako statický odkaz na aktuální rulebook, ne jako logika.

---

# 10. Co jsem NENAŠEL (explicitně)

Aby sis to nemusel hledat znovu — tyto věci se v dostupných zdrojích nepodařilo
dohledat, **nevymýšlej si je**:

| Co | Stav |
|---|---|
| Parametry FFM (k1, k2, τ1, τ2) fitované na silové sportovce | **not found** |
| Publikovaná tabulka MEV/MAV/MRV **per lift** (dřep/bench/tah) | **not found** |
| Polynomiální koeficienty rovnic %1RM↔rychlost (González-Badillo/Sánchez-Medina) z primárního zdroje | **neověřeno** — v dokumentu jen tabulkové hodnoty |
| Load–velocity tabulka pro **mrtvý tah** po %1RM | **not found** (a LV predikce 1RM tam prokazatelně nefunguje) |
| Přesná rychlost úbytku síly při detréninku (%/týden) | **not found** — meta-analýzy měří velikost svalu, ne 1RM po týdnech |
| Kompletní percentilové tabulky 10.–90. z JSAMS studie | za paywallem — mám jen 90. percentil pro 2 věkové skupiny |
| Meta-regresní rovnice síla ~ týdenní série s koeficienty | **not found** (mám jen slovní popis a hypertrofický koeficient 0,24 %/série) |
| Jednotky (kg vs lb) v rovnici Marzagão 2026 | **neověřeno** |
| Přesné časy vážení v aktuálním IPF rulebooku | **neověřeno** |

---

# 11. Shrnutí — pořadí podle poměru hodnota / pracnost

| # | Položka | § | Priorita | Pracnost | Evidence |
|---|---|---|---|---|---|
| 1 | Poměry S:B:D k totálu + detekce slabého článku | 5.1 | HIGH | nízká (tabulka + 30 ř.) | `[PR]`, 128 k záznamů |
| 2 | Typická chyba + SWC + pásmo spolehlivosti E1RM | 7.1–7.2 | HIGH | nízká | `[PR]`/`[ENG]` |
| 3 | Věkové koeficienty McCulloch/Foster | 5.3 | HIGH | velmi nízká | federační norma |
| 4 | Procento únavy (RTS) v sezení | 8.1 | HIGH | velmi nízká | `[COACH]` |
| 5 | CTL / ATL / TSB (Forma) | 1.2 | HIGH | nízká | `[COACH]`/`[PR]` |
| 6 | Meet-day timeline generátor | 4.2 | HIGH | střední | `[COACH]` |
| 7 | Taper s konkrétními čísly (−50 %, peak 8 dní, exp. vs step) | 4.1 | HIGH | nízká | `[PR-weak]`+`[PR]` |
| 8 | Reziduum RPE (denní připravenost, z-skóre) | 8.4 | HIGH | nízká | `[ENG]` nad `[PR]` |
| 9 | MRV signál + automatický trigger deloadu | 2.1 | HIGH | střední | `[COACH]` |
| 10 | Banisterův FFM s fitováním parametrů | 1.1 | HIGH | vysoká | `[PR]`, ale nevalidováno pro PL |

Těsně pod čarou: Theil–Sen/Mann–Kendall trend (7.3), šablona 5/3/1 (6.1),
kalkulačka shozu váhy (9.1), histogram distribuce intenzit vs. Sheiko (6.3),
percentily relativní síly (5.2).

---

# 12. Zdroje

## Peer-reviewed

- Banister EW et al. (1975). *A systems model of training for athletic performance.* Aust J Sports Med.
- Morton RH, Fitz-Clarke JR, Banister EW (1990). *Modeling human performance in running.* J Appl Physiol 69(3):1171–7.
- Busso T (2003). *Variable dose-response relationship between exercise training and performance.* Med Sci Sports Exerc.
- *Mathematical Modelling and Optimisation of Athletic Performance: Tapering and Periodisation.* arXiv:2505.20859 (2025). <https://arxiv.org/html/2505.20859v1>
- Vermeire K et al. (2021). *The Influence of Different Training Load Quantification Methods on the Fitness-Fatigue Model.* IJSPP 16(9):1261–9.
- Vermeire K et al. (2022). *The Fitness-Fatigue Model: What's in the Numbers?* IJSPP 17(5):810–3.
- Impellizzeri FM, Tenan MS et al. (2020). *Acute:Chronic Workload Ratio: Conceptual Issues and Fundamental Pitfalls.* IJSPP 15(6):907–13. <https://journals.humankinetics.com/view/journals/ijspp/15/6/article-p907.xml>
- Helms ER, Storey A, Cross MR, Brown SR, Lenetsky S, Ramsay H, Dillen C, Zourdos MC (2017). *RPE and Velocity Relationships for the Back Squat, Bench Press, and Deadlift in Powerlifters.* JSCR 31(2):292–7. <https://pubmed.ncbi.nlm.nih.gov/27243918/>
- Helms ER et al. (2018). *Self-Rated Accuracy of RPE-Based Load Prescription in Powerlifters.* JSCR. <https://pubmed.ncbi.nlm.nih.gov/28933716/>
- Zourdos MC et al. (2016). *Novel Resistance Training-Specific RPE Scale Measuring Repetitions in Reserve.* JSCR 30(1):267–75. <https://pubmed.ncbi.nlm.nih.gov/26049792/>
- *Bar Load-Velocity Profile of Full Squat and Bench Press Exercises in Young Recreational Athletes.* <https://pmc.ncbi.nlm.nih.gov/articles/PMC9180020/>
- *Technical Note on Using the Movement Velocity to Estimate the Relative Load in Resistance Exercises — Letter to the Editor.* <https://pmc.ncbi.nlm.nih.gov/articles/PMC6225955/>
- *Comparison of Different Minimal Velocity Thresholds to Establish Deadlift One Repetition Maximum.* <https://pmc.ncbi.nlm.nih.gov/articles/PMC5968962/>
- Jukic I et al. (2023). *The Acute and Chronic Effects of Implementing Velocity Loss Thresholds During Resistance Training.* Sports Med. <https://link.springer.com/article/10.1007/s40279-022-01754-4>
- Grgic J, Mikulic P (2017). *Tapering Practices of Croatian Open-Class Powerlifting Champions.* JSCR 31(9):2371–8.
- Grgic J, Mikulic P (2020). *Tapering and Peaking Maximal Strength for Powerlifting Performance: A Review.* Sports 8(9):125. <https://pmc.ncbi.nlm.nih.gov/articles/PMC7552788/>
- *Skeletal Muscle Adaptations and Performance Outcomes Following a Step and Exponential Taper in Strength Athletes.* Front Physiol 2021. <https://pmc.ncbi.nlm.nih.gov/articles/PMC8582352/>
- Hernández Ugalde JA (2023). *Powerlifting Balance Of SBD Disciplines Ratio To Total Score.* Int J Strength Cond 3(1). doi 10.47206/ijsc.v3i1.198 <https://journal.iusca.org/index.php/Journal/article/view/198>
- *Normative data for the squat, bench press and deadlift exercises in powerlifting: Data from 809,986 competition entries.* J Sci Med Sport (2024). <https://www.jsams.org/article/S1440-2440(24)00246-9/fulltext>
- Pelland JC, Schoenfeld BJ et al. (2025). *The Resistance Training Dose Response: Meta-Regressions Exploring the Effects of Weekly Volume and Frequency.* Sports Med. doi 10.1007/s40279-025-02344-w
- Campbell P, Martin D, Bargh MJ, Gee TI (2025). *A comparison of rapid weight loss practices within international, national and regional powerlifters.* Nutr Health. <https://pmc.ncbi.nlm.nih.gov/articles/PMC12174615/>
- *Making weight makes sense: relative performance gains after rapid weight loss in powerlifting: a randomized controlled trial.* <https://pmc.ncbi.nlm.nih.gov/articles/PMC12392435/>
- Hopkins WG (2004). *How to Interpret Changes in an Athletic Performance Test.* Sportscience 8:1–7.
- Marzagão T (2026). *A Weight-Dependent 1RM Prediction Equation Optimized on 303,494 Near-Failure Sets Across 388 Exercises.* arXiv:2603.17495 (preprint). <https://arxiv.org/abs/2603.17495>

## Trenérská praxe / normy federací

- Israetel M, Hoffmann J, Smith CW. *Scientific Principles of Strength Training* (Renaissance Periodization).
- RP Strength — Volume Landmarks / Progressing for Hypertrophy. <https://rpstrength.com/blogs/articles/training-volume-landmarks-muscle-growth>
- Tuchscherer M. *Reactive Training Systems Manual*; *Fatigue Percents Revisited* (2016). <https://store.reactivetrainingsystems.com/blogs/advanced-concepts/fatigue-percents-revisited>
- Wendler J. *5/3/1* (2009).
- Rippetoe M, Baker A. *Practical Programming for Strength Training.*
- Issurin V. *Block Periodization: A Breakthrough in Sports Training.*
- Sheiko B — programové rozbory: <https://www.powerliftingtowin.com/sheiko/>
- OpenPowerlifting — `crates/coefficients/src/mcculloch.rs` (MIT). <https://github.com/sstangl/openpowerlifting>
- USA Powerlifting — Foster/Age Coefficients. <https://www.usapowerlifting.com/wp-content/uploads/2021/01/USAPL-Age-Coefficients.pdf>
- WRPF — McCulloch Coefficients for Masters, edice 2022.
- TrainingPeaks — Fitness (CTL) / Performance Manager. <https://help.trainingpeaks.com/hc/en-us/articles/204071884-Fitness-CTL>
- Sportsmith — *An applied guide to velocity based training for maximal strength.* <https://www.sportsmith.co/articles/an-applied-guide-to-velocity-based-training-for-maximal-strength/>
- EliteFTS — *Meet Management 101: Warm Up Timing.* <https://elitefts.com/blogs/powerlifting/meet-management-101-warm-up-timing>
- IPF Technical Rules Book 2025/2026. <https://www.powerlifting.sport/rules/codes/info/technical-rules>
