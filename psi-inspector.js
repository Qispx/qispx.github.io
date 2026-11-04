/* psi-inspector.js — selection inspector for the Calendar view. Load after psi-ui.js.
   Clicking a calendar chip opens details beside the calendar; clicking another chip updates it.
   Uses script.js globals (homework, saveHomework, renderHomework, ...); changes nothing in your files. */
(() => {
  'use strict';
  if (typeof homework === 'undefined' || typeof window.jumpToHomeworkItem !== 'function') return;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const esc = escapeHtml;
  const originalJump = window.jumpToHomeworkItem;

  const panel = document.createElement('aside');
  panel.className = 'inspector';
  panel.id = 'inspector';
  panel.hidden = true;
  panel.setAttribute('role', 'complementary');
  panel.setAttribute('aria-label', 'Item details');
  document.body.append(panel);

  let selId = null;
  let confirmingDelete = false;
  const calendarActive = () => !!$('#view-calendar')?.classList.contains('active');
  const current = () => homework.find(h => h.id === selId);

  // v3.js chips call jumpToHomeworkItem(id). In the calendar that now selects; elsewhere behaviour is unchanged.
  window.jumpToHomeworkItem = id => { if (calendarActive()) select(id); else originalJump(id); };

  const chipTitle = h => `${h.name} (${h.className}${h.type ? ` · ${typeLabel[h.type] || ''}` : ''})`;
  function markChips() {
    const h = current();
    $$('#calendar-grid .calendar-chip').forEach(c => {
      const on = !!h && c.title === chipTitle(h);
      c.classList.toggle('is-selected', on);
      c.setAttribute('aria-pressed', String(on));
    });
  }
  const grid = $('#calendar-grid');
  if (grid) new MutationObserver(markChips).observe(grid, { childList: true });   // calendar re-renders keep the selection

  function select(id) {
    selId = id; confirmingDelete = false;
    render();
    document.body.classList.add('inspector-open');
    panel.hidden = false;
    $('#inspector-title', panel)?.focus({ preventScroll: true });
  }
  function close() {
    selId = null; confirmingDelete = false;
    panel.hidden = true;
    document.body.classList.remove('inspector-open');
    markChips();
  }

  function render() {
    const h = current();
    if (!h) return close();
    const today = getTodayDateString();
    const diff = daysUntil(h.dueDate, today);
    const overdue = !h.done && diff < 0;
    const p = computePriority(h.dueDate, h.density);
    const density = DENSITIES.includes(h.density) ? h.density : 'moderate';
    panel.innerHTML = `
      <div class="inspector-head">
        <h2 id="inspector-title" tabindex="-1">${esc(h.name)}</h2>
        <button type="button" class="secondary-button inspector-close" data-i="close" aria-label="Close details">&times;</button>
      </div>
      <p class="inspector-sub">${esc(h.className)} · ${esc(typeLabel[h.type] || 'Assignment')}</p>
      <div class="inspector-badges">
        ${h.done ? '<span class="day-pill">Completed</span>' : ''}
        ${overdue ? '<span class="homework-badge overdue">Overdue</span>' : ''}
        <span class="homework-badge ${p}">Priority: ${priorityLabel[p]}</span>
      </div>
      <dl class="inspector-rows">
        <div><dt>Due</dt><dd>${esc(formatDueDate(h.dueDate))}<small>${esc(relativeDueLabel(diff))}</small></dd></div>
        <div><dt>Work density</dt><dd>${densityLabel[density]}</dd></div>
      </dl>
      <label class="inspector-field">Due date
        <input type="date" class="i-due" value="${esc(h.dueDate)}">
      </label>
      <div class="inspector-field">
        <span class="inspector-label" id="i-density-label">Work density</span>
        <div class="mode-switcher" role="group" aria-labelledby="i-density-label">
          ${DENSITIES.map(d => `<button type="button" class="mode-button${d === density ? ' active' : ''}" data-i="density" data-v="${d}" aria-pressed="${d === density}">${densityLabel[d]}</button>`).join('')}
        </div>
      </div>
      <label class="inspector-check"><input type="checkbox" class="i-done"${h.done ? ' checked' : ''}> Mark complete</label>
      ${confirmingDelete
        ? `<div class="inspector-confirm" role="alertdialog" aria-label="Confirm delete"><p>Delete “${esc(h.name)}”? This can’t be undone.</p>
             <div class="inspector-actions"><button type="button" class="danger-button inspector-del" data-i="del-yes">Delete</button><button type="button" class="secondary-button" data-i="del-no">Cancel</button></div></div>`
        : `<div class="inspector-actions"><button type="button" class="secondary-button" data-i="track">Show in tracker</button><button type="button" class="danger-button" data-i="del">Delete</button></div>`}`;
    markChips();
  }

  const commit = () => { saveHomework(); renderHomework(); render(); };   // renderHomework also refreshes the calendar

  panel.addEventListener('click', e => {
    const b = e.target.closest('[data-i]'); if (!b) return;
    const h = current(); if (!h && b.dataset.i !== 'close') return close();
    switch (b.dataset.i) {
      case 'close': close(); break;
      case 'density': h.density = b.dataset.v; commit(); break;
      case 'track': { const id = h.id; close(); originalJump(id); break; }
      case 'del': confirmingDelete = true; render(); $('.inspector-del', panel)?.focus(); break;
      case 'del-no': confirmingDelete = false; render(); break;
      case 'del-yes': homework.splice(homework.indexOf(h), 1); saveHomework(); close(); renderHomework(); break;
    }
  });
  panel.addEventListener('change', e => {
    const h = current(); if (!h) return;
    if (e.target.matches('.i-done')) { h.done = e.target.checked; if (h.done) recordDailyActivity(); commit(); }
    else if (e.target.matches('.i-due') && e.target.value) { h.dueDate = e.target.value; commit(); }
  });

  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && !panel.hidden && e.target.id !== 'psi-search' && !$('dialog[open]')) close();
  });
  const calView = $('#view-calendar');
  if (calView) new MutationObserver(() => { if (!calendarActive() && !panel.hidden) close(); }).observe(calView, { attributes: true, attributeFilter: ['class'] });
})();
