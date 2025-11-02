# Jarvis - Voice-to-Voice AI Assistant for Windsurf

**A fully conversational, hands-free AI assistant for Windsurf's Cascade agent.** Speak naturally to Jarvis in continuous conversation - he responds instantly, invokes Cascade for code changes, and announces results when complete. All while you keep talking!

## Features

### 🎤 Voice Conversation
- **Continuous listening**: Always ready, no push-to-talk needed
- **Instant responses**: <500ms voice-to-voice latency
- **Natural dialogue**: Maintains context across multiple turns
- **British accent**: Kokoro TTS with natural prosody
- **Conversation during work**: Keep talking while Cascade executes tasks

### 🤖 Smart AI Integration
- **Dual-layer LLM**: Fast conversational responses + deep analysis
- **Intent detection**: Knows when to invoke Cascade vs just chat
- **Context awareness**: Remembers what you're working on
- **Follow-up handling**: "Yeah, please do" after questions works correctly
- **MCP integration**: Structured responses from Cascade

### 🔒 Privacy & Performance
- **100% local processing**: Everything except Cascade runs on your machine
- **GPU accelerated**: RTX 5090 for real-time STT/TTS
- **No API costs**: Zero marginal cost per conversation
- **Offline capable**: Works without internet (except Cascade execution)

## Project Status

- [x] **M0 - Cascade Bridge**: Keyboard automation ✅
- [x] **M1 - Voice Input**: Full conversational AI ✅
  - openWakeWord hotword detection ("Hey Jarvis")
  - Faster-Whisper STT (GPU-accelerated)
  - GPT-OSS conversational AI (gpt-oss:20b)
  - Kokoro TTS (British accent)
  - Unified LLM with [ANSWER]/[INSTRUCTION] format
- [x] **M2 - MCP Integration**: Bidirectional communication ✅
  - MCP server for Cascade responses
  - Structured voice announcements
  - Smart change/notes reporting (first 3, then count)
  - Follow-up question handling
  - Context preservation across tasks
- [ ] **M3 - Advanced Features**: Planned 📋
  - Barge-in support
  - Multi-language
  - Additional MCP tools
- [ ] **M4 - Packaging**: Planned 📋

**🎉 Jarvis can now hold full voice conversations, invoke Cascade, and announce results - all while maintaining natural dialogue!**

## Architecture

**Three-layer reactive system:**

```
┌─────────────────────────────────────────────┐
│  TypeScript Extension (Windsurf)            │
│  ├── VoiceService.ts    (Process manager)   │
│  ├── CascadeBridge.ts   (Keyboard automation)│
│  ├── MCPWatcher.ts      (Response monitor)  │
│  └── StatusBarManager.ts (UI indicators)    │
└─────────────────┬───────────────────────────┘
                  │ IPC (JSON over stdio)
┌─────────────────▼───────────────────────────┐
│  Python Voice Service (Local GPU)           │
│  ├── openWakeWord       (Hotword)           │
│  ├── Faster-Whisper     (STT)               │
│  ├── GPT-OSS            (Conversation AI)   │
│  ├── Kokoro TTS         (British voice)     │
│  └── Energy-based VAD   (Speech detection)  │
└─────────────────┬───────────────────────────┘
                  │ MCP Protocol
┌─────────────────▼───────────────────────────┐
│  MCP Server (FastMCP)                       │
│  └── voiceSummary.save() tool              │
│      (Cascade → Jarvis responses)           │
└─────────────────────────────────────────────┘
```

**See `ARCHITECTURE.md` for detailed technical design.**

## Prerequisites

### Required

