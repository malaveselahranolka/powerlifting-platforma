// Přejímací test k CSV. Statický — export i import sedí v pohledu, který
// potřebuje DOM, takže se kontroluje zdroj. Skutečný round-trip se ověřuje
// v prohlížeči.
import { readFileSync } from 'node:fs';
const src = readFileSync('js/views/block.js', 'utf8');
const bad = [];

if (/line\.split\(\/\[;,\t\]\/\)/.test(src) || /split\(\/\[;,\t\]\//.test(src)) {
  bad.push('import stále dělí řádek naivně podle oddělovače — uvozovaná pole rozbije');
}
if (!/replace\([^)]*"/.test(src) && !/JSON\.stringify/.test(src) && !/csvCell|escapeCsv|quoteCsv/i.test(src)) {
  bad.push('export nikde neescapuje — název se středníkem nebo uvozovkou rozhodí sloupce');
}
if (!/Number\.isFinite|isNaN|Number\.isInteger/.test(src)) {
  bad.push('import nevaliduje čísla — nečíselný vstup uloží NaN do stavu');
}
if (!/\d\{4\}-\d\{2\}-\d\{2\}|isValidDate|validDate/.test(src)) {
  bad.push('import nevaliduje datum — jiný formát tiše rozbije řazení i týdny');
}

if (bad.length) {
  console.error('CSV není v pořádku:');
  for (const b of bad) console.error('  - ' + b);
  process.exit(1);
}
console.log('OK - CSV escapuje, parsuje uvozovky a validuje vstup');
