import * as vscode from 'vscode';
import { EventBus, EventType } from '../core/EventBus';
import { KeyboardSimulator } from './KeyboardSimulator';

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
     * M0 Implementation - Direct keyboard simulation
     * 
     * Strategy:
     * 1. Ctrl+L to focus Cascade chat input (assumes Windsurf window is already focused)
     * 2. Paste the prompt via clipboard
     * 3. Press Enter to submit
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

            // Small delay to ensure window is ready
            await this.delay(100);

            // Step 1: Focus Cascade chat with Ctrl+L
            console.log('🔵 Sending Ctrl+L to focus Cascade chat...');
            await KeyboardSimulator.focusCascadeChat();
            await this.delay(500);
            console.log('  ✓ Ctrl+L sent');

            // Step 2: Type/paste the prompt
            console.log('🔵 Typing prompt into Cascade...');
            await KeyboardSimulator.typeText(fullPrompt);
            console.log('  ✓ Prompt entered');
            
            // Wait longer for paste to complete
            console.log('🔵 Waiting for paste to settle...');
            await this.delay(1000);

            // Step 3: Press Enter to submit
            console.log('🔵 Pressing Enter to submit...');
            await KeyboardSimulator.pressEnter();
            await this.delay(200);
            console.log('  ✓ Enter sent');

            console.log('✅ Prompt sent to Cascade via keyboard simulation!');
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
}
