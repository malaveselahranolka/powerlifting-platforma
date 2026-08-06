import { h, card, icon, num, bigNum, tag, select, clear } from '../ui.js';
import { lineChart, stackedBars } from '../charts.js';
import * as S from '../store.js';
import * as C from '../calc.js';
import { LIFTS, COMP_LIFTS } from '../data.js';
import { W, U, liftName, empty } from './_util.js';

/**
 * Grafy.
 *
 * Analýza bloku a Plán vs. realita odpovídají na otázku „je to v pořádku"
 * — čísla, pásma, hodnocení. Tahle sekce odpovídá na jinou: „jaký to má
 * tvar". Všechno je křivka přes celý blok, všechno jde rozdělit po cvicích
 * a nikde není verdikt. Trenér, který chce vidět, že objem tři týdny roste
 * a čtvrtý padá, to má poznat z obrázku, ne z tabulky osmnácti čísel.
 *
 * Volba bloku a zapnutých cviků je společná pro všechny tři záložky —
 * kdo si zapne jen dřep, nechce si ho zapínat znovu po přepnutí na maxima.
 * Drží se v paměti modulu, ne v úložišti: je to nastavení pohledu,
 * ne data závodníka.
 */

const ALL_LIFTS = [...COMP_LIFTS, 'accessory'];

const st = {
  blockId: null,
  lifts: new Set(COMP_LIFTS),
};

/* ---------------------------------------------------------
   Společný základ
   --------------------------------------------------------- */

const weekOf = (date, start) => Math.max(1, Math.floor(C.daysBetween(start, date) / 7) + 1);

const weekLabel = (w) => `T${num(w, 0)}`;

/**
 * Rozdělí položky do týdnů bloku a z každého týdne spočítá jedno číslo.
 * Týdny, ze kterých nevyjde nic (reduce vrátí null), z grafu vypadnou —
 * spojnice přes chybějící týden by lhala, že se v něm něco dělo.
 */
function weekly(entries, start, reduce) {
  const buckets = new Map();
  for (const e of entries) {
    const w = weekOf(e.date, start);
    if (!buckets.has(w)) buckets.set(w, []);
    buckets.get(w).push(e);
  }
  return [...buckets.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([w, list]) => ({ x: w, value: reduce(list) }))
    .filter((p) => p.value != null && Number.isFinite(p.value));
}

/** Jedna řada na cvik — jen ze zapnutých cviků a jen když má co kreslit. */
function liftSeries(entries, start, reduce, { lifts = chosen() } = {}) {
  return lifts
    .map((k) => ({
      color: LIFTS[k].color,
      label: LIFTS[k].label,
      points: weekly(entries.filter((e) => e.lift === k), start, reduce),
    }))
    .filter((sr) => sr.points.length > 1);
}

const chosen = () => ALL_LIFTS.filter((k) => st.lifts.has(k));

/** Kontext obrazovky — svěřenec, vybraný blok a jeho položky. */
function ctx() {
  const a = S.athlete();
  if (!a) return { a: null };
  const blocks = S.athleteBlocks(a.id);
  const blk = blocks.find((b) => b.id === st.blockId) ?? S.block() ?? blocks.at(-1) ?? null;
  return {
    a,
    blocks,
    blk,
    entries: blk ? S.blockEntries(blk.id) : [],
    e1rms: S.blockE1rm(blk, a),
    variants: S.athleteVariants(a),
  };
}

/* ---------------------------------------------------------
   Lišta voleb
   --------------------------------------------------------- */

function controls({ blocks, blk }, render) {
  const toggle = (k) => {
    // poslední zapnutý cvik nejde zhasnout — prázdný graf není volba
    if (st.lifts.has(k) && st.lifts.size > 1) st.lifts.delete(k);
    else st.lifts.add(k);
    render();
  };

  return h('div.gbar',
    blocks.length > 1 && h('label.gbar-field',
      h('span.gbar-label', 'Blok'),
      select(blocks.map((b) => ({ value: b.id, label: `${b.name} · ${b.weeks} týdnů` })), {
        value: blk?.id,
        onchange: (e) => { st.blockId = e.target.value; render(); },
      })),

    h('div.gbar-field',
      h('span.gbar-label', 'Cviky'),
      h('div.chips', ...ALL_LIFTS.map((k) => h('button.chip', {
        type: 'button',
        'aria-pressed': String(st.lifts.has(k)),
        style: { '--chip': LIFTS[k].color },
        onclick: () => toggle(k),
      }, h('i'), LIFTS[k].label)))));
}

