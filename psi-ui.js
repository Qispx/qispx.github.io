/* psi-ui.js — additive UI layer. Reads the DOM your other scripts render; never writes to your data.
   Load after gym.js. Features: global search, collapsible sidebar, accessibility sync, theme preference, Up Next card. */
(() => {
  'use strict';
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const store = {
    get(k) { try { return localStorage.getItem(k); } catch { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch { /* storage unavailable */ } }
  };

  /* ---------- Sidebar collapse ---------- */
  const toggle = $('#sidebar-collapse');
  function setCollapsed(collapsed, remember) {
    document.body.classList.toggle('nav-collapsed', collapsed);
    if (!toggle) return;
    toggle.setAttribute('aria-expanded', String(!collapsed));
    const label = collapsed ? 'Expand sidebar' : 'Collapse sidebar';
    toggle.setAttribute('aria-label', label);
    toggle.title = label;
    if (remember) store.set('psi-nav-collapsed', collapsed ? '1' : '0');
  }
  if (toggle) {
    const saved = store.get('psi-nav-collapsed');
    // Tablet and phone widths start collapsed unless the person has chosen otherwise.
    setCollapsed(saved !== null ? saved === '1' : window.innerWidth < 1100, false);
    toggle.addEventListener('click', () =>
      setCollapsed(!document.body.classList.contains('nav-collapsed'), true));
  }

  /* ---------- Search ---------- */
  const input = $('#psi-search');
  const clearBtn = $('#psi-search-clear');
  const status = $('#psi-search-status');
  const content = $('.content');
  const GROUPS = [
    ['Priorities', '.priority-item'],
    ['Classes', '.schedule-item, .saved-class'],
    ['Tasks', '.task-item'],
    ['Homework', '.homework-item'],
    ['Calendar', '.calendar-chip'],
    ['GPA courses', '.course-item'],
    ['Workouts', '.gym-wrow, .gym-chk'],
    ['College', '.col-card']
  ];
  const ITEM_SELECTOR = GROUPS.map(g => g[1]).join(',');
  const labelFor = el => (GROUPS.find(g => el.matches(g[1])) || [''])[0];
  let query = '';

  function applyFilter() {
    const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
    const searching = terms.length > 0;
    document.body.classList.toggle('searching', searching);
    const items = $$(ITEM_SELECTOR);
    items.forEach(el => { el.hidden = false; });          // reset first so visibility can be measured
    const counts = {};
    let total = 0;
    items.forEach(el => {
      const hay = (el.textContent + ' ' + (el.getAttribute('title') || '')).toLowerCase();
      const hit = !searching || terms.every(t => hay.includes(t));
      if (!hit) { el.hidden = true; return; }
      if (!searching) return;
      // Count only matches the person can actually see in the current view.
      const view = el.closest('.view');
      if ((!view || view.classList.contains('active')) && el.getClientRects().length) {
        total++;
        const g = labelFor(el);
        counts[g] = (counts[g] || 0) + 1;
      }
    });
    if (!status) return;
    if (!searching) status.textContent = '';
    else if (!total) status.textContent = `No matches for “${query.trim()}” in this view`;
    else status.textContent = `${total} match${total === 1 ? '' : 'es'} · ` +
      Object.entries(counts).map(([g, n]) => `${n} ${g}`).join(', ');
    status.title = status.textContent;
  }

  if (input) {
    let timer;
    input.addEventListener('input', () => {
      query = input.value;
      if (clearBtn) clearBtn.hidden = !query;
      clearTimeout(timer); timer = setTimeout(applyFilter, 120);
    });
    const clear = () => {
      input.value = ''; query = '';
      if (clearBtn) clearBtn.hidden = true;
      applyFilter();
      input.focus();
    };
    if (clearBtn) clearBtn.addEventListener('click', clear);
    input.addEventListener('keydown', e => { if (e.key === 'Escape' && input.value) { e.preventDefault(); clear(); } });
    document.addEventListener('keydown', e => {
      const tag = (e.target.tagName || '').toLowerCase();
      const typing = tag === 'input' || tag === 'textarea' || tag === 'select' || e.target.isContentEditable;
      if (e.key === '/' && !typing && !e.metaKey && !e.ctrlKey && !e.altKey) { e.preventDefault(); input.focus(); }
    });

    // script.js rebuilds the class list every second and v3.js swaps whole views, so the filter is re-applied
    // synchronously from the observer (before the browser paints) to avoid hidden rows flashing back.
    // Clock, date and the search bar itself are ignored; the filter only writes the `hidden` attribute,
    // which is not observed, so it cannot trigger itself.
    if (content) {
      new MutationObserver(muts => {
        if (!query) return;
        const relevant = muts.some(m => {
          const t = m.target.nodeType === 1 ? m.target : m.target.parentElement;
          return !t || !t.closest('#clock, #priority-date, .search-wrap');
        });
        if (relevant) applyFilter();
      }).observe(content, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });
    }
  }

  /* ---------- Accessibility sync ---------- */
  const track = $('#priority-workload-track');
  const fill = $('#priority-workload-bar');
  if (track && fill) {
    const sync = () => {
      const w = fill.style.width;
      if (w && w.endsWith('%')) track.setAttribute('aria-valuenow', String(Math.round(parseFloat(w))));
    };
    new MutationObserver(sync).observe(fill, { attributes: true, attributeFilter: ['style'] });
    sync();
  }

  // v3.js rewrites the sidebar links per view and marks one .active; expose that to assistive tech.
  const sidebar = $('#sidebar');
  const syncNav = () => $$('.sidebar a').forEach(a => {
    if (a.classList.contains('active')) a.setAttribute('aria-current', 'true');
    else a.removeAttribute('aria-current');
  });
  if (sidebar) {
    new MutationObserver(syncNav).observe(sidebar, { attributes: true, childList: true, subtree: true, attributeFilter: ['class'] });
    syncNav();
  }

  // The dock is the primary navigation: mark the current view for assistive tech too.
  const dock = $('.dock');
  if (dock) {
    const syncDock = () => $$('[data-view]', dock).forEach(b => {
      if (b.classList.contains('active')) b.setAttribute('aria-current', 'page');
      else b.removeAttribute('aria-current');
    });
    new MutationObserver(syncDock).observe(dock, { attributes: true, subtree: true, attributeFilter: ['class'] });
    syncDock();
  }

  // Disclosure headers: keyboard-operable and announce state (skipped if already focusable).
  $$('.dropdown-header, .quarter-section h3').forEach(h => {
    if (h.hasAttribute('tabindex') || h.onkeydown) return;
    const section = h.parentElement;
    h.setAttribute('role', 'button');
    h.setAttribute('tabindex', '0');
    const reflect = () => h.setAttribute('aria-expanded', String(section.classList.contains('expanded')));
    reflect();
    new MutationObserver(reflect).observe(section, { attributes: true, attributeFilter: ['class'] });
    h.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); h.click(); }
    });
  });

  /* ---------- Theme: System / Light / Dark ----------
     The CSS does the work: no attribute follows the OS (so an OS change applies live, no JS needed), and
     data-theme="light|dark" overrides it. A tiny inline script in <head> applies a saved choice before first paint. */
  const THEME_KEY = 'psi-theme';
  const root = document.documentElement;
  const themeButtons = $$('[data-theme-mode]');
  const themeMetas = $$('meta[name="theme-color"]');
  const themeMetaDefaults = themeMetas.map(m => m.content);
  const savedTheme = () => { const t = store.get(THEME_KEY); return t === 'light' || t === 'dark' ? t : 'system'; };

  let themeAnim = 0;
  function applyTheme(mode, remember) {
    if (remember) {   // a person's click crossfades the colours once; first paint and OS changes don't animate
      root.classList.add('theme-anim');
      clearTimeout(themeAnim);
      themeAnim = setTimeout(() => root.classList.remove('theme-anim'), 260);
    }
    if (mode === 'system') delete root.dataset.theme; else root.dataset.theme = mode;
    themeButtons.forEach(b => {
      const on = b.dataset.themeMode === mode;
      b.classList.toggle('on', on);
      b.setAttribute('aria-pressed', String(on));
    });
    // Browser chrome colour: an explicit choice overrides both media-specific metas; System restores them.
    const bg = getComputedStyle(root).getPropertyValue('--bg').trim();
    themeMetas.forEach((m, i) => { m.content = mode === 'system' || !bg ? themeMetaDefaults[i] : bg; });
    if (remember) store.set(THEME_KEY, mode);
  }
  if (themeButtons.length) {
    applyTheme(savedTheme(), false);
    themeButtons.forEach(b => b.addEventListener('click', () => applyTheme(b.dataset.themeMode, true)));
  }

  /* ---------- Up Next card (dashboard) ----------
     Renders whatever script.js's getScheduleState() says. Same object as the tab title and the schedule list,
     delivered once a second by updateTimeRemaining() as a "psi:schedule-tick" event. No timer of its own. */
  const hero = $('.dashboard-hero');
  if (hero && typeof getScheduleState === 'function') {
    const card = document.createElement('section');
    card.className = 'ui-panel next-class';
    card.id = 'next-class';
    card.setAttribute('aria-labelledby', 'nc-eyebrow');
    card.innerHTML = `<div class="nc-main"><p class="nc-eyebrow" id="nc-eyebrow"></p><p class="nc-name"></p><p class="nc-meta"></p></div>
      <div class="nc-count"><b></b><span></span><button type="button" class="secondary-button" data-view="builder" hidden>Open Schedule Builder</button></div>`;
    hero.after(card);
    const part = sel => $(sel, card);
    const span = c => `${formatStoredTime(c.startTime)}–${formatStoredTime(c.endTime)}`;
    const withTeacher = c => span(c) + (classMeta(c) ? ` · ${classMeta(c)}` : '');
    const laterText = st => st.later
      ? `Next: ${st.later.offset === 1 ? 'Tomorrow' : st.later.dayName} at ${formatStoredTime(st.later.cls.startTime)} · ${st.later.cls.name}`
      : 'No classes scheduled in the next 7 days.';
    let last = '', prevV = [];

    const render = st => {
      let v;   // [eyebrow, name, meta, big number, label, state class, show builder button]
      switch (st.status) {
        case 'in-class':
          v = ['Now', st.current.name, withTeacher(st.current) + (st.next ? ` · Then ${st.next.name} at ${formatStoredTime(st.next.startTime)}` : ' · Last class today'),
               formatRemaining(st.left), 'remaining', 'is-now']; break;
        case 'upcoming':
          v = ['Up next', st.next.name, withTeacher(st.next), formatRemaining(st.toNext), 'until start', '']; break;
        case 'done':
          v = ['Today', 'No more classes today', `All of today’s classes have ended. ${laterText(st)}`, '', '', 'is-idle']; break;
        case 'none-today':
          v = ['Today', 'No classes today', laterText(st), '', '', 'is-idle']; break;
        default:
          v = ['Up next', 'No schedule yet', 'Add your classes in the Schedule Builder to see what’s next.', '', '', '', true];
      }
      const key = v.join('|');
      if (key === last) return;           // nothing changed since the last tick
      // While a class runs only the big number changes each second: write just the fields that differ.
      const prev = prevV;
      prevV = v;
      last = key;
      const put = (i, sel) => { if (prev[i] !== v[i]) part(sel).textContent = v[i]; };
      const hide = (sel, h) => { const el = part(sel); if (el.hidden !== h) el.hidden = h; };
      put(0, '.nc-eyebrow'); put(1, '.nc-name'); put(2, '.nc-meta'); put(3, '.nc-count b'); put(4, '.nc-count span');
      hide('.nc-count b', !v[3]); hide('.nc-count span', !v[3]);
      hide('.nc-count button', !v[6]);
      hide('.nc-count', !v[3] && !v[6]);
      card.classList.toggle('is-now', v[5] === 'is-now');
      card.classList.toggle('is-idle', v[5] === 'is-idle');
    };
    window.addEventListener('psi:schedule-tick', e => render(e.detail));
    render(getScheduleState());   // script.js's first tick ran before this file loaded
  }

  /* ---------- Official bell schedule: status line, preview, settings ----------
     The schedule page tabs PREVIEW a schedule; "Today" marks the one that is actually active. The settings panel (Schedule
     Builder page) edits the person's A/B rotation, non-school dates and date overrides, which live in data.bell, apart from the
     imported sheet. All decisions are made in psi-bell.js / script.js; this is only the controls. */
  {
    const B = window.PSI_BELL, esc = escapeHtml;
    const stamp = ms => ms ? new Date(ms).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : 'never';
    const opts = (sel, extra = '') => `${extra}<optgroup label="Schedules">${Object.entries(B.BUILTIN).map(([k, v]) => `<option value="${k}"${sel === k ? ' selected' : ''}>${v}</option>`).join('')}</optgroup>` +
      (B.schedules.some(s => !B.tabFor(s.id)) ? `<optgroup label="Official sheet">${B.schedules.filter(s => !B.tabFor(s.id)).map(s => `<option value="${esc(s.id)}"${sel === s.id ? ' selected' : ''}>${esc(s.name)}</option>`).join('')}</optgroup>` : '');
    const fmt12 = hm => { const [h, m] = hm.split(':').map(Number); return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`; };
    const letterName = l => l ? `${l}-Day` : '';

    // 1. "More schedules" select next to the tabs (imported schedules that have no tab). Previewing never changes today's schedule.
    const sw = $('#class-schedule .mode-switcher');
    if (sw) {
      sw.insertAdjacentHTML('beforeend', '<select class="bell-more" id="bell-more" aria-label="More schedules from the official sheet" hidden></select>');
      $('#bell-more').addEventListener('change', e => { if (e.target.value) setBellMode(e.target.value); });
    }
    let lastStatus = '';
    const renderStatus = () => {
      const more = $('#bell-more'); if (!more) return;
      const a = activeFor(todayKey()), view = viewSchedule();
      const rest = B.schedules.filter(s => !B.tabFor(s.id));   // Normal Day, 1 Hour and No School/Day Off are the three tabs
      const key = [a.id, view, rest.map(s => s.id).join(',')].join('|');
      if (key === lastStatus) return; lastStatus = key;
      more.hidden = !rest.length;
      more.innerHTML = '<option value="">More schedules…</option>' + rest.map(s => `<option value="${esc(s.id)}"${view === s.id ? ' selected' : ''}>${esc(s.name)}${a.id === s.id ? ' · today' : ''}</option>`).join('');
      more.classList.toggle('active', B.isValid(view) && !B.tabFor(view));
    };
    window.addEventListener('psi:schedule-tick', renderStatus);
    window.addEventListener('psi:preview-changed', renderStatus);
    window.addEventListener('psi:bell-updated', () => { lastStatus = ''; renderStatus(); renderSettings(); });

    // 3. Settings panel on the Schedule Builder page
    const editor = $('#schedule-editor');
    let panel = null;
    if (editor) {
      editor.insertAdjacentHTML('afterend', '<section class="ui-panel bell-panel" id="bell-official" aria-labelledby="bell-official-h"></section>');
      panel = $('#bell-official');
    }
    const save = () => { saveData(); updateTimeRemaining(); syncModeButtons(); lastStatus = ''; renderStatus(); renderSettings(); };
    function renderSettings() {
      if (!panel) return;
      const open = new Set([...panel.querySelectorAll('details[open]')].map(d => d.dataset.k));
      const c = data.bell, st = B.status, today = todayKey(), rot = B.rotationFor(today);
      // every distinct period name in the sheet, with the fixed period it currently maps to (the person's correction wins, else the name)
      const eff = {}; B.schedules.forEach(x => { const t = B.timing(x.id); if (t) Object.values(t.byPeriod).forEach(v => { }); if (t) Object.entries(t.byPeriod).forEach(([pid, v]) => { if (!(v.name in eff)) eff[v.name] = pid; }); });
      const pmap = [...new Set(B.schedules.flatMap(x => x.periods.map(p => p.name)))].map(n => [n, eff[n] || '']);
      const list = (items, empty) => items.length ? `<div class="bell-list">${items.join('')}</div>` : `<p class="bell-empty">${empty}</p>`;
      const row = (txt, attr) => `<div class="bell-row"><span>${txt}</span><button type="button" class="danger-button" ${attr}>Remove</button></div>`;
      const sheet = st.ok === false ? `<p class="bell-warn" role="status">Couldn’t reach the school’s sheet (${esc(st.error)}). ${B.schedules.length ? 'Showing the last copy that loaded.' : 'PSI is using your own classes until it loads.'}</p>`
        : st.ok ? `<p class="bell-ok">${B.schedules.length} schedules loaded · checked ${stamp(st.at)}${st.fromCache ? ' (saved copy)' : ''}${B.warnings.length ? ` · ${B.warnings.length} entr${B.warnings.length === 1 ? 'y' : 'ies'} skipped` : ''}</p>` : '<p class="bell-empty">Not loaded yet.</p>';
      panel.innerHTML = `<div class="panel-heading"><div><h2 id="bell-official-h">Official Bell Schedule</h2></div>
        <button type="button" class="secondary-button" data-bell="refresh">Refresh now</button></div>
        <div id="bell-sheet-state">${sheet}</div>
        <details data-k="ab"${open.has('ab') ? ' open' : ''}><summary>A-Day and B-Day</summary>
          <div class="bell-fields">
            <label>A-Day schedule<select data-bell="ab-A"><option value="">None</option>${opts(c.ab.A)}</select></label>
            <label>B-Day schedule<select data-bell="ab-B"><option value="">None</option>${opts(c.ab.B)}</select></label>
          </div>
          <p class="bell-hint">${rot.letter ? `Today is an <b>${letterName(rot.letter)}</b>.` : rot.closed ? 'Today is marked as no school.' : 'Set an anchor date below so PSI knows which days are A and which are B. Nothing is assumed.'}</p></details>
        <details data-k="rot"${open.has('rot') ? ' open' : ''}><summary>Rotation calendar</summary>
          <div class="bell-fields"><label>Anchor date<input type="date" data-bell="anchor-date" value="${esc(c.rotation.anchor.date)}"></label>
            <label>That day is<select data-bell="anchor-letter"><option value="A"${c.rotation.anchor.letter === 'A' ? ' selected' : ''}>A-Day</option><option value="B"${c.rotation.anchor.letter === 'B' ? ' selected' : ''}>B-Day</option></select></label></div>
          <p class="bell-hint">The letter alternates on each school day after the anchor. Weekends and non-school dates never advance it.</p>
          <h3>No school</h3>
          ${list(c.rotation.closed.map((x, i) => row(`${esc(x.label || 'No school')} · ${x.start}${x.end !== x.start ? ' to ' + x.end : ''}`, `data-bell="closed-del" data-i="${i}"`)), 'No closures added.')}
          <div class="bell-fields"><label>From<input type="date" data-bell-f="closed-start"></label><label>To<input type="date" data-bell-f="closed-end"></label>
            <label>Label<input type="text" maxlength="60" data-bell-f="closed-label" placeholder="e.g. Thanksgiving break"></label><button type="button" class="secondary-button" data-bell="closed-add">Add</button></div>
          <h3>Set a single date</h3>
          ${list(Object.entries(c.rotation.dates).sort().map(([d, v]) => row(`${d} · ${v === 'X' ? 'No school' : letterName(v)}`, `data-bell="date-del" data-d="${d}"`)), 'No individual dates set.')}
          <div class="bell-fields"><label>Date<input type="date" data-bell-f="date-d"></label><label>Is<select data-bell-f="date-v"><option value="A">A-Day</option><option value="B">B-Day</option><option value="X">No school</option></select></label>
            <button type="button" class="secondary-button" data-bell="date-add">Add</button></div></details>
        <details data-k="ov"${open.has('ov') ? ' open' : ''}><summary>Special schedules for a date</summary>
          ${list(Object.entries(c.overrides).sort().map(([d, v]) => row(`${d} · ${esc(B.nameOf(v))}${B.isValid(v) ? '' : ' <small>(not in the sheet any more)</small>'}`, `data-bell="ov-del" data-d="${d}"`)), 'No special dates. Pick a date and a schedule, such as a parade day or an assembly.')}
          <div class="bell-fields"><label>Date<input type="date" data-bell-f="ov-d"></label><label>Schedule<select data-bell-f="ov-v">${opts('', '<option value="none">No school</option>')}</select></label>
            <button type="button" class="secondary-button" data-bell="ov-add">Add</button></div></details>
        <details data-k="pm"${open.has('pm') ? ' open' : ''}><summary>Period times</summary>
          ${B.schedules.length ? `<p class="bell-hint">Which of your periods each name in the sheet is. Your classes keep their period; only the times come from the sheet.</p>
          <table class="bell-table"><caption class="sr-only">Sheet period names and the period each one is</caption><tbody>${pmap.map(([name, id]) => `<tr><th scope="row">${esc(name)}</th><td><select data-bell="pmap" data-n="${esc(B.slug(name))}" aria-label="Period for ${esc(name)}"><option value=""${id ? '' : ' selected'}>Not a class period</option>${B.PERIODS.filter(p => p.id !== 'before' && p.id !== 'after').map(p => `<option value="${p.id}"${id === p.id ? ' selected' : ''}>${p.label}</option>`).join('')}</select></td></tr>`).join('')}</tbody></table>` : '<p class="bell-empty">Appears once the sheet has loaded.</p>'}</details>
        <details data-k="src"${open.has('src') ? ' open' : ''}><summary>What the sheet says</summary>
          ${B.schedules.length ? `<table class="bell-table"><caption class="sr-only">Default schedule for each weekday</caption><tbody>${B.WEEK.map(d => `<tr><th scope="row">${d}</th><td>${esc(B.weeklySchedule[d] ? B.nameOf(B.weeklySchedule[d]) : 'None')}</td></tr>`).join('')}</tbody></table>
          <h3>All schedules</h3><div class="bell-list">${B.schedules.map(s => `<div class="bell-sched"><b>${esc(s.name)}</b><small>${s.periods.length ? s.periods.map(p => `${esc(p.name)} ${fmt12(p.start)}–${fmt12(p.end)}`).join(' · ') : 'No periods (no school)'}</small></div>`).join('')}</div>` : '<p class="bell-empty">Nothing loaded yet.</p>'}</details>
        <details data-k="fb"${open.has('fb') ? ' open' : ''}><summary>When nothing else applies</summary>
          <div class="bell-fields"><label>Default schedule<select data-bell="fallback">${Object.entries(B.BUILTIN).map(([k, v]) => `<option value="${k}"${bellMode === k ? ' selected' : ''}>${v}</option>`).join('')}</select></label></div>
          <p class="bell-hint">Used on days with no override, no A/B day and no weekday default from the sheet, or if the sheet can’t be loaded.</p></details>`;
    }
    if (panel) {
      const f = k => panel.querySelector(`[data-bell-f="${k}"]`)?.value || '';
      panel.addEventListener('change', e => {
        const k = e.target.dataset.bell, c = data.bell; if (!k) return;
        if (k === 'ab-A' || k === 'ab-B') { c.ab[k.slice(3)] = e.target.value; save(); }
        else if (k === 'anchor-date') { c.rotation.anchor.date = B.isKey(e.target.value) ? e.target.value : ''; save(); }
        else if (k === 'anchor-letter') { c.rotation.anchor.letter = e.target.value === 'B' ? 'B' : 'A'; save(); }
        else if (k === 'pmap') { panel.querySelectorAll('select[data-bell="pmap"]').forEach(x => { c.periodMap[x.dataset.n] = x.value; }); save(); }   /* the whole table is stored, so an automatic guess never half-applies */
        else if (k === 'fallback') { bellMode = e.target.value; data.bellMode = bellMode; save(); }
      });
      panel.addEventListener('click', e => {
        const b = e.target.closest('button[data-bell]'); if (!b) return;
        const k = b.dataset.bell, c = data.bell;
        if (k === 'refresh') { b.disabled = true; B.refresh(true).finally(() => { b.disabled = false; }); return; }
        if (k === 'closed-add') { const s = f('closed-start'), en = f('closed-end') || s; if (B.isKey(s) && B.isKey(en) && s <= en) { c.rotation.closed.push({ start: s, end: en, label: f('closed-label').trim() }); save(); } else window.psi?.toast?.('Choose a start date (and an end date that is not before it).'); return; }
        if (k === 'closed-del') { c.rotation.closed.splice(+b.dataset.i, 1); save(); return; }
        if (k === 'date-add') { const d = f('date-d'); if (B.isKey(d)) { c.rotation.dates[d] = f('date-v'); save(); } else window.psi?.toast?.('Choose a date.'); return; }
        if (k === 'date-del') { delete c.rotation.dates[b.dataset.d]; save(); return; }
        if (k === 'ov-add') { const d = f('ov-d'), v = f('ov-v'); if (B.isKey(d) && v) { c.overrides[d] = v; save(); } else window.psi?.toast?.('Choose a date and a schedule.'); return; }
        if (k === 'ov-del') { delete c.overrides[b.dataset.d]; save(); }
      });
      renderSettings();
    }
    renderStatus();
  }
})();
