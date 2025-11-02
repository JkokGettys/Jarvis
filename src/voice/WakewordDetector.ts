import { EventBus, EventType } from '../core/EventBus';

/**
 * Wakeword detection service
 * Will integrate with Porcupine or similar wake word detection
 */
export class WakewordDetector {
    private eventBus: EventBus;
    private isActive: boolean = false;

    constructor(eventBus: EventBus) {
        this.eventBus = eventBus;
    }

    async start(): Promise<void> {
        // TODO: M1 Implementation
        // Initialize Porcupine or alternative wakeword engine
        this.isActive = true;
        console.log('Wakeword detector started');
    }

    async stop(): Promise<void> {
        this.isActive = false;
        console.log('Wakeword detector stopped');
    }

    dispose(): void {
        this.stop();
    }
}
