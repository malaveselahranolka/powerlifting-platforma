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

Projde 215 kontrol. Referenční hodnoty se počítají nezávisle přímo ze zveřejněných
koeficientů, ne z aplikace — kdyby se ve `js/calc.js` něco rozbilo, test to chytí.
Ověřuje se RPE tabulka, všech osm variant IPF GL, DOTS, Wilks, sedm vzorců pro
odhad 1RM, INOL, Prilepinovy zóny, ACWR i EWMA, monotonie a strain, APRE, těžké
expozice, výsledky ze zápasu, doporučená úprava příštího týdne, Hooperův index,
detekce plateau na E1RM, nakládání osy v kilech i librách, váhové kategorie,
dvousložkový model kondice a únavy (proti analyticky spočítané sumě exponenciál),
typická chyba a nejmenší prokazatelná změna, podíly cviků na součtu, věkové
koeficienty, denní připravenost, signál stropu regenerace, tabulka rychlostí,
odhad maxima z profilu zatížení a rychlosti i prahy poklesu.

## Co to umí

| Obrazovka | K čemu |
|---|---|
| **Přehled** | Součet trojboje, DOTS / IPF GL, tonáž po týdnech, skutečné RPE proti plánu, Hooperův index pohody, detekce plateau na E1RM, plán na tento týden |
| **E1RM** | Odhad maxima z výkonu (RPE/RTS + 7 vzorců) a zpětně váha na ose pro cílové opakování × RPE |
| **RPE tabulka** | Celá Tuchschererova tabulka přepočtená na kilogramy, klikací |
| **Kotouče** | Co reálně naložíš s kotouči, které máš. Sklad po párech, okolní dosažitelné váhy |
| **APRE** | Autoregulace podle skutečných opakování na testovací sérii — jiný princip než RPE |
| **Rychlost** | Profil zatížení a rychlosti, odhad maxima z profilu, práh poklesu v sérii a bezpřístrojová obdoba z deníku |
| **Plán vs. realita** | Plánovaná a skutečná váha, opakování i RPE vedle sebe, posun RPE po týdnech, odhad maxima ze skutečných sérií, doporučení podle skutečného výkonu |
| **Únava a forma** | Model kondice a únavy, denní připravenost z odchylky RPE, signál stropu regenerace, kdy je zlepšení prokazatelné, rozložení součtu proti elitě |
| **Analýza bloku** | Tonáž, zvedy, intenzita, INOL, Prilepin, tvrdé série, těžké expozice (85/90/95 %), charakter týdne (objem × špička), plán vs. realita, mapa bloku, CSV |
| **Stavba bloku** | Matice týden × cvik — série, opakování, RPE a intenzita zvlášť pro každý řádek |
| **Makrocyklus** | Bloky v čase (fáze, objem, taper), odlehčení napříč sezónou, zápasy — součet, skóre, úspěšnost pokusů |
| **Závodní den** | Tři pokusy podle strategie, kontrola skoků, rozcvičovací žebřík s časováním, projekce součtu |
| **Skóre** | IPF GL, DOTS, Wilks, věkový koeficient pro masters a dorost, vliv tělesné váhy na koeficient |
| **Svěřenci** | Zakládání závodníků, profily, historie maxim, vývoj tělesné váhy, zálohy |
| **Vysvětlivky** | 39 pojmů s vzorcem, pásmy, zdrojem a větou o tom, co s tím jako trenér dělat |

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
| Kondice a únava | kondice(t) = kondice(t−1)·e^(−1/τ1) + zátěž, τ1 = 42 dnů; únava totéž s τ2 = 7 dnů; forma = k1·kondice − k2·únava | Banister a kol. (1975), Calvert a kol. (1976) — konstanty z vytrvalostních sportů, viz níž |
| Typická chyba a SDC | TE = rozptyl kolem přímky trendu; SDC = 1,96 · √2 · TE | Hopkins (2000, 2004), Weir (2005) |
| Denní připravenost | odchylka RPE od očekávaného, vážená INOL, z-skóre proti 28 dnům | konstrukce nad Helms a kol. (2017) a Zourdos a kol. (2016) |
| Strop regenerace | dvě ze tří známek: výkon vs. objem, posun RPE ≥ 0,5, Hooper o 15 % horší | kombinace appky nad Israetel a kol. (2015); dávka a odezva Pelland, Schoenfeld a kol. (2025) |
| Rozložení součtu | podíl cviku na součtu proti pásmu elity podle kategorie, pohlaví a výstroje | Hernández Ugalde (2023), Int J Strength Cond 3(1) — 128 tisíc startů IPF 2012–2022 |
| Věkový koeficient | body × koeficient(věk) | Foster 14–22, Glossbrennerem opravený McCulloch 41–80, USAPL 81–90 (varianta OpenPowerlifting) |
| Odhad 1RM z rychlosti | 1RM = sklon · MVT + průsečík (regrese váhy na rychlosti) | MVT bench PMC5968962 a Sportsmith; tabulka rychlostí PMC9180020; rychlost při 1RM Helms a kol. (2017) |
| Práh poklesu rychlosti | (nejrychlejší − poslední) ÷ nejrychlejší; pásma 10 / 25 / 40 % | Jukic a kol. (2023), Sports Medicine, doi 10.1007/s40279-022-01754-4 |
| Pokusy | 91 % / 96,5 % / 102 % z E1RM | rozbor MS IPF 2012–2019 |
| Úspěšnost pokusů | povedené ÷ platné pokusy × 100 | rozbor MS IPF 2016 (Stronger by Science) |
| DOTS | součet × 500 ÷ polynom 4. stupně | ověřeno proti OpenPowerlifting |
| IPF GL | součet × 100 ÷ (A − B·e^(−C·bw)) | IPF, koeficienty od 1. 5. 2020 |
| Wilks | součet × 500 ÷ polynom 5. stupně | Wilks (1994) |

