# MCP Integration - Quick Start

## 🎯 What This Does

Enables Cascade to send completion messages back to Jarvis for TTS announcements.

**Before:** Cascade works silently → User doesn't know when done  
**After:** Cascade completes → Jarvis announces "I've created your app!"

---

## ⚡ Quick Setup (5 minutes)

### 1. Create Windsurf Rule (New Method)

**Open Rules Panel:**
- Click **Customizations icon** (top right in Cascade)
- Navigate to **Rules** panel
- Click **+ Workspace**

**Rule Details:**
- **Name:** `Jarvis MCP Integration`
- **Activation:** `Always On`
- **Content:** See `WINDSURF_RULES_SETUP.md` for the full rule text

**Quick summary:** Rule tells Cascade to call `jarvis-voice-summary.save()` after every task completion.

See `WINDSURF_RULES_SETUP.md` for step-by-step instructions.

### 2. Configure MCP Server

**Add to Windsurf MCP settings:**

```json
{
  "name": "jarvis-voice-summary",
  "command": "c:\\DevMode\\Jarvis\\python\\venv\\Scripts\\python.exe",
  "args": ["c:\\DevMode\\Jarvis\\python\\mcp_server.py"],
  "cwd": "c:\\DevMode\\Jarvis\\python"
}
```

**Where:** File → Preferences → Settings → Search "MCP"

### 3. Reload Extension

Press F5 or reload Windsurf to activate changes.

### 4. Test

```
1. Start Jarvis: Ctrl+Shift+J
2. Say: "Create a hello world Python script"
3. Wait for Cascade to complete
4. Jarvis should announce: "I've created your hello world script"
```

---

## 🔍 Verify It's Working

### Check MCP Server is Registered

Open Cascade (Ctrl+L) and ask:
```
What MCP tools are available?
```

Should see: `jarvis-voice-summary.save`

### Check File is Created

After Cascade completes a task:
```powershell
cat ~\.windsurf\jarvis_summary.json
```

Should show JSON with `tldr`, `changes`, etc.

### Check Extension Logs

Output panel → "Jarvis Voice Assistant"

Look for:
```
[Extension] MCP Watcher monitoring: C:\Users\...\jarvis_summary.json
[Extension] MCP Summary received from Cascade!
```

---

## 🐛 Troubleshooting

### No Announcements

**Check 1:** Is voice service running?
```
Status bar should show Jarvis status
```

**Check 2:** Is MCP file being created?
```powershell
ls ~\.windsurf\jarvis_summary.json
```

**Check 3:** Are logs showing the message?
```
Output panel → Look for "MCP Summary received"
```

### MCP Tool Not Found

**Solution:** Restart Windsurf after adding MCP config

### Python Path Issues

Update paths in MCP config to match your installation:
```powershell
# Verify Python location
where.exe python
# Should point to: c:\DevMode\Jarvis\python\venv\Scripts\python.exe
```

---

## 📚 Full Documentation

- **Setup Guide:** `MCP_SETUP.md`
- **Architecture:** `MCP_INTEGRATION_COMPLETE.md`
- **Original Guide:** `Windsurf_MCP_Voice_Summary_Guide.md`

---

## 🚀 What Happens

```
USER speaks: "Create a hello world app"
  ↓
JARVIS: "Right, I'll get that started"
  ↓
CASCADE: [creates code, calls MCP tool]
  ↓
MCP SERVER: [saves summary.json]
  ↓
FILE WATCHER: [detects change]
  ↓
JARVIS: "I've created your hello world application"
```

That's it! The feedback loop is complete.
