/* Palumbo Student Interface — core logic: GPA, tasks, homework, schedule, priority dashboard.
   v3.js and gym.js load after this file and build on the globals defined here. */

const STORAGE_KEY = "studentDashboardDataV2";
const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const DENSITIES = ["light", "moderate", "heavy", "intense"];
const TYPES = ["assignment", "test", "event"];
const BELL_MODES = ["normal", "hour", "dayoff"];
const byId = id => document.getElementById(id);

/* ---------- Dates ---------- */
const dateKey = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const parseDate = s => new Date(`${s}T00:00:00`);
function getTodayDateString() { return dateKey(new Date()); }
function dateToKey(year, month, day) { return dateKey(new Date(year, month, day)); }
function addDaysToDateString(s, n) { const d = parseDate(s); d.setDate(d.getDate() + n); return dateKey(d); }
function daysUntil(due, from) { return Math.round((parseDate(due) - parseDate(from)) / 86400000); }
function formatDueDate(s) { return s ? parseDate(s).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }) : ""; }
/* Sunday-through-Saturday week containing today */
function getCurrentWeekRange(today) {
    const start = addDaysToDateString(today, -parseDate(today).getDay());
    return { start, end: addDaysToDateString(start, 6) };
}

/* ---------- Storage ---------- */
function loadData() {
    let s; try { s = JSON.parse(localStorage.getItem(STORAGE_KEY)); } catch {}
    if (!s || typeof s !== "object") s = {};
    const arr = v => Array.isArray(v) ? v : [];
    const str = v => typeof v === "string" ? v : null;
    const num = v => Number.isFinite(v) ? v : null;
    return {
        classes: arr(s.classes),
        tasks: arr(s.tasks),
        /* Every field of a saved class survives (`...c`). periodId is absent until the migration places the class; "" means "no period" */
        schedule: arr(s.schedule).filter(c => c && typeof c === "object").map(c => {
            const x = { ...c, days: arr(c.days), teacher: String(c.teacher ?? "").trim(), room: String(c.room ?? "").trim(), period: String(c.period ?? "").trim(), rotation: c.rotation === "A" || c.rotation === "B" ? c.rotation : "" };
            if (c.periodId === "" || PSI_BELL.isPeriod(c.periodId)) x.periodId = c.periodId; else delete x.periodId;
            return x;
        }),
        homework: arr(s.homework).map(h => ({
            ...h,
            density: DENSITIES.includes(h.density) ? h.density : "moderate",
            type: TYPES.includes(h.type) ? h.type : "assignment"
        })),
        bellMode: BELL_MODES.includes(s.bellMode) ? s.bellMode : "normal",
        sched: { version: Number.isInteger(s.sched?.version) ? s.sched.version : 0, migratedAt: str(s.sched?.migratedAt) || "", mapped: num(s.sched?.mapped) ?? 0, extra: num(s.sched?.extra) ?? 0, pending: num(s.sched?.pending) ?? 0, backup: Boolean(s.sched?.backup),
            review: arr(s.sched?.review).filter(r => r && typeof r === "object" && "id" in r).map(r => ({ id: r.id, name: String(r.name ?? ""), reason: String(r.reason ?? "") })) },   // what the periods migration did, and what it left for review
        bell: PSI_BELL.normalizeConfig(s.bell),   // A/B rotation, non-school dates, date overrides: the person's own data, apart from the imported sheet
        gpaHidden: Boolean(s.gpaHidden),
        sat: { math: num(s.sat?.math), reading: num(s.sat?.reading) },
        lastAutoClear: str(s.lastAutoClear),
        lastTaskReset: str(s.lastTaskReset),
        streak: { count: num(s.streak?.count) ?? 0, lastDate: str(s.streak?.lastDate) }
    };
}

let data = loadData();
let tasks = data.tasks;
let homework = data.homework;
let customSchedule = data.schedule;
let bellMode = data.bellMode;   // fallback schedule only; see "Which schedule applies"
PSI_BELL.bind(() => data.bell);

function saveData() { try { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); } catch {} }
function saveTasks() { data.tasks = tasks; saveData(); }
function saveHomework() { data.homework = homework; saveData(); }
function saveSchedule() { data.schedule = customSchedule; saveData(); }

function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[c]));
}

/* ---------- GPA ---------- */
const gradeToPoints = [[93, 4.0], [90, 3.7], [87, 3.3], [83, 3.0], [80, 2.7], [77, 2.3], [73, 2.0], [70, 1.7], [67, 1.3], [63, 1.0], [60, 0.7], [0, 0]];
const classLevelAdjustment = { normal: 0, honors: 0.6, ap: 0.8 };
const levelLabel = { honors: "Honors", ap: "AP" };
const pointsFor = grade => gradeToPoints.find(([min]) => grade >= min)[1];

function renderClasses() {
    document.querySelectorAll(".course-list").forEach(list => list.innerHTML = "");
    data.classes.forEach(course => {
        const list = document.querySelector(`#${course.quarter} .course-list`);
        if (!list) return;
        const item = document.createElement("li");
        item.className = "course-item";
        item.innerHTML = `
            <span class="course-item-name">${escapeHtml(course.name)} <span class="course-item-meta">${course.creditHours} ${course.creditHours === 1 ? "credit" : "credits"}${levelLabel[course.classLevel] ? ` · ${levelLabel[course.classLevel]}` : ""}</span> <span class="course-item-grade"><span class="sr-only">Grade: </span>${course.grade}</span></span>
            <div class="course-item-actions">
                <button class="edit-btn" type="button">Edit</button>
                <button class="delete-btn" type="button">Delete</button>
            </div>`;
        item.querySelector(".delete-btn").addEventListener("click", () => {
            data.classes = data.classes.filter(c => c.id !== course.id);
            saveData(); renderClasses();
        });
        item.querySelector(".edit-btn").addEventListener("click", () => enterCourseEditMode(item, course));
        list.appendChild(item);
    });
    document.querySelectorAll(".course-list").forEach(list => {
        if (!list.children.length) list.innerHTML = '<li class="empty-course-list">No classes added yet.</li>';
    });
    calculateGPA();
}

function enterCourseEditMode(item, course) {
    item.innerHTML = `
        <div class="course-edit-form">
            <span class="course-item-name">${escapeHtml(course.name)}</span>
            <input type="number" class="edit-grade" value="${course.grade}" min="0" max="100">
            <button type="button" class="save-edit-btn">Save</button>
            <button type="button" class="secondary-button cancel-edit-btn">Cancel</button>
        </div>`;
    item.querySelector(".save-edit-btn").addEventListener("click", () => {
        const grade = parseFloat(item.querySelector(".edit-grade").value);
        if (!Number.isFinite(grade) || grade < 0 || grade > 100) return alert("Enter a valid grade from 0 to 100.");
        course.grade = grade;
        saveData(); renderClasses();
    });
    item.querySelector(".cancel-edit-btn").addEventListener("click", renderClasses);
}

function calculateGPA() {
    let credits = 0, unweighted = 0, weighted = 0;
    data.classes.forEach(c => {
        const pts = pointsFor(c.grade);
        credits += c.creditHours;
        unweighted += pts * c.creditHours;
        weighted += (pts + (classLevelAdjustment[c.classLevel] ?? 0)) * c.creditHours;
    });
    byId("unweighted-gpa").textContent = credits ? (unweighted / credits).toFixed(2) : "0.00";
    byId("weighted-gpa").textContent = credits ? (weighted / credits).toFixed(2) : "0.00";
    renderPriorityDashboard();
}

