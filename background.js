// Premium Build Split
import * as premium from '@premium';

// Extension installed/updated
chrome.runtime.onInstalled.addListener(() => {
    // ... same as before
    console.log(`Boomerang & Nagging extension installed`);

    chrome.notifications.create({
        type: 'basic',
        iconUrl: chrome.runtime.getURL('assets/icon128.png'),
        title: '✅ Extension Installed',
        message: 'Task Manager ready!'
    });

    chrome.contextMenus.create({
        id: 'mark-critical',
        title: 'Mark as Important (Daily)',
        contexts: ['page']
    });

    chrome.storage.local.set({
        tabLimit: 20,
        tabLimiterEnabled: true
    });
});

// Tab Limiter logic
chrome.tabs.onCreated.addListener(async (newTab) => {
    setTimeout(async () => {
        const settings = await chrome.storage.local.get(['tabLimit', 'tabLimiterEnabled', 'domainLimits']);
        if (settings.tabLimiterEnabled === false) return;

        const globalLimit = parseInt(settings.tabLimit) || 20;

        // PREMIUM FEATURE: Domain-Specific Limits
        const url = newTab.pendingUrl || newTab.url;
        if (url) {
            const domainResult = premium.checkDomainLimit(url, settings.domainLimits);
            if (domainResult.isRestricted) {
                const tabs = await chrome.tabs.query({ url: `*://*.${domainResult.domain}/*` });
                if (tabs.length > domainResult.limit) {
                    blockTab(newTab.id, `Domain Limit Reached: Only ${domainResult.limit} tabs allowed for ${domainResult.domain}`);
                    return;
                }
            } else if (!domainResult.allowed) {
                blockTab(newTab.id, domainResult.reason || 'Blocked');
                return;
            }
        }

        // GLOBAL LIMIT
        const tabs = await chrome.tabs.query({ windowType: 'normal' });
        if (tabs.length > globalLimit) {
            blockTab(newTab.id, `Global Limit Reached: ${globalLimit} tabs max.`);
        }
    }, 50);
});

function blockTab(tabId, reason) {
    chrome.tabs.remove(tabId);
    chrome.notifications.create({
        type: 'basic',
        iconUrl: chrome.runtime.getURL('assets/icon128.png'),
        title: '🚫 Tab Blocked',
        message: reason
    });
    console.log(`Blocked tab ${tabId}: ${reason}`);
}

// Handle context menu clicks
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
    if (info.menuItemId === 'mark-critical') {
        console.log('Context menu clicked. Sending showTaskConfigModal to:', tab.id);

        // Ensure content script is injected (CRXJS usually handles this, but fallback is safer)
        try {
            await chrome.tabs.sendMessage(tab.id, {
                action: 'showTaskConfigModal',
                url: tab.url,
                title: tab.title
            });
        } catch (error) {
            console.warn('Content script not found. Attempting manual injection...', error);
            try {
                // Manual injection fallback
                await chrome.scripting.executeScript({
                    target: { tabId: tab.id },
                    files: ['content/task-config-modal.js']
                });
                // Wait a moment and try again
                setTimeout(async () => {
                    await chrome.tabs.sendMessage(tab.id, {
                        action: 'showTaskConfigModal',
                        url: tab.url,
                        title: tab.title
                    });
                }, 100);
            } catch (injectError) {
                console.error('Manual injection failed:', injectError);
                chrome.notifications.create({
                    type: 'basic',
                    iconUrl: chrome.runtime.getURL('assets/icon128.png'),
                    title: 'Error',
                    message: 'Please reload the page to enable Task Manager'
                });
            }
        }
    }
});

// Handle alarms
chrome.alarms.onAlarm.addListener(async (alarm) => {
    console.log('Alarm fired:', alarm.name);

    if (alarm.name.startsWith('reminder-')) {
        await handleReminderAlarm(alarm.name);
    } else if (alarm.name === 'daily-check') {
        // Legacy alarm - for old task format
        await handleDailyCheck();

        // Schedule next 9 AM
        chrome.alarms.create('daily-check', {
            when: getNext9AM(),
            periodInMinutes: 24 * 60
        });
    } else if (alarm.name.startsWith('boomerang-')) {
        await handleBoomerang(alarm.name);
    }
});

