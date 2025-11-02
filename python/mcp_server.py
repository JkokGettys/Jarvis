"""
MCP Server for Jarvis Voice Assistant
Provides voiceSummary.save tool for Cascade to send structured responses back to Jarvis.
"""
import json
import os
import sys
from typing import List
from mcp.server.fastmcp import FastMCP

# Initialize FastMCP server
mcp = FastMCP("jarvis-voice-summary")

@mcp.tool()
def save(
    tldr: str,
    changes: List[str] = [],
    notes: List[str] = [],
    risks: List[str] = [],
    next_questions: List[str] = [],
    apply_safe: bool = False,
    out_path: str = "",
) -> str:
    """
    Save a machine-readable voice summary for Jarvis to announce.
    
    Args:
        tldr: One-sentence summary for voice readout (keep it conversational)
        changes: List of changes made (e.g., "Created hello.py", "Updated config.json")
        notes: List of findings/observations from analysis (e.g., "Uses Tailwind for styling", "Authentication via JWT tokens")
        risks: List of risks or caveats to mention
        next_questions: Questions for the user to answer
        apply_safe: True if changes are safe to auto-apply without review
        out_path: Custom output path (defaults to ~/.windsurf/jarvis_summary.json)
    
    Returns:
        Confirmation message with file path
    """
    # Default output path
    if not out_path:
        home = os.path.expanduser("~")
        out_path = os.path.join(home, ".windsurf", "jarvis_summary.json")
    
    # Create payload
    payload = {
        "tldr": tldr,
        "changes": changes,
        "notes": notes,
        "risks": risks,
        "next_questions": next_questions,
        "apply_safe": apply_safe,
        "timestamp": __import__("datetime").datetime.now().isoformat()
    }
    
    # Ensure directory exists
    os.makedirs(os.path.dirname(out_path), exist_ok=True)
    
    # Write JSON
    try:
        with open(out_path, "w", encoding="utf-8") as f:
            json.dump(payload, f, ensure_ascii=False, indent=2)
        
        return f"Saved summary to {out_path}"
    except Exception as e:
        return f"Error saving summary: {str(e)}"

def main():
    """Run the MCP server"""
    try:
        # Run the server (stdio transport)
        mcp.run()
    except KeyboardInterrupt:
        print("\nMCP server stopped", file=sys.stderr)
        sys.exit(0)
    except Exception as e:
        print(f"MCP server error: {e}", file=sys.stderr)
        sys.exit(1)

if __name__ == "__main__":
    main()
