import { LocalLLMService } from '../llm/LocalLLMService';

/**
 * Summarizes and editorializes Cascade responses for TTS output
 * Uses local LLM for natural summarization (NO API CALLS)
 */
export class Editorializer {
    private style: 'terse' | 'conversational' | 'ops' = 'conversational';
    private llmService: LocalLLMService;

    constructor(llmService: LocalLLMService) {
        this.llmService = llmService;
    }

    setStyle(style: 'terse' | 'conversational' | 'ops'): void {
        this.style = style;
    }

    async summarize(response: string): Promise<string> {
        // M2 Implementation: Use local LLM to create natural summaries
        try {
            return await this.llmService.editorialize(response, this.style);
        } catch (error) {
            console.error('LLM editorialization failed, using template:', error);
            return this.templateSummary(response);
        }
    }

    /**
     * Fallback template-based summary
     */
    private templateSummary(response: string): string {
        switch (this.style) {
            case 'terse':
                return this.terseSummary(response);
            case 'conversational':
                return this.conversationalSummary(response);
            case 'ops':
                return this.opsSummary(response);
            default:
                return this.conversationalSummary(response);
        }
    }

    private terseSummary(response: string): string {
        // Ultra-brief: just the key action
        const lines = response.split('\n').slice(0, 3);
        return `Done. ${lines.join(' ')}`;
    }

    private conversationalSummary(response: string): string {
        // Natural, helpful tone
        // TODO: Use LLM or template-based extraction
        
        const preview = response.substring(0, 200);
        return `Here's what I did: ${preview}... Want me to explain more?`;
    }

    private opsSummary(response: string): string {
        // Detailed, operational
        const bullets = this.extractKeyPoints(response);
        return `Summary: ${bullets.join('. ')}. Ready for next step.`;
    }

    private extractKeyPoints(text: string): string[] {
        // Simple extraction - TODO: make smarter
        const lines = text.split('\n');
        const points: string[] = [];
        
        for (const line of lines) {
            if (line.trim().startsWith('-') || line.trim().startsWith('*')) {
                points.push(line.trim().substring(1).trim());
            }
        }
        
        return points.length > 0 ? points : [text.substring(0, 100)];
    }

    /**
     * Applies editorial rules to keep TTS output concise
     */
    applyLengthLimit(text: string, maxLength: number): string {
        if (text.length <= maxLength) {
            return text;
        }
        return text.substring(0, maxLength - 20) + '... Full details in chat.';
    }
}
