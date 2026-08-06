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
import { velocityView } from './views/velocity.js';
import { calendarView } from './views/calendar.js';
import { adviceView } from './views/advice.js';
import { volumeView, intensityView, maxView } from './views/graphs.js';
import { compareView } from './views/compare.js';
import * as cloud from './cloud.js';

/* =========================================================
   Informační architektura

   Pět sekcí, ne sedmnáct obrazovek. Rozdělení jde podle otázky, se
   kterou trenér k appce přichází, ne podle toho, jaký výpočet uvnitř
   běží: „jak na tom je" (Přehled), „co má tenhle týden" (Trénink),
   „drží ten blok pohromadě" (Blok), „co na závodech" (Závod),
   „koho vedu" (Svěřenci).

   Kalkulačky ze seznamu zmizely, ale nikam se neztratily — jsou
   v panelu nástrojů, který se otevře nad rozdělanou prací a zase
   zavře. Pro ten způsob použití byly vždycky: spočítat jedno číslo
   a vrátit se tam, odkud jsem přišel. Vlastní obrazovka je na to
   moc velký krok.
   ========================================================= */

const SECTIONS = [
  {
    id: 'prehled', label: 'Přehled', ic: 'gauge', title: 'Přehled',
    tabs: [
      { id: 'dnes', label: 'Dnes', sub: 'Kde svěřenec stojí, co ho čeká a co je potřeba řešit.', view: dashboard },
      { id: 'doporuceni', label: 'Doporučení', sub: 'Co appka vidí a co s tím — rozhodnutí zůstává na tobě.', view: adviceView },
    ],
  },
  {
    id: 'trenink', label: 'Trénink', ic: 'calendar', title: 'Trénink',
    tabs: [
      { id: 'kalendar', label: 'Kalendář', sub: 'Jednotky v čase — přesouvání, plánování a rytmus týdne.', view: calendarView },
      { id: 'realita', label: 'Plán vs. realita', sub: 'Jak trénink dopadl proti tomu, jak byl napsaný.', view: realityView },
      { id: 'forma', label: 'Únava a forma', sub: 'Model kondice a únavy, objemové mezníky a signál proti šumu.', view: readinessView },
    ],
  },
  {
    id: 'blok', label: 'Blok', ic: 'layers', title: 'Blok',
    tabs: [
      { id: 'analyza', label: 'Analýza', sub: 'Objem, intenzita a charakter jednotlivých týdnů.', view: blockView },
      { id: 'porovnani', label: 'Porovnání', sub: 'Dva týdny, dvě jednotky nebo dva bloky vedle sebe a rozdíl mezi nimi.', view: compareView },
      { id: 'stavba', label: 'Stavba', sub: 'Vlny, procenta a hotový plán na týdny dopředu.', view: programView },
      { id: 'makro', label: 'Makrocyklus', sub: 'Bloky v čase, odlehčení a závody — sezóna jako celek.', view: macroView },
    ],
  },
  {
    id: 'grafy', label: 'Grafy', ic: 'chart', title: 'Grafy',
    tabs: [
      { id: 'objem', label: 'Objem', sub: 'Kolik práce se odvedlo — celkem, po cvicích a v tvrdých sériích.', view: volumeView },
      { id: 'intenzita', label: 'Intenzita a RPE', sub: 'Jak těžké to bylo na papíře a jak těžké to bylo doopravdy.', view: intensityView },
      { id: 'maxima', label: 'Maxima', sub: 'Kam se hnul odhad maxima — a jestli je ten posun prokazatelný.', view: maxView },
    ],
  },
  {
    id: 'zavod', label: 'Závod', ic: 'trophy', title: 'Závod',
    tabs: [
      { id: 'den', label: 'Závodní den', sub: 'Pokusy, rozcvičení a co to udělá se součtem.', view: meetView },
      { id: 'skore', label: 'Skóre', sub: 'IPF GL, DOTS a Wilks — a co s nimi dělá tělesná váha.', view: scoreView },
    ],
  },
  {
    id: 'sverenci', label: 'Svěřenci', ic: 'users', title: 'Svěřenci',
    tabs: [
      { id: 'profily', label: 'Profily a data', sub: 'Maxima, historie, zálohy a přenos mezi zařízeními.', view: athletesView },
    ],
  },
];

