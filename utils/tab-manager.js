/**
 * Tab Manager utilities
 * Handles tab operations like checking, opening, highlighting
 */

/**
 * Check if a URL is already open in any tab
 */
export async function isTabOpen(url) {
    const tabs = await chrome.tabs.query({});
    return tabs.find(tab => tab.url === url);
}

/**
 * Open a tab in the background
 */
export async function openTabInBackground(url) {
    return chrome.tabs.create({
        url,
        active: false
    });
}

/**
 * Highlight an existing tab with red border and flashing title
 */
export async function highlightTab(tabId) {
    try {
        // Activate the tab
        await chrome.tabs.update(tabId, { active: true });

        // Send message to content script to add visual effects
        await chrome.tabs.sendMessage(tabId, {
            action: 'highlightTab',
            duration: 10000 // 10 seconds
        });
    } catch (error) {
        // Failed to highlight tab
    }
}

/**
 * Flash tab title to draw attention
 */
export async function flashTabTitle(tabId, originalTitle, flashText = '🔴 CRITICAL') {
    let isFlashing = true;
    let count = 0;
    const maxFlashes = 10;

    const flashInterval = setInterval(async () => {
        if (count >= maxFlashes) {
            clearInterval(flashInterval);
            try {
                await chrome.tabs.sendMessage(tabId, {
                    action: 'restoreTitle',
                    title: originalTitle
                });
            } catch (error) {
                // Failed to restore title
            }
            return;
        }

        try {
            const newTitle = isFlashing ? flashText : originalTitle;
            await chrome.tabs.sendMessage(tabId, {
                action: 'updateTitle',
                title: newTitle
            });
            isFlashing = !isFlashing;
            count++;
        } catch (error) {
            clearInterval(flashInterval);
        }
    }, 500);
}

/**
 * Get all tabs matching a pattern
 */
export async function getTabsByPattern(pattern) {
    const tabs = await chrome.tabs.query({});
    const regex = new RegExp(pattern);
    return tabs.filter(tab => regex.test(tab.url));
}

/**
 * Close tabs matching a pattern
 */
export async function closeTabsByPattern(pattern) {
    const tabs = await getTabsByPattern(pattern);
    const tabIds = tabs.map(tab => tab.id);
    if (tabIds.length > 0) {
        await chrome.tabs.remove(tabIds);
    }
    return tabIds.length;
}

/**
 * Focus on a specific tab
 */
export async function focusTab(tabId) {
    const tab = await chrome.tabs.get(tabId);
    await chrome.windows.update(tab.windowId, { focused: true });
    await chrome.tabs.update(tabId, { active: true });
}