byId("add-class-form").addEventListener("submit", event => {
    event.preventDefault();
    const name = byId("class-name").value.trim();
    const creditHours = parseFloat(byId("credit-hours").value);
    const grade = parseFloat(byId("grade").value);
    if (!name || !Number.isFinite(creditHours) || creditHours <= 0 || !Number.isFinite(grade) || grade < 0 || grade > 100) {
        return alert("Please provide a class name, valid credit hours, and a grade from 0 to 100.");
    }
    data.classes.push({ id: Date.now() + Math.random(), name, creditHours, grade, quarter: byId("quarter").value, classLevel: byId("class-level").value });
    saveData(); renderClasses();
    event.target.reset();
});

function toggleQuarter(id) { byId(id)?.classList.toggle("expanded"); }
function toggleDropdown(id) { byId(id)?.classList.toggle("expanded"); }

function toggleGpaVisibility() {
    data.gpaHidden = !data.gpaHidden;
    saveData();
    applyGpaVisibility();
}
function applyGpaVisibility() {
    byId("gpa-values")?.classList.toggle("hidden", data.gpaHidden);
    const btn = byId("gpa-toggle-btn");
    if (btn) btn.textContent = data.gpaHidden ? "Show GPA" : "Hide GPA";
    renderPriorityDashboard();
}

/* ---------- SAT ---------- */
function updateSatComposite(save = true) {
    const read = id => { const n = parseInt(byId(id).value, 10); return Number.isFinite(n) ? n : null; };
    const math = read("sat-math"), reading = read("sat-reading");
    byId("sat-composite").textContent = (math ?? 0) + (reading ?? 0);
    if (save) { data.sat = { math, reading }; saveData(); }
}
function loadSatInputs() {
    byId("sat-math").value = data.sat.math ?? "";
    byId("sat-reading").value = data.sat.reading ?? "";
    updateSatComposite(false);
}
["sat-math", "sat-reading"].forEach(id => byId(id).addEventListener("input", () => updateSatComposite(true)));

/* ---------- Daily tasks ---------- */
/* Tasks stay, but anything checked off on a previous day is unchecked when a new day starts.
   The very first run only stamps today's date. */
function maybeResetDailyTasks() {
    const today = getTodayDateString();
    if (data.lastTaskReset === today) return;
    if (data.lastTaskReset !== null) tasks.forEach(t => { t.done = false; });
    data.lastTaskReset = today;
    saveTasks();
    renderTasks();
}

function renderTasks() {
    const list = byId("task-list");
    list.innerHTML = "";
    if (!tasks.length) list.innerHTML = '<div class="task-empty">Chod do something today please...</div>';
    tasks.forEach(task => {
        const item = document.createElement("label");
        item.className = `task-item${task.done ? " done" : ""}`;
        item.innerHTML = `<input type="checkbox" ${task.done ? "checked" : ""} aria-label="Complete task"><span>${escapeHtml(task.text)}</span>`;
        item.querySelector("input").addEventListener("change", e => {
            task.done = e.target.checked;
            if (task.done) recordDailyActivity();
            saveTasks(); renderTasks();
        });
        list.appendChild(item);
    });
    byId("task-progress").textContent = `${tasks.filter(t => t.done).length} / ${tasks.length}`;
    window.renderOverview?.();
}

byId("task-form").addEventListener("submit", event => {
    event.preventDefault();
    const input = byId("task-input"), text = input.value.trim();
    if (!text) return;
    tasks.push({ id: Date.now() + Math.random(), text, done: false });
    saveTasks();
    input.value = "";
    renderTasks();
    input.focus();
});

function deleteCompletedTasks() {
    const count = tasks.filter(t => t.done).length;
    if (!count) return alert("There are no completed tasks to delete.");
    if (!confirm(`Delete ${count} completed task${count === 1 ? "" : "s"}?`)) return;
    tasks = tasks.filter(t => !t.done);
    saveTasks(); renderTasks();
}

/* ---------- Streak ---------- */
/* Counts consecutive days with at least one task or homework item checked off. */
function recordDailyActivity() {
    const today = getTodayDateString();
    if (data.streak.lastDate === today) return;
    data.streak.count = data.streak.lastDate === addDaysToDateString(today, -1) ? data.streak.count + 1 : 1;
    data.streak.lastDate = today;
    saveData();
    renderPriorityDashboard();
}
/* A multi-day gap displays as 0 instead of a stale number. */
function getDisplayStreak() {
    const last = data.streak.lastDate, today = getTodayDateString();
    return last === today || last === addDaysToDateString(today, -1) ? data.streak.count : 0;
}

/* ---------- Homework ---------- */
const priorityRank = { veryhigh: 0, high: 1, medium: 2, low: 3 };
const priorityLabel = { veryhigh: "Very High", high: "High", medium: "Medium", low: "Low" };
const densityRank = { intense: 0, heavy: 1, moderate: 2, light: 3 };
const densityLabel = { intense: "Intense", heavy: "Heavy", moderate: "Moderate", light: "Light" };
const typeLabel = { assignment: "Assignment", test: "Test / Quiz", event: "Event" };
const typeTag = { test: "TEST", event: "EVENT" };
const densityWeight = { light: 1, moderate: 2, heavy: 3, intense: 4 };

function computePriority(dueDate, density = "moderate") {
    if (!dueDate) return "low";
    const diff = daysUntil(dueDate, getTodayDateString());
    if (diff <= 0) return "veryhigh";
    const pressure = (densityWeight[density] ?? 2) / (diff + 1);
    return pressure >= 1.5 ? "veryhigh" : pressure >= 0.75 ? "high" : pressure >= 0.4 ? "medium" : "low";
}

