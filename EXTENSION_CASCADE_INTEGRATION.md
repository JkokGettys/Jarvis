# Extension-Based Cascade Integration

## The Key Insight

As a **VS Code Extension**, we have privileged access to Windsurf's internal APIs. We don't need keyboard simulation - we can interact programmatically!

## Potential Extension APIs

### 1. Webview Messaging (MOST PROMISING)

If Cascade is implemented as a Webview panel, we can post messages to it directly.

**How to test:**
```typescript
// Check if Cascade uses a webview
const webviews = vscode.window.activeTextEditor?.document.uri.scheme === 'webview';

// If Cascade has a webview, we can message it
const cascadeWebview = getCascadeWebview(); // Need to find reference
if (cascadeWebview) {
    cascadeWebview.webview.postMessage({
        type: 'submitPrompt',
        prompt: 'Create a hello world app'
    });
}
```

**Research needed:**
- Is Cascade implemented as a webview?
- What's the webview panel ID?
- What message types does it accept?

---

### 2. Chat Participant Proxy Pattern

Create a Jarvis chat participant that acts as a middle layer:

**Architecture:**
```
Voice Input
    ↓
Extension receives text
    ↓
@jarvis participant (we create this)
    ↓
Programmatically submit to Cascade
```

**Implementation:**
```typescript
// Create Jarvis participant
const jarvisParticipant = vscode.chat.createChatParticipant(
    'jarvis',
    async (request, context, response, token) => {
        // Show user we're working
        response.markdown('🎤 Jarvis received: ' + request.prompt);
        
        // Try to forward to Cascade programmatically
        const result = await forwardToCascade(request.prompt);
        
        if (result.success) {
            response.markdown('✅ Sent to Cascade!');
        } else {
            response.markdown('⚠️ Please check Cascade for the prompt.');
        }
    }
);

jarvisParticipant.iconPath = vscode.Uri.file('jarvis-icon.png');
```

**User experience:**
- User talks to Jarvis
- Extension programmatically invokes `@jarvis` participant
- Jarvis participant shows in chat panel
- Can we programmatically send to Cascade from there?

---

### 3. TextDocument Manipulation

If Cascade's input field is exposed as a TextDocument, we can insert text directly:

**Theory:**
```typescript
// Find Cascade's text document
const cascadeDoc = vscode.workspace.textDocuments.find(
    doc => doc.uri.scheme === 'cascade' || 
           doc.fileName.includes('cascade')
);

if (cascadeDoc) {
    const edit = new vscode.WorkspaceEdit();
    const lastLine = cascadeDoc.lineAt(cascadeDoc.lineCount - 1);
    
    edit.insert(
        cascadeDoc.uri,
        lastLine.range.end,
        'Create a hello world app'
    );
    
    await vscode.workspace.applyEdit(edit);
    
    // Then trigger submit command
    await vscode.commands.executeCommand('cascade.submit');
}
```

**Challenges:**
- Cascade input might not be a TextDocument
- Might be a custom input widget

---

### 4. Command Execution with Arguments

Many VS Code commands accept arguments. We need to discover if Cascade commands do:

**Test pattern:**
```typescript
// Test different command signatures
await vscode.commands.executeCommand('workbench.action.chat.open', {
    prompt: 'Hello',
    participant: 'cascade',
    submit: true
});

// Or
await vscode.commands.executeCommand('cascade.sendMessage', 
    'Create hello world'
);

// Or with full options
await vscode.commands.executeCommand('cascade.execute', {
    message: 'Create hello world',
    mode: 'code',
    autoSubmit: true
});
```

---

### 5. Extension Host Communication

Extensions run in a separate Node.js process. We can:

**A. Use Extension Message Passing**
```typescript
// If Cascade is also an extension, we can message it
const cascadeExtension = vscode.extensions.getExtension('windsurf.cascade');
if (cascadeExtension) {
    const cascadeAPI = await cascadeExtension.activate();
    if (cascadeAPI && cascadeAPI.sendPrompt) {
        await cascadeAPI.sendPrompt('Create hello world');
    }
}
```

**B. Use Global State**
```typescript
// Write to global state that Cascade might monitor
await context.globalState.update('jarvis.pendingPrompt', {
    prompt: 'Create hello world',
    timestamp: Date.now()
});

// Cascade could watch for changes and pick up prompts
```

---

## Investigation Steps

### Step 1: Inspect Cascade's Implementation

```typescript
// Add to extension.ts
async function inspectCascade() {
    // Check for Cascade extension
    const allExtensions = vscode.extensions.all;
    const cascadeRelated = allExtensions.filter(ext => 
        ext.id.includes('cascade') || 
        ext.id.includes('windsurf') ||
        ext.id.includes('codeium')
    );
    
    console.log('Cascade-related extensions:', cascadeRelated.map(e => ({
        id: e.id,
        isActive: e.isActive,
        exports: e.exports
    })));
    
    // Check for webviews
    console.log('Active webview panels:', (vscode.window as any).webviewPanels);
    
    // Check for text documents
    console.log('Open documents:', vscode.workspace.textDocuments.map(d => ({
        uri: d.uri.toString(),
        scheme: d.uri.scheme
    })));
    
    // List all commands
    const commands = await vscode.commands.getCommands();
    console.log('Cascade commands:', commands.filter(c => 
        c.includes('cascade') || c.includes('chat')
    ));
}
```

### Step 2: Runtime Debugging

1. Open Windsurf
2. Open Cascade panel (Ctrl+L)
3. Run inspection command
4. Check Developer Tools Console (Ctrl+Shift+I)

