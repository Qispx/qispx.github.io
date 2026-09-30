/* Palumbo Student Interface v3 — layered on script.js (reuses its data + functions) */
(() => {
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const WD = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
const plural = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`;
const content = $('.content');
const footer = $('.site-footer');

/* ---------- Views (existing DOM is moved, not rebuilt) ---------- */
const VIEWS = ['dashboard', 'calendar', 'college', 'builder'];
const views = {};
VIEWS.forEach(k => {
  const v = document.createElement('div');
  v.className = 'view'; v.id = `view-${k}`;
  content.insertBefore(v, footer);
  views[k] = v;
});
views.dashboard.append($('.dashboard-hero'), $('#priority'), $('#schedule'));
views.calendar.append($('#calendar'));
views.builder.append($('#schedule-editor'));
views.college.innerHTML = '<div id="college-root"></div>';
/* GPA calculator + SAT inputs live on the College page (GPA & SAT tab) */
const satPanel = document.createElement('section');
satPanel.className = 'ui-panel sat-panel';
satPanel.innerHTML = '<div class="panel-heading"><h2>SAT Score</h2></div>';
satPanel.append($('.sidebar-sat'));
const gpaWrap = document.createElement('div');
gpaWrap.id = 'gpa-wrap'; gpaWrap.style.display = 'none';
gpaWrap.append(satPanel, $('#gpa'));
views.college.append(gpaWrap);
const ov = document.createElement('section');
ov.className = 'ui-panel overview'; ov.id = 'overview';
$('.dashboard-hero').after(ov);
$('.footer-version').textContent = 'Palumbo Student Interface v3.0.0';

/* ---------- Dock ---------- */
const ic = d => `<svg class="dock-ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
const ICONS = {
  dashboard: ic('<path d="M3 11l9-8 9 8"/><path d="M5 10v10h14V10"/>'),
  calendar: ic('<rect x="3" y="4" width="18" height="17" rx="2"/><path d="M3 9h18M8 2v4M16 2v4"/>'),
  college: ic('<path d="M2 9l10-5 10 5-10 5z"/><path d="M6 11v5c0 1.5 3 3 6 3s6-1.5 6-3v-5"/>'),
  builder: ic('<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>')
};
const dock = document.createElement('nav');
dock.className = 'dock'; dock.setAttribute('aria-label', 'Main navigation');
dock.innerHTML = `
  <button type="button" data-view="dashboard">${ICONS.dashboard}<span>Dashboard</span></button>
  <button type="button" data-view="calendar">${ICONS.calendar}<span>Calendar</span></button>
  <button type="button" data-view="college">${ICONS.college}<span>College</span></button>
  <button type="button" data-view="builder">${ICONS.builder}<span>Schedule Builder</span></button>`;
document.body.append(dock);


function showView(name) {
  if (!views[name]) name = 'dashboard';
  Object.entries(views).forEach(([k, v]) => v.classList.toggle('active', k === name));
  current = name; renderSideNav(name);
  $$('.dock > [data-view]').forEach(b => b.classList.toggle('active', b.dataset.view === name));
  content.scrollTo({ top: 0 }); window.scrollTo(0, 0);
  history.replaceState(null, '', `#/${name}`);
  if (name === 'calendar') renderCalendar();
  if (name === 'college') renderCollege();
  if (name === 'dashboard') renderOverview();
}
window.showView = showView;
document.addEventListener('click', e => {
  const b = e.target.closest('[data-view]');
  if (b) showView(b.dataset.view);
});

/* ---------- Dashboard overview ---------- */
function renderOverview() {
  const today = getTodayDateString();
  const open = homework.filter(h => !h.done && h.dueDate);
  const dueToday = open.filter(h => daysUntil(h.dueDate, today) === 0).length;
  const overdue = open.filter(h => daysUntil(h.dueDate, today) < 0).length;
  const testsTmrw = open.filter(h => h.type === 'test' && daysUntil(h.dueDate, today) === 1).length;
  const nowS = getSecondsNow();
  const next = getEffectiveSchedule(WD[new Date().getDay()])
    .filter(c => timeToSeconds(c.startTime) > nowS)
    .sort((a, b) => timeToSeconds(a.startTime) - timeToSeconds(b.startTime))[0];
  const dl = deadlineRows()[0];
  ov.innerHTML = `
    <div class="panel-heading"><div class="panel-heading-main"><h2>Today's Overview</h2></div></div>
    <div class="ov-stats">
      <div class="ov-stat ${overdue ? 'bad' : ''}"><b>${dueToday}</b><span>due today${overdue ? ` · ${overdue} overdue` : ''}</span></div>
      <div class="ov-stat ${testsTmrw ? 'warn' : ''}"><b>${testsTmrw}</b><span>test${testsTmrw === 1 ? '' : 's'} tomorrow</span></div>
      <div class="ov-stat"><b>${next ? escapeHtml(formatStoredTime(next.startTime)) : '—'}</b><span>${next ? `next: ${escapeHtml(next.name)}` : 'no more classes today'}</span></div>
      <div class="ov-stat"><b>${tasks.filter(t => t.done).length}/${tasks.length}</b><span>daily tasks done</span></div>
      <div class="ov-stat"><b>${dl ? (dl.n < 0 ? 'Passed' : plural(dl.n, 'day')) : '—'}</b><span>${dl ? escapeHtml(`${dl.c.name || 'College'} ${dl.l}`) : 'no college deadlines'}</span></div>
    </div>`;
  renderSideWidgets();
}
const _rp = window.renderPriorityDashboard;
window.renderPriorityDashboard = () => { _rp(); renderOverview(); };
const _rt = window.renderTasks;
window.renderTasks = () => { _rt(); renderOverview(); };

/* ---------- Calendar: month/week/day + filters (same homework data) ---------- */
const CAL = { mode: 'month', cls: '', type: '', focus: new Date() };
const tb = document.createElement('div');
tb.className = 'cal-toolbar';
tb.innerHTML = `${['month', 'week', 'day'].map(m => `<button type="button" class="cal-mode${m === 'month' ? ' active' : ''}" data-cal="${m}">${m[0].toUpperCase() + m.slice(1)}</button>`).join('')}
  <select id="cal-class" aria-label="Filter by class"></select>
  <select id="cal-type" aria-label="Filter by type"><option value="">All types</option><option value="assignment">Assignments</option><option value="test">Tests / Quizzes</option><option value="event">Events</option><option value="deadline">College deadlines</option></select>`;
$('#calendar .calendar-legend').insertAdjacentHTML('beforeend', '<span><i class="calendar-dot" style="background:#9ad7ff"></i>College deadline</span>');
$('#calendar .calendar-legend').after(tb);
tb.addEventListener('click', e => {
  const b = e.target.closest('[data-cal]'); if (!b) return;
  CAL.mode = b.dataset.cal;
  $$('.cal-mode').forEach(x => x.classList.toggle('active', x === b));
  renderCalendar();
});
$('#cal-class').addEventListener('change', e => { CAL.cls = e.target.value; renderCalendar(); });
$('#cal-type').addEventListener('change', e => { CAL.type = e.target.value; renderCalendar(); });

function calItems() {
  const hw = homework.filter(i => i.dueDate && (!CAL.cls || i.className === CAL.cls) && (!CAL.type || i.type === CAL.type)).map(i => ({ ...i, kind: 'hw' }));
  const cd = (!CAL.cls && (!CAL.type || CAL.type === 'deadline')) ? collegeDates() : [];
  return hw.concat(cd);
}

window.renderCalendar = () => {
  const grid = $('#calendar-grid'), label = $('#calendar-month-label');
  if (!grid || !label) return;
  const sel = $('#cal-class'), cur = CAL.cls;
  sel.innerHTML = '<option value="">All classes</option>' + getClassNamesForHomework().map(n => `<option${n === cur ? ' selected' : ''}>${escapeHtml(n)}</option>`).join('');
  const f = CAL.focus, by = {};
  calItems().forEach(i => (by[i.dueDate] = by[i.dueDate] || []).push(i));
  let cells = [];
  if (CAL.mode === 'month') {
    const y = f.getFullYear(), m = f.getMonth(), off = new Date(y, m, 1).getDay(), dim = new Date(y, m + 1, 0).getDate();
    for (let i = -off; i < Math.ceil((off + dim) / 7) * 7 - off; i++) { const d = new Date(y, m, 1 + i); cells.push({ d, inMonth: d.getMonth() === m }); }
    label.textContent = f.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
  } else if (CAL.mode === 'week') {
    const s = new Date(f); s.setDate(f.getDate() - f.getDay());
    for (let i = 0; i < 7; i++) cells.push({ d: new Date(s.getFullYear(), s.getMonth(), s.getDate() + i), inMonth: true });
    label.textContent = `Week of ${s.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`;
  } else {
    cells.push({ d: new Date(f.getFullYear(), f.getMonth(), f.getDate()), inMonth: true });
    label.textContent = f.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });
  }
  $('.calendar-weekdays').style.display = CAL.mode === 'day' ? 'none' : '';
  grid.className = `calendar-grid ${CAL.mode}`;
  grid.innerHTML = '';
  const todayKey = getTodayDateString();
  cells.forEach(({ d, inMonth }) => {
    const key = dateToKey(d.getFullYear(), d.getMonth(), d.getDate());
    const el = document.createElement('div');
    el.className = 'calendar-cell' + (inMonth ? '' : ' outside') + (key === todayKey ? ' is-today' : '');
    el.innerHTML = `<div class="calendar-day-number">${CAL.mode === 'month' ? d.getDate() : d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}</div>`;
    const items = inMonth ? (by[key] || []) : [];
    if (items.length) {
      const list = document.createElement('div'); list.className = 'calendar-items';
      const sorted = [...items].sort((a, b) => Number(!!a.done) - Number(!!b.done) || priorityRank[computePriority(a.dueDate, a.density)] - priorityRank[computePriority(b.dueDate, b.density)]);
      const max = CAL.mode === 'month' ? 3 : 99;
      sorted.slice(0, max).forEach(item => {
        const chip = document.createElement('button'); chip.type = 'button';
        const p = computePriority(item.dueDate, item.density);
        chip.className = `calendar-chip ${item.kind === 'college' ? 'college' : item.done ? 'done' : p}`;
        chip.title = `${item.name} (${item.className}${item.type ? ` · ${typeLabel[item.type] || ''}` : ''})`;
        chip.textContent = CAL.mode === 'day' && item.kind === 'hw' ? `${item.name} · ${item.className} · ${priorityLabel[p]}` : item.name;
        chip.addEventListener('click', () => item.kind === 'college' ? showView('college') : jumpToHomeworkItem(item.id));
        list.appendChild(chip);
      });
      if (sorted.length > max) list.insertAdjacentHTML('beforeend', `<div class="calendar-more">+${sorted.length - max} more</div>`);
      el.appendChild(list);
    }
    grid.appendChild(el);
  });
  renderSideWidgets();
};
window.changeCalendarMonth = delta => {
  const f = CAL.focus;
  if (CAL.mode === 'month') f.setMonth(f.getMonth() + delta, 1);
  else f.setDate(f.getDate() + delta * (CAL.mode === 'week' ? 7 : 1));
  renderCalendar();
};
window.goToCurrentCalendarMonth = () => { CAL.focus = new Date(); renderCalendar(); };
const _jump = window.jumpToHomeworkItem;
window.jumpToHomeworkItem = id => { showView('dashboard'); setTimeout(() => _jump(id), 320); };

