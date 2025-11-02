import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

/**
 * Windows API wrapper to focus Windsurf window
 */
export class WindowFocuser {
    
    /**
     * Focus the Extension Development Host window
     * This is where Jarvis extension runs when testing, NOT the main Windsurf window!
     */
    static async focusWindsurf(): Promise<boolean> {
        try {
            // Try Extension Development Host first (this is what we want!)
            const devHostFocused = await this.focusWindowByTitle('Extension Development Host');
            if (devHostFocused) {
                console.log('✅ Focused Extension Development Host window');
                return true;
            }
            
            // Fallback to any Windsurf window
            console.warn('⚠️ Extension Development Host not found, trying main Windsurf...');
            const windsurfFocused = await this.focusWindowByTitle('Windsurf');
            if (windsurfFocused) {
                console.log('✅ Focused main Windsurf window');
                return true;
            }
            
            console.warn('⚠️ Could not focus any Windsurf window');
            return false;
            
        } catch (error) {
            console.error('❌ Failed to focus Windsurf:', error);
            return false;
        }
    }
    
    /**
     * Alternative method using window title pattern matching
     * Uses AppActivate which is simpler and more reliable
     */
    static async focusWindowByTitle(titlePattern: string): Promise<boolean> {
        try {
            // Simpler approach using AppActivate
            const script = `
[void][System.Reflection.Assembly]::LoadWithPartialName('Microsoft.VisualBasic');
$processes = Get-Process | Where-Object { $_.MainWindowTitle -like '*${titlePattern}*' -and $_.MainWindowHandle -ne 0 };
if ($processes) {
    $process = $processes | Select-Object -First 1;
    [Microsoft.VisualBasic.Interaction]::AppActivate($process.Id);
    Write-Output 'SUCCESS';
    exit 0;
} else {
    Write-Output 'ERROR';
    exit 1;
}
            `.trim().replace(/\n/g, ' ');
            
            const { stdout } = await execAsync(`powershell -Command "${script}"`);
            return stdout.trim().includes('SUCCESS');
            
        } catch (error) {
            console.error('Failed to focus window:', error);
            return false;
        }
    }
    
    /**
     * Check if Windsurf is currently focused
     */
    static async isWindsurfFocused(): Promise<boolean> {
        try {
            const script = `
$activeWindow = Add-Type -MemberDefinition @"
    [DllImport("user32.dll")]
    public static extern IntPtr GetForegroundWindow();
"@ -Name Win32 -Namespace User32 -PassThru

$hwnd = $activeWindow::GetForegroundWindow()
$process = Get-Process | Where-Object { $_.MainWindowHandle -eq $hwnd }

if ($process -and $process.ProcessName -like '*Windsurf*') {
    Write-Output "FOCUSED"
} else {
    Write-Output "NOT_FOCUSED"
}
            `.trim();
            
            const { stdout } = await execAsync(`powershell -Command "${script}"`);
            return stdout.includes('FOCUSED');
            
        } catch (error) {
            console.error('Failed to check window focus:', error);
            return false;
        }
    }
}
