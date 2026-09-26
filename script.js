/* Local data store */
const STORAGE_KEY = "studentDashboardDataV2";
const DAYS = ["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"];

const gradeToPoints = [
    { min: 97, max: 100, points: 4.0 }, { min: 93, max: 96, points: 4.0 },
    { min: 90, max: 92, points: 3.7 }, { min: 87, max: 89, points: 3.3 },
    { min: 83, max: 86, points: 3.0 }, { min: 80, max: 82, points: 2.7 },
    { min: 77, max: 79, points: 2.3 }, { min: 73, max: 76, points: 2.0 },
    { min: 70, max: 72, points: 1.7 }, { min: 67, max: 69, points: 1.3 },
    { min: 63, max: 66, points: 1.0 }, { min: 60, max: 62, points: 0.7 },
    { min: 0, max: 59, points: 0.0 }
];
const classLevelAdjustment = { normal: 0.0, honors: 0.6, ap: 0.8 };

function defaultData() {
    return {
        classes: [],
        tasks: [],
        schedule: [],
        homework: [],
        bellMode: "normal",
        gpaHidden: false,
        sat: { math: null, reading: null },
        lastAutoClear: null
    };
}

function loadData() {
    try {
        const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
        if (!saved || typeof saved !== "object") return defaultData();
        return {
            classes: Array.isArray(saved.classes) ? saved.classes : [],
            tasks: Array.isArray(saved.tasks) ? saved.tasks : [],
            schedule: Array.isArray(saved.schedule) ? saved.schedule.map(course => ({ ...course, teacher: String(course.teacher ?? '').trim() })) : [],
            homework: Array.isArray(saved.homework) ? saved.homework.map(item => ({
                ...item,
                density: ['light','moderate','heavy','intense'].includes(item.density) ? item.density : 'moderate',
                type: ['assignment','test','event'].includes(item.type) ? item.type : 'assignment'
            })) : [],
            bellMode: saved.bellMode === "hour" ? "hour" : "normal",
            gpaHidden: Boolean(saved.gpaHidden),
            sat: {
                math: Number.isFinite(saved.sat?.math) ? saved.sat.math : null,
                reading: Number.isFinite(saved.sat?.reading) ? saved.sat.reading : null
            },
            lastAutoClear: typeof saved.lastAutoClear === 'string' ? saved.lastAutoClear : null
        };
    } catch {
        return defaultData();
    }
}

let data = loadData();

function saveData() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, char => ({
        "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#039;"
    }[char]));
}

/* GPA */
function getFormData() {
    const name = document.getElementById('class-name').value.trim();
    const creditHours = parseFloat(document.getElementById('credit-hours').value);
    const grade = parseFloat(document.getElementById('grade').value);
    const quarter = document.getElementById('quarter').value;
    const classLevel = document.getElementById('class-level').value;
    if (!name || !Number.isFinite(creditHours) || creditHours <= 0 || !Number.isFinite(grade) || grade < 0 || grade > 100) {
        alert('Please provide a class name, valid credit hours, and a grade from 0 to 100.');
        return null;
    }
    return { id: Date.now() + Math.random(), name, creditHours, grade, quarter, classLevel };
}

function addClass(courseData, shouldSave = true) {
    data.classes.push(courseData);
    if (shouldSave) saveData();
    renderClasses();
}

