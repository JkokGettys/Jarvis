import { LocalLLMService } from '../llm/LocalLLMService';
import { ConversationBuffer } from '../voice/ConversationBuffer';

export interface Intent {
    type: 'actionable' | 'thinking' | 'confirmation' | 'unknown';
    confidence: number;
    summary?: string;
    extractedContext?: string; // For actionable intents, the synthesized request
}

/**
 * Classifies user speech into intent categories
 * Analyzes CONVERSATION CONTEXT, not just single utterances
 * Uses local LLM for intelligent classification (NO API CALLS)
 */
export class IntentClassifier {
    private llmService: LocalLLMService;

    constructor(llmService: LocalLLMService) {
        this.llmService = llmService;
    }
    
    /**
     * Classify intent based on conversation context
     * @param utterance The latest user utterance
     * @param conversationContext Recent conversation history (optional for backward compat)
     */
    async classify(utterance: string, conversationContext?: string): Promise<Intent> {
        // Use local LLM for context-aware intent classification
        try {
            if (conversationContext) {
                // New: context-aware classification
                const result = await this.llmService.classifyIntentWithContext(
                    utterance,
                    conversationContext
                );
                return result;
            } else {
                // Legacy: single utterance classification
                const result = await this.llmService.classifyIntent(utterance);
                return result;
            }
        } catch (error) {
            console.error('LLM intent classification failed, using heuristics:', error);
            return this.heuristicClassify(utterance);
        }
    }

    /**
     * Fallback heuristic classification
     */
    private heuristicClassify(text: string): Intent {
        const lowerText = text.toLowerCase();

        if (this.isConfirmation(lowerText)) {
            return {
                type: 'confirmation',
                confidence: 0.9
            };
        }

        if (this.isActionableCommand(lowerText)) {
            return {
                type: 'actionable',
                confidence: 0.8,
                summary: 'Detected actionable request'
            };
        }

        if (this.isChitChat(lowerText)) {
            return {
                type: 'thinking',
                confidence: 0.7
            };
        }

        // Default to thinking (thinking aloud)
        return {
            type: 'thinking',
            confidence: 0.5
        };
    }

    private isConfirmation(text: string): boolean {
        const confirmationPhrases = [
            'ship it',
            'do it',
            'apply',
            'go ahead',
            'yes',
            'confirm',
            'proceed'
        ];
        return confirmationPhrases.some(phrase => text.includes(phrase));
    }

    private isActionableCommand(text: string): boolean {
        const commandKeywords = [
            'add',
            'create',
            'make',
            'build',
            'implement',
            'fix',
            'update',
            'delete',
            'remove',
            'refactor',
            'modify',
            'change',
            'write',
            'generate'
        ];
        return commandKeywords.some(keyword => text.split(' ').includes(keyword));
    }

    private isChitChat(text: string): boolean {
        const chitChatPatterns = [
            'how are you',
            'what\'s up',
            'hello',
            'hi jarvis',
            'good morning',
            'good afternoon',
            'thanks',
            'thank you'
        ];
        return chitChatPatterns.some(pattern => text.includes(pattern));
    }
}
