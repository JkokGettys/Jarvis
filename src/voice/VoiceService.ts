import * as vscode from 'vscode';
import { spawn, ChildProcess } from 'child_process';
import * as path from 'path';
import { EventBus, EventType } from '../core/EventBus';

/**
 * Voice message types from Python service
 */
interface VoiceMessage {
    type: 'transcription' | 'conversation_turn' | 'jarvis_speaking' | 'user_speaking' | 
          'hotword_detected' | 'listening' | 'silence' | 'error' | 'initialized' | 
          'ready' | 'muted' | 'unmuted' | 'shutdown_complete' | 'audio_stream_started' | 'status' | 'debug' | 'instruction_detected';
    text?: string;
    message?: string;
    user_text?: string;
    jarvis_response?: string;
    instruction?: string;
}

/**
 * Command types to Python service
 */
interface VoiceCommand {
    command: 'mute' | 'unmute' | 'shutdown' | 'announce' | 'reset_context' | 'change_voice';
    text?: string;
    changes?: string[];
    notes?: string[];
    risks?: string[];
    next_questions?: string[];
    voice?: string;
}

export class VoiceService {
    private context: vscode.ExtensionContext;
    private eventBus: EventBus;
    private pythonProcess?: ChildProcess;
    private isMuted: boolean = false;
    private isActive: boolean = false;
    private transcriptionCallbacks: Array<(text: string) => void> = [];
    private conversationTurnCallbacks: Array<(userText: string, jarvisResponse: string) => void> = [];
    private instructionCallbacks: Array<(instruction: string) => void> = [];

    constructor(context: vscode.ExtensionContext, eventBus: EventBus) {
        this.context = context;
        this.eventBus = eventBus;
    }

    /**
     * Start the Python voice service
     */
    async start(): Promise<void> {
        if (this.pythonProcess) {
            console.log('[VoiceService] Already running');
            return;
        }

        const config = vscode.workspace.getConfiguration('jarvis.voice');
        const enabled = config.get<boolean>('enabled', true);
        
        if (!enabled) {
            console.log('[VoiceService] Voice input disabled in settings');
            return;
        }

        try {
            // Get configuration
            const whisperModel = config.get<string>('whisperModel', 'tiny');  // Default to tiny for speed
            const silenceTimeout = config.get<number>('silenceTimeout', 1000) / 1000; // Convert to seconds
            const ollamaUrl = config.get<string>('ollama.url', 'http://localhost:11434');

            // Determine Python paths
            const extensionPath = this.context.extensionPath;
            const pythonVenvPath = path.join(extensionPath, 'python', 'venv', 'Scripts', 'python.exe');
            const pythonScriptPath = path.join(extensionPath, 'python', 'voice_service.py');

            console.log(`[VoiceService] Starting Python service...`);
            console.log(`[VoiceService] Python: ${pythonVenvPath}`);
            console.log(`[VoiceService] Script: ${pythonScriptPath}`);
            console.log(`[VoiceService] Whisper model: ${whisperModel}`);

            // Spawn Python process
            this.pythonProcess = spawn(pythonVenvPath, [pythonScriptPath], {
                env: {
                    ...process.env,
                    WHISPER_MODEL: whisperModel,
                    SILENCE_TIMEOUT: silenceTimeout.toString(),
                    OLLAMA_URL: ollamaUrl
                },
                cwd: path.join(extensionPath, 'python')
            });

            // Handle stdout (JSON messages from Python)
            this.pythonProcess.stdout?.on('data', (data: Buffer) => {
                const lines = data.toString().trim().split('\n');
                for (const line of lines) {
                    try {
                        const message: VoiceMessage = JSON.parse(line);
                        this.handleVoiceMessage(message);
                    } catch (e) {
                        console.error('[VoiceService] Failed to parse message:', line);
                    }
                }
            });

            // Handle stderr (errors and debug output)
            this.pythonProcess.stderr?.on('data', (data: Buffer) => {
                console.error('[VoiceService] Python stderr:', data.toString());
            });

            // Handle process exit
            this.pythonProcess.on('exit', (code, signal) => {
                console.log(`[VoiceService] Python process exited with code ${code}, signal ${signal}`);
                this.pythonProcess = undefined;
                this.isActive = false;
                this.eventBus.emit(EventType.LISTENING_STOPPED);
            });

            // Handle process errors
            this.pythonProcess.on('error', (err) => {
                console.error('[VoiceService] Python process error:', err);
                vscode.window.showErrorMessage(`Jarvis voice service error: ${err.message}`);
            });

            this.isActive = true;
            console.log('[VoiceService] Python process started');

        } catch (err) {
            const error = err as Error;
            console.error('[VoiceService] Failed to start:', error);
            vscode.window.showErrorMessage(`Failed to start Jarvis voice service: ${error.message}`);
        }
    }

    /**
     * Stop the Python voice service
     */
    async stop(): Promise<void> {
        if (!this.pythonProcess) {
            return;
        }

        console.log('[VoiceService] Stopping Python service...');
        
        // Send shutdown command
        this.sendCommand({ command: 'shutdown' });

        // Wait a bit for graceful shutdown
        await new Promise(resolve => setTimeout(resolve, 500));

        // Force kill if still running
        if (this.pythonProcess) {
            this.pythonProcess.kill();
            this.pythonProcess = undefined;
        }

        this.isActive = false;
        this.eventBus.emit(EventType.LISTENING_STOPPED);
        console.log('[VoiceService] Stopped');
    }

    /**
     * Toggle the Python voice service on/off
     */
    async toggle(): Promise<void> {
        if (this.isRunning()) {
            await this.stop();
        } else {
            await this.start();
        }
    }