function renderClasses() {
    document.querySelectorAll('.course-list').forEach(list => list.innerHTML = '');
    const counts = { q1:0, q2:0, q3:0, q4:0 };

    data.classes.forEach(course => {
        const list = document.querySelector(`#${course.quarter} .course-list`);
        if (!list) return;
        counts[course.quarter]++;
        const item = document.createElement('li');
        item.className = 'course-item';
        item.innerHTML = `
            <span class="course-item-name">${escapeHtml(course.name)} - ${course.creditHours} Credits - Grade: ${course.grade}</span>
            <div class="course-item-actions">
                <button class="edit-btn" type="button">Edit</button>
                <button class="delete-btn" type="button">Delete</button>
            </div>
        `;
        item.querySelector('.delete-btn').addEventListener('click', () => deleteCourse(course.id));
        item.querySelector('.edit-btn').addEventListener('click', () => enterCourseEditMode(item, course));
        list.appendChild(item);
    });

    Object.entries(counts).forEach(([quarter, count]) => {
        const list = document.querySelector(`#${quarter} .course-list`);
        if (!count) list.innerHTML = '<li class="empty-course-list">No classes added yet.</li>';
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
        </div>
    `;

    item.querySelector('.save-edit-btn').addEventListener('click', () => {
        const input = item.querySelector('.edit-grade');
        const newGrade = parseFloat(input.value);
        if (!Number.isFinite(newGrade) || newGrade < 0 || newGrade > 100) {
            alert('Enter a valid grade from 0 to 100.');
            return;
        }
        course.grade = newGrade;
        saveData();
        renderClasses();
    });

    item.querySelector('.cancel-edit-btn').addEventListener('click', renderClasses);
}

function deleteCourse(id) {
    data.classes = data.classes.filter(course => course.id !== id);
    saveData();
    renderClasses();
}

function calculateGPA() {
    let totalCredits = 0, unweighted = 0, weighted = 0;
    data.classes.forEach(course => {
        const gradePoints = gradeToPoints.find(range => course.grade >= range.min && course.grade <= range.max)?.points ?? 0;
        const weightedPoints = gradePoints + (classLevelAdjustment[course.classLevel] ?? 0);
        totalCredits += course.creditHours;
        unweighted += gradePoints * course.creditHours;
        weighted += weightedPoints * course.creditHours;
    });
    document.getElementById('unweighted-gpa').textContent = totalCredits ? (unweighted / totalCredits).toFixed(2) : '0.00';
    document.getElementById('weighted-gpa').textContent = totalCredits ? (weighted / totalCredits).toFixed(2) : '0.00';
    renderPriorityDashboard();
}

document.getElementById('add-class-form').addEventListener('submit', event => {
    event.preventDefault();
    const course = getFormData();
    if (!course) return;
    addClass(course);
    event.target.reset();
});

/* Collapsible GPA year sections */
function toggleQuarter(quarter) {
    const section = document.getElementById(quarter);
    if (section) section.classList.toggle('expanded');
}

/* Generic collapsible dropdown used by every list panel (tasks, homework,
   today's classes, saved classes, priority breakdown) */
function toggleDropdown(id) {
    const section = document.getElementById(id);
    if (section) section.classList.toggle('expanded');
}

/* GPA visibility toggle */
function toggleGpaVisibility() {
    data.gpaHidden = !data.gpaHidden;
    saveData();
    applyGpaVisibility();
}

function applyGpaVisibility() {
    const values = document.getElementById('gpa-values');
    const btn = document.getElementById('gpa-toggle-btn');
    if (!values || !btn) return;
    values.classList.toggle('hidden', data.gpaHidden);
    btn.textContent = data.gpaHidden ? 'Show GPA' : 'Hide GPA';
    renderPriorityDashboard();
}

/* SAT score tracking */
function loadSatInputs() {
    document.getElementById('sat-math').value = data.sat.math ?? '';
    document.getElementById('sat-reading').value = data.sat.reading ?? '';
    updateSatComposite(false);
}

function updateSatComposite(shouldSave = true) {
    const mathValue = parseInt(document.getElementById('sat-math').value, 10);
    const readingValue = parseInt(document.getElementById('sat-reading').value, 10);
    const math = Number.isFinite(mathValue) ? mathValue : null;
    const reading = Number.isFinite(readingValue) ? readingValue : null;
    const composite = (math ?? 0) + (reading ?? 0);

    document.getElementById('sat-composite').textContent = composite || 0;

    if (shouldSave) {
        data.sat = { math, reading };
        saveData();
    }
}

document.getElementById('sat-math').addEventListener('input', () => updateSatComposite(true));
document.getElementById('sat-reading').addEventListener('input', () => updateSatComposite(true));


/* Schedule builder — intentionally starts empty
   (declared early so the priority dashboard can safely reference it
   during the very first render) */
let customSchedule = data.schedule;
let bellMode = data.bellMode;

/* Daily tasks */
let tasks = data.tasks;
function saveTasks() { data.tasks = tasks; saveData(); }
function renderTasks() {
    const list = document.getElementById('task-list');
    const progress = document.getElementById('task-progress');
    list.innerHTML = '';
    if (!tasks.length) {
        list.innerHTML = '<div class="task-empty">Chod do something today please...</div>';
        progress.textContent = '0 / 0';
        return;
    }
    tasks.forEach(task => {
        const item = document.createElement('label');
        item.className = `task-item${task.done ? ' done' : ''}`;
        item.innerHTML = `<input type="checkbox" ${task.done ? 'checked' : ''} aria-label="Complete task"><span>${escapeHtml(task.text)}</span>`;
        item.querySelector('input').addEventListener('change', event => {
            task.done = event.target.checked;
            saveTasks();
            renderTasks();
        });
        list.appendChild(item);
    });
    progress.textContent = `${tasks.filter(task => task.done).length} / ${tasks.length}`;
}

document.getElementById('task-form').addEventListener('submit', event => {
    event.preventDefault();
    const input = document.getElementById('task-input');
    const text = input.value.trim();
    if (!text) return;
    tasks.push({ id: Date.now() + Math.random(), text, done: false });
    saveTasks();
    input.value = '';
    renderTasks();
    input.focus();
});


/* Homework tracker */
let homework = data.homework;

/* Priority is computed automatically from the due date, density is chosen by the user */
const priorityRank = { veryhigh: 0, high: 1, medium: 2, low: 3 };
const priorityLabel = { veryhigh: 'Very High', high: 'High', medium: 'Medium', low: 'Low' };

const densityRank = { intense: 0, heavy: 1, moderate: 2, light: 3 };
const densityLabel = { intense: 'Intense', heavy: 'Heavy', moderate: 'Moderate', light: 'Light' };

const typeLabel = { assignment: 'Assignment', test: 'Test / Quiz', event: 'Event' };
const typeTag = { test: 'TEST', event: 'EVENT' };

function saveHomework() {
    data.homework = homework;
    saveData();
}

/* Auto-clear completed homework every Sunday. Runs once per calendar day at
   most (guarded by data.lastAutoClear) so it doesn't wipe things repeatedly
   if the page is reloaded several times on a Sunday. */
function maybeAutoClearCompletedHomework() {
    const today = getTodayDateString();
    if (new Date(`${today}T00:00:00`).getDay() !== 0) return;
    if (data.lastAutoClear === today) return;

    const hasCompleted = homework.some(item => item.done);
    homework = homework.filter(item => !item.done);
    data.lastAutoClear = today;
    saveHomework();

    if (hasCompleted) renderHomework();
}

function formatDueDate(dateString) {
    if (!dateString) return '';
    const date = new Date(`${dateString}T00:00:00`);
    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

function getTodayDateString() {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}

function computePriority(dueDateString, density = 'moderate') {
    if (!dueDateString) return 'low';

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const due = new Date(`${dueDateString}T00:00:00`);
    const diffDays = Math.round((due - today) / 86400000);

    if (diffDays <= 0) return 'veryhigh';

    const densityWeight = {
        light: 1,
        moderate: 2,
        heavy: 3,
        intense: 4
    };

    const weight = densityWeight[density] ?? 2;
    const pressure = weight / (diffDays + 1);

    if (pressure >= 1.5) return 'veryhigh';
    if (pressure >= 0.75) return 'high';
    if (pressure >= 0.40) return 'medium';

    return 'low';
}

function getClassNamesForHomework() {
    const names = [...new Set(customSchedule.map(course => String(course.name || '').trim()).filter(Boolean))];
    return names.sort((a, b) => a.localeCompare(b));
}

function populateHomeworkClasses() {
    const select = document.getElementById('homework-class');
    const current = select.value;
    const classNames = getClassNamesForHomework();

    select.innerHTML = classNames.length
        ? '<option value="">Select a class</option>'
        : '<option value="">Add a class first</option>';

    classNames.forEach(name => {
        const option = document.createElement('option');
        option.value = name;
        option.textContent = name;
        select.appendChild(option);
    });

    if (classNames.includes(current)) select.value = current;
}

function homeworkSort(a, b) {
    const completedCompare = Number(Boolean(a.done)) - Number(Boolean(b.done));
    if (completedCompare !== 0) return completedCompare;

    // Overdue items always sort to the top, ahead of every other priority tier
    const today = getTodayDateString();
    const aOverdue = !a.done && a.dueDate && a.dueDate < today;
    const bOverdue = !b.done && b.dueDate && b.dueDate < today;
    const overdueCompare = Number(bOverdue) - Number(aOverdue);
    if (overdueCompare !== 0) return overdueCompare;

    const priorityCompare =
        priorityRank[computePriority(a.dueDate, a.density)] -
        priorityRank[computePriority(b.dueDate, b.density)];
    if (priorityCompare !== 0) return priorityCompare; // <-- this was missing before

    const densityCompare = (densityRank[a.density] ?? 2) - (densityRank[b.density] ?? 2);
    if (densityCompare !== 0) return densityCompare;

    const dueCompare = (a.dueDate || '9999-12-31').localeCompare(b.dueDate || '9999-12-31');
    if (dueCompare !== 0) return dueCompare;

    return String(a.name).localeCompare(String(b.name));
}

function renderHomework() {
    const list = document.getElementById('homework-list');
    const progress = document.getElementById('homework-progress');
    list.innerHTML = '';

    const sorted = [...homework].sort(homeworkSort);
    const today = getTodayDateString();

    if (!sorted.length) {
        list.innerHTML = '<div class="homework-empty">No homework added yet. You are all caught up.</div>';
        progress.textContent = '0 / 0';
        populateHomeworkClasses();
        renderCalendar();
        renderPriorityDashboard();
        return;
    }

sorted.forEach(item => {
    const row = document.createElement('div');
    const overdue = !item.done && item.dueDate < today;
    row.className = `homework-item${item.done ? ' completed' : ''}${overdue ? ' overdue' : ''}`;
    row.dataset.homeworkId = item.id;

    const dueText = `Due ${formatDueDate(item.dueDate)}`;
    const priority = computePriority(item.dueDate, item.density);
    const density = ['light','moderate','heavy','intense'].includes(item.density) ? item.density : 'moderate';

    row.innerHTML = `
        <div class="homework-main">
            <div class="homework-name">${escapeHtml(item.name)}</div>
            <div class="homework-meta">
                <span>${escapeHtml(item.className)}</span>
                <span>•</span>
                <span>${escapeHtml(dueText)}</span>
                ${overdue ? '<span class="homework-badge overdue">Overdue</span>' : ''}
                <span class="homework-badge ${escapeHtml(priority)}"> Priority: ${escapeHtml(priorityLabel[priority])}</span>
                <span class="homework-badge ${escapeHtml(density)}">Density: ${escapeHtml(densityLabel[density])}</span>
                ${item.type !== 'assignment' ? `<span class="homework-badge ${escapeHtml(item.type)}">${escapeHtml(typeLabel[item.type] || 'Assignment')}</span>` : ''}
            </div>
        </div>
        <div class="homework-actions">
            <input type="checkbox" ${item.done ? 'checked' : ''} aria-label="Complete homework">
            <button class="danger-button" type="button" aria-label="Delete homework">Delete</button>
        </div>
    `;

    row.querySelector('input').addEventListener('change', event => {
        item.done = event.target.checked;
        saveHomework();
        renderHomework();
    });

    row.querySelector('button').addEventListener('click', () => {
        homework = homework.filter(entry => entry.id !== item.id);
        saveHomework();
        renderHomework();
    });

    list.appendChild(row);
});

    progress.textContent = `${homework.filter(item => item.done).length} / ${homework.length}`;
    populateHomeworkClasses();
    renderCalendar();
    renderPriorityDashboard();
}

document.getElementById('homework-form').addEventListener('submit', event => {
    event.preventDefault();

    const name = document.getElementById('homework-name').value.trim();
    const className = document.getElementById('homework-class').value;
    const density = document.getElementById('homework-density').value;
    const type = document.getElementById('homework-type').value;
    const dueDate = document.getElementById('homework-due').value;

    if (!name || !className || !dueDate) {
        alert('Please enter the homework name, class, and due date.');
        return;
    }

    homework.push({
        id: Date.now() + Math.random(),
        name,
        className,
        density,
        type: ['assignment','test','event'].includes(type) ? type : 'assignment',
        dueDate,
        done: false
    });

    saveHomework();
    event.target.reset();
    document.getElementById('homework-density').value = 'moderate';
    document.getElementById('homework-type').value = 'assignment';
    renderHomework();
});

/* ==========================================================================
   What's Due / What Should I Do? — Priority Dashboard
   Reads directly from data.homework, customSchedule and data.classes — no
   separate data source, and no AI: just date math against what the student
   already tracks.
   ========================================================================== */

function addDaysToDateString(dateString, days) {
    const date = new Date(`${dateString}T00:00:00`);
    date.setDate(date.getDate() + days);
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}

function daysUntil(dueDateString, todayString) {
    const today = new Date(`${todayString}T00:00:00`);
    const due = new Date(`${dueDateString}T00:00:00`);
    return Math.round((due - today) / 86400000);
}

function relativeDueLabel(diffDays) {
    if (diffDays < 0) return 'Overdue';
    if (diffDays === 0) return 'Due today';
    if (diffDays === 1) return 'Due tomorrow';
    const dayNames = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
    if (diffDays <= 6) {
        const d = new Date();
        d.setHours(0, 0, 0, 0);
        d.setDate(d.getDate() + diffDays);
        return `Due ${dayNames[d.getDay()]}`;
    }
    return `Due ${formatDueDate(addDaysToDateString(getTodayDateString(), diffDays))}`;
}

function urgencyBucket(diffDays) {
    if (diffDays <= 0) return { key: 'red' };
    if (diffDays === 1) return { key: 'orange' };
    if (diffDays <= 4) return { key: 'yellow' };
    return { key: 'green' };
}

function renderPriorityDashboard() {
    const listEl = document.getElementById('priority-today-list');
    const statsEl = document.getElementById('priority-stats');
    const insightEl = document.getElementById('priority-insight');
    const workloadBarEl = document.getElementById('priority-workload-bar');
    const workloadOverdueEl = document.getElementById('priority-workload-overdue');
    const workloadCountEl = document.getElementById('priority-workload-count');
    const overduePillEl = document.getElementById('priority-overdue-pill');
    if (!listEl || !statsEl) return;

    const today = getTodayDateString();

    const openHomework = homework.filter(item => !item.done && item.dueDate);

    /* Per-class next-due-item list */
    const classNames = getClassNamesForHomework();
    listEl.innerHTML = '';

    if (!classNames.length) {
        listEl.innerHTML = '<div class="priority-empty">Add classes in the Schedule Builder to see what\'s due for each one.</div>';
    } else {
        classNames.forEach(className => {
            const upcoming = openHomework
                .filter(item => item.className === className)
                .sort((a, b) => a.dueDate.localeCompare(b.dueDate))[0];

            const row = document.createElement('div');

            if (!upcoming) {
                row.className = 'priority-item green';
                row.innerHTML = `
                    <span class="priority-item-main">
                        <span class="priority-item-class">${escapeHtml(className)}</span>
                        <span class="priority-item-task">No upcoming work</span>
                    </span>
                `;
            } else {
                const diffDays = daysUntil(upcoming.dueDate, today);
                const bucket = urgencyBucket(diffDays);
                row.className = `priority-item ${bucket.key}`;
                row.innerHTML = `
                    <span class="priority-item-main">
                        <span class="priority-item-class">${escapeHtml(className)}${typeTag[upcoming.type] ? ` <span class="priority-tag priority-tag-${escapeHtml(upcoming.type)}">${typeTag[upcoming.type]}</span>` : ''}</span>
                        <span class="priority-item-task">${escapeHtml(upcoming.name)} — ${escapeHtml(relativeDueLabel(diffDays))}</span>
                    </span>
                `;
            }

            listEl.appendChild(row);
        });
    }

    /* Coming up stats */
    const overdueItems = openHomework.filter(item => daysUntil(item.dueDate, today) < 0);
    const overdueCount = overdueItems.length;
    const dueNext7 = openHomework.filter(item => {
        const diff = daysUntil(item.dueDate, today);
        return diff >= 0 && diff <= 7;
    });
    const testsNext14 = openHomework.filter(item => {
        const diff = daysUntil(item.dueDate, today);
        return item.type === 'test' && diff >= 0 && diff <= 14;
    });

    statsEl.innerHTML = `
        <div class="priority-stat">
            <span class="priority-stat-value">${dueNext7.length}</span>
            <span class="priority-stat-label">assignment${dueNext7.length === 1 ? '' : 's'} due in 7 days</span>
        </div>
        <div class="priority-stat">
            <span class="priority-stat-value">${testsNext14.length}</span>
            <span class="priority-stat-label">test${testsNext14.length === 1 ? '' : 's'} in 14 days</span>
        </div>
    `;

    if (overduePillEl) {
        overduePillEl.textContent = overdueCount > 0 ? `${overdueCount} Overdue` : 'All caught up';
        overduePillEl.classList.toggle('overdue-pill', overdueCount > 0);
    }

    /* Workload bar — assignments due in the next 7 days, with overdue work
       shown as a red segment so it visibly eats into this week's capacity */
    if (workloadBarEl && workloadCountEl) {
        const maxForFullBar = 10;
        const overduePct = Math.min(100, Math.round((overdueCount / maxForFullBar) * 100));
        const remainingScale = Math.max(0, 100 - overduePct);
        const normalPct = dueNext7.length === 0 ? 0 : Math.max(4, Math.min(remainingScale, Math.round((dueNext7.length / maxForFullBar) * 100)));

        if (workloadOverdueEl) workloadOverdueEl.style.width = `${overduePct}%`;
        workloadBarEl.style.width = `${normalPct}%`;
        workloadBarEl.classList.toggle('is-empty', dueNext7.length === 0 && overdueCount === 0);
        workloadBarEl.classList.remove('level-low', 'level-medium', 'level-high');
        if (dueNext7.length >= 7) workloadBarEl.classList.add('level-high');
        else if (dueNext7.length >= 4) workloadBarEl.classList.add('level-medium');
        else workloadBarEl.classList.add('level-low');

        workloadCountEl.textContent = overdueCount > 0
            ? `${dueNext7.length} assignment${dueNext7.length === 1 ? '' : 's'} + ${overdueCount} overdue`
            : `${dueNext7.length} assignment${dueNext7.length === 1 ? '' : 's'}`;
    }

    /* Smart insight — busiest upcoming day, or an all-clear message */
    if (insightEl) {
        const dayNames = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
        const countsByDay = {};
        dueNext7.forEach(item => {
            if (!countsByDay[item.dueDate]) countsByDay[item.dueDate] = [];
            countsByDay[item.dueDate].push(item);
        });

        let busiestDate = null;
        Object.entries(countsByDay).forEach(([dateKey, items]) => {
            if (!busiestDate || items.length > countsByDay[busiestDate].length) busiestDate = dateKey;
        });

        const todayCount = countsByDay[today]?.length ?? 0;
        const tomorrowKey = addDaysToDateString(today, 1);
        const tomorrowItems = countsByDay[tomorrowKey] || [];
        const tomorrowHasTest = tomorrowItems.some(item => item.type === 'test');

        if (overdueCount > 0) {
            insightEl.className = 'priority-insight red';
            insightEl.innerHTML = `<strong>${overdueCount} overdue item${overdueCount === 1 ? '' : 's'}</strong> — clear these first.`;
        } else if (busiestDate && countsByDay[busiestDate].length >= 3) {
            const busyDayName = busiestDate === today ? 'today' : dayNames[new Date(`${busiestDate}T00:00:00`).getDay()];
            const classCount = new Set(countsByDay[busiestDate].map(item => item.className)).size;
            insightEl.className = 'priority-insight orange';
            insightEl.innerHTML = `<strong>Busy ${escapeHtml(busyDayName.charAt(0).toUpperCase() + busyDayName.slice(1))}</strong> — you have ${countsByDay[busiestDate].length} assignments due across ${classCount} class${classCount === 1 ? '' : 'es'}.`;
        } else if (tomorrowItems.length) {
            insightEl.className = 'priority-insight yellow';
            insightEl.innerHTML = `<strong>Tomorrow</strong> — ${tomorrowItems.length} assignment${tomorrowItems.length === 1 ? '' : 's'}${tomorrowHasTest ? ' + a test' : ''}.`;
        } else if (todayCount) {
            insightEl.className = 'priority-insight yellow';
            insightEl.innerHTML = `<strong>Today</strong> — ${todayCount} item${todayCount === 1 ? '' : 's'} due.`;
        } else {
            insightEl.className = 'priority-insight green';
            insightEl.innerHTML = `You're clear for the next 7 days. Nice.`;
        }
    }
}

