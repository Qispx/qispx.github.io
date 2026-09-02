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
        bellMode: "normal"
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
            homework: Array.isArray(saved.homework) ? saved.homework : [],
            bellMode: saved.bellMode === "hour" ? "hour" : "normal"
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
        item.innerHTML = `<span>${escapeHtml(course.name)} - ${course.creditHours} Credits - Grade: ${course.grade}</span><button class="delete-btn" type="button">Delete</button>`;
        item.querySelector('button').addEventListener('click', () => deleteCourse(course.id));
        list.appendChild(item);
    });

    Object.entries(counts).forEach(([quarter, count]) => {
        const list = document.querySelector(`#${quarter} .course-list`);
        if (!count) list.innerHTML = '<li class="empty-course-list">No classes added yet.</li>';
    });
    calculateGPA();
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

const priorityRank = { high: 0, medium: 1, low: 2 };
const priorityLabel = { high: 'High', medium: 'Medium', low: 'Low' };

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

    const priorityCompare = (priorityRank[a.priority] ?? 1) - (priorityRank[b.priority] ?? 1);
    if (priorityCompare !== 0) return priorityCompare;

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

        row.innerHTML = `
            <div class="homework-main">
                <div class="homework-name">${escapeHtml(item.name)}</div>
                <div class="homework-meta">
                    <span>${escapeHtml(item.className)}</span>
                    <span>•</span>
                    <span>${escapeHtml(dueText)}</span>
                    <span class="homework-badge ${escapeHtml(item.priority)}">${escapeHtml(priorityLabel[item.priority] || 'Medium')}</span>
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
    const priority = document.getElementById('homework-priority').value;
    const dueDate = document.getElementById('homework-due').value;

    if (!name || !className || !dueDate) {
        alert('Please enter the homework name, class, and due date.');
        return;
    }

    homework.push({
        id: Date.now() + Math.random(),
        name,
        className,
        priority,
        dueDate,
        done: false
    });

    saveHomework();
    event.target.reset();
    document.getElementById('homework-priority').value = 'medium';
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

function getTodaySchedule() {
    const dayNames = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
    const dayName = dayNames[new Date().getDay()];
    document.getElementById('day-name').textContent = `Class Schedule for ${dayName}`;
    return getEffectiveSchedule(dayName);
}

function updateTimeRemaining() {
    const now = new Date();
    const currentMinutes = now.getHours() * 60 + now.getMinutes();
    const todaySchedule = getTodaySchedule().sort((a,b) => timeToMinutes(a.startTime) - timeToMinutes(b.startTime));
    const classList = document.getElementById('class-list');
    classList.innerHTML = '';

    if (!todaySchedule.length) {
        classList.innerHTML = '<div class="schedule-empty">No classes scheduled for today.</div>';
        return;
    }

    todaySchedule.forEach(course => {
        const start = timeToMinutes(course.startTime);
        const end = timeToMinutes(course.endTime);
        const current = currentMinutes >= start && currentMinutes < end;
        let remaining = 'Not in Session';
        if (current) remaining = `${end - currentMinutes} min remaining`;
        else if (currentMinutes < start) remaining = `${start - currentMinutes} min until start`;

        const row = document.createElement('div');
        row.className = `schedule-item${current ? ' current-class' : ''}`;
        row.innerHTML = `<div class="schedule-class-name">${escapeHtml(course.name)}${course.teacher ? `<small class="schedule-teacher">${escapeHtml(course.teacher)}</small>` : ''}</div><div class="schedule-time">${formatStoredTime(course.startTime)}</div><div class="schedule-time">${formatStoredTime(course.endTime)}</div><div class="schedule-remaining">${remaining}</div>`;
        classList.appendChild(row);
    });
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
renderClasses();
renderTasks();
renderHomework();
renderSavedSchedule();
updateClock();
document.getElementById('homework-due').min = getTodayDateString();
updateTimeRemaining();
setInterval(updateClock, 1000);
setInterval(updateTimeRemaining, 30000);


// Highlight the sidebar link for the section currently in view.
const sidebarLinks = [...document.querySelectorAll('.sidebar a[href^="#"]')];
const sidebarSections = sidebarLinks
  .map(link => document.querySelector(link.getAttribute('href')))
  .filter(Boolean);

function updateActiveSidebarLink() {
  const marker = window.scrollY + 140;
  let activeIndex = 0;

  sidebarSections.forEach((section, index) => {
    if (section.offsetTop <= marker) activeIndex = index;
  });

  sidebarLinks.forEach((link, index) => {
    link.classList.toggle('active', index === activeIndex);
  });
}

if (sidebarLinks.length) {
  window.addEventListener('scroll', updateActiveSidebarLink, { passive: true });
  updateActiveSidebarLink();
}
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
