document.addEventListener('DOMContentLoaded', function() {
    const inputBox = document.getElementById('input-box');
    const datetimeBox = document.getElementById('datetime-box');
    const categorySelect = document.getElementById('category-select');
    const statusSelect = document.getElementById('status-select');
    const addButton = document.getElementById('add');
    const prevMonthButton = document.getElementById('prev-month');
    const nextMonthButton = document.getElementById('next-month');
    const newTasksList = document.getElementById('new-list');
    const inProgressTasksList = document.getElementById('in-progress-list');
    const doneTasksList = document.getElementById('done-list');
    const calendar = document.getElementById('calendar');
    const taskHistoryTable = document.getElementById('task-history');
    const taskHistoryTableBody = taskHistoryTable.querySelector('tbody');
    const monthLabel = document.getElementById('month-label');
    let db;
    const request = indexedDB.open('taskDB', 1);
    request.onerror = function(event) {
        console.error('IndexedDB error:', event.target.errorCode);
    };
    request.onupgradeneeded = function(event) {
        db = event.target.result;
        const objectStore = db.createObjectStore('tasks', { keyPath: 'id', autoIncrement: true });
        objectStore.createIndex('name', 'name', { unique: false });
        objectStore.createIndex('deadline', 'deadline', { unique: false });
        objectStore.createIndex('category', 'category', { unique: false });
        objectStore.createIndex('status', 'status', { unique: false });
    };
    request.onsuccess = function(event) {
        db = event.target.result;
        console.log('IndexedDB connection established.');
        let currentDate = new Date();
        let currentMonth = currentDate.getMonth();
        let currentYear = currentDate.getFullYear();
        function renderCalendar(month, year) {
            calendar.innerHTML = '';
            const daysInMonth = new Date(year, month + 1, 0).getDate();
            const monthName = new Date(year, month).toLocaleString('default', { month: 'long' });
            monthLabel.textContent = `${monthName} ${year}`;
            for (let day = 1; day <= daysInMonth; day++) {
                const date = new Date(year, month, day);
                const dateString = date.toISOString().split('T')[0];
                const dayElement = document.createElement('div');
                dayElement.className = 'calendar-day';
                dayElement.innerHTML = `<div class="date">${day}</div>`;
                const transaction = db.transaction(['tasks'], 'readonly');
                const objectStore = transaction.objectStore('tasks');
                const index = objectStore.index('deadline');
                index.getAll(dateString).onsuccess = function(event) {
                    const tasksForTheDay = event.target.result || [];
                    tasksForTheDay.forEach(task => {
                        const taskElement = document.createElement('div');
                        taskElement.className = 'calendar-task';
                        taskElement.textContent = task.name;
                        taskElement.addEventListener('click', function() {
                            deleteTask(task.id);
                        });
                        dayElement.appendChild(taskElement);
                    });
                };
                calendar.appendChild(dayElement);
            }
        }
        renderCalendar(currentMonth, currentYear);
        prevMonthButton.addEventListener('click', function() {
            currentMonth--;
            if (currentMonth < 0) {
                currentMonth = 11;
                currentYear--;
            }
            renderCalendar(currentMonth, currentYear);
        });
        nextMonthButton.addEventListener('click', function() {
            currentMonth++;
            if (currentMonth > 11) {
                currentMonth = 0;
                currentYear++;
            }
            renderCalendar(currentMonth, currentYear);
        });
        addButton.addEventListener('click', function(event) {
            event.preventDefault();
            const taskName = inputBox.value.trim();
            const dateTime = datetimeBox.value;
            const category = categorySelect.value;
            const status = statusSelect.value;
            if (taskName && dateTime && category && status) {
                const transaction = db.transaction(['tasks'], 'readwrite');
                const objectStore = transaction.objectStore('tasks');
                const newTask = {
                    name: taskName,
                    deadline: dateTime,
                    category: category,
                    status: status
                };
                objectStore.add(newTask).onsuccess = function() {
                    console.log('New task added to IndexedDB:', newTask);
                    addTaskToList(newTask);
                    addTaskToCalendar(newTask); // Add task to calendar
                    setReminder(dateTime, taskName);
                    clearForm();
                };
                transaction.onerror = function(event) {
                    console.error('Error adding task:', event.target.error);
                };
            } else {
                alert('Please fill out all fields and select a category and status.');
            }
        });
        function addTaskToList(task) {
            const taskItem = createTaskElement(task);
            switch (task.status) {
                case 'new':
                    newTasksList.appendChild(taskItem);
                    break;
                case 'in-progress':
                    inProgressTasksList.appendChild(taskItem);
                    break;
                case 'done':
                    doneTasksList.appendChild(taskItem);
                    break;
                default:
                    newTasksList.appendChild(taskItem);
            }
        }
        function createTaskElement(task) {
            const li = document.createElement('li');
            li.className = 'task-item';
            li.innerHTML = `
                <label>${task.name}</label>
                <span class="status-label">${task.status}</span>
                <input type="checkbox" ${task.status === 'done' ? 'checked' : ''}>
                <button class="edit-btn">Edit</button>
                <button class="delete-btn">Delete</button>
            `;
        
            const checkbox = li.querySelector('input[type="checkbox"]');
            const editButton = li.querySelector('.edit-btn');
            const deleteButton = li.querySelector('.delete-btn');
        
            checkbox.addEventListener('change', function () {
                updateTaskStatus(task, checkbox.checked);
            });
        
            editButton.addEventListener('click', function () {
                editTask(li, task);
            });
        
            deleteButton.addEventListener('click', function () {
                deleteTask(task.id);
            });
        
            return li;
        }
        function editTask(listItem, task) {
            // Replace task details with input fields for editing
            listItem.innerHTML = `
                <input type="text" value="${task.name}" class="edit-name">
                <select class="edit-status">
                    <option value="new" ${task.status === 'new' ? 'selected' : ''}>New</option>
                    <option value="in-progress" ${task.status === 'in-progress' ? 'selected' : ''}>In Progress</option>
                    <option value="done" ${task.status === 'done' ? 'selected' : ''}>Done</option>
                </select>
                <button class="save-btn">Save</button>
                <button class="cancel-btn">Cancel</button>
            `;
        
            const saveButton = listItem.querySelector('.save-btn');
            const cancelButton = listItem.querySelector('.cancel-btn');
        
            // When Save is clicked, update task in IndexedDB and reload
            saveButton.addEventListener('click', function () {
                const updatedName = listItem.querySelector('.edit-name').value;
                const updatedStatus = listItem.querySelector('.edit-status').value;
                task.name = updatedName;
                task.status = updatedStatus;
        
                const transaction = db.transaction(['tasks'], 'readwrite');
                const objectStore = transaction.objectStore('tasks');
                objectStore.put(task).onsuccess = function () {
                    console.log('Task updated in IndexedDB:', task);
                    loadTasks(); // Reload tasks after saving
                };
            });
        
            // When Cancel is clicked, revert back to the original display
            cancelButton.addEventListener('click', function () {
                loadTasks(); // Reload the original tasks if canceled
            });
        }
        
        function updateTaskStatus(task, isChecked) {
            task.status = isChecked ? 'done' : 'in-progress';
            const transaction = db.transaction(['tasks'], 'readwrite');
            const objectStore = transaction.objectStore('tasks');
            objectStore.put(task).onsuccess = function() {
                console.log('Task status updated in IndexedDB:', task);
                loadTasks();
            };
            transaction.onerror = function(event) {
                console.error('Error updating task status:', event.target.error);
            };
        }
        function deleteTask(taskId) {
            const transaction = db.transaction(['tasks'], 'readwrite');
            const objectStore = transaction.objectStore('tasks');
            objectStore.delete(taskId).onsuccess = function () {
                console.log('Task deleted from IndexedDB:', taskId);
                loadTasks(); // Reload tasks after deletion
            };
        }
        
        function loadTasks() {
            newTasksList.innerHTML = '';
            inProgressTasksList.innerHTML = '';
            doneTasksList.innerHTML = '';
            const transaction = db.transaction(['tasks'], 'readonly');
            const objectStore = transaction.objectStore('tasks');
            objectStore.openCursor().onsuccess = function(event) {
                const cursor = event.target.result;
                if (cursor) {
                    addTaskToList(cursor.value);
                    cursor.continue();
                }
            };
        }
        loadTasks();
        function clearForm() {
            inputBox.value = '';
            datetimeBox.value = '';
            categorySelect.value = '';
            statusSelect.value = '';
        }
        function setReminder(dateTime, taskName) {
            const reminderTime = new Date(dateTime).getTime() - 3600000;
            const now = new Date().getTime();
            const delay = reminderTime - now;
            if (delay > 0) {
                setTimeout(() => {
                    alert(`Reminder: The task "${taskName}" is due in an hour.`);
                }, delay);
            }
        }
        function addTaskToCalendar(task) {
            const date = new Date(task.deadline).toISOString().split('T')[0];
            const dayElements = calendar.getElementsByClassName('calendar-day');
            for (let dayElement of dayElements) {
                if (dayElement.querySelector('.date').textContent == new Date(task.deadline).getDate()) {
                    const taskElement = document.createElement('div');
                    taskElement.className = 'calendar-task';
                    taskElement.textContent = task.name;
                    taskElement.addEventListener('click', function() {
                        deleteTask(task.id);
                    });
                    dayElement.appendChild(taskElement);
                    break;
                }
            }
        }
        function generateHistory() {
            const transaction = db.transaction(['tasks'], 'readonly');
            const objectStore = transaction.objectStore('tasks');
            taskHistoryTableBody.innerHTML = '';
            objectStore.openCursor().onsuccess = function(event) {
                const cursor = event.target.result;
                if (cursor) {
                    const task = cursor.value;
                    const row = document.createElement('tr');
                    row.innerHTML = `
                        <td>${task.deadline}</td>
                        <td>${task.name}</td>
                        <td>${task.category} (${task.status})</td>
                    `;
                    taskHistoryTableBody.appendChild(row);
                    cursor.continue();
                }
            };
            taskHistoryTable.style.display = 'table';
        }

        document.getElementById('history').addEventListener('click', function() {
            generateHistory();
        });
    };
});