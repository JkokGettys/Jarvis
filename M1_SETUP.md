# M1 Setup Guide

**Status:** 🚧 In Progress  
**Updated:** November 1, 2025

---

## What You're Installing

**A full conversational AI assistant** that speaks to you with a British accent and uses Cascade as one of its tools:

- **Wake word detection** ("Hey Jarvis") via openWakeWord
- **Speech-to-text** via Faster-Whisper (GPU-accelerated)
- **Conversational AI** via local LLM (gpt-oss:20b)
- **Text-to-speech** via Kokoro TTS (British voice)
- **Cascade integration** via MCP (Model Context Protocol)
- **Natural conversation loop** - Jarvis talks back!

**Everything runs locally** - no API keys, no cloud services, no subscriptions!

---

## Prerequisites

- ✅ **Windows OS** with Python 3.8+ installed
- ✅ **CUDA Toolkit 11.8+** for GPU acceleration (RTX 5090)
- ✅ **Ollama** running with `gpt-oss:20b` model
- ✅ **No API keys required!** (openWakeWord is free)

---

## Step 1: Create Python Environment

### 1.1 Create Virtual Environment

```powershell
cd c:\DevMode\Jarvis\python
python -m venv venv
```

### 1.2 Activate Environment

```powershell
.\venv\Scripts\activate
```

### 1.3 Install Dependencies

```powershell
pip install -r requirements.txt
```

**Installing:**
- `faster-whisper==1.0.3` - GPU-accelerated Whisper STT
- `openwakeword==0.6.0` - Free, open-source hotword detection
- `kokoro-onnx` - Local neural TTS with British voices
- `mcp` or `fastmcp` - MCP server for Cascade responses
- `webrtcvad==2.0.10` - Voice activity detection
- `pyaudio==0.2.14` - Microphone access
- `numpy==1.24.3` - Array processing

**Note:** If PyAudio fails, download the wheel from:  
https://www.lfd.uci.edu/~gohlke/pythonlibs/#pyaudio

---

## Step 2: Verify CUDA Installation

Faster-Whisper requires CUDA for GPU acceleration:

```powershell
nvcc --version
# Should show CUDA 11.8 or higher
```

**If CUDA not installed:**
1. Download from https://developer.nvidia.com/cuda-downloads
2. Install CUDA Toolkit 11.8 or 12.x
3. Restart your PC

---

## Step 3: Setup MCP Server

Create the MCP server to receive Cascade responses:

```powershell
cd c:\DevMode\Jarvis\python
.\venv\Scripts\activate

# Install MCP SDK
pip install mcp fastmcp
```

**Create MCP server** (`mcp_server.py`):
```python
from mcp.server.fastmcp import FastMCP
import json, os

mcp = FastMCP("jarvis-voice")

@mcp.tool()
def save(
    tldr: str,
    changes: list[str] = [],
    risks: list[str] = [],
    next_questions: list[str] = [],
    apply_safe: bool = False,
    out_path: str = os.path.expanduser("~/.windsurf/jarvis_summary.json"),
) -> str:
    """Save Cascade response summary for Jarvis to speak."""
    payload = {
        "tldr": tldr,
        "changes": changes,
        "risks": risks,
        "next_questions": next_questions,
        "apply_safe": apply_safe
    }
    os.makedirs(os.path.dirname(out_path), exist_ok=True)
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(payload, f, ensure_ascii=False)
    return f"saved:{out_path}"

if __name__ == "__main__":
    mcp.run()
```

**Register in Windsurf:**
1. Open Windsurf Settings → Cascade → MCP
2. Add server: `python c:\DevMode\Jarvis\python\venv\Scripts\python.exe c:\DevMode\Jarvis\python\mcp_server.py`

---

## Step 4: Configure VSCode Settings

Open VSCode Settings (Ctrl+,) and search for "Jarvis":

### Optional Settings

**jarvis.voice.enabled**
- Default: `true`
- Set to `false` to disable voice input

**jarvis.voice.wakeword**
- Options: `hey_jarvis`, `alexa`, `hey_mycroft`
- Default: `hey_jarvis`
- Free pre-trained models from openWakeWord

### Performance Tuning

**jarvis.voice.whisperModel**
- Options: `tiny`, `base`, `small`, `medium`, `large-v3`
- Default: `medium`
- Use `small` if latency too high, `large-v3` for best accuracy

**jarvis.voice.vadSensitivity**
- Range: 0-3 (0=loose, 3=strict)
- Default: `2`
- Increase if too many false triggers

**jarvis.voice.silenceTimeout**
- Milliseconds of silence before finalizing transcription
- Default: `1500` (1.5 seconds)
- Range: 500-5000

---

## Step 5: Build Extension

```powershell
cd c:\DevMode\Jarvis
npm install
npm run compile
```

---

## Step 6: Test Python Voice Service (Optional)

Test independently before full integration:

```powershell
cd c:\DevMode\Jarvis\python
.\venv\Scripts\activate

# Set environment
$env:WHISPER_MODEL="medium"
$env:VAD_SENSITIVITY="2"
$env:SILENCE_TIMEOUT="1.5"
$env:WAKEWORD_MODEL="hey_jarvis"

# Run service
python voice_service.py
```

