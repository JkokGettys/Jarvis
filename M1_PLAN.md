# M1 Implementation Plan

**Goal:** Voice-to-voice conversational AI with Cascade integration  
**Approach:** Build in phases, test each layer independently

---

## Phase 1: Fast Conversational Layer (Kokoro TTS)

**Goal:** Get instant voice responses working with simple acknowledgments.

**Duration:** 2-3 hours

### 1.1 Add Kokoro TTS Service

**File:** `python/tts_service.py`

```python
from kokoro_onnx import Kokoro

class TTSService:
    def __init__(self, voice="bf_emma"):  # British female
        self.model = Kokoro(voice=voice, lang="en-gb")
        
    def speak(self, text: str):
        """Synthesize and play audio immediately"""
        audio = self.model.create(text)
        # Play audio (pyaudio or sounddevice)
        self.play_audio(audio)
```

**Test:**
```python
tts = TTSService(voice="bf_emma")
tts.speak("Hello, I'm Jarvis. How can I help you today?")
```

**Acceptance:**
- [ ] Kokoro TTS installed
- [ ] British voice works
- [ ] Audio plays clearly
- [ ] Latency <200ms from text to speech start

---

### 1.2 Simple Response Generator

**File:** `src/conversation/QuickResponder.ts`

```typescript
export class QuickResponder {
  // Pattern-based quick responses
  private responses = {
    greeting: ["Hello!", "Hi there!", "Yes?"],
    acknowledgment: ["Got it.", "Understood.", "I see."],
    working: ["I'll work on that.", "Let me handle that.", "I'm on it."],
    clarification: ["Could you tell me more?", "What specifically?", "Can you elaborate?"],
    status: ["I'm working on it.", "Almost done.", "Just a moment."]
  };

  getQuickResponse(transcript: string): string {
    // Simple keyword matching for now
    if (this.isGreeting(transcript)) return this.random(this.responses.greeting);
    if (this.isAcknowledgment(transcript)) return this.random(this.responses.acknowledgment);
    // ... more patterns
    
    return "I'm listening."; // Default
  }
}
```

**Test:**
- Input: "Hey Jarvis"
- Output: "Hello!" (instant)
- Input: "I'm working on auth"
- Output: "Understood." (instant)

**Acceptance:**
- [ ] Quick responses work
- [ ] Response time <100ms
- [ ] Feels natural
- [ ] Doesn't block

---

### 1.3 Integrate Layer 1

**File:** `src/conversation/ConversationalInterface.ts`

```typescript
export class ConversationalInterface {
  private voiceService: VoiceService;  // Existing STT
  private ttsService: TTSService;      // New Kokoro TTS
  private quickResponder: QuickResponder;
  private transcriptStream: Subject<string> = new Subject();
  
  async start() {
    // Listen for transcriptions from voice service
    this.voiceService.onTranscription((text) => {
      // 1. Get quick response (instant)
      const response = this.quickResponder.getQuickResponse(text);
      
      // 2. Speak it (non-blocking)
      this.ttsService.speakAsync(response);
      
      // 3. Stream transcript to analysis layer
      this.transcriptStream.next(text);
    });
    
    await this.voiceService.start();
  }
  
  // Subscribe to transcript stream (for Layer 2)
  onTranscript(callback: (text: string) => void) {
    return this.transcriptStream.subscribe(callback);
  }
}
```

**Test:**
```
User: "Hey Jarvis, I'm working on authentication"
  → Jarvis: "Understood." (instant!)
User: "The password validation is broken"
  → Jarvis: "I see." (instant!)
User: "Let's fix it"
  → Jarvis: "I'll work on that." (instant!)
```

**Acceptance:**
- [ ] End-to-end conversation works
- [ ] Responses are instant (<500ms)
- [ ] Transcripts stream to Layer 2
- [ ] No blocking
- [ ] Natural flow

---

## Phase 2: Streaming Transcripts

**Goal:** Get transcripts flowing to analysis layer in background.

