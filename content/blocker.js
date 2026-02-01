// Load checklist from storage
async function loadChecklist() {
    try {
        const result = await chrome.storage.local.get(['criticalTasks']);

        const tasks = result.criticalTasks || [];

        const container = document.getElementById('checklist-items');
        const submitBtn = document.getElementById('submit-btn');
        const description = document.getElementById('blocker-description');

        if (tasks.length === 0) {
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

        if (incompleteTasks.length === 0) {
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
    } catch (error) {
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

    // Send completion messages to background (handles deletion of one-time tasks)
    for (const taskId of completedTaskIds) {
        try {
            await chrome.runtime.sendMessage({
                action: 'completeTask',
                taskId: taskId,
                completedItems: [] // We are completing the whole task
            });
        } catch (error) {
            // Failed to complete task
        }
    }

    // Check if we should disable blocking globally (if all tasks are done)
    // We need to fetch fresh data because background might have deleted some
    const result = await chrome.storage.local.get(['criticalTasks']);
    const tasks = result.criticalTasks || [];

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
    try {
        await chrome.runtime.sendMessage({
            action: 'toggleFocusMode',
            enable: false
        });

        // Re-enable after 1 minute
        setTimeout(async () => {
            try {
                await chrome.runtime.sendMessage({
                    action: 'toggleFocusMode',
                    enable: true
                });
            } catch (error) {
                // Failed to re-enable focus mode
            }
        }, 1 * 60 * 1000);

        // Wait a moment for rules to update, then navigate
        await new Promise(resolve => setTimeout(resolve, 500));

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
        alert('Failed to disable blocking. Please try again or disable Focus Mode from the extension popup.');
    }
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    loadChecklist();
});
