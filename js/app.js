import { h, s, icon, clear, num, segmented, select } from './ui.js';
import * as S from './store.js';
import * as C from './calc.js';
import { initials, W, U } from './views/_util.js';

import { dashboard } from './views/dashboard.js';
import { e1rmView } from './views/e1rm.js';
import { rpeView } from './views/rpe.js';
import { platesView } from './views/plates.js';
import { blockView } from './views/block.js';
import { programView } from './views/program.js';
import { meetView } from './views/meet.js';
import { scoreView } from './views/score.js';
import { athletesView } from './views/athletes.js';
import { glossaryView } from './views/glossary.js';

const ROUTES = [
  { id: 'dashboard', label: 'Přehled', ic: 'gauge', title: 'Přehled', sub: 'Kde svěřenec stojí a kam se hýbe.', view: dashboard },
  { group: 'Nástroje' },
  { id: 'e1rm', label: 'E1RM', ic: 'calculator', title: 'Kalkulačka E1RM', sub: 'Z výkonu na odhad maxima a zpátky na váhu na ose.', view: e1rmView },
  { id: 'rpe', label: 'RPE tabulka', ic: 'grid', title: 'RPE tabulka', sub: 'Opakování × RPE převedené na procenta a kilogramy.', view: rpeView },
  { id: 'plates', label: 'Kotouče', ic: 'disc', title: 'Nakládání osy', sub: 'Co skutečně naložíš s kotouči, které máš.', view: platesView },
  { group: 'Trénink' },
  { id: 'block', label: 'Analýza bloku', ic: 'layers', title: 'Analýza bloku', sub: 'Tonáž, intenzita, INOL, Prilepin a poměr zátěže.', view: blockView },
  { id: 'program', label: 'Stavba bloku', ic: 'calendar', title: 'Stavba bloku', sub: 'Vlny, procenta a hotový plán na týdny dopředu.', view: programView },
  { group: 'Závod' },
  { id: 'meet', label: 'Závodní den', ic: 'trophy', title: 'Závodní den', sub: 'Pokusy, rozcvičení a co to udělá se součtem.', view: meetView },
  { id: 'score', label: 'Skóre', ic: 'scale', title: 'Závodní skóre', sub: 'IPF GL, DOTS a Wilks — a co s nimi dělá tělesná váha.', view: scoreView },
  { group: 'Správa' },
  { id: 'athletes', label: 'Svěřenci', ic: 'users', title: 'Svěřenci a data', sub: 'Profily, historie maxim, zálohy.', view: athletesView },
  { id: 'slovnik', label: 'Vysvětlivky', ic: 'book', title: 'Vysvětlivky', sub: 'Co která zkratka znamená, jak se počítá a odkud čísla pocházejí.', view: glossaryView },
];

const PAGES = ROUTES.filter((r) => r.id);

const app = document.getElementById('app');
let current = location.hash.slice(1) || 'dashboard';

function nav(id) {
  current = PAGES.some((p) => p.id === id) ? id : 'dashboard';
  if (location.hash.slice(1) !== current) location.hash = current;
  else render();
}

window.addEventListener('hashchange', () => {
  const id = location.hash.slice(1) || 'dashboard';
  current = PAGES.some((p) => p.id === id) ? id : 'dashboard';
  render();
});

/* =========================================================
   Značka
   ========================================================= */
function brandMark() {
  return s('svg', { viewBox: '0 0 32 32', width: 32, height: 32, class: 'brand-mark', 'aria-hidden': 'true' },
    s('rect', { x: 0, y: 6, width: 32, height: 20, rx: 4, fill: 'var(--red)' }),
    s('rect', { x: 0, y: 6, width: 32, height: 8, rx: 4, fill: '#fff', opacity: .16 }),
    s('rect', { x: 13.5, y: 0, width: 5, height: 32, rx: 2, fill: 'var(--bg-deep)' }),
    s('rect', { x: 14.75, y: 3, width: 2.5, height: 26, rx: 1.25, fill: 'var(--steel)' }));
}

/* =========================================================
   Levá lišta
   ========================================================= */
function rail() {
  const nodes = ROUTES.map((r) => {
    if (r.group) return h('div.nav-group', r.group);
    return h('button.nav-item', {
      type: 'button',
      'aria-current': r.id === current ? 'page' : null,
      onclick: () => nav(r.id),
    }, icon(r.ic, 18), h('span', r.label));
  });

  return h('aside.rail',
    h('div.brand',
      brandMark(),
      h('div.brand-text',
        h('div.brand-name', 'Platforma'),
        h('div.brand-sub', 'trenérský nástroj'))),
    h('nav.nav', { 'aria-label': 'Hlavní navigace' }, ...nodes),
    h('div.rail-foot',
      h('span', 'Data jen v prohlížeči'),
      icon('book', 15)));
}

/* =========================================================
   Horní lišta
   ========================================================= */
function topbar(page) {
  const a = S.athlete();
  return h('header.topbar',
    h('div.topbar-title',
      h('h1', page.title),
      h('p', page.sub)),
    h('div.topbar-tools',
      a && h('div.athlete-pick',
        h('span.avatar', initials(a.name)),
        select(S.state.athletes.map((x) => ({ value: x.id, label: x.name })), {
          value: a.id,
          'aria-label': 'Aktivní svěřenec',
          onchange: (e) => { S.selectAthlete(e.target.value); render(); },
        })),
      segmented([{ value: 'kg', label: 'kg' }, { value: 'lb', label: 'lb' }], S.state.unit, (v) => {
        S.commit((st) => { st.unit = v; });
        render();
      })));
}

/* =========================================================
   Vykreslení
   ========================================================= */
function render() {
  const page = PAGES.find((p) => p.id === current) ?? PAGES[0];
  clear(app);
  app.append(
    rail(),
    h('div', { style: { minWidth: 0 } },
      topbar(page),
      h('main.main', page.view(nav))));
  document.title = `${page.title} — Platforma`;
  window.scrollTo({ top: 0 });
}

render();
