# Windsurf Rules Setup for Jarvis MCP Integration

## 🎯 Overview

Use Windsurf's new **Rules** system (replaces deprecated custom instructions) to tell Cascade to always call the MCP tool after completing tasks.

---

## 📝 Create the Rule

### Step 1: Open Rules Panel

1. Click the **Customizations icon** (top right slider menu in Cascade)
2. Navigate to **Rules** panel
3. Click **+ Workspace** button (for this project only)
   - Or **+ Global** if you want it for all projects

### Step 2: Configure Rule Settings

**Rule Name:** `Jarvis MCP Integration`

**Activation Mode:** `Always On`
- This ensures the rule applies to every Cascade request

**Rule Content:** (paste below)

```markdown
# Jarvis Voice Integration

## Task Completion Protocol

After completing ANY task, you MUST call the MCP tool to notify Jarvis:

**Tool:** `jarvis-voice-summary.save`

**Required Fields:**
- `tldr` (string): Casual, conversational summary of the OUTCOME (10-15 words max)
  - Sound like a colleague giving an update, not a formal report
  - Use conversational particles: "Ok,", "Alright,", "Done,"
  - Should NOT duplicate any of the changes array items
  - Good: "Ok, the project foundation is set up"
  - Good: "The old test file is gone"
- `changes` (array): Specific actions in first person ("I...")
  - Should complement the tldr, not repeat it
  - Good examples: "I created the main script file", "I added the greeting logic"
  - Bad examples: "hello.py: deleted", "Updated config.json"
- `risks` (array): Potential issues or caveats in natural language (empty array if none)
- `next_questions` (array): Follow-up questions for the user (empty array if none)
- `apply_safe` (boolean): `true` if changes are safe to auto-apply without review

**Example Call:**
```python
jarvis-voice-summary.save({
  tldr: "Ok, the hello world application is ready",
  changes: [
    "I created the main script file",
    "I added the greeting logic"
  ],
  risks: [],
  next_questions: ["Would you like me to run it?"],
  apply_safe: true
})
```

**Fallback (if MCP unavailable):**

If the `jarvis-voice-summary` MCP server is not found, output the same data as a JSON fenced block at the very bottom of your response:

```VOICE_SUMMARY_JSON
{
  "tldr": "your summary here",
  "changes": ["file: action"],
  "risks": [],
  "next_questions": [],
  "apply_safe": true
}
```

## Guidelines

- Keep `tldr` conversational for voice (not technical jargon)
- Don't explain the tool call to the user in your visible response
- Always call this at the END of task completion, not during
- If no changes made, you can skip the call
```

### Step 3: Save

Click **Save** or **Create Rule**

---

## ✅ Verify Rule is Active

### Check in Rules Panel

1. Open Customizations → Rules
2. You should see "Jarvis MCP Integration" with status: **Always On**

### Test with Cascade

1. Open Cascade (Ctrl+L)
2. Type: `Create a simple Python hello world script`
3. After completion, check if Cascade:
   - ✅ Calls `jarvis-voice-summary.save()` OR
   - ✅ Outputs `VOICE_SUMMARY_JSON` block

---

## 🔧 MCP Server Configuration

The rule tells Cascade WHAT to do. You also need to configure the MCP server so Cascade knows HOW to do it.

### Add MCP Server

**Location:** File → Preferences → Settings → Search "MCP"

**Configuration:**
```json
{
  "name": "jarvis-voice-summary",
  "command": "c:\\DevMode\\Jarvis\\python\\venv\\Scripts\\python.exe",
  "args": ["c:\\DevMode\\Jarvis\\python\\mcp_server.py"],
  "cwd": "c:\\DevMode\\Jarvis\\python"
}
```

**Restart Windsurf** after adding the server.

---

## 🧪 End-to-End Test

Once both are configured:

1. **Start Jarvis voice service:**
   ```
   Ctrl+Shift+J
   ```

2. **Say or type to Jarvis:**
   ```
   "Create a hello world application"
   ```

