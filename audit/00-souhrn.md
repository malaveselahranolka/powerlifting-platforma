# Audit aplikace Platforma

Rozsah: `js/` (15 419 řádků), `css/app.css`, `index.html`, `serve.mjs`, `verify.mjs`, `README.md`.

Jak se ověřovalo: statická analýza zdroje, spuštění `verify.mjs`, výpočet kontrastů
z hodnot tokenů a proklikání všech patnácti obrazovek v prohlížeči (Chromium,
desktop i 375 px) — jak s ukázkovými daty, tak se svěřencem bez bloku, bez historie
a s nulovými maximy. Každé tvrzení níže je buď ověřené v běžící aplikaci, nebo
doložené konkrétním řádkem.

---

## Kritické

**1. Psaní do číselných polí ztrácí fokus po každém znaku.**
`js/views/e1rm.js:49,50,130,133`, `js/views/plates.js:63`, `js/views/score.js:76,80,85`,
`js/views/apre.js:52,77`, `js/views/meet.js:48,214`, `js/views/rpe.js:33`,
`js/views/program.js:634`.

Handler `oninput` volá `render()`, ten dělá `clear(root)` a postaví pohled znovu.
Původní `<input>` zanikne uprostřed psaní. Ověřeno v prohlížeči na třech místech
(E1RM → *Váha*, Kotouče → *Cílová váha*, Skóre → *Tělesná váha*): po jednom znaku
je `input.isConnected === false` a `document.activeElement` je `<body>`. Prakticky to
znamená, že napsat „82,5“ jde jen tak, že se do pole po každé číslici znovu klikne.
Týká se to většiny kalkulaček — tedy toho, co se v appce používá nejčastěji.

Oprava: `oninput` → `onchange`, nebo překreslovat jen dotčené buňky, jak to už dělá
`js/views/reality.js:406` (`commit()` + `refresh()` místo `render()`).

**2. Poškozený nebo starší stav se tiše přepíše ukázkovými daty.**
`js/store.js:158-166`

`load()` vrátí `seed()`, když `data.version !== 1` nebo `athletes` není pole. Seed se
hned neuloží (klíč existuje), ale první `commit()` — tedy první kliknutí kdekoli v UI —
přepíše trenérova data ukázkovým Tomášem Novákem. Bez varování a bez cesty zpět.
Stejná past čeká na jakoukoli budoucí migraci na `version: 2`.

Oprava: před vrácením `seed()` odložit původní řetězec do `pwr.v1.bak` a říct to
uživateli; pro neznámou vyšší verzi appku raději zastavit než přepsat.

**3. Plné úložiště se spolkne mlčky.**
`js/store.js:180-186`

`persist()` má prázdný `catch`. Při `QuotaExceededError` appka dál funguje z paměti,
takže trenér nic nepozná — a po zavření karty přijde o všechno, co od té chvíle zapsal.

Oprava: v `catch` vyhodit `toast(..., 'bad')` a stav označit jako neuložený.

**4. Cloudová synchronizace přepisuje bez podmínky.**
`js/cloud.js:97-118` (`pushNow`), `js/cloud.js:150-170` (`bootstrap`)

`pushNow` dělá upsert celého stavu bez ohledu na to, co je v cloudu. `bootstrap`
porovnává vzdálený `updated_at` proti lokálně uloženému `cloudUpdatedAt`, což je
jen kopie posledního vlastního zápisu — ne skutečná verze řádku. Dvě zařízení
upravená offline: to, které se připojí druhé, přepíše práci prvního. Merge není žádný.

Oprava: posílat očekávaný `updated_at` a nechat zápis projít jen tehdy, když se
vzdálený nezměnil (`If-Match` / podmíněný `PATCH`); jinak konflikt a nabídnout stažení.

**5. Doporučená RLS politika nechrání nic.**
`js/views/athletes.js:167-173`

`SQL_SNIPPET` říká uživateli, ať spustí
`create policy "anon rw" on sync for all to anon using (true) with check (true);`
Kdokoli, kdo zná URL projektu a anon klíč, si může přečíst i přepsat **všechny**
řádky tabulky — `syncId` není v politice nijak vynucený, je to jen filtr v dotazu
klienta. V řádcích leží tělesná váha, Hooperovy indexy a poznámky o zdravotních
omezeních svěřenců.

