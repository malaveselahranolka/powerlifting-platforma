import { h, card, stat, icon, num, fixed, bigNum, tag, table, field, numInput, select, decimalInput, clear, toast, longDate, weekday } from '../ui.js';
import * as S from '../store.js';
import * as C from '../calc.js';
import { LIFTS, COMP_LIFTS, WEEKDAY_LABELS } from '../data.js';
import { W, U, Wu, liftDot, liftName, empty, flagRow, rpeLabel, variantOptions } from './_util.js';

/**
 * Kalendář a plánování jednotek.
 *
 * Ostatní obrazovky se dívají na trénink jako na tabulku. Tahle ho ukazuje
 * v čase, protože některé chyby jsou vidět jen z rozložení do dnů: dvě těžké
 * jednotky téhož cviku po sobě, tři dny volna uprostřed bloku, závod, na který
 * navazuje plný objem.
 *
 * Jednotka se dá přesunout tažením na jiný den. Posouvá se celý den naráz —
 * trénink je jedna jednotka a rozdělit ji na dvě poloviční ve dvou dnech
 * skoro nikdy není záměr.
 */

const st = {
  month: null,        // 'YYYY-MM', null = aktuální
  selected: null,     // vybraný den
  dragging: null,     // datum taženého dne
  adding: false,
};

export function calendarView(nav) {
  const root = h('div.view');
  const render = () => { clear(root); build(root, render, nav); };
  render();
  return root;
}

const iso = S.iso;
const monthKey = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
const MONTHS = ['leden', 'únor', 'březen', 'duben', 'květen', 'červen', 'červenec', 'srpen', 'září', 'říjen', 'listopad', 'prosinec'];

function build(root, render, nav) {
  const a = S.athlete();
  if (!a) {
    root.append(empty('Nejdřív si založ svěřence.', h('button.btn.btn-primary', { onclick: () => nav('athletes') }, 'Přidat svěřence')));
    return;
  }

  const today = iso(new Date());
  const cursor = st.month ?? monthKey(new Date());
  const [cy, cm] = cursor.split('-').map(Number);

  const entries = S.allEntries(a.id);
  const meets = S.athleteMeets(a.id);
  const blocks = S.athleteBlocks(a.id);
  const e1rms = a.e1rm ?? {};
  const variants = S.athleteVariants(a);

  if (!st.selected) st.selected = pickDay(entries, today);

  root.append(monthCard(a, cy, cm, entries, meets, blocks, e1rms, variants, today, render));
  root.append(h('div.grid.g-side',
    sessionCard(a, st.selected, e1rms, variants, render, nav),
    h('div', { style: { display: 'flex', flexDirection: 'column', gap: '12px' } },
      rhythmCard(entries, blocks, e1rms, variants),
      upcomingCard(entries, meets, today, render))));
}

/** Vybere den, na kterém se dá začít: dnešek, nebo nejbližší tréninkový den. */
function pickDay(entries, today) {
  if (entries.some((e) => e.date === today)) return today;
  const future = entries.filter((e) => e.date >= today).map((e) => e.date).sort();
  if (future.length) return future[0];
  const past = entries.map((e) => e.date).sort();
  return past.at(-1) ?? today;
}

/* =========================================================
   Měsíční mřížka
   ========================================================= */
