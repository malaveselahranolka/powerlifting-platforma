// Přejímací test k ochraně dat ve store.js.
// Simuluje localStorage v Node, aby šlo ověřit chování, na které se v prohlížeči
// přijde až ve chvíli, kdy je pozdě.
const mem = new Map();
let failNextWrite = false;

globalThis.localStorage = {
  getItem: (k) => (mem.has(k) ? mem.get(k) : null),
  setItem: (k, v) => {
    if (failNextWrite) {
      const e = new Error('QuotaExceededError');
      e.name = 'QuotaExceededError';
      throw e;
    }
    mem.set(k, String(v));
  },
  removeItem: (k) => mem.delete(k),
};
globalThis.location = { reload() {} };
globalThis.crypto ??= { randomUUID: () => 'x'.repeat(8) };

const KEY = 'pwr.v1';
const results = [];
const check = (name, ok, detail = '') => { results.push({ name, ok, detail }); };

// ---- 1. poškozený stav se nesmí tiše zahodit ----
const realData = JSON.stringify({
  version: 99, unit: 'kg', bar: 20, collars: 5,
  athletes: [{ id: 'a1', name: 'Skutecny Svěřenec', sex: 'm', bw: 90, e1rm: { squat: 200, bench: 130, deadlift: 240 } }],
  blocks: [], entries: [], e1rmLog: [], meets: [], wellness: [], drafts: {},
});
mem.set(KEY, realData);

const S = await import('../js/store.js?v=' + Date.now());

const backup = [...mem.keys()].find((k) => k !== KEY && k.startsWith('pwr.v1'));
check('poškozený stav se zálohuje pod jiný klíč', !!backup, backup ? `klíč: ${backup}` : 'ŽÁDNÁ ZÁLOHA');
check('záloha obsahuje původní data', backup ? mem.get(backup) === realData : false);
check('appka o problému ví (exportuje příznak)', S.loadIssue != null, `loadIssue=${JSON.stringify(S.loadIssue ?? null)}`);

// ---- 2. plné úložiště se nesmí spolknout ----
failNextWrite = true;
let surfaced = false;
if (typeof S.onStorageError === 'function') S.onStorageError(() => { surfaced = true; });
try { S.commit((st) => { st.unit = 'lb'; }); } catch { surfaced = true; }
failNextWrite = false;
check('zaplněné úložiště se ohlásí ven', surfaced, surfaced ? '' : 'chyba se spolkla v prázdném catch');

let bad = 0;
for (const r of results) {
  console.log(`${r.ok ? '  ok  ' : '  FAIL'} ${r.name}${r.detail ? '  — ' + r.detail : ''}`);
  if (!r.ok) bad++;
}
console.log(bad ? `\n${bad} z ${results.length} kontrol selhalo` : `\nvšech ${results.length} kontrol prošlo`);
process.exit(bad ? 1 : 0);
