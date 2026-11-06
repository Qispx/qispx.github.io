/* psi-extras.js — dialogs, toasts, homework sorting, GPA/SAT gauges, weather refresh. Load after psi-inspector.js.
   Leaves script.js / v3.js / gym.js untouched. */
(() => {
  'use strict';
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[c]));

  /* ---------- Toasts (replace blocking alert()) ---------- */
  const stack = document.createElement('div');
  stack.className = 'toast-stack';
  stack.setAttribute('aria-live', 'polite');
  document.body.append(stack);
  function toast(msg, kind = 'info') {
    const t = document.createElement('div');
    t.className = `toast ${kind}`;
    t.setAttribute('role', kind === 'warn' ? 'alert' : 'status');
    t.textContent = String(msg);
    t.addEventListener('click', () => t.remove());
    stack.append(t);
    setTimeout(() => t.classList.add('out'), 4500);
    setTimeout(() => t.remove(), 4900);
  }
  // Every alert() in your scripts is a validation message used as `return alert(...)`, so a toast is equivalent.
  window.alert = msg => { toast(msg, 'warn'); };

  /* ---------- Dialog (<dialog> gives focus trapping and Esc for free) ---------- */
  const dlg = document.createElement('dialog');
  dlg.className = 'psi-dialog';
  dlg.setAttribute('aria-labelledby', 'psi-dlg-title');
  document.body.append(dlg);

  function ask({ title, input = false, confirm = 'OK', destructive = false }) {
    return new Promise(resolve => {
      dlg.innerHTML = `<div class="dlg-body">
        <h2 id="psi-dlg-title">${esc(title)}</h2>
        ${input ? `<input type="text" id="psi-dlg-input" maxlength="60" autocomplete="off" aria-label="${esc(title)}">` : ''}
        <div class="dlg-actions">
          <button type="button" class="secondary-button" data-r="cancel">Cancel</button>
          <button type="button" class="${destructive ? 'dlg-danger' : ''}" data-r="ok">${esc(confirm)}</button>
        </div></div>`;
      let result = { ok: false, value: '' };
      const done = ok => { result = { ok, value: $('#psi-dlg-input', dlg)?.value ?? '' }; dlg.close(); };
      dlg.onclick = e => {
        const b = e.target.closest('[data-r]');
        if (b) done(b.dataset.r === 'ok');
        else if (e.target === dlg) done(false);          // click on the backdrop
      };
      dlg.onkeydown = e => { if (e.key === 'Enter' && e.target.id === 'psi-dlg-input') { e.preventDefault(); done(true); } };
      dlg.onclose = () => resolve(result);
      dlg.showModal();
      // Destructive prompts open on Cancel (the first button); text prompts open in the field.
      ($('#psi-dlg-input', dlg) || $('[data-r="cancel"]', dlg)).focus();
    });
  }

  /* confirm()/prompt() are synchronous, so they can't wait for a styled dialog. Instead: the call returns
     "cancelled" at once (all call sites then bail out harmlessly), the dialog opens, and if the person
     accepts, the original click is replayed once with the answer pre-approved. */
  const nativeConfirm = window.confirm.bind(window), nativePrompt = window.prompt.bind(window);
  let lastClick = { target: null, at: 0 };
  let approved = null;
  // Clicks inside the dialog itself must not overwrite the remembered target, or "OK" would replay itself instead of the action.
  document.addEventListener('click', e => { if (!e.target.closest('.psi-dialog')) lastClick = { target: e.target, at: Date.now() }; }, true);
  const fromClick = () => lastClick.target && Date.now() - lastClick.at < 1500;
  function replay(answer) {
    const t = lastClick.target;
    if (!t || !t.isConnected) return;
    approved = answer;
    try { (t.closest('button, a, summary, label') || t).click(); } finally { approved = null; }
  }

  window.confirm = msg => {
    if (approved && approved.type === 'confirm') { approved = null; return true; }
    if (!fromClick()) return nativeConfirm(msg);
    const verb = (String(msg).match(/delete|replace|reset|remove/i) || [''])[0];
    ask({
      title: String(msg),
      confirm: verb ? verb[0].toUpperCase() + verb.slice(1).toLowerCase() : 'Continue',
      destructive: !!verb
    }).then(r => { if (r.ok) replay({ type: 'confirm' }); });
    return false;
  };
  window.prompt = (msg, def) => {
    if (approved && approved.type === 'prompt') { const v = approved.value; approved = null; return v; }
    if (!fromClick()) return nativePrompt(msg, def);
    ask({ title: String(msg), input: true, confirm: 'Save' })
      .then(r => { if (r.ok && r.value.trim()) replay({ type: 'prompt', value: r.value }); });
    return null;
  };

  window.psi = Object.assign(window.psi || {}, { toast, ask });

  /* ---------- Homework sorting ---------- */
  const hwList = $('#homework-list');
  const hwBody = hwList && hwList.parentElement;
  if (hwList && hwBody && typeof homework !== 'undefined' && typeof renderHomework === 'function') {
    const MODES = [['priority', 'Priority'], ['due', 'Due date'], ['class', 'Class'], ['name', 'Name']];
    let mode = 'priority', dir = 1;
    const bar = document.createElement('div');
    bar.className = 'sort-bar';
    bar.innerHTML = `<span id="sort-label">Sort by</span>
      <div class="mode-switcher" role="group" aria-labelledby="sort-label">${MODES.map(([k, l]) =>
        `<button type="button" class="mode-button${k === mode ? ' active' : ''}" data-sort="${k}" aria-pressed="${k === mode}">${l}</button>`).join('')}</div>
      <button type="button" class="secondary-button sort-dir" aria-label="Reverse sort order">&#8593;</button>`;
    hwBody.insertBefore(bar, hwList);
    const dirBtn = $('.sort-dir', bar);
    dirBtn.disabled = true;

    const val = {
      due: h => h.dueDate || '9999-12-31',
      class: h => String(h.className || '').toLowerCase(),
      name: h => String(h.name || '').toLowerCase()
    };
    function applySort() {
      if (mode === 'priority' && dir === 1) return;       // script.js already renders this order
      const rows = $$('.homework-item', hwList);
      if (rows.length < 2) return;
      const byId = new Map(homework.map(h => [String(h.id), h]));
      const key = mode === 'priority' ? val.due : val[mode];
      const sorted = [...rows].sort((a, b) => {
        const ha = byId.get(a.dataset.homeworkId), hb = byId.get(b.dataset.homeworkId);
        if (!ha || !hb) return 0;
        const done = Number(!!ha.done) - Number(!!hb.done);   // completed items always sink
        if (done) return done;
        const A = key(ha), B = key(hb);
        return (A < B ? -1 : A > B ? 1 : val.due(ha).localeCompare(val.due(hb))) * dir;
      });
      // Only touch the DOM when the order actually changes, so the observer below can't loop.
      if (sorted.some((r, i) => r !== rows[i])) sorted.forEach(r => hwList.append(r));
    }
    new MutationObserver(applySort).observe(hwList, { childList: true });
    bar.addEventListener('click', e => {
      const b = e.target.closest('[data-sort]');
      if (b) {
        mode = b.dataset.sort;
        if (mode === 'priority') { dir = 1; dirBtn.innerHTML = '&#8593;'; }
        dirBtn.disabled = mode === 'priority';       // Priority order comes from computePriority(), so it has no direction
        $$('[data-sort]', bar).forEach(x => { x.classList.toggle('active', x === b); x.setAttribute('aria-pressed', String(x === b)); });
      } else if (e.target.closest('.sort-dir')) {
        dir = -dir;
        dirBtn.innerHTML = dir === 1 ? '&#8593;' : '&#8595;';
        dirBtn.setAttribute('aria-label', dir === 1 ? 'Reverse sort order (now ascending)' : 'Reverse sort order (now descending)');
      } else return;
      renderHomework();                                      // re-render restores the base order, then the observer sorts
      if (mode === 'priority' && dir === 1) return;
      applySort();
    });
  }

  /* ---------- Gauges (real values, real ranges) ---------- */
  const adj = typeof classLevelAdjustment !== 'undefined' ? Math.max(...Object.values(classLevelAdjustment)) : 0.8;
  const GAUGES = [
    { src: '#unweighted-gpa', label: 'Unweighted GPA', min: 0, max: 4, fmt: v => v.toFixed(2), scale: ['0', '4.0'], empty: 'No classes yet', hosts: () => [$('#unweighted-gpa')?.closest('h3')] },
    { src: '#weighted-gpa', label: 'Weighted GPA', min: 0, max: 4 + adj, fmt: v => v.toFixed(2), scale: ['0', (4 + adj).toFixed(1)], empty: 'No classes yet', hosts: () => [$('#weighted-gpa')?.closest('h3')] },
    { src: '#sat-composite', label: 'SAT composite', min: 400, max: 1600, fmt: v => String(Math.round(v)), scale: ['400', '1600'], empty: 'No score entered', hosts: () => [$('.sat-composite-heading'), $('.sat-inputs')] }
  ];
  GAUGES.forEach(g => {
    const srcEl = $(g.src); if (!srcEl) return;
    const nodes = [];
    g.hosts().filter(Boolean).forEach(host => {
      const n = document.createElement('div');
      n.className = 'gauge'; n.setAttribute('role', 'meter');
      n.setAttribute('aria-label', g.label);
      n.setAttribute('aria-valuemin', g.min); n.setAttribute('aria-valuemax', g.max);
      n.innerHTML = `<div class="gauge-track"><div class="gauge-fill"></div></div><div class="gauge-scale"><span>${g.scale[0]}</span><span>${g.scale[1]}</span></div>`;
      host.after(n);
      nodes.push(n);
    });
    const update = () => {
      const v = parseFloat(srcEl.textContent);
      const has = Number.isFinite(v) && v >= g.min && v > 0;
      const pct = has ? Math.max(0, Math.min(100, (v - g.min) / (g.max - g.min) * 100)) : 0;
      nodes.forEach(n => {
        $('.gauge-fill', n).style.width = `${pct}%`;
        n.setAttribute('aria-valuenow', has ? v : g.min);
        n.setAttribute('aria-valuetext', has ? `${g.fmt(v)} on a scale from ${g.scale[0]} to ${g.scale[1]}` : g.empty);
      });
    };
    new MutationObserver(update).observe(srcEl, { childList: true, characterData: true, subtree: true });
    update();
  });

  /* ---------- Weather: loading, error and manual refresh ---------- */
  const wx = $('#priority-weather');
  if (wx && typeof loadWeather === 'function') {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'refresh-btn';
    btn.setAttribute('aria-label', 'Refresh weather');
    btn.title = 'Refresh weather';
    btn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 11a8 8 0 0 0-14.5-4.5L4 8"/><path d="M4 4v4h4"/><path d="M4 13a8 8 0 0 0 14.5 4.5L20 16"/><path d="M20 20v-4h-4"/></svg>';
    wx.after(btn);
    const sync = () => {
      const text = wx.textContent;
      const busy = /^(Loading|Updating)/.test(text);
      wx.classList.toggle('is-loading', busy);
      wx.setAttribute('aria-busy', String(busy));
      btn.disabled = busy;
      if (!busy) wx.title = /unavailable/i.test(text)
        ? 'Couldn’t load the weather. Use the refresh button to try again.'
        : `Updated ${new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`;
    };
    new MutationObserver(sync).observe(wx, { childList: true, characterData: true, subtree: true });
    sync();
    btn.addEventListener('click', () => { wx.textContent = 'Updating weather…'; loadWeather(); });
  }
})();
