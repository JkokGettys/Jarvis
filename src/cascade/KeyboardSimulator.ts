import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

/**
 * Native Windows keyboard simulation using PowerShell
 * Fallback for when VS Code commands don't work
 */
export class KeyboardSimulator {
    
    /**
     * Send Ctrl+V to paste from clipboard
     * Uses the same reliable method as typeText
     */
    static async pasteFromClipboard(): Promise<void> {
        try {
            // Use PowerShell to send Ctrl+V more reliably
            // This matches the method used in typeText which we know works
            const script = `Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.SendKeys]::SendWait('^v')`;
            await execAsync(`powershell -Command "${script}"`);
            console.log('  ✓ Ctrl+V sent via PowerShell');
        } catch (error) {
            console.error('Failed to simulate Ctrl+V:', error);
            throw error;
        }
    }
    
    /**
     * Send Enter key to submit
     */
    static async pressEnter(): Promise<void> {
        try {
            await execAsync(`powershell -Command "Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.SendKeys]::SendWait('{ENTER}')"`);
            console.log('  ✓ Enter keystroke sent');
        } catch (error) {
            console.error('Failed to simulate Enter:', error);
            throw error;
        }
    }
    
    /**
     * Send Ctrl+L to focus cascade chat
     * Note: This sends keystrokes to whatever window is currently focused!
     */
    static async focusCascadeChat(): Promise<void> {
        // Simple approach - just send Ctrl+L to the focused window
        try {
            await execAsync(`powershell -Command "Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.SendKeys]::SendWait('^l')"`);
        } catch (error) {
            console.error('Failed to send Ctrl+L:', error);
            throw error;
        }
    }
    
    /**
     * Send Ctrl+Shift+I to open quick chat
     * Note: This sends keystrokes to whatever window is currently focused!
     */
    static async openQuickChat(): Promise<void> {
        try {
            await execAsync(`powershell -Command "Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.SendKeys]::SendWait('^+i')"`);
            console.log('  ✓ Ctrl+Shift+I keystroke sent');
        } catch (error) {
            console.error('Failed to send Ctrl+Shift+I:', error);
            throw error;
        }
    }
    
    /**
     * Sanitize text to remove problematic Unicode characters that cause encoding issues
     */
    private static sanitizeText(text: string): string {
        return text
            // Replace em-dash and en-dash with regular dash
            .replace(/[\u2013\u2014]/g, '-')
            // Replace smart quotes with regular quotes
            .replace(/[\u201C\u201D]/g, '"')
            .replace(/[\u2018\u2019]/g, "'")
            // Replace ellipsis with three periods
            .replace(/\u2026/g, '...')
            // Replace non-breaking space with regular space
            .replace(/\u00A0/g, ' ')
            // Remove any other problematic characters
            .replace(/[\u0080-\u009F]/g, '');
    }

    /**
     * Send text by typing it character by character
     * For simplicity, we'll just use clipboard + paste
     */
    static async typeText(text: string): Promise<void> {
        try {
            // Sanitize text first to prevent encoding issues
            const sanitizedText = this.sanitizeText(text);
            
            // Write text to a temp file to avoid escaping issues
            const fs = require('fs');
            const path = require('path');
            const os = require('os');
            
            const tempFile = path.join(os.tmpdir(), `jarvis-prompt-${Date.now()}.txt`);
            fs.writeFileSync(tempFile, sanitizedText, 'utf-8');
            
            // Use PowerShell to read file with explicit UTF-8 encoding, set clipboard, and paste
            const script = `Get-Content -Path '${tempFile}' -Raw -Encoding UTF8 | Set-Clipboard; Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.SendKeys]::SendWait('^v')`;
            
            await execAsync(`powershell -Command "${script}"`);
            console.log('  ✓ Text pasted from temp file');
            
            // Clean up temp file
            try {
                fs.unlinkSync(tempFile);
            } catch (e) {
                // Ignore cleanup errors
            }
            
        } catch (error) {
            console.error('Failed to paste text:', error);
            throw error;
        }
    }
    
    /**
     * Full sequence: Paste and submit
     */
    static async pasteAndSubmit(): Promise<void> {
        await this.pasteFromClipboard();
        await this.delay(100);
        await this.pressEnter();
    }
    
    private static delay(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}
