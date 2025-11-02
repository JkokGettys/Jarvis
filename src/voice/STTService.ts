import { EventBus, EventType } from '../core/EventBus';

export interface STTConfig {
    provider: 'local-whisper' | 'deepgram' | 'openai' | 'google';
    localWhisperPath?: string;
}

/**
 * Speech-to-Text service
 * Supports multiple backends: local Faster-Whisper, cloud providers
 */
export class STTService {
    private eventBus: EventBus;
    private config: STTConfig;

    constructor(eventBus: EventBus, config: STTConfig) {
        this.eventBus = eventBus;
        this.config = config;
    }

    async transcribe(audioBuffer: Buffer): Promise<string> {
        // TODO: M1 Implementation
        // Route to appropriate STT provider based on config
        switch (this.config.provider) {
            case 'local-whisper':
                return this.transcribeWithWhisper(audioBuffer);
            case 'deepgram':
            case 'openai':
            case 'google':
                throw new Error(`${this.config.provider} not yet implemented`);
            default:
                throw new Error('Unknown STT provider');
        }
    }

    private async transcribeWithWhisper(audioBuffer: Buffer): Promise<string> {
        // TODO: M1 - Call Faster-Whisper via Python subprocess or HTTP API
        console.log('Would transcribe audio with Whisper...');
        return 'placeholder transcription';
    }

    dispose(): void {
        // Clean up any active connections or processes
    }
}