/* ---------- College workspace (own storage key; homework/schedule untouched) ---------- */
const CK = 'studentDashboardCollegeV1';
const uid = () => Date.now() + Math.random();
let C = null;
try { C = JSON.parse(localStorage.getItem(CK)); } catch {}
C = Object.assign({ colleges: [], activities: [], honors: [], essays: [], recs: [], docs: null }, C || {});
if (!C.docs) C.docs = ['Transcript', 'Recommendation letters', 'Resume', 'Activity list', 'Personal statement', 'Supplemental essays', 'Test scores', 'Financial aid documents'].map(name => ({ id: uid(), name, status: 'Not Started' }));
const saveC = () => { try { localStorage.setItem(CK, JSON.stringify(C)); } catch {} };
const wc = t => ((t || '').trim().match(/\S+/g) || []).length;
const F = (k, l, t = 'text', o, c) => ({ k, l, t, o, c });
const collegeNames = () => ['Common App', ...C.colleges.map(c => c.name).filter(Boolean)];
const DONE_ESSAY = ['Final', 'Submitted'];
const SUBMITTED = ['Submitted', 'Accepted', 'Waitlisted', 'Denied'];

const CAT_RANK = { Reach: 0, Target: 1, Safety: 2 };
function sortedColleges() {
  return C.colleges.map((c, i) => ({ c, i }))
    .sort((a, b) => (CAT_RANK[a.c.category] ?? 3) - (CAT_RANK[b.c.category] ?? 3) || a.i - b.i)
    .map(x => x.c);
}

