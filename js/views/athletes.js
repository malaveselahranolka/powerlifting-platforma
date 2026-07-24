import { h, card, stat, icon, num, fixed, tag, table, field, numInput, inputNum, select, segmented, segmentedLive, clear, toast, download, longDate } from '../ui.js';
import { lineChart } from '../charts.js';
import * as S from '../store.js';
import * as C from '../calc.js';
import { LIFTS, COMP_LIFTS } from '../data.js';
import { W, U, Wu, initials, liftDot, empty } from './_util.js';
import * as cloud from '../cloud.js';

const st = { adding: false };

export function athletesView(nav) {
  const root = h('div.view');
  const render = () => { clear(root); build(root, render, nav); };
  render();
  return root;
}

function build(root, render, nav) {
  const a = S.athlete();

  /* ---- seznam ---- */
  root.append(card('Svěřenci', {
    eyebrow: `${S.state.athletes.length} v evidenci`,
    action: !st.adding && h('button.btn.btn-primary.btn-sm', {
      onclick: () => { st.adding = true; render(); },
    }, icon('plus', 15), 'Přidat svěřence'),
    class: 'is-flush',
  },
    S.state.athletes.length
      ? h('div', { style: { padding: '0 24px 24px' } },
          table(
            ['Jméno', { label: `Váha`, num: true }, 'Kategorie', { label: 'Dřep', num: true }, { label: 'Bench', num: true }, { label: 'Tah', num: true }, { label: 'Součet', num: true }, { label: 'IPF GL', num: true }, ''],
            S.state.athletes.map((x) => {
              const t = S.total(x);
              const wc = C.weightClass(x.bw, x.sex);
              return {
                tone: x.id === a?.id ? 'ok' : null,
                cells: [
                  h('button.btn.btn-ghost.btn-sm', {
                    style: { gap: '10px', padding: '2px 6px' },
                    onclick: () => { S.selectAthlete(x.id); render(); },
                  }, h('span.avatar', { style: { width: '26px', height: '26px', fontSize: '11px' } }, initials(x.name)), x.name),
                  { num: true, value: W(x.bw, 1) },
                  h('span.faint', wc.label),
                  { num: true, value: W(x.e1rm.squat, 0) },
                  { num: true, value: W(x.e1rm.bench, 0) },
                  { num: true, value: W(x.e1rm.deadlift, 0) },
                  { num: true, value: h('b', W(t, 0)) },
                  { num: true, value: num(C.ipfGL(t, x.bw, x.sex, x.equipment), 1) },
                  h('div.row-actions',
                    S.state.athletes.length > 1 && h('button.btn.btn-ghost.btn-icon', {
                      'aria-label': `Smazat ${x.name}`,
                      onclick: () => {
                        if (!confirm(`Smazat ${x.name} včetně všech bloků a zápisů?`)) return;
                        S.commit((s) => {
                          s.athletes = s.athletes.filter((y) => y.id !== x.id);
                          s.blocks = s.blocks.filter((b) => b.athleteId !== x.id);
                          s.entries = s.entries.filter((e) => e.athleteId !== x.id);
                          s.e1rmLog = (s.e1rmLog ?? []).filter((e) => e.athleteId !== x.id);
                          if (s.activeAthlete === x.id) s.activeAthlete = s.athletes[0]?.id;
                        });
                        render();
                      },
                    }, icon('trash', 15))),
                ],
              };
            })))
      : empty('Zatím žádní svěřenci.',
          h('button.btn.btn-primary', { onclick: () => { st.adding = true; render(); } }, 'Přidat prvního'))));

  if (st.adding) root.append(newAthleteForm(render));

  if (!a) return;

  /* ---- karta závodníka ---- */
  const set = (key, value) => S.commit((s) => { s.athletes.find((x) => x.id === a.id)[key] = value; });

  root.append(h('div.grid.g-side',
    card('Profil', { eyebrow: a.name },
      h('div.form-row',
        field('Jméno', h('input.input', { value: a.name, style: { fontFamily: 'var(--font-body)' }, onchange: (e) => { set('name', e.target.value); render(); } })),
        field(`Tělesná váha (${U()})`, numInput({
          value: inputNum(S.toDisplay(a.bw), 1), step: 0.1,
          onchange: (e) => { set('bw', S.fromDisplay(Number(e.target.value))); render(); },
        }))),
      h('div.form-row',
        field('Pohlaví', segmented([{ value: 'm', label: 'Muži' }, { value: 'f', label: 'Ženy' }], a.sex, (v) => { set('sex', v); render(); })),
        field('Provedení', segmented([{ value: 'classic', label: 'Klasika' }, { value: 'equipped', label: 'Vybavení' }], a.equipment, (v) => { set('equipment', v); render(); }))),
      field('Poznámka', h('input.input', { value: a.note ?? '', style: { fontFamily: 'var(--font-body)' }, placeholder: 'třeba termín závodu', onchange: (e) => set('note', e.target.value) })),
      h('div.form-row',
        ...COMP_LIFTS.map((k) => field(`${LIFTS[k].label} E1RM (${U()})`, numInput({
          value: inputNum(S.toDisplay(a.e1rm[k]), 1), step: 2.5,
          onchange: (e) => {
            const v = S.fromDisplay(Number(e.target.value));
            S.commit((s) => {
              const at = s.athletes.find((x) => x.id === a.id);
              at.e1rm[k] = v;
              (s.e1rmLog ??= []).push({ id: S.uid(), athleteId: a.id, lift: k, date: S.iso(new Date()), value: v });
            });
            render();
          },
        }))))),

    card('Tělesná váha', { eyebrow: 'Vývoj', action: h('button.btn.btn-sm', { onclick: () => logBw(a, render) }, icon('plus', 14), 'Zápis') },
      (a.bwLog ?? []).length > 1
        ? lineChart([{ color: 'var(--yellow)', points: a.bwLog.map((p) => ({ date: p.date, value: S.toDisplay(p.value) })) }], { height: 170, fmt: (v) => num(v, 1) })
        : h('div.chart-empty', 'Zapiš aspoň dvě vážení.'),
      (() => {
        const wc = C.weightClass(a.bw, a.sex);
        const t = C.trend((a.bwLog ?? []).map((p) => ({ date: p.date, value: p.value })));
        return h('div.grid.g2',
          stat('Kategorie', wc.label, null),
          stat('Trend', t ? `${t.perWeek >= 0 ? '+' : ''}${num(t.perWeek, 2)}` : '—', `${U()} / týden`));
      })())));

  /* ---- historie maxim ---- */
  const logs = (S.state.e1rmLog ?? []).filter((x) => x.athleteId === a.id).sort((x, y) => y.date.localeCompare(x.date));
  root.append(card('Historie maxim', { eyebrow: `${logs.length} zápisů`, class: 'is-flush' },
    logs.length
      ? h('div', { style: { padding: '0 24px 24px', maxHeight: '360px', overflowY: 'auto' } },
          table(['Datum', 'Cvik', { label: `E1RM (${U()})`, num: true }, ''],
            logs.map((l) => [
              h('span.mono', l.date),
              h('span', liftDot(l.lift), LIFTS[l.lift]?.label ?? l.lift),
              { num: true, value: W(l.value) },
              h('div.row-actions', h('button.btn.btn-ghost.btn-icon', {
                'aria-label': 'Smazat zápis',
                onclick: () => { S.commit((s) => { s.e1rmLog = s.e1rmLog.filter((x) => x.id !== l.id); }); render(); },
              }, icon('trash', 14))),
            ])))
      : empty('Zatím nic. Ulož výsledek z kalkulačky nebo uprav E1RM v profilu.')));

  /* ---- nastavení ---- */
  root.append(card('Nastavení a data', { eyebrow: 'Platí pro celou aplikaci' },
    h('div.form-row',
      field('Jednotky', segmented([{ value: 'kg', label: 'kg' }, { value: 'lb', label: 'lb' }], S.state.unit, (v) => { S.commit((s) => { s.unit = v; }); render(); })),
      field(`Osa (kg)`, select([{ value: 20, label: '20 kg' }, { value: 15, label: '15 kg' }, { value: 25, label: '25 kg' }], {
        value: S.state.bar, onchange: (e) => { S.commit((s) => { s.bar = Number(e.target.value); }); render(); },
      })),
      field('Objímky', select([{ value: 0, label: 'bez' }, { value: 5, label: 'závodní 2× 2,5 kg' }, { value: 0.5, label: 'pružinové' }], {
        value: S.state.collars, onchange: (e) => { S.commit((s) => { s.collars = Number(e.target.value); }); render(); },
      }))),
    h('div.btn-row',
      h('button.btn', {
        onclick: () => {
          download('powerlifting-data.json', JSON.stringify(S.state, null, 2), 'application/json');
          toast('Záloha stažena');
        },
      }, icon('download', 16), 'Zálohovat vše (JSON)'),
      h('button.btn', { onclick: () => restore(render) }, icon('upload', 16), 'Obnovit ze zálohy'),
      h('button.btn', {
        onclick: () => { if (confirm('Smazat všechna data a načíst ukázkový obsah?')) S.resetAll(); },
      }, icon('trash', 16), 'Smazat všechna data')),
    h('p.note', cloud.enabled()
      ? 'Data se ukládají do tohoto prohlížeče i do tvého cloudu (viz níže). Záloha do souboru se přesto hodí před velkými změnami.'
      : 'Data leží zatím jen v tomhle prohlížeči (localStorage). Chceš je mít na všech zařízeních? Zapni cloud níž.')));

  /* ---- cloudová synchronizace ---- */
  root.append(cloudCard(render));
}

