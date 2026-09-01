// Přejímací test k opravě ztráty fokusu.
// Selže, dokud v js/views/ zbývá řádek, který má zároveň `oninput` i `render()` —
// tedy handler, který si při psaní pod rukama zbourá vlastní input.
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const dir = 'js/views';
const bad = [];

for (const file of readdirSync(dir)) {
  if (!file.endsWith('.js')) continue;
  readFileSync(join(dir, file), 'utf8').split('\n').forEach((line, i) => {
    if (line.includes('oninput') && line.includes('render()')) bad.push(`${dir}/${file}:${i + 1}`);
  });
}

if (bad.length) {
  console.error(`ZBYVA ${bad.length} mist, ktera si pri psani zbouraji vlastni input:`);
  for (const b of bad) console.error('  ' + b);
  process.exit(1);
}
console.log('OK - zadny oninput uz nevola render()');
