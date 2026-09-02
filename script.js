```javascript
// ===============================
// Palumbo Student Interface
// Main JavaScript
// ===============================


// ===============================
// DATA
// ===============================

let data = {
    scheduleClasses: [],
    tasks: [],
    homework: [],
    gpaClasses: [],
    bellMode: "normal"
};

let bellMode = "normal";


// ===============================
// LOCAL STORAGE
// ===============================

function saveData() {
    localStorage.setItem(
        "palumboStudentData",
        JSON.stringify(data)
    );
}


function loadData() {
    const savedData = localStorage.getItem(
        "palumboStudentData"
    );

    if (!savedData) {
        return;
    }

    try {
        const parsed = JSON.parse(savedData);

        data = {
            scheduleClasses:
                parsed.scheduleClasses ||
                parsed.classes ||
                [],

            tasks:
                parsed.tasks ||
                [],

            homework:
                parsed.homework ||
                parsed.assignments ||
                [],

            gpaClasses:
                parsed.gpaClasses ||
                [],

            bellMode:
                parsed.bellMode ||
                "normal"
        };

        bellMode = data.bellMode;

    } catch (error) {
        console.error(
            "Could not load saved data:",
            error
        );
    }
}


// ===============================
// BELL MODE
// ===============================

function setBellMode(mode) {

    bellMode =
        mode === "hour"
            ? "hour"
            : "normal";

    data.bellMode = bellMode;

    saveData();


    // Update active button

    document
        .querySelectorAll(".mode-button")
        .forEach(button => {

            button.classList.toggle(
                "active",
                button.dataset.mode === bellMode
            );

        });


    const bellSettings =
        document.getElementById(
            "bell-settings"
        );

    const bellAffected =
        document.getElementById(
            "bell-affected"
        );

    const bellStart =
        document.getElementById(
            "bell-start"
        );

    const bellEnd =
        document.getElementById(
            "bell-end"
        );


    // ===========================
    // 1 HOUR BELL
    // ===========================

    if (bellMode === "hour") {

        if (bellAffected) {
            bellAffected.value = "yes";
        }

        if (bellSettings) {
            bellSettings.classList.add(
                "visible"
            );
        }

        if (bellStart) {
            bellStart.required = true;
        }

        if (bellEnd) {
            bellEnd.required = true;
        }

    }


    // ===========================
    // NORMAL BELL
    // ===========================

    else {

        if (bellSettings) {
            bellSettings.classList.remove(
                "visible"
            );
        }

        if (bellStart) {
            bellStart.required = false;
        }

        if (bellEnd) {
            bellEnd.required = false;
        }

    }


    renderSavedSchedule();
    updateScheduleDisplay();
}


// ===============================
// BELL SETTINGS
// ===============================

function toggleBellSettings() {

    const bellAffected =
        document.getElementById(
            "bell-affected"
        );

    const bellSettings =
        document.getElementById(
            "bell-settings"
        );

    const bellStart =
        document.getElementById(
            "bell-start"
        );

    const bellEnd =
        document.getElementById(
            "bell-end"
        );


    if (
        !bellAffected ||
        !bellSettings
    ) {
        return;
    }


    const visible =
        bellAffected.value === "yes";


    bellSettings.classList.toggle(
        "visible",
        visible
    );


    if (bellStart) {
        bellStart.required = visible;
    }

    if (bellEnd) {
        bellEnd.required = visible;
    }
}


// ===============================
// TIME FUNCTIONS
// ===============================

function timeToMinutes(time) {

    if (!time) {
        return null;
    }

    const parts =
        time.split(":");

    return (
        Number(parts[0]) * 60 +
        Number(parts[1])
    );
}


function formatTime(time) {

    if (!time) {
        return "";
    }

    const parts =
        time.split(":");

    let hours =
        Number(parts[0]);

    const minutes =
        parts[1];

    const suffix =
        hours >= 12
            ? "PM"
            : "AM";

    hours =
        hours % 12 || 12;

    return `${hours}:${minutes} ${suffix}`;
}


// ===============================
// GET EFFECTIVE SCHEDULE
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
// ADD SCHEDULE CLASS
// ===============================

function addScheduleClass(event) {

    event.preventDefault();


    // Correct IDs from YOUR HTML

    const nameInput =
        document.getElementById(
            "schedule-class-name"
        );

    const teacherInput =
        document.getElementById(
            "schedule-teacher"
        );

    const startInput =
        document.getElementById(
            "schedule-start"
        );

    const endInput =
        document.getElementById(
            "schedule-end"
        );

    const bellAffectedInput =
        document.getElementById(
            "bell-affected"
        );

    const bellStartInput =
        document.getElementById(
            "bell-start"
        );

    const bellEndInput =
        document.getElementById(
            "bell-end"
        );


    // Get selected days

    const selectedDays =
        Array.from(
            document.querySelectorAll(
                ".days-picker input[type='checkbox']:checked"
            )
        ).map(
            checkbox => checkbox.value
        );


    // Basic validation

    if (!nameInput.value.trim()) {

        alert(
            "Please enter a class name."
        );

        return;
    }


    if (
        !startInput.value ||
        !endInput.value
    ) {

        alert(
            "Please enter a start and end time."
        );

        return;
    }


    if (selectedDays.length === 0) {

        alert(
            "Please select at least one day."
        );

        return;
    }


    // 1 Hour Bell validation

    if (
        bellMode === "hour" &&
        bellAffectedInput.value === "yes" &&
        (
            !bellStartInput.value ||
            !bellEndInput.value
        )
    ) {

        alert(
            "Please enter the 1 Hour Bell start and end times."
        );

        return;
    }


    // Create class

    const classItem = {

        id: Date.now(),

        name:
            nameInput.value.trim(),

        teacher:
            teacherInput.value.trim(),

        days:
            selectedDays,

        start:
            startInput.value,

        end:
            endInput.value,

        bellAffected:
            bellAffectedInput.value,

        bellStart:
            bellStartInput.value,

        bellEnd:
            bellEndInput.value

    };


    // Add to schedule

    data.scheduleClasses.push(
        classItem
    );

    saveData();


    // Update everything

    renderSavedSchedule();
    updateScheduleDisplay();
    updateHomeworkClassOptions();


    // Clear form

    clearScheduleForm();
}


// ===============================
// CLEAR SCHEDULE FORM
// ===============================

function clearScheduleForm() {

    const form =
        document.getElementById(
            "schedule-form"
        );

    if (!form) {
        return;
    }


    form.reset();


    // Restore bell setting
    const bellAffected =
        document.getElementById(
            "bell-affected"
        );

    if (bellAffected) {
        bellAffected.value = "no";
    }


    // Hide bell options

    toggleBellSettings();


    // Restore 1 Hour Bell mode
    // visually without forcing it

    setBellMode(bellMode);
}


// ===============================
// DELETE SCHEDULE CLASS
// ===============================

function deleteScheduleClass(id) {

    data.scheduleClasses =
        data.scheduleClasses.filter(
            classItem =>
                classItem.id !== id
        );


    saveData();

    renderSavedSchedule();
    updateScheduleDisplay();
    updateHomeworkClassOptions();
}


// ===============================
// RENDER SAVED SCHEDULE
// ===============================

function renderSavedSchedule() {

    const container =
        document.getElementById(
            "saved-schedule-list"
        );


    if (!container) {
        return;
    }


    container.innerHTML = "";


    if (
        data.scheduleClasses.length === 0
    ) {

        container.innerHTML = `
            <div class="empty-state">
                <p>No classes added yet.</p>
            </div>
        `;

        return;
    }


    data.scheduleClasses.forEach(
        classItem => {

            const schedule =
                getEffectiveSchedule(
                    classItem
                );


            const card =
                document.createElement(
                    "div"
                );

            card.className =
                "schedule-card";


            card.innerHTML = `

                <div class="schedule-card-info">

                    <h3>
                        ${escapeHTML(
                            classItem.name
                        )}
                    </h3>

                    ${
                        classItem.teacher
                            ? `
                                <p>
                                    ${escapeHTML(
                                        classItem.teacher
                                    )}
                                </p>
                              `
                            : ""
                    }

                    <p>
                        ${classItem.days
                            .map(day =>
                                escapeHTML(day)
                            )
                            .join(", ")
                        }
                    </p>

                    <p class="schedule-time">
                        ${formatTime(
                            schedule.start
                        )}
                        –
                        ${formatTime(
                            schedule.end
                        )}
                    </p>

                    ${
                        bellMode === "hour" &&
                        classItem.bellAffected === "yes"
                            ? `
                                <span class="bell-label">
                                    1 Hour Bell
                                </span>
                              `
                            : ""
                    }

                </div>


                <button
                    type="button"
                    class="delete-button"
                    onclick="deleteScheduleClass(${classItem.id})"
                >
                    Delete
                </button>

            `;


            container.appendChild(
                card
            );

        }
    );
}


// ===============================
// UPDATE MAIN SCHEDULE
// ===============================

function updateScheduleDisplay() {

    const container =
        document.getElementById(
            "class-list"
        );

    if (!container) {
        return;
    }


    container.innerHTML = "";


    const today =
        new Date().toLocaleDateString(
            "en-US",
            {
                weekday: "long"
            }
        );


    const todayClasses =
        data.scheduleClasses.filter(
            classItem =>
                classItem.days &&
                classItem.days.includes(
                    today
                )
        );


    todayClasses.sort(
        (a, b) => {

            const scheduleA =
                getEffectiveSchedule(a);

            const scheduleB =
                getEffectiveSchedule(b);

            return (
                timeToMinutes(
                    scheduleA.start
                ) -
                timeToMinutes(
                    scheduleB.start
                )
            );

        }
    );


    if (todayClasses.length === 0) {

        container.innerHTML = `
            <div class="empty-state">
                <p>
                    No classes scheduled for today.
                </p>
            </div>
        `;

        return;
    }


    todayClasses.forEach(
        classItem => {

            const schedule =
                getEffectiveSchedule(
                    classItem
                );


            const row =
                document.createElement(
                    "div"
                );

            row.className =
                "schedule-row";


            row.innerHTML = `

                <div>
                    <strong>
                        ${escapeHTML(
                            classItem.name
                        )}
                    </strong>

                    ${
                        classItem.teacher
                            ? `
                                <small>
                                    ${escapeHTML(
                                        classItem.teacher
                                    )}
                                </small>
                              `
                            : ""
                    }
                </div>

                <div>
                    ${formatTime(
                        schedule.start
                    )}
                </div>

                <div>
                    ${formatTime(
                        schedule.end
                    )}
                </div>

                <div
                    class="time-remaining"
                    data-start="${schedule.start}"
                    data-end="${schedule.end}"
                >
                    —
                </div>

            `;


            container.appendChild(
                row
            );

        }
    );


    updateTimeRemaining();
}


// ===============================
// TIME REMAINING
// ===============================

function updateTimeRemaining() {

    const now =
        new Date();


    const currentMinutes =
        now.getHours() * 60 +
        now.getMinutes();


    document
        .querySelectorAll(
            ".time-remaining"
        )
        .forEach(element => {

            const start =
                timeToMinutes(
                    element.dataset.start
                );

            const end =
                timeToMinutes(
                    element.dataset.end
                );


            if (
                currentMinutes < start
            ) {

                const difference =
                    start -
                    currentMinutes;

                element.textContent =
                    `${difference} min until`;

            }

            else if (
                currentMinutes >= start &&
                currentMinutes < end
            ) {

                const remaining =
                    end -
                    currentMinutes;

                element.textContent =
                    `${remaining} min left`;

            }

            else {

                element.textContent =
                    "Finished";

            }

        });
}


// ===============================
// TASKS
// ===============================

function addTask(event) {

    event.preventDefault();


    const input =
        document.getElementById(
            "task-input"
        );


    if (!input.value.trim()) {
        return;
    }


    data.tasks.push({

        id: Date.now(),

        name:
            input.value.trim(),

        completed:
            false

    });


    saveData();

    renderTasks();


    input.value = "";
}


function toggleTask(id) {

    const task =
        data.tasks.find(
            task =>
                task.id === id
        );


    if (!task) {
        return;
    }


    task.completed =
        !task.completed;


    saveData();

    renderTasks();
}


function deleteTask(id) {

    data.tasks =
        data.tasks.filter(
            task =>
                task.id !== id
        );


    saveData();

    renderTasks();
}


function renderTasks() {

    const container =
        document.getElementById(
            "task-list"
        );


    if (!container) {
        return;
    }


    container.innerHTML = "";


    data.tasks.forEach(
        task => {

            const item =
                document.createElement(
                    "div"
                );

            item.className =
                `task-item ${
                    task.completed
                        ? "completed"
                        : ""
                }`;


            item.innerHTML = `

                <label>

                    <input
                        type="checkbox"
                        ${
                            task.completed
                                ? "checked"
                                : ""
                        }
                    >

                    <span>
                        ${escapeHTML(
                            task.name
                        )}
                    </span>

                </label>

                <button
                    type="button"
                    onclick="deleteTask(${task.id})"
                >
                    ×
                </button>

            `;


            const checkbox =
                item.querySelector(
                    "input"
                );


            checkbox.addEventListener(
                "change",
                () =>
                    toggleTask(task.id)
            );


            container.appendChild(
                item
            );

        }
    );


    const progress =
        document.getElementById(
            "task-progress"
        );


    if (progress) {

        const completed =
            data.tasks.filter(
                task =>
                    task.completed
            ).length;


        progress.textContent =
            `${completed} / ${data.tasks.length}`;

    }
}


// ===============================
// HOMEWORK
// ===============================

function addHomework(event) {

    event.preventDefault();


    const nameInput =
        document.getElementById(
            "homework-name"
        );

    const classInput =
        document.getElementById(
            "homework-class"
        );

    const priorityInput =
        document.getElementById(
            "homework-priority"
        );

    const dueInput =
        document.getElementById(
            "homework-due"
        );


    if (
        !nameInput.value.trim() ||
        !dueInput.value
    ) {
        return;
    }


    data.homework.push({

        id: Date.now(),

        name:
            nameInput.value.trim(),

        className:
            classInput.value,

        priority:
            priorityInput.value,

        due:
            dueInput.value,

        completed:
            false

    });


    saveData();

    renderHomework();


    nameInput.value = "";
    classInput.value = "";
    priorityInput.value = "medium";
    dueInput.value = "";
}


function toggleHomework(id) {

    const item =
        data.homework.find(
            homework =>
                homework.id === id
        );


    if (!item) {
        return;
    }


    item.completed =
        !item.completed;


    saveData();

    renderHomework();
}


function deleteHomework(id) {

    data.homework =
        data.homework.filter(
            homework =>
                homework.id !== id
        );


    saveData();

    renderHomework();
}


function renderHomework() {

    const container =
        document.getElementById(
            "homework-list"
        );


    if (!container) {
        return;
    }


    container.innerHTML = "";


    data.homework.forEach(
        homework => {

            const item =
                document.createElement(
                    "div"
                );


            item.className =
                `homework-item ${
                    homework.completed
                        ? "completed"
                        : ""
                }`;


            item.innerHTML = `

                <label>

                    <input
                        type="checkbox"
                        ${
                            homework.completed
                                ? "checked"
                                : ""
                        }
                    >

                </label>

                <div>

                    <strong>
                        ${escapeHTML(
                            homework.name
                        )}
                    </strong>

                    <p>
                        ${escapeHTML(
                            homework.className ||
                            "No class"
                        )}
                    </p>

                    <p>
                        Due:
                        ${formatDate(
                            homework.due
                        )}
                    </p>

                    <span>
                        ${escapeHTML(
                            homework.priority
                        )}
                    </span>

                </div>

                <button
                    type="button"
                    onclick="deleteHomework(${homework.id})"
                >
                    Delete
                </button>

            `;


            const checkbox =
                item.querySelector(
                    "input"
                );


            checkbox.addEventListener(
                "change",
                () =>
                    toggleHomework(
                        homework.id
                    )
            );


            container.appendChild(
                item
            );

        }
    );


    const progress =
        document.getElementById(
            "homework-progress"
        );


    if (progress) {

        const completed =
            data.homework.filter(
                homework =>
                    homework.completed
            ).length;


        progress.textContent =
            `${completed} / ${data.homework.length}`;

    }
}


// ===============================
// HOMEWORK CLASS DROPDOWN
// ===============================

function updateHomeworkClassOptions() {

    const select =
        document.getElementById(
            "homework-class"
        );


    if (!select) {
        return;
    }


    select.innerHTML = `
        <option value="">
            Select a class
        </option>
    `;


    data.scheduleClasses.forEach(
        classItem => {

            const option =
                document.createElement(
                    "option"
                );


            option.value =
                classItem.name;

            option.textContent =
                classItem.name;


            select.appendChild(
                option
            );

        }
    );
}


// ===============================
// GPA CALCULATOR
// ===============================

function getGPAValue(
    grade,
    level
) {

    let baseGPA;


    if (grade >= 93) {
        baseGPA = 4.0;
    }

    else if (grade >= 90) {
        baseGPA = 3.7;
    }

    else if (grade >= 87) {
        baseGPA = 3.3;
    }

    else if (grade >= 83) {
        baseGPA = 3.0;
    }

    else if (grade >= 80) {
        baseGPA = 2.7;
    }

    else if (grade >= 77) {
        baseGPA = 2.3;
    }

    else if (grade >= 73) {
        baseGPA = 2.0;
    }

    else if (grade >= 70) {
        baseGPA = 1.7;
    }

    else if (grade >= 67) {
        baseGPA = 1.3;
    }

    else if (grade >= 65) {
        baseGPA = 1.0;
    }

    else {
        baseGPA = 0.0;
    }


    if (level === "honors") {
        return Math.min(
            baseGPA + 0.5,
            4.5
        );
    }


    if (level === "ap") {
        return Math.min(
            baseGPA + 1.0,
            5.0
        );
    }


    return baseGPA;
}


function addGPAClass(event) {

    event.preventDefault();


    const nameInput =
        document.getElementById(
            "class-name"
        );

    const creditInput =
        document.getElementById(
            "credit-hours"
        );

    const gradeInput =
        document.getElementById(
            "grade"
        );

    const quarterInput =
        document.getElementById(
            "quarter"
        );

    const levelInput =
        document.getElementById(
            "class-level"
        );


    const grade =
        Number(
            gradeInput.value
        );


    const credit =
        Number(
            creditInput.value
        );


    if (
        !nameInput.value.trim() ||
        !credit ||
        Number.isNaN(grade)
    ) {

        alert(
            "Please complete all GPA fields."
        );

        return;
    }


    const course = {

        id: Date.now(),

        name:
            nameInput.value.trim(),

        credits:
            credit,

        grade:
            grade,

        quarter:
            quarterInput.value,

        level:
            levelInput.value

    };


    data.gpaClasses.push(
        course
    );


    saveData();

    renderGPA();


    nameInput.value = "";
    creditInput.value = "";
    gradeInput.value = "";
}


// ===============================
// RENDER GPA
// ===============================

function renderGPA() {

    document
        .querySelectorAll(
            ".quarter-section"
        )
        .forEach(section => {

            const list =
                section.querySelector(
                    ".course-list"
                );

            if (list) {
                list.innerHTML = "";
            }

        });


    data.gpaClasses.forEach(
        course => {

            const section =
                document.getElementById(
                    course.quarter
                );


            if (!section) {
                return;
            }


            const list =
                section.querySelector(
                    ".course-list"
                );


            if (!list) {
                return;
            }


            const gpa =
                getGPAValue(
                    course.grade,
                    course.level
                );


            const item =
                document.createElement(
                    "li"
                );


            item.innerHTML = `

                <strong>
                    ${escapeHTML(
                        course.name
                    )}
                </strong>

                — ${course.grade}%

                — ${escapeHTML(
                    course.level
                )}

                — GPA:
                ${gpa.toFixed(2)}

                <button
                    type="button"
                    onclick="deleteGPAClass(${course.id})"
                >
                    Delete
                </button>

            `;


            list.appendChild(
                item
            );

        }
    );


    calculateOverallGPA();
}


// ===============================
// DELETE GPA CLASS
// ===============================

function deleteGPAClass(id) {

    data.gpaClasses =
        data.gpaClasses.filter(
            course =>
                course.id !== id
        );


    saveData();

    renderGPA();
}


// ===============================
// CALCULATE GPA
// ===============================

function calculateOverallGPA() {

    if (
        data.gpaClasses.length === 0
    ) {

        setGPA(
            "unweighted-gpa",
            0
        );

        setGPA(
            "weighted-gpa",
            0
        );

        return;
    }


    let totalCredits = 0;
    let weightedTotal = 0;
    let unweightedTotal = 0;


    data.gpaClasses.forEach(
        course => {

            const credits =
                Number(
                    course.credits
                ) || 1;


            const unweighted =
                getGPAValue(
                    course.grade,
                    "normal"
                );


            const weighted =
                getGPAValue(
                    course.grade,
                    course.level
                );


            totalCredits += credits;

            unweightedTotal +=
                unweighted * credits;

            weightedTotal +=
                weighted * credits;

        }
    );


    const unweighted =
        totalCredits
            ? unweightedTotal /
              totalCredits
            : 0;


    const weighted =
        totalCredits
            ? weightedTotal /
              totalCredits
            : 0;


    setGPA(
        "unweighted-gpa",
        unweighted
    );

    setGPA(
        "weighted-gpa",
        weighted
    );
}


function setGPA(
    id,
    value
) {

    const element =
        document.getElementById(id);


    if (element) {

        element.textContent =
            Number(value).toFixed(2);

    }
}


// ===============================
// DATE
// ===============================

function formatDate(dateString) {

    if (!dateString) {
        return "";
    }


    const date =
        new Date(
            dateString +
            "T00:00:00"
        );


    return date.toLocaleDateString(
        "en-US",
        {
            month: "short",
            day: "numeric",
            year: "numeric"
        }
    );
}


// ===============================
// CLOCK
// ===============================

function updateClock() {

    const clock =
        document.getElementById(
            "clock"
        );


    if (clock) {

        clock.textContent =
            new Date().toLocaleTimeString(
                "en-US",
                {
                    hour: "numeric",
                    minute: "2-digit",
                    second: "2-digit"
                }
            );

    }


    const date =
        document.getElementById(
            "hero-date"
        );


    if (date) {

        date.textContent =
            new Date().toLocaleDateString(
                "en-US",
                {
                    weekday: "long",
                    month: "long",
                    day: "numeric",
                    year: "numeric"
                }
            );

    }


    const dayName =
        document.getElementById(
            "day-name"
        );


    if (dayName) {

        dayName.textContent =
            `Schedule for ${new Date().toLocaleDateString(
                "en-US",
                {
                    weekday: "long"
                }
            )}`;

    }


    updateTimeRemaining();
}


// ===============================
// HTML SAFETY
// ===============================

function escapeHTML(value) {

    if (
        value === null ||
        value === undefined
    ) {
        return "";
    }


    return String(value)
        .replace(
            /&/g,
            "&amp;"
        )
        .replace(
            /</g,
            "&lt;"
        )
        .replace(
            />/g,
            "&gt;"
        )
        .replace(
            /"/g,
            "&quot;"
        )
        .replace(
            /'/g,
            "&#039;"
        );
}


// ===============================
// EXPORT CLASSES
// ===============================

function exportClasses() {

    const exportData = {

        scheduleClasses:
            data.scheduleClasses,

        gpaClasses:
            data.gpaClasses,

        bellMode:
            data.bellMode

    };


    const blob =
        new Blob(
            [
                JSON.stringify(
                    exportData,
                    null,
                    2
                )
            ],
            {
                type:
                    "application/json"
            }
        );


    const url =
        URL.createObjectURL(
            blob
        );


    const link =
        document.createElement(
            "a"
        );


    link.href = url;

    link.download =
        "palumbo-class-list.json";


    link.click();


    URL.revokeObjectURL(url);
}


// ===============================
// IMPORT CLASSES
// ===============================

function importClasses(event) {

    const file =
        event.target.files[0];


    if (!file) {
        return;
    }


    const reader =
        new FileReader();


    reader.onload =
        function () {

            try {

                const imported =
                    JSON.parse(
                        reader.result
                    );


                if (
                    imported.scheduleClasses
                ) {

                    data.scheduleClasses =
                        imported.scheduleClasses;

                }

                else if (
                    imported.classes
                ) {

                    data.scheduleClasses =
                        imported.classes;

                }


                if (
                    imported.gpaClasses
                ) {

                    data.gpaClasses =
                        imported.gpaClasses;

                }


                if (
                    imported.bellMode
                ) {

                    data.bellMode =
                        imported.bellMode;

                    bellMode =
                        imported.bellMode;

                }


                saveData();


                renderSavedSchedule();
                updateScheduleDisplay();
                updateHomeworkClassOptions();
                renderGPA();
                setBellMode(bellMode);


                alert(
                    "Class list imported successfully!"
                );


            }

            catch (error) {

                alert(
                    "Could not import this file."
                );

                console.error(error);

            }

        };


    reader.readAsText(file);


    // Allow the same file
    // to be imported again

    event.target.value = "";
}


// ===============================
// NAVIGATION
// ===============================

function setupNavigation() {

    document
        .querySelectorAll(
            ".sidebar a"
        )
        .forEach(link => {

            link.addEventListener(
                "click",
                event => {

                    const target =
                        document.querySelector(
                            link.getAttribute(
                                "href"
                            )
                        );


                    if (target) {

                        event.preventDefault();

                        target.scrollIntoView({
                            behavior:
                                "smooth"
                        });

                    }

                }
            );

        });
}


// ===============================
// INITIALIZATION
// ===============================

document.addEventListener(
    "DOMContentLoaded",
    () => {

        // Load saved data

        loadData();


        // =======================
        // Schedule form
        // =======================

        const scheduleForm =
            document.getElementById(
                "schedule-form"
            );


        if (scheduleForm) {

            scheduleForm.addEventListener(
                "submit",
                addScheduleClass
            );

        }


        // =======================
        // Bell dropdown
        // =======================

        const bellAffected =
            document.getElementById(
                "bell-affected"
            );


        if (bellAffected) {

            bellAffected.addEventListener(
                "change",
                toggleBellSettings
            );

        }


        // =======================
        // Task form
        // =======================

        const taskForm =
            document.getElementById(
                "task-form"
            );


        if (taskForm) {

            taskForm.addEventListener(
                "submit",
                addTask
            );

        }


        // =======================
        // Homework form
        // =======================

        const homeworkForm =
            document.getElementById(
                "homework-form"
            );


        if (homeworkForm) {

            homeworkForm.addEventListener(
                "submit",
                addHomework
            );

        }


        // =======================
        // GPA form
        // =======================

        const gpaForm =
            document.getElementById(
                "add-class-form"
            );


        if (gpaForm) {

            gpaForm.addEventListener(
                "submit",
                addGPAClass
            );

        }


        // =======================
        // Bell mode
        // =======================

        setBellMode(
            bellMode
        );


        // =======================
        // Render everything
        // =======================

        renderSavedSchedule();

        updateScheduleDisplay();

        renderTasks();

        renderHomework();

        updateHomeworkClassOptions();

        renderGPA();

        setupNavigation();

        updateClock();


        // =======================
        // Clock
        // =======================

        setInterval(
            updateClock,
            1000
        );

    }
);
```