const S = {
  colleges: { label: 'College List', add: 'Add College', def: { status: 'Researching', category: 'Not set' }, t: i => i.name || 'New college', s: i => i.status,
    f: [F('name', 'College name'), F('category', 'School Type', 'sel', ['Not set', 'Reach', 'Target', 'Safety']), F('platform', 'Application platform'), F('deadline', 'Application deadline', 'date'), F('ea', 'Early Action deadline', 'date'), F('ed', 'Early Decision deadline', 'date'), F('rd', 'Regular Decision deadline', 'date'),
      F('major', 'Intended major'), F('status', 'Application status', 'sel', ['Researching', 'Planning', 'Not Started', 'In Progress', 'Submitted', 'Accepted', 'Waitlisted', 'Denied']),
      F('website', 'Website'), F('aid', 'Financial aid info'), F('scholar', 'Scholarship info'), F('notes', 'Notes', 'area')] },
  activities: { label: 'Extracurricular Activities', add: 'Add Activity', def: { grades: [] }, t: i => i.org || 'New activity', s: i => i.type,
    f: [F('type', 'Activity type', 'sel', ['Academic', 'Art', 'Athletics', 'Career-oriented', 'Community Service', 'Computer/Technology', 'Family Responsibilities', 'Internship', 'Journalism/Publication', 'Music', 'Research', 'Student Government', 'Theater', 'Work', 'Other']),
      F('org', 'Organization name'), F('position', 'Position / leadership'), F('timing', 'Participation timing', 'sel', ['During school year', 'During school break', 'All year']),
      F('hours', 'Hours per week', 'num'), F('weeks', 'Weeks per year', 'num'), F('cont', 'Continue in college?', 'sel', ['Yes', 'No']),
      F('grades', 'Grades participated', 'chk', ['9', '10', '11', '12', 'Post-graduate']), F('desc', 'Description', 'area', null, { mode: 'chars', max: 150 })] },
  honors: { label: 'Honors', add: 'Add Honor', def: {}, t: i => i.name || 'New honor', s: i => i.level,
    f: [F('name', 'Award name'), F('level', 'Recognition level', 'sel', ['School', 'Local', 'State', 'National', 'International']), F('grade', 'Grade received', 'sel', ['9', '10', '11', '12']),
      F('year', 'Year', 'num'), F('related', 'Related activity / class'), F('desc', 'Description', 'area', null, { mode: 'chars', max: 100 }), F('notes', 'Notes', 'area')] },
  essays: { label: 'Essays', add: 'Add Essay', def: {}, t: i => `${i.college || 'Common App'} — ${i.title || 'Untitled'}`, s: i => i.status,
    f: [F('college', 'College / application', 'sel', collegeNames), F('title', 'Essay title'), F('status', 'Status', 'sel', ['Idea', 'Outlining', 'Drafting', 'Revising', 'Final', 'Submitted']),
      F('target', 'Target word count', 'num'), F('prompt', 'Prompt', 'area'), F('draft', 'Draft', 'area', null, { mode: 'words', big: true })] },
  recs: { label: 'Recommendations', add: 'Add Recommender', def: {}, t: i => i.name || 'New recommender', s: i => i.status,
    f: [F('name', 'Teacher / counselor name'), F('role', 'Subject / role'), F('requested', 'Requested date', 'date'), F('deadline', 'Deadline', 'date'),
      F('status', 'Status', 'sel', ['Not Requested', 'Requested', 'Confirmed', 'Received']), F('notes', 'Notes', 'area')] },
  docs: { label: 'Documents', add: 'Add Document', def: {}, t: i => i.name || 'New document', s: i => i.status,
    f: [F('name', 'Document'), F('status', 'Status', 'sel', ['Not Started', 'In Progress', 'Done'])] }
};
Object.values(S).forEach(s => s.f.forEach(f => { if (f.t === 'sel') s.def[f.k] ??= (typeof f.o === 'function' ? f.o() : f.o)[0]; }));

function countText(it, f) {
  const c = f.c, v = it[f.k] || '';
  if (c.mode === 'chars') return `${v.length} / ${c.max} characters`;
  const t = Number(it.target) || 0;
  return `${wc(v)} / ${t || '—'} words`;
}
const isOver = (it, f) => f.c.mode === 'chars' ? (it[f.k] || '').length > f.c.max : (Number(it.target) && wc(it[f.k]) > Number(it.target));

function fieldHtml(it, f) {
  const v = it[f.k];
  let h;
  if (f.t === 'area') h = `<textarea data-k="${f.k}" class="${f.c?.big ? 'big' : ''}" ${f.c?.mode === 'chars' ? `maxlength="${f.c.max}"` : ''}>${escapeHtml(v || '')}</textarea>${f.c ? `<div class="wc ${isOver(it, f) ? 'over' : ''}" data-wc="${f.k}">${countText(it, f)}</div>` : ''}`;
  else if (f.t === 'sel') { let o = typeof f.o === 'function' ? f.o() : f.o; if (v && !o.includes(v)) o = [...o, v]; h = `<select data-k="${f.k}">${o.map(x => `<option${x === v ? ' selected' : ''}>${escapeHtml(x)}</option>`).join('')}</select>`; }
  else if (f.t === 'chk') h = `<div class="chk-row">${f.o.map(x => `<label><input type="checkbox" data-k="${f.k}" value="${x}" ${(v || []).includes(x) ? 'checked' : ''}>${x}</label>`).join('')}</div>`;
  else h = `<input type="${f.t === 'num' ? 'number' : f.t}" data-k="${f.k}" value="${escapeHtml(v ?? '')}">`;
  return `<label class="${f.t === 'area' || f.t === 'chk' ? 'wide' : ''}">${f.l}${h}</label>`;
}

