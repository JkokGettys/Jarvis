# Jarvis Voice Assistant - Architecture

**Type:** Multi-layered reactive  
**Updated:** November 1, 2025

## Implementation Status

### ✅ Completed (M0, M1, M2)
- **M0:** Cascade bridge (keyboard automation)
- **M0:** Local LLM integration (gpt-oss:20b via Ollama)
- **M1:** Continuous voice conversation (openWakeWord + Faster-Whisper + Kokoro)
- **M1:** Unified LLM with [ANSWER]/[INSTRUCTION] format
- **M1:** Context-aware dialogue (8-turn history, auto-reset)
- **M2:** MCP server with voiceSummary.save() tool
- **M2:** Structured voice announcements (tldr, changes, notes, risks, questions)
- **M2:** Follow-up question handling
- **M2:** Smart reporting (first 3, then count)

### 📋 Planned (M3+)
- Barge-in support
- Multi-language
- Additional MCP tools
- Workspace context injection

---

## Core Principle

**The conversation layer must NEVER block.**

Users expect instant voice responses. Waiting for analysis or tool execution creates awkward pauses. The solution: **separate fast conversational layer from slow analysis/execution layers**.

---

## Three Independent Layers

### Layer 1: Fast Conversational Interface (Foreground)
**Always responsive, never blocks**

**Purpose:** Provide instant voice responses like a human would.

**Components:**
- **Wake Word Detection:** openWakeWord ("Hey Jarvis")
- **Speech-to-Text:** Faster-Whisper (GPU-accelerated, <200ms)
- **Quick Responder:** Pattern-based fast responses
- **Text-to-Speech:** Kokoro TTS (British accent, <200ms to first audio)
- **Transcript Streaming:** Sends conversation to Layer 2

**Response Time:** <500ms total (STT + response + TTS start)

**Examples:**
- User: "I'm working on auth" → Jarvis: "Understood." (instant)
- User: "Fix the bug" → Jarvis: "I'll work on that." (instant)
- User: "How's it going?" → Jarvis: "Almost done." (instant)

---

### Layer 2: Smart Analysis Engine (Background)
**Analyzes conversation stream, invokes tools when needed**

**Purpose:** Deep understanding and tool invocation decisions.

**Components:**
- **Transcript Stream:** Rolling window of conversation
- **Context Builder:** Tracks multi-turn context
- **Intent Classifier:** Detects tool invocation needs (GPT-OSS)
- **Prompt Composer:** Formats tool requests
- **Tool Invoker:** Fires tools asynchronously

