import * as vscode from 'vscode';
import { EventBus, EventType } from '../core/EventBus';

type Status = 'idle' | 'listening' | 'processing' | 'speaking' | 'muted';

/**
 * Manages the status bar indicator for Jarvis
 * Shows listening state and provides visual feedback
 */
export class StatusBarManager {
    private statusBarItem: vscode.StatusBarItem;
    private eventBus: EventBus;

    constructor(eventBus: EventBus) {
        this.eventBus = eventBus;
        this.statusBarItem = vscode.window.createStatusBarItem(
            vscode.StatusBarAlignment.Right,
            100
        );
        this.statusBarItem.command = 'jarvis.toggleListening';
        
        this.setupEventListeners();
        this.statusBarItem.show();
    }

    private setupEventListeners(): void {
        this.eventBus.on(EventType.LISTENING_STARTED, () => {
            this.updateStatus('listening');
        });

        this.eventBus.on(EventType.LISTENING_STOPPED, () => {
            this.updateStatus('idle');
        });

        this.eventBus.on(EventType.REQUEST_STARTED, () => {
            this.updateStatus('processing');
        });

        this.eventBus.on(EventType.READING, () => {
            this.updateStatus('speaking');
        });
    }

    updateStatus(status: Status): void {
        // Using ASCII-safe characters per user rules
        switch (status) {
            case 'listening':
                this.statusBarItem.text = '[*] Jarvis Listening';
                this.statusBarItem.backgroundColor = new vscode.ThemeColor(
                    'statusBarItem.warningBackground'
                );
                break;
            case 'processing':
                this.statusBarItem.text = '[~] Jarvis Processing';
                this.statusBarItem.backgroundColor = new vscode.ThemeColor(
                    'statusBarItem.warningBackground'
                );
                break;
            case 'speaking':
                this.statusBarItem.text = '[>] Jarvis Speaking';
                this.statusBarItem.backgroundColor = undefined;
                break;
            case 'muted':
                this.statusBarItem.text = '[X] Jarvis Muted';
                this.statusBarItem.backgroundColor = new vscode.ThemeColor(
                    'statusBarItem.errorBackground'
                );
                break;
            case 'idle':
            default:
                this.statusBarItem.text = '[ ] Jarvis Ready';
                this.statusBarItem.backgroundColor = undefined;
                break;
        }
    }

    dispose(): void {
        this.statusBarItem.dispose();
    }
}
