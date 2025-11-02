# MCP Integration Setup Guide

This guide walks through setting up the MCP (Model Context Protocol) server so Cascade can send completion summaries back to Jarvis for voice announcements.

## Architecture

```
USER → Jarvis (voice) → Cascade (with MCP preamble)
                           ↓
                    Cascade completes task
                           ↓
                    Calls jarvis-voice-summary.save()
                           ↓
                    MCP Server saves JSON
                           ↓
                    File Watcher detects change
                           ↓
                    Jarvis announces via TTS
```

## Step 1: Test the MCP Server Locally

First, verify the MCP server works correctly:

```powershell
# Activate Python virtual environment
cd c:\DevMode\Jarvis\python
.\venv\Scripts\Activate.ps1

# Test the MCP server
python mcp_server.py
```

The server should start and wait for MCP protocol messages on stdin.

## Step 2: Configure Windsurf to Use the MCP Server

### Option A: Using Windsurf Settings (Recommended)

1. Open Windsurf Settings (File → Preferences → Settings)
2. Search for "MCP" or navigate to **Cascade → MCP**
3. Enable MCP integration
4. Add a new MCP server with these settings:

```json
{
  "name": "jarvis-voice-summary",
  "command": "c:\\DevMode\\Jarvis\\python\\venv\\Scripts\\python.exe",
  "args": ["c:\\DevMode\\Jarvis\\python\\mcp_server.py"],
  "cwd": "c:\\DevMode\\Jarvis\\python",
  "env": {}
}
```

### Option B: Manual Configuration File

If Windsurf uses a JSON configuration file for MCP servers, add this entry:

**Location:** `%USERPROFILE%\.windsurf\mcp_servers.json` (or similar)

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

## Step 3: Verify MCP Server Registration

After configuring, restart Windsurf and verify:

1. Open Cascade chat (Ctrl+L)
2. Check if the MCP tools are available (Cascade should now see `jarvis-voice-summary.save`)

You can test by asking Cascade:
```
What MCP tools are available?
```

## Step 4: Test the Integration

### Manual Test

1. **Start Jarvis voice service:**
   - Press Ctrl+Shift+J or run command: "Jarvis: Start Listening"

2. **Send a test request to Cascade:**
   - Open Cascade (Ctrl+L)
   - Type: "Create a simple hello world Python script"
   - Submit

3. **Watch for the response:**
   - Cascade should complete the task
   - Call `jarvis-voice-summary.save()` with completion details
   - MCP server saves to `~/.windsurf/jarvis_summary.json`
   - Jarvis announces the completion via TTS

### Check the Logs

Monitor these locations for debugging:

**Extension logs:**
- Open VS Code Output panel
- Select "Jarvis Voice Assistant" from dropdown
- Look for: `[Extension] MCP Summary received from Cascade!`

**MCP summary file:**
```powershell
# View the latest MCP response
cat ~\.windsurf\jarvis_summary.json
```

**Python voice service:**
- Check console output for: `Announcing: [completion message]`

## Step 5: Voice Integration Test

### Full End-to-End Test

1. **Start Jarvis:**
   ```
   Press Ctrl+Shift+J
   ```

2. **Speak to Jarvis:**
   ```
   "Hey Jarvis, create a hello world application"
   ```

3. **Expected Flow:**
   - Jarvis responds: "Right, I'll get that started"
   - Sends to Cascade with MCP preamble
   - Cascade creates the app
   - Cascade calls MCP tool
   - Jarvis announces: "Created your hello world application"

## Troubleshooting

### MCP Server Not Found

**Problem:** Cascade says MCP tool is unavailable

**Solutions:**
- Verify Python path is correct in MCP config
- Check that `fastmcp` is installed: `pip list | findstr fastmcp`
- Restart Windsurf after adding MCP config
- Check Windsurf logs for MCP server startup errors

### No Announcements

**Problem:** Cascade completes but Jarvis doesn't announce

**Check:**
1. **File watcher working?**
   ```powershell
   # Check if summary file exists
   ls ~\.windsurf\jarvis_summary.json
   ```

2. **Extension receiving updates?**
   - Open Output panel → "Jarvis Voice Assistant"
   - Look for: `[Extension] MCP Summary received`

3. **Voice service running?**
   - Status bar should show Jarvis status
   - Check if TTS works: Run command "Jarvis: Test Conversation"

### MCP Preamble Not Triggering

**Problem:** Cascade doesn't call the MCP tool

**Solution:**
- The preamble is automatically added by CascadeBridge
- Check if Cascade sees the instruction in the prompt
- Try manually asking Cascade: "Call the jarvis-voice-summary.save tool with test data"

### Fallback: JSON Block

If the MCP tool is unavailable, Cascade will output a JSON block instead:

```json
```VOICE_SUMMARY_JSON
{
  "tldr": "Created hello world application",
  "changes": ["Created hello.py"],
  "risks": [],
  "next_questions": [],
  "apply_safe": true
}
```
```

The extension doesn't parse this fallback yet, but you can add parsing in `MCPWatcher.ts` if needed.

## Configuration Options

### MCP Server Path

If you need to customize the summary file location, modify `python/mcp_server.py`:

```python
@mcp.tool()
def save(
    tldr: str,
    # ... other params
    out_path: str = "C:\\custom\\path\\summary.json",  # Custom path
):
```

Then update `MCPWatcher.ts` constructor to match:

```typescript
this.summaryPath = path.join('C:', 'custom', 'path', 'summary.json');
```

### Disable MCP Preamble

If you want to test without MCP, temporarily disable in `CascadeBridge.ts`:

```typescript
async sendPrompt(prompt: string): Promise<void> {
    // Comment out this line to disable MCP preamble
    // const fullPrompt = this.constructPromptWithMCP(prompt);
    const fullPrompt = prompt;  // Use original prompt
    // ...
}
```

## Next Steps

Once MCP integration is working:

1. **Add more tools:** Tests, linter, file search, etc.
2. **Stream progress:** Send intermediate updates during long tasks
3. **Error handling:** Announce failures and ask for clarification
4. **Multi-turn conversations:** Context-aware follow-ups

## Files Modified

- ✅ `python/mcp_server.py` - MCP server implementation
- ✅ `src/mcp/MCPWatcher.ts` - File watcher for responses
- ✅ `src/cascade/CascadeBridge.ts` - Adds MCP preamble to prompts
- ✅ `src/voice/VoiceService.ts` - Announces completions via TTS
- ✅ `python/voice_service.py` - Handles 'announce' command
- ✅ `src/extension.ts` - Wires MCP → Voice Service

## Documentation

- Architecture: See `ARCHITECTURE.md` Layer 3
- Voice Integration: See `M1_INTEGRATION_COMPLETE.md`
- MCP Protocol: See `Windsurf_MCP_Voice_Summary_Guide.md`
