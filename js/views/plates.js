import { h, card, icon, num, tag, table, field, numInput, select, clear } from '../ui.js';
import { barbell } from '../charts.js';
import * as S from '../store.js';
import * as C from '../calc.js';
import { PLATES_KG, PLATES_LB } from '../data.js';

const st = { target: 180 };

export function platesView() {
  const root = h('div.view');
  const render = () => { clear(root); build(root, render); };
  render();
  return root;
}

function build(root, render) {
  const unit = S.state.unit;
  const setup = S.barSetup();
  const inv = setup.inventory;
  const invKey = unit === 'lb' ? 'inventoryLb' : 'inventory';
  const STEP = unit === 'lb' ? 5 : 2.5;

  // po přepnutí jednotek přepočítat cíl, ať 180 kg neskočí na 180 lb
  if (st.unit && st.unit !== unit) {
    st.target = C.round(unit === 'lb' ? st.target / S.KG_PER_LB : st.target * S.KG_PER_LB, 1);
  }
  st.unit = unit;
  const load = S.loadDisplay(st.target, { useInventory: true });
  const ideal = S.loadDisplay(st.target);

  root.append(h('div.grid.g-side',
    h('section.card', h('div.card-body',
      h('div.readout',
        h('div',
          h('div.eyebrow', 'Naloženo na ose'),
          h('div.readout-num', num(load.total, 2), h('small', unit.toUpperCase())),
          h('div.readout-meta',
            tag(`osa ${num(setup.bar, 0)} ${unit}`, 'neutral'),
            setup.collars > 0 && tag(`objímky ${num(setup.collars, 1)} ${unit}`, 'neutral'),
            tag(`${num(load.perSide, 2)} ${unit} na stranu`, 'neutral'),
            load.delta !== 0 && tag(`${load.delta > 0 ? '+' : ''}${num(load.delta, 2)} oproti cíli`, 'warn'))),
        h('div.readout-bar', barbell(load, { height: 108 }))),

      load.plates.length
        ? h('div.plate-legend',
            ...load.plates.map((p) => h('div.plate-chip',
              h('i', { style: { background: p.color } }),
              `${p.count}× ${num(p.kg, 2)} ${unit}`,
              h('span.faint', '/ strana'))))
        : h('p.note', 'Jen holá osa.'),

      load.delta !== 0 && !load.impossible && h('div.flag', { dataset: { tone: 'warn' } },
        icon('alert', 16),
        h('span', `S dostupnými kotouči ${num(st.target, 2)} ${unit} nenaložíš. Nejblíž je ${num(load.total, 2)} ${unit}.`,
          ideal.delta === 0 ? ' Kompletní sada by to zvládla přesně.' : '')),
      load.impossible && h('div.flag', { dataset: { tone: 'bad' } },
        icon('alert', 16),
        h('span', `Cíl je pod hmotností osy s objímkami (${num(setup.bar + setup.collars, 1)} ${unit}).`)))),

    card('Zadání', { eyebrow: 'Cíl a vybavení' },
      field(`Cílová váha (${unit})`, numInput({
        value: st.target, step: STEP, min: 0,
        oninput: (e) => { st.target = Number(e.target.value); render(); },
      })),
      h('div.form-row',
        field('Osa', select(
          (unit === 'lb'
            ? [{ v: 20, l: '45 lb — mužská' }, { v: 15, l: '35 lb — dámská' }, { v: 25, l: '55 lb — silová' }]
            : [{ v: 20, l: '20 kg — mužská' }, { v: 15, l: '15 kg — dámská' }, { v: 25, l: '25 kg — silová' }]
          ).map((o) => ({ value: o.v, label: o.l })),
          { value: S.state.bar, onchange: (e) => { S.commit((s) => { s.bar = Number(e.target.value); }); render(); } })),
        field('Objímky', select([
          { value: 0, label: 'bez objímek' },
          { value: 5, label: unit === 'lb' ? 'závodní 2× 5,5 lb' : 'závodní 2× 2,5 kg' },
          { value: 0.5, label: unit === 'lb' ? 'pružinové 2× 0,5 lb' : 'pružinové 2× 0,25 kg' },
        ], { value: S.state.collars, onchange: (e) => { S.commit((s) => { s.collars = Number(e.target.value); }); render(); } }))),
      h('div.btn-row',
        h('button.btn.btn-sm', { onclick: () => { st.target = load.total + STEP; render(); } }, `+ ${num(STEP, 1)} ${unit}`),
        h('button.btn.btn-sm', { onclick: () => { st.target = Math.max(0, load.total - STEP); render(); } }, `− ${num(STEP, 1)} ${unit}`)))));

  /* ---- inventář kotoučů ---- */
  const tableRef = unit === 'lb' ? PLATES_LB : PLATES_KG;
  root.append(card('Kotouče v posilovně', {
    eyebrow: 'Kolik párů máš k dispozici',
    action: h('button.btn.btn-sm', {
      onclick: () => { S.commit((s) => { s[invKey] = Object.fromEntries(tableRef.map((p) => [p.kg, 8])); }); render(); },
    }, 'Vše po 8 párech'),
  },
    h('div', { style: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(104px, 1fr))', gap: '12px' } },
      ...tableRef.map((p) => h('label.field',
        h('span.field-label',
          h('i.lift-dot', { style: { background: p.color, width: '10px', height: '10px' } }),
          `${num(p.kg, 2)} ${unit}`),
        numInput({
          value: inv[p.kg] ?? 0, min: 0, max: 20, step: 1,
          oninput: (e) => {
            const v = Math.max(0, Number(e.target.value) || 0);
            S.commit((s) => { s[invKey] = { ...s[invKey], [p.kg]: v }; });
            render();
          },
        })))),
    h('p.note', 'Počty jsou v párech — jeden pár je jeden kotouč na každé straně.')));

  /* ---- co jde naložit v okolí ---- */
  const rows = [];
  for (let d = -5; d <= 5; d++) {
    const t = st.target + d * STEP;
    if (t < setup.bar) continue;
    const l = S.loadDisplay(t, { useInventory: true });
    rows.push({
      tone: d === 0 ? 'ok' : null,
      cells: [
        h('span.mono', num(t, 2)),
        { num: true, value: num(l.total, 2) },
        { num: true, value: l.delta === 0 ? h('span', { style: { color: 'var(--green)' } }, 'přesně') : h('span', { style: { color: 'var(--yellow)' } }, `${l.delta > 0 ? '+' : ''}${num(l.delta, 2)}`) },
        h('div.plate-legend', ...l.plates.map((p) => h('div.plate-chip', h('i', { style: { background: p.color } }), `${p.count}×${num(p.kg, 2)}`))),
      ],
    });
  }

  root.append(card('Okolní váhy', { eyebrow: `Po ${num(STEP, 1)} ${unit} nahoru a dolů`, class: 'is-flush' },
    h('div', { style: { padding: '0 24px 24px' } },
      table([`Cíl (${unit})`, { label: 'Naloží se', num: true }, { label: 'Odchylka', num: true }, 'Kotouče na stranu'], rows))));
}
