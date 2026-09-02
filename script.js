// ===============================
// Palumbo Student Interface
// Main JavaScript
// ===============================

let data = {
    classes: [],
    assignments: [],
    events: [],
    bellMode: "normal"
};

let bellMode = "normal";


// ===============================
// LOCAL STORAGE
// ===============================

function saveData() {
    localStorage.setItem("palumboStudentData", JSON.stringify(data));
}

function loadData() {
    const savedData = localStorage.getItem("palumboStudentData");

    if (savedData) {
        try {
            data = JSON.parse(savedData);

            if (!data.classes) data.classes = [];
            if (!data.assignments) data.assignments = [];
            if (!data.events) data.events = [];
            if (!data.bellMode) data.bellMode = "normal";

            bellMode = data.bellMode;
        } catch (error) {
            console.error("Could not load saved data:", error);
        }
    }
}


// ===============================
// BELL MODE
// ===============================

function setBellMode(mode) {
    bellMode = mode === "hour" ? "hour" : "normal";

    data.bellMode = bellMode;
    saveData();

    // Update active button
    document.querySelectorAll(".mode-button").forEach(button => {
        button.classList.toggle(
            "active",
            button.dataset.mode === bellMode
        );
    });

    const bellSettings = document.getElementById("bell-settings");
    const bellAffected = document.getElementById("bell-affected");
    const bellStart = document.getElementById("bell-start");
    const bellEnd = document.getElementById("bell-end");

    // ===========================
    // 1 HOUR BELL SELECTED
    // ===========================

    if (bellMode === "hour") {
        if (bellAffected) {
            bellAffected.value = "yes";
        }

        if (bellSettings) {
            bellSettings.classList.add("visible");
        }

        if (bellStart) {
            bellStart.required = true;
        }

        if (bellEnd) {
            bellEnd.required = true;
        }
    }

    // ===========================
    // NORMAL BELL SELECTED
    // ===========================

    else {
        if (bellSettings) {
            bellSettings.classList.remove("visible");
        }

        if (bellStart) {
            bellStart.required = false;
        }

        if (bellEnd) {
            bellEnd.required = false;
        }
    }

    renderSavedSchedule();
    updateTimeRemaining();
}


// ===============================
// BELL SETTINGS DROPDOWN
// ===============================

function toggleBellSettings() {
    const bellAffected = document.getElementById("bell-affected");
    const bellSettings = document.getElementById("bell-settings");
    const bellStart = document.getElementById("bell-start");
    const bellEnd = document.getElementById("bell-end");

    if (!bellAffected || !bellSettings) {
        return;
    }

    const visible = bellAffected.value === "yes";

    bellSettings.classList.toggle("visible", visible);

    if (bellStart) {
        bellStart.required = visible;
    }

    if (bellEnd) {
        bellEnd.required = visible;
    }
}


// ===============================
// TIME HELPERS
// ===============================

function timeToMinutes(time) {
    if (!time) return null;

    const [hours, minutes] = time.split(":").map(Number);

    return hours * 60 + minutes;
}

function minutesToTime(minutes) {
    minutes = ((minutes % 1440) + 1440) % 1440;

    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;

    return `${String(hours).padStart(2, "0")}:${String(mins).padStart(2, "0")}`;
}

function formatTime(time) {
    if (!time) return "";

    const [hours, minutes] = time.split(":").map(Number);

    const suffix = hours >= 12 ? "PM" : "AM";
    const displayHours = hours % 12 || 12;

    return `${displayHours}:${String(minutes).padStart(2, "0")} ${suffix}`;
}


// ===============================
// EFFECTIVE CLASS SCHEDULE
// ===============================

function getEffectiveSchedule(classItem) {
    if (
        bellMode === "hour" &&
        classItem.bellAffected === "yes" &&
        classItem.bellStart &&
        classItem.bellEnd
    ) {
        return {
            start: classItem.bellStart,
            end: classItem.bellEnd
        };
    }

    return {
        start: classItem.start,
        end: classItem.end
    };
}


// ===============================
// ADD CLASS
// ===============================

