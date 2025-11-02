export enum EventType {
    REQUEST_STARTED = 'request_started',
    RESPONSE_READY = 'response_ready',
    READING = 'reading',
    LISTENING_STARTED = 'listening_started',
    LISTENING_STOPPED = 'listening_stopped',
    UTTERANCE_CAPTURED = 'utterance_captured',
    WAKEWORD_DETECTED = 'wakeword_detected',
    TRANSCRIPTION = 'transcription',
    BARGE_IN = 'barge_in',
    ERROR = 'error'
}

type EventCallback = (data?: any) => void;

export class EventBus {
    private listeners: Map<EventType, EventCallback[]> = new Map();

    on(event: EventType, callback: EventCallback): void {
        if (!this.listeners.has(event)) {
            this.listeners.set(event, []);
        }
        this.listeners.get(event)!.push(callback);
    }

    off(event: EventType, callback: EventCallback): void {
        const callbacks = this.listeners.get(event);
        if (callbacks) {
            const index = callbacks.indexOf(callback);
            if (index !== -1) {
                callbacks.splice(index, 1);
            }
        }
    }

    emit(event: EventType, data?: any): void {
        const callbacks = this.listeners.get(event);
        if (callbacks) {
            callbacks.forEach(callback => {
                try {
                    callback(data);
                } catch (error) {
                    console.error(`Error in event handler for ${event}:`, error);
                }
            });
        }
    }

    clear(): void {
        this.listeners.clear();
    }
}