/**
 * Legenda pod grafem. Referenční řada má v legendě čárkovaný proužek,
 * ne plný čtvereček — jinak by legenda tvrdila, že je to naměřená řada
 * jako každá jiná.
 */
const legend = (series) => h('div.split-legend',
  ...series.map((sr) => h('div.split-item',
    sr.dash
      ? h('i.is-ref', { style: { '--ref': sr.color } })
      : h('i', { style: { background: sr.color } }),
    h('span.split-name', sr.label))));

/**
 * Poměr stran grafu.
 *
 * SVG se roztáhne na šířku karty, takže výška plyne z viewBoxu — bez
 * předvoleb vyjde graf přes celou šířku vysoký přes půl obrazovky
 * a křivka se v něm ztratí.
 *
 * Na úzké obrazovce se viewBox musí zúžit, i když karta je užší: popisky
 * os mají pevnou velikost ve vnitřních jednotkách, takže se zmenšují spolu
 * s grafem. Sloupec 1000 jednotek vykreslený na 330 px udělá z desetibodového
 * písma tři body — šedou kaši, ze které se hodnota nepřečte.
 */
const narrow = () => typeof matchMedia === 'function' && matchMedia('(max-width: 900px)').matches;

const WIDE = () => (narrow() ? { width: 360, height: 240 } : { width: 1000, height: 250 });
const HALF = () => (narrow() ? { width: 360, height: 240 } : { width: 560, height: 200 });

/**
 * Graf se společnou obsluhou prázdného stavu.
 * Kreslit rám a osy kolem jediného bodu je horší než říct, že data chybí.
 */
function chart(series, opts, emptyText) {
  if (!series.length) return h('div.chart-empty', emptyText);
  return h('div', lineChart(series, { ...WIDE(), ...opts }), legend(series));
}

/** Obal každé záložky — svěřenec, blok, lišta voleb, obsah. */
function screen(nav, body) {
  const root = h('div.view');
  const render = () => {
    clear(root);
    const c = ctx();

    if (!c.a) {
      root.append(empty('Nejdřív si založ svěřence.',
        h('button.btn.btn-primary', { onclick: () => nav('athletes') }, 'Přidat svěřence')));
      return;
    }
    if (!c.blk || !c.entries.length) {
      root.append(empty('Tenhle svěřenec zatím nemá blok s jednotkami — grafy nemají z čeho růst.',
        h('button.btn.btn-primary', { onclick: () => nav('program') }, 'Postavit blok')));
      return;
    }

    root.append(controls(c, render));
    body(root, c, render, nav);
  };
  render();
  return root;
}

/* =========================================================
   Objem
   ========================================================= */

export function volumeView(nav) {
  return screen(nav, (root, { blk, entries, e1rms, variants }) => {
    const start = blk.start;

    const tonnage = liftSeries(entries, start,
      (list) => S.toDisplay(list.reduce((s, e) => s + C.tonnage(e), 0)));

    root.append(card('Tonáž po týdnech', {
      eyebrow: `Série × opakování × váha · ${U()}`,
    },
      chart(tonnage, { yZero: true, xFmt: weekLabel, unit: U(), fmt: (v) => bigNum(v) },
        'Vyber aspoň jeden cvik, který má v bloku víc než jeden týden.'),
      h('p.note', 'Tonáž říká, kolik práce se odvedlo — ne jak byla těžká. Rostoucí křivka při klesající intenzitě znamená víc lehčí práce, ne tvrdší blok.')));

    /* ---- objem po jednotlivých cvicích, doplňky včetně ---- */
    root.append(card('Objem po cvicích', {
      eyebrow: 'Každý cvik zvlášť, doplňky podle jména',
    },
      exerciseGrid(entries, start)));

    /* ---- tvrdé série a počet zvedů ----
       Tvrdé série počítá calc.hardSets, ne vlastní smyčka: Analýza bloku
       kreslí totéž a dvě čísla se stejným jménem se nesmí rozejít. */
    const hardByWeek = C.hardSets(entries, e1rms, start, variants);
    const hard = chosen()
      .map((k) => ({
        color: LIFTS[k].color,
        label: LIFTS[k].label,
        points: hardByWeek.map((w) => ({ x: w.week, value: w.lifts[k] ?? 0 })),
      }))
      .filter((sr) => sr.points.length > 1 && sr.points.some((p) => p.value > 0));

    const reps = liftSeries(entries, start,
      (list) => list.reduce((s, e) => s + C.nl(e), 0));

    root.append(h('div.grid.g2',
      card('Tvrdé série po týdnech', { eyebrow: 'Série, které skutečně stály za adaptaci' },
        chart(hard, { ...HALF(), yZero: true, xFmt: weekLabel, fmt: (v) => num(v, 0) },
          'Žádná série ve vybraných cvicích nepřekročila práh tvrdé série.')),

      card('Počet zvedů po týdnech', { eyebrow: 'Série × opakování, bez ohledu na váhu' },
        chart(reps, { ...HALF(), yZero: true, xFmt: weekLabel, fmt: (v) => num(v, 0) },
          'Málo dat na graf.'))));
  });
}

