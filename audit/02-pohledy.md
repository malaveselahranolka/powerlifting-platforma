## Kriticke

- js/views/block.js:413: Pridani treninku do s.entries primo se odchyluje od API store tim, ze nenastavuje actualWeight: null a actualReps: null. Oprava: Pouzit store API addEntry.

## Vazne

- js/views/e1rm.js:49: Volani render() primo z udalosti oninput znici focus pole uprostred psani. Oprava: Presunout prekresleni do onchange.
- js/views/e1rm.js:50: render() znicujici focus v oninput. Oprava: Pouzit onchange.
- js/views/e1rm.js:130: render() znicujici focus v oninput. Oprava: Pouzit onchange.
- js/views/e1rm.js:133: render() znicujici focus v oninput. Oprava: Pouzit onchange.
- js/views/meet.js:48: render() v oninput. Oprava: Prevest na onchange.
- js/views/meet.js:214: render() v oninput. Oprava: Zmenit na onchange.
- js/views/plates.js:63: render() v oninput. Oprava: Pouzit onchange.
- js/views/program.js:634: render() v oninput. Oprava: Prevest na onchange.
- js/views/rpe.js:33: render() v oninput. Oprava: Prevest na onchange.
- js/views/score.js:76: render() v oninput. Oprava: Pouzit onchange.
- js/views/score.js:80: render() v oninput. Oprava: Pouzit onchange.
- js/views/score.js:85: render() v oninput. Oprava: Pouzit onchange.
- js/views/apre.js:52: render() v oninput. Oprava: Zmenit na onchange.
- js/views/apre.js:77: render() v oninput. Oprava: Zmenit na onchange.
- js/views/advice.js:20, js/views/apre.js:7, js/views/athletes.js:9, js/views/block.js:9, js/views/calendar.js:20, js/views/compare.js:23, js/views/e1rm.js:8, js/views/glossary.js:4, js/views/graphs.js:25, js/views/macro.js:8, js/views/meet.js:8, js/views/plates.js:7, js/views/program.js:13, js/views/reality.js:8, js/views/rpe.js:8, js/views/score.js:8, js/views/velocity.js:21: Globalni promenna const st v modulu prenasi lokalni stav z jednoho sverence na druheho. Oprava: Presunout deklaraci st dovnitr funkce renderu pohledu nebo do state storidly.

## Drobne

- js/views/block.js:374: Duplikace logiky updateEntry. Oprava: Nahradit volanim API S.updateEntry().
- js/views/block.js:394: Duplikace logiky deleteEntry. Oprava: Pouzit S.deleteEntry().
- js/views/block.js:462: Duplikace logiky pridavani bez API. Oprava: Vytvorit a pouzit metodu store pro davkove pridani.
- js/views/reality.js:406: Duplikace mutace pres Object.assign. Oprava: Pouzit S.updateEntry().
- js/views/athletes.js:130: Prepisovani s.e1rmLog in-line pres filtr. Oprava: Doplnit API pro mazani e1rm do storu a pouzit jej.
- Zadne volani atributu html: se v aplikaci nevyskytuje.
