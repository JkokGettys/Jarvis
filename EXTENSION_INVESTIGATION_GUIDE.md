# Extension-Based Cascade Investigation Guide

## 🎯 Goal

Discover if we can interact with Cascade programmatically through extension APIs, bypassing keyboard simulation entirely.

## Why This Approach?

As a **VS Code Extension**, we have privileged access that keyboard simulation doesn't:
- ✅ Run independently of user's window focus
- ✅ Access internal VS Code APIs
- ✅ Message other extensions
- ✅ Execute commands with parameters
- ✅ Manipulate editor state programmatically

## 🚀 Quick Start

### Step 1: Rebuild Extension
```bash
npm run compile
```

### Step 2: Reload Windsurf
Press `F5` to start Extension Development Host

OR

`Ctrl+Shift+P` → "Developer: Reload Window"

### Step 3: Open Developer Console
`Ctrl+Shift+I` (or Help → Toggle Developer Tools)

This will show detailed investigation logs.

---

## 📊 Investigation Commands

### Command 1: Full Investigation

`Ctrl+Shift+P` → `Jarvis: Investigate Cascade Integration (Full)`

**What it does:**
- Discovers all Windsurf/Cascade extensions
- Lists all available commands
- Checks for webview panels
- Inspects open documents
- Tests for Chat API availability

**What to look for:**
1. **Extensions with exports** - If any Cascade extension has exports, we might be able to call them
2. **Commands** - Any command that could accept a prompt parameter
3. **Webviews** - If Cascade is a webview, we could message it
4. **Chat API** - If available, we can create chat participants

**Output:** Check both Output panel AND Developer Console for full details

---

### Command 2: Test Message Methods

`Ctrl+Shift+P` → `Jarvis: Test Cascade Message Methods`

**What it does:**
- Tests multiple ways to send messages programmatically:
  - Commands with string arguments
  - Commands with options objects
  - Extension API calls
- Automatically stops on first successful method

**What to expect:**
- Either finds a working method (🎉)
- Or reports all methods failed (expected, but useful data)

**IMPORTANT:** This will actually TRY to send a test message. If a method works, you'll see the test prompt appear in Cascade!

---

### Command 3: List Commands (Quick)

`Ctrl+Shift+P` → `Jarvis: Discover Cascade Commands`

**What it does:**
- Simple list of all Cascade-related commands
- Quick reference for manual testing

---

## 🔍 What We're Looking For

### Best Case Scenario: Working Command ⭐⭐⭐

```typescript
// If we find this works:
await vscode.commands.executeCommand('cascade.sendMessage', 'Hello');

// Or this:
await vscode.commands.executeCommand('workbench.action.chat.submit', {
    prompt: 'Hello',
    participant: 'cascade'
});
```

**Signs of success:**
- Test command actually sends message to Cascade
- No keyboard simulation needed
- Works regardless of window focus

### Good Case: Extension API ⭐⭐

```typescript
const cascade = vscode.extensions.getExtension('windsurf.cascade');
const api = await cascade.activate();
await api.sendPrompt('Hello');
```

**Signs of success:**
- Extension has exported API
- API includes message sending methods

### Acceptable Case: Webview Messaging ⭐

```typescript
const webview = getCascadeWebview();
webview.postMessage({ type: 'submit', prompt: 'Hello' });
```

**Signs of success:**
- Can get reference to Cascade webview
- Can post messages to it

### Fallback: No Direct Method ❌

If nothing works, we'll know we need to:
- Accept manual user action (semi-automated)
- OR bypass Cascade entirely (build our own agent)
- OR request feature from Windsurf team

---

## 📝 Manual Testing

If automated tests find promising commands, test them manually:

### In Developer Console (Ctrl+Shift+I):

```javascript
// List all commands
await vscode.commands.getCommands().then(cmds => 
    cmds.filter(c => c.includes('cascade'))
);

// Test a specific command
await vscode.commands.executeCommand('cascade.sendMessage', 'Test');

// Check for extensions
vscode.extensions.all
    .filter(e => e.id.includes('cascade'))
    .map(e => ({ id: e.id, exports: e.exports }));
```

### Test Different Parameters:

