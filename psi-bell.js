/* psi-bell.js — the official Palumbo bell schedule: import, A/B rotation, date overrides, "which schedule applies today?".
   Loads BEFORE script.js (script.js asks it questions while it starts up). Pure logic: no DOM work here except events.
   The settings panel lives in psi-ui.js.

   DATA, kept in separate places on purpose
     schedules         imported definitions + period times       PSI_BELL.schedules            (cache: localStorage "psi-bell-cache")
     weeklySchedule    default weekday -> schedule, from sheet   PSI_BELL.weeklySchedule
     rotationCalendar  A-Day / B-Day dates, non-school ranges    data.bell.rotation            (the person's own data)
     dateOverrides     special events, manual assignments        data.bell.overrides           (the person's own data)
     activeSchedule    what applies on a date                    PSI_BELL.resolve(dateKey)     (computed, never stored)
     previewSchedule   what the schedule page is showing         previewSchedule in script.js  (UI state only)

   WHICH SCHEDULE APPLIES (first match wins)
     1. date override      data.bell.overrides["2026-11-06"]
     2. A/B assignment     the rotation says this date is an A or B day, and that letter has a schedule assigned
     3. weekday default    the sheet's Monday..Sunday mapping
     4. fallback           the legacy "bell mode" (Normal Day unless the person chose otherwise); also used when nothing loaded
   A date the person marked "no school" (or that sits in a non-school range) is closed unless an override says otherwise.
   Schedule ids: "normal" | "hour" | "dayoff" (built from the person's own classes, as before) or "imp:<slug>" (imported). */
