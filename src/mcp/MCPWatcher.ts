/**
 * MCPWatcher - Monitors for MCP responses from Cascade
 * Watches ~/.windsurf/jarvis_summary.json for changes and triggers announcements
 */
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import * as vscode from 'vscode';

export interface VoiceSummary {
    tldr: string;
    changes: string[];
    notes: string[];
    risks: string[];
    next_questions: string[];
    apply_safe: boolean;
    timestamp: string;
}

export class MCPWatcher {
    private watcher: fs.FSWatcher | null = null;
    private summaryPath: string;
    private lastProcessedTimestamp: string = '';
    private onSummaryCallback: ((summary: VoiceSummary) => void) | null = null;

    constructor() {
        // Default path: ~/.windsurf/jarvis_summary.json
        const homeDir = os.homedir();
        this.summaryPath = path.join(homeDir, '.windsurf', 'jarvis_summary.json');
    }

    /**
     * Start watching for MCP responses
     */
    public start(onSummary: (summary: VoiceSummary) => void): void {
        this.onSummaryCallback = onSummary;

        // Ensure directory exists
        const dir = path.dirname(this.summaryPath);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }

        // Watch for file changes
        try {
            this.watcher = fs.watch(this.summaryPath, (eventType) => {
                if (eventType === 'change') {
                    this.handleFileChange();
                }
            });

            console.log(`[MCPWatcher] Watching for MCP responses at: ${this.summaryPath}`);
        } catch (error) {
            // File doesn't exist yet, that's okay - watch the directory instead
            console.log(`[MCPWatcher] Summary file doesn't exist yet, will be created on first response`);
            this.watchDirectory();
        }
    }

    /**
     * Watch the directory for file creation
     */
    private watchDirectory(): void {
        const dir = path.dirname(this.summaryPath);
        const filename = path.basename(this.summaryPath);

        try {
            this.watcher = fs.watch(dir, (eventType, changedFile) => {
                if (changedFile === filename) {
                    // File was created or modified
                    this.handleFileChange();
                    
                    // Switch to watching the file directly
                    if (this.watcher) {
                        this.watcher.close();
                    }
                    this.watcher = fs.watch(this.summaryPath, (evt) => {
                        if (evt === 'change') {
                            this.handleFileChange();
                        }
                    });
                }
            });
        } catch (error) {
            console.error('[MCPWatcher] Error watching directory:', error);
        }
    }

    /**
     * Handle file change event
     */
    private handleFileChange(): void {
        // Debounce - wait a bit for the file write to complete
        setTimeout(() => {
            this.processSummaryFile();
        }, 100);
    }

    /**
     * Read and process the summary file
     */
    private processSummaryFile(): void {
        try {
            if (!fs.existsSync(this.summaryPath)) {
                return;
            }

            const content = fs.readFileSync(this.summaryPath, 'utf-8');
            const summary: VoiceSummary = JSON.parse(content);

            // Check if this is a new summary (avoid processing duplicates)
            if (summary.timestamp === this.lastProcessedTimestamp) {
                return;
            }

            this.lastProcessedTimestamp = summary.timestamp;

            // Trigger callback
            if (this.onSummaryCallback) {
                console.log('[MCPWatcher] New summary received:', summary.tldr);
                this.onSummaryCallback(summary);
            }

        } catch (error) {
            console.error('[MCPWatcher] Error processing summary file:', error);
        }
    }

    /**
     * Stop watching
     */
    public stop(): void {
        if (this.watcher) {
            this.watcher.close();
            this.watcher = null;
            console.log('[MCPWatcher] Stopped watching for MCP responses');
        }
    }

    /**
     * Get the summary file path
     */
    public getSummaryPath(): string {
        return this.summaryPath;
    }

    /**
     * Manually check for a summary (useful for testing)
     */
    public async checkForSummary(): Promise<VoiceSummary | null> {
        try {
            if (!fs.existsSync(this.summaryPath)) {
                return null;
            }

            const content = fs.readFileSync(this.summaryPath, 'utf-8');
            const summary: VoiceSummary = JSON.parse(content);
            return summary;
        } catch (error) {
            console.error('[MCPWatcher] Error reading summary:', error);
            return null;
        }
    }

    /**
     * Parse fallback JSON block from Cascade response text
     * Used when MCP tool is unavailable and Cascade outputs VOICE_SUMMARY_JSON block
     */
    public static parseVoiceSummaryFromText(text: string): VoiceSummary | null {
        try {
            // Look for VOICE_SUMMARY_JSON fenced block
            const jsonBlockMatch = text.match(/```VOICE_SUMMARY_JSON\s*\n([\s\S]*?)\n```/);
            
            if (!jsonBlockMatch) {
                return null;
            }

            const jsonStr = jsonBlockMatch[1].trim();
            const parsed = JSON.parse(jsonStr);

            // Add timestamp if not present
            if (!parsed.timestamp) {
                parsed.timestamp = new Date().toISOString();
            }

            return parsed as VoiceSummary;
        } catch (error) {
            console.error('[MCPWatcher] Failed to parse fallback JSON:', error);
            return null;
        }
    }
}