Oprava: politika musí porovnávat `id` proti hodnotě, kterou klient dokládá
(např. přes hlavičku / RPC s tajemstvím), ne `using (true)`. Do té doby je namístě
to v UI napsat nahlas.

---

## Vážné

**6. Import CSV nevaliduje vůbec nic.** `js/views/block.js:448-476`
`sets: Number(sets)` u nečíselného vstupu uloží `NaN` do stavu a ten se pak protáhne
tonáží, INOL i grafy. `date` se bere jak přišel — „12/03/2025“ se uloží a rozbije
řazení i rozdělení do týdnů, protože se všude porovnává `localeCompare`. Dvojí import
téhož souboru zdvojí celý blok a undo neexistuje.

**7. Export CSV neescapuje oddělovač.** `js/views/block.js:437-443`
Název doplňku se středníkem (`Tlak s jednoručkami; sedě`) rozhodí sloupce a při
zpětném importu posune data o jedno pole. Navíc název začínající `=` nebo `+`
se v Excelu vyhodnotí jako vzorec.

**8. Obnova ze zálohy přijme i soubor, po kterém appka nenaběhne.**
`js/views/athletes.js:455-470`
Kontroluje se jen `Array.isArray(data.athletes)`. Soubor bez `entries` projde, uloží se
a po `location.reload()` skončí bílou obrazovkou, ze které se laik nedostane.
Klíč `'pwr.v1'` je navíc napsaný natvrdo místo `S.STORAGE_KEY`.

**9. Každý úhoz serializuje celý stav.** `js/store.js:180`, `js/views/program.js` (`saveDraft`), `js/views/reality.js:406`
`persist()` dělá `JSON.stringify(state)` a zápis do `localStorage` při každém `commit()` —
a `commit()` běží na každý znak v plánovači i v zápisu skutečnosti. K tomu se pokaždé
plánuje cloudový push. U trenéra s deseti svěřenci a dvěma sezónami je to megabajtová
serializace na stisk klávesy.

**10. Makrocyklus počítá celou historii při každém překreslení.** `js/views/macro.js:22`
`summarizeBlock()` volá `S.blockEntries(b.id)` (filtr přes všechny položky) a `analyzeBlock()`
pro každý blok. Totéž v menším `js/views/compare.js:263` a `js/views/calendar.js:410`.
Nic se nekešuje, přestože jsou to čisté funkce a klíčem je `blockId`.

**11. Okraje formulářových polí nesplňují kontrast.**
Naměřeno z tokenů v `css/app.css`:

| Dvojice | Tmavý | Světlý | Požadavek |
|---|---|---|---|
| `--line` / `--surface` (okraj `.input`) | **1,27** | **1,35** | 3:1 (WCAG 1.4.11) |
| `--axis` / `--surface` (okraj při hoveru) | **1,53** | **1,59** | 3:1 |
| `--grid` / `--surface` (mřížka grafů) | 1,16 | 1,21 | 3:1 jen pokud nese význam |

Pole tedy opticky splývají s kartou. Textové tokeny naopak procházejí všechny
(nejhorší `--ink-3` / `--bg` = 4,80 ve světlém), bílý text na akcentu 4,76 / 6,03.

**12. Jednotku lze přesunout jen tažením myší.** `js/views/calendar.js:122-141`
Buňky jsou fokusovatelné a Enter/mezerník den vybere, ale přesun je čistě
drag & drop. Klávesnice ani dotyk nemají náhradu (WCAG 2.1.1). „Zkopírovat na datum“
existuje, „přesunout na datum“ ne.

---

## Drobné

**13.** `role="tab"` bez `tabpanel`, bez `aria-controls` a bez ovládání šipkami —
`js/app.js` (`pageHead`, `drawTool`). Odečítač oznámí záložku, ale nemá k čemu ji vztáhnout.

**14.** `js/charts.js:78` — popisek nakládané osy říká „Naloženo … kg“ i v librovém režimu.