/* Progress comes from real data, never a typed-in percentage */
function checklist(c) {
  const es = C.essays.filter(e => e.college === c.name);
  return [
    ['Personal information', !!(c.name && c.platform && (c.deadline || c.ea || c.ed || c.rd))],
    ['Activities', C.activities.length > 0],
    ['Honors', C.honors.length > 0],
    ['Personal essay', C.essays.some(e => e.college === 'Common App' && DONE_ESSAY.includes(e.status))],
    ['Recommendation request', C.recs.some(r => r.status !== 'Not Requested')],
    ['Supplemental essay', es.length > 0 && es.every(e => DONE_ESSAY.includes(e.status))],
    ['Final review', C.docs.length > 0 && C.docs.every(d => d.status === 'Done')],
    ['Submit', SUBMITTED.includes(c.status)]
  ];
}
function progressHtml(c) {
  const L = checklist(c), p = Math.round(L.filter(x => x[1]).length / L.length * 100);
  return `<div class="col-track"><div class="col-fill" style="width:${p}%"></div></div><div class="pct">${p}% complete</div><ul class="checks">${L.map(([t, ok]) => `<li class="ck${ok ? ' done' : ''}">${t}</li>`).join('')}</ul>`;
}

function collegeDates() {
  const out = [];
  C.colleges.forEach(c => [['Application', c.deadline], ['EA', c.ea], ['ED', c.ed], ['RD', c.rd]].forEach(([l, d]) => { if (d) out.push({ id: `${c.id}-${l}`, name: `${c.name || 'College'} ${l === 'Application' ? 'deadline' : l}`, className: c.name || 'College', dueDate: d, kind: 'college', l, c }); }));
  return out;
}
function deadlineRows() {
  const today = getTodayDateString();
  return C.colleges.map(c => {
    const ds = collegeDates().filter(x => x.c === c).map(x => ({ ...x, n: daysUntil(x.dueDate, today) }));
    if (!ds.length) return null;
    return ds.filter(x => x.n >= 0).sort((a, b) => a.n - b.n)[0] || ds.sort((a, b) => b.n - a.n)[0];
  }).filter(Boolean).sort((a, b) => (a.n < 0) - (b.n < 0) || (a.n < 0 ? b.n - a.n : a.n - b.n));
}
function deadlinesHtml() {
  const rows = deadlineRows();
  if (!rows.length) return '<div class="col-empty">No deadlines yet. Add a college and set a date.</div>';
  return rows.map(r => {
    const dot = r.n < 0 ? 'g' : r.n <= 14 ? 'r' : r.n <= 30 ? 'o' : 'y';
    const when = r.n < 0 ? `Passed ${plural(-r.n, 'day')} ago` : r.n === 0 ? 'Due today' : plural(r.n, 'day');
    return `<div class="dl-row"><i class="dot ${dot}"></i><span>${escapeHtml(r.c.name || 'Unnamed college')} — ${r.l}</span><small>${when}${SUBMITTED.includes(r.c.status) ? ' · ' + r.c.status : ''}</small></div>`;
  }).join('');
}

let tab = 'colleges';
const open = new Set();
const TABS = [['colleges', 'Colleges'], ['activities', 'Activities'], ['honors', 'Honors'], ['essays', 'Essays'], ['recs', 'Recommendations'], ['docs', 'Documents'], ['gpa', 'Academics']];

function updateDerived() {
  const d = $('#col-deadlines'); if (d) d.innerHTML = deadlinesHtml();
  $$('#college-root .col-card').forEach(card => {
    const c = C.colleges.find(i => String(i.id) === card.dataset.id), p = $('.col-progress', card);
    if (c && p) p.innerHTML = progressHtml(c);
  });
  renderOverview();
}

function cardEl(sec, it, idx, n) {
  const s = S[sec], d = document.createElement('details');
  const badge = sec === 'colleges' && it.category && it.category !== 'Not set' ? `<span class="school-badge ${it.category.toLowerCase()}">${it.category}</span>` : '';
  const mv = sec === 'colleges' ? '' : `<button type="button" class="secondary-button mv" data-d="-1" ${idx === 0 ? 'disabled' : ''} aria-label="Move up">↑</button><button type="button" class="secondary-button mv" data-d="1" ${idx === n - 1 ? 'disabled' : ''} aria-label="Move down">↓</button>`;
  d.className = 'col-card'; d.dataset.id = it.id; d.open = open.has(String(it.id));
  d.innerHTML = `<summary><span class="col-title">${escapeHtml(s.t(it))}</span>${badge}<span class="col-sum">${escapeHtml(s.s(it) || '')}</span>
    <span class="col-actions">${mv}<button type="button" class="danger-button del">Delete</button></span></summary>
    <div class="col-body">${sec === 'colleges' ? `<div class="col-progress">${progressHtml(it)}</div>` : ''}<div class="col-fields">${s.f.map(f => fieldHtml(it, f)).join('')}</div>${sec === 'essays' ? `<div class="wc" data-edited>${it.edited ? 'Last edited ' + new Date(it.edited).toLocaleString() : 'Not edited yet'}</div>` : ''}</div>`;
  d.addEventListener('toggle', () => d.open ? open.add(String(it.id)) : open.delete(String(it.id)));
  return d;
}

function renderCollege() {
  const root = $('#college-root'), s = S[tab];
  $('#gpa-wrap').style.display = tab === 'gpa' ? '' : 'none';
  markSide();
  if (tab === 'gpa') { root.innerHTML = `<div class="col-tabs" style="margin-top:0">${TABS.map(([k, l]) => `<button type="button" data-tab="${k}" class="${k === tab ? 'active' : ''}">${l}</button>`).join('')}</div>`; return; }
  root.innerHTML = `
    <div class="ui-panel"><div class="panel-heading"><div class="panel-heading-main"><h2>College Applications</h2></div></div>
      <h3 class="sub-h">Upcoming Deadlines</h3><div id="col-deadlines">${deadlinesHtml()}</div></div>
    <div class="col-tabs">${TABS.map(([k, l]) => `<button type="button" data-tab="${k}" class="${k === tab ? 'active' : ''}">${l}</button>`).join('')}</div>
    <section class="ui-panel" data-sec="${tab}"><div class="panel-heading"><h2>${s.label}</h2><button type="button" class="col-add">${s.add}</button></div><div class="col-list"></div></section>`;
  const list = $('.col-list', root), arr = tab === 'colleges' ? sortedColleges() : C[tab];
  if (!arr.length) list.innerHTML = '<div class="col-empty">Nothing here yet. Use the button above to add your first one.</div>';
  arr.forEach((it, i) => list.appendChild(cardEl(tab, it, i, arr.length)));
}

