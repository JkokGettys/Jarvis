import * as vscode from 'vscode';
import { CascadeBridge } from './cascade/CascadeBridge';
import { VoiceService } from './voice/VoiceService';
import { IntentClassifier } from './orchestrator/IntentClassifier';
import { PromptComposer } from './orchestrator/PromptComposer';
import { Editorializer } from './orchestrator/Editorializer';
import { AnalysisEngine } from './orchestrator/AnalysisEngine';
import { EventBus, EventType } from './core/EventBus';
import { StatusBarManager } from './ui/StatusBarManager';
import { LocalLLMService } from './llm/LocalLLMService';
import { ConversationBuffer } from './voice/ConversationBuffer';
import { MCPWatcher, VoiceSummary } from './mcp/MCPWatcher';

let cascadeBridge: CascadeBridge;
let voiceService: VoiceService;
let intentClassifier: IntentClassifier;
let promptComposer: PromptComposer;
let editorializer: Editorializer;
let analysisEngine: AnalysisEngine;
let eventBus: EventBus;
let statusBarManager: StatusBarManager;
let llmService: LocalLLMService;
let conversationBuffer: ConversationBuffer;
let mcpWatcher: MCPWatcher;

export function activate(context: vscode.ExtensionContext) {
    console.log('Jarvis Voice Assistant is now active');

    // Initialize core services
    eventBus = new EventBus();
    llmService = new LocalLLMService(); // Local LLM for all NL processing
    conversationBuffer = new ConversationBuffer();
    
    // Layer 3: Tool Execution
    cascadeBridge = new CascadeBridge(eventBus);
    
    // Layer 2: Background Analysis Engine
    analysisEngine = new AnalysisEngine(conversationBuffer, llmService);
    
    // Layer 1: Fast Conversational Interface (Python voice service)
    voiceService = new VoiceService(context, eventBus);
    
    // Supporting services
    intentClassifier = new IntentClassifier(llmService);
    promptComposer = new PromptComposer(llmService);
    editorializer = new Editorializer(llmService);
    statusBarManager = new StatusBarManager(eventBus);
    
    // MCP Integration: Listen for Cascade responses
    mcpWatcher = new MCPWatcher();
    mcpWatcher.start((summary: VoiceSummary) => {
        console.log('[Extension] 📢 MCP Summary received from Cascade!');
        console.log(`  TLDR: ${summary.tldr}`);
        
        // Send to voice service for TTS announcement
        voiceService.announceCompletion(summary.tldr, summary.changes, summary.notes, summary.risks, summary.next_questions);
        
        // Don't reset context immediately - let user continue discussing this task
        // Context will auto-reset after 2 minutes of silence (handled in voice service)
        console.log('[Extension] Cascade task complete - context preserved for follow-up questions');
        
        // Show user notification
        vscode.window.showInformationMessage(`Cascade: ${summary.tldr}`);
        
        // Log details for debugging
        if (summary.changes.length > 0) {
            console.log('  Changes:', summary.changes.join(', '));
        }
        if (summary.risks.length > 0) {
            console.log('  Risks:', summary.risks.join(', '));
        }
        if (summary.next_questions.length > 0) {
            console.log('  Questions:', summary.next_questions.join(', '));
        }
    });
    
    console.log(`[Extension] MCP Watcher monitoring: ${mcpWatcher.getSummaryPath()}`);

    // Check if local LLM is available
    llmService.isAvailable().then(available => {
        if (available) {
            vscode.window.showInformationMessage('Jarvis: Local LLM connected');
        } else {
            vscode.window.showWarningMessage(
                'Jarvis: Local LLM not available. Install Ollama or start llama.cpp server. ' +
                'Falling back to heuristic intent classification.'
            );
        }
    });

    // Register commands
    context.subscriptions.push(
        vscode.commands.registerCommand('jarvis.startListening', async () => {
            await voiceService.start();
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('jarvis.stopListening', async () => {
            await voiceService.stop();
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('jarvis.toggleListening', async () => {
            await voiceService.toggle();
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('jarvis.sendPrompt', async () => {
            const prompt = await vscode.window.showInputBox({
                prompt: 'Enter prompt to send to Cascade',
                placeHolder: 'e.g., Add a new API endpoint for user management'
            });
            
            if (prompt) {
                console.log('📥 User input:', prompt);
                
                const structuredPrompt = await promptComposer.compose(prompt);
                console.log('📝 Structured prompt:', structuredPrompt);
                
                if (!structuredPrompt || structuredPrompt.trim().length === 0) {
                    console.error('❌ Structured prompt is empty!');
                    vscode.window.showErrorMessage('Failed to compose prompt');
                    return;
                }
                
                await cascadeBridge.sendPrompt(structuredPrompt);
            } else {
                console.log('⚠️ No prompt entered');
            }
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('jarvis.readLastResponse', async () => {
            const lastResponse = cascadeBridge.getLastResponse();
            if (lastResponse) {
                const summary = await editorializer.summarize(lastResponse);
                // TODO M2: await voiceService.speak(summary);
                console.log('[Extension] Response summary:', summary);
                vscode.window.showInformationMessage(summary);
            } else {
                vscode.window.showInformationMessage('No response available');
            }
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('jarvis.summarizeDiff', async () => {
            // TODO: Implement diff summarization
            vscode.window.showInformationMessage('Diff summarization coming soon');
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('jarvis.toggleMute', async () => {
            await voiceService.toggleMute();
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('jarvis.changeVoice', async () => {
            // Define available Kokoro voices
            const voices = [
                { label: '🇬🇧 Bella (British Female)', description: 'Default - Clear British accent', id: 'af_bella' },
                { label: '🇬🇧 Sarah (British Female)', description: 'Warm and friendly', id: 'af_sarah' },
                { label: '🇺🇸 Nicole (American Female)', description: 'Clear American accent', id: 'af_nicole' },
                { label: '🇺🇸 Sky (American Female)', description: 'Professional and clear', id: 'af_sky' },
                { label: '🇬🇧 Michael (British Male)', description: 'Deep British voice', id: 'am_michael' },
                { label: '🇺🇸 Adam (American Male)', description: 'Professional American voice', id: 'am_adam' },
            ];
            
            const selected = await vscode.window.showQuickPick(voices, {
                placeHolder: 'Select Jarvis voice',
                title: 'Choose TTS Voice'
            });
            
            if (selected) {
                voiceService.changeVoice(selected.id);
                vscode.window.showInformationMessage(`Jarvis voice changed to ${selected.label}`);
            }
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('jarvis.discoverCascade', async () => {
            const commands = await cascadeBridge.discoverCascadeAPI();
            const outputChannel = vscode.window.createOutputChannel('Jarvis Cascade Discovery');
            outputChannel.clear();
            outputChannel.appendLine('=== Available Cascade/Chat Commands ===');
            outputChannel.appendLine('');
            commands.forEach(cmd => outputChannel.appendLine(`  ${cmd}`));
            outputChannel.appendLine('');
            outputChannel.appendLine(`Total: ${commands.length} commands found`);
            outputChannel.show();
            vscode.window.showInformationMessage(`Found ${commands.length} Cascade-related commands. Check Output panel.`);
        })
    );

    // TEST: Test the Ctrl+Shift+I quick chat command
    context.subscriptions.push(
        vscode.commands.registerCommand('jarvis.testQuickChat', async () => {
            const testPrompt = await vscode.window.showInputBox({
                prompt: 'Enter test prompt for Ctrl+Shift+I command',
                value: 'Hello from Jarvis quick chat test'
            });
            
            if (!testPrompt) {
                return;
            }
            
            vscode.window.showInformationMessage('Testing quick chat command... Watch for popup messages!');
            const result = await cascadeBridge.testQuickChatCommand(testPrompt);
            
            if (result.success && result.workingCommand) {
                const msg = `✅ Working command: ${result.workingCommand} (method: ${result.method})`;
                console.log(msg);
                vscode.window.showInformationMessage(msg);
                
                // Show results in output panel
                const outputChannel = vscode.window.createOutputChannel('Jarvis Quick Chat Test');
                outputChannel.clear();
                outputChannel.appendLine('=== QUICK CHAT TEST RESULTS ===\n');
                outputChannel.appendLine(`✅ SUCCESS!\n`);
                outputChannel.appendLine(`Working command: ${result.workingCommand}`);
                outputChannel.appendLine(`Method: ${result.method}`);
                outputChannel.appendLine(`\nTest prompt: "${testPrompt}"`);
                outputChannel.appendLine('\nCheck if the text appeared in the quick chat window!');
                outputChannel.show();
            } else {
                vscode.window.showWarningMessage('❌ Could not trigger quick chat programmatically. Check console.');
            }
        })
    );

    // INVESTIGATE: Comprehensive Cascade integration investigation
    context.subscriptions.push(
        vscode.commands.registerCommand('jarvis.investigateCascade', async () => {
            try {
                vscode.window.showInformationMessage('Investigating Cascade integration... Check console.');
                const results = await cascadeBridge.investigateCascadeIntegration();
                
                const outputChannel = vscode.window.createOutputChannel('Jarvis Cascade Investigation');
                outputChannel.clear();
                outputChannel.appendLine('=== CASCADE INTEGRATION INVESTIGATION ===\n');
                
                outputChannel.appendLine(`📦 Extensions: ${results.extensions.length} found`);
                results.extensions.forEach(ext => {
                    outputChannel.appendLine(`  - ${ext.id}`);
                    outputChannel.appendLine(`    Active: ${ext.isActive}, Exports: ${ext.exports.join(', ') || 'none'}`);
                });
                outputChannel.appendLine('');
                
                outputChannel.appendLine(`🔧 Commands: ${results.commands.length} found`);
                results.commands.forEach(cmd => outputChannel.appendLine(`  - ${cmd}`));
                outputChannel.appendLine('');
                
                outputChannel.appendLine(`📄 Documents: ${results.documents.length} found`);
                results.documents.forEach(doc => outputChannel.appendLine(`  - ${doc.scheme}://${doc.fileName}`));
                outputChannel.appendLine('');
                
                outputChannel.appendLine('🖥️  Webviews:');
                outputChannel.appendLine(JSON.stringify(results.webviews, null, 2));
                outputChannel.appendLine('');
                
                outputChannel.appendLine('💬 Chat API:');
                outputChannel.appendLine(JSON.stringify(results.chatParticipants, null, 2));
                outputChannel.appendLine('');
                
                outputChannel.appendLine('=== Full results also in Developer Console (Ctrl+Shift+I) ===');
                outputChannel.show();
                
                vscode.window.showInformationMessage('Investigation complete! Check Output panel and Developer Console.');
            } catch (error) {
                const errorMsg = error instanceof Error ? error.message : String(error);
                console.error('Investigation error:', error);
                vscode.window.showErrorMessage(`Investigation failed: ${errorMsg}. Check Developer Console for details.`);
            }
        })
    );

    // TEST: Test different methods to send messages to Cascade
    context.subscriptions.push(
        vscode.commands.registerCommand('jarvis.testCascadeMethods', async () => {
            try {
                const testPrompt = await vscode.window.showInputBox({
                    prompt: 'Enter test prompt to send to Cascade',
                    value: 'Hello from Jarvis test'
                });
                
                if (!testPrompt) {
                    return;
                }
                
                vscode.window.showInformationMessage('Testing Cascade message methods... Check console.');
                const results = await cascadeBridge.testCascadeMessageMethods(testPrompt);
                
                const outputChannel = vscode.window.createOutputChannel('Jarvis Cascade Method Test');
                outputChannel.clear();
                outputChannel.appendLine('=== CASCADE MESSAGE METHOD TEST RESULTS ===\n');
                outputChannel.appendLine(`Test prompt: "${testPrompt}"\n`);
                
                const successful = results.filter(r => r.success);
                const failed = results.filter(r => !r.success);
                
                if (successful.length > 0) {
                    outputChannel.appendLine('✅ SUCCESSFUL METHODS:\n');
                    successful.forEach(r => outputChannel.appendLine(`  ✓ ${r.method}`));
                    outputChannel.appendLine('');
                    vscode.window.showInformationMessage(`🎉 Found working method: ${successful[0].method}!`);
                }
                
                if (failed.length > 0) {
                    outputChannel.appendLine('❌ FAILED METHODS:\n');
                    failed.forEach(r => {
                        outputChannel.appendLine(`  ✗ ${r.method}`);
                        if (r.error) {
                            outputChannel.appendLine(`    Error: ${r.error}`);
                        }
                    });
                }
                
                outputChannel.appendLine('\n=== Full results also in Developer Console (Ctrl+Shift+I) ===');
                outputChannel.show();
                
                if (successful.length === 0) {
                    vscode.window.showWarningMessage('No working method found. See Output panel for details.');
                }
            } catch (error) {
                const errorMsg = error instanceof Error ? error.message : String(error);
                console.error('Test methods error:', error);
                vscode.window.showErrorMessage(`Test failed: ${errorMsg}. Check Developer Console for details.`);
            }
        })
    );

    // VIEW COMMAND: View last MCP summary
    context.subscriptions.push(
        vscode.commands.registerCommand('jarvis.viewLastMCPSummary', async () => {
            const summary = await mcpWatcher.checkForSummary();
            
            if (summary) {
                const outputChannel = vscode.window.createOutputChannel('Jarvis MCP Summary');
                outputChannel.clear();
                outputChannel.appendLine('=== Latest MCP Summary from Cascade ===');
                outputChannel.appendLine('');
                outputChannel.appendLine(`📢 TLDR: ${summary.tldr}`);
                outputChannel.appendLine('');
                
                if (summary.changes.length > 0) {
                    outputChannel.appendLine('📝 Changes:');
                    summary.changes.forEach(change => outputChannel.appendLine(`  • ${change}`));
                    outputChannel.appendLine('');
                }
                
                if (summary.risks.length > 0) {
                    outputChannel.appendLine('⚠️ Risks:');
                    summary.risks.forEach(risk => outputChannel.appendLine(`  • ${risk}`));
                    outputChannel.appendLine('');
                }
                
                if (summary.next_questions.length > 0) {
                    outputChannel.appendLine('❓ Next Questions:');
                    summary.next_questions.forEach(q => outputChannel.appendLine(`  • ${q}`));
                    outputChannel.appendLine('');
                }
                
                outputChannel.appendLine(`✅ Apply Safe: ${summary.apply_safe}`);
                outputChannel.appendLine(`🕐 Timestamp: ${summary.timestamp}`);
                outputChannel.appendLine('');
                outputChannel.appendLine(`📁 File: ${mcpWatcher.getSummaryPath()}`);
                outputChannel.appendLine('');
                outputChannel.appendLine('=== What Jarvis Announces ===');
                
                // Show what actually gets announced (matching Python logic)
                let announcement = summary.tldr;
                
                // Smart change reporting: read up to 3, or first 3 if >3
                if (summary.changes.length > 0) {
                    if (summary.changes.length <= 3) {
                        announcement += '. ';
                        summary.changes.forEach((change, i) => {
                            if (i === 0) {
                                announcement += change;
                            } else if (i === summary.changes.length - 1) {
                                announcement += `, and ${change}`;
                            } else {
                                announcement += `, ${change}`;
                            }
                        });
                    } else {
                        // Too many changes - read first 3 and mention there are more
                        announcement += '. ';
                        for (let i = 0; i < 3; i++) {
                            if (i === 0) {
                                announcement += summary.changes[i];
                            } else if (i === 2) {
                                announcement += `, and ${summary.changes[i]}`;
                            } else {
                                announcement += `, ${summary.changes[i]}`;
                            }
                        }
                        const remaining = summary.changes.length - 3;
                        announcement += `, and ${remaining} more change${remaining > 1 ? 's' : ''}`;
                    }
                }
                
                // Smart notes reporting (for analysis): read up to 4, or first 3 if >4
                if (summary.notes && summary.notes.length > 0) {
                    if (summary.notes.length <= 4) {
                        announcement += '. ';
                        summary.notes.forEach((note, i) => {
                            if (i === 0) {
                                announcement += note;
                            } else if (i === summary.notes.length - 1) {
                                announcement += `, and ${note}`;
                            } else {
                                announcement += `, ${note}`;
                            }
                        });
                    } else {
                        // Too many notes - read first 3 and mention there are more
                        announcement += '. ';
                        for (let i = 0; i < 3; i++) {
                            if (i === 0) {
                                announcement += summary.notes[i];
                            } else if (i === 2) {
                                announcement += `, and ${summary.notes[i]}`;
                            } else {
                                announcement += `, ${summary.notes[i]}`;
                            }
                        }
                        const remaining = summary.notes.length - 3;
                        announcement += `. There are ${remaining} more important things that need further investigation`;
                    }
                }
                
                // Risks
                if (summary.risks.length > 0) {
                    announcement += `. Note: ${summary.risks.length} potential risk${summary.risks.length > 1 ? 's' : ''}`;
                }
                
                // Next questions
                if (summary.next_questions.length > 0) {
                    announcement += '. ';
                    summary.next_questions.forEach((question, i) => {
                        if (i === 0) {
                            announcement += question;
                        } else {
                            announcement += ` Also, ${question}`;
                        }
                    });
                }
                
                outputChannel.appendLine(`🎤 "${announcement}"`);
                
                outputChannel.show();
                vscode.window.showInformationMessage('MCP Summary opened in Output panel');
            } else {
                vscode.window.showWarningMessage('No MCP summary found. Cascade hasn\'t completed any tasks yet.');
            }
        })
    );

    // TEST COMMAND: Test MCP fallback JSON parser
    context.subscriptions.push(
        vscode.commands.registerCommand('jarvis.testMCPParser', async () => {
            // Sample Cascade response with VOICE_SUMMARY_JSON block
            const sampleResponse = `Created hello_world.py with the requested print("Hello, World!") statement.

\`\`\`VOICE_SUMMARY_JSON
{
  "tldr": "Added a simple Python Hello World script to the project.",
  "changes": ["hello_world.py: created file with hello world print"],
  "risks": [],
  "next_questions": [],
  "apply_safe": true
}
\`\`\``;

            const summary = MCPWatcher.parseVoiceSummaryFromText(sampleResponse);
            
            if (summary) {
                console.log('[Extension] ✅ Parsed fallback JSON:', summary);
                voiceService.announceCompletion(summary.tldr, summary.changes, summary.notes, summary.risks, summary.next_questions);
                vscode.window.showInformationMessage(`MCP Parser Test: ${summary.tldr}`);
            } else {
                console.error('[Extension] ❌ Failed to parse fallback JSON');
                vscode.window.showErrorMessage('MCP Parser Test: Failed to parse');
            }
        })
    );

    // TEST COMMAND: Simulate conversations
    context.subscriptions.push(
        vscode.commands.registerCommand('jarvis.testConversation', async () => {
            // Import dynamically inside command handler
            const { ConversationBuffer } = await import('./voice/ConversationBuffer');
            const { ConversationSimulator } = await import('./test/ConversationSimulator');
            
            const testBuffer = new ConversationBuffer();
            const conversationSimulator = new ConversationSimulator(
                testBuffer,
                intentClassifier,
                promptComposer,
                cascadeBridge
            );

            const scenario = await vscode.window.showQuickPick(
                ['bugfix', 'feature', 'exploration'],
                { placeHolder: 'Choose a conversation scenario to test' }
            );
            
            if (scenario) {
                await conversationSimulator.runScenario(scenario as 'bugfix' | 'feature' | 'exploration');
            }
        })
    );

    // ========== UNIFIED LLM APPROACH ==========
    
    // Single LLM call in Python returns both response and instruction
    // If instruction present, send directly to Cascade (bypass Layer 2 analysis)
    voiceService.onInstruction(async (instruction: string) => {
        console.log('[Extension] 🎯 UNIFIED LLM → CASCADE: Instruction received!');
        console.log(`  Instruction: "${instruction}"`);
        
        // Compose prompt for Cascade (light enhancement)
        const structuredPrompt = await promptComposer.compose(instruction);
        
        if (structuredPrompt && structuredPrompt.trim().length > 0) {
            console.log('[Extension] Sending to Cascade:', structuredPrompt.substring(0, 100) + '...');
            
            // Invoke Cascade (async, non-blocking)
            await cascadeBridge.sendPrompt(structuredPrompt);
            
            vscode.window.showInformationMessage('Jarvis: Working on that now...');
        } else {
            console.error('[Extension] Failed to compose prompt');
        }
    });
    
    // LEGACY: Keep Layer 1 → Layer 2 for backward compatibility (can be removed later)
    voiceService.onConversationTurn(async (userText: string, jarvisResponse: string) => {
        console.log('[Extension] [LEGACY] Layer 1 → Layer 2: Conversation turn (unified approach preferred)');
        // Old Layer 2 analysis can be disabled - unified approach handles it
        // await analysisEngine.processConversationTurn(userText, jarvisResponse);
    });

    // Set up event handlers
    eventBus.on(EventType.UTTERANCE_CAPTURED, async (data: { text: string }) => {
        const intent = await intentClassifier.classify(data.text);
        
        if (intent.type === 'actionable' || intent.type === 'confirmation') {
            const structuredPrompt = await promptComposer.compose(data.text, intent);
            await cascadeBridge.sendPrompt(structuredPrompt);
        }
    });

    eventBus.on(EventType.RESPONSE_READY, async (data: { response: string }) => {
        const summary = await editorializer.summarize(data.response);
        // TODO M2: await voiceService.speak(summary);
        console.log('[Extension] Cascade response summary:', summary);
    });

    // Monitor terminal output to detect commands in real-time
    // This catches PowerShell Invoke-Expression commands that Cascade runs
    console.log('[Extension] 🚀 SETTING UP TERMINAL MONITORING...');
    let lastAnnouncedCommand = '';
    const announcedCommands = new Set<string>();
    
    // Helper to check and announce commands
    const checkAndAnnounceCommand = (text: string) => {
        console.log('[Extension] 📡 Terminal data received:', text.substring(0, 100));
        // Look for PowerShell Invoke-Expression pattern
        const patterns = [
            /Invoke-Expression\s+"([^"]+)"/,
            /PS\s+[^>]+>\s+(.+?)(?:\r|\n|$)/,  // PowerShell prompt pattern
            /^\s*([a-z]+(?:\s+[a-z-]+)*)\s*$/i  // Simple command pattern
        ];
        
        for (const pattern of patterns) {
            const match = text.match(pattern);
            if (match) {
                const command = match[1].trim();
                
                // Only announce if we haven't recently
                const commandKey = command.toLowerCase();
                if (!announcedCommands.has(commandKey) && command !== lastAnnouncedCommand) {
                    const naturalAnnouncement = convertCommandToNaturalSpeech(command);
                    
                    if (naturalAnnouncement) {
                        console.log('[Extension] 🎤 Terminal command detected:', command);
                        console.log('[Extension] 🎤 Announcing:', naturalAnnouncement);
                        voiceService.announceCompletion(naturalAnnouncement);
                        lastAnnouncedCommand = command;
                        announcedCommands.add(commandKey);
                        
                        // Clear from set after 5 seconds to allow re-announcement
                        setTimeout(() => announcedCommands.delete(commandKey), 5000);
                    }
                }
                break;
            }
        }
    };
    
    // Try shell execution events - these might be stable APIs
    console.log('[Extension] 🔍 Trying shell execution events...');
    
    try {
        // Try onDidStartTerminalShellExecution - this fires when commands start
        const startExecutionDisposable = (vscode.window as any).onDidStartTerminalShellExecution?.((event: any) => {
            console.log('[Extension] 🎯 Shell execution started!');
            
            // Try to extract command
            const execution = event?.execution;
            const command = execution?.commandLine?.value || execution?.commandLine;
            
            if (command && typeof command === 'string') {
                console.log('[Extension] 🎤 Command starting:', command);
                
                const cleanCommand = command.replace(/^Invoke-Expression\s+"?|"$/g, '').trim();
                const commandKey = cleanCommand.toLowerCase();
                
                if (!announcedCommands.has(commandKey)) {
                    const naturalAnnouncement = convertCommandToNaturalSpeech(cleanCommand);
                    
                    if (naturalAnnouncement) {
                        console.log('[Extension] 🎤 Announcing:', naturalAnnouncement);
                        voiceService.announceCompletion(naturalAnnouncement);
                        announcedCommands.add(commandKey);
                        setTimeout(() => announcedCommands.delete(commandKey), 5000);
                    }
                }
            }
        });
        
        if (startExecutionDisposable) {
            context.subscriptions.push(startExecutionDisposable);
            console.log('[Extension] ✅ Monitoring via onDidStartTerminalShellExecution');
        }
    } catch (err) {
        console.error('[Extension] ❌ Shell execution monitoring failed:', err);
        console.log('[Extension] ⚠️ Real-time command announcements unavailable - falling back to MCP summaries only');
    }
    
    // Fallback: Monitor active terminal changes
    context.subscriptions.push(
        vscode.window.onDidChangeActiveTerminal((terminal) => {
            if (terminal) {
                console.log('[Extension] Active terminal changed:', terminal.name);
            }
        })
    );

    // Initialize services
    statusBarManager.updateStatus('idle');

    vscode.window.showInformationMessage('Jarvis Voice Assistant activated');
}

/**
 * Extract command announcements from Cascade change descriptions
 */
function extractCommandAnnouncement(changeText: string): string | null {
    const text = changeText.toLowerCase();
    
    // Look for command patterns in change descriptions
    if (text.includes('npm install') || text.includes('installing dependencies')) {
        return "I'm installing the dependencies";
    }
    if (text.includes('npm run dev') || text.includes('starting dev server')) {
        return "Starting the development server";
    }
    if (text.includes('npm run build') || text.includes('building')) {
        return "Building the project";
    }
    
    return null;
}

/**
 * Convert technical terminal commands to natural speech
 */
function convertCommandToNaturalSpeech(command: string): string | null {
    const cmd = command.trim().toLowerCase();
    
    // npm/yarn commands
    if (cmd.includes('npm install') || cmd.includes('npm i ')) {
        return "I'm installing the dependencies now";
    }
    if (cmd.includes('npm run dev') || cmd.includes('npm start')) {
        return "I'm starting the development server";
    }
    if (cmd.includes('npm run build')) {
        return "I'm building the project now";
    }
    if (cmd.includes('npm test') || cmd.includes('npm run test')) {
        return "I'm running the tests";
    }
    if (cmd.includes('yarn install')) {
        return "I'm installing the dependencies now";
    }
    if (cmd.includes('yarn dev') || cmd.includes('yarn start')) {
        return "I'm starting the development server";
    }
    if (cmd.includes('yarn build')) {
        return "I'm building the project now";
    }
    if (cmd.includes('yarn test')) {
        return "I'm running the tests";
    }
    
    // git commands
    if (cmd.includes('git commit')) {
        return "I'm committing the changes";
    }
    if (cmd.includes('git push')) {
        return "I'm pushing to the remote repository";
    }
    if (cmd.includes('git pull')) {
        return "I'm pulling the latest changes";
    }
    if (cmd.includes('git clone')) {
        return "I'm cloning the repository";
    }
    
    // python/pip commands
    if (cmd.includes('pip install')) {
        return "I'm installing the Python packages";
    }
    if (cmd.includes('python ') && (cmd.includes('test') || cmd.includes('_test.py'))) {
        return "I'm running a test script now";
    }
    if (cmd.includes('python ') && cmd.includes('.py')) {
        return "I'm running a Python script";
    }
    if (cmd.includes('pytest')) {
        return "I'm running the Python tests";
    }
    
    // build tools
    if (cmd.includes('tsc') || cmd.includes('typescript')) {
        return "I'm compiling the TypeScript";
    }
    if (cmd.includes('webpack')) {
        return "I'm bundling with Webpack";
    }
    if (cmd.includes('vite build')) {
        return "I'm building with Vite";
    }
    
    // database migrations
    if (cmd.includes('migrate') || cmd.includes('migration')) {
        return "I'm running the database migration";
    }
    
    // docker
    if (cmd.includes('docker build')) {
        return "I'm building the Docker image";
    }
    if (cmd.includes('docker-compose up')) {
        return "I'm starting the Docker containers";
    }
    
    // Don't announce everything - only meaningful dev commands
    return null;
}

export function deactivate() {
    if (voiceService) {
        voiceService.dispose();
    }
    if (statusBarManager) {
        statusBarManager.dispose();
    }
}
