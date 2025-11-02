# ⚠️ DEPRECATED - Use Windsurf Rules Instead

**This method is being deprecated by Windsurf.**

## ✅ New Method: Windsurf Rules

Use **Windsurf Rules** instead of custom instructions.

👉 **See `WINDSURF_RULES_SETUP.md` for the current setup method.**

---

## Old Method (Custom Instructions) - For Reference Only

~~Add these custom instructions to your Cascade agent settings.~~

### Where to Add

1. Open Windsurf Settings
2. Navigate to: **Cascade → Custom Instructions** (or similar)
3. Paste the instructions below

---

## Custom Instructions Text

```
JARVIS INTEGRATION INSTRUCTIONS:

At the end of EVERY task completion, call the MCP tool:
  jarvis-voice-summary.save

with these required fields:
  - tldr: one-sentence summary for voice readout (conversational tone, 10-15 words)
  - changes: array of "file: action" strings (e.g., ["hello.py: added print statement"])
  - risks: array of potential issues or caveats (empty array if none)
  - next_questions: array of follow-up questions for the user (empty array if none)
  - apply_safe: boolean - true if changes are safe to auto-apply without review

Example MCP call:
jarvis-voice-summary.save({
  tldr: "Created a simple Python hello world script",
  changes: ["hello.py: added print statement"],
  risks: [],
  next_questions: ["Would you like to run the script?"],
  apply_safe: true
})

FALLBACK (if MCP tool unavailable):
If the jarvis-voice-summary MCP tool is not found, include the same payload as a JSON fenced block labeled VOICE_SUMMARY_JSON at the very bottom of your reply:

```VOICE_SUMMARY_JSON
{
  "tldr": "your summary here",
  "changes": ["file: action"],
  "risks": [],
  "next_questions": [],
  "apply_safe": true
}
```

IMPORTANT:
- Keep tldr conversational and brief (voice readout, not technical)
- Always call this tool/include this block on task completion
- Don't explain the tool call in your response to the user
```

---

## MCP Server Configuration

You also need to register the MCP server itself. Add this to Windsurf MCP settings:

### Method 1: Windsurf Settings UI

1. File → Preferences → Settings
2. Search for "MCP"
3. Add server configuration:

```json
{
  "name": "jarvis-voice-summary",
  "command": "c:\\DevMode\\Jarvis\\python\\venv\\Scripts\\python.exe",
  "args": ["c:\\DevMode\\Jarvis\\python\\mcp_server.py"],
  "cwd": "c:\\DevMode\\Jarvis\\python"
}
```

### Method 2: Configuration File

If Windsurf uses a JSON config file (check docs), add to MCP servers section:

**File:** `%USERPROFILE%\.windsurf\mcp_config.json` (or similar)

```json
{
  "mcpServers": {
    "jarvis-voice-summary": {
      "command": "c:\\DevMode\\Jarvis\\python\\venv\\Scripts\\python.exe",
      "args": ["c:\\DevMode\\Jarvis\\python\\mcp_server.py"],
      "cwd": "c:\\DevMode\\Jarvis\\python"
    }
  }
}
```

---

## Verify Setup

### 1. Check MCP Server is Registered

Open Cascade (Ctrl+L) and ask:
```
What MCP tools are available?
```

Should see: `jarvis-voice-summary.save` in the list

### 2. Test Manual Call

Ask Cascade:
```
Call the jarvis-voice-summary.save tool with test data
```

Cascade should respond with confirmation that it saved the summary.

### 3. Check File Created

After Cascade completes a task:
```powershell
cat ~\.windsurf\jarvis_summary.json
```

Should show JSON with your test data.

---

## Troubleshooting

### "MCP server jarvis-voice-summary not found"

**Causes:**
- MCP server not configured in Windsurf settings
- Python path incorrect in MCP config
- Windsurf not restarted after adding config

**Solutions:**
1. Verify Python path exists:
   ```powershell
   Test-Path "c:\DevMode\Jarvis\python\venv\Scripts\python.exe"
   ```
2. Restart Windsurf completely
3. Check Windsurf logs for MCP startup errors
4. Fallback: Cascade will output JSON block instead (Jarvis can parse this too)

### Custom Instructions Not Applied

**Solutions:**
- Verify you're editing the correct Cascade profile/settings
- Some settings may be per-workspace vs global
- Try adding to both user and workspace settings

### MCP Tool Shows Up But Doesn't Work

**Debug:**
1. Test MCP server directly:
   ```powershell
   cd c:\DevMode\Jarvis\python
   .\venv\Scripts\Activate.ps1
   python mcp_server.py
   ```
2. Check for Python errors in Output panel
3. Verify `fastmcp` is installed: `pip list | findstr fastmcp`

---

## Benefits of This Approach

✅ **No per-prompt injection** - Instructions persist across all Cascade sessions  
✅ **Cleaner prompts** - Users only see their actual request  
✅ **Always active** - Works for all Jarvis-initiated requests  
✅ **Fallback included** - JSON block if MCP unavailable  
✅ **Easy to update** - Edit instructions once, applies everywhere  

---

## Example Workflow

```
USER → Jarvis: "Create a hello world app"
  ↓
Jarvis: "Right, I'll get that started"
  ↓
Cascade receives: "Create a simple Python hello world script"
  (Custom instructions automatically apply)
  ↓
Cascade: [creates hello.py]
  ↓
Cascade: [calls jarvis-voice-summary.save({...})]
  ↓
MCP Server: [saves to ~/.windsurf/jarvis_summary.json]
  ↓
Jarvis: "I've created your hello world application" (via TTS)
```

Clean and seamless! 🎉