function getClassNamesForHomework() {
    return [...new Set(customSchedule.map(c => String(c.name || "").trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b));
}

const hwType = byId("homework-type"), hwClass = byId("homework-class");

/* Events don't need a class: relax the Class field and offer a "No class" choice */
function syncHwClass() {
    const ev = hwType.value === "event";
    hwClass.required = !ev;
    let general = hwClass.querySelector('option[value="General"]');
    if (ev && !general) hwClass.add(new Option("No class (general event)", "General"), 1);
    if (!ev && general) { if (hwClass.value === "General") hwClass.value = ""; general.remove(); }
    if (ev && !hwClass.value) hwClass.value = "General";
}
hwType.addEventListener("change", syncHwClass);

function populateHomeworkClasses() {
    const current = hwClass.value, names = getClassNamesForHomework();
    hwClass.innerHTML = `<option value="">${names.length ? "Select a class" : "Add a class first"}</option>`;
    names.forEach(n => hwClass.add(new Option(n, n)));
    if (names.includes(current)) hwClass.value = current;
    syncHwClass();
    if (current === "General" && hwType.value === "event") hwClass.value = "General";
}

function homeworkSort(a, b) {
    const today = getTodayDateString();
    const overdue = h => !h.done && h.dueDate && h.dueDate < today;
    return (Number(!!a.done) - Number(!!b.done))
        || (Number(overdue(b)) - Number(overdue(a)))
        || (priorityRank[computePriority(a.dueDate, a.density)] - priorityRank[computePriority(b.dueDate, b.density)])
        || ((densityRank[a.density] ?? 2) - (densityRank[b.density] ?? 2))
        || (a.dueDate || "9999-12-31").localeCompare(b.dueDate || "9999-12-31")
        || String(a.name).localeCompare(String(b.name));
}

function renderHomework() {
    const list = byId("homework-list"), today = getTodayDateString();
    list.innerHTML = homework.length ? "" : '<div class="homework-empty">No homework added yet. You are all caught up.</div>';

    [...homework].sort(homeworkSort).forEach(item => {
        const overdue = !item.done && item.dueDate < today;
        const priority = computePriority(item.dueDate, item.density);
        const density = DENSITIES.includes(item.density) ? item.density : "moderate";
        const row = document.createElement("div");
        row.className = `homework-item${item.done ? " completed" : ""}${overdue ? " overdue" : ""}`;
        row.dataset.homeworkId = item.id;
        row.innerHTML = `
            <div class="homework-main">
                <div class="homework-name">${escapeHtml(item.name)}</div>
                <div class="homework-meta">
                    <span>${escapeHtml(item.className)}</span>
                    <span>•</span>
                    <span>Due ${escapeHtml(formatDueDate(item.dueDate))}</span>
                    ${overdue ? '<span class="homework-badge overdue">Overdue</span>' : ""}
                    <span class="homework-badge ${priority}">Priority: ${priorityLabel[priority]}</span>
                    <span class="homework-badge ${density}">Density: ${densityLabel[density]}</span>
                    ${item.type !== "assignment" ? `<span class="homework-badge ${escapeHtml(item.type)}">${escapeHtml(typeLabel[item.type] || "Assignment")}</span>` : ""}
                </div>
            </div>
            <div class="homework-actions">
                <input type="checkbox" ${item.done ? "checked" : ""} aria-label="Complete homework">
                <button class="danger-button" type="button" aria-label="Delete homework">Delete</button>
            </div>`;
        row.querySelector("input").addEventListener("change", e => {
            item.done = e.target.checked;
            if (item.done) recordDailyActivity();
            saveHomework(); renderHomework();
        });
        row.querySelector("button").addEventListener("click", () => {
            homework = homework.filter(h => h.id !== item.id);
            saveHomework(); renderHomework();
        });
        list.appendChild(row);
    });

    byId("homework-progress").textContent = `${homework.filter(h => h.done).length} / ${homework.length}`;
    populateHomeworkClasses();
    window.renderCalendar?.();
    renderPriorityDashboard();
}

byId("homework-form").addEventListener("submit", event => {
    event.preventDefault();
    const name = byId("homework-name").value.trim(), className = hwClass.value, dueDate = byId("homework-due").value;
    if (!name || !className || !dueDate) return alert("Please enter the homework name, class, and due date.");
    homework.push({
        id: Date.now() + Math.random(), name, className, dueDate, done: false,
        density: byId("homework-density").value,
        type: TYPES.includes(hwType.value) ? hwType.value : "assignment"
    });
    saveHomework();
    event.target.reset();
    byId("homework-density").value = "moderate";
    hwType.value = "assignment";
    renderHomework();
});

/* Completed homework is cleared on Sundays, at most once per calendar day. */
function maybeAutoClearCompletedHomework() {
    const today = getTodayDateString();
    if (parseDate(today).getDay() !== 0 || data.lastAutoClear === today) return;
    const hadCompleted = homework.some(h => h.done);
    homework = homework.filter(h => !h.done);
    data.lastAutoClear = today;
    saveHomework();
    if (hadCompleted) renderHomework();
}

/* Used by the calendar and the college workspace to jump to an assignment row */
function jumpToHomeworkItem(id) {
    window.showView?.("dashboard");
    setTimeout(() => {
        byId("homework")?.scrollIntoView({ behavior: "smooth", block: "start" });
        setTimeout(() => {
            const row = document.querySelector(`.homework-item[data-homework-id="${id}"]`);
            if (!row) return;
            row.classList.add("flash");
            setTimeout(() => row.classList.remove("flash"), 1600);
        }, 300);
    }, 320);
}

/* ---------- Priority dashboard ---------- */
function relativeDueLabel(diff) {
    if (diff < 0) return "Overdue";
    if (diff === 0) return "Due today";
    if (diff === 1) return "Due tomorrow";
    const date = addDaysToDateString(getTodayDateString(), diff);
    return diff <= 6 ? `Due ${DAY_NAMES[parseDate(date).getDay()]}` : `Due ${formatDueDate(date)}`;
}
function urgencyBucket(diff) { return diff <= 0 ? "red" : diff === 1 ? "orange" : diff <= 4 ? "yellow" : "green"; }
const plural = (n, w) => `${n} ${w}${n === 1 ? "" : "s"}`;

function renderPriorityDashboard() {
    const listEl = byId("priority-today-list"), statsEl = byId("priority-stats");
    if (!listEl || !statsEl) return;
    const today = getTodayDateString();
    const open = homework.filter(h => !h.done && h.dueDate);
    const diffOf = h => daysUntil(h.dueDate, today);

    /* Due soon: overdue always, assignments within 7 days, tests/events within 14 */
    const dueSoon = open
        .filter(h => diffOf(h) < 0 || diffOf(h) <= (h.type === "assignment" ? 7 : 14))
        .sort((a, b) => priorityRank[computePriority(a.dueDate, a.density)] - priorityRank[computePriority(b.dueDate, b.density)] || a.dueDate.localeCompare(b.dueDate));

    listEl.innerHTML = dueSoon.length ? "" : '<div class="priority-empty">Nothing due soon. Nice.</div>';
    dueSoon.forEach(h => {
        const diff = diffOf(h), row = document.createElement("div");
        row.className = `priority-item ${urgencyBucket(diff)}`;
        row.innerHTML = `
            <span class="priority-item-main">
                <span class="priority-item-class">${escapeHtml(h.name)}${typeTag[h.type] ? ` <span class="priority-tag priority-tag-${escapeHtml(h.type)}">${typeTag[h.type]}</span>` : ""}</span>
                <span class="priority-item-task">${escapeHtml(h.className)} — ${escapeHtml(relativeDueLabel(diff))}</span>
            </span>`;
        listEl.appendChild(row);
    });

    const overdueCount = open.filter(h => diffOf(h) < 0).length;
    const dueNext7 = open.filter(h => diffOf(h) >= 0 && diffOf(h) <= 7);
    const testsNext14 = open.filter(h => h.type === "test" && diffOf(h) >= 0 && diffOf(h) <= 14);

    statsEl.innerHTML = `
        <div class="priority-stat"><span class="priority-stat-value">${dueNext7.length}</span><span class="priority-stat-label">${plural(dueNext7.length, "assignment")} due in 7 days</span></div>
        <div class="priority-stat"><span class="priority-stat-value">${testsNext14.length}</span><span class="priority-stat-label">${plural(testsNext14.length, "test")} in 14 days</span></div>
        <div class="priority-stat streak"><span class="priority-stat-value">${getDisplayStreak()}</span><span class="priority-stat-label">day streak</span></div>`;

    const pill = byId("priority-overdue-pill");
    if (pill) {
        pill.textContent = overdueCount ? `${overdueCount} Overdue` : "All caught up";
        pill.classList.toggle("overdue-pill", overdueCount > 0);
    }

    /* This week's progress bar (Sun–Sat): green = done, red = overdue and still open */
    const barEl = byId("priority-workload-bar"), overdueBar = byId("priority-workload-overdue"), countEl = byId("priority-workload-count");
    if (barEl && countEl) {
        const { start, end } = getCurrentWeekRange(today);
        const week = homework.filter(h => h.dueDate >= start && h.dueDate <= end);
        const total = week.length, done = week.filter(h => h.done).length;
        const late = week.filter(h => !h.done && h.dueDate < today).length;
        const pct = n => total ? Math.round(n / total * 100) : 0;
        barEl.style.width = `${pct(done)}%`;
        if (overdueBar) overdueBar.style.width = `${pct(late)}%`;
        barEl.classList.toggle("is-empty", total === 0);
        barEl.classList.toggle("is-complete", total > 0 && done === total);
        countEl.textContent = total ? `${done} / ${total} done (${pct(done)}%)${late ? ` · ${late} overdue` : ""}` : "Nothing due this week";
    }

    /* Insight banner */
    const insightEl = byId("priority-insight");
    if (insightEl) {
        const byDate = {};
        dueNext7.forEach(h => (byDate[h.dueDate] = byDate[h.dueDate] || []).push(h));
        const busiest = Object.keys(byDate).sort((a, b) => byDate[b].length - byDate[a].length)[0];
        const tomorrow = byDate[addDaysToDateString(today, 1)] || [];
        const todayCount = byDate[today]?.length ?? 0;
        let cls, html;
        if (overdueCount) {
            cls = "red"; html = `<strong>${plural(overdueCount, "overdue item")}</strong> — clear these first.`;
        } else if (busiest && byDate[busiest].length >= 3) {
            const day = busiest === today ? "Today" : DAY_NAMES[parseDate(busiest).getDay()];
            const classes = new Set(byDate[busiest].map(h => h.className)).size;
            cls = "orange"; html = `<strong>Busy ${escapeHtml(day)}</strong> — you have ${byDate[busiest].length} assignments due across ${plural(classes, "class").replace("classs", "classes")}.`;
        } else if (tomorrow.length) {
            cls = "yellow"; html = `<strong>Tomorrow</strong> — ${plural(tomorrow.length, "assignment")}${tomorrow.some(h => h.type === "test") ? " + a test" : ""}.`;
        } else if (todayCount) {
            cls = "yellow"; html = `<strong>Today</strong> — ${plural(todayCount, "item")} due.`;
        } else {
            cls = "green"; html = "You're clear for the next 7 days. Nice.";
        }
        insightEl.className = `priority-insight ${cls}`;
        insightEl.innerHTML = html;
    }

    window.renderOverview?.();
}

/* ---------- Schedule ---------- */
function formatStoredTime(value) {
    if (!value) return "";
    const [h, m] = value.split(":").map(Number);
    return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${h >= 12 ? "PM" : "AM"}`;
}
function timeToMinutes(time) { const [h, m] = time.split(":").map(Number); return h * 60 + m; }
function timeToSeconds(time) { return timeToMinutes(time) * 60; }
function getSecondsNow() { const n = new Date(); return n.getHours() * 3600 + n.getMinutes() * 60 + n.getSeconds(); }
/* Durations. The one formatter every duration in PSI goes through.
   short: "5 min", "1 hr", "1 hr 30 min", "8 hr 20 min"   long: "1 hour 30 minutes"
   Whole minutes only (rounded to nearest); zero, negative and non-numeric input read as "0 min". */
function formatDuration(totalMinutes, style = "short") {
    const mins = Math.round(Number(totalMinutes));
    const long = style === "long";
    const unit = (n, short, word) => long ? `${n} ${word}${n === 1 ? "" : "s"}` : `${n} ${short}`;
    if (!Number.isFinite(mins) || mins <= 0) return unit(0, "min", "minute");
    const h = Math.floor(mins / 60), m = mins % 60;
    return [h && unit(h, "hr", "hour"), m && unit(m, "min", "minute")].filter(Boolean).join(" ");
}
/* Time until a future moment, from seconds. Rounds UP to the minute so it never reads "0 min" before the event. */
const formatUntil = (seconds, style) => formatDuration(Math.ceil(Math.max(0, seconds) / 60), style);
/* Live countdown text, used by the tab title, the Up Next card and the schedule list so they always read the same.
   "1:18:05" (an hour or more), "18:42" (under an hour), "45 sec" (under a minute). Whole seconds; negative reads as "0 sec". */
function formatRemaining(seconds) {
    const s = Math.max(0, Math.floor(Number(seconds) || 0));
    if (s < 60) return `${s} sec`;
    const h = Math.floor(s / 3600), m = Math.floor(s % 3600 / 60), pad = n => String(n).padStart(2, "0");
    return h ? `${h}:${pad(m)}:${pad(s % 60)}` : `${m}:${pad(s % 60)}`;
}

/* "Ms. Rivera · Room 214": the optional teacher and room of a class, as shown under its name. A bare number or short code
   reads as "Room 214"; anything else the person typed ("Gym", "Lab B") is shown as written. Empty when neither is set. */
const roomLabel = room => { room = String(room || "").trim(); return !room ? "" : /^[A-Za-z]?\d[\w-]{0,5}$/.test(room) ? `Room ${room}` : room; };
const classMeta = c => [c.teacher, roomLabel(c.room)].filter(Boolean).join(" · ");

/* ---------- Which schedule applies ---------- */
/* Schedule ids: "normal" | "hour" | "dayoff" (built from the person's own classes) or "imp:<slug>" (imported from the official
   sheet, see psi-bell.js, which also decides which one applies on a date). `bellMode` is now only the fallback used when
   neither an override, the A/B rotation nor the sheet says otherwise: with nothing configured PSI behaves exactly as before.
   `previewSchedule` is what the schedule page is showing; null means "follow the active schedule". Previewing never changes
   what is active: that is decided by date (override > A/B > weekday > fallback). */
let previewSchedule = null;
const todayKey = () => PSI_BELL.schoolParts().key;
const activeFor = key => PSI_BELL.resolve(key, bellMode);
const viewSchedule = () => previewSchedule && PSI_BELL.isValid(previewSchedule) ? previewSchedule : (activeFor(todayKey()).id || bellMode);

/* A class tied to an A/B day only meets on that letter (when the date's letter is known) */
const rotationOk = (c, letter) => !c.rotation || !letter || c.rotation === letter;

/* ---------- Periods: WHEN comes from the official sheet, WHAT comes from the person's classes ----------
   Every class has a `periodId` (before, advisory, p1..p7, after). The sheet decides when a period happens on a given schedule;
   the class only says which period it belongs to, plus its teacher, room and the rest. Stored classes are never rewritten
   to match the sheet: the day is assembled from both at display time (dayModel), and the timer reads that same model. */
const REGULAR = ["advisory", "p1", "p2", "p3", "p4", "p5", "p6", "p7"];
const EXTRA_PREFIX = /^\s*(event|study session|activity)\s*:/i;   // the Builder's quick-add buttons: not school classes
const toSec = t => typeof t === "string" && /^\d{1,2}:\d{2}$/.test(t) ? timeToSeconds(t) : NaN;
const isExtra = c => c.periodId === "" && !!c.kind;

/* Times a class uses in a built-in schedule when the sheet gives none; null if it doesn't meet in it (Day Off only) */
function timesFor(c, id = viewSchedule()) {
    if (id === "dayoff") return c.dayOffAffected ? { start: c.dayOffStart, end: c.dayOffEnd } : null;
    if (id === "hour" && c.bellAffected) return { start: c.bellStart, end: c.bellEnd };
    return { start: c.start, end: c.end };
}

/* The day under one schedule: { groups, timeline }.
   groups:   Before School (by start time) -> Advisory -> 1st..7th Period (fixed order) -> Unassigned -> After School (by start time).
             A period with official timing is always kept, empty or not; one without timing appears only if it has classes.
   timeline: every timed entry in time order: what the timer counts through. An empty official period is an entry too (`empty`). */
function dayModel(dayName, id, letter) {
    const T = PSI_BELL.timing(id);
    const cls = customSchedule.filter(c => Array.isArray(c.days) && c.days.includes(dayName) && rotationOk(c, letter));
    const mk = (c, start, end, extra) => ({ id: c.id, name: c.name, teacher: c.teacher || "", room: c.room || "", startTime: start, endTime: end, start: toSec(start), end: toSec(end), ...extra });
    const ok = e => Number.isFinite(e.start) && Number.isFinite(e.end) && e.end > e.start;
    const own = c => { const x = timesFor(c, id); return x && mk(c, x.start, x.end); };   // Before/After School and unplaced classes use their own times for the schedule (Day Off times on a Day Off view)
    const edge = pid => cls.filter(c => c.periodId === pid).map(own).filter(Boolean).filter(ok).sort((a, b) => a.start - b.start || a.end - b.end);
    const groups = [], before = edge("before"), after = edge("after");
    if (before.length) groups.push({ id: "before", label: "Before School", items: before, timed: true });

    for (const pid of REGULAR) {
        const label = PSI_BELL.periodLabel(pid), mine = cls.filter(c => c.periodId === pid), t = T && T.byPeriod[pid];
        if (T) {
            if (!t) continue;   // this schedule has no such period today (a classes stays stored, it just doesn't meet)
            const items = mine.map(c => mk(c, t.start, t.end, { period: label }));
            groups.push({ id: pid, label, start: t.start, end: t.end, official: true, items, gap: items.length ? null : mk({ id: `gap:${pid}`, name: label }, t.start, t.end, { empty: true, period: label }), timed: true });
        } else {
            const items = mine.map(c => { const x = timesFor(c, id); return x && mk(c, x.start, x.end, { period: label }); }).filter(Boolean).filter(ok);
            if (items.length) groups.push({ id: pid, label, start: items.reduce((a, e) => Math.min(a, e.start), 1e9), items, timed: true });
        }
    }
    // Periods the sheet lists that aren't one of the fixed periods (Lunch, Assembly...): shown as the sheet gives them, with no class
    for (const x of T?.extras || []) groups.push({ id: `sheet:${x.name}`, label: x.name, start: x.start, end: x.end, official: true, items: [], gap: mk({ id: `gap:${x.name}`, name: x.name }, x.start, x.end, { empty: true, period: x.name }), timed: true });
    if (T?.extras?.length) groups.sort((a, b) => a.id === "before" || b.id === "after" ? -1 : b.id === "before" || a.id === "after" ? 1 : toSec(a.start) - toSec(b.start));
    // Classes the migration hasn't placed yet (no sheet yet): shown by their own times, exactly as before
    for (const c of cls.filter(c => c.periodId === undefined)) {
        const x = timesFor(c, id), e = x && mk(c, x.start, x.end);
        if (e && ok(e)) groups.push({ id: `legacy:${c.id}`, label: "", items: [e], timed: true });
    }
    const loose = cls.filter(c => c.periodId === "" && !c.kind).map(own).filter(Boolean).filter(ok);
    if (loose.length) groups.push({ id: "unassigned", label: "Unassigned", items: loose, timed: false });
    if (after.length) groups.push({ id: "after", label: "After School", items: after, timed: true });

    const timeline = groups.filter(g => g.timed).flatMap(g => g.items.length ? g.items : g.gap ? [g.gap] : []).sort((a, b) => a.start - b.start || a.end - b.end);
    return { groups, timeline };
}
/* Real classes only, with the times the schedule gives them (the Builder preview uses this) */
function scheduleEntries(dayName, id, letter) { return dayModel(dayName, id, letter).timeline.filter(e => !e.empty); }
/* The schedule page / builder preview: whatever is being viewed (no date, so no A/B filter) */
function getEffectiveSchedule(dayName) { return scheduleEntries(dayName, viewSchedule(), null); }

/* ---------- Moving existing classes into periods (versioned, idempotent) ----------
   Only entries that have no `periodId` yet are looked at, so running it again never touches a class that was already placed,
   and never overwrites a later choice by the person. Nothing is deleted or rewritten: a class only gains `periodId`
   (and `kind` for the Builder's Event / Study session / Activity entries). The stored string from before the first run is kept
   under BACKUP_KEY. What can't be placed with confidence is flagged (periodId "") for review instead of being guessed. */
const BACKUP_KEY = `${STORAGE_KEY}.before-periods`;
function legacyPeriod(c, ctx) {
    const kind = String(c.name || "").match(EXTRA_PREFIX);
    if (kind) return { kind: kind[1].toLowerCase().replace(/\s+/g, "-") };
    const named = PSI_BELL.periodIdFromName(c.period);   // the "Bell period" text from the previous version
    if (named) return { periodId: named, how: "period field" };
    if (/^\s*(advisory|homeroom)\b/i.test(c.name)) return { periodId: "advisory", how: "name" };
    if (!ctx.ready) return { defer: true };               // times can only be read against the sheet
    const s = toSec(c.start), e = toSec(c.end);
    if (!(e > s)) return { review: "Its start and end times are missing or invalid." };
    for (const tol of [0, 300]) for (const tables of [ctx.normal, ctx.all]) {
        const hits = new Set();
        for (const t of tables) for (const pid of REGULAR) { const p = t[pid]; if (p && Math.abs(toSec(p.start) - s) <= tol && Math.abs(toSec(p.end) - e) <= tol) hits.add(pid); }
        if (hits.size === 1) return { periodId: [...hits][0], how: tol ? "times (within 5 min)" : "times" };
        if (hits.size > 1) return { review: "Its times fit more than one period." };
    }
    const weekend = c.days?.length && c.days.every(d => d === "Saturday" || d === "Sunday");
    if (!weekend) {
        if (e <= ctx.first && s >= 5 * 3600) return { periodId: "before", how: "times" };
        if (s >= ctx.last && s < 19 * 3600) return { periodId: "after", how: "times" };
    }
    return { review: "Its times don't match any period." };
}
function migrateToPeriods() {
    const todo = customSchedule.filter(c => c.periodId === undefined);
    if (!todo.length) { if (data.sched.version < 2) { data.sched = { ...data.sched, version: 2, migratedAt: data.sched.migratedAt || new Date().toISOString() }; saveData(); } return false; }
    const tables = PSI_BELL.schedules.map(s => PSI_BELL.timing(s.id)).filter(Boolean).map(t => t.byPeriod);
    const normal = PSI_BELL.timing("normal")?.byPeriod, ref = normal ? [normal] : tables;
    const all = ref.flatMap(t => REGULAR.map(p => t[p]).filter(Boolean));
    const ctx = { ready: tables.length > 0, normal: normal ? [normal] : [], all: tables,
        first: Math.min(...all.map(p => toSec(p.start)), 1e9), last: Math.max(...all.map(p => toSec(p.end)), -1) };
    const decided = todo.map(c => [c, legacyPeriod(c, ctx)]);
    if (decided.every(([, d]) => d.defer)) return false;
    try { if (localStorage.getItem(STORAGE_KEY) !== null && localStorage.getItem(BACKUP_KEY) === null) localStorage.setItem(BACKUP_KEY, localStorage.getItem(STORAGE_KEY)); } catch { /* storage unavailable: nothing to protect */ }
    const log = { mapped: 0, extra: 0, pending: 0 }, review = data.sched.review.filter(r => customSchedule.some(c => c.id === r.id && c.periodId === ""));
    for (const [c, d] of decided) {
        if (d.defer) { log.pending++; continue; }
        if (d.kind) { c.periodId = ""; c.kind = d.kind; log.extra++; }
        else if (d.periodId) { c.periodId = d.periodId; log.mapped++; }
        else { c.periodId = ""; review.push({ id: c.id, name: c.name, reason: d.review }); }
    }
    data.sched = { version: log.pending ? data.sched.version : 2, migratedAt: new Date().toISOString(), mapped: (data.sched.mapped || 0) + log.mapped, extra: (data.sched.extra || 0) + log.extra, review, pending: log.pending, backup: (() => { try { return localStorage.getItem(BACKUP_KEY) !== null; } catch { return false; } })() };
    saveSchedule();   // saves `data` whole, so the new `sched` record goes with it
    return true;
}
migrateToPeriods();
window.addEventListener("psi:bell-updated", () => { if (migrateToPeriods()) { renderSavedSchedule(); populateHomeworkClasses(); updateTimeRemaining(); } });   // the once-a-second tick picks up everything else

/* Schedule state: the single source of truth for "what class is it?".
   The schedule list, the dashboard Up Next card, the browser-tab title and the overview stat all read this object,
   so they cannot disagree. Dates and times are read in the school's time zone (America/New_York), not the device's.
   status: "no-schedule"  nothing saved and nothing imported
           "none-today"   no school, or nothing scheduled today (see .schedule.closed / .schedule.label)
           "in-class"     a class is in session (.current, .left seconds remaining)
           "upcoming"     before the first class or in a passing period (.next, .toNext seconds)
           "done"         today's last class has ended
   .schedule = { id, name, source, letter, closed, label }: which schedule applies today and why (override / rotation / weekday / fallback). */
function getScheduleState(date = new Date()) {
    const sp = PSI_BELL.schoolParts(date), nowSec = sp.sec;
    const dayAt = key => {
        const r = activeFor(key);
        const model = r.id ? dayModel(PSI_BELL.weekdayOf(key), r.id, r.letter) : { groups: [], timeline: [] };
        return { r, list: model.timeline, groups: model.groups };
    };
    const { r, list: today, groups } = dayAt(sp.key);
    const state = { status: "", now: nowSec, dateKey: sp.key, weekday: sp.weekday, today, groups, current: null, next: null, left: 0, toNext: 0, later: null,
        schedule: { id: r.id, name: r.id ? PSI_BELL.nameOf(r.id) : r.label || "No school", source: r.source, letter: r.letter, closed: r.closed, label: r.label } };

    state.current = today.find(c => nowSec >= c.start && nowSec < c.end) || null;
    state.next = today.find(c => c.start > nowSec) || null;
    if (state.current) { state.status = "in-class"; state.left = state.current.end - nowSec; }
    else if (state.next) { state.status = "upcoming"; }
    else state.status = today.length ? "done" : (customSchedule.length || PSI_BELL.schedules.length ? "none-today" : "no-schedule");
    if (state.next) state.toNext = state.next.start - nowSec;

    // When nothing is left today, point at the next date that has classes. Each date is resolved on its own
    // (it may be a B day, an override, a closure), never assumed to repeat today's schedule.
    if (!state.next) {
        for (let offset = 1; offset <= 14; offset++) {
            const key = PSI_BELL.addDays(sp.key, offset), later = dayAt(key);
            if (later.list.length) { state.later = { dayName: PSI_BELL.weekdayOf(key), offset, cls: later.list[0], dateKey: key, scheduleName: PSI_BELL.nameOf(later.r.id) }; break; }
        }
    }
    return state;
}
/* Browser-tab title for a schedule state, e.g. "Ends in 18:42 · AP Physics C" or "Starts in 12:05 · AP English".
   Before school and passing periods are both "upcoming": same wording, counting to the next class. */
function scheduleTitle(state) {
    switch (state.status) {
        case "in-class": return `Ends in ${formatRemaining(state.left)} · ${state.current.name}`;
        case "upcoming": return `Starts in ${formatRemaining(state.toNext)} · ${state.next.name}`;
        case "done": return "School day complete";
        case "none-today": return state.schedule.closed ? "No school today · PSI" : "No classes today · PSI";
        default: return "Palumbo Student Interface";
    }
}

/* Schedule tabs preview a schedule; they do not change which one is active. */
function syncModeButtons() {
    const tabOf = id => PSI_BELL.tabFor(id), r = activeFor(todayKey());
    const view = tabOf(viewSchedule()), active = r.id ? tabOf(r.id) : r.closed ? "dayoff" : null;
    document.querySelectorAll(".mode-button[data-mode]").forEach(b => {
        b.classList.toggle("active", b.dataset.mode === view);
        b.classList.toggle("is-today", b.dataset.mode === active);
        b.setAttribute("aria-pressed", String(b.dataset.mode === view));
    });
}
function setBellMode(id) {
    previewSchedule = PSI_BELL.isValid(id) && id !== "none" ? id : "normal";
    syncModeButtons();
    renderSavedSchedule();
    updateTimeRemaining();
    window.onBellModeChange?.();
    window.dispatchEvent(new CustomEvent("psi:preview-changed"));
}
/* Make a schedule the real one for a date (a date override). `id` "" removes the override. */
function setDateOverride(key, id) {
    if (!PSI_BELL.isKey(key)) return false;
    if (id) data.bell.overrides[key] = id; else delete data.bell.overrides[key];
    saveData();
    renderSavedSchedule();
    updateTimeRemaining();
    syncModeButtons();
    return true;
}

function toggleSettings(selectId, boxId, inputIds) {
    const on = byId(selectId).value === "yes";
    byId(boxId).classList.toggle("visible", on);
    inputIds.forEach(id => { byId(id).required = on; });
}
function toggleBellSettings() { toggleSettings("bell-affected", "bell-settings", ["bell-start", "bell-end"]); }
function toggleDayOffSettings() { toggleSettings("dayoff-affected", "dayoff-settings", ["dayoff-start", "dayoff-end"]); }
function clearScheduleForm() {
    byId("schedule-form").reset();
    toggleBellSettings();
    toggleDayOffSettings();
    syncPeriodForm();
}
/* Regular periods take their times from the bell schedule, so the time controls only appear for Before / After School */
const periodOptions = (selected, blank) => `${blank ? `<option value=""${selected === "" ? " selected" : ""}>${blank}</option>` : ""}${PSI_BELL.PERIODS.map(p => `<option value="${p.id}"${selected === p.id ? " selected" : ""}>${p.label}</option>`).join("")}`;
function syncPeriodForm() {
    const sel = byId("schedule-period"); if (!sel) return;
    const edge = sel.value === "before" || sel.value === "after";
    /* Day Off times apply to any period (a Day Off day has its own times); the other time controls only to Before / After School */
    for (const id of ["schedule-start", "schedule-end", "bell-affected"]) { const el = byId(id); if (el) el.closest("label").hidden = !edge; }
    const chosen = !!sel.value, dof = byId("dayoff-affected");
    if (dof) dof.closest("label").hidden = !chosen;
    if (byId("bell-settings")) byId("bell-settings").hidden = !edge;
    if (byId("dayoff-settings")) byId("dayoff-settings").hidden = !chosen;
    byId("schedule-start").required = byId("schedule-end").required = edge;
    if (!edge) byId("bell-affected").value = "no";
}
byId("schedule-period")?.addEventListener("change", syncPeriodForm);
syncPeriodForm(); window.addEventListener("load", syncPeriodForm);   // v3.js adds the Day Off controls after this file runs

function renderSavedSchedule() {
    const box = byId("saved-schedule-list");
    box.innerHTML = "";
    if (!customSchedule.length) {
        box.innerHTML = '<div class="schedule-empty">No classes added yet. Your schedule is a clean slate.</div>';
    }
    const normal = PSI_BELL.timing("normal");
    customSchedule.forEach(course => {
        const pid = course.periodId, regular = REGULAR.includes(pid), t = timesFor(course, "normal") || { start: course.start, end: course.end };
        const official = regular && normal?.byPeriod[pid];
        const when = official ? `${formatStoredTime(official.start)}–${formatStoredTime(official.end)}` : t.start && t.end ? `${formatStoredTime(t.start)}–${formatStoredTime(t.end)}` : "";
        const note = pid === undefined || (pid === "" && !course.kind) ? "Needs a period" : "";
        const row = document.createElement("div");
        row.className = "saved-class";
        row.innerHTML = `<div><strong>${escapeHtml(course.name)}</strong>${classMeta(course) ? `<small class="schedule-teacher">${escapeHtml(classMeta(course))}</small>` : ""}<small>${[course.days.join(", "), when, course.rotation ? `${course.rotation}-Day` : "", note].filter(Boolean).join(" · ")}</small></div>
            <div class="saved-actions"><select class="saved-period" aria-label="Period for ${escapeHtml(course.name)}">${periodOptions(pid ?? "", pid === undefined || pid === "" ? "No period" : "")}</select><button class="danger-button" type="button">Delete</button></div>`;
        row.querySelector("select").addEventListener("change", e => {
            // Assigning a period never touches anything else about the class. Before/After School keep the times already stored.
            const v = e.target.value, c = customSchedule.find(x => x.id === course.id); if (!c) return;
            if ((v === "before" || v === "after") && !(toSec(c.start) < toSec(c.end))) { alert("Before and After School classes need a start and end time. Add the class again with its times."); e.target.value = c.periodId ?? ""; return; }
            c.periodId = v; if (v) delete c.kind;
            data.sched.review = data.sched.review.filter(r => r.id !== c.id);
            saveSchedule(); renderSavedSchedule(); updateTimeRemaining();
        });
        row.querySelector("button").addEventListener("click", () => {
            customSchedule = customSchedule.filter(c => c.id !== course.id);
            saveSchedule();
            renderSavedSchedule();
            populateHomeworkClasses();
            updateTimeRemaining();
        });
        box.appendChild(row);
    });
    renderPriorityDashboard();
}

byId("schedule-form").addEventListener("submit", event => {
    event.preventDefault();
    const v = id => byId(id).value;
    const days = [...document.querySelectorAll(".days-picker input:checked")].map(i => i.value);
    const name = v("schedule-class-name").trim(), pid = v("schedule-period");
    const edge = pid === "before" || pid === "after";
    // A regular period's times come from the bell schedule; the stored copy is only a fallback for when no sheet has loaded
    const off0 = PSI_BELL.timing("normal")?.byPeriod[pid];
    const start = edge ? v("schedule-start") : off0?.start || "", end = edge ? v("schedule-end") : off0?.end || "";
    const bell = edge && v("bell-affected") === "yes", off = v("dayoff-affected") === "yes";

    if (!days.length) return alert("Select at least one day.");
    if (!name) return alert("Enter a class name.");
    if (!PSI_BELL.isPeriod(pid)) return alert("Choose a period.");
    if (edge && (!start || !end || start >= end)) return alert("The end time must be after the start time.");
    if (bell && (!v("bell-start") || !v("bell-end") || v("bell-start") >= v("bell-end"))) return alert("Enter valid bell-specific start and end times.");
    if (off && (!v("dayoff-start") || !v("dayoff-end") || v("dayoff-start") >= v("dayoff-end"))) return alert("Enter valid Day Off start and end times.");

    customSchedule.push({
        id: Date.now() + Math.random(), name, teacher: v("schedule-teacher").trim(), room: v("schedule-room").trim(), periodId: pid, rotation: v("schedule-rotation"), days, start, end,
        bellAffected: bell, bellStart: bell ? v("bell-start") : "", bellEnd: bell ? v("bell-end") : "",
        dayOffAffected: off, dayOffStart: off ? v("dayoff-start") : "", dayOffEnd: off ? v("dayoff-end") : ""
    });
    saveSchedule();
    clearScheduleForm();
    renderSavedSchedule();
    populateHomeworkClasses();
    updateTimeRemaining();
});

/* ---------- Today's classes + countdown ---------- */
/* Runs once a second (the only schedule timer) and whenever the schedule or bell mode changes.
   Everything time-related on screen is derived from one getScheduleState() call per tick. The list shows the schedule being
   viewed (a preview if a tab other than today's is chosen); countdown text and highlighting only ever apply to today's real one. */
let scheduleListHtml = "", scheduleRows = [], lastActiveKey = "";
function updateTimeRemaining() {
    const state = getScheduleState();
    byId("day-name").textContent = `Class Schedule for ${state.weekday}`;

    const viewId = viewSchedule(), src = id => PSI_BELL.timing(id)?.source || id;
    const live = viewId === state.schedule.id || src(viewId) === src(state.schedule.id);   // "Normal Bell Page" and the sheet's Normal Day are the same schedule
    const groups = live ? state.groups : dayModel(state.weekday, viewId, state.schedule.letter).groups;
    const range = g => `${formatStoredTime(g.start)} – ${formatStoredTime(g.end)}`;
    const row = (c, edge) => `<div class="schedule-item${live && c === state.current ? " current-class" : ""}"><div class="schedule-class-name">${escapeHtml(c.name)}${classMeta(c) ? `<small class="schedule-teacher">${escapeHtml(classMeta(c))}</small>` : ""}</div><div class="schedule-time">${formatStoredTime(c.startTime)}</div><div class="schedule-time">${formatStoredTime(c.endTime)}</div><div class="schedule-remaining"></div></div>`;
    const rows = [];
    const html = groups.map(g => {
        const cur = live && state.current && (g.items.includes(state.current) || g.gap === state.current);
        const head = g.label ? `<div class="schedule-period${cur ? " is-current" : ""}"><span>${escapeHtml(g.label)}</span>${g.official ? `<span>${range(g)}</span>` : ""}</div>` : "";
        const body = g.items.length ? g.items.map(c => { rows.push(c); return row(c); }).join("") : (rows.push(g.gap), '<div class="schedule-free"><span>No class</span><div class="schedule-remaining"></div></div>');
        return `${g.id === "after" ? '<div class="schedule-divider" role="separator"></div>' : ""}<div class="schedule-group" data-period="${g.id}">${head}${body}</div>`;
    }).join("") || '<div class="schedule-empty">No classes scheduled for today.</div>';

    const remainingText = c => !live ? "" : c === state.current ? `${formatRemaining(state.left)} remaining`
        : c.empty ? ""
        : state.now < c.start ? `${formatRemaining(c.start - state.now)} until start` : "Not in Session";
    // Rebuild the rows only when their structure changes (a class starts/ends, or the schedule is edited).
    // The countdown text changes every second, so it is written in place, and only where it differs.
    const list = byId("class-list");
    if (html !== scheduleListHtml) { list.innerHTML = html; scheduleListHtml = html; }
    scheduleRows = rows;
    list.querySelectorAll(".schedule-remaining").forEach((el, i) => {
        const text = remainingText(scheduleRows[i]);
        if (el.textContent !== text) el.textContent = text;
    });

    const activeKey = `${state.schedule.id}|${state.schedule.source}`;
    if (activeKey !== lastActiveKey) { lastActiveKey = activeKey; syncModeButtons(); }   // e.g. the date rolled over to a B day
    const timer = byId("current-class-timer");
    if (timer) timer.textContent = state.current ? `${state.current.name} — in session` : "No class in session";
    const title = scheduleTitle(state);
    if (document.title !== title) document.title = title;
    window.dispatchEvent(new CustomEvent("psi:schedule-tick", { detail: state }));   // card + overview listen; one state, many views
}

/* ---------- Greeting, clock, weather ---------- */
const greetings = {
    morning: [
        'Good morning. Unfortunately, you have to be a functional member of society today.',
        'Good morning, Einstein. Try not to divide by zero before homeroom.',
        'Rise and shine, your frontal lobe has been summoned.',
        'Good morning! Hope you got more than 3 business hours of sleep.',
        'Morning. Your two remaining brain cells are already arguing.',
        'Good morning. The mitochondria called. They want their ATP back.',
        'Rise and grind, scholar. The academic opps are waiting.',
        'Good morning! Time to put those neurons on minimum wage.',
        'Morning, nerd. Please refrain from committing academic malpractice.',
        'Good morning. Your alarm clock has once again defeated you.'
    ],
    afternoon: [
        'Good afternoon. Still pretending you know what’s going on?',
        'Afternoon already? Lock in before your frontal cortex clocks out.',
        'Good afternoon, nerd. Your academic downfall has been postponed.',
        'You survived the morning. Statistically, that’s impressive.',
        'Good afternoon! Half the day is gone and somehow the homework multiplied.',
        'Afternoon. Your neurons have entered their second trimester.',
        'Good afternoon. I hope your brain has finished buffering.',
        'You made it this far without being academically evaporated. Respect.',
        'Good afternoon, scholar. Please stop letting your last two brain cells carry the group project.',
        'Afternoon already? Crazy. You still look unemployed.'
    ],
    evening: [
        'Good evening. The sun is down, but your missing assignments are not.',
        'Evening, nerd. The homework demons have come to collect.',
        'Good evening! Your academic responsibilities have unfortunately followed you home.',
        'Another beautiful evening to stare at a problem for 40 minutes and call it studying.',
        'Good evening. Lock in before your neurons unionize.',
        'The sun is setting. Your GPA is also feeling adventurous.',
        'Good evening, scholar. Perhaps consider opening the document you’ve been avoiding.',
        'Evening. Your homework has been sitting there like a Victorian orphan.',
        'Good evening! Time to discover that “I’ll do it later” was, in fact, a lie.',
        'Another day, another opportunity to disappoint the periodic table.'
    ],
    night: [
        'Good night. Your neurons are requesting unpaid leave.',
        'It’s late, nerd. Go recharge your biological motherboard.',
        'Good night! Close the laptop before your frontal lobe files a complaint.',
        'Still awake? Fascinating. Your circadian rhythm has officially resigned.',
        'Good night. Even your mitochondria are tired of carrying you.',
        'It’s bedtime. Your two brain cells have worked enough overtime.',
        'Good night, scholar. Tomorrow you can continue pretending you understand calculus.',
        'Still awake? Bold strategy, considering you have school tomorrow.',
        'Good night. Please return your brain to its charging station.',
        'The academic council has determined that you need sleep.'
    ]
};
function getDailyGreeting() {
    const h = new Date().getHours();
    const pool = greetings[h < 12 ? "morning" : h < 17 ? "afternoon" : h < 21 ? "evening" : "night"];
    return pool[Math.floor(Math.random() * pool.length)];
}

function updateClock() {
    const now = new Date();
    byId("clock").textContent = now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
    const dateEl = byId("priority-date");
    if (dateEl) dateEl.textContent = new Intl.DateTimeFormat(undefined, { weekday: "long", month: "long", day: "numeric" }).format(now);
}

/* Open-Meteo (no API key). Uses the browser's location, falling back to Philadelphia. */
const WEATHER_LABELS = {
    0: "Clear", 1: "Mostly Clear", 2: "Partly Cloudy", 3: "Cloudy", 45: "Foggy", 48: "Foggy",
    51: "Light Drizzle", 53: "Drizzle", 55: "Heavy Drizzle", 61: "Light Rain", 63: "Rain", 65: "Heavy Rain",
    66: "Freezing Rain", 67: "Freezing Rain", 71: "Light Snow", 73: "Snow", 75: "Heavy Snow", 77: "Snow Grains",
    80: "Rain Showers", 81: "Rain Showers", 82: "Heavy Showers", 85: "Snow Showers", 86: "Snow Showers",
    95: "Thunderstorms", 96: "Thunderstorms", 99: "Thunderstorms"
};
async function fetchWeather(lat, lon) {
    const el = byId("priority-weather");
    if (!el) return;
    try {
        const res = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,weather_code&temperature_unit=fahrenheit`);
        if (!res.ok) throw new Error("Weather request failed");
        const { current } = await res.json();
        el.textContent = `${Math.round(current.temperature_2m)}°F · ${WEATHER_LABELS[current.weather_code] || "Unknown"}`;
    } catch {
        el.textContent = "Weather unavailable";
    }
}
function loadWeather() {
    const fallback = () => fetchWeather(39.9526, -75.1652);
    if (!navigator.geolocation) return fallback();
    navigator.geolocation.getCurrentPosition(p => fetchWeather(p.coords.latitude, p.coords.longitude), fallback, { timeout: 5000 });
}

