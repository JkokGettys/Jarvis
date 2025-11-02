import * as vscode from 'vscode';
import { EventBus, EventType } from '../core/EventBus';
import { KeyboardSimulator } from './KeyboardSimulator';
import { WindowFocuser } from './WindowFocuser';

/**
 * Bridge to Windsurf's Cascade agent
 * This is the M0 spike component - needs to be proven to work
 */
export class CascadeBridge {
    private lastResponse: string = '';
    private eventBus: EventBus;

    constructor(eventBus: EventBus) {
        this.eventBus = eventBus;
    }

    /**
     * Constructs full prompt with MCP preamble for Cascade
     */
    private constructPromptWithMCP(userPrompt: string): string {
        const mcpPreamble = `At the end of your run, call the MCP tool:
  jarvis-voice-summary.save
with the fields:
  - tldr: one-sentence summary for voice readout (conversational tone)
  - changes: array of "file: action" strings
  - risks: array of risks or caveats
  - next_questions: array of questions for the user
  - apply_safe: boolean - true if safe to auto-apply the diff

If the MCP tool is unavailable, include the same payload as a JSON fenced block labeled VOICE_SUMMARY_JSON at the very bottom of your reply.

---

${userPrompt}`;

        return mcpPreamble;
    }

    /**
     * Opens Cascade and sends a prompt
     * M1 Implementation - Using discovered windsurf.sendTextToChat command
     * 
     * Strategy:
     * 1. Execute windsurf.sendTextToChat to open quick chat window
     * 2. Copy prompt to clipboard
     * 3. Simulate Ctrl+V to paste
     * 4. Press Enter to submit
     * 
     * Benefits over Ctrl+L:
     * - No toggle behavior (more reliable)
     * - Direct command (no keyboard simulation to open)
     * - Works consistently
     * 
     * Note: MCP instructions are in Cascade's global custom instructions, not per-prompt
     */
    async sendPrompt(prompt: string): Promise<void> {
        try {
            this.eventBus.emit(EventType.REQUEST_STARTED);

            // MCP preamble now in Cascade's global custom instructions
            // No need to inject it per-prompt
            const fullPrompt = prompt;

            console.log('🔵 Starting Cascade bridge...');
            console.log('📝 Prompt length:', prompt.length, 'chars');

            // Step 0: Focus Extension Development Host window (critical for keyboard simulation!)
            // Note: When developing, this focuses the test window, not the code window
            console.log('🔵 Focusing Extension Development Host window...');
            const focused = await WindowFocuser.focusWindsurf();
            if (!focused) {
                console.warn('⚠️ Could not focus Extension Development Host - keyboard sim may fail!');
                vscode.window.showWarningMessage('⚠️ Jarvis: Could not focus window');
            } else {
                console.log('  ✓ Extension Development Host focused');
            }
            await this.delay(300); // Brief delay for focus to settle

            // Step 1: Open quick chat with Ctrl+Shift+I (proven to work!)
            console.log('🔵 Opening quick chat with Ctrl+Shift+I...');
            await KeyboardSimulator.openQuickChat();
            console.log('  ✓ Quick chat keystroke sent');
            
            // Wait for window to fully open and be ready for input
            await this.delay(800);
            console.log('  ✓ Quick chat should be ready');

            // Step 2: Paste prompt using typeText (atomic clipboard+paste operation)
            // typeText does Set-Clipboard AND Ctrl+V in same PowerShell command
            console.log('🔵 Pasting prompt...');
            await KeyboardSimulator.typeText(fullPrompt);
            console.log('  ✓ Prompt pasted');
            
            // Wait for paste to complete
            await this.delay(500);

            // Step 4: Press Enter to submit
            console.log('🔵 Pressing Enter to submit...');
            await KeyboardSimulator.pressEnter();
            await this.delay(200);
            console.log('  ✓ Enter sent');

            console.log('✅ Prompt sent to Cascade via windsurf.sendTextToChat command!');
            vscode.window.showInformationMessage(
                `Jarvis: Check Cascade for response!`
            );

            this.eventBus.emit(EventType.REQUEST_STARTED);

        } catch (error) {
            const errorMsg = error instanceof Error ? error.message : String(error);
            console.error('❌ Failed to send prompt to Cascade:', errorMsg);
            vscode.window.showErrorMessage(`Jarvis: Failed to send - ${errorMsg}`);
            this.eventBus.emit(EventType.ERROR, { error });
            throw error;
        }
    }