/* Nástroje. Otevírají se v panelu nad obsahem, ne jako obrazovka. */
const TOOLS = [
  { id: 'e1rm', label: 'E1RM', ic: 'calculator', sub: 'Z výkonu na odhad maxima a zpátky na váhu na ose.', view: e1rmView },
  { id: 'rpe', label: 'RPE tabulka', ic: 'grid', sub: 'Opakování × RPE převedené na procenta a kilogramy.', view: rpeView },
  { id: 'plates', label: 'Kotouče', ic: 'disc', sub: 'Co skutečně naložíš s kotouči, které máš.', view: platesView },
  { id: 'apre', label: 'APRE', ic: 'zap', sub: 'Autoregulace podle skutečných opakování, ne podle pocitu.', view: apreView },
  { id: 'rychlost', label: 'Rychlost tyče', ic: 'gauge2', sub: 'Profil zatížení a rychlosti, práh poklesu a bezpřístrojová obdoba.', view: velocityView },
  { id: 'slovnik', label: 'Vysvětlivky', ic: 'book', sub: 'Co která zkratka znamená, jak se počítá a odkud čísla pocházejí.', view: glossaryView },
];

/**
 * Staré adresy a staré `nav('...')` z jednotlivých pohledů.
 *
 * Odkazy z obrazovek na sebe navzájem používají původní názvy a
 * uživatelé můžou mít starou adresu v záložce. Překlad je levnější
 * než přepisovat volání ve dvanácti souborech — a hlavně nerozbije
 * odkaz, který si někdo poslal.
 */
const ALIAS = {
  dashboard: 'prehled/dnes',
  prehled: 'prehled/dnes',
  doporuceni: 'prehled/doporuceni',
  kalendar: 'trenink/kalendar',
  realita: 'trenink/realita',
  forma: 'trenink/forma',
  block: 'blok/analyza',
  program: 'blok/stavba',
  makro: 'blok/makro',
  grafy: 'grafy/objem',
  meet: 'zavod/den',
  score: 'zavod/skore',
  athletes: 'sverenci/profily',
};

const TOOL_IDS = new Set(TOOLS.map((t) => t.id));

const app = document.getElementById('app');

/* =========================================================
   Směrování — #sekce/záložka
   ========================================================= */

let route = { section: 'prehled', tab: 'dnes' };