function addClass(event) {
    event.preventDefault();

    const nameInput = document.getElementById("class-name");
    const teacherInput = document.getElementById("class-teacher");
    const roomInput = document.getElementById("class-room");
    const startInput = document.getElementById("schedule-start");
    const endInput = document.getElementById("schedule-end");
    const bellAffectedInput = document.getElementById("bell-affected");
    const bellStartInput = document.getElementById("bell-start");
    const bellEndInput = document.getElementById("bell-end");

    if (!nameInput || !startInput || !endInput) {
        return;
    }

    const classItem = {
        id: Date.now(),

        name: nameInput.value.trim(),

        teacher: teacherInput
            ? teacherInput.value.trim()
            : "",

        room: roomInput
            ? roomInput.value.trim()
            : "",

        start: startInput.value,

        end: endInput.value,

        bellAffected: bellAffectedInput
            ? bellAffectedInput.value
            : "no",

        bellStart: bellStartInput
            ? bellStartInput.value
            : "",

        bellEnd: bellEndInput
            ? bellEndInput.value
            : ""
    };

    if (!classItem.name) {
        alert("Please enter a class name.");
        return;
    }

    if (!classItem.start || !classItem.end) {
        alert("Please enter the class start and end times.");
        return;
    }

    if (
        bellMode === "hour" &&
        classItem.bellAffected === "yes" &&
        (!classItem.bellStart || !classItem.bellEnd)
    ) {
        alert("Please enter the 1 Hour Bell start and end times.");
        return;
    }

    data.classes.push(classItem);

    saveData();

    renderSavedSchedule();

    // Reset form
    if (nameInput) nameInput.value = "";
    if (teacherInput) teacherInput.value = "";
    if (roomInput) roomInput.value = "";
    if (startInput) startInput.value = "";
    if (endInput) endInput.value = "";

    if (bellStartInput) bellStartInput.value = "";
    if (bellEndInput) bellEndInput.value = "";

    if (bellAffectedInput) {
        bellAffectedInput.value = "no";
    }

    toggleBellSettings();

    updateTimeRemaining();
}


// ===============================
// DELETE CLASS
// ===============================

function deleteClass(id) {
    data.classes = data.classes.filter(classItem => {
        return classItem.id !== id;
    });

    saveData();

    renderSavedSchedule();
    updateTimeRemaining();
}


// ===============================
// RENDER SAVED CLASSES
// ===============================

