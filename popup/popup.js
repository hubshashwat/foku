/**
 * Popup script
 * Handles UI interactions for the extension popup
 */

// Get current tab info
async function getCurrentTab() {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    return tab;
}

// Initialize popup
document.addEventListener('DOMContentLoaded', async () => {
    await loadBoomerangs();
    await loadCriticalTasks();
    await loadFocusMode();
    await initTabLimiter();

    // Set up event listeners
    document.getElementById('boomerang-btn').addEventListener('click', createBoomerang);
    document.getElementById('focus-toggle').addEventListener('change', toggleFocusMode);


    // Boomerang preset listener
    document.getElementById('boomerang-presets').addEventListener('change', (e) => {
        const container = document.getElementById('custom-time-container');
        container.style.display = (e.target.value === 'custom') ? 'flex' : 'none';
    });

    // Tab limit listener
    document.getElementById('tab-limit-input').addEventListener('change', async (e) => {
        const limit = parseInt(e.target.value);
        await chrome.storage.local.set({ tabLimit: limit });
        updateTabStats();
    });
});

/**
 * Initialize and update Tab Limiter stats in popup
 */
async function initTabLimiter() {
    const settings = await chrome.storage.local.get(['tabLimit']);
    document.getElementById('tab-limit-input').value = settings.tabLimit || 20;
    updateTabStats();
}

async function updateTabStats() {
    const settings = await chrome.storage.local.get(['tabLimit']);
    const limit = settings.tabLimit || 20;
    const tabs = await chrome.tabs.query({ windowType: 'normal' });
    const count = tabs.length;

    document.getElementById('current-tab-count').textContent = count;
    const progressBar = document.getElementById('tab-progress-bar');
    const percent = Math.min((count / limit) * 100, 100);
    progressBar.style.width = percent + '%';

    // Change color if close to limit
    if (percent > 90) {
        progressBar.style.background = '#ef4444';
    } else if (percent > 70) {
        progressBar.style.background = '#f59e0b';
    } else {
        progressBar.style.background = 'linear-gradient(90deg, #4ade80, #22d3ee)';
    }
}



/**
 * Create a boomerang for current tab
 */
async function createBoomerang() {
    const tab = await getCurrentTab();
    const btn = document.getElementById('boomerang-btn');
    const presetSelect = document.getElementById('boomerang-presets');
    const datetimeInput = document.getElementById('boomerang-datetime');

    let minutes;
    if (presetSelect.value === 'custom') {
        const targetTime = new Date(datetimeInput.value).getTime();
        const now = new Date().getTime();
        minutes = Math.round((targetTime - now) / 60000);

        if (minutes <= 0) {
            alert('Please pick a time in the future!');
            return;
        }
    } else {
        minutes = parseInt(presetSelect.value);
    }

    btn.disabled = true;
    btn.textContent = 'Creating...';

    try {
        const response = await chrome.runtime.sendMessage({
            action: 'createBoomerang',
            url: tab.url,
            title: tab.title,
            minutes: minutes
        });

        if (response.success) {
            btn.textContent = '✓ Created!';
            setTimeout(() => {
                btn.textContent = '🪃 Create Boomerang';
                btn.disabled = false;
            }, 2000);

            await loadBoomerangs();
        }
    } catch (error) {
        console.error('Failed to create boomerang:', error);
        btn.textContent = '✗ Failed';
        setTimeout(() => {
            btn.textContent = '🪃 Create Boomerang';
            btn.disabled = false;
        }, 2000);
    }
}

/**
 * Load and display active boomerangs
 */
async function loadBoomerangs() {
    const result = await chrome.storage.local.get(['boomerangs']);
    const boomerangs = result.boomerangs || [];

    const container = document.getElementById('boomerangs-list');

    if (boomerangs.length === 0) {
        container.innerHTML = '<p class="empty-state">No active boomerangs</p>';
        return;
    }

    container.innerHTML = boomerangs.map(b => {
        const timeLeft = getTimeLeft(b.timestamp, b.minutes || 15);
        return `
      <div class="list-item">
        <div class="item-info">
          <div class="item-title">${truncate(b.title, 30)}</div>
          <div class="item-meta">⏰ ${timeLeft}</div>
        </div>
        <button class="delete-btn" data-id="${b.id}">✕</button>
      </div>
    `;
    }).join('');

    // Add delete listeners
    container.querySelectorAll('.delete-btn').forEach(btn => {
        btn.addEventListener('click', () => deleteBoomerang(btn.dataset.id));
    });
}

/**
 * Load and display critical tasks
 */
