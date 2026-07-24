# Platforma

Trenérský nástroj pro powerlifting. Nahrazuje excelovou tabulku s ručně psanými vzorci.

## Spuštění

```bash
node serve.mjs
```

Otevři `http://localhost:3000`. Žádná instalace, žádný build — čisté HTML, CSS a ES moduly.

Data leží v `localStorage` prohlížeče. Zálohu do souboru stáhneš v sekci
**Svěřenci → Nastavení a data → Zálohovat vše (JSON)**.

## Cloudová synchronizace (volitelná)

Ve výchozím stavu jsou data jen v jednom prohlížeči. Kdo je chce mít na všech
zařízeních, zapne v **Svěřenci → Cloudová synchronizace** ukládání do vlastního
Supabase projektu (zdarma). Aplikace pak po každé změně automaticky nahraje
stav a při otevření na jiném zařízení (se stejným sync kódem) stáhne poslední
verzi. Klient je čistý `fetch` proti Supabase REST — žádná závislost, funguje
i na statickém hostingu jako GitHub Pages. Kód a nastavení jsou v [js/cloud.js](js/cloud.js).

## Ověření výpočtů

```bash
node verify.mjs
```

Projde 118 kontrol. Referenční hodnoty se počítají nezávisle přímo ze zveřejněných
koeficientů, ne z aplikace — kdyby se ve `js/calc.js` něco rozbilo, test to chytí.
Ověřuje se RPE tabulka, všech osm variant IPF GL, DOTS, Wilks, sedm vzorců pro
odhad 1RM, INOL, Prilepinovy zóny, ACWR i EWMA, monotonie a strain, APRE, těžké
expozice, výsledky ze zápasu, doporučená úprava příštího týdne, Hooperův index,
detekce plateau na E1RM, nakládání osy v kilech i librách a váhové kategorie.

## Co to umí

| Obrazovka | K čemu |
|---|---|
| **Přehled** | Součet trojboje, DOTS / IPF GL, tonáž po týdnech, skutečné RPE proti plánu, Hooperův index pohody, detekce plateau na E1RM, plán na tento týden |
| **E1RM** | Odhad maxima z výkonu (RPE/RTS + 7 vzorců) a zpětně váha na ose pro cílové opakování × RPE |
| **RPE tabulka** | Celá Tuchschererova tabulka přepočtená na kilogramy, klikací |
| **Kotouče** | Co reálně naložíš s kotouči, které máš. Sklad po párech, okolní dosažitelné váhy |
| **APRE** | Autoregulace podle skutečných opakování na testovací sérii — jiný princip než RPE |
| **Plán vs. realita** | Posun RPE po týdnech, odhad maxima ze skutečných sérií, doporučená úprava příštího týdne s tlačítkem na přeškálování |
| **Analýza bloku** | Tonáž, zvedy, intenzita, INOL, Prilepin, tvrdé série, těžké expozice (85/90/95 %), charakter týdne (objem × špička), plán vs. realita, mapa bloku, CSV |
| **Stavba bloku** | Matice týden × cvik — série, opakování, RPE a intenzita zvlášť pro každý řádek |
| **Makrocyklus** | Bloky v čase (fáze, objem, taper), odlehčení napříč sezónou, zápasy — součet, skóre, úspěšnost pokusů |
| **Závodní den** | Tři pokusy podle strategie, kontrola skoků, rozcvičovací žebřík s časováním, projekce součtu |
| **Skóre** | IPF GL, DOTS, Wilks a vliv tělesné váhy na koeficient |
| **Svěřenci** | Zakládání závodníků, profily, historie maxim, vývoj tělesné váhy, zálohy |
| **Vysvětlivky** | 33 pojmů s vzorcem, pásmy, zdrojem a větou o tom, co s tím jako trenér dělat |

## Použité vzorce a odkud pocházejí

