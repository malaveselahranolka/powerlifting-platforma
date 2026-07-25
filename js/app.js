import { h, s, icon, clear, segmented, select, cmdPalette, applyTheme, readTheme, setTheme } from './ui.js';
import * as S from './store.js';

import { initials } from './views/_util.js';

import { dashboard } from './views/dashboard.js';
import { e1rmView } from './views/e1rm.js';
import { rpeView } from './views/rpe.js';
import { platesView } from './views/plates.js';
import { apreView } from './views/apre.js';
import { blockView } from './views/block.js';
import { programView } from './views/program.js';
import { meetView } from './views/meet.js';
import { scoreView } from './views/score.js';
import { athletesView } from './views/athletes.js';
import { glossaryView } from './views/glossary.js';
import { realityView } from './views/reality.js';
import { macroView } from './views/macro.js';
import { readinessView } from './views/readiness.js';
import * as cloud from './cloud.js';

const ROUTES = [
  { id: 'dashboard', label: 'Přehled', ic: 'gauge', title: 'Přehled', sub: 'Kde svěřenec stojí a kam se hýbe.', view: dashboard },
  { group: 'Nástroje' },
  { id: 'e1rm', label: 'E1RM', ic: 'calculator', title: 'Kalkulačka E1RM', sub: 'Z výkonu na odhad maxima a zpátky na váhu na ose.', view: e1rmView },
  { id: 'rpe', label: 'RPE tabulka', ic: 'grid', title: 'RPE tabulka', sub: 'Opakování × RPE převedené na procenta a kilogramy.', view: rpeView },
  { id: 'plates', label: 'Kotouče', ic: 'disc', title: 'Nakládání osy', sub: 'Co skutečně naložíš s kotouči, které máš.', view: platesView },
  { id: 'apre', label: 'APRE', ic: 'zap', title: 'APRE', sub: 'Autoregulace podle skutečných opakování, ne podle pocitu.', view: apreView },
  { group: 'Trénink' },
  { id: 'realita', label: 'Plán vs. realita', ic: 'target', title: 'Plán vs. realita', sub: 'Jak trénink dopadl proti tomu, jak byl napsaný.', view: realityView },
  { id: 'forma', label: 'Únava a forma', ic: 'activity', title: 'Únava a forma', sub: 'Model kondice a únavy, objemové mezníky a signál proti šumu.', view: readinessView },
  { id: 'block', label: 'Analýza bloku', ic: 'layers', title: 'Analýza bloku', sub: 'Objem, intenzita a charakter jednotlivých týdnů.', view: blockView },
  { id: 'program', label: 'Stavba bloku', ic: 'calendar', title: 'Stavba bloku', sub: 'Vlny, procenta a hotový plán na týdny dopředu.', view: programView },
  { id: 'makro', label: 'Makrocyklus', ic: 'trending', title: 'Makrocyklus', sub: 'Bloky v čase, odlehčení a zápasy — sezóna jako celek.', view: macroView },
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
  return s('svg', { viewBox: '0 0 32 32', width: 26, height: 26, class: 'brand-mark', 'aria-hidden': 'true' },
    s('rect', { x: 0, y: 0, width: 32, height: 32, rx: 7, fill: 'var(--accent)' }),
    s('rect', { x: 3, y: 13, width: 26, height: 6, rx: 3, fill: '#fff' }),
    s('rect', { x: 6, y: 9, width: 4, height: 14, rx: 2, fill: '#fff' }),
    s('rect', { x: 22, y: 9, width: 4, height: 14, rx: 2, fill: '#fff' }));
}

/* =========================================================
   Levá lišta
   ========================================================= */
