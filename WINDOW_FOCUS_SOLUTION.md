# Window Focus Solution

## The Problem You Discovered

When using Jarvis while in another application (like Chrome), the keyboard simulation would paste/submit in the **wrong window**:

```
User: In Chrome browsing
User: "Hey Jarvis, create a Python script..."
Jarvis: [Tries to paste in Chrome] ❌ Opens new tab!
```

**Root cause:** Keyboard simulation always goes to the **currently focused window**.

## The Solution ✅

**Automatically bring Windsurf to focus before sending commands!**

### Implementation

Created `WindowFocuser.ts` that uses Windows API to:
1. Find Windsurf window by title
2. Bring it to the foreground
3. Verify focus succeeded

### Flow Now

```
1. User speaks instruction (anywhere on PC)
   ↓
2. Python voice service transcribes
   ↓
3. Extension receives instruction
   ↓
4. 🆕 Focus Windsurf window automatically
   ↓
5. Open quick chat (windsurf.sendTextToChat)
   ↓
6. Paste prompt (now goes to correct window!)
   ↓
7. Submit (now goes to correct window!)
```

## Technical Details

### WindowFocuser Methods

**`focusWindsurf()`** - Main method
```typescript
await WindowFocuser.focusWindsurf();
// Uses PowerShell + Windows API to focus Windsurf
// Returns: true if successful, false if failed
```

**How it works:**
```powershell
# 1. Find Windsurf process
$process = Get-Process | Where-Object { 
    $_.MainWindowTitle -like '*Windsurf*' 
}

# 2. Activate the window
[Microsoft.VisualBasic.Interaction]::AppActivate($process.Id)
```

**`focusWindowByTitle()`** - Advanced method
```typescript
await WindowFocuser.focusWindowByTitle('Windsurf');
// Uses Win32 SetForegroundWindow API
// More reliable for minimized windows
```

**`isWindsurfFocused()`** - Check focus state
```typescript
const focused = await WindowFocuser.isWindsurfFocused();
// Returns: true if Windsurf is currently focused
```

## Updated sendPrompt() Flow

```typescript
async sendPrompt(prompt: string): Promise<void> {
    // Step 0: 🆕 Focus Windsurf window
    const focused = await WindowFocuser.focusWindsurf();
    if (!focused) {
        console.warn('⚠️ Could not focus Windsurf');
    }
    await delay(300); // Let focus settle
    
    // Step 1: Open quick chat
    await vscode.commands.executeCommand('windsurf.sendTextToChat');
    await delay(500);
    
    // Step 2: Copy to clipboard
    await vscode.env.clipboard.writeText(prompt);
    await delay(300);
    
    // Step 3: Paste (now in correct window!)
    await KeyboardSimulator.pasteFromClipboard();
    await delay(1000);
    
    // Step 4: Submit (now in correct window!)
    await KeyboardSimulator.pressEnter();
}
```

## Benefits

### Before (Your Bug Report)
```
✅ User in Windsurf → Works
❌ User in Chrome → Paste goes to Chrome
❌ User in VS Code → Paste goes to VS Code
❌ User in any app → Paste goes to wrong app
```

### After (With Window Focus)
```
✅ User in Windsurf → Works
✅ User in Chrome → Focuses Windsurf first, then works!
✅ User in VS Code → Focuses Windsurf first, then works!
✅ User in any app → Focuses Windsurf first, then works!
```

## User Experience

### What You'll See

1. **Speaking anywhere on PC:**
   - Chrome, VS Code, File Explorer, anywhere!
   
2. **Jarvis processing:**
   - Windsurf window automatically comes to front
   - Quick chat opens
   - Prompt appears
   - Submitted automatically

3. **You can:**
   - Keep working in other apps
   - Windsurf pops up when Jarvis is ready
   - See the conversation start
   - Switch back to what you were doing

### What You'll Notice

**Positive:**
- ✅ No more accidental pastes in wrong apps!
- ✅ Windsurf automatically comes to front
- ✅ Can use Jarvis from anywhere
- ✅ Reliable submission