| Veličina | Vzorec | Zdroj |
|---|---|---|
| RPE → % 1RM | tabulka, půl bodu RPE = půl opakování | Tuchscherer, Reactive Training Systems |
| E1RM | 7 vzorců + RPE varianta | Epley, Brzycki, Lombardi, O'Conner, Wathan, Mayhew, Landers |
| Tonáž | série × opakování × váha | standardní ukazatel |
| INOL | opakování ÷ (100 − intenzita) | Hristov |
| Prilepin | pásma < 70 / 70–79 / 80–89 / ≥ 90 % | A. S. Prilepin |
| Tvrdá série | RPE ≥ 7, nebo intenzita ≥ 70 % | odvozeno z mezníků MEV/MAV/MRV |
| Těžké expozice | dny s alespoň jednou sérií ≥ 85/90/95 % | princip blokové periodizace, appka počítá přímo z dat |
| ACWR | 7 dní ÷ průměrný týden z 28 dní | Gabbett (2016), kritika Impellizzeri (2020) |
| ACWR EWMA | zátěž × λ + předchozí × (1 − λ), λ = 2/(N+1) | Williams a kol. (2017) |
| sRPE | sRPE × počet sérií | Foster (2001), úprava McGuigan |
| Monotonie | průměr denní zátěže ÷ směrodatná odchylka | Foster (1998) |
| Strain | týdenní zátěž × monotonie | Foster (1998) |
| Hooperův index | spánek + stres + únava + bolestivost (1–7 každá) | Hooper a Mackinnon (1995) |
| Taper | −41 až −50 % objemu, 7–10 dní, držet intenzitu | Grgic a Mikulic (2020) |
| APRE | ramp k AMRAP sérii, úprava −10 až +10 % podle opakování | Mann a kol. (2010) |
| Doporučená úprava | poměr skutečného a plánovaného E1RM z odvedených sérií | odvozeno z RPE tabulky, appka bez vlastních koeficientů |
| Detekce plateau | posun přímky trendu vs. rozptyl bodů kolem ní | obecný statistický princip, appka bez publikovaného vzorce |
| Pokusy | 91 % / 96,5 % / 102 % z E1RM | rozbor MS IPF 2012–2019 |
| Úspěšnost pokusů | povedené ÷ platné pokusy × 100 | rozbor MS IPF 2016 (Stronger by Science) |
| DOTS | součet × 500 ÷ polynom 4. stupně | ověřeno proti OpenPowerlifting |
| IPF GL | součet × 100 ÷ (A − B·e^(−C·bw)) | IPF, koeficienty od 1. 5. 2020 |
| Wilks | součet × 500 ÷ polynom 5. stupně | Wilks (1994) |

Doplňkové cviky nemají 1RM, takže se počítají jen do tonáže — do intenzity,
INOL, Prilepinových zón ani tvrdých sérií nevstupují.

## Struktura

```
index.html
css/app.css            paleta, typografie, komponenty
js/data.js             tabulky a koeficienty
js/glossary.js         obsah vysvětlivek
js/calc.js             matematika (čisté funkce, bez DOM)
js/store.js            stav + localStorage + jednotky
js/ui.js               DOM pomocníci, formátování, ikony
js/charts.js           SVG grafy a nakládaná osa
js/views/*.js          jednotlivé obrazovky
js/app.js              skelet a routování
verify.mjs             ověření vzorců proti oficiálním zdrojům
```

## Stavba bloku

Nejdřív vybereš **tréninkové dny v týdnu** (Po–Ne). Podle jejich počtu se plán
automaticky vyplní soutěžními cviky tak, aby každý jel zhruba dvakrát týdně
(rozvržení v `WEEK_SPLITS`). Přidání nebo ubrání dne plán rovnou přerozvrhne.

Dál je plánovač matice **týden × cvik**. Pro každý řádek se zvlášť zadává:

| Pole | Chování |
|---|---|
| Série, opakování | přímo |
| RPE | dopočítá intenzitu i váhu |
| Intenzita v % | dopočítá RPE i váhu |
| Váha | dopočítá intenzitu i RPE |