**15.** Mrtvý kód. Nikde se nevolá: `gradeAcwr`, `planVsActual`, `gradeMonotony`,
`totalSplit`, `LB_PER_KG`, `liftedReps`, `entryInol` (`js/calc.js`), `onStatus` (`js/cloud.js`),
`updateEntry`, `moveEntry`, `athleteEntries`, `subscribe`, `unitLabel` (`js/store.js`),
`bind` (`js/views/_util.js`). Větev `html:` v `js/ui.js:25` nastavuje `innerHTML` a nemá
jediného volajícího — dá se rovnou smazat.

**16.** Pohledy obcházejí API storu a mutují `s.entries` napřímo:
`js/views/block.js:374` (místo `updateEntry`), `:394` (místo `deleteEntry`),
`:413` (místo `addEntry` — a chybí tam `actualWeight: null`, `actualReps: null`),
`js/views/reality.js:406`, `js/views/athletes.js:130`. Buď API používat, nebo ho zrušit.

**17.** Zastaralá tvrzení: `README.md:31` slibuje „355 kontrol“, `verify.mjs` jich má 402.
Komentář v `js/app.js:27` mluví o „pěti sekcích“, jsou tam šest.

**18.** `js/cloud.js:79` hlásí „spusť v Supabase přiložený SQL“, ale README o SQL ani
o nastavení tabulky nemluví — snippet je jen v UI. Kdo čte README, neví, co spustit.

**19.** `serve.mjs` servíruje celý pracovní adresář včetně `.git` a `.claude`, poslouchá
na všech rozhraních (`listen(3000)`) a na neexistující soubor vrací `index.html` se
stavem 200 místo 404. Na vývoj to stačí, na wifi v posilovně ne.

**20.** `js/views/reality.js:425` ořezává RPE do 5–10 při každém znaku: kdo píše „10“,
uloží si na okamžik RPE 5. Konečná hodnota je správná, mezistav se ale zapíše.

---

## Co je v pořádku

Nešlo o formalitu — tohle se ověřovalo stejně jako zbytek:

- `node verify.mjs` — **402 / 402** kontrol prochází.
- Patnáct obrazovek proklikáno bez jediné chyby v konzoli, a to i pro svěřence
  bez bloku, bez historie a s nulovými maximy. Žádné `NaN` v textu.
- **Žádné vodorovné přetečení** na 375 px ani na jedné obrazovce.
- Textový kontrast prochází 4,5:1 v obou motivech.
- Žádný `eval`, žádný `innerHTML` s uživatelským vstupem, fonty hostované lokálně.
- `prefers-reduced-motion` i `@media print` jsou skutečně ošetřené.
- `trendWithBand` (`js/calc.js:1319`) je korektní interval spolehlivosti sklonu —
  OLS, `n−2` stupňů volnosti, `t95`, predikční pás včetně členu `1 + 1/n`.
- Modulové `st` proti přepnutí svěřence hlídají `graphs.js:74`, `compare.js:276`
  i `program.js:38` — únik stavu mezi svěřenci se nepotvrdil.

---

## Pořadí oprav

1. **Fokus v číselných polích** (bod 1) — největší dopad na denní používání, oprava
   je mechanická záměna `oninput` → `onchange`.
2. **Záloha před `seed()` a hlášení plného úložiště** (body 2 a 3) — obojí do dvaceti řádků.
3. **Cloud: podmíněný zápis a poctivá RLS** (body 4 a 5) — dokud to neplatí,
   je namístě u přepínače napsat, co synchronizace opravdu znamená.
4. **Validace importu a escapování exportu CSV** (body 6 a 7).
5. **Kontrast okrajů polí a klávesová alternativa přesunu jednotky** (body 11 a 12).

---

## Poznámka k dílčím zprávám

`audit/02-pohledy.md` a `audit/03-data-a-cloud.md` jsou výstupy delegovaných
workerů (Antigravity, lokální session). Jsou ponechané tak, jak vznikly, ale
pozor na dvě věci, které se při ověřování neukázaly jako přesné:

- `03` uvádí sporný SQL na `README.md:173`; ve skutečnosti je v `js/views/athletes.js:173`.
  Samotný nález platí.
- `02` označuje modulové `st` za problém ve všech sedmnácti pohledech; u `graphs`,
  `compare` a `program` je proti přepnutí svěřence ošetřené (viz výše).

Zbylé tři workery (výpočty, přístupnost, výkon) se zasekly na přerušeném streamu
a nic neodevzdaly — jejich domény jsou v tomhle souhrnu pokryté ručně.