- **Node.js** (v18 or higher)
- **npm** or **yarn**
- **Windsurf IDE** (VS Code fork with Cascade)
- **Local LLM** (for intent classification and chatting - NO API calls)
  - **gpt-oss-20b** via Ollama (recommended - OpenAI's 2025 reasoning model)
  - OR **Qwen3-Coder** for coding-focused tasks
  - OR **Llama 3.1** (older but proven)

### For Voice Features (Required for M1+)

- **Python 3.8+** (for voice processing services)
- **Faster-Whisper** (GPU-accelerated STT)
- **Kokoro ONNX** (Neural TTS with British accent)
- **openWakeWord** (Wake word detection)
- **sounddevice** (Audio I/O)

### GPU Acceleration

- **RTX 5090** - Perfect for:
  - Local LLM inference (8B parameter models)
  - Faster-Whisper transcription
  - Real-time voice processing

## Installation

### 1. Install Local LLM (Required)

**Ollama with gpt-oss:20b (OpenAI's 2025 Open Source Model)**
```powershell
# Install Ollama
winget install Ollama.Ollama

# Pull gpt-oss:20b (20B params, optimized for reasoning)
ollama pull gpt-oss:20b

# Server starts automatically at http://localhost:11434
```

**Why gpt-oss:20b?**
- OpenAI's open source reasoning model (Apache 2.0)
- Excellent at conversational AI and intent detection
- Fast inference on RTX 5090
- Natural dialogue generation
- Handles [ANSWER]/[INSTRUCTION] format perfectly

### 2. Install Node Dependencies

```bash
cd c:\DevMode\Jarvis
npm install
```

### 3. Compile the Extension

```bash
npm run compile
```

### 4. Install Python Voice Services

```powershell
cd c:\DevMode\Jarvis\python
pip install -r requirements.txt
```

This installs:
- `faster-whisper` - GPU-accelerated STT
- `kokoro-onnx` - Neural TTS
- `openwakeword` - Wake word detection
- `sounddevice` - Audio I/O
- `fastmcp` - MCP server

### 5. Download Kokoro Models

Place these files in `c:\DevMode\Jarvis\python\`:
- `kokoro-v1.0.onnx` (TTS model)
- `voices-v1.0.bin` (Voice data)

Download from: https://github.com/thewh1teagle/kokoro-onnx

### 6. Configure Windsurf for MCP

Add to `.windsurf/settings.json`:
```json
{
  "mcp.servers": {
    "jarvis-voice-summary": {
      "command": "python",
      "args": ["c:\\DevMode\\Jarvis\\python\\mcp_server.py"]
    }
  }
}
```

### 7. Add Cascade Custom Instructions

Copy contents of `MCP_RULE_CONTENT.txt` to Cascade's custom instructions in Windsurf settings.

### 8. Run in Development Mode

Press `F5` in Windsurf to launch the extension in a new Extension Development Host window.

## Usage

### Starting Jarvis

1. Open Command Palette (`Ctrl+Shift+P`)
2. Run: **"Jarvis: Start Voice Service"**
3. Wait for "Ready" status in status bar
4. Start talking! (or say "Hey Jarvis" if using wake word)

### Commands

- **Jarvis: Start Voice Service** - Start continuous voice conversation
- **Jarvis: Stop Voice Service** - Stop voice service
- **Jarvis: Toggle Mute** - Mute/unmute microphone
- **Jarvis: Reset Context** - Clear conversation history
- **Jarvis: View MCP Summary** - See last Cascade response
- **Jarvis: Test Continuous Mode** - Test voice without Cascade

### Example Conversations

**Simple request:**
```
You: "Create a hello world Python script"
Jarvis: "Right, I'll get that started."
[Cascade creates the file]
Jarvis: "Done. I created the main script file."
```

**Analysis + follow-up:**
```
You: "What does the sidebar component do?"
Jarvis: "I'll analyze that for you."
[Cascade analyzes]
Jarvis: "Here's what the sidebar does. Navigation sidebar with football sections, hidden on mobile, and includes an injury widget. Would you like me to make it functional with routing?"
You: "Yeah, please do."
Jarvis: "Right, I'll add that now."
[Cascade implements routing]
Jarvis: "Done. I added the routing logic, I updated the navigation, and I connected the state management."
```

## Configuration

Access settings via `File > Preferences > Settings` and search for "Jarvis".

Key settings:
- `jarvis.llm.model`: Local LLM model (default: `gpt-oss-20b`)
- `jarvis.llm.endpoint`: Local LLM server URL
- `jarvis.stt.provider`: STT model (whisper-v3-turbo, canary-qwen, parakeet)
- `jarvis.tts.provider`: TTS engine (os-default, kokoro)
- `jarvis.editorialStyle`: Summary verbosity (terse, conversational, ops)
- `jarvis.wakeword.phrase`: Wake phrase (default: "hey jarvis")
- `jarvis.secureMode`: Push-to-talk only (no continuous listening)
- `jarvis.privacy.localOnly`: All processing stays local (required)

## Development

### Build

```bash
npm run compile
```

### Watch Mode

```bash
npm run watch
```

### Lint

```bash
npm run lint
```

### Package as VSIX

```bash
npm run package
```

## Documentation

- **`README.md`** - This file (project overview)
- **`ProjectScope.md`** - Goals, milestones, tech stack
- **`ARCHITECTURE.md`** - Technical architecture (3-layer reactive system)
- **`M1_PLAN.md`** - Current implementation plan (phased approach)
- **`M1_SETUP.md`** - Setup guide for M1 components
- **`Windsurf_MCP_Voice_Summary_Guide.md`** - MCP integration guide

## Contributing

This is a personal project following the architecture outlined in ProjectScope.md. If you're working on this:

1. Follow the milestone order (M0 → M1 → M2 → M3 → M4 → M5)
2. Keep TODOs marked with the milestone number
3. Test each integration point before moving forward

## Privacy & Security

**ALL processing is local except Cascade agent:**

- ✅ **Voice transcription** (Faster-Whisper) - Local on RTX 5090
- ✅ **Intent classification** (Local LLM) - Local on RTX 5090
- ✅ **Chatting layer** (Local LLM) - Local on RTX 5090
- ✅ **Prompt composition** (Local LLM) - Local on RTX 5090
- ✅ **Response summarization** (Local LLM) - Local on RTX 5090
- ✅ **Voice synthesis** (OS TTS) - Local on Windows
- ⚠️ **Cascade agent** (Windsurf) - Uses Windsurf credits (acceptable)

**Benefits:**
- Zero marginal cost per use (after setup)
- Complete privacy - voice never leaves machine
- No API rate limits
- Works offline (except Cascade execution)
- Secure mode available for push-to-talk only

## License

MIT (or your preferred license)

## Roadmap

See ProjectScope.md for detailed milestone breakdown and technical design.