**Processing Time:** Can take seconds (runs in background, doesn't block)

**Flow:**
```
Transcripts arrive →
GPT-OSS analyzes →
Detects: "User wants code change" →
PromptComposer formats Cascade prompt →
CascadeBridge fires async →
Returns immediately (doesn't wait)
```

---

### Layer 3: Tool Execution (Background)
**Executes tasks, calls back when complete**

**Purpose:** Run long-running operations without blocking conversation.

**Components:**
- **Cascade Bridge:** Sends prompts to Cascade (keyboard automation)
- **MCP Server:** Receives structured responses from Cascade
- **Response Watcher:** Monitors for tool completion
- **Result Announcer:** Queues announcements back to Layer 1

**Execution Time:** Seconds to minutes (async, non-blocking)

**Flow:**
```
Cascade works (user can keep talking!) →
Finishes, calls MCP voiceSummary.save() →
MCP server saves structured JSON →
Response watcher detects →
Announces results via Layer 1
```

---

## Communication Flow

```
┌────────────────────────────────────────────┐
│  LAYER 1: CONVERSATIONAL INTERFACE         │
│  (Foreground - Always Responsive)          │
│                                            │
│  User speaks → STT → Quick Response → TTS  │
│                                            │
│  ↓ (streams transcripts)                   │
└────────────────┬───────────────────────────┘
                 │
                 ↓
┌────────────────────────────────────────────┐
│  LAYER 2: ANALYSIS ENGINE                  │
│  (Background - Non-blocking)               │
│                                            │
│  Transcript Stream → GPT-OSS Analysis      │
│  → Intent Detection → Tool Invocation?     │
│                                            │
│  ↓ (async tool calls)                      │
└────────────────┬───────────────────────────┘
                 │
                 ↓
┌────────────────────────────────────────────┐
│  LAYER 3: TOOL EXECUTION                   │
│  (Background - Async)                      │
│                                            │
│  Cascade Bridge → Cascade Works            │
│  → MCP Callback → Response Watcher         │
│                                            │
│  ↑ (results bubble back up)                │
└────────────────────────────────────────────┘
```

---

## Example: Fixing Auth Bug

### User: "Hey Jarvis, I'm working on authentication"

**Layer 1 (instant):**
- Wake word detected
- STT: "I'm working on authentication"
- Quick response: "Understood. What would you like to do?"
- TTS speaks (British accent)

**Layer 2 (background):**
- Transcript added to stream
- GPT-OSS: "User mentioned authentication module"
- Stores context
- No tool invocation yet

---

### User: "The password validation is broken"

**Layer 1 (instant):**
- STT: "The password validation is broken"
- Quick response: "I see. What's the issue?"
- TTS speaks

**Layer 2 (background):**
- Transcript added
- GPT-OSS: "Password validation bug in auth module"
- Still building context
- No tool invocation yet

---

### User: "Let's fix it"

**Layer 1 (instant):**
- STT: "Let's fix it"
- Quick response: "I'll get started on that right away!"
- TTS speaks

**Layer 2 (background - TOOL INVOCATION):**
- Transcript added
- GPT-OSS: "USER WANTS CODE CHANGE"
- Context: "Fix password validation bug in authentication module"
- PromptComposer: Formats Cascade prompt
- CascadeBridge: Sends async (non-blocking!)

**Layer 3 (starts working):**
- Cascade receives prompt
- Begins analysis and implementation

---

### User: "How's it going?" (WHILE CASCADE WORKS!)

**Layer 1 (instant - conversation continues!):**
- STT: "How's it going"
- Quick response: "I'm working on it now, should be done shortly."
- TTS speaks

**Layer 2 (background):**
- Status query detected
- Checks Layer 3: Cascade still running
- No new tool invocation

**Layer 3 (still working):**
- Cascade continues execution

---

### User: "Make sure it checks for special characters"

**Layer 1 (instant):**
- STT: "Make sure it checks for special characters"
- Quick response: "Got it, I'll make sure to include that."
- TTS speaks

**Layer 2 (background):**
- Additional requirement detected
- Updates context
- Can influence ongoing Cascade work (if early enough)
- Or queues follow-up task

**Layer 3 (still working):**
- May incorporate requirement if prompt can be updated
- Or queues as follow-up task

---

### [Cascade finishes, calls MCP voiceSummary.save()]

**Layer 3:**
- Cascade completes
- Calls: `voiceSummary.save({ tldr: "Fixed password validation...", changes: [...], ... })`
- MCP server saves JSON to `~/.windsurf/jarvis_summary.json`

**Response Watcher:**
- Detects new summary file
- Parses JSON
- Sends to Layer 1

**Layer 1 (when appropriate - waits for pause):**
- User stops talking
- Jarvis announces: "All done! I've fixed the password validation with proper length and special character checks. I've also added tests to prevent this from happening again. Should I apply the changes?"

---

## Technical Stack

### Layer 1: Fast Conversational Interface

| Component | Technology | Latency |
|-----------|-----------|---------|
| Wake Word | openWakeWord | <50ms |
| STT | Faster-Whisper (GPU) | <200ms |
| Quick Response | Pattern matching | <50ms |
| TTS | Kokoro TTS (British) | <200ms to first audio |
| **Total** | | **<500ms** |

### Layer 2: Smart Analysis Engine

| Component | Technology | Time |
|-----------|-----------|------|
| Transcript Stream | In-memory buffer | Real-time |
| Context Builder | Rolling window | Real-time |
| Intent Classification | GPT-OSS (gpt-oss:20b) | 1-3s |
| Prompt Composition | GPT-OSS or template | 1-2s |
| Tool Invocation | Async fire-and-forget | <100ms |

### Layer 3: Tool Execution

| Component | Technology | Time |
|-----------|-----------|------|
| Cascade Bridge | M0 keyboard automation | <200ms to send |
| Cascade Execution | Windsurf API | 10s - minutes |
| MCP Server | FastMCP (Python) | Real-time |
| Response Watcher | File system watcher | <100ms |

---

## Local vs External Processing

### 100% Local
- Wake word detection (openWakeWord)
- Speech-to-text (Faster-Whisper GPU)
- Quick responses (pattern matching)
- Conversation analysis (GPT-OSS via Ollama)
- Intent detection (GPT-OSS)
- Prompt composition (GPT-OSS or templates)
- Text-to-speech (Kokoro TTS)
- MCP server (local IPC)

### External (Acceptable)
- **Cascade execution only** (Windsurf API/Credits)

**Everything runs locally except the actual coding agent!**

---

## Hardware Requirements

### GPU (RTX 5090)
- Faster-Whisper: Real-time STT
- GPT-OSS: 20B parameter model inference
- Kokoro TTS: Neural voice synthesis

### CPU
- Wake word detection
- Pattern matching
- File watching
- Process management

### Memory
- ~12 GB VRAM for models
- ~4 GB RAM for conversation state

### Storage
- GPT-OSS: ~12 GB
- Faster-Whisper: ~1.5 GB
- Kokoro TTS: ~100 MB
- **Total:** ~14 GB

---

## Event-Driven Architecture

### Events Between Layers

**Layer 1 → Layer 2:**
- `TranscriptionReceived(text: string)`
- `UserPaused(duration: ms)`
- `ConversationEnded()`

**Layer 2 → Layer 3:**
- `ToolInvocationNeeded(context, intent)`
- `CascadePromptReady(prompt: string)`
- `StatusQuery()`

**Layer 3 → Layer 1:**
- `ToolStarted(taskId: string)`
- `ToolProgress(taskId: string, status: string)`
- `ToolCompleted(taskId: string, summary: CascadeSummary)`
- `ToolFailed(taskId: string, error: string)`

**Layer 1 → User:**
- `Speak(text: string, priority: number)`
- `StatusIndicator(state: 'idle' | 'listening' | 'working' | 'muted')`

---

## Error Handling

### Layer 1 Errors
- STT fails → "Sorry, I didn't catch that"
- TTS fails → Log error, continue listening
- Quick response fails → Use fallback: "I'm listening"

### Layer 2 Errors
- GPT-OSS unavailable → Queue for retry
- Intent classification fails → Conservative default (no tool)
- Prompt composition fails → Fallback template

### Layer 3 Errors
- Cascade fails → Announce failure to user
- MCP timeout → Announce still working, check status
- Response parsing fails → Ask Cascade to retry with fallback format

**Key:** Layer 1 never stops responding, even if other layers fail.

---

## Testing Strategy

### Layer 1 Tests (Fast Response)
- Wake word accuracy
- STT accuracy
- Quick response appropriateness
- TTS quality and latency
- Total response time <500ms

### Layer 2 Tests (Analysis)
- Intent detection accuracy (>90%)
- Context building correctness
- Tool invocation precision (few false positives)
- Prompt quality

### Layer 3 Tests (Tool Execution)
- Non-blocking invocation
- MCP callback handling
- Result announcement timing
- Error recovery

### Integration Tests
- Full conversation flow
- Mid-execution conversation
- Multiple tool invocations
- Error scenarios

---

## Future Enhancements

### Layer 1 Improvements
- Voice emotion detection
- Barge-in support (interrupt Jarvis)
- Multiple voice profiles
- Noise suppression

### Layer 2 Improvements
- Multi-language support
- Code context injection
- Workspace awareness
- File attachment automation

### Layer 3 Improvements
- Additional MCP tools (tests, linter, etc.)
- Parallel tool execution
- Tool result streaming
- Confidence-based auto-apply

---

## Summary

**Jarvis is a reactive, voice-first conversational AI** that:

✅ Responds instantly (Layer 1: <500ms)  
✅ Thinks deeply in background (Layer 2: GPT-OSS)  
✅ Executes tools asynchronously (Layer 3: Cascade)  
✅ Maintains natural conversation throughout  
✅ Runs 99% locally (only Cascade uses API)  
✅ Feels like talking to a human, not a robot  

**The conversation never stops!** 🎤🇬🇧✨
