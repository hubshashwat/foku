# 🎯 Foku - Focus & Productivity Extension

A Chrome extension that helps you stay focused and productive by blocking distracting websites and managing important daily tasks.

![Foku Logo](assets/icon128.png)

## Features

### 🚫 Focus Mode
- **One-Click Activation**: Enable Focus Mode from the popup to block all distracting sites
- **Customizable Block List**: Configure which sites to block in Settings
- **Clean Blocker UI**: Dark-themed overlay with a simple "Close Tab" button
- **Works Everywhere**: Consistent styling across all websites

### 🪃 Boomerang (Tab Reminders)
- **Quick Setup**: Click the extension icon, select your time, and click "Create Boomerang"
- **Tab Returns**: The tab automatically reopens after your chosen time
- **Multiple Timers**: Create multiple boomerangs with different durations
- **Custom Scheduling**: Set specific dates and times for tab reminders

### ⏰ Important Daily Tasks
- **Set Reminders**: Mark pages as important and set multiple daily reminder times
- **Auto-Open**: Pages automatically open at your scheduled times
- **Never Forget**: Great for daily standups, reports, or recurring tasks

### 📊 Tab Limiter
- **Prevent Tab Overload**: Set a maximum number of tabs
- **Automatic Blocking**: New tabs are blocked when you exceed the limit
- **Stay Organized**: Keep your browser clean and focused

## Installation

> [!IMPORTANT]
> This extension uses modern ES6 modules and Vite build system. **You MUST build the extension before loading it!** Do not load the source files directly into Chrome.

### From Source (Development)

1. Clone this repository:
   ```bash
   git clone https://github.com/hubshashwat/foku.git
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Build the extension:
   ```bash
   npm run build
   ```
   This creates a `dist` folder with the compiled extension.

4. Load in Chrome:
   - Go to `chrome://extensions/`
   - Enable **Developer mode** (top right)
   - Click **Load unpacked**
   - Select the **`dist`** folder (NOT the root folder!)

5. Pin the extension for easy access!

### Development Mode

For development with hot reload:
```bash
npm run dev
```
Then load the `dist` folder in Chrome. The extension will auto-reload when you make changes.

## Troubleshooting

### ❌ Import errors / Module not found
**Problem:** Extension fails to load with import/module errors

**Solution:** You're loading the source files instead of the built files. Always load the `dist` folder, not the root project folder.

### ❌ Content script not found
**Problem:** "Content script not found" error in console

**Solution:** Extension wasn't built properly. Run `npm run build` again and reload the extension.

### ❌ Extension features not working
**Problem:** Context menus, Focus Mode, or other features don't work

**Solution:** 
1. Make sure you loaded the `dist` folder
2. Try rebuilding: `npm run build`
3. Reload the extension in Chrome
4. Hard refresh any open tabs (Ctrl+Shift+R)

### ❌ Premium features not working
**Problem:** Domain-specific limits and other premium features aren't available

**Solution:** This is normal behavior in the free version. Premium build requires setting `VITE_PREMIUM_BUILD=true` environment variable before building.

## Usage

### Focus Mode
1. Click the Foku extension icon
2. Toggle **Focus Mode** ON
3. Navigate to any blocked site → You'll see the blocker overlay
4. Click "Close Tab" to close the distraction

### Boomerang
1. On any page you want to return to later
2. Click the Foku extension icon
3. Select when you want the tab to return
4. Click **🪃 Create Boomerang**
5. Close the tab - it will automatically reopen at your chosen time

### Important Daily Tasks
1. Right-click on any page
2. Select **Mark as Important (Daily)**
3. Configure reminder times in the modal
4. Click **Save Task**

## Contributing

Contributions are welcome! Here's how to get started:

### Development Setup

1. Fork the repository
2. Clone your fork:
   ```bash
   git clone https://github.com/hubshashwat/foku.git
   ```
3. Install dependencies:
   ```bash
   npm install
   ```
4. Start development mode:
   ```bash
   npm run dev
   ```
5. Make your changes and test in Chrome

### Submitting Changes

1. Create a feature branch:
   ```bash
   git checkout -b feature/your-feature-name
   ```
2. Make your changes
3. Rebuild: `npm run build`
4. Test thoroughly in Chrome
5. Commit with a descriptive message:
   ```bash
   git commit -m "feat: Add your feature description"
   ```
6. Push to your fork:
   ```bash
   git push origin feature/your-feature-name
   ```
7. Open a Pull Request

### Code Style
- Use vanilla JavaScript (no frameworks)
- Follow existing code patterns
- Keep the dark theme aesthetic consistent
- Test on multiple websites before submitting

## Tech Stack

- **Manifest V3** Chrome Extension
- **Vite** for building
- **Vanilla JS** (no framework dependencies)
- **Chrome Storage API** for persistence
- **Chrome Alarms API** for scheduling

## Project Structure

```
foku/
├── manifest.json        # Extension manifest
├── background.js        # Service worker
├── popup/              # Extension popup UI
├── content/            # Content scripts (blockers, modals)
├── settings/           # Settings page
├── storage/            # Storage utilities
└── assets/             # Icons and sounds
```

## Permissions

| Permission | Purpose |
|------------|---------|
| `storage` | Store user settings and tasks |
| `alarms` | Schedule boomerangs and reminders |
| `tabs` | Manage tabs for blocking and opening |
| `contextMenus` | Right-click menu integration |
| `notifications` | Alert users when tabs return |

## Roadmap

- [ ] Sync across devices
- [ ] Statistics dashboard
- [ ] Custom block page themes
- [ ] Keyboard shortcuts
- [ ] Whitelist exceptions for Focus Mode

## License

MIT License - Feel free to use and modify!

---

Made with 🎯 by the Foku Team
