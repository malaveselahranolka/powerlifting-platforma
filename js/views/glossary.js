import { h, card, icon, clear } from '../ui.js';
import { GLOSSARY, GLOSSARY_GROUPS } from '../glossary.js';

const st = { query: '', group: 'vse' };

export function glossaryView() {
  const root = h('div.view');
  const render = () => { clear(root); build(root, render); };
  render();
  return root;
}

function matches(entry, q) {
  if (!q) return true;
  const hay = [entry.term, entry.full, entry.short, entry.body, entry.how, entry.formula]
    .filter(Boolean).join(' ').toLowerCase();
  return hay.includes(q);
}

function build(root, render) {
  const q = st.query.trim().toLowerCase();
  const found = GLOSSARY.filter((e) => matches(e, q) && (st.group === 'vse' || e.group === st.group));

  /* ---- hledání ---- */
  root.append(h('div.gloss-bar',
    h('div.gloss-search',
      icon('target', 16),
      h('input.input', {
        type: 'search',
        value: st.query,
        placeholder: 'Hledej pojem, vzorec nebo zkratku…',
        'aria-label': 'Hledat ve slovníku',
        oninput: (e) => {
          st.query = e.target.value;
          const keep = e.target.selectionStart;
          render();
          const next = root.querySelector('.gloss-search input');
          next.focus();
          next.setSelectionRange(keep, keep);
        },
      })),
    h('div.gloss-chips',
      ...[{ id: 'vse', label: 'Vše' }, ...GLOSSARY_GROUPS].map((g) =>
        h('button.chip', {
          type: 'button',
          'aria-pressed': String(st.group === g.id),
          onclick: () => { st.group = g.id; render(); },
        }, g.label)))));

  if (!found.length) {
    root.append(h('div.empty',
      icon('book', 26),
      h('p.note', `Na „${st.query}" nic není. Zkus zkratku nebo část vzorce.`),
      h('button.btn', { onclick: () => { st.query = ''; st.group = 'vse'; render(); } }, 'Vypsat vše')));
    return;
  }

  /* ---- pojmy po skupinách ---- */
  for (const group of GLOSSARY_GROUPS) {
    const items = found.filter((e) => e.group === group.id);
    if (!items.length) continue;

    root.append(h('section.gloss-group',
      h('h2.gloss-group-title', group.label, h('span.gloss-count', items.length)),
      h('div.gloss-list', ...items.map(entry))));
  }
}

function entry(e) {
  return h('article.gloss', { id: `pojem-${e.id}` },
    h('header.gloss-head',
      h('h3.gloss-term', e.term),
      h('p.gloss-full', e.full)),

    h('p.gloss-lead', e.short),

    e.formula && h('div.gloss-formula',
      h('span.eyebrow', 'Vzorec'),
      h('code', e.formula)),

    e.bands && h('dl.gloss-bands',
      ...e.bands.flatMap((b) => [
        h('dt', { dataset: { tone: b.tone } }, b.range),
        h('dd', b.label),
      ])),

    e.body && h('p.gloss-body', e.body),

    e.how && h('div.gloss-how',
      h('span.eyebrow', 'Jak to číst'),
      h('p', e.how)),

    e.source && h('p.gloss-source', e.source));
}