function renderSavedSchedule() {
    const container = document.getElementById("saved-schedule");

    if (!container) return;

    container.innerHTML = "";

    if (data.classes.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <p>No classes added yet.</p>
            </div>
        `;

        return;
    }

    data.classes.forEach(classItem => {
        const schedule = getEffectiveSchedule(classItem);

        const card = document.createElement("div");
        card.className = "schedule-card";

        card.innerHTML = `
            <div class="schedule-card-info">
                <h3>${escapeHTML(classItem.name)}</h3>

                ${
                    classItem.teacher
                        ? `<p>${escapeHTML(classItem.teacher)}</p>`
                        : ""
                }

                ${
                    classItem.room
                        ? `<p>Room: ${escapeHTML(classItem.room)}</p>`
                        : ""
                }

                <p class="schedule-time">
                    ${formatTime(schedule.start)}
                    –
                    ${formatTime(schedule.end)}
                </p>

                ${
                    bellMode === "hour" &&
                    classItem.bellAffected === "yes"
                        ? `<span class="bell-label">1 Hour Bell</span>`
                        : ""
                }
            </div>

            <button
                type="button"
                class="delete-button"
                onclick="deleteClass(${classItem.id})"
            >
                Delete
            </button>
        `;

        container.appendChild(card);
    });
}


// ===============================
// ASSIGNMENTS
// ===============================

function addAssignment(event) {
    event.preventDefault();

    const nameInput = document.getElementById("assignment-name");
    const classInput = document.getElementById("assignment-class");
    const dueInput = document.getElementById("assignment-due");

    if (!nameInput || !dueInput) {
        return;
    }

    const assignment = {
        id: Date.now(),

        name: nameInput.value.trim(),

        className: classInput
            ? classInput.value.trim()
            : "",

        due: dueInput.value,

        completed: false
    };

    if (!assignment.name) {
        alert("Please enter an assignment name.");
        return;
    }

    data.assignments.push(assignment);

    saveData();

    renderAssignments();

    nameInput.value = "";

    if (classInput) {
        classInput.value = "";
    }

    dueInput.value = "";
}


function toggleAssignment(id) {
    const assignment = data.assignments.find(item => {
        return item.id === id;
    });

    if (!assignment) return;

    assignment.completed = !assignment.completed;

    saveData();

    renderAssignments();
}


function deleteAssignment(id) {
    data.assignments = data.assignments.filter(item => {
        return item.id !== id;
    });

    saveData();

    renderAssignments();
}


function renderAssignments() {
    const container = document.getElementById("assignments-list");

    if (!container) return;

    container.innerHTML = "";

    if (data.assignments.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <p>No assignments yet.</p>
            </div>
        `;

        return;
    }

    const sortedAssignments = [...data.assignments].sort((a, b) => {
        return new Date(a.due) - new Date(b.due);
    });

    sortedAssignments.forEach(assignment => {
        const item = document.createElement("div");

        item.className = `assignment-item ${
            assignment.completed ? "completed" : ""
        }`;

        item.innerHTML = `
            <label class="assignment-check">
                <input
                    type="checkbox"
                    ${assignment.completed ? "checked" : ""}
                    onchange="toggleAssignment(${assignment.id})"
                >

                <span></span>
            </label>

            <div class="assignment-info">
                <h3>${escapeHTML(assignment.name)}</h3>

                ${
                    assignment.className
                        ? `<p>${escapeHTML(assignment.className)}</p>`
                        : ""
                }

                <p>
                    Due:
                    ${formatDate(assignment.due)}
                </p>
            </div>

            <button
                type="button"
                class="delete-button"
                onclick="deleteAssignment(${assignment.id})"
            >
                Delete
            </button>
        `;

        container.appendChild(item);
    });
}


// ===============================
// EVENTS
// ===============================

function addEvent(event) {
    event.preventDefault();

    const nameInput = document.getElementById("event-name");
    const dateInput = document.getElementById("event-date");
    const descriptionInput =
        document.getElementById("event-description");

    if (!nameInput || !dateInput) {
        return;
    }

    const eventItem = {
        id: Date.now(),

        name: nameInput.value.trim(),

        date: dateInput.value,

        description: descriptionInput
            ? descriptionInput.value.trim()
            : ""
    };

    if (!eventItem.name) {
        alert("Please enter an event name.");
        return;
    }

    data.events.push(eventItem);

    saveData();

    renderEvents();

    nameInput.value = "";
    dateInput.value = "";

    if (descriptionInput) {
        descriptionInput.value = "";
    }
}


function deleteEvent(id) {
    data.events = data.events.filter(item => {
        return item.id !== id;
    });

    saveData();

    renderEvents();
}