async function loadCriticalTasks() {
    const result = await chrome.storage.local.get(['criticalTasks']);
    const tasks = result.criticalTasks || [];

    const container = document.getElementById('tasks-list');

    if (tasks.length === 0) {
        container.innerHTML = '<p class="empty-state">No critical tasks</p>';
        return;
    }

    container.innerHTML = tasks.map(t => {
        // Format reminder times display
        let timeDisplay;
        if (t.reminderTimes && t.reminderTimes.length > 0) {
            // New format: multiple reminder times
            if (t.reminderTimes.length === 1) {
                timeDisplay = `⏰ Daily at ${t.reminderTimes[0]}`;
            } else {
                timeDisplay = `⏰ ${t.reminderTimes.length}x: ${t.reminderTimes.join(', ')}`;
            }
        } else if (t.time) {
            // Old format: single time
            timeDisplay = `⏰ Daily at ${t.time}`;
        } else {
            timeDisplay = `⏰ Daily`;
        }

        return `
      <div class="list-item">
        <div class="item-info">
          <div class="item-title">${truncate(t.title, 30)}</div>
          <div class="item-meta">${timeDisplay}</div>
        </div>
        <button class="delete-btn" data-id="${t.id}">✕</button>
      </div>
    `;
    }).join('');

    // Add delete listeners
    container.querySelectorAll('.delete-btn').forEach(btn => {
        btn.addEventListener('click', () => deleteCriticalTask(btn.dataset.id));
    });
}

/**
 * Reset daily tasks for testing
 */
async function resetDailyTasks() {
    const result = await chrome.storage.local.get(['criticalTasks']);
    const tasks = result.criticalTasks || [];

    // Reset completion status for all tasks
    tasks.forEach(task => {
        task.lastCompleted = 0;
        task.completedItems = [];
    });

    await chrome.storage.local.set({ criticalTasks: tasks });

    // Also disable focus mode
    await chrome.runtime.sendMessage({
        action: 'toggleFocusMode',
        enable: false
    });

    // Reload the display
    await loadCriticalTasks();
    await loadFocusMode();

    // Show confirmation
    const resetBtn = document.getElementById('reset-tasks-btn');
    const originalText = resetBtn.textContent;
    resetBtn.textContent = '✓ Reset Complete!';
    resetBtn.disabled = true;

    setTimeout(() => {
        resetBtn.textContent = originalText;
        resetBtn.disabled = false;
    }, 2000);
}

/**
 * Load focus mode state
 */
async function loadFocusMode() {
    const response = await chrome.runtime.sendMessage({ action: 'checkBlockingState' });
    const toggle = document.getElementById('focus-toggle');
    const status = document.getElementById('focus-status');

    toggle.checked = response;
    status.textContent = response ? 'Enabled' : 'Disabled';
    status.className = response ? 'status-enabled' : 'status-disabled';
}

/**
 * Toggle focus mode
 */
async function toggleFocusMode(event) {
    const enabled = event.target.checked;
    const status = document.getElementById('focus-status');

    try {
        await chrome.runtime.sendMessage({
            action: 'toggleFocusMode',
            enable: enabled
        });

        status.textContent = enabled ? 'Enabled' : 'Disabled';
        status.className = enabled ? 'status-enabled' : 'status-disabled';
    } catch (error) {
        console.error('Failed to toggle focus mode:', error);
        event.target.checked = !enabled;
    }
}

/**
 * Delete a boomerang
 */
async function deleteBoomerang(id) {
    const result = await chrome.storage.local.get(['boomerangs']);
    const boomerangs = result.boomerangs || [];
    const filtered = boomerangs.filter(b => b.id !== id);

    // Cancel the alarm
    const boomerang = boomerangs.find(b => b.id === id);
    if (boomerang) {
        await chrome.alarms.clear(boomerang.alarmName);
    }

    await chrome.storage.local.set({ boomerangs: filtered });
    await loadBoomerangs();
}

/**
 * Delete a critical task
 */
async function deleteCriticalTask(id) {
    const result = await chrome.storage.local.get(['criticalTasks']);
    const tasks = result.criticalTasks || [];
    const filtered = tasks.filter(t => t.id !== id);

    await chrome.storage.local.set({ criticalTasks: filtered });
    await loadCriticalTasks();
}

/**
 * Get time left for boomerang
 */
function getTimeLeft(timestamp, durationMinutes) {
    const created = new Date(timestamp);
    const expires = new Date(created.getTime() + durationMinutes * 60 * 1000);
    const now = new Date();
    const diff = expires - now;

    if (diff <= 0) return 'Expired';

    const hours = Math.floor(diff / 3600000);
    const minutes = Math.floor((diff % 3600000) / 60000);
    const seconds = Math.floor((diff % 60000) / 1000);

    if (hours > 0) {
        return `${hours}h ${minutes}m`;
    }
    return `${minutes}m ${seconds}s`;
}

/**
 * Check if task was completed today
 */
function checkIfCompletedToday(task) {
    if (!task.lastCompleted) return false;

    const today = new Date().setHours(0, 0, 0, 0);
    const lastCompleted = new Date(task.lastCompleted).setHours(0, 0, 0, 0);

    return lastCompleted >= today;
}

/**
 * Truncate text
 */
function truncate(text, length) {
    if (text.length <= length) return text;
    return text.substring(0, length) + '...';
}

// Update boomerang timers and tab stats every 2 seconds
setInterval(() => {
    loadBoomerangs();
    updateTabStats();
}, 2000);
