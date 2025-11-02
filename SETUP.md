# Setup Guide

## Quick Start

Follow these steps to get Jarvis running:

### 1. Install Node.js Dependencies

```powershell
cd c:\DevMode\Jarvis
npm install
```

This will install:
- TypeScript compiler
- VS Code extension types
- ESLint and other dev tools

### 2. Compile TypeScript

```powershell
npm run compile
```

This compiles all `.ts` files in `src/` to JavaScript in `out/`.

### 3. Open in Windsurf

1. Open Windsurf
2. Go to `File > Open Folder...`
3. Select `c:\DevMode\Jarvis`

### 4. Launch Extension Development Host

Press `F5` in Windsurf. This will:
- Compile the extension
- Open a new Windsurf window with your extension loaded
- Attach the debugger

### 5. Test Basic Functionality

In the Extension Development Host window:

1. Open the Command Palette (`Ctrl+Shift+P`)
2. Type "Jarvis" to see available commands
3. Try "Jarvis: Send Prompt to Cascade"
4. Check the status bar for "[  ] Jarvis Ready"

## Current State (M0, M1, M2 Complete)

Jarvis is fully functional! ✅

**What Works:**
- ✅ Continuous voice conversation
- ✅ Wake word detection ("Hey Jarvis")
- ✅ Speech-to-text (Faster-Whisper GPU)
- ✅ Text-to-speech (Kokoro British accent)
- ✅ Cascade integration (keyboard automation)
- ✅ MCP bidirectional communication
- ✅ Structured voice announcements
- ✅ Context-aware dialogue
- ✅ Follow-up question handling

**Not Yet Implemented:**
- Barge-in support (M3)
- Multi-language (M3)
- Additional MCP tools (M3)

## Python Dependencies (Required)

**Install Python 3.8+**
```powershell
# Check if installed
python --version

# If not, download from python.org
```

**Install Voice Services**
```powershell
cd c:\DevMode\Jarvis\python
pip install -r requirements.txt
```

This installs:
- `faster-whisper` - GPU-accelerated STT
- `kokoro-onnx` - Neural TTS
- `openwakeword` - Wake word detection
- `sounddevice` - Audio I/O
- `fastmcp` - MCP server
- `pyaudio` - Audio capture
- `numpy` - Audio processing

**Download Kokoro Models**

Place these in `c:\DevMode\Jarvis\python\`:
- `kokoro-v1.0.onnx`
- `voices-v1.0.bin`

From: https://github.com/thewh1teagle/kokoro-onnx

## Troubleshooting

### "Cannot find module 'vscode'"

This is normal before running `npm install`. Fix:
```powershell
npm install
```

### Extension doesn't load

1. Check Output panel for errors
2. Verify `package.json` activation events
3. Try reloading the window (`Ctrl+R`)

### "Command not found"

1. Ensure extension is activated
2. Check the Extension Host output log
3. Verify commands are registered in `package.json`

## Development Workflow

### Making Changes

1. Edit source files in `src/`
2. Save (auto-compile if watch mode is on)
3. Reload Extension Development Host (`Ctrl+R`)

### Watch Mode (Recommended)

In a terminal:
```powershell
npm run watch
```

This auto-compiles on file save.

### Debugging

1. Set breakpoints in `.ts` files
2. Press `F5` to start debugging
3. Breakpoints will hit in the Extension Development Host

## Next Steps for Development

### M3 - Advanced Features

1. Implement barge-in support (interrupt Jarvis mid-speech)
2. Add multi-language support
3. Create additional MCP tools (test runner, linter)
4. Workspace context injection
5. Auto-attach relevant files

### M4 - Packaging

1. Create VSIX package
2. Settings UI improvements
3. Documentation polish
4. Distribution preparation

## Structure Overview

```
Jarvis/
├── src/                    # TypeScript source
│   ├── extension.ts        # Entry point
│   ├── core/              # Core systems
│   ├── cascade/           # Cascade integration
│   ├── voice/             # Voice I/O (M1/M2)
│   ├── orchestrator/      # NL processing
│   └── ui/                # Status bar, etc.
├── out/                   # Compiled JavaScript (gitignored)
├── node_modules/          # NPM packages (gitignored)
├── package.json           # Extension manifest
├── tsconfig.json          # TypeScript config
└── README.md              # Main documentation
```

## Resources

- [VS Code Extension API](https://code.visualstudio.com/api)
- [Windsurf Documentation](https://docs.windsurf.com)
- [ProjectScope.md](./ProjectScope.md) - Full technical spec
