import { Intent } from './IntentClassifier';
import { LocalLLMService } from '../llm/LocalLLMService';

/**
 * Composes structured prompts for Cascade
 * Uses local LLM to enhance prompt quality (NO API CALLS)
 */
export class PromptComposer {
    private llmService: LocalLLMService;

    constructor(llmService: LocalLLMService) {
        this.llmService = llmService;
    }
    
    async compose(rawText: string, intent?: Intent): Promise<string> {
        console.log('🔧 PromptComposer.compose() called with:', rawText);
        
        if (intent?.type === 'confirmation') {
            return rawText; // Pass confirmation phrases as-is
        }

        // Use local LLM to enhance the prompt
        try {
            const context = 'Current workspace context'; // TODO: Add actual workspace context
            console.log('🔧 Calling LLM service to enhance prompt...');
            const enhanced = await this.llmService.enhancePrompt(rawText, context);
            console.log('🔧 LLM enhanced result:', enhanced?.substring(0, 100) + '...');
            return enhanced;
        } catch (error) {
            console.error('LLM prompt enhancement failed, using template:', error);
            const fallback = this.buildStructuredPrompt(rawText);
            console.log('🔧 Using fallback template:', fallback.substring(0, 100) + '...');
            return fallback;
        }
    }

    private buildStructuredPrompt(rawText: string): string {
        // Extract key information from raw text
        // This is a simplified version - M1 will need more intelligence
        
        return `# Task
${rawText}

# Context
- Current workspace context should be analyzed
- Use existing code patterns and conventions

# Constraints
- Follow existing code style
- Add appropriate tests
- Maintain backwards compatibility where applicable

# Acceptance
- Code compiles/runs without errors
- All tests pass
- Code follows project conventions`;
    }

    /**
     * Enriches prompt with workspace context
     * TODO: M4 - Add repo map, diagnostics, current file, etc.
     */
    enrichWithContext(prompt: string): string {
        // Will integrate with VS Code workspace APIs
        // - Current file and selection
        // - Open files
        // - Git status
        // - Diagnostics
        return prompt;
    }
}