/**
 * Malé grafy pro každý cvik zvlášť.
 *
 * Tohle v appce chybělo: doplňky se všude počítaly dohromady jako
 * „doplňkový cvik", takže nebylo vidět, že veslování jede tři týdny
 * v kuse a hyperextenze vypadly po prvním. Tady má každý cvik svoje
 * jméno, svoji křivku a svůj podíl na objemu.
 */
function exerciseGrid(entries, start) {
  const groups = new Map();
  for (const e of entries) {
    if (!st.lifts.has(e.lift)) continue;
    const name = liftName(e);
    if (!groups.has(name)) groups.set(name, { name, lift: e.lift, list: [] });
    groups.get(name).list.push(e);
  }

  const all = [...groups.values()]
    .map((g) => ({
      ...g,
      tonnage: g.list.reduce((s, e) => s + C.tonnage(e), 0),
      weeks: new Set(g.list.map((e) => weekOf(e.date, start))).size,
      points: weekly(g.list, start, (l) => S.toDisplay(l.reduce((s, e) => s + C.tonnage(e), 0))),
    }))
    .sort((x, y) => y.tonnage - x.tonnage);

  if (!all.length) return h('div.chart-empty', 'Vyber aspoň jeden cvik.');

  const total = all.reduce((s, g) => s + g.tonnage, 0);

  return h('div.grid.g3',
    ...all.map((g) => h('div.mini',
      h('div.mini-head',
        h('i.mini-dot', { style: { background: LIFTS[g.lift].color } }),
        h('span.mini-name', { title: g.name }, g.name)),
      h('div.mini-num', W(g.tonnage, 0), h('small', U())),
      h('div.mini-sub', `${num((g.tonnage / total) * 100, 1)} % objemu · ${g.weeks} ${g.weeks === 1 ? 'týden' : g.weeks < 5 ? 'týdny' : 'týdnů'}`),
      g.points.length > 1
        ? lineChart([{ color: LIFTS[g.lift].color, label: g.name, points: g.points }], {
            width: 300, height: 76, bare: true, yZero: true,
            xFmt: weekLabel, unit: U(), fmt: (v) => bigNum(v),
          })
        : h('div.mini-flat', 'Jen jeden týden — není co kreslit.'))));
}

/* =========================================================
   Intenzita a RPE
   ========================================================= */