const root = $('#college-root');
root.addEventListener('click', e => {
  const t = e.target.closest('[data-tab]');
  if (t) { tab = t.dataset.tab; renderCollege(); return; }
  const secEl = e.target.closest('[data-sec]'); if (!secEl) return;
  const sec = secEl.dataset.sec;
  if (e.target.closest('.col-add')) {
    const it = { id: uid(), ...structuredClone(S[sec].def) };
    C[sec].push(it); open.add(String(it.id)); saveC(); renderCollege(); return;
  }
  const card = e.target.closest('.col-card'); if (!card) return;
  const idx = C[sec].findIndex(i => String(i.id) === card.dataset.id);
  const mv = e.target.closest('.mv'), del = e.target.closest('.del');
  if (mv || del) {
    e.preventDefault(); e.stopPropagation();
    if (del) { if (!confirm('Delete this entry?')) return; C[sec].splice(idx, 1); }
    else { const j = idx + Number(mv.dataset.d); if (j < 0 || j >= C[sec].length) return; [C[sec][idx], C[sec][j]] = [C[sec][j], C[sec][idx]]; }
    saveC(); renderCollege();
  }
});
function onEdit(e) {
  const el = e.target.closest('[data-k]'), card = el?.closest('.col-card'); if (!card) return;
  const sec = el.closest('[data-sec]').dataset.sec, s = S[sec];
  const it = C[sec].find(i => String(i.id) === card.dataset.id); if (!it) return;
  const k = el.dataset.k;
  if (el.type === 'checkbox') it[k] = $$(`[data-k="${k}"]:checked`, card).map(x => x.value);
  else it[k] = el.type === 'number' ? (el.value === '' ? '' : Number(el.value)) : el.value;
  if (sec === 'essays') { it.edited = new Date().toISOString(); const ed = $('[data-edited]', card); if (ed) ed.textContent = 'Last edited ' + new Date(it.edited).toLocaleString(); }
  saveC();
  if (sec === 'colleges' && k === 'category') { open.add(String(it.id)); renderCollege(); updateDerived(); return; }
  s.f.filter(f => f.c).forEach(f => { const c = $(`[data-wc="${f.k}"]`, card); if (c) { c.textContent = countText(it, f); c.classList.toggle('over', !!isOver(it, f)); } });
  $('.col-title', card).textContent = s.t(it); $('.col-sum', card).textContent = s.s(it) || '';
  updateDerived();
}
root.addEventListener('input', onEdit);
root.addEventListener('change', onEdit);

/* ---------- Contextual sidebar (title + GPA/SAT summary stay; nav follows the page) ---------- */
let current = 'dashboard';
const navLabel = $('.sidebar > p.sidebar-nav-label'), navUl = $('.sidebar > ul');
$('.task-panel').id = 'task-panel';
const NAV = {
  dashboard: [['Weekly Priorities', 'scroll:#priority'], ['Class Schedule', 'scroll:#class-schedule'], ['Daily Tasks', 'scroll:#task-panel'], ['Homework Tracker', 'scroll:#homework']],
  college: [['College List', 'tab:colleges'], ['Activities', 'tab:activities'], ['Honors', 'tab:honors'], ['Essays', 'tab:essays'], ['Recommendations', 'tab:recs'], ['Documents', 'tab:docs'], ['Academics', 'tab:gpa'],
    ['Freshman Year', 'tab:gpa:q1', 1], ['Sophomore Year', 'tab:gpa:q2', 1], ['Junior Year', 'tab:gpa:q3', 1], ['Senior Year', 'tab:gpa:q4', 1]]
};
function renderSideNav(name) {
  const items = NAV[name] || [];
  navLabel.style.display = navUl.style.display = items.length ? '' : 'none';
  navUl.innerHTML = items.map(([l, d, sub]) => `<li><a href="#" data-side="${d}"${sub ? ' class="sub-link"' : ''}>${l}</a></li>`).join('');
  $('.sidebar-gpa').style.display = name === 'college' ? '' : 'none';
  markSide();
  renderSideWidgets();
}
function markSide() {
  const links = $$('a', navUl);
  if (!links.length) return;
  if (current === 'college') { links.forEach(a => a.classList.toggle('active', a.dataset.side === `tab:${tab}`)); return; }
  const top = content.getBoundingClientRect().top + 140;
  let act = links[0];
  links.forEach(a => { const t = $(a.dataset.side.split(':')[1]); if (t && t.getBoundingClientRect().top <= top) act = a; });
  links.forEach(a => a.classList.toggle('active', a === act));
}
navUl.addEventListener('click', e => {
  const a = e.target.closest('a[data-side]'); if (!a) return;
  e.preventDefault();
  const [type, val, sub] = a.dataset.side.split(':');
  if (type === 'scroll') { $(val)?.scrollIntoView({ behavior: 'smooth', block: 'start' }); return; }
  tab = val; renderCollege();
  if (sub) { const q = $('#' + sub); if (q && !q.classList.contains('expanded')) toggleQuarter(sub); q?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }
});
content.addEventListener('scroll', markSide, { passive: true });
addEventListener('scroll', markSide, { passive: true });

/* ---------- Sidebar sections (flat lists under the nav) ---------- */
const sw = document.createElement('div');
sw.id = 'side-widgets';
navUl.after(sw);
const stats = (title, rows, pct) => `<div class="side-section"><p class="sidebar-nav-label">${title}</p><ul class="side-stats">${rows.map(([l, v, c]) => `<li><span>${l}</span><b${c ? ` class="${c}"` : ''}>${v}</b></li>`).join('')}</ul>${pct == null ? '' : `<div class="side-bar"><i style="width:${pct}%"></i></div>`}</div>`;
const actions = rows => `<div class="side-section"><p class="sidebar-nav-label">Quick Actions</p><ul>${rows.map(([l, qa]) => `<li><a href="#" data-qa="${qa}">${l}</a></li>`).join('')}</ul></div>`;
const EYE = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg>';
const EYE_OFF = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 3l18 18"/><path d="M10.6 6.1A10 10 0 0112 6c6.5 0 10 6 10 6a17 17 0 01-3.2 3.9M6.6 6.6A17 17 0 002 12s3.5 6 10 6c1.7 0 3.2-.4 4.5-1"/></svg>';

