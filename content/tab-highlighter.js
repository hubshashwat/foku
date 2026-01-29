import './tab-highlighter.css';

/**
 * Tab Highlighter Content Script
 * Manages Focus Mode blocking (simple blocker for distraction sites)
 */

// Listen for messages from background script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'highlightTab') {
        highlightTab(message.duration || 10000);
        sendResponse({ success: true });
    } else if (message.action === 'updateTitle') {
        document.title = message.title;
        sendResponse({ success: true });
    } else if (message.action === 'restoreTitle') {
        document.title = message.title;
        sendResponse({ success: true });
    } else if (message.action === 'focusModeChanged') {
        checkAndShowBlocker(message.enabled);
        sendResponse({ success: true });
    }
    return true;
});

/**
 * Highlight the current tab with visual effects
 */
function highlightTab(duration) {
    const overlay = document.createElement('div');
    overlay.id = 'critical-tab-highlight';
    overlay.className = 'critical-highlight-active';

    if (document.body) {
        document.body.appendChild(overlay);
    } else {
        document.addEventListener('DOMContentLoaded', () => document.body.appendChild(overlay));
    }

    setTimeout(() => {
        overlay.classList.remove('critical-highlight-active');
        setTimeout(() => overlay.remove(), 500);
    }, duration);
}

console.log('[Focus Mode] Tab highlighter script loaded');

// Check Focus Mode on page load with retry
async function checkFocusModeWithRetry(maxRetries = 3, delayMs = 500) {
    console.log('[Focus Mode] Checking blocking state on page load...');
    
    for (let i = 0; i < maxRetries; i++) {
        try {
            const result = await chrome.runtime.sendMessage({ action: 'checkBlockingState' });
            console.log('[Focus Mode] blockingActive result:', result);
            checkAndShowBlocker(result);
            return; // Success
        } catch (error) {
            console.warn(`[Focus Mode] Attempt ${i + 1}/${maxRetries} failed:`, error.message);
            if (i < maxRetries - 1) {
                await new Promise(resolve => setTimeout(resolve, delayMs));
            } else {
                console.error('[Focus Mode] Failed to check Focus Mode after all retries');
            }
        }
    }
}

// Start the check
checkFocusModeWithRetry();

/**
 * Check if current site should be blocked and show blocker if needed
 */
async function checkAndShowBlocker(focusModeEnabled) {
    const overlay = document.getElementById('focus-mode-overlay');

    if (!focusModeEnabled) {
        if (overlay) overlay.remove();
        return;
    }

    // Get blocked websites list
    const settings = await chrome.storage.local.get(['blockedWebsites']);
    const blockedWebsites = settings.blockedWebsites || [
        '*twitter.com*',
        '*x.com*',
        '*youtube.com*',
        '*reddit.com*',
        '*instagram.com*',
        '*facebook.com*',
        '*tiktok.com*'
    ];

    const currentUrl = window.location.href;
    console.log('[Focus Mode] Checking URL:', currentUrl);
    console.log('[Focus Mode] Blocked patterns:', blockedWebsites);

    // Check if current URL matches any blocked pattern
    const isBlocked = blockedWebsites.some(site => {
        // Escape special regex chars except *, then replace * with .*
        const pattern = site
            .replace(/[.+?^${}()|[\]\\]/g, '\\$&')  // Escape special chars
            .replace(/\*/g, '.*');  // Convert * to .*
        return new RegExp(pattern, 'i').test(currentUrl);
    });

    if (isBlocked) {
        if (!overlay) {
            showFocusModeOverlay();
        }
    } else {
        if (overlay) overlay.remove();
    }
}

/**
 * Show simple Focus Mode overlay
 */
function showFocusModeOverlay() {
    if (document.getElementById('focus-mode-overlay')) return;

    const overlay = document.createElement('div');
    overlay.id = 'focus-mode-overlay';
    overlay.style.cssText = 'position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: linear-gradient(135deg, #1a1a1a 0%, #2d2d2d 100%); z-index: 2147483647; display: flex; align-items: center; justify-content: center; font-family: -apple-system, BlinkMacSystemFont, sans-serif;';
    overlay.innerHTML = `
        <div class="focus-blocker-content" style="background: rgba(45, 45, 45, 0.95) !important; backdrop-filter: blur(20px) !important; border: 1px solid rgba(255, 255, 255, 0.15) !important; border-radius: 20px !important; padding: 60px !important; max-width: 500px !important; text-align: center !important; box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5) !important; display: flex !important; flex-direction: column !important; align-items: center !important;">
            <div class="focus-blocker-icon" style="font-size: 72px !important; margin-bottom: 24px !important;">🚫</div>
            <h1 style="font-size: 32px !important; font-weight: 700 !important; color: #ffffff !important; margin: 0 0 16px 0 !important; letter-spacing: -0.5px !important;">You're in Focus Mode</h1>
            <p style="font-size: 16px !important; color: rgba(255, 255, 255, 0.7) !important; margin: 0 0 32px 0 !important; line-height: 1.6 !important;">This site is blocked to help you stay focused.</p>
            <button id="close-tab-btn" class="close-tab-btn" style="padding: 14px 40px !important; font-size: 15px !important; font-weight: 600 !important; font-family: -apple-system, BlinkMacSystemFont, sans-serif !important; background: #ffffff !important; color: #000000 !important; border: none !important; border-radius: 12px !important; cursor: pointer !important; box-shadow: 0 4px 15px rgba(0, 0, 0, 0.3) !important; outline: none !important;">Close Tab</button>
        </div>
    `;

    if (document.body) {
        document.body.appendChild(overlay);
        attachCloseTabListener();
    } else {
        document.addEventListener('DOMContentLoaded', () => {
            document.body.appendChild(overlay);
            attachCloseTabListener();
        });
    }
}

/**
 * Attach click listener to Close Tab button and force styles
 */
function attachCloseTabListener() {
    const btn = document.getElementById('close-tab-btn');
    if (btn) {
        // Force styles via JavaScript to override any website CSS
        btn.style.setProperty('padding', '14px 40px', 'important');
        btn.style.setProperty('font-size', '15px', 'important');
        btn.style.setProperty('font-weight', '600', 'important');
        btn.style.setProperty('font-family', '-apple-system, BlinkMacSystemFont, sans-serif', 'important');
        btn.style.setProperty('background', '#ffffff', 'important');
        btn.style.setProperty('background-color', '#ffffff', 'important');
        btn.style.setProperty('color', '#000000', 'important');
        btn.style.setProperty('border', 'none', 'important');
        btn.style.setProperty('border-radius', '12px', 'important');
        btn.style.setProperty('cursor', 'pointer', 'important');
        btn.style.setProperty('box-shadow', '0 4px 15px rgba(0, 0, 0, 0.3)', 'important');
        btn.style.setProperty('outline', 'none', 'important');
        btn.style.setProperty('text-decoration', 'none', 'important');
        btn.style.setProperty('line-height', 'normal', 'important');
        btn.style.setProperty('letter-spacing', 'normal', 'important');

        btn.addEventListener('click', () => {
            chrome.runtime.sendMessage({ action: 'closeCurrentTab' });
        });
    }
}