export function intensityView(nav) {
  return screen(nav, (root, { blk, entries, e1rms, variants }) => {
    const start = blk.start;

    /* průměrná intenzita, vážená počtem opakování — prostý průměr přes
       série by dal stejnou váhu jedné trojce jako deseti opakováním */
    const avgInt = liftSeries(entries, start, (list) => {
      let sum = 0;
      let reps = 0;
      for (const e of list) {
        const e1 = C.entryE1rm(e, e1rms, variants);
        if (!(e1 > 0)) continue;
        const r = C.nl(e);
        sum += C.intensity(e, e1) * r;
        reps += r;
      }
      return reps ? sum / reps : null;
    });

    const peakInt = liftSeries(entries, start, (list) => {
      const vals = list
        .map((e) => C.intensity(e, C.entryE1rm(e, e1rms, variants)))
        .filter((v) => v > 0);
      return vals.length ? Math.max(...vals) : null;
    });

    root.append(h('div.grid.g2',
      card('Průměrná intenzita po týdnech', { eyebrow: '% z maxima, vážené počtem opakování' },
        chart(avgInt, { ...HALF(), xFmt: weekLabel, unit: '%', fmt: (v) => num(v, 0) },
          'Vybrané cviky nemají známé maximum, ze kterého by šla intenzita spočítat.')),

      card('Špičková intenzita po týdnech', { eyebrow: 'Nejtěžší série v týdnu' },
        chart(peakInt, { ...HALF(), xFmt: weekLabel, unit: '%', fmt: (v) => num(v, 0) },
          'Vybrané cviky nemají známé maximum.'))));

    /* ---- RPE: skutečnost proti plánu ---- */
    const drift = liftSeries(entries, start, (list) => {
      const diffs = list
        .filter((e) => e.actualRpe != null && e.rpe != null)
        .map((e) => e.actualRpe - e.rpe);
      return diffs.length ? diffs.reduce((s, d) => s + d, 0) / diffs.length : null;
    });

    const logged = entries.filter((e) => e.actualRpe != null).length;

    root.append(card('RPE: skutečnost proti plánu', {
      eyebrow: 'Kladná hodnota = série byla těžší, než měla být',
    },
      drift.length
        ? (() => {
            const xs = drift.flatMap((sr) => sr.points.map((p) => p.x));
            // nulová osa jako referenční řada — s ní je vidět, kde je „podle plánu"
            const zero = {
              color: 'var(--steel)', label: 'Podle plánu', dash: true, area: false,
              points: [{ x: Math.min(...xs), value: 0 }, { x: Math.max(...xs), value: 0 }],
            };
            return h('div',
              lineChart([...drift, zero], { ...WIDE(), xFmt: weekLabel, fmt: (v) => (v > 0 ? `+${num(v, 1)}` : num(v, 1)) }),
              legend([...drift, zero]),
              h('p.note', 'Když stejný plán jede týden co týden na vyšší RPE, hromadí se únava — i když váhy na papíře sedí. Křivka pod nulou znamená, že plán je moc lehký.'));
          })()
        : h('div.chart-empty', logged
            ? 'Zapsané RPE zatím nemá u vybraných cviků protějšek v plánu.'
            : 'Zatím není zapsané žádné skutečné RPE. Doplň ho v Plán vs. realita.')));

    /* ---- rozložení intenzit po pásmech ---- */
    const picked = entries.filter((e) => st.lifts.has(e.lift));
    const hist = C.intensityHistogram(picked, e1rms, { variants });

    root.append(card('Rozložení intenzit', {
      eyebrow: 'Kolik opakování padlo do kterého pětiprocentního pásma',
      class: 'is-flush',
    },
      hist
        ? h('div', { style: { padding: '0 24px 24px' } },
            stackedBars(
              hist.rows.map((r) => ({ label: `${r.from}`, values: { reps: r.reps } })),
              [{ key: 'reps', label: 'Zvedy', color: 'var(--zone-3)' }],
              { fmt: (v) => num(v, 0) }),
            h('p.note', { style: { marginTop: '16px' } },
              `${num(hist.mainBandPct, 0)} % zvedů leží v hlavním pásmu ${hist.norm.mainBand[0]}–${hist.norm.mainBand[1]} %. Popisky na ose jsou spodní hranice pásma.`))
        : h('div.chart-empty', 'Vybrané cviky nemají známé maximum.')));
  });
}

/* =========================================================
   Maxima
   ========================================================= */

/**
 * Odhad maxima z každé jednotky, se skutečnými datumy.
 *
 * Slouží jako podklad pro typickou chybu měření — ta se počítá z rozptylu
 * kolem trendu, takže potřebuje víc než čtyři body a potřebuje je v čase,
 * ne v pořadí týdnů.
 */
function sessionEstimates(entries, lift) {
  const rows = entries.filter((e) => e.lift === lift);
  return [...new Set(rows.map((e) => e.date))]
    .sort()
    .map((date) => ({ date, value: C.sessionE1rm(rows.filter((e) => e.date === date))?.weighted }))
    .filter((p) => p.value != null);
}

/**
 * Verdikt nad posunem. Rozlišuje tři situace, které se nesmí slít:
 * rozdíl je prokazatelný, rozdíl se vejde do šumu, nebo je zápisů tak
 * málo, že se o šumu nedá říct nic. „Nevím" je poctivější než „v pořádku".
 */
function changeTag(verdict, noise) {
  if (!verdict) return tag('Málo zápisů na rozhodnutí', 'low');
  if (verdict.direction === 'flat') return tag('Beze změny', 'low');
  if (!verdict.real) return tag(`V pásmu šumu (± ${num(noise.sdc, 1)})`, 'low');
  return verdict.direction === 'up'
    ? tag('Prokazatelný posun', 'ok')
    : tag('Prokazatelný propad', 'bad');
}

