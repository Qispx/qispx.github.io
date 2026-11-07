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
})();
