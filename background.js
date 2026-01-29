// Premium Build Split
// This import is resolved by Vite during build via the @premium alias
// The extension must be built with 'npm run build' before loading
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

    chrome.contextMenus.create({
        id: 'mark-critical-once',
        title: 'Mark as Important (One Time)',
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
    if (info.menuItemId === 'mark-critical' || info.menuItemId === 'mark-critical-once') {
        const isOnce = info.menuItemId === 'mark-critical-once';
        console.log(`Context menu clicked: ${info.menuItemId}. Sending showTaskConfigModal to:`, tab.id);

        // Send message to content script (already injected via manifest)
        try {
            await chrome.tabs.sendMessage(tab.id, {
                action: 'showTaskConfigModal',
                url: tab.url,
                title: tab.title,
                frequency: isOnce ? 'once' : 'daily'
            });
        } catch (error) {
            console.warn('Content script not responding:', error);
            // Content script is declared in manifest for all URLs
            // If not responding, either the page is restricted or needs a reload
            chrome.notifications.create({
                type: 'basic',
                iconUrl: chrome.runtime.getURL('assets/icon128.png'),
                title: '⚠️ Page Reload Required',
                message: 'Please reload the page to enable Task Manager on this tab'
            });
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
        // Alarm might belong to a deleted one-time task
        console.warn('Task not found for alarm (cleaning up):', alarmName);
        chrome.alarms.clear(alarmName);
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

    // Play notification sound via Offscreen API (Reliable)
    playNotificationSound();

    // Show notification (even though Brave won't display it, Chrome will)
    chrome.notifications.create({
        type: 'basic',
        iconUrl: chrome.runtime.getURL('assets/icon128.png'),
        title: '⏰ Reminder',
        message: `Time to check: ${task.title}`,
        priority: 2,
        requireInteraction: true
    });

    console.log('Tab opened for:', task.title);

    // Auto-cleanup for One-Time tasks
    if (task.frequency === 'once') {
        console.log(`Auto-cleaning One-Time task execution: ${alarmName}`);

        // Remove the specific alarm/time that just fired
        if (task.alarmNames && task.alarmNames.includes(alarmName)) {
            const alarmIndex = task.alarmNames.indexOf(alarmName);
            if (alarmIndex > -1) {
                task.alarmNames.splice(alarmIndex, 1);
                // We also remove the corresponding time so the UI updates
                if (task.reminderTimes && task.reminderTimes[alarmIndex]) {
                    task.reminderTimes.splice(alarmIndex, 1);
                }
            }
        }

        // If no reminders left, delete the task entirely
        if (!task.reminderTimes || task.reminderTimes.length === 0) {
            console.log('One-Time task fully completed (all times fired). Deleting from storage.');
            const taskIdx = tasks.indexOf(task);
            if (taskIdx > -1) tasks.splice(taskIdx, 1);
        } else {
            console.log('One-Time task updated (removed fired time). Remaining times:', task.reminderTimes.length);
            // Update the task in the list
            const taskIdx = tasks.indexOf(task);
            if (taskIdx > -1) tasks[taskIdx] = task;
        }

        await chrome.storage.local.set({ criticalTasks: tasks });
    }
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

    if (message.action === 'log') {
        console.log('Offscreen Log:', message.data);
        sendResponse({ success: true });
        return true;
    }

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

    if (message.action === 'playNotification') {
        playNotificationSound();
        sendResponse({ success: true });
        return true;
    }

    return false;
});

/**
 * Create an important task with multiple reminder times
 */
async function handleCreateCriticalTask(data) {
    const { url, title, reminderTimes, frequency } = data; // frequency: 'daily' (default) or 'once'

    if (!reminderTimes || reminderTimes.length === 0) {
        return { success: false, error: 'No reminder times provided' };
    }

    const taskId = generateId();
    const task = {
        id: taskId,
        url: url,
        title: title,
        frequency: frequency || 'daily',
        reminderTimes: reminderTimes,
        alarmNames: reminderTimes.map((time, index) => `reminder-${taskId}-${index}`),
        createdAt: Date.now(),
        checklist: data.checklist || ['Review this page'], // Default checklist
        completedItems: []
    };

    const tasks = await getCriticalTasks();

    // Only enforce singleton uniqueness for DAILY tasks
    let existingIndex = -1;
    if (task.frequency === 'daily') {
        existingIndex = tasks.findIndex(t => t.url === task.url && t.frequency === 'daily');
    }

    if (existingIndex >= 0) {
        // Cleanup old alarms if overwriting
        const oldTask = tasks[existingIndex];
        if (oldTask.alarmNames) {
            for (const alarmName of oldTask.alarmNames) {
                await chrome.alarms.clear(alarmName);
            }
        }
        tasks[existingIndex] = task;
    } else {
        tasks.push(task);
    }

    await chrome.storage.local.set({ criticalTasks: tasks });

    // Create alarms
    task.reminderTimes.forEach((time, index) => {
        createReminderAlarm(task.alarmNames[index], time, task.frequency);
    });

    return { success: true, task };
}

function createReminderAlarm(alarmName, timeString, frequency) {
    const nextTime = getNextOccurrenceTime(timeString);
    const alarmInfo = {
        when: nextTime
    };

    // Only add periodInMinutes if it's a recurring daily task
    if (frequency !== 'once') {
        alarmInfo.periodInMinutes = 24 * 60; // Daily
    }

    chrome.alarms.create(alarmName, alarmInfo);
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
    return `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
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
    console.log('handleCompleteTask called for:', taskId);
    const tasks = await getCriticalTasks();
    const taskIndex = tasks.findIndex(t => t.id === taskId);

    if (taskIndex >= 0) {
        const task = tasks[taskIndex];
        console.log('Found task:', task.title, 'Frequency:', task.frequency);

        // If it's a one-time task, delete it completely
        if (task.frequency === 'once') {
            console.log('Deleting ONE-TIME task:', taskId);
            tasks.splice(taskIndex, 1);

            // Clean up its alarms
            if (task.alarmNames) {
                for (const alarmName of task.alarmNames) {
                    await chrome.alarms.clear(alarmName);
                }
            }
            console.log('Task and alarms deleted.');
        } else {
            // Daily task logic
            console.log('Marking DAILY task as complete');
            task.completedItems = completedItems;
            task.lastCompleted = Date.now();
        }

        await chrome.storage.local.set({ criticalTasks: tasks });
        console.log('Storage updated.');

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
    console.warn('Task not found for completion:', taskId);
    return { success: false };
}

// Safeguard: Listen for storage changes to enforce One-Time deletion
// This handles cases where older content scripts might update storage directly
chrome.storage.onChanged.addListener(async (changes, namespace) => {
    if (namespace === 'local' && changes.criticalTasks) {
        const newTasks = changes.criticalTasks.newValue;
        if (!newTasks) return;

        const tasksToDelete = newTasks.filter(t => t.frequency === 'once' && isTaskCompletedToday(t));

        if (tasksToDelete.length > 0) {
            console.log('Safeguard: Found completed One-Time tasks in storage. Deleting:', tasksToDelete.map(t => t.title));

            // Filter out the completed one-time tasks
            const cleanTasks = newTasks.filter(t => !(t.frequency === 'once' && isTaskCompletedToday(t)));

            // Clean up alarms for deleted tasks
            for (const task of tasksToDelete) {
                if (task.alarmNames) {
                    for (const alarmName of task.alarmNames) {
                        await chrome.alarms.clear(alarmName);
                    }
                }
            }

            // Update storage (this will trigger onChanged again, but tasksToDelete will be 0)
            await chrome.storage.local.set({ criticalTasks: cleanTasks });
        }
    }
});

function isTaskCompletedToday(task) {
    if (!task.lastCompleted) return false;
    const today = new Date().setHours(0, 0, 0, 0);
    const last = new Date(task.lastCompleted).setHours(0, 0, 0, 0);
    return last >= today;
}

console.log('Background script loaded successfully');

// Offscreen API helpers for consistent audio
async function playNotificationSound() {
    try {
        await ensureOffscreenDocument();
        chrome.runtime.sendMessage({
            action: 'playNotification',
            source: chrome.runtime.getURL('assets/notification.mp3')
        });
    } catch (e) {
        console.error('Failed to play offscreen sound:', e);
    }
}

async function ensureOffscreenDocument() {
    const existingContexts = await chrome.runtime.getContexts({
        contextTypes: ['OFFSCREEN_DOCUMENT'],
        documentUrls: [chrome.runtime.getURL('offscreen/offscreen.html')]
    });

    if (existingContexts.length > 0) {
        return;
    }

    await chrome.offscreen.createDocument({
        url: 'offscreen/offscreen.html',
        reasons: ['AUDIO_PLAYBACK'],
        justification: 'Notification sound'
    });

    // Race condition fix: Wait for offscreen script to load and register listeners
    await new Promise(resolve => setTimeout(resolve, 500));
}