    /**
     * Toggle mute state
     */
    async toggleMute(): Promise<void> {
        this.isMuted = !this.isMuted;
        
        if (this.pythonProcess) {
            this.sendCommand({ command: this.isMuted ? 'mute' : 'unmute' });
        }

        vscode.window.showInformationMessage(
            `Jarvis is now ${this.isMuted ? 'muted' : 'unmuted'}`
        );
    }

    /**
     * Reset conversation context to prevent context bleeding between tasks
     */
    resetContext(): void {
        if (this.pythonProcess) {
            console.log('[VoiceService] Resetting conversation context');
            this.sendCommand({ command: 'reset_context' });
        }
    }

    /**
     * Change TTS voice
     */
    changeVoice(voiceId: string): void {
        if (this.pythonProcess) {
            console.log('[VoiceService] Changing voice to:', voiceId);
            this.sendCommand({ command: 'change_voice', voice: voiceId });
        }
    }

    /**
     * Subscribe to transcription events
     */
    onTranscription(callback: (text: string) => void): void {
        this.transcriptionCallbacks.push(callback);
    }

    /**
     * Subscribe to conversation turn events (for Layer 2 analysis - DEPRECATED, using unified approach)
     */
    onConversationTurn(callback: (userText: string, jarvisResponse: string) => void): void {
        this.conversationTurnCallbacks.push(callback);
    }

    /**
     * Subscribe to instruction events (unified LLM approach)
     */
    onInstruction(callback: (instruction: string) => void): void {
        this.instructionCallbacks.push(callback);
    }

    /**
     * Announce Cascade completion via TTS
     * This is called by MCPWatcher when Cascade finishes a task
     */
    announceCompletion(tldr: string, changes: string[] = [], notes: string[] = [], risks: string[] = [], next_questions: string[] = []): void {
        if (!this.pythonProcess) {
            console.warn('[VoiceService] Cannot announce, voice service not running');
            return;
        }

        console.log('[VoiceService] Announcing completion:', tldr);
        
        // Send announce command to Python service for TTS
        this.sendCommand({
            command: 'announce',
            text: tldr,
            changes: changes,
            notes: notes,
            risks: risks,
            next_questions: next_questions
        });
    }

    /**
     * Handle messages from Python service
     */
    private handleVoiceMessage(message: VoiceMessage): void {
        console.log('[VoiceService] Received:', message);

        switch (message.type) {
            case 'debug':
                console.log('[VoiceService] DEBUG:', message.message);
                break;

            case 'instruction_detected':
                if (message.instruction) {
                    console.log('[VoiceService] 🎯 INSTRUCTION DETECTED:', message.instruction);
                    
                    // Notify subscribers (sends directly to Cascade, bypassing Layer 2)
                    for (const callback of this.instructionCallbacks) {
                        callback(message.instruction);
                    }
                }
                break;

            case 'status':
                console.log('[VoiceService] Status:', message.message);
                break;

            case 'initialized':
                console.log('[VoiceService] Components initialized');
                break;

            case 'audio_stream_started':
                console.log('[VoiceService] Audio stream started');
                break;

            case 'ready':
                console.log('[VoiceService] Ready - continuous listening active');
                vscode.window.showInformationMessage('Jarvis voice service ready - listening continuously');
                break;

            case 'user_speaking':
                console.log('[VoiceService] User started speaking');
                this.eventBus.emit(EventType.LISTENING_STARTED);
                break;

            case 'hotword_detected':
                console.log('[VoiceService] Hotword detected!');
                this.eventBus.emit(EventType.LISTENING_STARTED);
                break;

            case 'listening':
                console.log('[VoiceService] Listening for next input...');
                this.eventBus.emit(EventType.LISTENING_STOPPED);
                break;

            case 'transcription':
                if (message.text) {
                    console.log(`[VoiceService] User: "${message.text}"`);
                    this.eventBus.emit(EventType.TRANSCRIPTION, { text: message.text });
                    
                    // Notify transcription subscribers
                    for (const callback of this.transcriptionCallbacks) {
                        callback(message.text);
                    }
                }
                break;

            case 'jarvis_speaking':
                if (message.text) {
                    console.log(`[VoiceService] Jarvis: "${message.text}"`);
                }
                break;

            case 'conversation_turn':
                // Full conversation turn - send to Layer 2 for analysis
                if (message.user_text && message.jarvis_response) {
                    console.log(`[VoiceService] Conversation turn - User: "${message.user_text}" -> Jarvis: "${message.jarvis_response}"`);
                    
                    // Notify Layer 2 subscribers (AnalysisEngine)
                    for (const callback of this.conversationTurnCallbacks) {
                        callback(message.user_text, message.jarvis_response);
                    }
                }
                break;

            case 'silence':
                console.log('[VoiceService] Silence detected');
                this.eventBus.emit(EventType.LISTENING_STOPPED);
                break;

            case 'muted':
                console.log('[VoiceService] Muted');
                break;

            case 'unmuted':
                console.log('[VoiceService] Unmuted');
                break;

            case 'error':
                console.error('[VoiceService] Error from Python:', message.message);
                vscode.window.showErrorMessage(`Jarvis voice error: ${message.message}`);
                break;

            default:
                console.warn('[VoiceService] Unknown message type:', message);
        }
    }

    /**
     * Send command to Python service
     */
    private sendCommand(command: VoiceCommand): void {
        if (!this.pythonProcess || !this.pythonProcess.stdin) {
            console.warn('[VoiceService] Cannot send command, process not running');
            return;
        }

        const commandStr = JSON.stringify(command) + '\n';
        this.pythonProcess.stdin.write(commandStr);
    }

    /**
     * Clean up resources
     */
    dispose(): void {
        this.stop();
    }

    /**
     * Check if voice service is active
     */
    isRunning(): boolean {
        return this.isActive && !!this.pythonProcess;
    }
}
