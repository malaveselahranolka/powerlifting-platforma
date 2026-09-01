## Kritické

- `js/store.js:165` a `js/store.js:188`: Pokud má uložený JSON neznámou verzi (nebo není pole `athletes`), funkce `load()` tiše vrátí ukázková data `seed()`. Hned při další akci vyvolávající `commit()` (např. kliknutí v UI) se tato ukázková data trvale uloží přes `persist()` a bez varování nenávratně přepíšou skutečná trenérova data.
  **Oprava:** Před vrácením `seed()` bezpečně zálohovat poškozená data do jiného klíče (např. `pwr.v1.bak`), nebo raději zobrazit chybovou hlášku a blokovat aplikaci místo tichého přepisování.

- `js/cloud.js:97`: Funkce `pushNow()` odesílá na Supabase celý stav k přepsání beze snahy o slučování (merge) nebo kontroly verze. Pokud dvě zařízení upravují data offline a poté se připojí, to druhé zcela přemaže změny toho prvního (stale overwrite), protože chybí podmínka na `updated_at`.
  **Oprava:** Zabezpečit `pushNow` odesláním aktuálního `cloudUpdatedAt` – na serveru povolit upsert jen tehdy, pokud se vzdálený čas nezměnil, jinak vyvolat konflikt a vynutit stažení dat (pull).

- `js/store.js:180`: Při zápisu nad zhruba 5 MB (cca 2-3 roky tréninků pro 10 svěřenců, ~25 000 položek) dojde v `localStorage.setItem` k chybě `QuotaExceededError`, kterou ale blok `catch` tiše spolkne. Trenér dál pracuje, protože aplikace funguje z paměti, ale po zavření nebo obnovení stránky o všechny nové změny nenávratně přijde.
  **Oprava:** V bloku `catch` zobrazit výraznou uživatelskou chybu (toast/alert), že došla paměť úložiště a data se nedaří ukládat.

- `js/views/athletes.js:466`: Funkce `restore()` ověřuje pouze to, zda je `data.athletes` pole, a data s chybějícími klíči (např. chybějící `entries` nebo `blocks`) klidně uloží pod natvrdo napsaným klíčem `'pwr.v1'`. Po znovunačtení aplikace (`location.reload()`) spadne vykreslování např. na chybě `.filter is not a function` (protože chybí pole `entries`) a aplikace skončí s bílou obrazovkou, odkud není pro laika návratu.
  **Oprava:** Zpřísnit validaci importu tak, aby vyžadovala existenci klíčových polí jako polí (arrays), doplňovala chybějící výchozí klíče a používala konstantu `S.STORAGE_KEY`.

## Vážné

- `js/store.js:283` a `js/cloud.js:142`: Volání `saveDraft()` se spouští při každém úhozu na klávesnici v plánovači a ihned volá `persist()`, což na každé písmeno serializuje celý stav přes `JSON.stringify` (potenciálně přes 5 MB dat) a debouncuje uložení do cloudu. U velkého objemu dat (10 závodníků, 2 roky zpět) to povede ke znatelnému zasekávání uživatelského rozhraní (main thread blocking) a drahým síťovým přenosům.
  **Oprava:** Koncepty (drafts) by se měly ukládat nezávisle a nevyvolávat serializaci celého stavu ani odeslání do cloudu, dokud nedojde k finálnímu založení bloku.

- `README.md:173`: Uvedený SQL příkaz pro inicializaci Supabase používá politiku RLS `using (true) with check (true)`. Kdokoliv, kdo získá URL projektu a veřejný anon klíč (např. z videa či veřejného repozitáře), může přesměrovat dotaz bez filtru `id` a přečíst tak veškerá citlivá data všech uživatelů databáze, jako je zdravotní stav a váha svěřenců.
  **Oprava:** RLS by mělo chránit data tím, že se čtení a zápis omezí pouze na předání konkrétního tajného identifikátoru, místo povolení přístupu úplně všem operacím bez restrikcí.

## Drobné

- `js/views/athletes.js:460`: Ve funkci `restore()` se pro uložení natvrdo používá řetězec `'pwr.v1'` namísto použití existující konstanty `S.STORAGE_KEY`. Pokud se v budoucnu změní verze úložiště, obnova dat přestane správně fungovat.
  **Oprava:** Nahradit literál `'pwr.v1'` přímo importovanou konstantou `S.STORAGE_KEY`.

##