**Vede vždy to pole, do kterého se zrovna píše** — zbylá dvě se dopočítají.
Když napíšeš 172,5 kg, aplikace z maxima odvodí procento a k němu najde RPE.
Když napíšeš RPE 8, spočítá procento a z něj váhu zaokrouhlenou na 2,5 kg.

Pokud předpis vyjde nad RPE 10 pro daný počet opakování (těžší, než co by
závodník na tolik opakování vůbec zvedl), pole RPE zežloutne a ukáže `mimo`.

Doplňkové cviky nemají změřené 1RM, takže se u nich intenzita neukazuje —
procento z neznámého maxima by bylo jen číslo bez významu. Váha se zadá ručně.

### Rozpracovaný plán se ukládá průběžně

Než blok založíš, plán žije jako **rozpracovaný návrh — jeden na svěřence**.
Ukládá se do stejného úložiště jako všechno ostatní, takže:

- přežije zavření prohlížeče i restart počítače,
- při přepnutí na jiného svěřence se objeví jeho vlastní rozpracovaný plán
  (nebo čistá šablona, pokud ještě žádný nemá),
- po kliknutí na **Založit blok** se návrh smaže — stal se skutečným blokem
  a dál se edituje v Analýze bloku.

### Kopírování

- **Duplikovat týden** — vloží kopii hned za původní, následující týdny se posunou.
- **Zkopírovat z týdne N** — přepíše aktuální týden obsahem předchozího.
- **Duplikovat blok** (v Analýze bloku) — kopie na jiný termín, volitelně pro
  jiného svěřence. Při přenosu se **váhy přepočítají přes relativní intenzitu**:
  z původního maxima se odvodí procento a to se použije na maxima nového závodníka.
  Dřep 170 kg u někoho s maximem 215 se tak stane 102,5 kg u někoho s maximem 130 —
  v obou případech 79 %.

## Makrocyklus

Analýza bloku i Stavba bloku pracují vždy s jedním mezocyklem. Makrocyklus je
pohled napříč **všemi bloky jednoho svěřence v čase** — samostatná úroveň
periodizace nad blokem (Issurin: mikrocyklus = týden, mezocyklus = blok,
makrocyklus = sezóna složená z víc bloků).

Obrazovka ukazuje:

- **Bloky v čase** — fáze podle šablony (Akumulace / Transmutace / Realizace),
  průměrná tonáž a špička, počet odlehčovacích týdnů a jak dopadl taper —
  jedna řádka na blok, chronologicky.
- **Objem a intenzita mezi bloky** — dva grafy, které řeknou, jestli sezóna
  skutečně vlní (roste intenzita a klesá objem směrem k realizaci), nebo je
  plochá a nediferencovaná.
- **Odlehčení v čase** — kolik odlehčovacích týdnů proběhlo a jak pravidelně,
  napříč celou historií svěřence, ne jen v rámci jednoho bloku. Appka tu
  nehodnotí, jestli je mezera dobrá nebo špatná — publikovaný standard na to
  neexistuje, jde jen o to mít to před sebou.
- **Zápasy** — datum, tělesná váha, devět pokusů (povedl/nepovedl), z nich
  spočítaný součet, DOTS, IPF GL a úspěšnost pokusů. Rozbor mistrovství světa
  IPF ukázal, že vítězové dávají v průměru 8,46 z 9 pokusů, průměrný závodník
  6,66 z 9 — je to metrika, kterou dává smysl sledovat napříč víc zápasy, ne
  jen naplánovat pro jeden (na to slouží Závodní den).

## Import z Excelu

V **Analýze bloku → Import CSV**. Očekávaný oddělovač je středník, první řádek je hlavička:

```
datum;cvik;nazev;serie;opakovani;vaha_kg;rpe
2026-07-20;squat;;4;5;175;8
2026-07-20;accessory;Předkopávání;3;12;40;8
```

Hodnoty `cvik`: `squat`, `bench`, `deadlift`, `accessory`. Váha vždy v kilogramech.