function monthCard(a, cy, cm, entries, meets, blocks, e1rms, variants, today, render) {
  const first = new Date(cy, cm - 1, 1);
  const daysInMonth = new Date(cy, cm, 0).getDate();
  // pondělí = 0
  const lead = (first.getDay() + 6) % 7;

  const byDate = new Map();
  for (const e of entries) {
    if (!byDate.has(e.date)) byDate.set(e.date, []);
    byDate.get(e.date).push(e);
  }
  const meetBy = new Map(meets.map((m) => [m.date, m]));

  const shift = (n) => {
    const d = new Date(cy, cm - 1 + n, 1);
    st.month = monthKey(d);
    render();
  };

  const grid = h('div.cal');
  for (const w of WEEKDAY_LABELS) grid.append(h('div.cal-head', w));

  // doplnit dny z předchozího měsíce, ať mřížka začíná v pondělí
  for (let i = 0; i < lead; i++) grid.append(h('div.cal-cell.is-out'));

  for (let day = 1; day <= daysInMonth; day++) {
    const date = `${cy}-${String(cm).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const dayEntries = byDate.get(date) ?? [];
    const sum = C.sessionSummary(dayEntries, e1rms, variants);
    const meet = meetBy.get(date);
    const blk = blocks.find((b) => date >= b.start && C.daysBetween(b.start, date) < b.weeks * 7);

    const cell = h('div.cal-cell', {
      dataset: {
        today: String(date === today),
        selected: String(date === st.selected),
        has: String(dayEntries.length > 0),
        state: sum ? (sum.complete ? 'done' : sum.done > 0 ? 'partial' : 'planned') : '',
      },
      tabindex: '0',
      role: 'button',
      'aria-label': `${day}. ${MONTHS[cm - 1]}${sum ? `, ${sum.sets} sérií` : ', volno'}`,
      onclick: () => { st.selected = date; render(); },
      onkeydown: (ev) => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); st.selected = date; render(); } },
      /* přetažení jednotky na jiný den */
      ondragover: (ev) => { if (st.dragging && st.dragging !== date) { ev.preventDefault(); cell.dataset.drop = 'true'; } },
      ondragleave: () => { delete cell.dataset.drop; },
      ondrop: (ev) => {
        ev.preventDefault();
        delete cell.dataset.drop;
        if (!st.dragging || st.dragging === date) return;
        const n = S.moveSession(st.dragging, date, a.id);
        toast(n ? `Jednotka přesunuta na ${weekday(date)}` : 'Není co přesunout');
        st.selected = date;
        st.dragging = null;
        render();
      },
    },
      h('div.cal-day', String(day)),
      blk && h('span.cal-block', { title: blk.name }),
      meet && h('div.cal-meet', { title: meet.name ?? 'Závod' }, icon('trophy', 12)),
      sum && h('div.cal-session', {
        draggable: 'true',
        title: `${sum.sets} sérií · ${bigNum(S.toDisplay(sum.tonnage))} ${U()}${sum.peak ? ` · špička ${num(sum.peak, 0)} %` : ''}`,
        ondragstart: () => { st.dragging = date; },
        ondragend: () => { st.dragging = null; },
      },
        h('div.cal-dots', ...sum.lifts.slice(0, 4).map((l) => liftDot(l.lift))),
        h('div.cal-vol', `${sum.sets}× · ${bigNum(S.toDisplay(sum.tonnage))}`)));

    grid.append(cell);
  }

  return card(`${MONTHS[cm - 1]} ${cy}`, {
    eyebrow: 'Jednotku přetáhni myší na jiný den',
    class: 'is-flush',
    action: h('div.btn-row',
      h('button.btn.btn-sm.btn-icon', { title: 'Předchozí měsíc', onclick: () => shift(-1) }, icon('chevron', 15, 'rot90')),
      h('button.btn.btn-sm', { onclick: () => { st.month = null; st.selected = today; render(); } }, 'Dnes'),
      h('button.btn.btn-sm.btn-icon', { title: 'Další měsíc', onclick: () => shift(1) }, icon('chevron', 15, 'rot270'))),
  },
    h('div', { style: { padding: '0 20px 16px' } },
      grid,
      h('div.cal-legend',
        h('span.cal-key', h('i', { dataset: { state: 'planned' } }), 'naplánováno'),
        h('span.cal-key', h('i', { dataset: { state: 'partial' } }), 'rozdělané'),
        h('span.cal-key', h('i', { dataset: { state: 'done' } }), 'hotovo'),
        h('span.cal-key', icon('trophy', 12), 'závod'),
        h('span.faint', { style: { marginLeft: 'auto', fontSize: '11.5px' } }, 'Proužek u levého okraje = probíhá blok'))));
}

/* =========================================================
   Detail jednotky
   ========================================================= */
function sessionCard(a, date, e1rms, variants, render, nav) {
  const rows = S.dayEntries(date, a.id);
  const sum = C.sessionSummary(rows, e1rms, variants);
  const isPast = date < S.iso(new Date());

  const head = h('div.btn-row',
    rows.length > 0 && h('button.btn.btn-sm', {
      title: 'Zkopírovat jednotku na jiný den',
      onclick: () => {
        const to = prompt('Zkopírovat na datum (RRRR-MM-DD):', date);
        if (!to || !/^\d{4}-\d{2}-\d{2}$/.test(to)) return;
        const n = S.copySession(date, to, a.id);
        toast(n ? `Zkopírováno ${n} položek na ${to}` : 'Nic ke kopírování');
        render();
      },
    }, icon('copy', 14), 'Kopírovat'),
    rows.length > 0 && h('button.btn.btn-sm.btn-danger', {
      title: 'Smazat celou jednotku',
      onclick: () => {
        if (!confirm(`Smazat celou jednotku ${weekday(date)}? Tohle se nedá vrátit.`)) return;
        S.deleteSession(date, a.id);
        toast('Jednotka smazána');
        render();
      },
    }, icon('trash', 14)),
    h('button.btn.btn-sm.btn-primary', {
      onclick: () => { st.adding = !st.adding; render(); },
    }, icon(st.adding ? 'x' : 'plus', 14), st.adding ? 'Zavřít' : 'Přidat cvik'));

  const body = [];

  if (st.adding) body.push(addForm(a, date, render));

  if (!rows.length) {
    body.push(h('div.empty',
      icon('calendar', 24),
      h('p.note', `${weekday(date)} je volno. Přidej cvik, nebo si sem přetáhni jednotku z jiného dne.`)));
  } else {
    body.push(
      h('div.grid.g3',
        stat('Sérií', sum.sets, `${sum.items} položek`),
        stat('Tonáž', bigNum(S.toDisplay(sum.tonnage)), U()),
        stat('Špička', sum.peak ? `${num(sum.peak, 0)}` : '—', sum.peak ? '% z 1RM' : 'bez maxima',
          sum.peak >= 90 ? 'bad' : sum.peak >= 85 ? 'warn' : null)),

      table(
        ['Cvik', { label: 'Série × op.', num: true }, { label: `Váha (${U()})`, num: true }, { label: 'RPE', num: true }, 'Stav', ''],
        rows.map((e) => ({
          tone: e.actualRpe != null ? 'ok' : null,
          cells: [
            h('span', liftDot(e.lift), liftName(e)),
            { num: true, value: `${e.sets}×${e.reps}` },
            { num: true, value: W(C.liftedWeight(e), 1) },
            { num: true, value: e.actualRpe != null ? h('b', rpeLabel(e.actualRpe)) : h('span.faint', e.rpe == null ? '—' : rpeLabel(e.rpe)) },
            e.actualRpe != null ? tag('zapsáno', 'ok') : tag(isPast ? 'chybí zápis' : 'plán', isPast ? 'warn' : 'neutral'),
            h('button.btn.btn-ghost.btn-sm.btn-icon', {
              title: 'Smazat řádek',
              onclick: () => { S.deleteEntry(e.id); render(); },
            }, icon('trash', 13)),
          ],
        }))),

      isPast && sum.done < 1 && flagRow({
        tone: 'warn',
        text: `Jednotka už proběhla, ale ${Math.round((1 - sum.done) * 100)} % sérií nemá zapsanou skutečnost. `
          + 'Bez ní se nedá spočítat odchylka RPE ani denní připravenost.',
      }),

      h('div.btn-row',
        h('button.btn.btn-sm', { onclick: () => nav('realita') }, icon('target', 14), 'Zapsat, jak to šlo')));
  }

  return card(weekday(date), {
    eyebrow: longDate(date),
    action: head,
  }, ...body);
}

function addForm(a, date, render) {
  const draft = { lift: 'squat', variant: '', name: '', sets: 3, reps: 5, weight: 100, rpe: 8 };
  const blk = S.athleteBlocks(a.id).find((b) => date >= b.start && C.daysBetween(b.start, date) < b.weeks * 7)
    ?? S.block();
  const variants = S.athleteVariants(a);

  /** Maximum, proti kterému se počítá váha — u varianty odvozené. */
  const refMax = () => C.entryE1rm({ lift: draft.lift, variant: draft.variant || null }, a.e1rm, variants);

  const weightField = h('div');
  const nameField = h('div');
  const variantField = h('div');

  const syncWeight = () => {
    const max = refMax();
    if (max > 0) draft.weight = C.roundToBar(C.weightFor(max, draft.reps, draft.rpe) ?? draft.weight);
    clear(weightField);
    weightField.append(field(`Váha (${U()})`, numInput({
      value: S.toDisplay(draft.weight), step: 2.5, min: 0,
      oninput: (e) => { draft.weight = S.fromDisplay(Number(e.target.value) || 0); },
    }), max > 0 && draft.variant ? `Z odvozeného maxima ${Wu(max)}` : null));
  };

  const syncVariant = () => {
    clear(variantField);
    const opts = draft.lift === 'accessory' ? [] : variantOptions(draft.lift);
    if (opts.length <= 1) return;
    variantField.append(field('Provedení', select(opts, {
      value: draft.variant,
      onchange: (e) => { draft.variant = e.target.value; syncVariant(); syncWeight(); },
    }), draft.variant
      ? 'Počítá se proti odvozenému maximu, ne proti soutěžnímu'
      : null));
  };

  const syncName = () => {
    clear(nameField);
    if (draft.lift === 'accessory') {
      nameField.append(field('Název cviku', h('input.input', {
        placeholder: 'třeba Předkopávání', style: { fontFamily: 'var(--font-body)' },
        oninput: (e) => { draft.name = e.target.value; },
      })));
    }
  };
  syncVariant();
  syncName();
  syncWeight();

  return h('div', { style: { display: 'flex', flexDirection: 'column', gap: '10px', paddingBottom: '4px' } },
    h('div.form-row',
      field('Cvik', select(Object.entries(LIFTS).map(([k, v]) => ({ value: k, label: v.label })), {
        value: draft.lift,
        onchange: (e) => {
          draft.lift = e.target.value;
          draft.variant = '';
          syncVariant();
          syncName();
          syncWeight();
        },
      })),
      field('Sérií', numInput({ value: draft.sets, step: 1, min: 1, oninput: (e) => { draft.sets = Number(e.target.value) || 1; } })),
      field('Opakování', numInput({ value: draft.reps, step: 1, min: 1, oninput: (e) => { draft.reps = Number(e.target.value) || 1; } }))),
    variantField,
    nameField,
    h('div.form-row',
      weightField,
      field('RPE', decimalInput({
        value: String(draft.rpe).replace('.', ','),
        onvalue: (v) => { draft.rpe = v; },
      }), 'Nepovinné')),
    h('div.btn-row',
      h('button.btn.btn-primary.btn-sm', {
        onclick: () => {
          if (!(draft.weight > 0)) { toast('Zadej váhu', 'bad'); return; }
          S.addEntry({
            blockId: blk?.id ?? null, athleteId: a.id, date,
            lift: draft.lift, variant: draft.variant || null,
            name: draft.lift === 'accessory' ? (draft.name || 'Doplňkový cvik') : null,
            sets: draft.sets, reps: draft.reps, weight: draft.weight,
            rpe: draft.rpe > 0 ? draft.rpe : null,
          });
          toast('Cvik přidán');
          st.adding = false;
          render();
        },
      }, icon('check', 14), 'Přidat'),
      !blk && h('span.faint', { style: { fontSize: '12px' } }, 'Mimo blok — položka se nezapočítá do analýzy bloku.')),
    h('div.hr'));
}

/* =========================================================
   Rytmus týdne
   ========================================================= */
function rhythmCard(entries, blocks, e1rms, variants) {
  const blk = blocks.at(-1);
  const scoped = blk ? entries.filter((e) => e.blockId === blk.id) : entries;
  if (!scoped.length) {
    return card('Rytmus týdne', { eyebrow: 'Frekvence a rozestupy' },
      h('p.note', 'Zatím není co rozebírat.'));
  }

  const freq = C.liftFrequency(scoped, blk?.start ?? scoped[0].date);
  const spacing = C.heavySpacing(scoped, e1rms, { variants });
  const tight = spacing.filter((s) => s.tight > 0);

  return card('Rytmus týdne', {
    eyebrow: blk ? `${blk.name} · frekvence a rozestupy těžkých jednotek` : 'Frekvence a rozestupy',
  },
    table(
      ['Cvik', { label: 'Jedn./týden', num: true }, 'Frekvence', { label: 'Rozestup', num: true }],
      freq.map((f) => {
        const g = C.gradeFrequency(f.perWeek);
        const sp = spacing.find((s) => s.lift === f.lift);
        return {
          tone: g.tone === 'ok' ? 'ok' : 'warn',
          cells: [
            h('span', liftDot(f.lift), LIFTS[f.lift].label),
            { num: true, value: fixed(f.perWeek, 1) },
            tag(g.label, g.tone),
            { num: true, value: sp?.minGap == null ? '—' : `${sp.minGap} ${sp.minGap === 1 ? 'den' : 'dny'}` },
          ],
        };
      })),

    ...tight.map((s) => flagRow({
      tone: 'warn',
      text: `${LIFTS[s.lift].label}: ${s.tight}× jsou dvě těžké jednotky (nad 85 % maxima) den po dni. `
        + 'To je skoro vždycky plánovací chyba — přetáhni jednu z nich v kalendáři na jiný den.',
    })),

    !tight.length && spacing.length > 0 && flagRow({
      tone: 'ok',
      text: 'Těžké jednotky téhož cviku nejdou po sobě — rozestupy dávají prostor na regeneraci.',
    }),

    h('p.note',
      'Dvě až tři jednotky týdně na soutěžní cvik jsou frekvence, na které stojí většina programů, které něco '
      + 'dokázaly. Není to změřená optimální hodnota — je to pásmo, ve kterém se ta praxe pohybuje.'),

    h('p.note', { style: { color: 'var(--ink-3)' } },
      'U rozestupů appka žádnou hranici netvrdí, protože publikovaná neexistuje. Ukazuje skutečné mezery, '
      + 'aby byla vidět ta jednodenní, která tam většinou být neměla.'));
}

/* =========================================================
   Co je před námi
   ========================================================= */
function upcomingCard(entries, meets, today, render) {
  const future = [...new Set(entries.filter((e) => e.date >= today).map((e) => e.date))].sort().slice(0, 6);
  const nextMeet = meets.filter((m) => m.date >= today).sort((a, b) => a.date.localeCompare(b.date))[0];
  const missing = [...new Set(entries.filter((e) => e.date < today && e.actualRpe == null).map((e) => e.date))].sort().slice(-4);

  return card('Co je před námi', { eyebrow: 'Nejbližší jednotky a nezapsané tréninky' },
    nextMeet && flagRow({
      tone: 'low',
      text: `Závod ${nextMeet.name ?? ''} za ${C.daysBetween(today, nextMeet.date)} dnů (${longDate(nextMeet.date)}).`,
    }),

    future.length
      ? h('div', { style: { display: 'flex', flexDirection: 'column', gap: '4px' } },
          ...future.map((d) => {
            const sum = C.sessionSummary(S.dayEntries(d), {});
            const inDays = C.daysBetween(today, d);
            return h('button.btn.btn-ghost', {
              style: { justifyContent: 'flex-start', width: '100%' },
              onclick: () => { st.selected = d; st.month = d.slice(0, 7); render(); },
            },
              h('span', { style: { minWidth: '110px', textAlign: 'left' } }, inDays === 0 ? 'dnes' : inDays === 1 ? 'zítra' : `za ${inDays} dnů`),
              h('span.faint', { style: { minWidth: '92px', textAlign: 'left' } }, weekday(d).split(' ')[0]),
              h('span', ...sum.lifts.slice(0, 3).map((l) => liftDot(l.lift))),
              h('span.faint.mono', { style: { marginLeft: 'auto', fontSize: '11.5px' } }, `${sum.sets}×`));
          }))
      : h('p.note', 'Do budoucna není nic naplánováno.'),

    missing.length > 0 && flagRow({
      tone: 'warn',
      text: `${missing.length} ${missing.length === 1 ? 'proběhlá jednotka nemá' : 'proběhlých jednotek nemá'} zapsanou skutečnost `
        + `(naposledy ${missing.at(-1)}). Bez zápisu neběží odchylka RPE ani model únavy.`,
    }));
}