/* ==========================================================================
   Assignment Calendar
   Reads directly from the Homework Tracker's data (data.homework) — no
   separate data source to maintain. Every assignment with a dueDate shows
   up on its day, color-coded by priority / completion status.
   ========================================================================== */

let calendarViewDate = new Date();
calendarViewDate.setDate(1);
calendarViewDate.setHours(0, 0, 0, 0);

function changeCalendarMonth(delta) {
    calendarViewDate.setMonth(calendarViewDate.getMonth() + delta);
    renderCalendar();
}

function goToCurrentCalendarMonth() {
    calendarViewDate = new Date();
    calendarViewDate.setDate(1);
    calendarViewDate.setHours(0, 0, 0, 0);
    renderCalendar();
}

function dateToKey(year, month, day) {
    return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function jumpToHomeworkItem(id) {
    const homeworkSection = document.getElementById('homework');
    if (homeworkSection) homeworkSection.scrollIntoView({ behavior: 'smooth', block: 'start' });

    setTimeout(() => {
        const row = document.querySelector(`.homework-item[data-homework-id="${id}"]`);
        if (row) {
            row.classList.add('flash');
            setTimeout(() => row.classList.remove('flash'), 1600);
        }
    }, 300);
}

function renderCalendar() {
    const grid = document.getElementById('calendar-grid');
    const label = document.getElementById('calendar-month-label');
    if (!grid || !label) return;

    const year = calendarViewDate.getFullYear();
    const month = calendarViewDate.getMonth();

    label.textContent = calendarViewDate.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });

    // Group homework by due date (YYYY-MM-DD)
    const byDate = {};
    homework.forEach(item => {
        if (!item.dueDate) return;
        if (!byDate[item.dueDate]) byDate[item.dueDate] = [];
        byDate[item.dueDate].push(item);
    });

    const firstOfMonth = new Date(year, month, 1);
    const startOffset = firstOfMonth.getDay(); // 0 = Sunday
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const daysInPrevMonth = new Date(year, month, 0).getDate();
    const todayKey = getTodayDateString();

    const cells = [];

    // Leading days from previous month
    for (let i = 0; i < startOffset; i++) {
        const day = daysInPrevMonth - startOffset + i + 1;
        cells.push({ day, inMonth: false, key: null });
    }

    // Days of the current month
    for (let day = 1; day <= daysInMonth; day++) {
        cells.push({ day, inMonth: true, key: dateToKey(year, month, day) });
    }

    // Trailing days to complete the final week
    while (cells.length % 7 !== 0) {
        const day = cells.length - (startOffset + daysInMonth) + 1;
        cells.push({ day, inMonth: false, key: null });
    }

    grid.innerHTML = '';

    cells.forEach(cell => {
        const cellEl = document.createElement('div');
        cellEl.className = 'calendar-cell' + (cell.inMonth ? '' : ' outside');
        if (cell.key === todayKey) cellEl.classList.add('is-today');

        const dayNumber = document.createElement('div');
        dayNumber.className = 'calendar-day-number';
        dayNumber.textContent = cell.day;
        cellEl.appendChild(dayNumber);

        const items = cell.key ? (byDate[cell.key] || []) : [];
        if (items.length) {
            const list = document.createElement('div');
            list.className = 'calendar-items';

            const sortedItems = [...items].sort((a, b) => {
                const doneCompare = Number(Boolean(a.done)) - Number(Boolean(b.done));
                if (doneCompare !== 0) return doneCompare;
                return priorityRank[computePriority(a.dueDate, a.density)] - priorityRank[computePriority(b.dueDate, b.density)];
            });

            const maxVisible = 3;
            sortedItems.slice(0, maxVisible).forEach(item => {
                const chip = document.createElement('button');
                chip.type = 'button';
                const priority = computePriority(item.dueDate, item.density);
                chip.className = `calendar-chip ${item.done ? 'done' : priority}`;
                chip.title = `${item.name} (${item.className})`;
                chip.textContent = item.name;
                chip.addEventListener('click', () => jumpToHomeworkItem(item.id));
                list.appendChild(chip);
            });

            if (sortedItems.length > maxVisible) {
                const more = document.createElement('div');
                more.className = 'calendar-more';
                more.textContent = `+${sortedItems.length - maxVisible} more`;
                list.appendChild(more);
            }

            cellEl.appendChild(list);
        }

        grid.appendChild(cellEl);
    });
}