Doplňkové cviky nemají 1RM, takže se počítají jen do tonáže — do intenzity,
INOL, Prilepinových zón ani tvrdých sérií nevstupují.

## Kde appka záměrně nedělá, že ví víc, než ví

Tři metody stojí na číslech, která nejsou z powerliftingu nebo nejsou změřená
vůbec. Appka je počítá, protože jsou užitečné — ale říká to nahlas, přímo na
obrazovce, ne jen tady.

**Model kondice a únavy.** Časové konstanty 42 a 7 dnů a poměr vah 2 : 1
pocházejí z vytrvalostních sportů; individuálně nafitované hodnoty pro silový
trénink publikované nejsou. Appka proto počítá v bezrozměrných jednotkách, čte
je jen proti vlastní historii závodníka a nikdy nepředpovídá kilogramy. Užitečný
je tvar křivky, ne číslo.

**Objemové mezníky MEV / MAV / MRV.** Konkrétní počty sérií nejsou nikde
empiricky změřené — jsou to trenérské odhady. Appka proto žádnou hranici
v sériích netvrdí a místo toho hlídá důsledky: jestli se přestal zvedat výkon,
jestli stejný plán jede na vyšší RPE a jestli spadla pohoda. Dvě známky ze tří
naráz jsou signál, jedna je šum.

**Rychlost tyče.** Tabulka rychlostí je naměřená na Smithově stroji a na mladých
rekreačně trénovaných lidech, ne na trojbojařích s volnou osou — mezi jedinci
kolísá o 11 až 25 %, takže je to orientace v řádu, ne cíl na desetinu.
U mrtvého tahu appka odhad maxima z profilu vůbec neukáže: publikovaná data
ukazují podhodnocení o 9 až 15 % a autoři metodu pro tenhle cvik odmítají.
Polynomiální rovnice pro převod rychlosti na procenta se nepočítají, protože
se jejich koeficienty nepodařilo ověřit z původního zdroje — vymýšlet si je
by bylo horší než je neuvádět.

**Rozložení součtu.** Studie ukazuje souvislost, ne příčinu. Závodníci uvnitř
pásma mají v průměru vyšší IPF GL, ale z toho neplyne, že se součet zvedne tím,
že se poměr narovná. Délka končetin a stavba těla posunou podíl legitimně
a natrvalo, takže se to čte jako otázka, ne jako předpis.

Ke stejnému účelu slouží i spodní mez typické chyby: dokonale lineární řada
zápisů by dala nulový rozptyl a appka by pak prohlásila za prokazatelné
i zlepšení o sto gramů. Hranice 3 % z průměru leží pod spodním okrajem
publikovaného rozpětí opakovatelnosti odhadu 1RM — appka radši podstřelí, než
aby prohlásila šum za zlepšení.

Podrobná rešerše, ze které tyhle metody vzešly, včetně toho, co se do appky
záměrně nedostalo, je v [RESEARCH.md](RESEARCH.md).

## Vzhled

Povrchy jsou neutrální a ploché; jediná sytá barva na obrazovce patří datům
nebo jedné akci. Barva v grafu nese úlohu:

- **soutěžní cviky jsou kategorie** — tři odstíny ověřené na odlišitelnost
  i při barvosleposti (nejhorší pár ΔE 9,2 ve světlém motivu, 9,4 v tmavém);
  doplňky nejsou čtvrtá rovnocenná kategorie, ale „zbytek", takže jdou do
  neutrální šedé,
- **intenzitní zóny jsou pořadí** — jeden odstín ve čtyřech krocích, světlý
  → tmavý. Duha na uspořádaná data nutí čtenáře luštit legendu,
- **kotoučové barvy zůstaly tam, kde znamenají kotouč** — na vykreslené ose
  a ve skladu. Přebarvit je by znamenalo, že obrázek přestane odpovídat
  železu v regálu.

Světlý i tmavý motiv jsou navržené zvlášť, ne převrácené. Přepínač v horní
liště přebíjí nastavení systému. Písmo je systémové — appka běží offline
z `localStorage` a stahovat kvůli ní font z CDN by znamenalo, že v posilovně
bez signálu vypadá rozbitě.

`Ctrl/Cmd + K` otevře paletu příkazů (obrazovky, svěřenci, nastavení). Každá
obrazovka jde vytisknout — plán se dá vzít do posilovny na papíře.

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
