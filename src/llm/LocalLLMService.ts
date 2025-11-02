import * as vscode from 'vscode';

export interface LLMConfig {
    provider: 'ollama' | 'llama-cpp' | 'local-server';
    model: string;
    endpoint: string;
}

export interface LLMMessage {
    role: 'system' | 'user' | 'assistant';
    content: string;
}

/**
 * Local LLM service for intent classification and chatting
 * Runs entirely on local hardware (RTX 5090)
 * NO API CALLS - all inference is local
 */
export class LocalLLMService {
    private config: LLMConfig;
    private conversationHistory: LLMMessage[] = [];

    constructor() {
        this.config = this.loadConfig();
    }

    private loadConfig(): LLMConfig {
        const config = vscode.workspace.getConfiguration('jarvis');
        return {
            provider: config.get('llm.provider', 'ollama'),
            model: config.get('llm.model', 'llama3.1:8b'),
            endpoint: config.get('llm.endpoint', 'http://localhost:11434')
        };
    }

    /**
     * Classify speech intent with LLM assistance (single utterance, no context)
     */
    async classifyIntent(utterance: string): Promise<any> {
        const prompt = `Classify this speech as: "actionable", "thinking", "confirmation", or "unknown".

- actionable: User wants to do something (create, fix, add, etc.)
- thinking: User is thinking aloud, exploring
- confirmation: User confirming/agreeing ("yes", "ship it", etc.)
- unknown: Not clear

Speech: "${utterance}"

Respond with ONLY a JSON object:
{"type": "actionable"|"thinking"|"confirmation"|"unknown", "confidence": 0.0-1.0}`;

        const response = await this.generate(prompt, { temperature: 0.2, maxTokens: 100 });
        
        try {
            const parsed = JSON.parse(response.trim());
            return {
                type: parsed.type || 'unknown',
                confidence: parsed.confidence || 0.5
            };
        } catch (error) {
            // Fallback heuristic
            const lower = utterance.toLowerCase();
            if (lower.includes('yes') || lower.includes('ship it') || lower.includes('do it')) {
                return { type: 'confirmation', confidence: 0.7 };
            }
            if (lower.match(/\b(create|add|fix|make|build|implement|update)\b/)) {
                return { type: 'actionable', confidence: 0.6 };
            }
            return { type: 'thinking', confidence: 0.5 };
        }
    }

    /**
     * Chat with user for clarifications, follow-ups, etc.
     * All conversation stays local
     */
    async chat(userMessage: string, systemContext?: string): Promise<string> {
        // Add system context if provided
        if (systemContext && this.conversationHistory.length === 0) {
            this.conversationHistory.push({
                role: 'system',
                content: systemContext
            });
        }

        // Add user message
        this.conversationHistory.push({
            role: 'user',
            content: userMessage
        });

        try {
            const response = await this.generateWithHistory(this.conversationHistory);
            
            // Add assistant response to history
            this.conversationHistory.push({
                role: 'assistant',
                content: response
            });

            return response;
        } catch (error) {
            console.error('Local LLM chat failed:', error);
            return 'I\'m having trouble processing that. Could you rephrase?';
        }
    }

    /**
     * Analyze full conversation for tool invocation needs (for Layer 2 AnalysisEngine)
     */
    async analyzeConversation(conversationContext: string): Promise<string> {
        const prompt = `Analyze this conversation and determine if the user wants code to be written.

Conversation:
${conversationContext}

RULES - Set "toolNeeded: true" if user says ANY of these:
- "I want to make/create/build [something]"
- "Let's make/create/build [something]"
- "Can you make/create/build [something]"
- "Let's fix [something]"
- "Fix [something]"
- "Add [feature]"
- "Implement [something]"

Set "toolNeeded: false" ONLY if user is:
- Just greeting ("hi", "hello")
- Asking general questions without a request
- Clarifying something

If user wants something built/fixed/added, set toolNeeded: true and extract the request.

Respond with ONLY raw JSON (no markdown, no backticks):
{
  "toolNeeded": boolean,
  "intent": "fix_bug" | "add_feature" | "refactor" | "conversation",
  "confidence": 0.0-1.0,
  "summary": "brief description",
  "extractedRequest": "what user wants (if toolNeeded is true)"
}`;

        return await this.generate(prompt, { temperature: 0.2, maxTokens: 250 });
    }

