import { LocalLLMService } from '../llm/LocalLLMService';
import { ConversationBuffer, ConversationTurn } from '../voice/ConversationBuffer';

/**
 * Analysis result from background processing
 */
export interface AnalysisResult {
    toolNeeded: boolean;
    intent: 'fix_bug' | 'add_feature' | 'refactor' | 'conversation' | 'unknown';
    confidence: number;
    summary?: string;
    extractedRequest?: string;
}

/**
 * Layer 2: Background Analysis Engine
 * 
 * Analyzes conversation stream in the background to detect when tools should be invoked.
 * Non-blocking - doesn't interrupt Layer 1's fast conversational responses.
 * 
 * From M1_PLAN.md Phase 3.1
 */
export class AnalysisEngine {
    private llm: LocalLLMService;
    private conversationBuffer: ConversationBuffer;
    private analyzing: boolean = false;
    private toolInvocationCallbacks: Array<(result: AnalysisResult) => void> = [];

    constructor(conversationBuffer: ConversationBuffer, llm: LocalLLMService) {
        this.conversationBuffer = conversationBuffer;
        this.llm = llm;
    }

    /**
     * Process a new conversation turn (non-blocking)
     * Called by VoiceService when it receives a conversation_turn message
     */
    async processConversationTurn(userText: string, jarvisResponse: string): Promise<void> {
        // Add to conversation buffer
        this.conversationBuffer.addUserTurn(userText);
        this.conversationBuffer.addJarvisTurn(jarvisResponse);

        // Analyze asynchronously (don't block!)
        this.analyzeAsync();
    }

    /**
     * Analyze conversation in background (non-blocking)
     */
    private async analyzeAsync(): Promise<void> {
        if (this.analyzing) {
            console.log('[AnalysisEngine] Already analyzing, skipping...');
            return;
        }

        this.analyzing = true;

        try {
            // Get conversation context
            const turns = this.conversationBuffer.getRecentContext(5);
            
            if (turns.length === 0) {
                return;
            }

            // Build context string
            const context = this.buildContext(turns);

            console.log('[AnalysisEngine] Analyzing conversation context...');

            // Ask GPT-OSS: Does user want a tool invocation?
            const analysis = await this.analyzeIntent(context);

            console.log('[AnalysisEngine] Analysis result:', analysis);

            if (analysis.toolNeeded) {
                console.log(`[AnalysisEngine] Tool invocation detected: ${analysis.intent}`);
                
                // Notify subscribers (CascadeBridge)
                for (const callback of this.toolInvocationCallbacks) {
                    callback(analysis);
                }
            } else {
                console.log('[AnalysisEngine] Conversational, no tool needed');
            }
        } catch (error) {
            console.error('[AnalysisEngine] Analysis failed:', error);
        } finally {
            this.analyzing = false;
        }
    }

    /**
     * Analyze intent using GPT-OSS
     */
    private async analyzeIntent(context: string): Promise<AnalysisResult> {
        let rawResponse = '';
        try {
            rawResponse = await this.llm.analyzeConversation(context);
            
            if (!rawResponse || rawResponse.trim().length === 0) {
                console.warn('[AnalysisEngine] Empty response from LLM');
                return {
                    toolNeeded: false,
                    intent: 'conversation',
                    confidence: 0.5
                };
            }

            // Clean up response - remove markdown code blocks and extra whitespace
            let cleanedResponse = rawResponse.trim();
            
            // Remove ```json and ``` wrappers if present
            cleanedResponse = cleanedResponse.replace(/^```json\s*/i, '').replace(/\s*```$/, '');
            cleanedResponse = cleanedResponse.trim();
            
            // Try to find JSON object if response has extra text
            const jsonMatch = cleanedResponse.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                cleanedResponse = jsonMatch[0];
            }

            const parsed = JSON.parse(cleanedResponse);
            return {
                toolNeeded: parsed.toolNeeded || false,
                intent: parsed.intent || 'conversation',
                confidence: parsed.confidence || 0.5,
                summary: parsed.summary,
                extractedRequest: parsed.extractedRequest
            };
        } catch (error) {
            console.error('[AnalysisEngine] Failed to parse LLM response:', error);
            console.error('[AnalysisEngine] Raw response:', rawResponse?.substring(0, 200));
            return {
                toolNeeded: false,
                intent: 'unknown',
                confidence: 0.3
            };
        }
    }

    /**
     * Build context string from conversation turns
     */
    private buildContext(turns: ConversationTurn[]): string {
        return turns.map(turn => {
            const speaker = turn.speaker === 'user' ? 'User' : 'Jarvis';
            return `${speaker}: ${turn.text}`;
        }).join('\n');
    }

    /**
     * Subscribe to tool invocation events
     */
    onToolInvocation(callback: (result: AnalysisResult) => void): void {
        this.toolInvocationCallbacks.push(callback);
    }

    /**
     * Clear conversation history
     */
    clearHistory(): void {
        this.conversationBuffer.clear();
    }
}