function renderSideWidgets() {
  const today = getTodayDateString();
  let h = '';
  if (current === 'dashboard') {
    const { start, end } = getCurrentWeekRange(today);
    const wk = homework.filter(i => i.dueDate >= start && i.dueDate <= end);
    const done = wk.filter(i => i.done).length;
    const val = t => (!t || t === '0' || t === '0.00') ? '\u2014' : t;
    const hid = data.gpaHidden;
    const fig = (v, l, cls = '') => `<div class="fig ${cls}"><b class="fig-hide">${v}</b><span>${l}</span></div>`;
    h = `<div class="side-section"><p class="sidebar-nav-label">Academic Snapshot</p>
        <div class="side-figures${hid ? ' hidden' : ''}">
          ${fig(val($('#unweighted-gpa').textContent), 'Unweighted')}
          ${fig(val($('#weighted-gpa').textContent), 'Weighted')}
          ${fig(val($('#sat-composite').textContent), 'SAT score', 'wide')}
        </div>
        <button type="button" class="side-toggle" data-qa="scores">${hid ? EYE : EYE_OFF}<span>${hid ? 'Show' : 'Hide'} Academics</span></button>
        <ul class="side-stats"><li><span>Classes today</span><b>${getEffectiveSchedule(WD[new Date().getDay()]).length}</b></li></ul></div>`
      + stats('Weekly Progress', [['Done this week', `${done} / ${wk.length}`], ['Open assignments', homework.filter(i => !i.done).length], ['Day streak', getDisplayStreak()]], wk.length ? Math.round(done / wk.length * 100) : 0)
      + actions([['Add homework', 'hw'], ['Add task', 'task']]);
  } else if (current === 'calendar') {
    const f = CAL.focus;
    const inMonth = homework.filter(i => { if (!i.dueDate || i.done) return false; const d = new Date(`${i.dueDate}T00:00:00`); return d.getMonth() === f.getMonth() && d.getFullYear() === f.getFullYear(); });
    h = stats(f.toLocaleDateString(undefined, { month: 'long', year: 'numeric' }), [
        ['<i class="dot r"></i>Tests', inMonth.filter(i => i.type === 'test').length],
        ['<i class="dot o"></i>Assignments', inMonth.filter(i => i.type === 'assignment').length]])
      + actions([['Add event', 'event']]);
  } else if (current === 'builder') {
    h = builderSide();
  } else if (current === 'college') {
    const L = C.colleges.map(c => { const l = checklist(c); return l.filter(x => x[1]).length / l.length; });
    const avg = L.length ? Math.round(L.reduce((a, b) => a + b, 0) / L.length * 100) : 0;
    h = stats('Application Progress', [
      ['Overall', `${avg}%`],
      ['Colleges', C.colleges.length],
      ['Essays in progress', C.essays.filter(e => ['Outlining', 'Drafting', 'Revising'].includes(e.status)).length],
      ['Upcoming deadlines', deadlineRows().filter(r => r.n >= 0 && !SUBMITTED.includes(r.c.status)).length]], avg);
  }
  sw.innerHTML = h;
}

/* Events don't need a class: relax the Class field and offer a "No class" choice */
const hwType = $('#homework-type'), hwClass = $('#homework-class');
function syncHwClass() {
  const ev = hwType.value === 'event';
  hwClass.required = !ev;
  let o = $('option[value="General"]', hwClass);
  if (ev && !o) { o = new Option('No class (general event)', 'General'); hwClass.add(o, 1); }
  if (!ev && o) { if (hwClass.value === 'General') hwClass.value = ''; o.remove(); }
  if (ev && !hwClass.value) hwClass.value = 'General';
}
const _pop = window.populateHomeworkClasses;
window.populateHomeworkClasses = () => { const cur = hwClass.value; _pop(); syncHwClass(); if (cur === 'General' && hwType.value === 'event') hwClass.value = 'General'; };
hwType.addEventListener('change', syncHwClass);
syncHwClass();

/* Quick actions jump to the existing forms instead of duplicating them */
function focusForm(sectionSel, inputSel, setup) {
  showView('dashboard');
  setTimeout(() => {
    $(sectionSel)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    if (setup) setup();
    $(inputSel)?.focus({ preventScroll: true });
  }, 320);
}
sw.addEventListener('click', e => {
  const a = e.target.closest('[data-qa]'); if (!a) return;
  e.preventDefault();
  const qa = a.dataset.qa;
  if (qa === 'hw') focusForm('#homework', '#homework-name', () => { $('#homework-type').value = 'assignment'; syncHwClass(); });
  else if (qa === 'event') focusForm('#homework', '#homework-name', () => { $('#homework-type').value = 'event'; syncHwClass(); });
  else if (qa === 'task') focusForm('#task-panel', '#task-input');
  else if (qa === 'scores') toggleGpaVisibility();
  else if (qa.startsWith('add:')) { const n = $('#schedule-class-name'); n.value = qa.slice(4); n.scrollIntoView({ behavior: 'smooth', block: 'center' }); n.focus({ preventScroll: true }); }
});

/* ---------- Day Off: a third bell mode that acts as its own separate day ---------- */
/* A class only appears on a Day Off if it's explicitly marked for one, with its own
   start/end time — mirrors how the existing "Affected by Bell Page" option works. */
const msw = $('.mode-switcher');
if (msw && !$('[data-mode="dayoff"]', msw)) msw.insertAdjacentHTML('beforeend', '<button type="button" class="mode-button" data-mode="dayoff" onclick="setBellMode(\'dayoff\')">Day Off</button>');

if (!$('#dayoff-settings')) {
  $('#bell-settings').insertAdjacentHTML('afterend', `
    <label class="editor-full">
      <span>Affected by Day Off Schedule</span>
      <select id="dayoff-affected" onchange="toggleDayOffSettings()">
        <option value="no">No, regular schedule</option>
        <option value="yes">Yes, only meets on a Day Off</option>
      </select>
    </label>
    <div class="bell-settings" id="dayoff-settings">
      <label>Day Off Start Time<input type="time" id="dayoff-start"></label>
      <label>Day Off End Time<input type="time" id="dayoff-end"></label>
      <p class="bell-note">Classes not marked here won't appear when Day Off is selected.</p>
    </div>`);
}
window.toggleDayOffSettings = () => {
  const visible = $('#dayoff-affected').value === 'yes';
  $('#dayoff-settings').classList.toggle('visible', visible);
  $('#dayoff-start').required = visible;
  $('#dayoff-end').required = visible;
};