    /**
     * Helper to add delay
     */
    private delay(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Attempts to capture the latest response from Cascade
     * This is a placeholder implementation
     */
    async captureResponse(): Promise<string> {
        // TODO: M0 Implementation needed
        // This needs to hook into Cascade's output mechanism
        return this.lastResponse;
    }

    getLastResponse(): string {
        return this.lastResponse;
    }

    /**
     * Discover available Cascade commands in Windsurf
     */
    async discoverCascadeAPI(): Promise<string[]> {
        const allCommands = await vscode.commands.getCommands(true);
        return allCommands.filter(cmd => 
            cmd.toLowerCase().includes('cascade') ||
            cmd.toLowerCase().includes('windsurf') ||
            cmd.toLowerCase().includes('chat') ||
            cmd.toLowerCase().includes('ai')
        );
    }

    /**
     * TEST: Try the Ctrl+Shift+I command with a prompt
     * Based on user discovery that Ctrl+Shift+I opens a chat interface
     */
    async testQuickChatCommand(prompt: string): Promise<{success: boolean, workingCommand?: string, method?: string}> {
        console.log('\n=== TESTING CTRL+SHIFT+I COMMAND ===\n');
        console.log(`Prompt: "${prompt}"\n`);

        // DISCOVERED COMMANDS - Based on actual Windsurf investigation
        const candidateCommands = [
            // TOP PRIORITY - These were found in actual Windsurf commands
            'windsurf.sendTextToChat',           // ⭐⭐⭐ Most promising!
            'workbench.action.quickchat.toggle', // ⭐⭐⭐ Likely Ctrl+Shift+I
            'workbench.action.openQuickChat',    // ⭐⭐⭐ Alternative quick chat
            'windsurf.triggerCascade',           // ⭐⭐ Trigger Cascade
            'windsurf.executeCascadeAction',     // ⭐⭐ Execute action
            'windsurf.prioritized.chat.open',    // ⭐⭐ Open chat
            'windsurf.openCascade',              // ⭐ Open Cascade panel
            
            // Standard VS Code commands
            'workbench.action.chat.submit',
            'workbench.action.chat.open',
            'inlineChat.start'
        ];

        for (const cmd of candidateCommands) {
            console.log(`\n🔍 Trying: ${cmd}`);
            
            // Try with string argument
            try {
                const result = await vscode.commands.executeCommand(cmd, prompt);
                console.log(`✅ COMMAND EXECUTED with string arg: ${cmd}`);
                console.log(`   Return value:`, result);
                
                // Give it a moment to open
                await new Promise(resolve => setTimeout(resolve, 500));
                
                // Check if prompt appeared
                vscode.window.showInformationMessage(`✅ ${cmd} executed with string! Did text appear?`);
                return {success: true, workingCommand: cmd, method: 'string'};
            } catch (error) {
                const msg = error instanceof Error ? error.message : String(error);
                console.log(`  ❌ String arg failed: ${msg}`);
            }

            // Try with options object
            try {
                const result = await vscode.commands.executeCommand(cmd, { 
                    prompt, 
                    query: prompt, 
                    message: prompt,
                    text: prompt 
                });
                console.log(`✅ COMMAND EXECUTED with options: ${cmd}`);
                console.log(`   Return value:`, result);
                
                await new Promise(resolve => setTimeout(resolve, 500));
                
                vscode.window.showInformationMessage(`✅ ${cmd} executed with options! Did text appear?`);
                return {success: true, workingCommand: cmd, method: 'options'};
            } catch (error) {
                const msg = error instanceof Error ? error.message : String(error);
                console.log(`  ❌ Options arg failed: ${msg}`);
            }

            // Try without arguments (just open the window)
            try {
                const result = await vscode.commands.executeCommand(cmd);
                console.log(`✅ COMMAND EXECUTED without args: ${cmd}`);
                console.log(`   Return value:`, result);
                
                await new Promise(resolve => setTimeout(resolve, 500));
                
                vscode.window.showInformationMessage(`✅ ${cmd} opened window! Testing text insertion...`);
                
                // Now try to insert text via clipboard
                await vscode.env.clipboard.writeText(prompt);
                console.log(`   📋 Text copied to clipboard`);
                
                return {success: true, workingCommand: cmd, method: 'no-args-with-clipboard'};
            } catch (error) {
                const msg = error instanceof Error ? error.message : String(error);
                console.log(`  ❌ No args failed: ${msg}`);
            }
        }

        console.log('\n❌ No working command found\n');
        return {success: false};
    }

    /**
     * COMPREHENSIVE INVESTIGATION: Discover all possible ways to interact with Cascade
     * This method explores:
     * 1. Extension APIs
     * 2. Commands with parameters
     * 3. Webview panels
     * 4. Text documents
     * 5. Any other programmatic hooks
     */
    async investigateCascadeIntegration(): Promise<{
        extensions: any[],
        commands: string[],
        documents: any[],
        webviews: any,
        chatParticipants: any
    }> {
        console.log('\n=== INVESTIGATING CASCADE INTEGRATION ===\n');

        // 1. Find Cascade-related extensions (safely)
        const extensions = vscode.extensions.all
            .filter(ext => {
                const id = ext.id.toLowerCase();
                return id.includes('cascade') || 
                       id.includes('windsurf') || 
                       id.includes('codeium');
            })
            .map(ext => {
                try {
                    return {
                        id: ext.id,
                        isActive: ext.isActive,
                        packageJSON: ext.packageJSON?.displayName || ext.id,
                        hasExports: !!ext.exports,
                        exports: ext.exports ? Object.keys(ext.exports) : []
                    };
                } catch (error) {
                    return {
                        id: ext.id,
                        isActive: false,
                        packageJSON: 'Error accessing extension',
                        hasExports: false,
                        exports: []
                    };
                }
            });

        console.log('📦 Extensions found:', extensions.length);
        extensions.forEach(ext => {
            console.log(`  - ${ext.id}`);
            console.log(`    Active: ${ext.isActive}`);
            console.log(`    Has exports: ${ext.hasExports}`);
            if (ext.exports.length > 0) {
                console.log(`    Exports: ${ext.exports.join(', ')}`);
            }
        });

        // 2. Get all Cascade-related commands
        const allCommands = await vscode.commands.getCommands(true);
        const commands = allCommands.filter(cmd => {
            const lower = cmd.toLowerCase();
            return lower.includes('cascade') ||
                   lower.includes('windsurf') ||
                   lower.includes('chat') ||
                   lower.includes('ai') ||
                   lower.includes('copilot');
        });

        console.log('\n🔧 Commands found:', commands.length);
        commands.forEach(cmd => console.log(`  - ${cmd}`));

        // 3. Check for relevant text documents
        const documents = vscode.workspace.textDocuments.map(doc => ({
            uri: doc.uri.toString(),
            scheme: doc.uri.scheme,
            languageId: doc.languageId,
            fileName: doc.fileName
        }));

        const relevantDocs = documents.filter(doc => 
            doc.scheme !== 'file' || 
            doc.uri.includes('cascade') ||
            doc.uri.includes('chat')
        );

        console.log('\n📄 Relevant documents:', relevantDocs.length);
        relevantDocs.forEach(doc => {
            console.log(`  - ${doc.scheme}://${doc.fileName}`);
        });

        // 4. Check for webview panels (might not be directly accessible)
        const windowAny = vscode.window as any;
        const webviews = {
            hasWebviewPanels: !!windowAny.webviewPanels,
            activeWebview: windowAny.activeWebview?.title || null,
            visiblePanels: windowAny.visibleWebviewPanels?.length || 0
        };

        console.log('\n🖥️  Webview info:', JSON.stringify(webviews, null, 2));

        // 5. Check for chat participants (VS Code Chat API)
        const chatParticipants = {
            canCreate: typeof (vscode as any).chat?.createChatParticipant === 'function',
            hasAPI: !!(vscode as any).chat
        };

        console.log('\n💬 Chat API:', JSON.stringify(chatParticipants, null, 2));

        console.log('\n=== INVESTIGATION COMPLETE ===\n');

        return {
            extensions,
            commands,
            documents: relevantDocs,
            webviews,
            chatParticipants
        };
    }

    /**
     * TEST: Try different methods to send a message to Cascade programmatically
     */
    async testCascadeMessageMethods(testPrompt: string = 'Test from Jarvis'): Promise<{
        method: string,
        success: boolean,
        error?: string
    }[]> {
        console.log('\n=== TESTING CASCADE MESSAGE METHODS ===\n');
        console.log(`Test prompt: "${testPrompt}"\n`);

        const results: { method: string, success: boolean, error?: string }[] = [];

        // Method 1: Try command with simple string argument
        const simpleCommands = [
            'cascade.sendMessage',
            'cascade.submitPrompt',
            'cascade.execute',
            'cascade.send',
            'workbench.action.chat.submit'
        ];

        for (const cmd of simpleCommands) {
            try {
                console.log(`Testing: ${cmd}(string)`);
                await vscode.commands.executeCommand(cmd, testPrompt);
                console.log(`✅ ${cmd} succeeded!`);
                results.push({ method: cmd, success: true });
                return results; // Found one that works!
            } catch (error) {
                const msg = error instanceof Error ? error.message : String(error);
                console.log(`❌ ${cmd}: ${msg}`);
                results.push({ method: cmd, success: false, error: msg });
            }
        }

        // Method 2: Try commands with options object
        const commandsWithOptions = [
            { cmd: 'cascade.submit', args: { prompt: testPrompt } },
            { cmd: 'cascade.send', args: { message: testPrompt, autoSubmit: true } },
            { cmd: 'workbench.action.chat.open', args: { prompt: testPrompt } },
            { cmd: 'workbench.action.chat.submit', args: { text: testPrompt } }
        ];

        for (const { cmd, args } of commandsWithOptions) {
            try {
                console.log(`Testing: ${cmd}(object)`);
                await vscode.commands.executeCommand(cmd, args);
                console.log(`✅ ${cmd} with options succeeded!`);
                results.push({ method: `${cmd}(options)`, success: true });
                return results; // Found one that works!
            } catch (error) {
                const msg = error instanceof Error ? error.message : String(error);
                console.log(`❌ ${cmd}: ${msg}`);
                results.push({ method: `${cmd}(options)`, success: false, error: msg });
            }
        }

        // Method 3: Try accessing extension API
        try {
            console.log('Testing: Extension API access');
            const possibleExtIds = [
                'windsurf.cascade',
                'codeium.cascade',
                'windsurf',
                'codeium'
            ];

            for (const extId of possibleExtIds) {
                try {
                    const ext = vscode.extensions.getExtension(extId);
                    if (ext) {
                        console.log(`Found extension: ${extId}`);
                        let api;
                        
                        // Try to get API safely
                        try {
                            api = ext.isActive ? ext.exports : await ext.activate();
                        } catch (activationError) {
                            console.log(`  ⚠️ Could not activate ${extId}: ${activationError}`);
                            continue;
                        }
                        
                        console.log('Extension API:', api);
                        
                        if (api && typeof api.sendPrompt === 'function') {
                            await api.sendPrompt(testPrompt);
                            console.log('✅ Extension API sendPrompt succeeded!');
                            results.push({ method: 'ExtensionAPI.sendPrompt', success: true });
                            return results;
                        }
                        
                        if (api && typeof api.sendMessage === 'function') {
                            await api.sendMessage(testPrompt);
                            console.log('✅ Extension API sendMessage succeeded!');
                            results.push({ method: 'ExtensionAPI.sendMessage', success: true });
                            return results;
                        }
                    }
                } catch (extError) {
                    console.log(`  ⚠️ Error checking extension ${extId}: ${extError}`);
                }
            }
            
            results.push({ method: 'ExtensionAPI', success: false, error: 'No compatible API found' });
        } catch (error) {
            const msg = error instanceof Error ? error.message : String(error);
            console.log(`❌ Extension API: ${msg}`);
            results.push({ method: 'ExtensionAPI', success: false, error: msg });
        }

        console.log('\n=== TEST COMPLETE - NO WORKING METHOD FOUND ===\n');
        return results;
    }
}