function formatStoredTime(value) {
    if (!value) return '';
    const [h, m] = value.split(':').map(Number);
    const suffix = h >= 12 ? 'PM' : 'AM';
    const hour = h % 12 || 12;
    return `${hour}:${String(m).padStart(2,'0')} ${suffix}`;
}

function setBellMode(mode) {
    bellMode = mode === 'hour' ? 'hour' : 'normal';
    data.bellMode = bellMode;
    saveData();
    document.querySelectorAll('.mode-button').forEach(button => button.classList.toggle('active', button.dataset.mode === bellMode));
    renderSavedSchedule();
    updateTimeRemaining();
}

function toggleBellSettings() {
    const visible = document.getElementById('bell-affected').value === 'yes';
    document.getElementById('bell-settings').classList.toggle('visible', visible);
    document.getElementById('bell-start').required = visible;
    document.getElementById('bell-end').required = visible;
}

function clearScheduleForm() {
    document.getElementById('schedule-form').reset();
    document.getElementById('bell-settings').classList.remove('visible');
    document.getElementById('bell-start').required = false;
    document.getElementById('bell-end').required = false;
}

function renderSavedSchedule() {
    const container = document.getElementById('saved-schedule-list');
    container.innerHTML = '';
    if (!customSchedule.length) {
        container.innerHTML = '<div class="schedule-empty">No classes added yet. Your schedule is a clean slate.</div>';
        renderPriorityDashboard();
        return;
    }
    customSchedule.forEach(course => {
        const row = document.createElement('div');
        row.className = 'saved-class';
        const selectedStart = bellMode === 'hour' && course.bellAffected ? course.bellStart : course.start;
        const selectedEnd = bellMode === 'hour' && course.bellAffected ? course.bellEnd : course.end;
        row.innerHTML = `<div><strong>${escapeHtml(course.name)}</strong>${course.teacher ? `<small class="schedule-teacher">${escapeHtml(course.teacher)}</small>` : ''}<small>${course.days.join(', ')} · ${formatStoredTime(selectedStart)}–${formatStoredTime(selectedEnd)}${course.bellAffected ? ' · Bell-specific' : ''}</small></div><button class="danger-button" type="button">Delete</button>`;
        row.querySelector('button').addEventListener('click', () => {
            customSchedule = customSchedule.filter(item => item.id !== course.id);
            data.schedule = customSchedule;
            saveData();
            renderSavedSchedule();
            populateHomeworkClasses();
            updateTimeRemaining();
        });
        container.appendChild(row);
    });
    renderPriorityDashboard();
}