    /**
     * Context-aware intent classification
     * Analyzes conversation to detect actionable requests
     */
    async classifyIntentWithContext(utterance: string, conversationContext: string): Promise<any> {
        const prompt = `You are analyzing a conversation between a user and their voice coding assistant.

Recent conversation:
${conversationContext}

Latest utterance: "${utterance}"

CRITICAL: Only classify as "actionable" if the user is EXPLICITLY requesting action with phrases like:
- "let's fix that"
- "please create/add/implement..."
- "go ahead"
- "do it"
- "yeah let's..."

Classify as:
1. "actionable" - User is EXPLICITLY asking you to take action (not just describing a problem)
2. "thinking" - User is describing problems, exploring ideas, or thinking aloud
3. "confirmation" - User confirming a previous suggestion ("yes", "ship it", "apply it")
4. "unknown" - Not clear

If actionable, extract what they want based on the FULL conversation.

Respond with ONLY a JSON object:
{"type": "actionable"|"thinking"|"confirmation"|"unknown", "confidence": 0.0-1.0, "extractedContext": "what user wants (if actionable)"}`;

        const response = await this.generate(prompt, { temperature: 0.2, maxTokens: 150 });
        
        // Check for empty response
        if (!response || response.trim().length === 0) {
            console.warn('⚠️ Empty response from LLM for intent classification');
            console.warn('   Falling back to heuristic classification');
            return {
                type: 'unknown',
                confidence: 0.3
            };
        }
        
        try {
            // Try to parse JSON response
            const parsed = JSON.parse(response.trim());
            return {
                type: parsed.type || 'unknown',
                confidence: parsed.confidence || 0.5,
                extractedContext: parsed.extractedContext
            };
        } catch (error) {
            // Fallback if JSON parsing fails
            console.warn('⚠️ Failed to parse intent JSON, using fallback');
            console.warn('   Raw response:', response.substring(0, 100));
            return {
                type: 'unknown',
                confidence: 0.3
            };
        }
    }

    /**
     * Enhance prompt composition with LLM assistance (MINIMAL "pass-through" style)
     */
    async enhancePrompt(rawText: string, context: string): Promise<string> {
        const prompt = `You are helping pass user requests to a coding AI. Your job is MINIMAL cleanup only.

User said: "${rawText}"

Rules:
- If request is clear, return it EXACTLY AS-IS
- Only fix obvious typos or grammar
- Keep it brief and concise
- Do NOT add details, structure, or elaboration
- Do NOT break down steps or add commands
- Trust the coding AI to figure out the details

Output the cleaned request:`;

        return await this.generate(prompt, { temperature: 0.2, maxTokens: 400 });
    }

    /**
     * Generate editorial summary for TTS
     */
    async editorialize(technicalResponse: string, style: 'terse' | 'conversational' | 'ops'): Promise<string> {
        const stylePrompts = {
            terse: 'Create a 1-sentence summary of this technical response.',
            conversational: 'Summarize this in a natural, conversational way (2-3 sentences).',
            ops: 'Create a detailed operational summary with key points.'
        };

        const prompt = `${stylePrompts[style]}

Technical response:
${technicalResponse.substring(0, 1000)}

Summary:`;

        return await this.generate(prompt, { temperature: 0.5, maxTokens: 200 });
    }

    /**
     * Core generation method - routes to appropriate provider
     */
    private async generate(
        prompt: string, 
        options: { temperature?: number; maxTokens?: number } = {}
    ): Promise<string> {
        switch (this.config.provider) {
            case 'ollama':
                return await this.generateOllama(prompt, options);
            case 'llama-cpp':
            case 'local-server':
                return await this.generateHTTP(prompt, options);
            default:
                throw new Error(`Unknown LLM provider: ${this.config.provider}`);
        }
    }

    /**
     * Generate with conversation history
     */
    private async generateWithHistory(messages: LLMMessage[]): Promise<string> {
        switch (this.config.provider) {
            case 'ollama':
                return await this.generateOllamaChat(messages);
            case 'llama-cpp':
            case 'local-server':
                return await this.generateHTTPChat(messages);
            default:
                throw new Error(`Unknown LLM provider: ${this.config.provider}`);
        }
    }

