// Cloudová synchronizace přes Supabase REST. Žádná závislost, žádný backend —
// prohlížeč mluví přímo s databází závodníka. Funguje i na statickém hostingu
// jako GitHub Pages.
//
// Konfigurace (URL projektu + veřejný anon klíč + sync kód) leží v localStorage
// odděleně od tréninkových dat, takže záloha/obnova dat ji nepřepíše.

const KEY = 'pwr.cloud';

let pushTimer = null;
let statusListeners = new Set();

/* ---------------------------------------------------------
   Konfigurace
   --------------------------------------------------------- */
export function config() {
  try {
    return JSON.parse(localStorage.getItem(KEY)) ?? null;
  } catch {
    return null;
  }
}

export const enabled = () => {
  const c = config();
  return !!(c && c.url && c.key && c.syncId);
};

export function setConfig(cfg) {
  localStorage.setItem(KEY, JSON.stringify(cfg));
  emit('config');
}

export function disable() {
  localStorage.removeItem(KEY);
  emit('config');
}

/** Náhodný, prakticky neuhodnutelný sync kód. */
export function newSyncId() {
  if (crypto?.randomUUID) return crypto.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

/* ---------------------------------------------------------
   Stav pro UI
   --------------------------------------------------------- */
let lastStatus = { state: 'idle', at: null, error: null };

export const status = () => lastStatus;

export function onStatus(fn) {
  statusListeners.add(fn);
  return () => statusListeners.delete(fn);
}

function emit(kind) {
  for (const fn of statusListeners) fn(kind, lastStatus);
}

function setStatus(state, error = null) {
  lastStatus = { state, at: Date.now(), error };
  emit('status');
}

/* ---------------------------------------------------------
   REST volání
   --------------------------------------------------------- */
function headers(c) {
  return {
    apikey: c.key,
    Authorization: `Bearer ${c.key}`,
    'Content-Type': 'application/json',
  };
}

const base = (c) => `${c.url.replace(/\/+$/, '')}/rest/v1/sync`;

/** Ověří, že URL a klíč fungují a tabulka existuje. Vrací { ok, error }. */
export async function testConnection(url, key) {
  try {
    const res = await fetch(`${url.replace(/\/+$/, '')}/rest/v1/sync?select=id&limit=1`, {
      headers: { apikey: key, Authorization: `Bearer ${key}` },
    });
    if (res.ok) return { ok: true };
    if (res.status === 404) return { ok: false, error: 'Tabulka „sync" neexistuje — spusť v Supabase přiložený SQL.' };
    if (res.status === 401) return { ok: false, error: 'Neplatný anon klíč.' };
    return { ok: false, error: `Server vrátil ${res.status}.` };
  } catch {
    return { ok: false, error: 'Nepodařilo se připojit — zkontroluj URL projektu.' };
  }
}

/** Nahraje celý stav (řetězec JSON). */
export async function pushNow(json) {
  const c = config();
  if (!enabled()) return { ok: false };
  setStatus('pushing');
  const updated = new Date().toISOString();
  try {
    const res = await fetch(base(c), {
      method: 'POST',
      headers: { ...headers(c), Prefer: 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify({ id: c.syncId, data: JSON.parse(json), updated_at: updated }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    setConfigQuiet({ ...c, cloudUpdatedAt: updated });
    setStatus('synced');
    return { ok: true, updated };
  } catch (e) {
    setStatus('error', String(e.message || e));
    return { ok: false, error: String(e.message || e) };
  }
}

/** Stáhne stav z cloudu. Vrací { data, updated_at } nebo null. */
export async function pull() {
  const c = config();
  if (!enabled()) return null;
  try {
    const res = await fetch(`${base(c)}?id=eq.${c.syncId}&select=data,updated_at`, { headers: headers(c) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const rows = await res.json();
    return rows[0] ?? null;
  } catch (e) {
    setStatus('error', String(e.message || e));
    return null;
  }
}

/** Zapíše konfiguraci bez notifikace — kvůli internímu ukládání timestampu. */
function setConfigQuiet(cfg) {
  localStorage.setItem(KEY, JSON.stringify(cfg));
}

/* ---------------------------------------------------------
   Naplánovaný push — po každé změně, ale sloučený
   --------------------------------------------------------- */
export function schedulePush(getJson) {
  if (!enabled()) return;
  clearTimeout(pushTimer);
  setStatus('pending');
  pushTimer = setTimeout(() => pushNow(getJson()), 1200);
}

/* ---------------------------------------------------------
   Start aplikace — stáhnout, pokud je cloud novější
   --------------------------------------------------------- */
export async function bootstrap(storageKey) {
  if (!enabled()) return { pulled: false };
  const c = config();
  setStatus('pulling');
  const remote = await pull();
  if (!remote) { setStatus(enabled() ? 'synced' : 'idle'); return { pulled: false }; }

  const localUpdated = c.cloudUpdatedAt ?? '';
  const remoteNewer = !localUpdated || remote.updated_at > localUpdated;

  if (remoteNewer && remote.data && Array.isArray(remote.data.athletes)) {
    localStorage.setItem(storageKey, JSON.stringify(remote.data));
    setConfigQuiet({ ...c, cloudUpdatedAt: remote.updated_at });
    setStatus('synced');
    return { pulled: true };
  }
  setStatus('synced');
  return { pulled: false };
}
