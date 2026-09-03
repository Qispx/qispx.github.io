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
        sat: { math: null, reading: null }
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
                density: ['light','moderate','heavy','intense'].includes(item.density) ? item.density : 'moderate'
            })) : [],
            bellMode: saved.bellMode === "hour" ? "hour" : "normal",
            gpaHidden: Boolean(saved.gpaHidden),
            sat: {
                math: Number.isFinite(saved.sat?.math) ? saved.sat.math : null,
                reading: Number.isFinite(saved.sat?.reading) ? saved.sat.reading : null
            }
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

function saveHomework() {
    data.homework = homework;
    saveData();
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

function computePriority(dueDateString) {
    if (!dueDateString) return 'low';
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const due = new Date(`${dueDateString}T00:00:00`);
    const diffDays = Math.round((due - today) / 86400000);

    if (diffDays <= 1) return 'veryhigh';
    if (diffDays <= 3) return 'high';
    if (diffDays <= 7) return 'medium';
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

    const priorityCompare = priorityRank[computePriority(a.dueDate)] - priorityRank[computePriority(b.dueDate)];
    if (priorityCompare !== 0) return priorityCompare;

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
        return;
    }

    sorted.forEach(item => {
        const row = document.createElement('div');
        const overdue = !item.done && item.dueDate < today;
        row.className = `homework-item${item.done ? ' completed' : ''}${overdue ? ' overdue' : ''}`;

        const dueText = overdue ? `Overdue · ${formatDueDate(item.dueDate)}` : `Due ${formatDueDate(item.dueDate)}`;
        const priority = computePriority(item.dueDate);
        const density = ['light','moderate','heavy','intense'].includes(item.density) ? item.density : 'moderate';

        row.innerHTML = `
            <div class="homework-main">
                <div class="homework-name">${escapeHtml(item.name)}</div>
                <div class="homework-meta">
                    <span>${escapeHtml(item.className)}</span>
                    <span>•</span>
                    <span>${escapeHtml(dueText)}</span>
                    <span class="homework-badge ${escapeHtml(priority)}">${escapeHtml(priorityLabel[priority])}</span>
                    <span class="homework-badge ${escapeHtml(density)}">${escapeHtml(densityLabel[density])}</span>
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
}

document.getElementById('homework-form').addEventListener('submit', event => {
    event.preventDefault();

    const name = document.getElementById('homework-name').value.trim();
    const className = document.getElementById('homework-class').value;
    const density = document.getElementById('homework-density').value;
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
        dueDate,
        done: false
    });

    saveHomework();
    event.target.reset();
    document.getElementById('homework-density').value = 'moderate';
    renderHomework();
});

/* Schedule builder — intentionally starts empty */
let customSchedule = data.schedule;
let bellMode = data.bellMode;

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
        timerEl.textContent = `${className}: ${formatCountdown(remainingSeconds)} left`;
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
renderHomework();
renderSavedSchedule();
updateClock();
document.getElementById('homework-due').min = getTodayDateString();
updateTimeRemaining();
setInterval(updateClock, 1000);
setInterval(updateTimeRemaining, 1000);


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