export function maxView(nav) {
  return screen(nav, (root, { a, blk, entries, e1rms }) => {
    const start = blk.start;
    const lifts = chosen().filter((k) => k !== 'accessory');

    /* Vážený odhad maxima z odvedených sérií, týden po týdnu. Váží se
       převrácenou rozptylem: série na RPE 9 o třech opakováních říká
       o maximu víc než osmička na deseti. */
    const est = lifts
      .map((k) => ({
        lift: k,
        color: LIFTS[k].color,
        label: LIFTS[k].label,
        points: weekly(entries.filter((e) => e.lift === k), start,
          (list) => S.toDisplay(C.sessionE1rm(list)?.weighted ?? NaN)),
      }))
      .filter((sr) => sr.points.length > 1);

    /* Plán jako čárkovaná čára — ale jen u jednoho cviku. Šest čar
       přes sebe se nepřečte a graf by přestal odpovídat na otázku. */
    const single = est.length === 1 ? est[0].lift : null;
    const planLine = single && e1rms[single] > 0
      ? [{
          color: 'var(--steel)', label: 'Maximum, ze kterého blok počítá', dash: true, area: false,
          points: [
            { x: est[0].points[0].x, value: S.toDisplay(e1rms[single]) },
            { x: est[0].points.at(-1).x, value: S.toDisplay(e1rms[single]) },
          ],
        }]
      : [];

    root.append(card('Odhad maxima z odvedených sérií', {
      eyebrow: `Vážený odhad podle skutečného RPE · ${U()}`,
    },
      est.length
        ? h('div',
            lineChart([...est, ...planLine], { ...WIDE(), xFmt: weekLabel, unit: U(), fmt: (v) => num(v, 0) }),
            legend([...est, ...planLine]),
            h('p.note', single
              ? 'Čárkovaná čára je maximum, ze kterého blok počítal váhy. Křivka pod ní znamená, že plán je postavený na čísle, které závodník právě neuzvedne.'
              : 'Vyber jeden cvik, ať se ukáže i maximum, ze kterého blok počítal váhy.'))
        : h('div.chart-empty', 'Bez zapsaného skutečného RPE se odhad maxima ze sérií nedá spočítat. Doplň ho v Plán vs. realita.')));

    /* ---- posun za blok, se signálem proti šumu ----
       Rozdíl se bere z týdenních bodů, aby seděl s grafem nad tím.
       Šum se ale počítá z jednotlivých jednotek: typická chyba odhadu
       maxima je vlastnost měření, ne týdne, a ze čtyř týdenních čísel
       ji spolehlivě odhadnout nejde. */
    root.append(card('Posun za blok', {
      eyebrow: 'První a poslední týden — a jestli je rozdíl prokazatelný',
    },
      est.length
        ? h('div.grid.g3', ...est.map((sr) => {
            const from = sr.points[0].value;
            const to = sr.points.at(-1).value;
            const delta = to - from;
            const noise = C.measurementNoise(sessionEstimates(entries, sr.lift));
            const verdict = C.isRealChange(from, to, noise);
            return h('div.stat',
              h('div.stat-label', sr.label),
              h('div.stat-value', `${delta > 0 ? '+' : delta < 0 ? '−' : ''}${num(Math.abs(delta), 1)}`, h('span.stat-unit', U())),
              h('div.faint.mono', { style: { fontSize: '11px' } }, `${num(from, 0)} → ${num(to, 0)} ${U()}`),
              h('div', { style: { marginTop: '4px' } }, changeTag(verdict, noise)));
          }))
        : h('div.chart-empty', 'Zatím není z čeho posun počítat.')));

    /* ---- zapsaná maxima v čase, přes celou historii ---- */
    const log = (S.state.e1rmLog ?? []).filter((x) => x.athleteId === a.id);
    const history = lifts
      .map((k) => ({
        color: LIFTS[k].color,
        label: LIFTS[k].label,
        points: log.filter((x) => x.lift === k)
          .sort((x, y) => x.date.localeCompare(y.date))
          .map((x) => ({ date: x.date, value: S.toDisplay(x.value) })),
      }))
      .filter((sr) => sr.points.length > 1);

    root.append(card('Zapsaná maxima v čase', {
      eyebrow: 'Celá historie, ne jen tenhle blok',
      action: h('button.btn.btn-sm', { onclick: () => nav('athletes') }, icon('plus', 13), 'Zapsat maximum'),
    },
      history.length
        ? h('div',
            lineChart(history, { ...WIDE(), unit: U(), fmt: (v) => num(v, 0) }),
            legend(history))
        : h('div.chart-empty', 'Zapiš aspoň dvě maxima na cvik, ať je co kreslit.')));
  });
}