/**
 * Handle reminder alarm - just open the tab
 */
async function handleReminderAlarm(alarmName) {
    console.log('Processing reminder alarm:', alarmName);

    const tasks = await getCriticalTasks();

    // Find task that owns this alarm
    const task = tasks.find(t => t.alarmNames && t.alarmNames.includes(alarmName));

    if (!task) {
        console.warn('Task not found for alarm:', alarmName);
        return;
    }

    // Simply open the tab
    const existingTab = await isTabOpen(task.url);

    if (existingTab) {
        // Tab exists, activate it
        await chrome.tabs.update(existingTab.id, { active: true });
        await chrome.windows.update(existingTab.windowId, { focused: true });
    } else {
        // Create new tab
        await chrome.tabs.create({ url: task.url, active: true });
    }

    // Show notification (even though Brave won't display it, Chrome will)
    chrome.notifications.create({
        type: 'basic',
        iconUrl: chrome.runtime.getURL('assets/icon128.png'),
        title: '⏰ Reminder',
        message: `Time to check: ${task.title}`,
        priority: 1
    });

    console.log('Tab opened for:', task.title);
}

/**
 * Handle daily 9 AM check for old format tasks
 */
async function handleDailyCheck() {
    const tasks = await getCriticalTasks();
    const today = new Date().setHours(0, 0, 0, 0);

    for (const task of tasks) {
        if (task.time) { // Old format tasks have 'time' field
            const lastCompleted = task.lastCompleted || 0;
            if (lastCompleted < today) {
                // Open tab if not already open
                const open = await isTabOpen(task.url);
                if (!open) {
                    chrome.tabs.create({ url: task.url });
                }
            }
        }
    }
}

/**
 * Handle boomerang alarm
 */
async function handleBoomerang(alarmName) {
    const boomerangs = await getBoomerangs();
    const boomerang = boomerangs.find(b => b.alarmName === alarmName);

    if (boomerang) {
        chrome.tabs.create({ url: boomerang.url });

        // Remove from list
        const filtered = boomerangs.filter(b => b.alarmName !== alarmName);
        await chrome.storage.local.set({ boomerangs: filtered });

        chrome.notifications.create({
            type: 'basic',
            iconUrl: chrome.runtime.getURL('assets/icon128.png'),
            title: '🪃 Boomerang Returned!',
            message: `"${boomerang.title}" is back!`
        });
    }
}

// Message handler for creating tasks and other actions
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    console.log('Message received:', message.action);

    if (message.action === 'createCriticalTask') {
        handleCreateCriticalTask(message).then(sendResponse);
        return true; // Keep channel open for async response
    }

    if (message.action === 'createBoomerang') {
        createBoomerang(message.url, message.title, message.minutes).then(sendResponse);
        return true;
    }

    if (message.action === 'toggleFocusMode') {
        toggleFocusMode(message.enable).then(sendResponse);
        return true;
    }

    if (message.action === 'checkBlockingState') {
        chrome.storage.local.get(['blockingActive'], (result) => {
            sendResponse(result.blockingActive || false);
        });
        return true;
    }

    if (message.action === 'showNotification') {
        chrome.notifications.create({
            type: 'basic',
            iconUrl: chrome.runtime.getURL('assets/icon128.png'),
            title: message.title,
            message: message.message
        });
        sendResponse({ success: true });
        return true;
    }

    if (message.action === 'closeCurrentTab') {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            if (tabs[0]) {
                chrome.tabs.remove(tabs[0].id);
            }
        });
        sendResponse({ success: true });
        return true;
    }

    if (message.action === 'completeTask') {
        handleCompleteTask(message.taskId, message.completedItems).then(sendResponse);
        return true;
    }

    return false;
});

/**
 * Create an important task with multiple reminder times
 */