(() => {
  "use strict";
  const URL_SOURCE = "https://docs.google.com/spreadsheets/d/e/2PACX-1vSSweZd1mlWsT5TMHvbP5_jiOSHPt0aMkNJSGQnxTQJ-s7w_Zy4IISvXpnuJlF-XdyJ6wkeKWM2isSL/pub?gid=583549147&single=true&output=tsv";
  const TZ = "America/New_York";               // the school's time zone; every date and time here is read in it
  const CACHE_KEY = "psi-bell-cache";
  const REFRESH_OK = 30 * 60e3, REFRESH_FAIL = 5 * 60e3, FETCH_TIMEOUT = 10e3;
  const WEEK = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
  const BUILTIN = { normal: "Normal Bell Page", hour: "1 Hour Bell", dayoff: "Day Off" };

  /* ---------- Dates in the school's time zone ---------- */
  const fmt = new Intl.DateTimeFormat("en-US", { timeZone: TZ, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", weekday: "long" });
  /* { key: "2026-11-04", weekday: "Wednesday", sec: seconds since local midnight } for an instant */
  function schoolParts(date = new Date()) {
    const p = {};
    for (const x of fmt.formatToParts(date)) p[x.type] = x.value;
    return { key: `${p.year}-${p.month}-${p.day}`, weekday: p.weekday, sec: (+p.hour % 24) * 3600 + +p.minute * 60 + +p.second };
  }
  const utc = key => { const [y, m, d] = key.split("-").map(Number); return Date.UTC(y, m - 1, d); };
  const keyOf = ms => new Date(ms).toISOString().slice(0, 10);
  const addDays = (key, n) => keyOf(utc(key) + n * 86400000);
  const weekdayOf = key => ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][new Date(utc(key)).getUTCDay()];
  const isKey = s => typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s) && keyOf(utc(s)) === s;

  /* ---------- The fixed periods ----------
     Periods are the school day's structure: WHEN things happen. The classes a person adds say WHAT happens in them.
     Before School and After School have no official time; whatever is assigned to them keeps its own times. */
  const PERIODS = [
    { id: "before", label: "Before School" }, { id: "advisory", label: "Advisory" },
    ...[1, 2, 3, 4, 5, 6, 7].map(n => ({ id: `p${n}`, label: `${n}${["st", "nd", "rd"][n - 1] || "th"} Period` })),
    { id: "after", label: "After School" }
  ];
  const PERIOD_IDS = PERIODS.map(p => p.id), isPeriod = id => PERIOD_IDS.includes(id);
  const periodLabel = id => PERIODS.find(p => p.id === id)?.label || "";
  const ORDINALS = { first: 1, second: 2, third: 3, fourth: 4, fifth: 5, sixth: 6, seventh: 7 };
  /* "Period 3", "3rd Period", "Pd 3", "Block 3", "P3", "3", "Third period", "Advisory", "Homeroom": the period id, or null.
     Anything else ("Lunch", "Block 4A", "Assembly") is not guessed at. */
  function periodIdFromName(name) {
    const t = String(name || "").toLowerCase().trim();
    if (!t) return null;
    if (/^(advisory|advisor|homeroom|adv|home room)\b/.test(t)) return "advisory";
    if (/^before[\s-]*school/.test(t)) return "before";
    if (/^after[\s-]*school/.test(t)) return "after";
    let m = t.match(/^(?:period|per|pd|p|block|class)?[\s.#-]*([1-7])(?:st|nd|rd|th)?(?:[\s.-]*(?:period|per|pd|block|class))?$/);
    if (m) return `p${m[1]}`;
    m = t.match(/^(first|second|third|fourth|fifth|sixth|seventh)(?:[\s-]+(?:period|block|class))?$/);
    return m ? `p${ORDINALS[m[1]]}` : null;
  }

  /* ---------- Reading the sheet ---------- */
  const slug = s => String(s).toLowerCase().replace(/&/g, " and ").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  const hm = n => `${String(Math.floor(n / 60)).padStart(2, "0")}:${String(n % 60).padStart(2, "0")}`;
  /* Same reading as the official Bell Page (and the tested prototype): column 0 holds labels and is dropped, and empty cells
     are skipped, so a row becomes the list of its filled cells. */
  const cells = row => { const c = String(row || "").replace(/[\r\n]/g, "").split("\t"); c[0] = ""; return c.map(v => v.trim()).filter(v => v !== ""); };
  /* Row 0: seven schedule indexes, Monday..Sunday. Then repeating five-row blocks:
       1 schedule text (its name)   2 schedule title (period names)   3 table header   4 next-event info   5 period times
     Times are minutes since midnight, in start/end pairs. Anything malformed (non-numeric, end before start, past 24:00, a
     lone start) is dropped and counted in `warnings`; a sheet with no usable schedule at all throws, so the last good copy stays. */
  function parseSchedules(tsv) {
    const rows = String(tsv).replace(/^\uFEFF/, "").replace(/\r/g, "").split("\n");
    const index = (rows[0] || "").split("\t").slice(0, 7).map(v => { const n = Number.parseInt(v, 10); return Number.isNaN(n) ? null : n; });
    while (index.length < 7) index.push(null);
    const used = new Set(), schedules = [], warnings = [];
    for (let i = 1; i + 4 < rows.length; i += 5) {
      const n = schedules.length, title = cells(rows[i + 1]), head = cells(rows[i + 2]), next = cells(rows[i + 3]);
      const times = cells(rows[i + 4]).map(Number);
      const name = cells(rows[i])[0] || `Unnamed schedule ${n}`;
      const periods = [];
      for (let k = 0; k < times.length; k += 2) {
        const s = times[k], e = times[k + 1];
        if (!Number.isFinite(s) || !Number.isFinite(e) || s < 0 || e > 1440 || e <= s) { warnings.push(`${name}: period ${k / 2 + 1} has unusable times and was skipped.`); continue; }
        periods.push({ name: title[k] || head[k / 2] || `Block ${k / 2 + 1}`, start: hm(s), end: hm(e), note: next[k] || "" });
      }
      periods.sort((a, b) => a.start.localeCompare(b.start));
      let id = slug(name) || `schedule-${n}`;
      while (used.has(id)) id += `-${n}`;
      used.add(id);
      schedules.push({ id: `imp:${id}`, block: n, name, periods });
    }
    if (!schedules.length) throw new Error("No five-row schedule blocks were found. The published sheet format may have changed.");
    if (!schedules.some(s => s.periods.length)) throw new Error("The sheet has schedules but none with usable period times.");
    const weekly = {};
    WEEK.forEach((d, k) => { weekly[d] = Number.isInteger(index[k]) && schedules[index[k]] ? schedules[index[k]].id : null; });
    return { schedules, weekly, warnings, rows: rows.filter(r => r.trim()).length };
  }

  /* ---------- Imported data, cache, refresh ---------- */
  const store = {
    get() { try { return JSON.parse(localStorage.getItem(CACHE_KEY)); } catch { return null; } },
    set(v) { try { localStorage.setItem(CACHE_KEY, JSON.stringify(v)); } catch { /* storage full or blocked: keep working from memory */ } }
  };
  const bell = { schedules: [], weeklySchedule: {}, warnings: [], rows: 0, status: { ok: null, at: 0, error: "", fromCache: false, tried: 0 }, cfgGet: () => null };
  let tsvNow = "", inflight = null, version = 0;
  const emit = name => { try { window.dispatchEvent(new CustomEvent(name)); } catch { /* no window (tests) */ } };
  function adopt(tsv) { const p = parseSchedules(tsv); bell.schedules = p.schedules; bell.weeklySchedule = p.weekly; bell.warnings = p.warnings; bell.rows = p.rows; tsvNow = tsv; version++; return p; }
  (function loadCache() {
    const c = store.get();
    if (c && typeof c.tsv === "string") { try { adopt(c.tsv); bell.status = { ...bell.status, ok: true, at: c.at || 0, fromCache: true, tried: c.at || 0 }; /* a fresh cache needs no request yet */ } catch { /* a bad cache is ignored; the next fetch replaces it */ } }
  })();

  async function refresh(force) {
    if (inflight) return inflight;
    const s = bell.status;
    const age = Date.now() - s.tried;   // a negative age (the device clock moved back) counts as stale, never as fresh
    if (!force && s.tried && age >= 0 && age < (s.ok === false ? REFRESH_FAIL : REFRESH_OK)) return;
    s.tried = Date.now();
    inflight = (async () => {
      const ctl = typeof AbortController === "function" ? new AbortController() : null, timer = setTimeout(() => ctl && ctl.abort(), FETCH_TIMEOUT);
      try {
        const r = await fetch(api.url, { cache: "no-store", ...(ctl ? { signal: ctl.signal } : {}) });
        if (!r.ok) throw new Error(`The schedule sheet answered ${r.status}.`);
        const tsv = await r.text();
        if (tsv !== tsvNow) { adopt(tsv); store.set({ tsv, at: Date.now() }); }   // an identical sheet changes nothing and rebuilds nothing
        else store.set({ tsv, at: Date.now() });
        bell.status = { ok: true, at: Date.now(), error: "", fromCache: false, tried: s.tried };
      } catch (e) {
        // Keep whatever loaded last time (cache or memory). Only the status changes.
        bell.status = { ...bell.status, ok: false, error: e && e.name === "AbortError" ? "The schedule sheet took too long to answer." : String((e && e.message) || e), tried: s.tried };
      } finally { clearTimeout(timer); inflight = null; emit("psi:bell-updated"); }
    })();
    return inflight;
  }
  /* Called from the once-a-second heartbeat: a timestamp comparison, and a request only when the data is due (and the tab is visible). */
  function maybeRefresh() { if (typeof document === "undefined" || !document.hidden) refresh(false); }

  /* ---------- The person's configuration: A/B rotation and overrides ---------- */
  function normalizeConfig(c) {
    c = c && typeof c === "object" ? c : {}; const r = c.rotation && typeof c.rotation === "object" ? c.rotation : {};
    const letter = v => v === "B" ? "B" : "A";
    const dates = {}; for (const [k, v] of Object.entries(r.dates && typeof r.dates === "object" ? r.dates : {})) if (isKey(k) && ["A", "B", "X"].includes(v)) dates[k] = v;
    const overrides = {}; for (const [k, v] of Object.entries(c.overrides && typeof c.overrides === "object" ? c.overrides : {})) if (isKey(k) && typeof v === "string" && v) overrides[k] = v;
    return {
      ab: { A: typeof c.ab?.A === "string" ? c.ab.A : "", B: typeof c.ab?.B === "string" ? c.ab.B : "" },
      rotation: {
        anchor: { date: isKey(r.anchor?.date) ? r.anchor.date : "", letter: letter(r.anchor?.letter) },
        closed: (Array.isArray(r.closed) ? r.closed : []).filter(x => x && isKey(x.start) && isKey(x.end) && x.start <= x.end).map(x => ({ start: x.start, end: x.end, label: String(x.label ?? "").slice(0, 60) })),
        dates
      },
      overrides,
      periodMap: Object.fromEntries(Object.entries(c.periodMap && typeof c.periodMap === "object" ? c.periodMap : {}).filter(([k, v]) => k && (v === "" || PERIODS.some(p => p.id === v))))
    };
  }
  const cfg = () => bell.cfgGet() || normalizeConfig(null);
  const memo = new Map(); let memoFor = null;
  /* Rotation facts for one date: { letter: "A"|"B"|null, closed: bool, label }.
     School days are Monday-Friday that are not closed. The letter alternates once per SCHOOL day counted from the nearest
     known point (the anchor, or any date the person assigned explicitly), so weekends and closures never advance it.
     With no anchor and no assigned dates there is no letter: nothing is invented. */
  function rotationFor(key) {
    const c = cfg().rotation, sig = `${version}|${JSON.stringify(c)}`;
    if (memoFor !== sig) { memo.clear(); memoFor = sig; }
    if (memo.has(key)) return memo.get(key);
    const closedRange = k => c.closed.find(x => k >= x.start && k <= x.end);
    const isSchool = k => { const w = weekdayOf(k); return w !== "Saturday" && w !== "Sunday" && !closedRange(k) && c.dates[k] !== "X"; };
    let out;
    if (c.dates[key] === "X") out = { letter: null, closed: true, label: "No school" };
    else if (c.dates[key]) out = { letter: c.dates[key], closed: false, label: "" };
    else if (closedRange(key)) out = { letter: null, closed: true, label: closedRange(key).label || "No school" };
    else if (!isSchool(key)) out = { letter: null, closed: false, label: "" };
    else {
      const pts = Object.entries(c.dates).filter(([, v]) => v !== "X").map(([date, letter]) => ({ date, letter }));
      if (c.anchor.date) pts.push({ date: c.anchor.date, letter: c.anchor.letter });
      // Follow the latest known point on or before the date; a date before every known point counts back from the first one.
      const known = pts.map(p => p.date).sort();
      const before = known.filter(d => d <= key).pop(), pick = before || known[0];
      const best = pick && { p: pts.find(p => p.date === pick), d: Math.abs(utc(pick) - utc(key)) };
      if (!best || best.d > 800 * 86400000) out = { letter: null, closed: false, label: "" };   // no anchor, or too far away to trust
      else {
        const a = best.p; let n = 0;
        const [lo, hi] = a.date < key ? [addDays(a.date, 1), key] : [key, addDays(a.date, -1)];
        for (let k = lo; k <= hi; k = addDays(k, 1)) if (isSchool(k)) n++;
        out = { letter: n % 2 ? (a.letter === "A" ? "B" : "A") : a.letter, closed: false, label: "" };
      }
    }
    memo.set(key, out);
    return out;
  }

  const byId = id => bell.schedules.find(s => s.id === id) || null;
  const valid = (id, legacy) => id === "none" || id in BUILTIN || !!byId(id);
  /* Which schedule applies on a date. { id, source: "override"|"rotation"|"weekday"|"fallback", letter, closed, label }
     id is null when nothing is in session that day (closed, or the schedule has no periods). */
  function resolve(key, legacyMode = "normal") {
    const c = cfg(), rot = rotationFor(key), wd = weekdayOf(key);
    const done = (id, source, extra = {}) => {
      const sch = byId(id);
      const closed = id === "none" || (sch && !sch.periods.length) || !!extra.closed;
      return { id: closed ? null : id, source, letter: rot.letter, closed, label: extra.label || (id === "none" ? "No school" : ""), ...(closed && !extra.label && sch ? { label: sch.name } : {}) };
    };
    const ov = c.overrides[key];
    if (ov && valid(ov)) return done(ov, "override");
    if (rot.closed) return done("none", "rotation", { label: rot.label });
    if (rot.letter && c.ab[rot.letter] && valid(c.ab[rot.letter])) return done(c.ab[rot.letter], "rotation");
    const w = bell.weeklySchedule[wd];
    if (w && byId(w)) return done(w, "weekday");
    return done(legacyMode in BUILTIN ? legacyMode : "normal", "fallback");
  }
  const nameOf = id => BUILTIN[id] || byId(id)?.name || (id === "none" ? "No school" : "Unknown schedule");
  /* Imported period list for an id, or null for the built-in (class-based) schedules */
  const periodsOf = id => byId(id)?.periods || null;

  /* Built-in schedule ids that have an official counterpart in the sheet: viewing "Normal Bell Page" shows the real Normal Day times */
  const ALIAS = { normal: /^normal/i, hour: /(^|\W)1[\s-]*hour/i, dayoff: /day[\s-]*off/i };
  const sourceFor = id => byId(id) || (ALIAS[id] ? bell.schedules.find(s => s.periods.length && ALIAS[id].test(s.name)) || null : null);
  let timingMemo = new Map(), timingSig = "";
  /* Where each fixed period falls in a schedule, from the sheet: { byPeriod: { p3: { start, end, name } }, unmapped: [names], assumed, source }.
     Mapping is by period NAME (plus the person's own corrections, cfg.periodMap). Only if no name at all could be read, a sheet with exactly
     7 or 8 periods is taken in order (8 = Advisory + 1st..7th) and marked `assumed` so the settings can show and fix it.
     null when the schedule has no usable official timing: the person's own class times are used instead. */
  function timing(id) {
    const sig = `${version}|${JSON.stringify(cfg().periodMap)}`;
    if (sig !== timingSig) { timingMemo = new Map(); timingSig = sig; }
    if (timingMemo.has(id)) return timingMemo.get(id);
    const pm = cfg().periodMap;
    const raw = src => {
      if (!src || !src.periods.length) return null;
      const by = {}, extras = []; let assumed = false;
      const place = (p, pid) => { if (pid && !by[pid]) by[pid] = { start: p.start, end: p.end, name: p.name }; else extras.push({ name: p.name, start: p.start, end: p.end }); };
      const own = src.periods.map(p => { const k = slug(p.name); return k in pm ? pm[k] || null : periodIdFromName(p.name); });
      if (own.some(Boolean) || Object.keys(pm).length) src.periods.forEach((p, i) => place(p, own[i]));
      else if (src.periods.length === 8 || src.periods.length === 7) {
        assumed = true;
        const ids = src.periods.length === 8 ? ["advisory", "p1", "p2", "p3", "p4", "p5", "p6", "p7"] : ["p1", "p2", "p3", "p4", "p5", "p6", "p7"];
        src.periods.forEach((p, i) => place(p, ids[i]));
      } else src.periods.forEach(p => extras.push({ name: p.name, start: p.start, end: p.end }));
      return { byPeriod: by, extras, unmapped: extras.map(e => e.name), assumed, source: src.id };
    };
    let out = raw(sourceFor(id));
    /* A schedule whose names map to no period is still shown as the sheet lists it (Assembly, Parade...), but only if some other
       schedule does map: if NOTHING in the sheet maps, official timing is not used at all and classes keep their own times. */
    if (out && !Object.keys(out.byPeriod).length && !bell.schedules.some(x => { const r = raw(x); return r && Object.keys(r.byPeriod).length; })) out = null;
    timingMemo.set(id, out);
    return out;
  }

  const api = {
    url: URL_SOURCE, tz: TZ, BUILTIN, WEEK,
    get schedules() { return bell.schedules; }, get weeklySchedule() { return bell.weeklySchedule; }, get status() { return bell.status; }, get warnings() { return bell.warnings; }, get rows() { return bell.rows; },
    schoolParts, addDays, weekdayOf, isKey,
    PERIODS, isPeriod, periodLabel, periodIdFromName, timing, slug,
    parseSchedules, normalizeConfig,
    rotationFor, resolve, nameOf, periodsOf, schedule: byId, isValid: valid,
    refresh, maybeRefresh,
    /* script.js hands over where the saved configuration lives; this file never touches the main storage itself */
    bind(getter) { bell.cfgGet = getter; memo.clear(); },
    /* tests and diagnostics only */
    _load(tsv) { adopt(tsv); }
  };
  Object.defineProperty(api, "url", { get: () => bell.url || URL_SOURCE, set: v => { bell.url = v; } });
  window.PSI_BELL = api;
})();