**Duration:** 1 hour

### 2.1 Transcript Stream Service

**File:** `src/conversation/TranscriptStream.ts`

```typescript
export class TranscriptStream {
  private buffer: ConversationTurn[] = [];
  private maxTurns = 10;
  private subscribers: ((turns: ConversationTurn[]) => void)[] = [];
  
  addTurn(speaker: 'user' | 'jarvis', text: string) {
    this.buffer.push({
      speaker,
      text,
      timestamp: Date.now()
    });
    
    // Keep only recent turns
    if (this.buffer.length > this.maxTurns) {
      this.buffer.shift();
    }
    
    // Notify subscribers (Layer 2)
    this.notifySubscribers();
  }
  
  subscribe(callback: (turns: ConversationTurn[]) => void) {
    this.subscribers.push(callback);
  }
  
  private notifySubscribers() {
    this.subscribers.forEach(cb => cb([...this.buffer]));
  }
  
  getContext(): ConversationTurn[] {
    return [...this.buffer];
  }
}
```

**Test:**
```typescript
const stream = new TranscriptStream();

stream.subscribe((turns) => {
  console.log('Analysis layer received:', turns);
});

stream.addTurn('user', 'I'm working on auth');
stream.addTurn('jarvis', 'Understood.');
stream.addTurn('user', 'The password validation is broken');
stream.addTurn('jarvis', 'I see.');
```

**Acceptance:**
- [ ] Transcripts accumulate
- [ ] Rolling window (last 10 turns)
- [ ] Subscribers notified immediately
- [ ] Non-blocking
- [ ] Thread-safe

---

## Phase 3: GPT-OSS Analysis Layer

**Goal:** Analyze conversation stream in background, detect tool invocation needs.

**Duration:** 2-3 hours

### 3.1 Background Analysis Engine

**File:** `src/conversation/AnalysisEngine.ts`

```typescript
export class AnalysisEngine {
  private llm: LocalLLMService;  // GPT-OSS via Ollama
  private transcriptStream: TranscriptStream;
  private analyzing = false;
  
  constructor(transcriptStream: TranscriptStream, llm: LocalLLMService) {
    this.transcriptStream = transcriptStream;
    this.llm = llm;
    
    // Subscribe to transcript updates
    transcriptStream.subscribe((turns) => {
      this.analyzeAsync(turns);  // Non-blocking!
    });
  }
  
  private async analyzeAsync(turns: ConversationTurn[]) {
    if (this.analyzing) return;  // Skip if already analyzing
    
    this.analyzing = true;
    
    try {
      // Build context from conversation
      const context = this.buildContext(turns);
      
      // Ask GPT-OSS: "Does user want a tool invocation?"
      const analysis = await this.llm.analyzeIntent(context);
      
      if (analysis.toolNeeded) {
        console.log('[AnalysisEngine] Tool invocation detected:', analysis.intent);
        // TODO Phase 4: Invoke tool
      } else {
        console.log('[AnalysisEngine] Conversational, no tool needed');
      }
    } finally {
      this.analyzing = false;
    }
  }
  
  private buildContext(turns: ConversationTurn[]): string {
    return turns.map(t => `${t.speaker}: ${t.text}`).join('\n');
  }
}
```

**Test:**
```typescript
const stream = new TranscriptStream();
const llm = new LocalLLMService();
const analysis = new AnalysisEngine(stream, llm);

// Simulate conversation
stream.addTurn('user', 'I'm working on authentication');
// → Analysis: No tool needed

stream.addTurn('user', 'The password validation is broken');
// → Analysis: No tool needed (just information)

stream.addTurn('user', 'Let's fix that bug');
// → Analysis: TOOL NEEDED - Cascade invocation
```