function renderEvents() {
    const container = document.getElementById("events-list");

    if (!container) return;

    container.innerHTML = "";

    if (data.events.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <p>No events yet.</p>
            </div>
        `;

        return;
    }

    const sortedEvents = [...data.events].sort((a, b) => {
        return new Date(a.date) - new Date(b.date);
    });

    sortedEvents.forEach(eventItem => {
        const item = document.createElement("div");

        item.className = "event-item";

        item.innerHTML = `
            <div class="event-info">
                <h3>${escapeHTML(eventItem.name)}</h3>

                <p>
                    ${formatDate(eventItem.date)}
                </p>

                ${
                    eventItem.description
                        ? `<p>${escapeHTML(
                              eventItem.description
                          )}</p>`
                        : ""
                }
            </div>

            <button
                type="button"
                class="delete-button"
                onclick="deleteEvent(${eventItem.id})"
            >
                Delete
            </button>
        `;

        container.appendChild(item);
    });
}


// ===============================
// TIME REMAINING
// ===============================

function updateTimeRemaining() {
    const element = document.getElementById("time-remaining");

    if (!element) return;

    const now = new Date();

    let currentClass = null;

    for (const classItem of data.classes) {
        const schedule = getEffectiveSchedule(classItem);

        if (!schedule.start || !schedule.end) {
            continue;
        }

        const startMinutes = timeToMinutes(schedule.start);
        const endMinutes = timeToMinutes(schedule.end);

        const currentMinutes =
            now.getHours() * 60 + now.getMinutes();

        if (
            currentMinutes >= startMinutes &&
            currentMinutes <= endMinutes
        ) {
            currentClass = {
                ...classItem,
                schedule
            };

            break;
        }
    }

    if (!currentClass) {
        element.textContent = "No class right now";
        return;
    }

    const endMinutes =
        timeToMinutes(currentClass.schedule.end);

    const currentMinutes =
        now.getHours() * 60 + now.getMinutes();

    const remaining = endMinutes - currentMinutes;

    if (remaining <= 0) {
        element.textContent = "Class ending now";
    } else if (remaining === 1) {
        element.textContent = "1 minute remaining";
    } else {
        element.textContent =
            `${remaining} minutes remaining`;
    }
}


// ===============================
// DATE HELPERS
// ===============================

function formatDate(dateString) {
    if (!dateString) return "";

    const date = new Date(dateString + "T00:00:00");

    if (Number.isNaN(date.getTime())) {
        return dateString;
    }

    return date.toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
        year: "numeric"
    });
}


// ===============================
// HTML SAFETY
// ===============================

function escapeHTML(value) {
    if (value === null || value === undefined) {
        return "";
    }

    return String(value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}


// ===============================
// NAVIGATION
// ===============================

function showSection(sectionId) {
    document.querySelectorAll(".page-section").forEach(section => {
        section.classList.remove("active");
    });

    const section = document.getElementById(sectionId);

    if (section) {
        section.classList.add("active");
    }

    document.querySelectorAll(".nav-item").forEach(item => {
        item.classList.remove("active");
    });

    const activeNav = document.querySelector(
        `[data-section="${sectionId}"]`
    );

    if (activeNav) {
        activeNav.classList.add("active");
    }
}


// ===============================
// INITIALIZATION
// ===============================

document.addEventListener("DOMContentLoaded", () => {
    loadData();

    // ---------------------------
    // Bell mode buttons
    // ---------------------------

    document.querySelectorAll(".mode-button").forEach(button => {
        button.addEventListener("click", () => {
            setBellMode(button.dataset.mode);
        });
    });

    // ---------------------------
    // Bell affected dropdown
    // ---------------------------

    const bellAffected =
        document.getElementById("bell-affected");

    if (bellAffected) {
        bellAffected.addEventListener(
            "change",
            toggleBellSettings
        );
    }

    // ---------------------------
    // Class form
    // ---------------------------

    const classForm =
        document.getElementById("class-form");

    if (classForm) {
        classForm.addEventListener(
            "submit",
            addClass
        );
    }

    // ---------------------------
    // Assignment form
    // ---------------------------

    const assignmentForm =
        document.getElementById("assignment-form");

    if (assignmentForm) {
        assignmentForm.addEventListener(
            "submit",
            addAssignment
        );
    }

    // ---------------------------
    // Event form
    // ---------------------------

    const eventForm =
        document.getElementById("event-form");

    if (eventForm) {
        eventForm.addEventListener(
            "submit",
            addEvent
        );
    }

    // ---------------------------
    // Navigation
    // ---------------------------

    document.querySelectorAll("[data-section]").forEach(item => {
        item.addEventListener("click", event => {
            event.preventDefault();

            const section =
                item.dataset.section;

            if (section) {
                showSection(section);
            }
        });
    });

    // ---------------------------
    // Set initial bell mode
    // ---------------------------

    setBellMode(bellMode);

    // ---------------------------
    // Render saved information
    // ---------------------------

    renderSavedSchedule();
    renderAssignments();
    renderEvents();

    // ---------------------------
    // Update clock
    // ---------------------------

    updateTimeRemaining();

    setInterval(() => {
        updateTimeRemaining();
    }, 30000);
});
