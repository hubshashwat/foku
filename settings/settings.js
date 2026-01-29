/**
 * Settings page script
 */

// Load settings on page load
document.addEventListener('DOMContentLoaded', async () => {
    await loadSettings();
    setupEventListeners();
});

/**
 * Load all settings from storage
 */
async function loadSettings() {
    const settings = await chrome.storage.local.get([
        'enableVisualEffects',
        'enableNotificationSound',
        'blockedWebsites',
        'dailyCheckTime',
        'tabLimit',
        'tabLimiterEnabled'
    ]);

    // Visual effects
    document.getElementById('visual-effects').checked = settings.enableVisualEffects !== false;

    // Notification sound
    document.getElementById('notification-sound').checked = settings.enableNotificationSound !== false;

    // Tab limiter
    document.getElementById('tab-limiter-enabled').checked = settings.tabLimiterEnabled !== false;
    document.getElementById('tab-limit').value = settings.tabLimit || 20;

    // Blocked websites
    const blockedWebsites = settings.blockedWebsites || [
        '*://*.twitter.com/*',
        '*://*.x.com/*',
        '*://*.youtube.com/*',
        '*://*.reddit.com/*'
    ];
    document.getElementById('blocked-websites').value = blockedWebsites.join('\n');


}

/**
 * Setup event listeners
 */
function setupEventListeners() {
    // Visual effects toggle
    document.getElementById('visual-effects').addEventListener('change', async (e) => {
        await chrome.storage.local.set({ enableVisualEffects: e.target.checked });
        showToast('Visual effects ' + (e.target.checked ? 'enabled' : 'disabled'));
    });

    // Notification sound toggle
    document.getElementById('notification-sound').addEventListener('change', async (e) => {
        await chrome.storage.local.set({ enableNotificationSound: e.target.checked });
        showToast('Notification sound ' + (e.target.checked ? 'enabled' : 'disabled'));
    });

    // Blocked websites
    document.getElementById('save-blocked').addEventListener('click', saveBlockedWebsites);

    // Daily check time


    // Tab limiter settings
    document.getElementById('save-tab-settings').addEventListener('click', saveTabSettings);

    // Danger zone
    document.getElementById('clear-boomerangs').addEventListener('click', clearBoomerangs);
    document.getElementById('clear-tasks').addEventListener('click', clearTasks);
    document.getElementById('reset-settings').addEventListener('click', resetSettings);
}

/**
 * Save blocked websites
 */
async function saveBlockedWebsites() {
    const textarea = document.getElementById('blocked-websites');
    const websites = textarea.value
        .split('\n')
        .map(w => w.trim())
        .filter(w => w.length > 0);

    await chrome.storage.local.set({ blockedWebsites: websites });
    showToast('Blocked websites saved');
}

/**
 * Save daily check time
 */


/**
 * Save tab limiter settings
 */
async function saveTabSettings() {
    const enabled = document.getElementById('tab-limiter-enabled').checked;
    const limit = parseInt(document.getElementById('tab-limit').value) || 20;

    await chrome.storage.local.set({
        tabLimiterEnabled: enabled,
        tabLimit: limit
    });

    showToast('Tab settings saved');
}

/**
 * Clear all boomerangs
 */
async function clearBoomerangs() {
    if (!confirm('Are you sure you want to clear all boomerangs?')) return;

    const result = await chrome.storage.local.get(['boomerangs']);
    const boomerangs = result.boomerangs || [];

    // Clear all alarms
    for (const b of boomerangs) {
        await chrome.alarms.clear(b.alarmName);
    }

    await chrome.storage.local.set({ boomerangs: [] });
    showToast('All boomerangs cleared');
}

/**
 * Clear all critical tasks
 */
async function clearTasks() {
    if (!confirm('Are you sure you want to clear all critical tasks?')) return;

    await chrome.storage.local.set({ criticalTasks: [] });
    showToast('All critical tasks cleared');
}

/**
 * Reset all settings
 */
async function resetSettings() {
    if (!confirm('Are you sure you want to reset all settings? This cannot be undone.')) return;

    await chrome.storage.local.clear();
    showToast('All settings reset');
    setTimeout(() => location.reload(), 1000);
}

/**
 * Show toast notification
 */
function showToast(message) {
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = message;
    document.body.appendChild(toast);

    setTimeout(() => toast.classList.add('show'), 100);
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}
