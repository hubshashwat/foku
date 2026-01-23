import './task-config-modal.css';

/**
 * Task Configuration Modal
 * Handles UI for configuring tasks with multiple reminder times
 */

let currentTaskData = null;
let reminderTimes = [];

// Listen for messages from background script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'showTaskConfigModal') {
        showModal(message.url, message.title);
        sendResponse({ success: true });
    }
    return true;
});

/**
 * Show the configuration modal
 */
function showModal(url, title) {
    console.log('Showing modal for:', url, title);
    currentTaskData = { url, title };
    reminderTimes = [];

    // Inject modal if not already present
    if (!document.getElementById('task-modal-overlay')) {
        injectModal();
        // Wait for injection to complete
        setTimeout(() => populateAndShow(url, title), 100);
    } else {
        populateAndShow(url, title);
    }
}

function populateAndShow(url, title) {
    console.log('Populating modal with:', url, title);

    // Populate modal data
    const titleEl = document.getElementById('modal-site-title');
    const urlEl = document.getElementById('modal-site-url');

    if (titleEl) titleEl.textContent = title;
    if (urlEl) urlEl.textContent = url;

    // Add first reminder time (2 minutes from now for testing)
    const now = new Date();
    const firstTime = new Date(now.getTime() + 120000);
    addReminderTime(formatTime(firstTime));

    // Show modal
    const overlay = document.getElementById('task-modal-overlay');
    if (overlay) {
        overlay.style.display = 'flex';
    }
}

/**
 * Inject modal HTML into page
 */
function injectModal() {
    console.log('Injecting modal...');
    fetch(chrome.runtime.getURL('content/task-config-modal.html'))
        .then(response => response.text())
        .then(html => {
            const parser = new DOMParser();
            const doc = parser.parseFromString(html, 'text/html');
            const modalOverlay = doc.getElementById('task-modal-overlay');
            document.body.appendChild(modalOverlay);

            console.log('Modal injected, attaching listeners');
            attachEventListeners();
        })
        .catch(error => {
            console.error('Failed to inject modal:', error);
        });
}

/**
 * Attach event listeners to modal elements
 */
function attachEventListeners() {
    // Close modal
    const closeBtn = document.getElementById('modal-close');
    const cancelBtn = document.getElementById('modal-cancel');

    if (closeBtn) closeBtn.addEventListener('click', closeModal);
    if (cancelBtn) cancelBtn.addEventListener('click', closeModal);

    // Close on overlay click
    const overlay = document.getElementById('task-modal-overlay');
    if (overlay) {
        overlay.addEventListener('click', (e) => {
            if (e.target.id === 'task-modal-overlay') {
                closeModal();
            }
        });
    }

    // Save task
    const saveBtn = document.getElementById('modal-save');
    if (saveBtn) {
        saveBtn.addEventListener('click', saveTask);
    }

    // Add time button
    const addTimeBtn = document.getElementById('add-time-btn');
    if (addTimeBtn) {
        addTimeBtn.addEventListener('click', () => addReminderTime());
    }
}

/**
 * Add a reminder time input
 */
function addReminderTime(defaultTime = '') {
    const list = document.getElementById('reminder-times-list');
    if (!list) return;

    const id = `time-${Date.now()}`;
    const item = document.createElement('div');
    item.className = 'reminder-time-item';
    item.dataset.id = id;

    // Default to next hour if no default provided
    if (!defaultTime) {
        const now = new Date();
        now.setHours(now.getHours() + 1, 0, 0, 0);
        defaultTime = formatTime(now);
    }

    item.innerHTML = `
        <input type="time" value="${defaultTime}" required>
        <button type="button" class="remove-time-btn" data-id="${id}">×</button>
    `;

    list.appendChild(item);

    // Attach remove listener
    const removeBtn = item.querySelector('.remove-time-btn');
    removeBtn.addEventListener('click', () => removeReminderTime(id));

    console.log('Added reminder time:', defaultTime);
}

/**
 * Remove a reminder time input
 */
function removeReminderTime(id) {
    const item = document.querySelector(`.reminder-time-item[data-id="${id}"]`);
    if (item) {
        // Keep at least one time
        const list = document.getElementById('reminder-times-list');
        if (list && list.children.length > 1) {
            item.remove();
            console.log('Removed reminder time:', id);
        } else {
            showError('You must have at least one reminder time');
        }
    }
}

/**
 * Get all reminder times from inputs
 */
function getReminderTimes() {
    const list = document.getElementById('reminder-times-list');
    if (!list) return [];

    const times = [];
    const inputs = list.querySelectorAll('input[type="time"]');

    inputs.forEach(input => {
        if (input.value) {
            times.push(input.value);
        }
    });

    return times;
}

/**
 * Save the task
 */
async function saveTask() {
    console.log('Save task clicked');

    const times = getReminderTimes();

    if (times.length === 0) {
        showError('Please add at least one reminder time');
        return;
    }

    // Check for duplicates
    const uniqueTimes = new Set(times);
    if (uniqueTimes.size !== times.length) {
        showError('Duplicate times detected! Each reminder time must be unique.');
        return;
    }

    // Sort times chronologically
    times.sort();

    console.log('Sending create task message with times:', times);

    // Send to background script
    try {
        const response = await chrome.runtime.sendMessage({
            action: 'createCriticalTask',
            url: currentTaskData.url,
            title: currentTaskData.title,
            reminderTimes: times
        });

        console.log('Response from background:', response);

        if (response && response.success) {
            closeModal();
            // Show success notification
            const timesStr = times.join(', ');
            chrome.runtime.sendMessage({
                action: 'showNotification',
                title: '✅ Task Created',
                message: `"${currentTaskData.title}" will open at: ${timesStr}`
            });
        } else {
            showError('Failed to create task');
        }
    } catch (error) {
        showError('Failed to create task: ' + error.message);
        console.error('Error creating task:', error);
    }
}

/**
 * Show error message
 */
function showError(message) {
    console.error('Showing error:', message);
    const errorElement = document.getElementById('validation-error');
    if (errorElement) {
        errorElement.textContent = message;
        errorElement.classList.add('show');

        setTimeout(() => {
            errorElement.classList.remove('show');
        }, 5000);
    } else {
        alert(message);
    }
}

/**
 * Close the modal
 */
function closeModal() {
    console.log('Closing modal');
    const overlay = document.getElementById('task-modal-overlay');
    if (overlay) {
        overlay.style.display = 'none';
    }
    currentTaskData = null;
    reminderTimes = [];
}

/**
 * Format time for input
 */
function formatTime(date) {
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${hours}:${minutes}`;
}

console.log('✅ Task config modal script loaded (multiple reminders support)');