/* ---------- Initial render ---------- */
byId("greeting").textContent = getDailyGreeting();
byId("homework-due").min = getTodayDateString();
applyGpaVisibility();
loadSatInputs();
renderClasses();
maybeResetDailyTasks();
renderTasks();
maybeAutoClearCompletedHomework();
renderHomework();
renderSavedSchedule();
syncModeButtons();
loadWeather();
/* One once-a-second heartbeat for the clock and the schedule. It is a self-rescheduling timeout aimed at the next
   whole-second boundary (not a counter), so the display is always computed from the real time and can't drift. */
function tick() { updateClock(); updateTimeRemaining(); PSI_BELL.maybeRefresh(); }   // maybeRefresh is a timestamp check; it fetches only when the sheet is due
function heartbeat() {
    tick();
    setTimeout(heartbeat, 1000 - (Date.now() % 1000) + 5);
}
heartbeat();
/* Browsers slow page timers in background tabs (Chrome: to about once a minute after five minutes hidden), which would
   freeze the seconds in the tab title exactly when it is the thing being looked at. Timers inside a dedicated worker are
   not slowed that way, so while the tab is hidden a tiny worker also calls tick(). It is created only when the tab is
   hidden and ended the moment it is visible again; tick() only writes what changed, so the two sources never conflict.
   If workers are unavailable the page simply falls back to the throttled timer. */
let bgBeat = null;
function stopBgBeat() { if (bgBeat) { bgBeat.terminate(); bgBeat = null; } }
function syncBgBeat() {
    if (!document.hidden) { stopBgBeat(); tick(); return; }
    if (bgBeat) return;
    try {
        const src = URL.createObjectURL(new Blob(["const t=()=>{postMessage(0);setTimeout(t,1000-Date.now()%1000+5)};t()"], { type: "text/javascript" }));
        bgBeat = new Worker(src);
        URL.revokeObjectURL(src);
        bgBeat.onmessage = tick;
        bgBeat.onerror = stopBgBeat;
    } catch (e) { bgBeat = null; }
}
/* New sheet data (or a failed refresh): redraw everything that depends on the schedule. */
window.addEventListener("psi:bell-updated", () => { renderSavedSchedule(); updateTimeRemaining(); syncModeButtons(); window.onBellModeChange?.(); });
document.addEventListener("visibilitychange", syncBgBeat);
if (document.hidden) syncBgBeat();
setInterval(maybeAutoClearCompletedHomework, 5 * 60 * 1000);
setInterval(maybeResetDailyTasks, 60 * 1000);
setInterval(loadWeather, 30 * 60 * 1000);