3. **Expected flow:**
   - Jarvis responds: "Right, I'll get that started"
   - Cascade creates the code
   - Cascade calls MCP tool (because of the rule)
   - MCP server saves JSON
   - Jarvis announces: "I've created your hello world application" 🎉

---

## 📊 Rule vs Custom Instructions Comparison

| Feature | Custom Instructions (Old) | Rules (New) |
|---------|---------------------------|-------------|
| Persistence | Global only | Global + workspace-level |
| Organization | Single file | Multiple organized files |
| Activation | Always on | Manual, Always On, Model Decision, Glob |
| Discovery | Manual | Automatic (workspace + git hierarchy) |
| Character limit | Unknown | 12,000 per rule |
| Best for | Simple global preferences | Project-specific behavior |

---

## 🐛 Troubleshooting

### Rule Not Applying

**Check:**
- Rule activation mode is "Always On"
- Rule is saved and visible in Rules panel
- Windsurf restarted after creating rule

**Debug:**
Ask Cascade: `What rules are currently active?`

### MCP Tool Not Found

**Error:** `"MCP server jarvis-voice-summary not found"`

**Solution:**
1. Verify MCP server is configured (Settings → MCP)
2. Check Python path is correct
3. Restart Windsurf after adding MCP server
4. Fallback will work: Cascade outputs JSON block instead

### Fallback JSON Block Works, MCP Tool Doesn't

**This is OK!** The extension can parse the JSON block too.

**To enable MCP tool:**
- Configure the MCP server in settings
- Restart Windsurf
- The rule already tells Cascade to try the tool first

---

## 🎯 Activation Modes Explained

For reference, here are the 4 activation modes available:

### 1. Always On (What We Use)
- Rule applies to every Cascade request
- Perfect for project-wide conventions

### 2. Manual
- Activate via @mention in Cascade
- Example: `@jarvis-integration create an app`
- Good for optional rules

### 3. Model Decision
- Based on natural language description
- Cascade decides if rule is relevant
- Example: "Apply when user is working with Python files"

### 4. Glob Pattern
- Applies to files matching pattern
- Example: `src/**/*.ts` for TypeScript files
- Good for language-specific rules

**For our use case, "Always On" is correct** because we want MCP integration for ALL Jarvis-initiated tasks.

---

## 📝 Rule Best Practices (from Windsurf docs)

✅ **Do:**
- Keep rules simple and concise
- Use bullet points and markdown formatting
- Be specific about requirements
- Use XML tags to group related rules

❌ **Don't:**
- Write long paragraphs
- Add generic rules ("write good code")
- Exceed 12,000 characters
- Make rules vague or ambiguous

Our rule follows these practices! ✅

---

## 🔄 Updating the Rule

If you need to modify the rule later:

1. Customizations → Rules
2. Find "Jarvis MCP Integration"
3. Click to edit
4. Update content
5. Save
6. Changes apply immediately (no restart needed)

---

## 🚀 Additional Rules You Could Add

Once this is working, consider these optional workspace rules:

### Python Coding Standards
```markdown
# Python Best Practices
- Use type hints for function signatures
- Add docstrings to all classes and functions
- Follow PEP 8 style guidelines
```

### TypeScript Standards
```markdown
# TypeScript Best Practices  
- Use explicit types, avoid `any`
- Add JSDoc comments for public APIs
- Use `const` over `let` when possible
```

**Activation:** Glob pattern (`*.py` for Python, `*.ts` for TypeScript)

---

## 📚 References

- **Windsurf Rules Docs:** https://docs.windsurf.com/rules
- **Rule Templates:** https://windsurf.com/editor/directory
- **MCP Protocol:** https://modelcontextprotocol.io/

---

## Summary

1. ✅ Create workspace rule "Jarvis MCP Integration" with "Always On" mode
2. ✅ Configure MCP server in Windsurf settings
3. ✅ Restart Windsurf
4. ✅ Test end-to-end with voice command
5. ✅ Jarvis announces completions! 🎉

The Rules system is much better than custom instructions - cleaner, more organized, and project-specific!