async function handleCreateCriticalTask(data) {
    const { url, title, reminderTimes } = data;

    if (!reminderTimes || reminderTimes.length === 0) {
        return { success: false, error: 'No reminder times provided' };
    }

    const taskId = generateId();
    const task = {
        id: taskId,
        url: url,
        title: title,
        frequency: 'daily',
        reminderTimes: reminderTimes,
        alarmNames: reminderTimes.map((time, index) => `reminder-${taskId}-${index}`),
        createdAt: Date.now(),
        checklist: data.checklist || ['Review this page'], // Default checklist
        completedItems: []
    };

    const tasks = await getCriticalTasks();
    const existingIndex = tasks.findIndex(t => t.url === task.url);
    if (existingIndex >= 0) {
        tasks[existingIndex] = task;
    } else {
        tasks.push(task);
    }

    await chrome.storage.local.set({ criticalTasks: tasks });

    // Create alarms
    task.reminderTimes.forEach((time, index) => {
        createReminderAlarm(task.alarmNames[index], time);
    });

    return { success: true, task };
}

function createReminderAlarm(alarmName, timeString) {
    const nextTime = getNextOccurrenceTime(timeString);
    chrome.alarms.create(alarmName, {
        when: nextTime,
        periodInMinutes: 24 * 60 // Daily
    });
}

async function createBoomerang(url, title, minutes = 15) {
    const boomerang = {
        id: generateId(),
        url,
        title,
        timestamp: Date.now(),
        alarmName: `boomerang-${generateId()}`,
        minutes: minutes
    };

    const boomerangs = await getBoomerangs();
    boomerangs.push(boomerang);
    await chrome.storage.local.set({ boomerangs });

    chrome.alarms.create(boomerang.alarmName, {
        delayInMinutes: minutes
    });

    return { success: true };
}

async function toggleFocusMode(enable) {
    await chrome.storage.local.set({ blockingActive: enable });

    // Notify all tabs
    const tabs = await chrome.tabs.query({});
    for (const tab of tabs) {
        try {
            await chrome.tabs.sendMessage(tab.id, {
                action: 'focusModeChanged',
                enabled: enable
            });
        } catch (e) {
            // Tab might not have a content script
        }
    }

    return { success: true };
}

/**
 * Helper functions
 */
async function getCriticalTasks() {
    const result = await chrome.storage.local.get(['criticalTasks']);
    return result.criticalTasks || [];
}

async function getBoomerangs() {
    const result = await chrome.storage.local.get(['boomerangs']);
    return result.boomerangs || [];
}

async function isTabOpen(url) {
    const tabs = await chrome.tabs.query({});
    return tabs.find(tab => tab.url === url);
}

function generateId() {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

function getNext9AM() {
    const now = new Date();
    const next9 = new Date();
    next9.setHours(9, 0, 0, 0);
    if (now >= next9) next9.setDate(next9.getDate() + 1);
    return next9.getTime();
}

function getNextOccurrenceTime(timeString) {
    const [hours, minutes] = timeString.split(':').map(Number);
    const now = new Date();
    const next = new Date();
    next.setHours(hours, minutes, 0, 0);
    if (next <= now) next.setDate(next.getDate() + 1);
    return next.getTime();
}

async function handleCompleteTask(taskId, completedItems) {
    const tasks = await getCriticalTasks();
    const task = tasks.find(t => t.id === taskId);
    if (task) {
        task.completedItems = completedItems;
        task.lastCompleted = Date.now();
        await chrome.storage.local.set({ criticalTasks: tasks });

        // Notify tabs to re-check blocking
        const isBlocking = await chrome.storage.local.get(['blockingActive']);
        const allTabs = await chrome.tabs.query({});
        for (const tab of allTabs) {
            try {
                await chrome.tabs.sendMessage(tab.id, {
                    action: 'focusModeChanged',
                    enabled: isBlocking.blockingActive || false
                });
            } catch (e) { }
        }

        return { success: true };
    }
    return { success: false };
}

console.log('Background script loaded successfully');