const _clearSched = window.clearScheduleForm;
window.clearScheduleForm = () => {
  _clearSched();
  $('#dayoff-affected').value = 'no';
  $('#dayoff-settings').classList.remove('visible');
  $('#dayoff-start').required = false;
  $('#dayoff-end').required = false;
};

/* Bell mode + effective-schedule lookups both special-case 'dayoff' now */
window.setBellMode = mode => {
  bellMode = ['hour', 'dayoff'].includes(mode) ? mode : 'normal';
  data.bellMode = bellMode;
  saveData();
  $$('.mode-button').forEach(b => b.classList.toggle('active', b.dataset.mode === bellMode));
  renderSavedSchedule();
  updateTimeRemaining();
  if (current === 'builder') { renderSchedPreview(); renderSideWidgets(); }
};
window.getEffectiveSchedule = dayName => {
  if (bellMode === 'dayoff') {
    return customSchedule.filter(c => c.days.includes(dayName) && c.dayOffAffected)
      .map(c => ({ name: c.name, teacher: c.teacher || '', startTime: c.dayOffStart, endTime: c.dayOffEnd }));
  }
  return customSchedule.filter(c => c.days.includes(dayName)).map(c => {
    const useBell = bellMode === 'hour' && c.bellAffected;
    return { name: c.name, teacher: c.teacher || '', startTime: useBell ? c.bellStart : c.start, endTime: useBell ? c.bellEnd : c.end };
  });
};

/* Capture the Day Off fields (and validate them) before the original submit
   handler resets the form — a capture-phase listener on document always runs
   before a plain listener on the form itself. */
let pendingDayOff = null, prevSchedLen = customSchedule.length;
document.addEventListener('submit', e => {
  if (e.target.id !== 'schedule-form') return;
  const wants = $('#dayoff-affected').value === 'yes';
  const s = $('#dayoff-start').value, en = $('#dayoff-end').value;
  if (wants && (!s || !en || s >= en)) {
    e.preventDefault(); e.stopImmediatePropagation();
    alert('Enter valid Day Off start and end times.');
    pendingDayOff = null;
    return;
  }
  pendingDayOff = wants ? { start: s, end: en } : null;
  prevSchedLen = customSchedule.length;
}, true);

/* ---------- Schedule Builder: preview, smart sidebar, conflicts, undo, templates ---------- */
const SB = { view: 'week', day: WD[new Date().getDay()] };
const dayList = d => getEffectiveSchedule(d).sort((a, b) => timeToMinutes(a.startTime) - timeToMinutes(b.startTime));
const rng = c => `${formatStoredTime(c.startTime)}\u2013${formatStoredTime(c.endTime)}`;
const dur = m => m >= 60 ? `${Math.floor(m / 60)}h${m % 60 ? ` ${m % 60}m` : ''}` : `${m} min`;
const isLunch = c => /lunch/i.test(c.name);
const mins = c => timeToMinutes(c.endTime) - timeToMinutes(c.startTime);

function conflicts() {
  const out = [];
  DAYS.forEach(d => {
    const L = dayList(d);
    for (let i = 0; i < L.length; i++) for (let j = i + 1; j < L.length; j++)
      if (timeToMinutes(L[j].startTime) < timeToMinutes(L[i].endTime) && timeToMinutes(L[i].startTime) < timeToMinutes(L[j].endTime)) out.push([d, L[i], L[j]]);
  });
  return out;
}

/* Undo history: every change to the schedule (add, delete, reset, template) is snapshotted */
const TK = 'studentDashboardTemplatesV1';
let T = []; try { T = JSON.parse(localStorage.getItem(TK)) || []; } catch {}
const saveT = () => { try { localStorage.setItem(TK, JSON.stringify(T)); } catch {} };
let hist = [], snap = JSON.stringify(customSchedule), restoring = false;
const _rs = window.renderSavedSchedule;
window.renderSavedSchedule = () => {
  if (pendingDayOff && customSchedule.length === prevSchedLen + 1) {
    const c = customSchedule[customSchedule.length - 1];
    c.dayOffAffected = true; c.dayOffStart = pendingDayOff.start; c.dayOffEnd = pendingDayOff.end;
    data.schedule = customSchedule; saveData();
  }
  pendingDayOff = null;
  _rs();
  $$('#saved-schedule-list .saved-class').forEach((row, i) => {
    const c = customSchedule[i], small = $('small', row);
    if (c?.dayOffAffected && small && !small.textContent.includes('Day off')) small.append(' · Day off');
  });
  const now = JSON.stringify(customSchedule);
  if (now !== snap && !restoring) { hist.push(snap); if (hist.length > 30) hist.shift(); }
  snap = now;
  renderSchedPreview();
  if (current === 'builder') renderSideWidgets();
};
function setSchedule(arr) {
  restoring = true;
  customSchedule = arr; data.schedule = arr; saveData();
  renderSavedSchedule(); populateHomeworkClasses(); updateTimeRemaining();
  restoring = false;
}

/* Preview panel at the top of the builder page (Week / Day / List) */
const pv = document.createElement('section');
pv.className = 'ui-panel'; pv.id = 'sched-preview';
views.builder.prepend(pv);
function renderSchedPreview() {
  let body;
  if (!customSchedule.length) body = '<div class="schedule-empty">No classes yet. Add one with the form below.</div>';
  else if (SB.view === 'week') body = `<div class="pv-week">${DAYS.map(d => `<div class="pv-col${d === SB.day ? ' sel' : ''}"><h4>${d.slice(0, 3)}</h4>${dayList(d).map(c => `<div class="pv-item"><span>${formatStoredTime(c.startTime)}</span>${escapeHtml(c.name)}</div>`).join('') || '<div class="pv-none">Free</div>'}</div>`).join('')}</div>`;
  else if (SB.view === 'day') body = `<div class="schedule-list">${dayList(SB.day).map(c => `<div class="pv-row"><b>${escapeHtml(c.name)}</b><span>${rng(c)}</span><span>${dur(mins(c))}</span></div>`).join('') || `<div class="schedule-empty">No classes on ${SB.day}.</div>`}</div>`;
  else body = `<div class="schedule-list">${[...customSchedule].sort((a, b) => a.name.localeCompare(b.name)).map(c => `<div class="pv-row"><b>${escapeHtml(c.name)}</b><span>${c.days.map(d => d.slice(0, 3)).join(' ')}</span><span>${formatStoredTime(c.start)}\u2013${formatStoredTime(c.end)}</span></div>`).join('')}</div>`;
  pv.innerHTML = `<div class="panel-heading"><div class="panel-heading-main"><h2>Schedule Preview</h2></div><div class="panel-heading-side"><span class="day-pill">${SB.view === 'day' ? SB.day : SB.view[0].toUpperCase() + SB.view.slice(1)}</span></div></div>${body}`;
}

