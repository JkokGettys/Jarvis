# Find the Ctrl+Shift+I Command

## Method 1: Check Keyboard Shortcuts

1. Open Keyboard Shortcuts: `Ctrl+K Ctrl+S`
2. Search for: `ctrl+shift+i`
3. Look for what command it's bound to

Likely candidates:
- `workbench.action.chat.openEditSession`
- `workbench.action.chat.open`
- `cascade.openQuickChat`
- `cascade.sendMessage`

## Method 2: Run This in Developer Console

Since Ctrl+Shift+I opens a chat window (not dev console), use:

1. Open Command Palette: `Ctrl+Shift+P`
2. Type: `Developer: Toggle Developer Tools`
3. This will open the REAL developer console

Then run:
```javascript
// Get keybinding info
await vscode.commands.executeCommand('workbench.action.openGlobalKeybindings');
```

## Method 3: Check Our Investigation Results

The commands list should show us the exact command name. Let's filter for the most promising ones.