document.getElementById('schedule-form').addEventListener('submit', event => {
    event.preventDefault();
    const days = [...document.querySelectorAll('.days-picker input:checked')].map(input => input.value);
    const name = document.getElementById('schedule-class-name').value.trim();
    const teacher = document.getElementById('schedule-teacher').value.trim();
    const start = document.getElementById('schedule-start').value;
    const end = document.getElementById('schedule-end').value;
    const bellAffected = document.getElementById('bell-affected').value === 'yes';
    const bellStart = document.getElementById('bell-start').value;
    const bellEnd = document.getElementById('bell-end').value;

    if (!days.length) return alert('Select at least one day.');
    if (!name) return alert('Enter a class name.');
    if (!start || !end || start >= end) return alert('The end time must be after the start time.');
    if (bellAffected && (!bellStart || !bellEnd || bellStart >= bellEnd)) return alert('Enter valid bell-specific start and end times.');

    customSchedule.push({ id: Date.now() + Math.random(), name, teacher, days, start, end, bellAffected, bellStart: bellAffected ? bellStart : '', bellEnd: bellAffected ? bellEnd : '' });
    data.schedule = customSchedule;
    saveData();
    clearScheduleForm();
    renderSavedSchedule();
    populateHomeworkClasses();
    updateTimeRemaining();
});