**Acceptance:**
- [ ] Analyzes conversation continuously
- [ ] Detects tool invocation needs
- [ ] Non-blocking (doesn't interrupt Layer 1)
- [ ] Accurate intent detection
- [ ] Handles multi-turn context

---

### 3.2 Intent Classifier Integration

**File:** `src/orchestrator/IntentClassifier.ts` (update existing)

Add async analysis mode:

```typescript
export class IntentClassifier {
  async analyzeIntent(context: string): Promise<IntentAnalysis> {
    const prompt = `Analyze this conversation and determine if the user wants a code change:

${context}

Response format:
{
  "toolNeeded": boolean,
  "intent": "fix_bug" | "add_feature" | "refactor" | "conversation",
  "confidence": 0-1,
  "summary": "brief description"
}`;

    const response = await this.llm.generate(prompt);
    return JSON.parse(response);
  }
}
```

**Test:**
```typescript
const classifier = new IntentClassifier(llm);

const context1 = `
user: I'm working on authentication
jarvis: Understood.
`;
const result1 = await classifier.analyzeIntent(context1);
// → { toolNeeded: false, intent: "conversation" }

const context2 = `
user: I'm working on authentication
jarvis: Understood.
user: The password validation is broken
jarvis: I see.
user: Let's fix that bug
`;
const result2 = await classifier.analyzeIntent(context2);
// → { toolNeeded: true, intent: "fix_bug", summary: "Fix password validation in auth" }
```

**Acceptance:**
- [ ] Accurate intent detection
- [ ] Multi-turn context awareness
- [ ] Conservative (few false positives)
- [ ] Fast enough for background (<2s)
- [ ] JSON output parsed correctly

---

## Phase 4: Async Tool Invocation

**Goal:** Fire Cascade tool without blocking conversation.

**Duration:** 2 hours

### 4.1 Async Cascade Bridge

**File:** `src/cascade/CascadeBridge.ts` (update existing)

Add async mode:

```typescript
export class CascadeBridge {
  // Existing M0 method (blocking)
  async sendPrompt(prompt: string): Promise<void> {
    // Ctrl+L → paste → Enter
  }
  
  // NEW: Async invocation (fire and forget)
  async invokeAsync(prompt: string): Promise<string> {
    return new Promise((resolve) => {
      // Fire the tool
      this.sendPrompt(prompt);
      
      // Don't wait for Cascade! Return task ID immediately
      const taskId = this.generateTaskId();
      
      // Monitor for MCP callback
      this.pendingTasks.set(taskId, resolve);
      
      return taskId;
    });
  }
  
  // Called when MCP voiceSummary.save() is received
  onMCPCallback(summary: CascadeSummary) {
    // Find pending task
    const taskId = this.findTaskForSummary(summary);
    const resolve = this.pendingTasks.get(taskId);
    
    if (resolve) {
      resolve(taskId);
      this.pendingTasks.delete(taskId);
    }
    
    // Notify Layer 1 to announce results
    this.announceResults(summary);
  }
}
```

**Test:**
```typescript
const bridge = new CascadeBridge();

// Fire and forget
const taskId = await bridge.invokeAsync('Fix password validation in auth module');
console.log('Task started:', taskId);

// User can keep talking! Layer 1 still responsive

// Later, when Cascade finishes and calls MCP...
// → Layer 1 announces: "All done! I've fixed..."
```

**Acceptance:**
- [ ] Cascade invoked without blocking
- [ ] Returns immediately
- [ ] MCP callback handled
- [ ] Results announced when ready
- [ ] User can talk during execution

---

### 4.2 Wire Everything Together

**File:** `src/extension.ts` (update)

```typescript
export async function activate(context: vscode.ExtensionContext) {
  // Layer 1: Fast Conversational Interface
  const conversationalInterface = new ConversationalInterface(
    voiceService,
    ttsService,
    quickResponder
  );
  
  // Layer 2: Analysis Engine
  const transcriptStream = new TranscriptStream();
  const analysisEngine = new AnalysisEngine(
    transcriptStream,
    llm,
    intentClassifier
  );
  
  // Layer 3: Tool Executor
  const toolExecutor = new ToolExecutor(
    cascadeBridge,
    promptComposer
  );
  
  // Wire layers together
  conversationalInterface.onTranscript((text) => {
    transcriptStream.addTurn('user', text);
  });
  
  analysisEngine.onToolInvocation(async (context) => {
    const prompt = await promptComposer.compose(context);
    await toolExecutor.invokeAsync(prompt);
  });
  
  toolExecutor.onToolComplete((summary) => {
    conversationalInterface.announce(summary);
  });
  
  // Start!
  await conversationalInterface.start();
}
```

**Acceptance:**
- [ ] All layers integrated
- [ ] Non-blocking conversation
- [ ] Background analysis works
- [ ] Tools fire asynchronously
- [ ] Results announced properly

---

## Phase 5: MCP Integration

**Goal:** Capture Cascade responses via MCP.

**Duration:** 1-2 hours

### 5.1 MCP Server

**File:** `python/mcp_server.py` (already have from guide)

Test that Cascade can call our tool.

### 5.2 Response Watcher

**File:** `src/mcp/ResponseWatcher.ts`

```typescript
export class ResponseWatcher {
  private watcher: fs.FSWatcher;
  private callbacks: ((summary: CascadeSummary) => void)[] = [];
  
  start() {
    const summaryPath = path.join(os.homedir(), '.windsurf', 'jarvis_summary.json');
    
    this.watcher = fs.watch(summaryPath, (event) => {
      if (event === 'change') {
        const summary = JSON.parse(fs.readFileSync(summaryPath, 'utf8'));
        this.notifyCallbacks(summary);
      }
    });
  }
  
  onSummary(callback: (summary: CascadeSummary) => void) {
    this.callbacks.push(callback);
  }
}
```

**Acceptance:**
- [ ] Detects new MCP summaries
- [ ] Parses JSON correctly
- [ ] Notifies subscribers
- [ ] Handles errors gracefully

---

## Testing Checklist

### End-to-End Test

**Scenario:** Fix authentication bug with continuous conversation

```
User: "Hey Jarvis, I'm working on authentication"
  → Jarvis: "Understood." (instant)
  → [Background: GPT-OSS analyzing...]

User: "The password validation is broken"
  → Jarvis: "I see." (instant)
  → [Background: GPT-OSS building context...]

User: "Let's fix that bug"
  → Jarvis: "I'll work on that right away!" (instant)
  → [Background: GPT-OSS detects tool need]
  → [Background: PromptComposer formats]
  → [Background: Cascade starts...]

User: "How's it going?" (WHILE CASCADE WORKS!)
  → Jarvis: "I'm working on it now." (instant)

User: "Make sure it checks for special characters"
  → Jarvis: "Got it, I'll include that." (instant)
  → [Background: GPT-OSS updates context]

[Cascade finishes, calls MCP]

Jarvis: "All done! I've fixed the password validation with length and special character checks. I've added tests as well."
```

**Acceptance:**
- [ ] All responses instant
- [ ] Conversation never blocks
- [ ] Tool invoked correctly
- [ ] Mid-execution conversation works
- [ ] Results announced properly
- [ ] Feels natural and responsive

---

## Success Criteria

- [ ] **Response time:** <500ms for all user inputs
- [ ] **No blocking:** Can talk during Cascade execution
- [ ] **Intent accuracy:** >90% correct tool invocations
- [ ] **Natural flow:** Feels like talking to a human
- [ ] **Reliability:** Handles errors gracefully

---

## Implementation Order Summary

1. ✅ **Phase 1:** Kokoro TTS + quick responder (test conversation)
2. ✅ **Phase 2:** Streaming transcripts (test background flow)
3. ✅ **Phase 3:** GPT-OSS analysis + intent detection (test analysis)
4. ✅ **Phase 4:** Async tool invocation (test non-blocking)
5. ✅ **Phase 5:** MCP integration (test full loop)

**Estimated total time:** 8-12 hours

**Start with:** Phase 1 (Kokoro TTS) - get voice responses working first! 🎤