/* =========================================================
   Cloudová synchronizace
   ========================================================= */
const SQL_SNIPPET = `create table if not exists sync (
  id uuid primary key,
  data jsonb not null,
  updated_at timestamptz not null default now()
);
alter table sync enable row level security;
create policy "anon rw" on sync for all to anon using (true) with check (true);`;

function cloudCard(render) {
  if (cloud.enabled()) return cloudEnabledCard(render);

  const draft = { url: '', key: '' };
  const err = h('span.field-hint', { style: { color: 'var(--red-lit)' } });
  const btn = h('button.btn.btn-primary', {}, icon('check', 16), 'Otestovat a zapnout');

  const enable = async () => {
    err.textContent = '';
    const url = draft.url.trim();
    const key = draft.key.trim();
    if (!url || !key) { err.textContent = 'Vyplň URL projektu i anon klíč.'; return; }
    btn.disabled = true;
    btn.textContent = 'Ověřuji…';
    const res = await cloud.testConnection(url, key);
    btn.disabled = false;
    clear(btn); btn.append(icon('check', 16), 'Otestovat a zapnout');
    if (!res.ok) { err.textContent = res.error; return; }
    const syncId = cloud.newSyncId();
    cloud.setConfig({ url, key, syncId, cloudUpdatedAt: null });
    // hned nahraj aktuální data
    await cloud.pushNow(JSON.stringify(S.state));
    toast('Cloud zapnut — data se teď ukládají i na internet');
    render();
  };
  btn.addEventListener('click', enable);

  return card('Cloudová synchronizace', {
    eyebrow: 'Data na všech zařízeních — vypnuto',
    action: tag('vypnuto', 'neutral'),
  },
    h('p.note', 'Zatím jsou data jen v tomhle prohlížeči. Když zapneš cloud, budou se automaticky ukládat na internet a uvidíš je i na telefonu nebo jiném počítači. Je to zdarma přes službu Supabase — nastavení zabere dvě minuty.'),

    h('ol.cloud-steps',
      h('li', 'Založ si zdarma projekt na ', h('a', { href: 'https://supabase.com', target: '_blank', rel: 'noopener' }, 'supabase.com'), ' (stačí přihlásit přes GitHub nebo e-mail).'),
      h('li', 'V projektu otevři ', h('b', 'SQL Editor'), ', vlož tenhle kód a klikni Run:'),
      h('pre.cloud-sql', h('code', SQL_SNIPPET),
        h('button.btn.btn-sm.cloud-copy', {
          onclick: () => { navigator.clipboard?.writeText(SQL_SNIPPET); toast('SQL zkopírováno'); },
        }, icon('copy', 14), 'Kopírovat')),
      h('li', 'V ', h('b', 'Project Settings → API'), ' najdeš ', h('b', 'Project URL'), ' a klíč ', h('b', 'anon public'), '. Vlož je sem:')),

    h('div.form-row',
      field('Project URL', h('input.input', {
        placeholder: 'https://xxxx.supabase.co', style: { fontFamily: 'var(--font-mono)', fontSize: '13px' },
        oninput: (e) => { draft.url = e.target.value; },
      })),
      field('anon public klíč', h('input.input', {
        placeholder: 'eyJhbGci…', style: { fontFamily: 'var(--font-mono)', fontSize: '13px' },
        oninput: (e) => { draft.key = e.target.value; },
      }))),
    err,
    h('div.btn-row', btn),
    h('p.note', 'Anon klíč je veřejný — je určený přímo do prohlížeče a smí být vidět. Tvoje data chrání náhodný sync kód, který se vytvoří při zapnutí. Klíč nikomu neposílej, sync kód taky ne.'));
}