function getEffectiveSchedule(dayName) {
    return customSchedule.filter(course => course.days.includes(dayName)).map(course => {
        const useBell = bellMode === 'hour' && course.bellAffected;
        return { name: course.name, teacher: course.teacher || '', startTime: useBell ? course.bellStart : course.start, endTime: useBell ? course.bellEnd : course.end };
    });
}

function timeToMinutes(time) {
    const [hours, minutes] = time.split(':').map(Number);
    return hours * 60 + minutes;
}

function timeToSeconds(time) {
    const [hours, minutes] = time.split(':').map(Number);
    return hours * 3600 + minutes * 60;
}

function getSecondsNow() {
    const now = new Date();
    return now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds();
}

function formatCountdown(totalSeconds) {
    const clamped = Math.max(0, Math.round(totalSeconds));
    const hours = Math.floor(clamped / 3600);
    const minutes = Math.floor((clamped % 3600) / 60);
    const seconds = clamped % 60;
    if (hours > 0) {
        return `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
    }
    return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

function getTodaySchedule() {
    const dayNames = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
    const dayName = dayNames[new Date().getDay()];
    document.getElementById('day-name').textContent = `Class Schedule for ${dayName}`;
    return getEffectiveSchedule(dayName);
}

function updateCurrentClassTimer(className, remainingSeconds) {
    const timerEl = document.getElementById('current-class-timer');
    if (!timerEl) return;

    if (className && remainingSeconds != null) {
        timerEl.textContent = `${className} — in session`;
        document.title = `${formatCountdown(remainingSeconds)} · Palumbo Student Interface`;
    } else {
        timerEl.textContent = 'No class in session';
        document.title = 'Palumbo Student Interface';
    }
}

function updateTimeRemaining() {
    const currentSeconds = getSecondsNow();
    const todaySchedule = getTodaySchedule().sort((a,b) => timeToMinutes(a.startTime) - timeToMinutes(b.startTime));
    const classList = document.getElementById('class-list');
    classList.innerHTML = '';

    let currentClassName = null;
    let currentClassRemaining = null;

    if (!todaySchedule.length) {
        classList.innerHTML = '<div class="schedule-empty">No classes scheduled for today.</div>';
        updateCurrentClassTimer(null, null);
        return;
    }

    todaySchedule.forEach(course => {
        const start = timeToSeconds(course.startTime);
        const end = timeToSeconds(course.endTime);
        const current = currentSeconds >= start && currentSeconds < end;
        let remaining = 'Not in Session';

        if (current) {
            const remainingSeconds = end - currentSeconds;
            remaining = `${formatCountdown(remainingSeconds)} remaining`;
            currentClassName = course.name;
            currentClassRemaining = remainingSeconds;
        } else if (currentSeconds < start) {
            remaining = `${Math.ceil((start - currentSeconds) / 60)} min until start`;
        }

        const row = document.createElement('div');
        row.className = `schedule-item${current ? ' current-class' : ''}`;
        row.innerHTML = `<div class="schedule-class-name">${escapeHtml(course.name)}${course.teacher ? `<small class="schedule-teacher">${escapeHtml(course.teacher)}</small>` : ''}</div><div class="schedule-time">${formatStoredTime(course.startTime)}</div><div class="schedule-time">${formatStoredTime(course.endTime)}</div><div class="schedule-remaining">${remaining}</div>`;
        classList.appendChild(row);
    });

    updateCurrentClassTimer(currentClassName, currentClassRemaining);
}

const compliments = [
    'You are a failure.', 'Imagine being bad at SigFigs?', 'Imagine being a NEERRRD!',
    'You are the reason soap has instructions.', 'Your only two brain cells are fighting for last place.',
    'You are not locked in.', "Why you smiling, ain't nothing funny here?",
    'The closest you will come to a brainstorm is a light drizzle.',
    "I'm still deciding whether you're the weakest link or the missing link.",
    'I smell smoke. Were you thinking too hard again?'
];
function getDailyCompliment() {
    const today = new Date();
    const dayOfYear = Math.floor((today - new Date(today.getFullYear(), 0, 0)) / 86400000);
    return compliments[dayOfYear % compliments.length];
}

function updateClock() {
    const now = new Date();
    document.getElementById('clock').textContent = now.toLocaleTimeString([], { hour:'2-digit', minute:'2-digit', second:'2-digit' });
    document.getElementById('hero-date').textContent = new Intl.DateTimeFormat(undefined, { weekday:'long', month:'long', day:'numeric', year:'numeric' }).format(now);
}

/* Initial render */
document.querySelectorAll('.mode-button').forEach(button => button.classList.toggle('active', button.dataset.mode === bellMode));
document.getElementById('compliment').textContent = getDailyCompliment();
applyGpaVisibility();
loadSatInputs();
renderClasses();
renderTasks();
maybeAutoClearCompletedHomework();
renderHomework();
renderSavedSchedule();
renderCalendar();
updateClock();
document.getElementById('homework-due').min = getTodayDateString();
updateTimeRemaining();
renderPriorityDashboard();
setInterval(updateClock, 1000);
setInterval(updateTimeRemaining, 1000);
setInterval(maybeAutoClearCompletedHomework, 5 * 60 * 1000);


// Highlight the sidebar link for the section currently in view.
const sidebarLinks = [...document.querySelectorAll('.sidebar a[href^="#"]')];
const content = document.querySelector('.content');

function updateActiveSidebarLink() {
    if (!sidebarLinks.length || !content) return;

    const contentTop = content.getBoundingClientRect().top;
    const marker = contentTop + 140;

    let activeLink = sidebarLinks[0];

    sidebarLinks.forEach(link => {
        const target = document.querySelector(link.getAttribute('href'));

        if (!target) return;

        const targetTop = target.getBoundingClientRect().top;

        if (targetTop <= marker) {
            activeLink = link;
        }
    });

    sidebarLinks.forEach(link => {
        link.classList.toggle('active', link === activeLink);
    });
}

/* Update while scrolling the main content */
if (content) {
    content.addEventListener('scroll', updateActiveSidebarLink, {
        passive: true
    });
}

/* Update when clicking a sidebar link */
sidebarLinks.forEach(link => {
    link.addEventListener('click', () => {
        setTimeout(updateActiveSidebarLink, 100);
    });
});

/* Initial state */
updateActiveSidebarLink();
// Delete completed daily tasks
function deleteCompletedTasks() {
    if (!tasks || tasks.length === 0) {
        return;
    }

    const completedCount = tasks.filter(task => task.done).length;

    if (completedCount === 0) {
        alert("There are no completed tasks to delete.");
        return;
    }
    
    const confirmed = confirm(
        `Delete ${completedCount} completed task${completedCount === 1 ? "" : "s"}?`
    );

    if (!confirmed) {
        return;
    }

    tasks = tasks.filter(task => !task.done);

    saveTasks();
    renderTasks();
}
