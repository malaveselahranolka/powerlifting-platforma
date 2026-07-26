import { h, card, icon, num, tag, clear } from '../ui.js';
import * as S from '../store.js';
import * as C from '../calc.js';
import { empty } from './_util.js';

/**
 * Doporučení.
 *
 * Sbírá signály, které appka počítá roztroušeně po ostatních obrazovkách,
 * a skládá je do jednoho seřazeného seznamu. Nic nepřepisuje — a je to
 * záměr, ne nedodělek.
 *
 * Appka umí spočítat, že příští týden vychází o čtyři procenta levněji.
 * Neví ale, že závodník minulý týden stěhoval, že ho bolí rameno, nebo že
 * za měsíc jede na dovolenou. Automatický přepis plánu by tyhle informace
 * přebil čísly, která je neznají — proto se tady jen řekne, co se stalo,
 * co s tím, a jak silný je pro to důvod.
 */

const st = { filter: 'all' };

const WEIGHT = {
  studie: { label: 'studie', tone: 'ok', title: 'Opřeno o recenzovaný zdroj' },
  praxe: { label: 'praxe', tone: 'neutral', title: 'Trenérská konvence nebo federační norma, ne výzkum' },
  appka: { label: 'appka', tone: 'low', title: 'Konstrukce této aplikace — užitečná, ale nikde neověřená' },
};

const PRIORITY = {
  1: { label: 'Jednej teď', note: 'Věci, které se za týden zhorší, nebo se pak už nedají vzít zpět.' },
  2: { label: 'Tenhle týden', note: 'Rozhodnutí, která patří do plánování dalšího mikrocyklu.' },
  3: { label: 'Dobré vědět', note: 'Nic nehoří — kontext, který se hodí při stavbě dalšího bloku.' },
};

export function adviceView(nav) {
  const root = h('div.view');
  const render = () => { clear(root); build(root, render, nav); };
  render();
  return root;
}

function build(root, render, nav) {
  const a = S.athlete();
  if (!a) {
    root.append(empty('Nejdřív si založ svěřence.', h('button.btn.btn-primary', { onclick: () => nav('athletes') }, 'Přidat svěřence')));
    return;
  }

  const block = S.block();
  const entries = S.allEntries(a.id);
  const e1rmLog = (S.state.e1rmLog ?? []).filter((x) => x.athleteId === a.id);

  const all = [
    ...C.recommendations({
      athlete: a,
      block,
      entries,
      e1rms: S.blockE1rm(block, a),
      meets: S.athleteMeets(a.id),
      e1rmLog,
      wellness: S.athleteWellness(a.id),
      today: S.iso(new Date()),
    }),
    ...C.trendRecommendations(e1rmLog),
  ].sort((x, y) => x.priority - y.priority);

  const shown = st.filter === 'all' ? all : all.filter((r) => r.weight === st.filter);
  const counts = { studie: 0, praxe: 0, appka: 0 };
  for (const r of all) counts[r.weight]++;

  /* ---- hlavička ---- */
  root.append(card('Co appka vidí', {
    eyebrow: `${a.name}${block ? ` · ${block.name}` : ''}`,
    action: h('div.seg', { role: 'group' },
      ...[['all', `Vše (${all.length})`], ['studie', `Studie (${counts.studie})`], ['praxe', `Praxe (${counts.praxe})`], ['appka', `Appka (${counts.appka})`]]
        .map(([k, label]) => h('button.seg-btn', {
          type: 'button', 'aria-pressed': String(st.filter === k),
          onclick: () => { st.filter = k; render(); },
        }, label))),
  },
    all.length === 0
      ? h('div.empty',
          icon('check', 26),
          h('p.note', 'Nic, co by si žádalo pozornost. To je dobrá zpráva — ale taky to může znamenat, že appka nemá dost dat.'),
          h('button.btn.btn-sm', { onclick: () => nav('realita') }, 'Zapsat, jak šel trénink'))
      : h('p.note',
          'Seřazeno podle naléhavosti. U každého doporučení je vidět, jak silný je pro něj důvod — '
          + 'pásmo převzaté z dotazníku na deseti lidech nemá vážit stejně jako koeficient '
          + 'z osmisettisícového vzorku.'),

    all.length > 0 && h('div.flag', { dataset: { tone: 'low' } },
      icon('info', 16),
      h('span', h('b', 'Appka nic sama nepřepisuje.'), ' '
        + 'Umí spočítat, že příští týden vychází o pár procent jinak — neví ale, že závodník '
        + 'minulý týden stěhoval, že ho bolí rameno nebo že za měsíc jede na dovolenou. '
        + 'Tyhle věci znáš jenom ty, a rozhodnutí proto zůstává na tobě.'))));

  /* ---- podle naléhavosti ---- */
  for (const p of [1, 2, 3]) {
    const group = shown.filter((r) => r.priority === p);
    if (!group.length) continue;
    root.append(card(PRIORITY[p].label, { eyebrow: PRIORITY[p].note },
      h('div', { style: { display: 'flex', flexDirection: 'column', gap: '10px' } },
        ...group.map((r) => adviceRow(r, nav)))));
  }

  if (all.length && !shown.length) {
    root.append(card('Nic v tomhle filtru', { eyebrow: 'Zkus jiný' },
      h('p.note', 'Žádné doporučení téhle úrovně podloženosti teď není.')));
  }
}

function adviceRow(r, nav) {
  const w = WEIGHT[r.weight];
  return h('div.advice', { dataset: { tone: r.tone } },
    h('div.advice-head',
      icon(r.tone === 'bad' ? 'alert' : r.tone === 'warn' ? 'alert' : r.tone === 'ok' ? 'check' : 'info', 16),
      h('b.advice-title', r.title),
      h('span', { title: w.title }, tag(w.label, w.tone))),
    h('p.advice-why', r.why),
    h('div.advice-foot',
      h('p.advice-do', h('b', 'Co s tím: '), r.action),
      r.screen && h('button.btn.btn-sm', { onclick: () => nav(r.screen) }, 'Otevřít', icon('arrow', 13))));
}
