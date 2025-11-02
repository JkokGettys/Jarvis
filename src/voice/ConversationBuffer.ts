/**
 * Conversation buffer for tracking dialog history
 * Enables context-aware intent detection
 */

export interface ConversationTurn {
    timestamp: Date;
    speaker: 'user' | 'jarvis';
    text: string;
    intent?: 'thinking' | 'actionable' | 'confirmation';
}

export class ConversationBuffer {
    private turns: ConversationTurn[] = [];
    private maxTurns: number = 10; // Keep last 10 turns
    private maxAge: number = 5 * 60 * 1000; // 5 minutes

    /**
     * Add a user utterance to the conversation
     */
    addUserTurn(text: string): void {
        this.turns.push({
            timestamp: new Date(),
            speaker: 'user',
            text: text
        });
        this.cleanup();
    }

    /**
     * Add a Jarvis response to the conversation
     */
    addJarvisTurn(text: string): void {
        this.turns.push({
            timestamp: new Date(),
            speaker: 'jarvis',
            text: text
        });
        this.cleanup();
    }

    /**
     * Get recent conversation context (last N turns)
     */
    getRecentContext(numTurns: number = 5): ConversationTurn[] {
        return this.turns.slice(-numTurns);
    }

    /**
     * Get conversation context as formatted text for LLM analysis
     */
    getContextAsText(numTurns: number = 5): string {
        const recent = this.getRecentContext(numTurns);
        return recent
            .map(turn => `${turn.speaker === 'user' ? 'User' : 'Jarvis'}: ${turn.text}`)
            .join('\n');
    }

    /**
     * Clear old turns (based on count and age)
     */
    private cleanup(): void {
        const now = new Date();
        
        // Remove turns older than maxAge
        this.turns = this.turns.filter(
            turn => now.getTime() - turn.timestamp.getTime() < this.maxAge
        );

        // Keep only last maxTurns
        if (this.turns.length > this.maxTurns) {
            this.turns = this.turns.slice(-this.maxTurns);
        }
    }

    /**
     * Clear all conversation history
     */
    clear(): void {
        this.turns = [];
    }

    /**
     * Get all turns
     */
    getAllTurns(): ConversationTurn[] {
        return [...this.turns];
    }
}