function resolve(raw) {
  const clean = String(raw ?? '').replace(/^#/, '');
  const mapped = ALIAS[clean] ?? clean;
  const [sectionId, tabId] = mapped.split('/');

  const section = SECTIONS.find((x) => x.id === sectionId) ?? SECTIONS[0];
  const tab = section.tabs.find((t) => t.id === tabId) ?? section.tabs[0];
  return { section: section.id, tab: tab.id };
}

const currentSection = () => SECTIONS.find((x) => x.id === route.section);
const currentTab = () => currentSection().tabs.find((t) => t.id === route.tab);
const hashOf = (r) => `${r.section}/${r.tab}`;

/**
 * Přechod na jinou obrazovku. Bere nový i starý zápis, takže
 * `nav('program')` z Analýzy bloku pořád funguje. Názvy nástrojů
 * neotevírají obrazovku, ale panel.
 */
function nav(target) {
  const clean = String(target ?? '').replace(/^#/, '');
  if (TOOL_IDS.has(clean)) { openTool(clean); return; }

  const next = resolve(clean);
  const wanted = hashOf(next);
  route = next;
  if (location.hash.slice(1) !== wanted) location.hash = wanted;
  else render();
}

window.addEventListener('hashchange', () => {
  route = resolve(location.hash.slice(1));
  render();
});

/* =========================================================
   Značka
   ========================================================= */
function brandMark() {
  return s('svg', { viewBox: '0 0 32 32', width: 28, height: 28, class: 'brand-mark', 'aria-hidden': 'true' },
    s('rect', { x: 0, y: 0, width: 32, height: 32, rx: 7, fill: 'var(--accent)' }),
    s('rect', { x: 3, y: 13, width: 26, height: 6, rx: 3, fill: '#fff' }),
    s('rect', { x: 6, y: 9, width: 4, height: 14, rx: 2, fill: '#fff' }),
    s('rect', { x: 22, y: 9, width: 4, height: 14, rx: 2, fill: '#fff' }));
}

/* =========================================================
   Levá lišta
   ========================================================= */
function navButton(sec, { compact = false } = {}) {
  return h('button.nav-item', {
    type: 'button',
    title: sec.label,
    'aria-current': sec.id === route.section ? 'page' : null,
    onclick: () => nav(sec.id),
  }, icon(sec.ic, compact ? 19 : 18), h('span', sec.label));
}

function rail() {
  return h('aside.rail',
    h('div.brand',
      brandMark(),
      h('div.brand-text',
        h('div.brand-name', 'Platforma'),
        h('div.brand-sub', 'trenérský nástroj'))),

    h('nav.nav', { 'aria-label': 'Hlavní navigace' }, ...SECTIONS.map((sec) => navButton(sec))),

    h('div.rail-foot',
      h('button.nav-item', {
        type: 'button',
        onclick: () => openTool(),
      }, icon('sliders', 18), h('span', 'Nástroje')),
      h('button.nav-item', {
        type: 'button',
        onclick: () => openPalette(),
      }, icon('search', 18), h('span', 'Hledat'), h('span.kbd', { style: { marginLeft: 'auto' } }, '⌘K')),
      h('div.rail-note', icon('shield', 14), h('span', 'Data jen v prohlížeči'))));
}

/* =========================================================
   Spodní lišta na mobilu

   Pět položek s popiskem se vejde na 360 px. Sedmnáct ikon bez
   popisku, které se vodorovně rolovaly, se nevešlo nikdy.
   ========================================================= */
function tabbar() {
  return h('nav.tabbar', { 'aria-label': 'Hlavní navigace' },
    ...SECTIONS.map((sec) => navButton(sec, { compact: true })));
}

/* =========================================================
   Horní lišta — jen to, co platí napříč obrazovkami
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

function topbar() {
  const a = S.athlete();
  return h('header.topbar',
    a && h('div.athlete-pick',
      h('span.avatar', initials(a.name)),
      select(S.state.athletes.map((x) => ({ value: x.id, label: x.name })), {
        value: a.id,
        'aria-label': 'Aktivní svěřenec',
        onchange: (e) => { S.selectAthlete(e.target.value); render(); },
      })),

    h('div.topbar-tools',
      segmented([{ value: 'kg', label: 'kg' }, { value: 'lb', label: 'lb' }], S.state.unit, (v) => {
        S.commit((st) => { st.unit = v; });
        render();
      }),
      h('button.btn.btn-ghost.btn-tools', {
        type: 'button', title: 'Nástroje a kalkulačky',
        onclick: () => openTool(),
      }, icon('sliders', 17), h('span', 'Nástroje')),
      h('button.btn.btn-icon.btn-ghost.only-search', {
        type: 'button', 'aria-label': 'Hledat (Ctrl+K)', title: 'Hledat a přepínat (Ctrl+K)',
        onclick: () => openPalette(),
      }, icon('search', 17)),
      themeToggle()));
}

/* =========================================================
   Hlavička obsahu — jméno obrazovky a záložky uvnitř sekce
   ========================================================= */
function pageHead() {
  const sec = currentSection();
  const tab = currentTab();

  return h('header.page-head',
    h('div.page-head-text',
      h('h1', sec.title),
      h('p', tab.sub)),
    sec.tabs.length > 1 && h('div.tabs', { role: 'tablist', 'aria-label': sec.title },
      ...sec.tabs.map((t) => h('button.tab', {
        type: 'button', role: 'tab',
        'aria-selected': String(t.id === route.tab),
        onclick: () => nav(`${sec.id}/${t.id}`),
      }, t.label))));
}

/* =========================================================
   Panel nástrojů

   Kalkulačka se otevírá nad rozdělanou prací a zavírá se do stejného
   místa, odkud se otevřela. Na mobilu je z panelu celá obrazovka,
   protože vedle sebe se na 390 px nevejde nic.
   ========================================================= */
let toolOpen = null;

function openTool(id = toolOpen ?? 'e1rm') {
  const tool = TOOLS.find((t) => t.id === id) ?? TOOLS[0];
  const first = toolOpen == null;
  toolOpen = tool.id;

  if (!first) { drawTool(); return; }

  const restore = document.activeElement;
  const scrim = h('div.tool-scrim', {
    onpointerdown: (e) => { if (e.target === scrim) close(); },
  }, h('aside.tool-panel', { role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Nástroje' }));

  function close() {
    toolOpen = null;
    scrim.remove();
    document.removeEventListener('keydown', onKey, true);
    document.body.classList.remove('is-locked');
    restore?.focus?.();
  }

  /* Esc zavírá, Tab se drží uvnitř panelu. Bez pasti na fokus by
     klávesnice odešla za scrim do obsahu, který uživatel nevidí. */
  function onKey(e) {
    if (e.key === 'Escape') { e.preventDefault(); close(); return; }
    if (e.key !== 'Tab') return;
    const focusable = scrim.querySelectorAll('a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])');
    if (!focusable.length) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  }

  scrim.dataset.close = 'ready';
  scrim._close = close;
  document.addEventListener('keydown', onKey, true);
  document.body.classList.add('is-locked');
  document.body.append(scrim);
  drawTool();
  requestAnimationFrame(() => scrim.classList.add('is-on'));
}

function drawTool() {
  const scrim = document.querySelector('.tool-scrim');
  if (!scrim) return;
  const panel = scrim.querySelector('.tool-panel');
  const tool = TOOLS.find((t) => t.id === toolOpen);

  clear(panel);
  panel.append(
    h('header.tool-head',
      h('div.tool-head-text',
        h('div.eyebrow', 'Nástroj'),
        h('h2', tool.label),
        h('p', tool.sub)),
      h('button.btn.btn-icon.btn-ghost', {
        type: 'button', 'aria-label': 'Zavřít nástroje',
        onclick: () => scrim._close(),
      }, icon('x', 18))),

    h('div.tool-tabs', { role: 'tablist', 'aria-label': 'Nástroje' },
      ...TOOLS.map((t) => h('button.tool-tab', {
        type: 'button', role: 'tab',
        'aria-selected': String(t.id === toolOpen),
        onclick: () => openTool(t.id),
      }, icon(t.ic, 15), h('span', t.label)))),

    h('div.tool-body', tool.view(nav)));

  panel.querySelector('.tool-head .btn')?.focus();
}

/* =========================================================
   Paleta příkazů — ⌘K / Ctrl+K
   ========================================================= */
function openPalette() {
  const screens = SECTIONS.flatMap((sec) =>
    sec.tabs.map((t) => ({
      label: sec.tabs.length > 1 ? `${sec.title} · ${t.label}` : sec.title,
      hint: 'obrazovka', ic: sec.ic, keywords: `${sec.label} ${t.label} ${t.sub}`,
      run: () => nav(`${sec.id}/${t.id}`),
    })));

  cmdPalette([
    { group: 'Obrazovky', items: screens },
    {
      group: 'Nástroje',
      items: TOOLS.map((t) => ({
        label: t.label, hint: 'nástroj', ic: t.ic, keywords: `${t.label} ${t.sub}`,
        run: () => openTool(t.id),
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
  const sec = currentSection();
  const tab = currentTab();

  clear(app);
  app.append(
    h('a.skip-link', { href: '#obsah' }, 'Přeskočit na obsah'),
    rail(),
    h('div.shell',
      topbar(),
      h('main.main', { id: 'obsah', tabindex: '-1' },
        pageHead(),
        tab.view(nav)),
      tabbar()));

  document.title = `${sec.tabs.length > 1 ? `${sec.title} — ${tab.label}` : sec.title} — Platforma`;
  window.scrollTo({ top: 0 });
}

/* Start: pokud je zapnutá cloudová synchronizace a v cloudu je novější verze,
   stáhne ji a znovu načte stránku. Jinak rovnou vykreslí. */
async function boot() {
  applyTheme();

  /* Stará adresa nástroje (#e1rm, #plates, …) z něčí záložky. Obrazovka
     už to není, tak se otevře Přehled a nad ním rovnou ten nástroj. */
  const entry = location.hash.slice(1);
  const toolOnEntry = TOOL_IDS.has(entry) ? entry : null;
  route = resolve(toolOnEntry ? 'prehled' : entry);

  if (cloud.enabled()) {
    try {
      const { pulled } = await cloud.bootstrap(S.STORAGE_KEY);
      if (pulled) { location.reload(); return; }
    } catch { /* offline nebo špatná konfigurace — jede se z lokálních dat */ }
  }
  render();
  if (toolOnEntry) openTool(toolOnEntry);
}

boot();
