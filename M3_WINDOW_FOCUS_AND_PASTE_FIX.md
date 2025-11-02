# M3: Window Focus and Paste Fix ✅

## Summary

Fixed critical issues with sending prompts to Cascade when user is in other applications and resolved paste failures in the quick chat window.

## Problems Discovered

### Problem 1: Wrong Window Focus
**Issue:** When user was in Chrome (or any other app), keyboard simulation would paste into the wrong window.

**Example:**
```
User in Chrome → Says "Create Python script"
→ Jarvis tries to paste
→ Opens new Chrome tab instead! ❌
```

**Root Cause:** Keyboard simulation always targets the currently focused window.

### Problem 2: Paste Not Working
**Issue:** Even after opening quick chat window correctly, the prompt wasn't pasting.

**Symptoms:**
- ✅ Window opened
- ✅ Clipboard had text
- ✅ Ctrl+V keystroke sent
- ❌ Empty message submitted to Cascade

**Root Cause:** Clipboard was being cleared between the `vscode.env.clipboard.writeText()` call and the PowerShell `SendKeys` call.

## Solutions Implemented

### Solution 1: Window Focusing

**Created:** `WindowFocuser.ts` - Automatically brings Extension Development Host to foreground

**How it works:**
```typescript
// Before sending prompt:
await WindowFocuser.focusWindsurf();
// 1. Searches for "Extension Development Host" window
// 2. Uses Windows API to bring it to foreground
// 3. Falls back to main Windsurf if dev host not found
```

**Priority order:**
1. 🥇 Extension Development Host (testing window)
2. 🥈 Main Windsurf (fallback)

**Benefits:**
- ✅ Works from any application
- ✅ Correctly targets test window during development
- ✅ Falls back to main window in production
- ✅ No more wrong-window pastes

### Solution 2: Atomic Clipboard + Paste

**Problem:** Separate clipboard operations allowed Windsurf to clear clipboard between steps.

**Old approach (broken):**
```typescript
// Step 1: Copy to clipboard
await vscode.env.clipboard.writeText(prompt);
await delay(200);

// Step 2: Send Ctrl+V (clipboard might be cleared!)
await KeyboardSimulator.pasteFromClipboard();
```

**New approach (working):**
```typescript
// Use typeText which does BOTH in ONE PowerShell command
await KeyboardSimulator.typeText(prompt);

// Inside typeText:
// Set-Clipboard; SendKeys('^v')  ← Atomic operation!
```

**Why this works:**
- ✅ Clipboard set and paste happen in same PowerShell execution
- ✅ No time for Windsurf to clear clipboard
- ✅ Uses temp file to avoid escaping issues
- ✅ Sanitizes Unicode characters

## Final Implementation Flow

```typescript
async sendPrompt(prompt: string): Promise<void> {
    // Step 0: Focus Extension Development Host window
    await WindowFocuser.focusWindsurf();
    await delay(300);
    
    // Step 1: Open quick chat with Ctrl+Shift+I
    await KeyboardSimulator.openQuickChat();
    await delay(800); // Wait for window to be ready
    
    // Step 2: Paste prompt (atomic clipboard + paste)
    await KeyboardSimulator.typeText(prompt);
    await delay(500);
    
    // Step 3: Submit with Enter
    await KeyboardSimulator.pressEnter();
    await delay(200);
}
```

## Files Created/Modified

### Created Files

1. **`src/cascade/WindowFocuser.ts`**
   - Window focusing utilities
   - Windows API integration via PowerShell
   - Priority-based window search

### Modified Files

1. **`src/cascade/CascadeBridge.ts`**
   - Added window focusing step
   - Switched to atomic paste operation
   - Removed separate clipboard copy step
   - Updated delays for reliability

2. **`src/cascade/KeyboardSimulator.ts`**
   - Added `openQuickChat()` method (Ctrl+Shift+I)
   - Updated `pasteFromClipboard()` documentation

## Timing Details

| Step | Action | Delay | Reason |
|------|--------|-------|--------|
| 0 | Focus window | 300ms | Let focus settle |
| 1 | Open quick chat | 800ms | Window needs time to open |
| 2 | Paste prompt | 500ms | Let paste complete |
| 3 | Submit | 200ms | Brief confirmation |

