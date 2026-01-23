/**
 * Storage Manager - Abstraction layer for local storage
 * Handles saving and retrieving tasks and boomerangs locally.
 */

class StorageManager {
  constructor() { }

  /**
   * Initialize storage manager
   */
  async init() {
    // Local-only initialization
  }

  /**
   * Get configuration from chrome.storage.local
   */
  async getConfig() {
    return new Promise((resolve) => {
      chrome.storage.local.get(null, (result) => {
        resolve(result);
      });
    });
  }

  /**
   * Save configuration
   */
  async saveConfig(config) {
    return new Promise((resolve) => {
      chrome.storage.local.set(config, resolve);
    });
  }

  /**
   * Get all boomerangs
   */
  async getBoomerangs() {
    return new Promise((resolve) => {
      chrome.storage.local.get(['boomerangs'], (result) => {
        resolve(result.boomerangs || []);
      });
    });
  }

  /**
   * Save a boomerang
   */
  async saveBoomerang(boomerang) {
    const boomerangs = await this.getBoomerangs();
    boomerangs.push(boomerang);

    return new Promise((resolve) => {
      chrome.storage.local.set({ boomerangs }, resolve);
    });
  }

  /**
   * Delete a boomerang
   */
  async deleteBoomerang(id) {
    const boomerangs = await this.getBoomerangs();
    const filtered = boomerangs.filter(b => b.id !== id);

    return new Promise((resolve) => {
      chrome.storage.local.set({ boomerangs: filtered }, resolve);
    });
  }

  /**
   * Get all critical tasks
   */
  async getCriticalTasks() {
    return new Promise((resolve) => {
      chrome.storage.local.get(['criticalTasks'], (result) => {
        resolve(result.criticalTasks || []);
      });
    });
  }

  /**
   * Save a critical task
   */
  async saveCriticalTask(task) {
    const tasks = await this.getCriticalTasks();

    // Check if task already exists for this URL
    const existingIndex = tasks.findIndex(t => t.url === task.url);
    if (existingIndex >= 0) {
      tasks[existingIndex] = task;
    } else {
      tasks.push(task);
    }

    return new Promise((resolve) => {
      chrome.storage.local.set({ criticalTasks: tasks }, resolve);
    });
  }

  /**
   * Delete a critical task
   */
  async deleteCriticalTask(id) {
    const tasks = await this.getCriticalTasks();
    const filtered = tasks.filter(t => t.id !== id);

    return new Promise((resolve) => {
      chrome.storage.local.set({ criticalTasks: filtered }, resolve);
    });
  }

  /**
   * Update task completion status
   */
  async updateTaskCompletion(taskId, completedItems) {
    const tasks = await this.getCriticalTasks();
    const task = tasks.find(t => t.id === taskId);

    if (task) {
      task.completedItems = completedItems;
      task.lastCompleted = Date.now();

      return new Promise((resolve) => {
        chrome.storage.local.set({ criticalTasks: tasks }, resolve);
      });
    }
  }

  /**
   * Get blocked websites list
   */
  async getBlockedWebsites() {
    return new Promise((resolve) => {
      chrome.storage.local.get(['blockedWebsites'], (result) => {
        resolve(result.blockedWebsites || [
          '*://*.twitter.com/*',
          '*://*.x.com/*',
          '*://*.youtube.com/*',
          '*://*.reddit.com/*'
        ]);
      });
    });
  }

  /**
   * Save blocked websites list
   */
  async saveBlockedWebsites(websites) {
    return new Promise((resolve) => {
      chrome.storage.local.set({ blockedWebsites: websites }, resolve);
    });
  }

  /**
   * Get blocking state
   */
  async getBlockingState() {
    return new Promise((resolve) => {
      chrome.storage.local.get(['blockingActive'], (result) => {
        resolve(result.blockingActive || false);
      });
    });
  }

  /**
   * Set blocking state
   */
  async setBlockingState(active) {
    return new Promise((resolve) => {
      chrome.storage.local.set({ blockingActive: active }, resolve);
    });
  }
}

// Export singleton instance
export const storageManager = new StorageManager();