function cloudEnabledCard(render) {
  const c = cloud.config();
  const st2 = cloud.status();
  const stLabel = {
    idle: 'nečinné', pending: 'čeká na uložení', pushing: 'ukládám…',
    pulling: 'stahuji…', synced: 'uloženo', error: 'chyba', pushed: 'uloženo',
  }[st2.state] ?? st2.state;
  const stTone = st2.state === 'error' ? 'bad' : st2.state === 'synced' ? 'ok' : 'low';

  return card('Cloudová synchronizace', {
    eyebrow: 'Data se ukládají na internet',
    action: tag(stLabel, stTone),
  },
    h('p.note', 'Zapnuto. Každá změna se automaticky ukládá do tvého cloudu. Na dalším zařízení otevři appku, zapni cloud stejným ', h('b', 'sync kódem'), ' níž a uvidíš stejná data.'),
    st2.error && h('div.flag', { dataset: { tone: 'bad' } }, icon('alert', 16), h('span', 'Poslední synchronizace selhala: ' + st2.error)),

    field('Tvůj sync kód', h('div.sync-code',
      h('code', c.syncId),
      h('button.btn.btn-sm', { onclick: () => { navigator.clipboard?.writeText(c.syncId); toast('Sync kód zkopírován'); } }, icon('copy', 14), 'Kopírovat')),
      'Tenhle kód zadáš na dalším zařízení, aby vidělo stejná data. Ber ho jako heslo — kdo ho má, vidí tvoje data.'),

    h('div.btn-row',
      h('button.btn', {
        onclick: async () => { await cloud.pushNow(JSON.stringify(S.state)); toast('Nahráno do cloudu'); render(); },
      }, icon('upload', 16), 'Nahrát teď'),
      h('button.btn', {
        onclick: () => linkDevice(render),
      }, icon('download', 16), 'Připojit k jinému kódu'),
      h('button.btn', {
        onclick: () => { if (confirm('Vypnout cloud? Data zůstanou v tomhle prohlížeči, ale přestanou se ukládat na internet.')) { cloud.disable(); toast('Cloud vypnut'); render(); } },
      }, icon('x', 16), 'Vypnout cloud')));
}

