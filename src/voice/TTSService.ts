import { EventBus } from '../core/EventBus';

export interface TTSConfig {
    provider: 'os-default' | 'fish-audio' | 'elevenlabs';
    voice?: string;
}

/**
 * Text-to-Speech service
 * Supports OS default TTS and neural TTS providers
 */
export class TTSService {
    private eventBus: EventBus;
    private config: TTSConfig;
    private isPlaying: boolean = false;

    constructor(eventBus: EventBus, config: TTSConfig) {
        this.eventBus = eventBus;
        this.config = config;
    }

    async speak(text: string): Promise<void> {
        if (this.isPlaying) {
            this.stop();
        }

        this.isPlaying = true;

        try {
            switch (this.config.provider) {
                case 'os-default':
                    await this.speakWithOSTTS(text);
                    break;
                case 'fish-audio':
                case 'elevenlabs':
                    throw new Error(`${this.config.provider} not yet implemented`);
                default:
                    throw new Error('Unknown TTS provider');
            }
        } finally {
            this.isPlaying = false;
        }
    }

    private async speakWithOSTTS(text: string): Promise<void> {
        // TODO: M2 Implementation
        // Use OS-level TTS (Windows SAPI, macOS say, Linux espeak)
        console.log('Would speak with OS TTS:', text);
    }

    stop(): void {
        if (this.isPlaying) {
            // TODO: Stop current playback
            this.isPlaying = false;
        }
    }

    dispose(): void {
        this.stop();
    }
}