Look for:
- Webview panel references
- Extension APIs
- Available commands with parameters
- DOM structure (if webview)

### Step 3: Test Command Parameters

```typescript
async function testCascadeCommands() {
    const testPrompt = 'Hello from Jarvis';
    
    const commandsToTry = [
        // Direct submission
        { cmd: 'cascade.submitPrompt', args: [testPrompt] },
        { cmd: 'cascade.sendMessage', args: [testPrompt] },
        { cmd: 'cascade.execute', args: [testPrompt] },
        
        // With options object
        { cmd: 'cascade.submit', args: [{ prompt: testPrompt }] },
        { cmd: 'workbench.action.chat.submit', args: [{ text: testPrompt }] },
        
        // Open with prompt
        { cmd: 'cascade.openWithPrompt', args: [testPrompt] },
        { cmd: 'workbench.action.chat.open', args: [{ prompt: testPrompt }] },
    ];
    
    for (const { cmd, args } of commandsToTry) {
        try {
            console.log(`Testing: ${cmd}`);
            await vscode.commands.executeCommand(cmd, ...args);
            console.log(`✅ ${cmd} worked!`);
            return; // Success!
        } catch (error) {
            console.log(`❌ ${cmd} failed:`, error);
        }
    }
}
```

---

## Most Promising Approaches

### Priority 1: Discover Command Parameters ⭐⭐⭐

**Why:** VS Code commands can accept complex arguments. Cascade likely has commands that accept prompts.

**Action:**
1. Dump all commands
2. Check TypeScript definitions in Windsurf's source
3. Test with different argument patterns
4. Use Developer Tools to intercept command calls when manually using Cascade

### Priority 2: Extension API Interop ⭐⭐

**Why:** If Cascade exposes an extension API, we can call it directly.

**Action:**
1. Get reference to Cascade extension
2. Activate it and check exports
3. Call any exposed methods

### Priority 3: Webview Messaging ⭐⭐

**Why:** If Cascade is a webview, we can message it.

**Action:**
1. Find webview panel reference
2. Inspect message handlers
3. Post custom messages

### Priority 4: Create Jarvis Chat Participant ⭐

**Why:** Even if we can't send to Cascade directly, we can provide our own chat interface.

**Action:**
1. Implement `@jarvis` participant
2. Handle requests from voice input
3. Execute code changes directly or show them to user
4. Later: forward to Cascade if method found

---

## Implementation Plan

### Phase 1: Discovery (30 minutes)

```typescript
// Add to CascadeBridge.ts
export class CascadeBridge {
    async investigateCascadeAPIs() {
        console.log('=== INVESTIGATING CASCADE APIs ===');
        
        // 1. Check for Cascade extension
        const cascadeExt = vscode.extensions.getExtension('windsurf.cascade') ||
                          vscode.extensions.getExtension('codeium.cascade');
        console.log('Cascade extension:', cascadeExt);
        
        // 2. Get all commands
        const commands = await vscode.commands.getCommands(true);
        const cascadeCommands = commands.filter(c => 
            c.toLowerCase().includes('cascade') ||
            c.toLowerCase().includes('chat')
        );
        console.log('Cascade commands:', cascadeCommands);
        
        // 3. Check text documents
        const docs = vscode.workspace.textDocuments;
        console.log('Documents:', docs.map(d => d.uri.toString()));
        
        // 4. Try to get webviews (hacky, but might work)
        const windowAny = vscode.window as any;
        console.log('Webviews:', windowAny.webviewPanels);
        
        return {
            extension: cascadeExt,
            commands: cascadeCommands,
            documents: docs,
        };
    }
}
```

### Phase 2: Test Integration (1 hour)

Based on discovery, implement the most promising approach:

**Option A: Command with Arguments**
```typescript
async sendPrompt(prompt: string) {
    await vscode.commands.executeCommand('cascade.sendMessage', prompt);
}
```

**Option B: Extension API**
```typescript
async sendPrompt(prompt: string) {
    const cascade = vscode.extensions.getExtension('cascade');
    const api = await cascade.activate();
    await api.sendPrompt(prompt);
}
```

**Option C: Webview Messaging**
```typescript
async sendPrompt(prompt: string) {
    const webview = this.getCascadeWebview();
    webview.postMessage({ type: 'submit', prompt });
}
```

**Option D: Create Jarvis Participant**
```typescript
const jarvis = vscode.chat.createChatParticipant('jarvis', handler);
// Then programmatically invoke it
await vscode.commands.executeCommand('workbench.action.chat.open', {
    participant: 'jarvis',
    prompt: prompt
});
```

### Phase 3: Build Production Solution (2 hours)

Implement the working approach with:
- Error handling
- Fallback mechanisms
- User feedback
- Status indicators

---

## Key Advantages of Extension Approach

✅ **No keyboard simulation** - Uses programmatic APIs
✅ **No window focus issues** - Extension runs independently
✅ **User can multitask** - Doesn't hijack cursor or focus
✅ **Cross-platform** - Works on Windows, Mac, Linux
✅ **Reliable** - Uses supported APIs, not hacky automation
✅ **Clean** - Proper VS Code integration

---

## Next Steps

1. **Immediate:** Run the investigation code
2. **Test:** Try different command patterns
3. **Implement:** Use whichever method works
4. **Polish:** Add error handling and UX

This is the right approach! As an extension, we should be able to interact with Cascade programmatically without any keyboard hackery.