/** Připojí tohle zařízení k existujícímu sync kódu z jiného zařízení. */
async function linkDevice(render) {
  const code = prompt('Zadej sync kód z druhého zařízení (najdeš ho tam v Cloudové synchronizaci):');
  if (!code?.trim()) return;
  const c = cloud.config();
  cloud.setConfig({ ...c, syncId: code.trim(), cloudUpdatedAt: null });
  toast('Sync kód nastaven — stahuji data…');
  const res = await cloud.pull();
  if (res?.data && Array.isArray(res.data.athletes)) {
    localStorage.setItem(S.STORAGE_KEY, JSON.stringify(res.data));
    location.reload();
  } else {
    toast('Pod tímhle kódem zatím nejsou žádná data — nahraju tahle.', 'bad');
    await cloud.pushNow(JSON.stringify(S.state));
    render();
  }
}

/** Formulář na nového svěřence. Otevře se pod seznamem. */
function newAthleteForm(render) {
  const draft = {
    name: '', sex: 'm', bw: 90, equipment: 'classic',
    e1rm: { squat: 150, bench: 100, deadlift: 180 }, note: '',
  };

  const nameInput = h('input.input', {
    value: '', placeholder: 'Jméno a příjmení', autofocus: true,
    style: { fontFamily: 'var(--font-body)' },
    oninput: (e) => { draft.name = e.target.value; error.textContent = ''; },
  });
  const error = h('span.field-hint', { style: { color: 'var(--red-lit)' } });

  const save = () => {
    const name = draft.name.trim();
    if (!name) { error.textContent = 'Bez jména to nepůjde.'; nameInput.focus(); return; }
    const id = S.uid();
    S.commit((s) => {
      s.athletes.push({
        id, name, sex: draft.sex, bw: draft.bw, equipment: draft.equipment,
        e1rm: { ...draft.e1rm }, note: draft.note.trim(),
        bwLog: [{ date: S.iso(new Date()), value: draft.bw }],
      });
      (s.e1rmLog ??= []).push(...COMP_LIFTS.map((k) => ({
        id: S.uid(), athleteId: id, lift: k, date: S.iso(new Date()), value: draft.e1rm[k],
      })));
      s.activeAthlete = id;
      s.activeBlock = null;
    });
    toast(`${name} přidán`);
    st.adding = false;
    render();
  };

  return card('Nový svěřenec', {
    eyebrow: 'Údaje se dají kdykoli změnit v profilu',
    action: h('button.btn.btn-ghost.btn-sm', {
      onclick: () => { st.adding = false; render(); },
    }, icon('x', 15), 'Zrušit'),
  },
    h('div.form-row',
      field('Jméno', nameInput, null, error),
      field(`Tělesná váha (${U()})`, numInput({
        value: inputNum(S.toDisplay(draft.bw), 1), step: 0.1, min: 20,
        oninput: (e) => { draft.bw = S.fromDisplay(Number(e.target.value) || 0); },
      }))),
    h('div.form-row',
      // segmentedLive nepřekresluje pohled, jinak by volba smazala rozepsaná pole
      field('Pohlaví', segmentedLive(
        [{ value: 'm', label: 'Muži' }, { value: 'f', label: 'Ženy' }], draft.sex,
        (v) => { draft.sex = v; })),
      field('Provedení', segmentedLive(
        [{ value: 'classic', label: 'Klasika' }, { value: 'equipped', label: 'Vybavení' }], draft.equipment,
        (v) => { draft.equipment = v; }))),
    h('div.form-row',
      ...COMP_LIFTS.map((k) => field(`${LIFTS[k].label} E1RM (${U()})`, numInput({
        value: inputNum(S.toDisplay(draft.e1rm[k]), 1), step: 2.5, min: 0,
        oninput: (e) => { draft.e1rm[k] = S.fromDisplay(Number(e.target.value) || 0); },
      }), 'odhad stačí, upřesní se tréninkem'))),
    field('Poznámka', h('input.input', {
      placeholder: 'třeba termín závodu nebo zdravotní omezení',
      style: { fontFamily: 'var(--font-body)' },
      oninput: (e) => { draft.note = e.target.value; },
    })),
    h('div.btn-row',
      h('button.btn.btn-primary', { onclick: save }, icon('check', 16), 'Založit svěřence'),
      h('span.faint', { style: { fontSize: '12.5px' } }, 'Blok mu postavíš hned potom ve Stavbě bloku.')));
}

function logBw(a, render) {
  const v = prompt(`Tělesná váha (${U()})`, inputNum(S.toDisplay(a.bw), 1));
  const n = Number(String(v).replace(',', '.'));
  if (!Number.isFinite(n) || n <= 0) return;
  const kgVal = S.fromDisplay(n);
  S.commit((s) => {
    const at = s.athletes.find((x) => x.id === a.id);
    at.bw = kgVal;
    (at.bwLog ??= []).push({ date: S.iso(new Date()), value: kgVal });
    at.bwLog.sort((x, y) => x.date.localeCompare(y.date));
  });
  render();
}

function restore(render) {
  const input = h('input', { type: 'file', accept: '.json,application/json', style: { display: 'none' } });
  input.addEventListener('change', async () => {
    const file = input.files?.[0];
    if (!file) return;
    try {
      const data = JSON.parse(await file.text());
      if (!Array.isArray(data.athletes)) throw new Error('bad');
      localStorage.setItem('pwr.v1', JSON.stringify(data));
      location.reload();
    } catch {
      toast('Soubor nejde načíst', 'bad');
    }
  });
  document.body.append(input);
  input.click();
  input.remove();
}
