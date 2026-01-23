/**
 * Notification utilities
 * Handles Chrome notifications, sounds, and visual effects
 */

/**
 * Create a Chrome notification
 */
export async function createNotification(title, message, options = {}) {
    const notificationOptions = {
        type: 'basic',
        iconUrl: chrome.runtime.getURL('assets/icon128.png'),
        title,
        message,
        priority: 2,
        requireInteraction: true,
        ...options
    };

    return new Promise((resolve) => {
        chrome.notifications.create('', notificationOptions, (notificationId) => {
            resolve(notificationId);
        });
    });
}

/**
 * Play notification sound
 */
export function playNotificationSound() {
    const audio = new Audio(chrome.runtime.getURL('assets/notification.mp3'));
    audio.volume = 0.7;
    audio.play().catch(err => console.error('Failed to play sound:', err));
}

/**
 * Create pulsing border effect on current window (less aggressive than shake)
 */
export async function pulseWindow() {
    try {
        const currentWindow = await chrome.windows.getCurrent();
        const originalBounds = {
            left: currentWindow.left,
            top: currentWindow.top,
            width: currentWindow.width,
            height: currentWindow.height
        };

        // Create a subtle pulse effect by slightly resizing
        const pulseSequence = [
            { width: originalBounds.width + 10, height: originalBounds.height + 10 },
            { width: originalBounds.width, height: originalBounds.height },
            { width: originalBounds.width + 10, height: originalBounds.height + 10 },
            { width: originalBounds.width, height: originalBounds.height }
        ];

        for (const bounds of pulseSequence) {
            await chrome.windows.update(currentWindow.id, {
                left: originalBounds.left - (bounds.width - originalBounds.width) / 2,
                top: originalBounds.top - (bounds.height - originalBounds.height) / 2,
                width: bounds.width,
                height: bounds.height
            });
            await sleep(100);
        }

        // Restore original bounds
        await chrome.windows.update(currentWindow.id, originalBounds);
    } catch (error) {
        console.error('Failed to pulse window:', error);
    }
}

/**
 * Sleep utility
 */
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Show aggressive reminder (notification + sound + pulse)
 */
export async function showAggressiveReminder(title, message) {
    await createNotification(title, message);
    playNotificationSound();

    // Check if user has enabled visual effects
    const settings = await chrome.storage.local.get(['enableVisualEffects']);
    if (settings.enableVisualEffects !== false) { // Default to true
        await pulseWindow();
    }
}
