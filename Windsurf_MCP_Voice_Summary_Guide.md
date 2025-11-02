# Windsurf + MCP “Voice Summary” Tool — Design & Implementation Guide

> Goal: Don’t scrape Cascade’s UI. Instead, let **Cascade (the MCP client)** call **your MCP server tool** to hand you a structured, machine-readable summary at the end of each run. You can then (locally) editorialize + speak it.

---

## What is MCP (in 20 seconds)

**MCP (Model Context Protocol)** is an open, client–server standard that lets AI apps (the “client,” e.g., Windsurf **Cascade**) call out to **MCP servers** that expose tools. It solves the N×M integration tangle by standardizing tool calls and results.

- Anthropic introduced MCP as an open standard (2024) and it’s now used broadly in agent workflows.  
- **Windsurf Cascade** supports MCP natively, so you can attach your own servers/tools. (Enterprise users may need to enable it in settings.)

---

## Why MCP beats clipboard scraping

- **Structured output** (JSON schema you define) → no brittle DOM/clipboard parsing.  
- **Two-way**: you can add more tools later (e.g., “apply patch,” “open PR,” “run tests”), all via the same protocol.  
- **Interoperable**: the same server can serve other MCP-capable clients, not only Windsurf.

---

## Architecture (minimal)

```
┌────────────────────────┐
│ Windsurf (Cascade)     │  ← MCP client
│  - Your prompt         │
│  - Tool list (from srv)│
└─────────┬──────────────┘
          │ MCP
          ▼
┌────────────────────────┐
│ Your MCP Server        │  ← local process
│  Tool: voiceSummary.save
│   input: { tldr, changes[], ... }
│   effect: writes JSON to ~/.windsurf/last_summary.json
└────────────────────────┘

Then your extension:
- Watches for that file/IPC callback,
- Optionally editorializes locally,
- Speaks the result with local TTS.
```

---

## Step-by-Step Implementation

### 1) Enable MCP in Windsurf (once)

- Open Windsurf settings → **Cascade** → **MCP** and enable MCP integration; then add your MCP server entry (details depend on org setup).

> If you need general MCP orientation or client behavior, see the **MCP site** (“build client” docs).

---

### 2) Create your MCP server (choose Python or Node)

You can build a server in minutes with the official SDKs. Two popular paths:

- **Python – FastMCP**: declarative tools via type hints/docstrings.  
- **Node/TypeScript – @modelcontextprotocol/server**: good if you prefer TS (there are many community examples).

**Python (FastMCP) — minimal “voiceSummary.save”**

```python
# server.py
from typing import List
from mcp.server.fastmcp import FastMCP
import json, os

mcp = FastMCP("voice-summary")

@mcp.tool()
def save(
    tldr: str,
    changes: List[str] = [],
    risks: List[str] = [],
    next_questions: List[str] = [],
    apply_safe: bool = False,
    out_path: str = os.path.expanduser("~/.windsurf/last_summary.json"),
) -> str:
    """Save a machine-readable voice summary for local consumption."""
    payload = {
        "tldr": tldr,
        "changes": changes,
        "risks": risks,
        "next_questions": next_questions,
        "apply_safe": apply_safe
    }
    os.makedirs(os.path.dirname(out_path), exist_ok=True)
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(payload, f, ensure_ascii=False)
    return f"saved:{out_path}"

if __name__ == "__main__":
    mcp.run()  # serves the MCP JSON-RPC over stdio or transport defined by launcher
```

**Node/TS — minimal “voiceSummary.save”**

```ts
// server.ts
import { Server } from "@modelcontextprotocol/sdk/server";
import * as fs from "fs";
import * as path from "path";
const server = new Server({ name: "voice-summary", version: "0.1.0" });

server.tool("save", {
  description: "Save a machine-readable voice summary for local consumption.",
  inputSchema: {
    type: "object",
    properties: {
      tldr: { type: "string" },
      changes: { type: "array", items: { type: "string" } },
      risks: { type: "array", items: { type: "string" } },
      next_questions: { type: "array", items: { type: "string" } },
      apply_safe: { type: "boolean" },
      out_path: { type: "string", default: `${process.env.HOME}/.windsurf/last_summary.json` }
    },
    required: ["tldr"]
  }
}, async (args) => {
  const out = (args.out_path as string) || `${process.env.HOME}/.windsurf/last_summary.json`;
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, JSON.stringify({
    tldr: args.tldr,
    changes: args.changes || [],
    risks: args.risks || [],
    next_questions: args.next_questions || [],
    apply_safe: !!args.apply_safe
  }), "utf8");
  return { ok: true, path: out };
});

server.start(); // expose via stdio/transport chosen by launcher
```

---

### 3) Add a **preamble** so Cascade knows to call your tool

Prepend something like this to **every** Cascade request (your voice layer can inject it automatically):

```
At the end of your run, call the MCP tool:
  voice-summary.save
with the fields:
  - tldr: one-sentence summary for voice readout
  - changes: array of "file: action" strings
  - risks: array of risks or caveats
  - next_questions: array of questions for the user
  - apply_safe: boolean — true if safe to auto-apply the diff

If the MCP tool is unavailable, also include the same payload as a single JSON
fenced block labeled VOICE_SUMMARY_JSON at the very bottom of your reply, with
no commentary after it.
```

---

### 4) Wire the **listener** in your extension

Your extension watches `~/.windsurf/last_summary.json` (or uses an IPC the server exposes) and triggers your **editorializer + TTS** when it changes. (All local, zero cost.)

- This avoids scraping any UI.  
- If you later want more tools (e.g., “open diff,” “run tests”), just add more MCP tool endpoints on the same server.

---

### 5) Test with MCP Inspector (optional but recommended)

Run your MCP server under **Inspector** to validate the tool schema and interactive calls _before_ connecting it to Windsurf.

---

## Hardening & Best Practices

- **Schema discipline.** Keep the `voiceSummary.save` schema simple and stable; evolve with versioned keys if needed.  
- **Security.** Bind any HTTP transports to `127.0.0.1` only; prefer stdio transports when launching the server. MCP itself doesn’t provide enterprise auth; your safety model should assume the client is trusted.  
- **Editorializer local.** Do your rephrasing/shortening locally to ensure $0 voice costs and predictable tone.  
- **Extensibility.** Add more MCP tools later: test runner, linter, “apply patch,” “open PR.”

---

## Troubleshooting

- **Cascade doesn’t call the tool.** Ensure the client (Cascade) has MCP enabled and your server is registered so its tools are advertised.  
- **Tool shows up but gets weird args.** Tighten the tool description and input schema (clear names, required fields) so the model forms correct calls.  
- **You need to test without Windsurf.** Use **MCP Inspector** to simulate calls and validate outputs.

---

## TL;DR Implementation Checklist

1. **Enable MCP** for Cascade in Windsurf; register your **local MCP server**.  
2. Implement MCP server with one tool: `voiceSummary.save(payload)` (Python FastMCP **or** Node).  
3. **Inject a prompt preamble** that instructs Cascade to call the tool at the end (plus a fenced JSON fallback).  
4. In your extension, **watch the summary file** (or IPC) → **editorialize locally** → **TTS read-back**.  
5. Validate tools with **MCP Inspector** during development.

Once this is in place, your “chatting aspect” is fully local and robust—Cascade does the coding, your MCP tool cleanly hands you the response, and your voice layer speaks it back without any scraping.
