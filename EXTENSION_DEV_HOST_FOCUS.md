# Extension Development Host Focus

## The Two-Window Development Setup

When developing Jarvis, you have **TWO Windsurf instances**:

### 1. Main Windsurf Window
- Where you edit Jarvis code
- `CascadeBridge.ts`, `extension.ts`, etc.
- This is your **development environment**

### 2. Extension Development Host Window
- Where Jarvis extension actually runs
- Where you **test** Jarvis interactions
- This is your **testing environment**
- **This is where Cascade should receive messages!** ⭐

## The Critical Distinction

When Jarvis sends a message to Cascade, it MUST focus:
```
✅ Extension Development Host  (testing window)
❌ Main Windsurf             (code editing window)
```

## Updated WindowFocuser Logic

```typescript
static async focusWindsurf(): Promise<boolean> {
    // PRIORITY 1: Try Extension Development Host first
    const devHostFocused = await this.focusWindowByTitle('Extension Development Host');
    if (devHostFocused) {
        return true; // ✅ Found the test window!
    }
    
    // PRIORITY 2: Fallback to main Windsurf
    const windsurfFocused = await this.focusWindowByTitle('Windsurf');
    if (windsurfFocused) {
        return true; // ⚠️ Using main window (might not have Jarvis running)
    }
    
    return false; // ❌ No window found
}
```

## Why This Matters

### Wrong Behavior (Before Fix)
```
1. You're in Chrome
2. Say: "Hey Jarvis, create a Python script"
3. WindowFocuser finds "Windsurf" window
4. Focuses MAIN Windsurf (where you edit code)
5. Sends prompt to that window's Cascade
6. Wrong Cascade instance! ❌
```

### Correct Behavior (After Fix)
```
1. You're in Chrome
2. Say: "Hey Jarvis, create a Python script"
3. WindowFocuser looks for "Extension Development Host"
4. Focuses Extension Development Host window ✅
5. Sends prompt to THAT window's Cascade
6. Correct Cascade instance! ✅
```

## Window Title Patterns

### Extension Development Host
```
Full title: "[Extension Development Host] - Jarvis - Windsurf"
Pattern: "*Extension Development Host*"
Priority: 🥇 First choice
```

### Main Windsurf
```
Full title: "Jarvis - Windsurf"
Pattern: "*Windsurf*"
Priority: 🥈 Fallback
```

## Production vs Development

### During Development (Now)
- ✅ Focuses Extension Development Host
- ✅ Tests in isolated window
- ✅ Main code window stays untouched

### In Production (Future)
- ✅ Only one Windsurf window
- ✅ No "Extension Development Host"
- ✅ Falls back to main Windsurf window
- ✅ Works correctly!

## Testing the Fix

### Test 1: In Chrome, with both Windsurf windows open
```
1. Open main Windsurf (editing Jarvis code)
2. Open Extension Development Host (F5 or Debug)
3. Go to Chrome
4. Speak to Jarvis: "Test message"
5. Watch which window pops up:
   ✅ Should be Extension Development Host
   ❌ Should NOT be main Windsurf
```

### Test 2: Check console logs
```
Look for:
✅ "Focused Extension Development Host window"
or
⚠️ "Extension Development Host not found, trying main Windsurf..."
```

### Test 3: Close Extension Development Host
```
1. Close the test window
2. Keep main Windsurf open
3. Speak to Jarvis
4. Should see:
   ⚠️ "Extension Development Host not found..."
   ✅ "Focused main Windsurf window"
```

## Console Output Examples

### Success (Correct Window)
```
🔵 Focusing Extension Development Host window...
✅ Focused Extension Development Host window
  ✓ Extension Development Host focused
```

### Fallback (Test Window Closed)
```
🔵 Focusing Extension Development Host window...
⚠️ Extension Development Host not found, trying main Windsurf...
✅ Focused main Windsurf window
  ✓ Extension Development Host focused
```

### Failure (No Windsurf Open)
```
🔵 Focusing Extension Development Host window...
⚠️ Extension Development Host not found, trying main Windsurf...
⚠️ Could not focus any Windsurf window
⚠️ Could not focus Extension Development Host - keyboard sim may fail!
```

## Future: Package as Real Extension

When you package Jarvis as a real extension (not running in dev mode):
- No "Extension Development Host" window
- Only one Windsurf instance
- Automatically falls back to main window
- Works correctly! ✅

## Troubleshooting

### Issue: Focuses wrong window
**Solution:** Check window title exactly matches
```powershell
# Run in PowerShell to see all Windsurf windows:
Get-Process | Where-Object { $_.ProcessName -like '*Windsurf*' } | 
  Select-Object ProcessName, MainWindowTitle
```

### Issue: Can't find Extension Development Host
**Possible causes:**
1. Test window isn't open (press F5 to start debugging)
2. Window title doesn't contain "Extension Development Host"
3. Window is minimized to taskbar

### Issue: Still pastes in Chrome
**Possible causes:**
1. Focus failed (check console logs)
2. Delay too short (increase `delay(300)` to `delay(500)`)
3. Chrome captured focus back (very rare)

## Code Files

### WindowFocuser.ts
```typescript
// Location: src/cascade/WindowFocuser.ts
// Purpose: Focus the correct Windsurf window
// Priority: Extension Development Host > Main Windsurf
```

### CascadeBridge.ts
```typescript
// Location: src/cascade/CascadeBridge.ts
// Usage: await WindowFocuser.focusWindsurf()
// When: Before sending prompt (Step 0)
```

## Summary

✅ **Fixed:** Now correctly targets Extension Development Host window  
✅ **Fallback:** Uses main Windsurf if test window not open  
✅ **Production-ready:** Will work when packaged as real extension  
✅ **Multi-window safe:** Handles development setup correctly  

The key insight: During development, Jarvis runs in the **Extension Development Host**, not the main Windsurf window. The WindowFocuser now understands this!

---

**Date:** November 2, 2025  
**Fix:** Extension Development Host priority focus  
**Impact:** Prevents focusing wrong Windsurf window during development