**Expected output:**
```json
{"type": "initialized"}
{"type": "audio_stream_started"}
{"type": "ready"}
```

**Say "Hey Jarvis" then speak:**
```json
{"type": "hotword_detected"}
{"type": "listening"}
{"type": "transcription", "text": "your speech here"}
{"type": "silence"}
```

Press Ctrl+C to exit.

---

## Step 7: Test Full Voice-to-Voice Loop

### 6.1 Launch Extension

1. Press **F5** to launch Extension Development Host
2. Open Command Palette (**Ctrl+Shift+P**)
3. Run: **`Jarvis: Start Listening`**
4. Check Debug Console for logs

### 6.2 Test Wake Word

**Say:** "Hey Jarvis"

**Expected:**
- Status bar changes to `[*] Jarvis Listening`
- Debug console shows: `[VoiceService] Hotword detected!`

### 6.3 Test Transcription

**Say:** "Hey Jarvis, create a hello world function"

**Expected:**
- Voice transcribed in Debug Console
- Intent classified as "actionable"
- Cascade activates with structured prompt
- Code created!

---

## Verification Checklist

### ✅ Basic Functionality
- [ ] Extension loads without errors
- [ ] Status bar shows `[ ] Jarvis Ready`
- [ ] Python service starts (check Debug Console)
- [ ] "Hey Jarvis" triggers hotword detection
- [ ] Speech is transcribed accurately

### ✅ Intent Classification
- [ ] **Thinking:** "I'm working on the login page" → No Cascade trigger
- [ ] **Actionable:** "Create a hello world function" → Cascade activates

### ✅ Multi-turn Conversation
Say in sequence:
1. "Hey Jarvis, I'm refactoring the auth module"
2. "Hey Jarvis, the password validation is broken"
3. "Hey Jarvis, let's fix that bug"

**Expected:** Step 3 triggers Cascade with full context from all turns

### ✅ Performance
- [ ] Latency < 400ms (speech end → Cascade activation)
- [ ] Transcription accuracy > 90%
- [ ] No false hotword triggers
- [ ] GPU utilized efficiently (check Task Manager)

---

## Troubleshooting

### "Failed to start Python service"
**Check:**
- Python venv exists: `c:\DevMode\Jarvis\python\venv`
- Dependencies installed: `pip list`
- Run Python script manually (Step 5)

### "Microphone not available"
**Fix:**
- Windows Settings → Privacy → Microphone
- Allow desktop apps to access microphone
- Restart VSCode

### "CUDA not found" / Slow performance
**Fix:**
- Install CUDA Toolkit 11.8+
- Check GPU: `nvidia-smi`
- Fallback: Use smaller model (`tiny` or `small`)

### Hotword not detecting
**Try:**
- Speak louder: "Hey Jarvis"
- Reduce background noise
- Try different model: `alexa` or `hey_mycroft`
- Check microphone levels in Windows
- Adjust threshold in `voice_service.py` (currently 0.5)

### False hotword triggers
**Solutions:**
- Normal for wake word detection
- Use mute when not needed: Ctrl+Shift+M
- Increase threshold in code if persistent

### High latency (>1 second)
**Optimize:**
- Use smaller Whisper model (`small`)
- Reduce VAD sensitivity
- Check GPU utilization
- Close other GPU-heavy processes

### Inaccurate transcriptions
**Improve:**
- Use larger model (`large-v3`)
- Speak more clearly
- Reduce background noise
- Check microphone quality

---

## Commands Reference

**VSCode Commands:**
- `Jarvis: Start Listening` (Ctrl+Shift+J) - Start voice service
- `Jarvis: Stop Listening` - Stop voice service
- `Jarvis: Toggle Mute` (Ctrl+Shift+M) - Mute/unmute microphone
- `Jarvis: Send Prompt to Cascade` - Manual text input
- `Jarvis: Test Conversation` - Simulated conversation test

**Status Bar Indicators:**
- `[ ] Jarvis Ready` - Idle, waiting for "Hey Jarvis"
- `[*] Jarvis Listening` - Recording your speech
- `[~] Jarvis Processing` - Transcribing/analyzing
- `[X] Jarvis Muted` - Voice input disabled

---

## What's Next?

Once M1 is working:

**M2: Voice Output (TTS)**
- Windows SAPI for voice responses
- Speak Cascade summaries
- Barge-in support

**M3: Conversation Loop**
- Session persistence
- Follow-up detection
- Privacy controls

**M4: Advanced Features**
- MCP tool integration
- Workspace context
- Auto-attach files to prompts

---

## Quick Start Summary

```powershell
# 1. Setup Python
cd c:\DevMode\Jarvis\python
python -m venv venv
.\venv\Scripts\activate
pip install -r requirements.txt

# 2. Build extension
cd c:\DevMode\Jarvis
npm run compile

# 3. Test
# Press F5 in VSCode
# Say "Hey Jarvis, create a hello world function"
# Watch the magic! 🎤
```

**That's it! No API keys. No registration. Just local voice coding.** ✨