**Trade-off:**
- ⚠️ Windsurf window will steal focus briefly
- ⚠️ Your current window goes to background

## Error Handling

If focus fails:
```typescript
if (!focused) {
    // Show warning but continue
    vscode.window.showWarningMessage('⚠️ Jarvis: Could not focus Windsurf');
    // Still attempts to send (might work if user manually focused)
}
```

## Testing

### Test Scenario 1: In Chrome
```
1. Open Chrome, browse anything
2. Speak to Jarvis: "Create a Python hello world script"
3. Watch Windsurf automatically come to front
4. See prompt submitted to Cascade
✅ Success!
```

### Test Scenario 2: In Another Editor
```
1. Open VS Code or any text editor
2. Speak to Jarvis: "Explain the authentication flow"
3. Windsurf pops up
4. Prompt submitted
✅ Success!
```

### Test Scenario 3: Gaming or Full Screen
```
1. In a game or full-screen app
2. Speak to Jarvis
3. Windsurf might fail to focus (OS protection)
⚠️ May need to manually switch to Windsurf
```

## Limitations & Future

### Current Limitations

1. **Windows only** - Uses Windows PowerShell/API
   - macOS: Would need AppleScript/Objective-C
   - Linux: Would need xdotool/wmctrl

2. **Focus stealing** - Briefly interrupts user's work
   - Alternative: Queue messages for later
   - Alternative: Notification system

3. **Protected apps** - Some apps resist focus stealing
   - Games in exclusive fullscreen
   - UAC prompts
   - Certain security software

### Future Improvements

**Option A: Notification System**
```typescript
// Instead of focusing:
vscode.window.showInformationMessage(
    'Jarvis has a message for Cascade',
    'Send Now', 'Cancel'
).then(choice => {
    if (choice === 'Send Now') {
        // User manually focuses, then send
    }
});
```

**Option B: Message Queue**
```typescript
// Queue messages when user is busy
messageQueue.add(prompt);
// Send when user next focuses Windsurf
```

**Option C: True Programmatic API** (The Dream)
```typescript
// If Windsurf adds API:
await cascade.sendMessage(prompt);
// No focus needed! No keyboard sim!
```

## Files Modified

1. **Created:** `src/cascade/WindowFocuser.ts`
   - Window focusing utilities
   - Windows API integration

2. **Modified:** `src/cascade/CascadeBridge.ts`
   - Added focus step before sending
   - Error handling for focus failures

## Alternative: Manual Focus Mode

If you prefer **not** to auto-focus, you can disable it:

```typescript
// In CascadeBridge.ts, comment out:
// const focused = await WindowFocuser.focusWindsurf();

// Result: User must manually be in Windsurf to send
```

## Configuration (Future)

Could add setting:
```json
{
  "jarvis.autoFocusWindsurf": true,  // Auto-focus before sending
  "jarvis.focusDelay": 300,           // ms to wait after focus
  "jarvis.showFocusWarning": true     // Warn if focus fails
}
```

## Comparison to Other Approaches

### Approach 1: Auto-focus (Current) ⭐⭐⭐
- ✅ Works from any app
- ✅ Automatic
- ⚠️ Steals focus

### Approach 2: Require manual focus
- ✅ No focus stealing
- ❌ User must be in Windsurf
- ❌ Breaks workflow

### Approach 3: Queue + notification
- ✅ No focus stealing
- ✅ User control
- ❌ Extra steps
- ❌ More complex

### Approach 4: True API (Dream)
- ✅ No focus needed
- ✅ No keyboard sim
- ❌ Doesn't exist (yet)

## Conclusion

**The auto-focus solution solves your Chrome bug** while maintaining the ability to use Jarvis from anywhere on your PC. It's a pragmatic trade-off between convenience and focus stealing.

**Recommendation:** Try it! If the focus stealing is annoying, we can add a configuration option or switch to a notification-based approach.

---

**Status:** ✅ Implemented and ready to test  
**Date:** November 2, 2025  
**Implementation:** M2.1 (Window Focus Enhancement)
