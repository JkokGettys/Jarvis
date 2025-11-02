# Installation Guide - Jarvis Voice Assistant

Complete this in order. Each step tells you what to run and what you should see.

---

## Step 1: Install Ollama

**Run:**
```powershell
winget install Ollama.Ollama
```

**What you'll see:**
- Download progress
- "Successfully installed"

**Verify:**
```powershell
ollama --version
```

**Expected:** Version number (e.g., `ollama version is 0.x.x`)

**If it fails:** Download manually from https://ollama.com/download

---

## Step 2: Pull gpt-oss-20b Model

**Run:**
```powershell
ollama pull gpt-oss:20b
```

**What you'll see:**
- Multiple layers downloading (progress bars)
- "pulling manifest"
- "success"

**Size:** ~12-16 GB download

**Time:** 5-20 minutes depending on internet speed

**Note:** Ollama server starts automatically after install

---

## Step 3: Verify Ollama is Running

**Run:**
```powershell
ollama list
```

**Expected:** You should see `gpt-oss-20b` in the list

**Test the model:**
```powershell
ollama run gpt-oss-20b
```

**You'll see:** A prompt `>>>` 

**Type:** `Hello` and press Enter

**Expected:** Model responds with a greeting

**Exit:** Type `/bye` to exit

**✅ Checkpoint:** Ollama is working with gpt-oss-20b

---

## Step 4: Install Node.js (if not already installed)

**Check if installed:**
```powershell
node --version
```

**If you see a version number:** Skip to Step 5

**If not installed, run:**
```powershell
winget install OpenJS.NodeJS.LTS
```

**After install, close and reopen your terminal**

**Verify:**
```powershell
node --version
npm --version
```

**Expected:** Both show version numbers

---

## Step 5: Install Jarvis Dependencies

**Navigate to project:**
```powershell
cd c:\DevMode\Jarvis
```

**Install:**
```powershell
npm install
```

**What you'll see:**
- Packages being added
- Progress bars
- "added 337 packages"

**Time:** 30-60 seconds

**Expected:** No errors (warnings are OK)

---

## Step 6: Compile TypeScript

**Run:**
```powershell
npm run compile
```

**What you'll see:**
- Brief pause
- Returns to prompt with no errors

**Verify:**
```powershell
dir out
```

**Expected:** You should see folders and .js files

**✅ Checkpoint:** Extension code is compiled

---

## Step 7: Open Project in Windsurf

1. Open Windsurf
2. File → Open Folder
3. Select `c:\DevMode\Jarvis`
4. Wait for folder to load

**✅ Checkpoint:** Project is open in Windsurf

---

## Step 8: Test the Extension

**In Windsurf:**
1. Press `F5` (or click Run → Start Debugging)
2. A new "Extension Development Host" window opens

**What you'll see in new window:**
- Status bar shows: `[Jarvis: Local LLM connected]` (if Ollama running)
- Status bar bottom-right: `[ ] Jarvis Ready`

**If you see warning instead:**
- "Jarvis: Local LLM not available"
- **Fix:** Make sure Ollama is running (it should auto-start)
- Run `ollama serve` in terminal if needed

**✅ Checkpoint:** Extension is loaded and LLM connected

---

## Step 9: Test Manual Prompt

**In the Extension Development Host window:**

1. Press `Ctrl+Shift+P` (Command Palette)
2. Type: `Jarvis`
3. Select: `Jarvis: Send Prompt to Cascade`
4. Enter a test prompt: `list all files in this project`
5. Press Enter

**What you'll see:**
- Status changes to `[~] Jarvis Processing`
- Placeholder message: "Would send to Cascade: ..."
- (M0 spike - actual Cascade integration not yet implemented)

**✅ Checkpoint:** Extension commands work

---

## Step 10: Verify Status Bar

**Look at bottom-right of Extension Development Host:**

Should see: `[ ] Jarvis Ready` (clickable)

**Click it** → Should toggle listening mode (placeholder for now)

**Keyboard shortcuts:**
- `Ctrl+Shift+J` → Toggle listening
- `Ctrl+Shift+M` → Toggle mute

---

## ✅ Installation Complete!

**What's working:**
- ✅ Local LLM (gpt-oss-20b) running
- ✅ Extension compiled and loaded
- ✅ Commands registered
- ✅ Status bar active

**What's NOT working yet (expected):**
- ❌ Cascade bridge (M0 - needs implementation)
- ❌ Voice input (M1 - not yet set up)
- ❌ Voice output (M2 - not yet set up)

---

## Optional: Install Python for Voice (Later)

**When you're ready for M1/M2, install Python:**

```powershell
winget install Python.Python.3.12
```

**Close and reopen terminal, then:**

```powershell
pip install faster-whisper
pip install kokoro-tts
pip install torch --index-url https://download.pytorch.org/whl/cu124
```

**Note:** Don't do this yet - wait until you're working on voice features

---

## Troubleshooting

### "Cannot find Ollama"
```powershell
# Restart Ollama service
ollama serve
```

### "Extension doesn't load"
1. Check Output panel in Windsurf
2. Look for errors
3. Try: Close window, run `npm run compile`, press F5 again

### "Local LLM not connected"
1. Verify Ollama is running: `ollama list`
2. Check endpoint in settings: Should be `http://localhost:11434`
3. Test manually: `ollama run gpt-oss-20b`

### "Command not found: jarvis"
1. Press `Ctrl+Shift+P`
2. Type: `Reload Window`
3. Try F5 again

---

## Next Steps

1. **Read:** `README.md` for full features
2. **Work on M0:** Implement Cascade bridge in `src/cascade/CascadeBridge.ts`
3. **Check:** `ProjectScope.md` for milestone details

---

## Configuration (Optional)

**To change models or settings:**

1. In Windsurf: `File → Preferences → Settings`
2. Search: `Jarvis`
3. Adjust:
   - `jarvis.llm.model` (default: `gpt-oss-20b`)
   - `jarvis.llm.endpoint` (default: `http://localhost:11434`)
   - Other settings as needed

**After changes:** Reload extension (Ctrl+R in Extension Development Host)

---

**Installation should take:** 20-30 minutes total (mostly download time)