function rail() {
  const nodes = ROUTES.map((r) => {
    if (r.group) return h('div.nav-group', r.group);
    return h('button.nav-item', {
      type: 'button',
      title: r.label,
      'aria-current': r.id === current ? 'page' : null,
      onclick: () => nav(r.id),
    }, icon(r.ic, 17), h('span', r.label));
  });

  return h('aside.rail',
    h('div.brand',
      brandMark(),
      h('div.brand-text',
        h('div.brand-name', 'Platforma'),
        h('div.brand-sub', 'trenérský nástroj'))),
    h('nav.nav', { 'aria-label': 'Hlavní navigace' }, ...nodes),
    h('div.rail-foot',
      h('button.nav-item', {
        type: 'button', title: 'Hledat a přepínat (Ctrl+K)',
        onclick: () => openPalette(),
      }, icon('search', 17), h('span', 'Hledat'), h('span.kbd', { style: { marginLeft: 'auto' } }, '⌘K')),
      h('div.rail-note', icon('shield', 14), h('span', 'Data jen v prohlížeči'))));
}

/* =========================================================
   Horní lišta
   ========================================================= */
function themeToggle() {
  const t = readTheme();
  const next = t === 'dark' ? 'light' : 'dark';
  return h('button.btn.btn-icon.btn-ghost', {
    type: 'button',
    title: next === 'dark' ? 'Přepnout na tmavý motiv' : 'Přepnout na světlý motiv',
    'aria-label': 'Přepnout motiv',
    onclick: () => { setTheme(next); render(); },
  }, icon(t === 'dark' ? 'sun' : 'moon', 17));
}

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
      }),
      themeToggle()));
}

/* =========================================================
   Paleta příkazů — ⌘K / Ctrl+K
   ========================================================= */
function openPalette() {
  cmdPalette([
    {
      group: 'Obrazovky',
      items: PAGES.map((p) => ({
        label: p.title, hint: p.label, ic: p.ic, keywords: `${p.label} ${p.sub}`,
        run: () => nav(p.id),
      })),
    },
    {
      group: 'Svěřenci',
      items: S.state.athletes.map((x) => ({
        label: x.name, hint: 'přepnout', ic: 'users', keywords: x.name,
        run: () => { S.selectAthlete(x.id); render(); },
      })),
    },
    {
      group: 'Nastavení',
      items: [
        {
          label: readTheme() === 'dark' ? 'Přepnout na světlý motiv' : 'Přepnout na tmavý motiv',
          ic: readTheme() === 'dark' ? 'sun' : 'moon', keywords: 'motiv téma tmavý světlý theme',
          run: () => { setTheme(readTheme() === 'dark' ? 'light' : 'dark'); render(); },
        },
        {
          label: S.state.unit === 'kg' ? 'Přepnout na libry' : 'Přepnout na kilogramy',
          ic: 'scale', keywords: 'jednotky kg lb libry kilogramy',
          run: () => { S.commit((st) => { st.unit = st.unit === 'kg' ? 'lb' : 'kg'; }); render(); },
        },
        { label: 'Vytisknout obrazovku', ic: 'printer', keywords: 'tisk print pdf papír', run: () => window.print() },
      ],
    },
  ]);
}

window.addEventListener('keydown', (e) => {
  if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
    e.preventDefault();
    openPalette();
  }
});

/* =========================================================
   Vykreslení
   ========================================================= */
function render() {
  const page = PAGES.find((p) => p.id === current) ?? PAGES[0];
  clear(app);
  app.append(
    h('a.skip-link', { href: '#obsah' }, 'Přeskočit na obsah'),
    rail(),
    h('div', { style: { minWidth: 0 } },
      topbar(page),
      h('main.main', { id: 'obsah', tabindex: '-1' }, page.view(nav))));
  document.title = `${page.title} — Platforma`;
  window.scrollTo({ top: 0 });
}

/* Start: pokud je zapnutá cloudová synchronizace a v cloudu je novější verze,
   stáhne ji a znovu načte stránku. Jinak rovnou vykreslí. */
async function boot() {
  applyTheme();
  if (cloud.enabled()) {
    try {
      const { pulled } = await cloud.bootstrap(S.STORAGE_KEY);
      if (pulled) { location.reload(); return; }
    } catch { /* offline nebo špatná konfigurace — jede se z lokálních dat */ }
  }
  render();
}

boot();