function builderSide() {
  const L = dayList(SB.day), isToday = SB.day === WD[new Date().getDay()], nowM = getSecondsNow() / 60;
  const cls = L.filter(c => !isLunch(c)), lunch = L.filter(isLunch);
  const total = cls.reduce((a, c) => a + mins(c), 0), lunchM = lunch.reduce((a, c) => a + mins(c), 0);
  const sec = (t, inner) => `<div class="side-section"><p class="sidebar-nav-label">${t}</p>${inner}</div>`;
  const seg = (kind, opts, cur) => `<div class="side-seg">${opts.map(([v, l]) => `<button type="button" class="${v === cur ? 'on' : ''}" data-sb="${kind}|${v}">${l}</button>`).join('')}</div>`;
  const conf = conflicts();
  const list = L.length
    ? `<ul class="sched-list">${L.map(c => `<li class="sched-row${isToday && timeToMinutes(c.startTime) <= nowM && nowM < timeToMinutes(c.endTime) ? ' now' : ''}"><span>${formatStoredTime(c.startTime)}</span><b title="${escapeHtml(c.name)}">${escapeHtml(c.name)}</b></li>`).join('')}</ul>`
    : `<p class="side-note">No classes on ${SB.day}.</p>`;
  const rows = [['Classes', cls.length], ['Average class', cls.length ? dur(Math.round(total / cls.length)) : '\u2014'], ['Scheduled', dur(total)]];
  if (lunch.length) rows.push(['Lunch', dur(lunchM)]);
  if (L.length) rows.push(['School ends', formatStoredTime(L.map(c => c.endTime).sort().pop())]);
  const tpl = T.length ? `<ul class="tpl-list">${T.map(t => `<li class="tpl"><a href="#" data-sb="tpl-load|${t.id}">${escapeHtml(t.name)}</a><button type="button" class="tpl-del" data-sb="tpl-del|${t.id}" aria-label="Delete template ${escapeHtml(t.name)}">\u00d7</button></li>`).join('')}</ul>` : '';
  return sec('Current Schedule', `<p class="side-note strong">${SB.day}${isToday ? ', ' + new Date().toLocaleDateString(undefined, { month: 'long', day: 'numeric' }) : ''}</p>${list}`)
    + (L.length ? stats('Schedule Stats', rows) : '')
    + sec('Controls', `<p class="side-note">View</p>${seg('view', [['week', 'Week'], ['day', 'Day'], ['list', 'List']], SB.view)}<p class="side-note">Bell schedule</p>${seg('bell', [['normal', 'Regular'], ['hour', '1-hour'], ['dayoff', 'Day off']], bellMode)}<p class="side-note">Day</p><div class="side-days">${DAYS.map(d => `<button type="button" class="${d === SB.day ? 'on' : ''}" data-sb="day|${d}" aria-label="${d}" title="${d}">${d[0]}</button>`).join('')}</div>`)
    + actions([['Class', 'add:'], ['Event', 'add:Event: '], ['Study session', 'add:Study session: '], ['Activity', 'add:Activity: ']])
    + sec('Conflicts', conf.length
        ? `<ul class="conf-list">${conf.slice(0, 4).map(([d, a, b]) => `<li><b>${d}</b><span>${escapeHtml(a.name)} ${rng(a)}</span><span>overlaps ${escapeHtml(b.name)} ${rng(b)}</span></li>`).join('')}</ul>${conf.length > 4 ? `<p class="side-note">+${conf.length - 4} more</p>` : ''}`
        : '<p class="side-note ok">No conflicts detected.</p>')
    + sec('Manage', `<p class="side-note">Changes save automatically.</p><button type="button" class="side-btn" data-sb="undo" ${hist.length ? '' : 'disabled'}>Undo last change</button><button type="button" class="side-btn" data-sb="reset" ${customSchedule.length ? '' : 'disabled'}>Reset schedule</button><p class="side-note">Templates</p>${tpl}<button type="button" class="side-btn" data-sb="tpl-save" ${customSchedule.length ? '' : 'disabled'}>Save as template</button>`);
}

sw.addEventListener('click', e => {
  const b = e.target.closest('[data-sb]'); if (!b) return;
  e.preventDefault();
  const [k, v] = b.dataset.sb.split('|');
  if (k === 'view') { SB.view = v; renderSchedPreview(); renderSideWidgets(); }
  else if (k === 'day') { SB.day = v; renderSchedPreview(); renderSideWidgets(); }
  else if (k === 'bell') setBellMode(v);
  else if (k === 'undo') { const prev = hist.pop(); if (prev) setSchedule(JSON.parse(prev)); }
  else if (k === 'reset') { if (confirm('Remove every class from your schedule? You can undo this.')) { hist.push(snap); setSchedule([]); } }
  else if (k === 'tpl-save') { const n = (prompt('Template name') || '').trim(); if (n) { T.push({ id: uid(), name: n, classes: JSON.parse(snap) }); saveT(); renderSideWidgets(); } }
  else if (k === 'tpl-load') { const t = T.find(x => String(x.id) === v); if (t && confirm(`Replace your schedule with "${t.name}"? You can undo this.`)) { hist.push(snap); setSchedule(t.classes.map(c => ({ ...c, id: uid() }))); } }
  else if (k === 'tpl-del') { T = T.filter(x => String(x.id) !== v); saveT(); renderSideWidgets(); }
});
renderSchedPreview();

/* ---------- Boot ---------- */
setInterval(renderOverview, 30000);
const start = location.hash.replace('#/', '');
showView(views[start] ? start : 'dashboard');
})(); 