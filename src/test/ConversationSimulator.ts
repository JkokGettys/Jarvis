import * as vscode from 'vscode';
import { ConversationBuffer } from '../voice/ConversationBuffer';
import { IntentClassifier } from '../orchestrator/IntentClassifier';
import { PromptComposer } from '../orchestrator/PromptComposer';
import { CascadeBridge } from '../cascade/CascadeBridge';
import { LocalLLMService } from '../llm/LocalLLMService';
import { EventBus } from '../core/EventBus';

/**
 * Test utility to simulate voice conversations without actual STT
 */
export class ConversationSimulator {
    private conversationBuffer: ConversationBuffer;
    private intentClassifier: IntentClassifier;
    private promptComposer: PromptComposer;
    private cascadeBridge: CascadeBridge;

    constructor(
        conversationBuffer: ConversationBuffer,
        intentClassifier: IntentClassifier,
        promptComposer: PromptComposer,
        cascadeBridge: CascadeBridge
    ) {
        this.conversationBuffer = conversationBuffer;
        this.intentClassifier = intentClassifier;
        this.promptComposer = promptComposer;
        this.cascadeBridge = cascadeBridge;
    }

    /**
     * Simulate a conversation turn
     */
    async simulateUserTurn(utterance: string): Promise<void> {
        console.log('\n💬 User says:', utterance);
        
        // Add to conversation buffer
        this.conversationBuffer.addUserTurn(utterance);

        // Get conversation context
        const context = this.conversationBuffer.getContextAsText(5);
        console.log('📚 Recent context:\n', context);

        // Classify intent with context
        const intent = await this.intentClassifier.classify(utterance, context);
        console.log('🎯 Intent:', intent);

        // If actionable, send to Cascade
        if (intent.type === 'actionable') {
            console.log('✅ Detected actionable intent!');
            
            // Use extracted context if available, otherwise use raw utterance
            const requestText = intent.extractedContext || utterance;
            console.log('📝 Extracted request:', requestText);
            
            // Compose prompt
            const prompt = await this.promptComposer.compose(requestText, intent);
            console.log('📤 Sending to Cascade...');
            
            // Send to Cascade
            await this.cascadeBridge.sendPrompt(prompt);
            
        } else if (intent.type === 'thinking') {
            console.log('💭 User is thinking aloud - not sending to Cascade');
        } else if (intent.type === 'confirmation') {
            console.log('✔️ User confirming - would apply pending changes');
        }
    }

    /**
     * Simulate a Jarvis response
     */
    simulateJarvisResponse(response: string): void {
        console.log('🤖 Jarvis:', response);
        this.conversationBuffer.addJarvisTurn(response);
    }

    /**
     * Run a preset conversation scenario
     */
    async runScenario(scenario: 'bugfix' | 'feature' | 'exploration'): Promise<void> {
        console.log('\n🎬 Starting scenario:', scenario);
        console.log('='.repeat(50));

        switch (scenario) {
            case 'bugfix':
                await this.bugfixScenario();
                break;
            case 'feature':
                await this.featureScenario();
                break;
            case 'exploration':
                await this.explorationScenario();
                break;
        }

        console.log('='.repeat(50));
        console.log('✅ Scenario complete!\n');
    }

    private async bugfixScenario(): Promise<void> {
        await this.simulateUserTurn("I'm working on the login page");
        this.simulateJarvisResponse("What would you like to do with it?");
        
        await this.delay(1000);
        
        await this.simulateUserTurn("The password reset button isn't working");
        this.simulateJarvisResponse("I can help fix that. Would you like me to look into it?");
        
        await this.delay(1000);
        
        await this.simulateUserTurn("Yeah let's fix that bug");
        // Should trigger Cascade!
    }

    private async featureScenario(): Promise<void> {
        await this.simulateUserTurn("I'm thinking about adding export functionality");
        this.simulateJarvisResponse("What kind of export are you thinking about?");
        
        await this.delay(1000);
        
        await this.simulateUserTurn("CSV export for the users table");
        this.simulateJarvisResponse("I can help with that. Want me to create it?");
        
        await this.delay(1000);
        
        await this.simulateUserTurn("Yes, create a CSV export endpoint");
        // Should trigger Cascade!
    }

    private async explorationScenario(): Promise<void> {
        await this.simulateUserTurn("I wonder if we should refactor the auth module");
        this.simulateJarvisResponse("What aspects are you considering?");
        
        await this.delay(1000);
        
        await this.simulateUserTurn("Maybe split it into smaller files");
        this.simulateJarvisResponse("That could improve maintainability");
        
        await this.delay(1000);
        
        await this.simulateUserTurn("Yeah just thinking out loud for now");
        // Should NOT trigger Cascade - just thinking
    }

    private delay(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}
