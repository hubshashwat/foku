// Load checklist from storage
async function loadChecklist() {
    console.log('🔍 [BLOCKER] Starting loadChecklist...');
    try {
        console.log('🔍 [BLOCKER] Accessing chrome.storage.local...');
        const result = await chrome.storage.local.get(['criticalTasks']);
        console.log('🔍 [BLOCKER] Storage result:', result);

        const tasks = result.criticalTasks || [];
        console.log('🔍 [BLOCKER] Tasks found:', tasks.length, tasks);

        const container = document.getElementById('checklist-items');
        const submitBtn = document.getElementById('submit-btn');
        const description = document.getElementById('blocker-description');

        if (tasks.length === 0) {
            console.log('⚠️ [BLOCKER] No tasks found - showing manual Focus Mode UI');
            description.textContent = 'You enabled Focus Mode to block distracting websites.';
            container.innerHTML = '<p style="text-align: center; color: rgba(255, 255, 255, 0.5); line-height: 1.6;">To disable blocking, click the extension icon<br>and turn off Focus Mode.</p>';

            // Change button text for manual mode
            submitBtn.textContent = 'Close';
            submitBtn.onclick = () => {
                window.close();
            };
            return;
        }

        // Check if any tasks are incomplete for today
        const today = new Date().setHours(0, 0, 0, 0);
        const incompleteTasks = tasks.filter(task => {
            const lastCompleted = task.lastCompleted || 0;
            const lastCompletedDate = new Date(lastCompleted).setHours(0, 0, 0, 0);
            return lastCompletedDate < today;
        });

        console.log('🔍 [BLOCKER] Incomplete tasks:', incompleteTasks.length, incompleteTasks);

        if (incompleteTasks.length === 0) {
            console.log('✅ [BLOCKER] All tasks completed for today!');
            container.innerHTML = '<p style="text-align: center; color: rgba(100, 255, 100, 0.7);">✅ All tasks completed! Great job!</p>';
            return;
        }

        // Display task names as checkable items
        container.innerHTML = incompleteTasks.map((task, index) => `
          <div class="checklist-item">
            <input 
              type="checkbox" 
              id="task-${index}"
              data-task-id="${task.id}"
              data-task-title="${task.title}"
            >
            <label for="task-${index}">${task.title}</label>
          </div>
        `).join('');

        // Attach submit handler for task completion
        submitBtn.textContent = "I've Completed These Tasks";
        submitBtn.onclick = submitChecklist;

        console.log('✅ [BLOCKER] Tasks rendered successfully!');
    } catch (error) {
        console.error('❌ [BLOCKER] Failed to load checklist:', error);
        document.getElementById('checklist-items').innerHTML =
            '<p style="text-align: center; color: #ef4444;">Error loading tasks. Please try again.</p>';
    }
}

// Submit checklist
async function submitChecklist() {
    const checkboxes = document.querySelectorAll('#checklist-items input[type="checkbox"]');
    const completedTaskIds = [];

    checkboxes.forEach(cb => {
        if (cb.checked) {
            const taskId = cb.dataset.taskId;
            completedTaskIds.push(taskId);
        }
    });

    if (completedTaskIds.length === 0) {
        alert('Please check off at least one task before submitting.');
        return;
    }

    // Mark each checked task as completed
    const result = await chrome.storage.local.get(['criticalTasks']);
    const tasks = result.criticalTasks || [];

    tasks.forEach(task => {
        if (completedTaskIds.includes(task.id)) {
            task.lastCompleted = Date.now();
        }
    });

    await chrome.storage.local.set({ criticalTasks: tasks });

    // Check if all tasks are now complete
    const allCompleted = tasks.every(task => {
        const today = new Date().setHours(0, 0, 0, 0);
        const lastCompleted = task.lastCompleted || 0;
        const lastCompletedDate = new Date(lastCompleted).setHours(0, 0, 0, 0);
        return lastCompletedDate >= today;
    });

    if (allCompleted) {
        // Disable blocking
        await chrome.runtime.sendMessage({
            action: 'toggleFocusMode',
            enable: false
        });
    }

    // Go back or close
    if (window.history.length > 1) {
        window.history.back();
    } else {
        window.close();
    }
}

// Skip for 1 minute
async function skipFocus() {
    console.log('🔍 [BLOCKER] Skip button clicked');
    try {
        console.log('🔍 [BLOCKER] Disabling focus mode...');
        const response = await chrome.runtime.sendMessage({
            action: 'toggleFocusMode',
            enable: false
        });
        console.log('✅ [BLOCKER] Focus mode disabled:', response);

        // Re-enable after 1 minute
        setTimeout(async () => {
            console.log('⏰ [BLOCKER] 1 minute elapsed, re-enabling focus mode...');
            try {
                await chrome.runtime.sendMessage({
                    action: 'toggleFocusMode',
                    enable: true
                });
                console.log('✅ [BLOCKER] Focus mode re-enabled');
            } catch (error) {
                console.error('❌ [BLOCKER] Failed to re-enable focus mode:', error);
            }
        }, 1 * 60 * 1000);

        // Wait a moment for rules to update, then navigate
        await new Promise(resolve => setTimeout(resolve, 500));

        console.log('🔍 [BLOCKER] Navigating back...');
        // Go back or close
        if (window.history.length > 1) {
            window.history.back();
        } else {
            // Force reload to the original URL
            const urlParams = new URLSearchParams(window.location.search);
            const targetUrl = urlParams.get('url') || 'https://google.com';
            window.location.href = targetUrl;
        }
    } catch (error) {
        console.error('❌ [BLOCKER] Failed to skip focus mode:', error);
        alert('Failed to disable blocking. Please try again or disable Focus Mode from the extension popup.');
    }
}

// Initialize
console.log('🔍 [BLOCKER] Page loaded, waiting for DOMContentLoaded...');
document.addEventListener('DOMContentLoaded', () => {
    console.log('✅ [BLOCKER] DOMContentLoaded fired!');
    console.log('🔍 [BLOCKER] Initializing blocker page...');
    loadChecklist();
    console.log('✅ [BLOCKER] Initialization complete!');
});