    /**
     * Ollama API integration
     */
    private async generateOllama(
        prompt: string, 
        options: { temperature?: number; maxTokens?: number }
    ): Promise<string> {
        console.log('🤖 Calling Ollama at:', this.config.endpoint);
        console.log('🤖 Model:', this.config.model);
        console.log('🤖 Prompt:', prompt.substring(0, 200) + '...');
        
        const response = await fetch(`${this.config.endpoint}/api/generate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model: this.config.model,
                prompt: prompt,
                stream: false,
                options: {
                    temperature: options.temperature ?? 0.7,
                    num_predict: options.maxTokens ?? 500
                }
            })
        });

        console.log('🤖 Response status:', response.status, response.statusText);

        if (!response.ok) {
            const errorText = await response.text();
            console.error('🤖 Ollama error response:', errorText);
            throw new Error(`Ollama API error: ${response.statusText}`);
        }

        const data = await response.json() as { response: string };
        console.log('🤖 Ollama returned:', data.response?.length || 0, 'chars');
        console.log('🤖 First 200 chars:', data.response?.substring(0, 200) || '(empty)');
        
        // Check for empty response
        if (!data.response || data.response.trim().length === 0) {
            console.warn('⚠️ Ollama returned empty response! This may indicate:');
            console.warn('   - Model is still loading');
            console.warn('   - Prompt is too complex');
            console.warn('   - Model doesnt understand the format');
            console.warn('🤖 Full response object:', JSON.stringify(data));
        }
        
        return data.response;
    }

    /**
     * Ollama chat API integration
     */
    private async generateOllamaChat(messages: LLMMessage[]): Promise<string> {
        const response = await fetch(`${this.config.endpoint}/api/chat`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model: this.config.model,
                messages: messages,
                stream: false
            })
        });

        if (!response.ok) {
            throw new Error(`Ollama chat API error: ${response.statusText}`);
        }

        const data = await response.json() as { message: { content: string } };
        return data.message.content;
    }

    /**
     * Generic HTTP endpoint integration (llama.cpp server, etc.)
     */
    private async generateHTTP(
        prompt: string,
        options: { temperature?: number; maxTokens?: number }
    ): Promise<string> {
        const response = await fetch(`${this.config.endpoint}/completion`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                prompt: prompt,
                temperature: options.temperature ?? 0.7,
                n_predict: options.maxTokens ?? 500
            })
        });

        if (!response.ok) {
            throw new Error(`LLM HTTP API error: ${response.statusText}`);
        }

        const data = await response.json() as { content: string };
        return data.content;
    }

    /**
     * Generic HTTP chat endpoint
     */
    private async generateHTTPChat(messages: LLMMessage[]): Promise<string> {
        // Convert to prompt format for simpler servers
        const prompt = messages
            .map(m => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`)
            .join('\n\n') + '\n\nAssistant:';

        return await this.generateHTTP(prompt, {});
    }

    /**
     * Build intent classification prompt
     */
    private buildIntentPrompt(text: string): string {
        return `Classify this utterance into one of these categories:
- "command": An actionable coding request
- "note": Thinking aloud, not actionable
- "chit-chat": Small talk or greeting
- "confirmation": Confirming an action (e.g., "ship it", "do it")

Utterance: "${text}"

Respond with just the category name.
Category:`;
    }

    /**
     * Parse LLM intent response
     */
    private parseIntentResponse(response: string): {
        type: 'note' | 'command' | 'chit-chat' | 'confirmation';
        isActionable: boolean;
        confidence: number;
    } {
        const normalized = response.toLowerCase().trim();
        
        if (normalized.includes('command')) {
            return { type: 'command', isActionable: true, confidence: 0.9 };
        } else if (normalized.includes('confirmation')) {
            return { type: 'confirmation', isActionable: true, confidence: 0.95 };
        } else if (normalized.includes('chit-chat')) {
            return { type: 'chit-chat', isActionable: false, confidence: 0.8 };
        } else {
            return { type: 'note', isActionable: false, confidence: 0.7 };
        }
    }

    /**
     * Fallback heuristic classification
     */
    private heuristicIntentClassification(text: string): {
        type: 'note' | 'command' | 'chit-chat' | 'confirmation';
        isActionable: boolean;
        confidence: number;
    } {
        const lower = text.toLowerCase();

        // Confirmation phrases
        if (['ship it', 'do it', 'go ahead', 'yes', 'confirm'].some(p => lower.includes(p))) {
            return { type: 'confirmation', isActionable: true, confidence: 0.9 };
        }

        // Command keywords
        if (['add', 'create', 'make', 'fix', 'update', 'delete', 'implement'].some(k => lower.includes(k))) {
            return { type: 'command', isActionable: true, confidence: 0.7 };
        }

        // Chit-chat
        if (['hello', 'hi', 'thanks', 'how are you'].some(p => lower.includes(p))) {
            return { type: 'chit-chat', isActionable: false, confidence: 0.8 };
        }

        // Default to note
        return { type: 'note', isActionable: false, confidence: 0.5 };
    }

    /**
     * Clear conversation history
     */
    clearHistory(): void {
        this.conversationHistory = [];
    }

    /**
     * Check if LLM service is available
     */
    async isAvailable(): Promise<boolean> {
        try {
            const response = await fetch(`${this.config.endpoint}`, {
                method: 'GET',
                signal: AbortSignal.timeout(2000)
            });
            return response.ok;
        } catch {
            return false;
        }
    }
}