**Total time:** ~1.8 seconds

## Testing Results

### Test 1: From Chrome ✅
```
1. User in Chrome browsing
2. Says: "Create Python script"
3. Extension Development Host pops to front
4. Quick chat opens
5. Prompt pastes correctly
6. Submits to Cascade
✅ SUCCESS
```

### Test 2: From Main Windsurf ✅
```
1. User editing Jarvis code
2. Says: "Explain this function"
3. Extension Development Host pops to front
4. Prompt submits correctly
✅ SUCCESS
```

### Test 3: Extension Dev Host Closed ✅
```
1. Close test window
2. Says: "Test message"
3. Falls back to main Windsurf
4. Works correctly
✅ SUCCESS (fallback working)
```

## Key Insights

### Why Ctrl+Shift+I Instead of Commands?

We discovered `windsurf.sendTextToChat` command, but it:
- ❌ Doesn't accept text parameter
- ❌ Doesn't work reliably after window focus
- ✅ Keyboard shortcut is more reliable

### Why typeText Instead of Separate Operations?

The `typeText` method:
- ✅ Does Set-Clipboard + SendKeys atomically
- ✅ Prevents clipboard clearing
- ✅ Handles Unicode properly
- ✅ Uses temp file to avoid escaping issues

### Why Focus Extension Development Host?

During development:
- Main Windsurf = Where you edit code
- Extension Development Host = Where Jarvis runs
- Must target the correct window!

## Production Considerations

### When Packaged as Real Extension

**No Extension Development Host:**
- Only one Windsurf instance
- `WindowFocuser` automatically falls back to main window
- Works correctly! ✅

**User Experience:**
- Windsurf briefly steals focus
- User sees prompt being submitted
- Can continue working after

### Potential Improvements

1. **Configuration option:**
   ```json
   {
     "jarvis.autoFocusWindow": true,
     "jarvis.focusDelay": 300
   }
   ```

2. **Notification instead of auto-focus:**
   - Queue messages
   - Notify user
   - Send when they focus Windsurf

3. **Official API request:**
   - Ask Windsurf team for programmatic API
   - Would eliminate all keyboard simulation

## Known Limitations

1. **Windows only** - Uses Windows PowerShell/API
2. **Focus stealing** - Briefly interrupts user's work
3. **Timing dependent** - Delays may need adjustment on slower systems
4. **Protected apps** - Some fullscreen apps resist focus stealing

## Comparison to Previous Versions

### M0/M1: Ctrl+L Method
```
❌ Toggle behavior (could close instead of open)
❌ Separate clipboard operations
❌ No window focusing
❌ Failed when user in other apps
```

### M2: sendTextToChat Command
```
✅ Programmatic command to open
❌ Doesn't accept text parameter
❌ Separate clipboard operations
❌ No window focusing
❌ Paste still failed
```

### M3: Window Focus + Atomic Paste (Current)
```
✅ Automatic window focusing
✅ Works from any application
✅ Atomic clipboard + paste operation
✅ Reliable paste in quick chat
✅ Correct window targeting (dev vs production)
✅ Proven to work!
```

## Success Criteria Met ✅

- [x] Works when user is in other applications
- [x] Correctly targets Extension Development Host during development
- [x] Falls back to main Windsurf in production
- [x] Prompt pastes successfully into quick chat
- [x] No more empty messages submitted
- [x] Reliable and consistent operation
- [x] Ready for voice service integration

## Next Steps

### Immediate
1. ✅ Test with actual voice input
2. ✅ Monitor reliability over multiple uses
3. ✅ Document for users

### Future Enhancements
1. Add configuration options
2. Implement notification-based alternative
3. Request official Windsurf API
4. Add retry logic for failures
5. Support macOS/Linux (different window focusing)

## Conclusion

M3 successfully solves both critical issues:
1. **Window focusing** - Works from any application
2. **Paste reliability** - Atomic operation prevents clipboard clearing

The solution is production-ready and provides a reliable foundation for Jarvis voice → Cascade integration.

---

**Date:** November 2, 2025  
**Implementation:** M3 (Milestone 3)  
**Status:** ✅ Complete and tested  
**Key Innovation:** Atomic clipboard + paste operation
