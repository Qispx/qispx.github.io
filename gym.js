/* Palumbo Student Interface — Gym tab. Loaded after v3.js. Own storage key; nothing else is touched. */
(() => {
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = escapeHtml;
const KEY = 'studentDashboardGymV1';
const uid = () => Date.now() + Math.random();

let G = { workouts: [], next: 0, log: [], weights: [], unit: 'lb', goal: { perWeek: 4, weight: null }, session: { wid: null, done: [] } };
try { const s = JSON.parse(localStorage.getItem(KEY)); if (s) G = Object.assign(G, s, { goal: Object.assign(G.goal, s.goal || {}) }); } catch {}
const save = () => { try { localStorage.setItem(KEY, JSON.stringify(G)); } catch {} };

const today = () => getTodayDateString();
const shortDate = d => new Date(d + 'T00:00:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
const plural = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`;
const DOW = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const CHK = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l5 5L19.5 7"/></svg>';
let showAnyway = false;
let calFocus = new Date();
const openEd = new Set();

/* ---------- Derived data ---------- */
const uniqDates = () => [...new Set(G.log.map(l => l.date))];
const weekStart = () => addDaysToDateString(today(), -new Date().getDay());
const daysInWeek = start => [...Array(7)].map((_, i) => addDaysToDateString(start, i));
const countWeek = start => { const d = new Set(daysInWeek(start)); return uniqDates().filter(x => d.has(x)).length; };
function streak() {
  const set = new Set(uniqDates());
  let d = set.has(today()) ? today() : addDaysToDateString(today(), -1), n = 0;
  while (set.has(d)) { n++; d = addDaysToDateString(d, -1); }
  return n;
}
const sortedWeights = () => [...G.weights].sort((a, b) => a.date.localeCompare(b.date));
const curIdx = () => G.workouts.length ? G.next % G.workouts.length : 0;
const detail = x => `${x.sets || '–'} × ${x.reps || '–'}${x.weight ? ` · ${x.weight} ${G.unit}` : ''}`;

const PRESET = [
  ['Push', [['Bench Press', 4, '8'], ['Overhead Press', 3, '10'], ['Incline Dumbbell Press', 3, '10'], ['Lateral Raises', 3, '15'], ['Triceps Pushdown', 3, '12']]],
  ['Pull', [['Deadlift', 3, '5'], ['Pull-ups', 4, '8'], ['Barbell Row', 4, '8'], ['Face Pulls', 3, '15'], ['Biceps Curl', 3, '12']]],
  ['Legs', [['Squat', 4, '8'], ['Romanian Deadlift', 3, '10'], ['Leg Press', 3, '12'], ['Leg Curl', 3, '12'], ['Calf Raises', 4, '15']]]
];

/* ---------- Skeleton ---------- */
let built = false;
function build() {
  const root = $('#gym-root'); if (!root || built) return;
  built = true;
  root.innerHTML = `
    <section class="ui-panel gym-panel" id="gym-hero"></section>
    <div class="gym-grid">
      <section class="ui-panel" id="gym-week"></section>
      <section class="ui-panel" id="gym-cal-panel"></section>
    </div>
    <section class="ui-panel gym-panel" id="gym-weight"></section>
    <section class="ui-panel gym-panel" id="gym-editor"></section>`;
}
function refresh() {
  build();
  renderHero(); renderWeek(); renderCal(); renderWeight();
  window.renderSideWidgets?.();
}
window.renderGym = () => { build(); refresh(); renderEditor(); };

/* ---------- Up Next hero ---------- */
function exRow(x, done) {
  return `<label class="gym-chk${done ? ' on' : ''}" data-eid="${x.id}"><input type="checkbox"${done ? ' checked' : ''}><span class="box">${CHK}</span><span class="nm">${esc(x.name || 'Exercise')}</span><small>${esc(detail(x))}</small></label>`;
}
function renderHero() {
  const el = $('#gym-hero'); if (!el) return;
  const W = G.workouts;
  const head = t => `<div class="panel-heading"><div class="panel-heading-main"><h2>${t}</h2></div></div>`;
  if (!W.length) {
    el.innerHTML = head('Today\u2019s Workout') + `<div class="col-empty">No workouts yet. Start with a Push / Pull / Legs split, or build your own below.<br><br><button type="button" data-g="preset">Use Push / Pull / Legs</button></div>`;
    return;
  }
  const i = curIdx(), w = W[i];
  const did = G.log.some(l => l.date === today());
  const resting = did && !showAnyway;
  const lastWid = G.log.length ? G.log[G.log.length - 1].wid : null;
  const strip = `<div class="gym-rot">${W.map((x, j) => `${j ? '<span class="gym-arrow">\u203a</span>' : ''}<button type="button" class="gym-pill${j === i ? ' cur' : ''}${x.id === lastWid ? ' last' : ''}" data-g="pick" data-i="${j}">${esc(x.name)}</button>`).join('')}</div>`;

  if (resting) {
    const last = G.log.filter(l => l.date === today()).pop();
    el.innerHTML = head('Up Next') + `
      <div class="gym-done-note">${CHK.replace('<svg', '<svg fill="none" stroke="currentColor" stroke-width="3"')}<span>You finished ${esc(last.name)} today. Nice work.</span></div>
      <div class="gym-hero-top"><div><span class="gym-eyebrow">Tomorrow</span><h3 class="gym-name">${esc(w.name)}</h3></div><div class="gym-count">${plural(w.exercises.length, 'exercise')}</div></div>
      ${strip}
      ${w.exercises.length ? `<ul class="gym-preview">${w.exercises.map(x => `<li>${esc(x.name)} \u2014 ${esc(detail(x))}</li>`).join('')}</ul>` : ''}
      <div class="gym-btn-row"><button type="button" class="secondary-button" data-g="again">Train again today</button><button type="button" class="secondary-button" data-g="undo">Undo last workout</button></div>`;
    return;
  }

  if (G.session.wid !== w.id) G.session = { wid: w.id, done: [] };
  const done = new Set(G.session.done), n = w.exercises.length;
  const ready = n > 0 && done.size >= n;
  el.innerHTML = head('Today\u2019s Workout') + `
    <div class="gym-hero-top"><div><span class="gym-eyebrow">Up next \u00b7 ${i + 1} of ${W.length} in rotation</span><h3 class="gym-name">${esc(w.name)}</h3></div><div class="gym-count" id="gym-cnt">${done.size} / ${n}</div></div>
    ${strip}
    <div class="gym-ex-list">${n ? w.exercises.map(x => exRow(x, done.has(x.id))).join('') : '<div class="col-empty">No exercises in this workout yet. Add some in the editor below.</div>'}</div>
    <div class="gym-cwrap"><button type="button" class="gym-complete${ready ? ' ready' : ''}" data-g="complete"><span class="ring">${CHK}</span><span>Complete workout</span></button></div>
    ${G.log.length ? '<div class="gym-btn-row" style="margin-top:12px"><button type="button" class="secondary-button" data-g="undo">Undo last workout</button></div>' : ''}`;
}

function burst(host) {
  for (let k = 0; k < 18; k++) {
    const s = document.createElement('i'); s.className = 'gym-spark';
    const a = Math.random() * Math.PI * 2, r = 70 + Math.random() * 110;
    s.style.setProperty('--dx', `${Math.cos(a) * r * 1.6}px`); s.style.setProperty('--dy', `${Math.sin(a) * r * .6}px`);
    host.appendChild(s); setTimeout(() => s.remove(), 900);
  }
}
function completeWorkout(btn) {
  if (btn.dataset.busy) return; btn.dataset.busy = '1';
  const W = G.workouts, i = curIdx(), w = W[i];
  G.log.push({ id: uid(), date: today(), wid: w.id, name: w.name, done: G.session.wid === w.id ? G.session.done.length : 0, total: w.exercises.length });
  G.next = (i + 1) % W.length;
  G.session = { wid: null, done: [] };
  showAnyway = false; save();
  btn.classList.add('popped'); burst(btn.parentElement);
  setTimeout(refresh, 950);
}
function undoLast() {
  const l = G.log.pop(); if (!l) return;
  const j = G.workouts.findIndex(w => w.id === l.wid);
  G.next = j >= 0 ? j : (curIdx() - 1 + G.workouts.length) % G.workouts.length;
  G.session = { wid: null, done: [] }; showAnyway = false; save(); refresh();
}

/* ---------- Weekly progress ---------- */
function renderWeek() {
  const el = $('#gym-week'); if (!el) return;
  const ws = weekStart(), days = daysInWeek(ws), t = today(), goal = Math.max(1, Number(G.goal.perWeek) || 1);
  const n = countWeek(ws), pct = Math.min(100, Math.round(n / goal * 100));
  const by = {}; G.log.forEach(l => (by[l.date] = by[l.date] || []).push(l.name));
  const dots = days.map((d, i) => `<div class="gym-day${by[d] ? ' hit' : ''}${d === t ? ' today' : ''}">${DOW[i]}<span class="dc">${by[d] ? CHK : ''}</span><small>${by[d] ? esc(by[d][0]) : '\u00a0'}</small></div>`).join('');

  const weeks = [...Array(8)].map((_, k) => { const s = addDaysToDateString(ws, -7 * (7 - k)); return { s, c: countWeek(s) }; });
  const max = Math.max(goal, ...weeks.map(x => x.c), 1);
  const W = 400, H = 150, bw = 30, gap = (W - 8 * bw) / 9, base = H - 22, top = 14;
  const gy = base - (goal / max) * (base - top);
  const bars = weeks.map((x, k) => {
    const h = (x.c / max) * (base - top), bx = gap + k * (bw + gap);
    return `<rect x="${bx}" y="${base - h}" width="${bw}" height="${Math.max(h, x.c ? 2 : 0)}" rx="5" style="fill:var(--accent);opacity:${k === 7 ? 1 : .55}"><title>${plural(x.c, 'workout')} \u00b7 week of ${shortDate(x.s)}</title></rect>
      <text x="${bx + bw / 2}" y="${H - 6}" text-anchor="middle">${shortDate(x.s).replace(/^\w+ /, m => m)}</text>`;
  }).join('');

  el.innerHTML = `<div class="panel-heading"><div class="panel-heading-main"><h2>Weekly Progress</h2></div><div class="panel-heading-side"><span class="day-pill">${n >= goal ? 'Goal hit' : `${goal - n} to go`}</span></div></div>
    <div class="gym-days">${dots}</div>
    <div class="gym-goal"><span>${n} of ${goal} workouts</span>
      <div class="stepper"><button type="button" class="step" data-g="goal" data-d="-1" aria-label="Lower weekly goal">&minus;</button><input type="number" value="${goal}" min="1" max="7" data-g-input="goal" aria-label="Workouts per week"><button type="button" class="step" data-g="goal" data-d="1" aria-label="Raise weekly goal">+</button></div></div>
    <div class="col-track"><div class="col-fill" style="width:${pct}%"></div></div>
    <p class="gym-sub">Last 8 weeks</p>
    <svg class="gym-chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Workouts per week, last 8 weeks"><line x1="0" x2="${W}" y1="${gy}" y2="${gy}" stroke="rgba(255,255,255,.35)" stroke-dasharray="4 4"/>${bars}</svg>`;
}

/* ---------- Calendar ---------- */
function renderCal() {
  const el = $('#gym-cal-panel'); if (!el) return;
  const y = calFocus.getFullYear(), m = calFocus.getMonth();
  const off = new Date(y, m, 1).getDay(), dim = new Date(y, m + 1, 0).getDate(), t = today();
  const by = {}; G.log.forEach(l => (by[l.date] = by[l.date] || []).push(l.name));
  let cells = '';
  for (let i = 0; i < off; i++) cells += '<div class="gym-cell blank"></div>';
  let hits = 0;
  for (let d = 1; d <= dim; d++) {
    const k = dateToKey(y, m, d), w = by[k];
    if (w) hits++;
    cells += `<div class="gym-cell${w ? ' hit' : ''}${k === t ? ' today' : ''}">${d}${w ? `<em title="${esc(w.join(', '))}">${esc(w.join(', '))}</em>` : ''}</div>`;
  }
  el.innerHTML = `<div class="panel-heading"><div class="panel-heading-main"><h2>Workout Calendar</h2></div>
      <div class="gym-cal-nav"><button type="button" class="secondary-button calendar-nav-btn" data-g="cal" data-d="-1" aria-label="Previous month">&#8249;</button><span>${calFocus.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}</span><button type="button" class="secondary-button calendar-nav-btn" data-g="cal" data-d="1" aria-label="Next month">&#8250;</button></div></div>
    <div class="gym-cal-head">${DOW.map(d => `<div>${d}</div>`).join('')}</div>
    <div class="gym-cal">${cells}</div>
    <p class="gym-sub">${plural(hits, 'training day')} this month</p>`;
}

/* ---------- Weight ---------- */
function weightChart(W) {
  if (W.length < 2) return '<div class="col-empty">Log at least two weigh-ins to see your graph.</div>';
  const w = 600, h = 220, p = { l: 46, r: 16, t: 14, b: 28 };
  const vals = W.map(x => x.v); if (G.goal.weight) vals.push(Number(G.goal.weight));
  let lo = Math.min(...vals), hi = Math.max(...vals); const pad = (hi - lo || 2) * .15; lo -= pad; hi += pad;
  const t0 = new Date(W[0].date + 'T00:00:00').getTime(), t1 = new Date(W[W.length - 1].date + 'T00:00:00').getTime();
  const X = d => p.l + ((new Date(d + 'T00:00:00').getTime() - t0) / ((t1 - t0) || 1)) * (w - p.l - p.r);
  const Y = v => p.t + (1 - (v - lo) / (hi - lo)) * (h - p.t - p.b);
  const grid = [0, 1, 2, 3].map(i => { const v = lo + (hi - lo) * i / 3, y = Y(v); return `<line x1="${p.l}" x2="${w - p.r}" y1="${y}" y2="${y}" stroke="rgba(255,255,255,.1)"/><text x="${p.l - 8}" y="${y + 4}" text-anchor="end">${v.toFixed(0)}</text>`; }).join('');
  const pts = W.map(x => `${X(x.date).toFixed(1)},${Y(x.v).toFixed(1)}`).join(' ');
  const area = `${X(W[0].date)},${h - p.b} ${pts} ${X(W[W.length - 1].date)},${h - p.b}`;
  const goal = G.goal.weight ? `<line x1="${p.l}" x2="${w - p.r}" y1="${Y(G.goal.weight)}" y2="${Y(G.goal.weight)}" stroke="#ffcf86" stroke-dasharray="5 5"/><text x="${w - p.r}" y="${Y(G.goal.weight) - 5}" text-anchor="end" style="fill:#ffcf86">goal ${G.goal.weight}</text>` : '';
  const dots = W.map(x => `<circle cx="${X(x.date)}" cy="${Y(x.v)}" r="4.5" style="fill:var(--accent)"><title>${shortDate(x.date)}: ${x.v} ${G.unit}</title></circle>`).join('');
  return `<svg class="gym-chart" viewBox="0 0 ${w} ${h}" role="img" aria-label="Body weight over time">${grid}${goal}<polygon points="${area}" style="fill:var(--accent);opacity:.12"/><polyline points="${pts}" fill="none" style="stroke:var(--accent)" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"/>${dots}
    <text x="${p.l}" y="${h - 6}">${shortDate(W[0].date)}</text><text x="${w - p.r}" y="${h - 6}" text-anchor="end">${shortDate(W[W.length - 1].date)}</text></svg>`;
}
function renderWeight() {
  const el = $('#gym-weight'); if (!el) return;
  const W = sortedWeights(), u = G.unit, gw = Number(G.goal.weight) || null;
  const first = W[0], last = W[W.length - 1];
  const change = W.length > 1 ? last.v - first.v : null;
  let prog = '';
  if (gw && W.length) {
    const span = first.v - gw, pct = span === 0 ? (last.v === gw ? 100 : 0) : Math.max(0, Math.min(100, Math.round((first.v - last.v) / span * 100)));
    prog = `<div class="col-track"><div class="col-fill" style="width:${pct}%"></div></div><div class="pct" style="color:#fff;font-weight:800;margin:8px 0 var(--space-4)">${pct}% of the way from ${first.v} to ${gw} ${u}</div>`;
  } else prog = '<p class="gym-sub" style="margin:0 0 var(--space-4)">Set a goal weight to see a progress bar.</p>';
  const fmt = n => (n > 0 ? '+' : '') + n.toFixed(1);
  el.innerHTML = `<div class="panel-heading"><div class="panel-heading-main"><h2>Weight Tracking</h2></div></div>
    <div class="ov-stats">
      <div class="ov-stat"><b>${last ? last.v : '\u2014'}</b><span>current (${u})</span></div>
      <div class="ov-stat"><b>${change == null ? '\u2014' : fmt(change)}</b><span>change since start</span></div>
      <div class="ov-stat"><b>${gw && last ? Math.abs(last.v - gw).toFixed(1) : '\u2014'}</b><span>${gw && last ? 'to goal' : 'no goal set'}</span></div>
    </div>
    ${prog}
    <div class="gym-wform">
      <label>Date<input type="date" id="gw-date" value="${today()}"></label>
      <label>Weight<input type="number" id="gw-val" step="0.1" min="0" placeholder="0.0"></label>
      <button type="button" data-g="wadd">Log weight</button>
      <label>Goal<input type="number" id="gw-goal" step="0.1" min="0" placeholder="optional" value="${gw ?? ''}" data-g-input="goalw"></label>
      <label>Unit<select data-g-input="unit"><option${u === 'lb' ? ' selected' : ''}>lb</option><option${u === 'kg' ? ' selected' : ''}>kg</option></select></label>
    </div>
    ${weightChart(W)}
    ${W.length ? `<div class="gym-wlist">${[...W].reverse().slice(0, 6).map(x => `<div class="gym-wrow"><span>${x.v} ${u}</span><small>${shortDate(x.date)}</small><button type="button" class="danger-button" data-g="wdel" data-date="${x.date}" aria-label="Delete entry">\u00d7</button></div>`).join('')}</div>` : ''}`;
}

/* ---------- Workout editor ---------- */
function renderEditor() {
  const el = $('#gym-editor'); if (!el) return;
  const W = G.workouts;
  const card = (w, i) => `<details class="col-card" data-wid="${w.id}"${openEd.has(String(w.id)) ? ' open' : ''}>
    <summary><span class="col-title">${esc(w.name || 'Untitled')}</span><span class="col-sum">${plural(w.exercises.length, 'exercise')}</span>
      <span class="col-actions"><button type="button" class="secondary-button" data-g="wmv" data-d="-1"${i === 0 ? ' disabled' : ''} aria-label="Move up">\u2191</button><button type="button" class="secondary-button" data-g="wmv" data-d="1"${i === W.length - 1 ? ' disabled' : ''} aria-label="Move down">\u2193</button><button type="button" class="danger-button" data-g="wdelete">Delete</button></span></summary>
    <div class="col-body">
      <label class="gym-ed-name">Workout name<input type="text" data-gk="wname" value="${esc(w.name)}" maxlength="40"></label>
      ${w.exercises.map(x => `<div class="gym-ex" data-eid="${x.id}">
        <label>Exercise<input type="text" data-gk="name" value="${esc(x.name)}" maxlength="60"></label>
        <label>Sets<input type="number" data-gk="sets" min="1" value="${esc(x.sets ?? '')}"></label>
        <label>Reps<input type="text" data-gk="reps" value="${esc(x.reps ?? '')}" maxlength="10"></label>
        <label>Weight<input type="text" data-gk="weight" value="${esc(x.weight ?? '')}" maxlength="10"></label>
        <button type="button" class="danger-button x" data-g="xdel" aria-label="Delete exercise">\u00d7</button></div>`).join('')}
      <button type="button" class="secondary-button" data-g="xadd">Add exercise</button>
    </div></details>`;
  el.innerHTML = `<div class="panel-heading"><div class="panel-heading-main"><h2>My Workouts</h2></div><div class="gym-btn-row"><button type="button" class="secondary-button" data-g="preset">Push / Pull / Legs preset</button><button type="button" data-g="wnew">Add Workout</button></div></div>
    <div class="col-list">${W.length ? W.map(card).join('') : '<div class="col-empty">No workouts yet. Add one, or load the preset.</div>'}</div>`;
}

/* ---------- Events ---------- */
const root = $('#gym-root');
const wOf = el => G.workouts.find(w => String(w.id) === el.closest('[data-wid]')?.dataset.wid);

root.addEventListener('click', e => {
  const b = e.target.closest('[data-g]'); if (!b) return;
  const a = b.dataset.g;
  if (a === 'complete') return completeWorkout(b);
  if (a === 'pick') { G.next = Number(b.dataset.i); G.session = { wid: null, done: [] }; showAnyway = true; save(); return refresh(); }
  if (a === 'again') { showAnyway = true; return renderHero(); }
  if (a === 'undo') return undoLast();
  if (a === 'preset') {
    if (G.workouts.length && !confirm('Replace your current workouts with Push / Pull / Legs?')) return;
    G.workouts = PRESET.map(([name, ex]) => ({ id: uid(), name, exercises: ex.map(([n, s, r]) => ({ id: uid(), name: n, sets: s, reps: r, weight: '' })) }));
    G.next = 0; G.session = { wid: null, done: [] }; save(); refresh(); return renderEditor();
  }
  if (a === 'goal') { G.goal.perWeek = Math.min(7, Math.max(1, (Number(G.goal.perWeek) || 1) + Number(b.dataset.d))); save(); return refresh(); }
  if (a === 'cal') { calFocus = new Date(calFocus.getFullYear(), calFocus.getMonth() + Number(b.dataset.d), 1); return renderCal(); }
  if (a === 'wadd') {
    const d = $('#gw-date').value, v = parseFloat($('#gw-val').value);
    if (!d || !Number.isFinite(v) || v <= 0) return alert('Enter a date and a weight.');
    G.weights = G.weights.filter(x => x.date !== d); G.weights.push({ date: d, v }); save(); return refresh();
  }
  if (a === 'wdel') { G.weights = G.weights.filter(x => x.date !== b.dataset.date); save(); return refresh(); }

  /* Editor actions */
  if (a === 'wnew') { const w = { id: uid(), name: 'New workout', exercises: [] }; G.workouts.push(w); openEd.add(String(w.id)); save(); refresh(); return renderEditor(); }
  const w = wOf(b);
  if (['wdelete', 'wmv'].includes(a)) {
    e.preventDefault(); e.stopPropagation();
    const i = G.workouts.indexOf(w);
    if (a === 'wdelete') {
      if (!confirm('Delete this workout?')) return;
      const cur = G.workouts[curIdx()];
      G.workouts.splice(i, 1);
      const ni = G.workouts.indexOf(cur); G.next = ni >= 0 ? ni : Math.min(i, Math.max(0, G.workouts.length - 1));
    } else {
      const j = i + Number(b.dataset.d); if (j < 0 || j >= G.workouts.length) return;
      const cur = G.workouts[curIdx()];
      [G.workouts[i], G.workouts[j]] = [G.workouts[j], G.workouts[i]];
      G.next = G.workouts.indexOf(cur);
    }
    save(); refresh(); return renderEditor();
  }
  if (a === 'xadd' && w) { w.exercises.push({ id: uid(), name: '', sets: 3, reps: '10', weight: '' }); openEd.add(String(w.id)); save(); refresh(); return renderEditor(); }
  if (a === 'xdel' && w) { const id = b.closest('[data-eid]').dataset.eid; w.exercises = w.exercises.filter(x => String(x.id) !== id); openEd.add(String(w.id)); save(); refresh(); return renderEditor(); }
});

root.addEventListener('toggle', e => {
  const c = e.target.closest?.('[data-wid]'); if (!c || c !== e.target) return;
  c.open ? openEd.add(c.dataset.wid) : openEd.delete(c.dataset.wid);
}, true);

/* Typing in the editor updates data in place (no re-render, so focus is kept) */
root.addEventListener('input', e => {
  const el = e.target.closest('[data-gk]'); if (!el) return;
  const w = wOf(el); if (!w) return;
  const k = el.dataset.gk;
  if (k === 'wname') { w.name = el.value; $('.col-title', el.closest('details')).textContent = el.value || 'Untitled'; }
  else { const x = w.exercises.find(x => String(x.id) === el.closest('[data-eid]').dataset.eid); if (x) x[k] = el.type === 'number' ? (el.value === '' ? '' : Number(el.value)) : el.value; }
  save(); renderHero();
});

/* Exercise check-off in the hero, updated in place so the animation plays */
root.addEventListener('change', e => {
  const t = e.target;
  if (t.matches('.gym-chk input')) {
    const row = t.closest('.gym-chk'), id = row.dataset.eid, w = G.workouts[curIdx()];
    const s = new Set(G.session.done); t.checked ? s.add(Number(id) || id) : s.delete(Number(id) || id);
    G.session = { wid: w.id, done: [...s].filter(x => w.exercises.some(ex => String(ex.id) === String(x))) };
    row.classList.toggle('on', t.checked);
    $('#gym-cnt').textContent = `${G.session.done.length} / ${w.exercises.length}`;
    $('.gym-complete')?.classList.toggle('ready', G.session.done.length >= w.exercises.length);
    return save();
  }
  const gi = t.dataset?.gInput; if (!gi) return;
  if (gi === 'goal') { G.goal.perWeek = Math.min(7, Math.max(1, Number(t.value) || 1)); save(); refresh(); }
  else if (gi === 'goalw') { G.goal.weight = t.value === '' ? null : Number(t.value); save(); refresh(); }
  else if (gi === 'unit') { G.unit = t.value; save(); refresh(); renderEditor(); }
});

/* Sidebar summary (called by v3.js when the Gym tab is active) */
window.gymSide = () => {
  const ws = weekStart(), goal = Math.max(1, Number(G.goal.perWeek) || 1), n = countWeek(ws);
  const W = sortedWeights(), last = W[W.length - 1], nx = G.workouts[curIdx()];
  const did = G.log.some(l => l.date === today());
  const rows = [['This week', `${n} / ${goal}`], ['Day streak', streak()], ['Total workouts', G.log.length], ['Weight', last ? `${last.v} ${G.unit}` : '\u2014']];
  return `<div class="side-section"><p class="sidebar-nav-label">${did ? 'Tomorrow' : 'Up Next'}</p><p class="side-note strong">${nx ? esc(nx.name) : 'No workouts yet'}</p></div>
    <div class="side-section"><p class="sidebar-nav-label">Gym Stats</p><ul class="side-stats">${rows.map(([l, v]) => `<li><span>${l}</span><b>${v}</b></li>`).join('')}</ul><div class="side-bar"><i style="width:${Math.min(100, Math.round(n / goal * 100))}%"></i></div></div>`;
};

build();
refresh();
renderEditor();
})();
