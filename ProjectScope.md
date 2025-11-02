# Project Scope

Voice-to-voice conversational AI assistant (Jarvis) for Windsurf IDE.

## Goal

Create a conversational AI that:
- Continuously listens and speaks (British accent)
- Maintains natural dialogue and context
- Uses Cascade as a tool for code changes
- Captures responses via MCP
- Runs entirely locally (except Cascade)

**Jarvis is the interface, Cascade is a tool.**

---

## Milestones

### M0: Cascade Bridge
**Status:** ✅ Complete

- Keyboard automation (Ctrl+L → paste → Enter)
- Windows clipboard integration
- Local LLM prompt enhancement
- Working Cascade integration

### M1: Voice Input & Conversation
**Status:** ✅ Complete

**Implemented:**
- openWakeWord hotword detection ("Hey Jarvis")
- Faster-Whisper GPU-accelerated STT (<200ms)
- GPT-OSS conversational AI (gpt-oss:20b)
- Kokoro TTS with British accent
- Energy-based VAD for speech detection
- Unified LLM with [ANSWER]/[INSTRUCTION] format
- Context-aware conversation (8-turn history)
- Auto-reset after 2 minutes of inactivity

**Deliverable:** ✅ Natural voice conversation with instant responses

### M2: MCP Integration & Bidirectional Communication
**Status:** ✅ Complete

**Implemented:**
- FastMCP server with voiceSummary.save() tool
- File system watcher for Cascade responses
- Structured voice announcements (tldr + changes + notes + risks + questions)
- Smart reporting (first 3 items, then count for >3)
- Follow-up question handling ("Yeah, please do" works)
- Context preservation across Cascade tasks
- MCP announcements added to conversation history

**Deliverable:** ✅ Full bidirectional voice loop with Cascade

### M3: Advanced Features
**Status:** Planned

- Additional MCP tools (test runner, linter)
- Workspace context injection
- Auto-attach relevant files
- Barge-in support

### M4: Packaging
**Status:** Planned

- VSIX packaging
- Settings UI
- Documentation
- Distribution

---

## Technical Stack

### Hardware
- GPU: RTX 5090 (CUDA 11.8+)
- OS: Windows

### Core Technologies
- **Voice Input:** openWakeWord + Faster-Whisper (GPU)
- **Voice Output:** Kokoro TTS (British accent)
- **Conversational AI:** GPT-OSS (gpt-oss:20b via Ollama)
- **Cascade Bridge:** Keyboard automation (M0)
- **Response Capture:** MCP (Model Context Protocol)

### Architecture
- Layer 1: Fast conversational interface (<500ms response)
- Layer 2: Smart analysis engine (background, non-blocking)
- Layer 3: Async tool execution (Cascade via MCP)

See `ARCHITECTURE.md` for detailed technical architecture.

---

## Success Criteria

### M1 Acceptance (✅ Achieved)
- ✅ Response time <500ms (Layer 1)
- ✅ Conversation continues during Cascade execution
- ✅ Intent detection working (unified [ANSWER]/[INSTRUCTION] format)
- ✅ Natural conversation flow
- ✅ MCP response capture working

### M2 Acceptance (✅ Achieved)
- ✅ Cascade responses announced via voice
- ✅ Structured summaries (tldr, changes, notes, risks, questions)
- ✅ Follow-up questions handled correctly
- ✅ Context preserved across tasks
- ✅ Smart reporting (first 3, then count)

### Long-term Goals
- <400ms end-to-end latency (currently ~500ms)
- One-hour coding session with minimal keyboard use
- Prefer voice over typing for feature ideation
- Barge-in support for interrupting Jarvis