```javascript
// Try different argument styles
await vscode.commands.executeCommand('command.name', 'simple string');
await vscode.commands.executeCommand('command.name', { prompt: 'test' });
await vscode.commands.executeCommand('command.name', { text: 'test', submit: true });
```

---

## 🎯 Expected Results

### Likely Outcome (80%)

**No programmatic API exists**

We'll find:
- Commands like `cascade.open`, `cascade.toggle` (already known)
- No commands that accept prompt parameters
- No extension exports
- No accessible webviews

**Next action:** Choose between semi-automated approach or bypassing Cascade

### Hopeful Outcome (15%)

**Undocumented command exists**

We'll find:
- A command that accepts prompt as argument
- Might not be documented, but works

**Next action:** Implement using discovered command

### Best Outcome (5%)

**Full API available**

We'll find:
- Extension exports API
- OR documented commands with parameters
- OR webview messaging protocol

**Next action:** Implement full programmatic solution

---

## 📊 Reporting Results

After running investigations, please report:

### 1. Extensions Found

```
Found X Cascade-related extensions:
- windsurf.cascade (active: yes/no, exports: yes/no)
- Other extensions...
```

### 2. Interesting Commands

```
Promising commands:
- cascade.* commands
- workbench.action.chat.* commands
- Any command that looks like it could accept parameters
```

### 3. Test Results

```
✅ Working methods: [list if any]
❌ Failed methods: [count]
```

### 4. Developer Console Output

Copy interesting logs from console showing:
- Extension API structures
- Command execution results
- Any error messages with details

---

## 🛠️ If We Find A Working Method

We'll immediately update `CascadeBridge.ts`:

```typescript
async sendPrompt(prompt: string): Promise<void> {
    try {
        // NEW: Use discovered programmatic method
        await vscode.commands.executeCommand('CASCADE_COMMAND', prompt);
        
        console.log('✅ Sent via programmatic API!');
        this.eventBus.emit(EventType.REQUEST_STARTED);
        
    } catch (error) {
        // Fallback to keyboard simulation if needed
        await this.sendPromptViaKeyboard(prompt);
    }
}
```

**Benefits:**
- ✅ No keyboard simulation
- ✅ No window focus issues
- ✅ User can multitask
- ✅ Reliable across platforms
- ✅ Works in background

---

## 🚨 Troubleshooting

### Issue: Commands not showing up

**Fix:** Reload window after rebuild
```bash
Ctrl+Shift+P → "Developer: Reload Window"
```

### Issue: Developer Console empty

**Fix:** Make sure you opened it BEFORE running commands
```bash
Ctrl+Shift+I → Run command → Check Console tab
```

### Issue: Test seems to do nothing

**This is actually the expected result if no API exists!**

The test will try all methods and report they failed. This tells us we need a different approach.

---

## 📖 Next Steps Based on Results

### If programmatic method found ✅
1. Update CascadeBridge implementation
2. Remove keyboard simulation
3. Test with voice input
4. Deploy solution

### If no method found ❌
1. **Option A:** Semi-automated approach
   - Copy to clipboard
   - Show clear notification
   - User pastes (one action)
   - Polish UX to minimize friction

2. **Option B:** Bypass Cascade
   - Use GPT-OSS directly
   - Implement code generation
   - Apply via VS Code workspace API
   - Lose Cascade's advanced features

3. **Option C:** Feature request
   - Contact Windsurf team
   - Request official API
   - Wait for implementation

---

## 💡 Key Insight

**Extensions have superpowers!**

Unlike keyboard automation, extensions can:
- Call internal commands programmatically
- Access other extensions' APIs
- Manipulate editor state directly
- Work independently of user's focus
- Operate in the background

If Cascade exposes ANY programmatic interface, we can use it as an extension.

---

## Ready to Investigate?

1. ✅ Rebuild: `npm run compile`
2. ✅ Reload Windsurf
3. ✅ Open Developer Console (Ctrl+Shift+I)
4. ✅ Run: `Ctrl+Shift+P` → `Jarvis: Investigate Cascade Integration (Full)`
5. ✅ Run: `Ctrl+Shift+P` → `Jarvis: Test Cascade Message Methods`
6. ✅ Report findings!

Let's find out if we can build the solution you envision! 🚀
