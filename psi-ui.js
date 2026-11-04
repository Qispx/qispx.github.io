/* psi-ui.js — additive UI layer. Reads the DOM your other scripts render; never writes to your data.
   Load after gym.js. Features: global search, collapsible sidebar, accessibility sync. */
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
})();
