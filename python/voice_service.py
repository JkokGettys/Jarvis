#!/usr/bin/env python3
"""
Voice Service for Jarvis VSCode Extension - Layer 1: Fast Conversational Interface

Responsibilities:
- Hotword detection (openWakeWord: "Hey Jarvis")
- Voice Activity Detection (WebRTC VAD)
- Speech-to-Text (Faster-Whisper on GPU)
- Fast conversational responses (GPT-OSS)
- Text-to-Speech (Kokoro TTS)
- Stream transcripts to TypeScript for deep analysis
- IPC with TypeScript via JSON over stdout

Message format to TypeScript:
{"type": "transcription", "text": "user said this"}
{"type": "transcript_with_response", "user_text": "...", "jarvis_response": "..."}
{"type": "jarvis_speaking", "text": "jarvis said this"}
{"type": "hotword_detected"}
{"type": "listening"}
{"type": "silence"}
{"type": "error", "message": "error details"}
"""

import sys
import json
import time
import threading
import queue
import re
import requests
from typing import Optional
from pathlib import Path

# Audio processing
import pyaudio
import numpy as np
import sounddevice as sd

# Hotword detection (not used yet in continuous mode)
# from openwakeword.model import Model as WakeWordModel

# Speech-to-text
from faster_whisper import WhisperModel

# Text-to-speech
from kokoro_onnx import Kokoro


class VoiceService:
    def __init__(self, 
                 whisper_model: str = "tiny",
                 silence_timeout: float = 1.0,
                 ollama_url: str = "http://localhost:11434",
                 kokoro_model_path: str = None,
                 kokoro_voices_path: str = None):
        """
        Initialize voice service (continuous mode with energy-based VAD)
        
        Args:
            whisper_model: Whisper model size (tiny/base/small/medium/large-v3)
            silence_timeout: Seconds of silence before finalizing transcription
            ollama_url: URL for Ollama API (GPT-OSS)
            kokoro_model_path: Path to Kokoro ONNX model
            kokoro_voices_path: Path to Kokoro voices bin
        """
        self.whisper_model_name = whisper_model
        self.silence_timeout = silence_timeout
        self.ollama_url = ollama_url
        self.kokoro_model_path = kokoro_model_path
        self.kokoro_voices_path = kokoro_voices_path
        
        # State
        self.is_muted = False
        self.should_stop = False
        
        # Audio configuration
        self.sample_rate = 16000
        
        # Conversation history for Layer 1 fast responses
        self.conversation_turns = []
        self.max_turns = 8  # Keep last 8 turns for better context (increased from 4)
        self.last_activity_time = time.time()  # Track when to auto-reset context
        self.context_timeout = 120  # Reset context after 2 minutes of silence
        
        # TTS voice selection
        self.current_voice = 'af_bella'  # Default British female voice
        
        # Components (initialized in start())
        self.whisper_model: Optional[WhisperModel] = None
        self.kokoro_tts: Optional[Kokoro] = None
        self.audio_stream: Optional[pyaudio.Stream] = None
        self.pyaudio_instance: Optional[pyaudio.PyAudio] = None
        
        # System prompt for unified dual-output format (MINIMAL "vibe-coder" style)
        self.system_prompt = """You are Jarvis, a British coding assistant. You respond in TWO parts:

[ANSWER] - What you SAY to the user (MAX 3 SENTENCES, brief and conversational)
[INSTRUCTION] - What to send to the code agent (high-level only)

CRITICAL RULES:
1. Always include [ANSWER]
2. [ANSWER] must be 3 sentences or fewer (unless reading MCP completion reports)
3. Include [INSTRUCTION] for ANY action request - not just file changes
4. If user says DO something (push, commit, deploy, install, run, etc.) → send [INSTRUCTION]
5. If user asks HOW/WHAT/WHY → respond with [ANSWER] only, no [INSTRUCTION]
6. [INSTRUCTION] should be concise and high-level
7. Trust the code agent to figure out implementation details

ACTION PHRASES (always send [INSTRUCTION]):
- "push to github" / "commit" / "deploy" 
- "install" / "run" / "build" / "test"
- "add" / "remove" / "delete" / "update"
- "create" / "make" / "set up" / "fix"

FOLLOW-UP AFFIRMATIONS (treat as action commands):
- If you JUST asked "Would you like me to X?" and user says "yes"/"yeah"/"please do"/"go ahead"/"sure" → send [INSTRUCTION] to do X
- Check conversation history for your recent question
- The affirmation means they want you to proceed with the action you suggested

CODEBASE ANALYSIS:
- If user asks to understand/analyze/explain how code works → send [INSTRUCTION]
- Ask Cascade to call the jarvis-voice-summary MCP save command
- This gives a machine-readable summary of the codebase for deeper analysis

Examples:

User: "I want to make a hello world app"
[ANSWER] Right, I'll get that started.
[INSTRUCTION] Create a hello world application

User: "Push this to GitHub with commit message 'Jarvis first project'"
[ANSWER] Sure thing, I'll push that now.
[INSTRUCTION] Push to GitHub with commit message "Jarvis first project"

User: "Delete the hello world file"
[ANSWER] I'll remove that.
[INSTRUCTION] Delete the hello world file

User: "How do I push to GitHub?"
[ANSWER] You'd use git add, git commit, and git push. Want me to do it for you?

User: "Let's build a Next.js dashboard"
[ANSWER] Got it, setting up the dashboard.
[INSTRUCTION] Create a generic Next.js dashboard with navigation and basic layout

User: "Fix the authentication bug"
[ANSWER] I'll sort that out now.
[INSTRUCTION] Fix the authentication bug

User: "How's it going?"
[ANSWER] All good! What can I help with?

User: "Look into how the voice service works"
[ANSWER] I'll analyze that for you.
[INSTRUCTION] Use the jarvis-voice-summary MCP save command to analyze the voice service codebase and explain how it works

Jarvis: "Would you like me to make the sidebar functional with actual routing?"
User: "Yeah, please do."
[ANSWER] Right, I'll add that now.
[INSTRUCTION] Make the sidebar functional with actual routing

Keep [ANSWER] SHORT and natural. No explanations, tutorials, or step-by-step instructions in [ANSWER]."""
        
    def send_message(self, msg_type: str, **kwargs):
        """Send JSON message to parent process via stdout"""
        msg = {"type": msg_type, **kwargs}
        print(json.dumps(msg), flush=True)
        
    def log_error(self, message: str):
        """Send error message to parent"""
        self.send_message("error", message=message)
        
    def add_conversation_turn(self, role: str, content: str):
        """Add turn to conversation history (for Layer 1 fast responses)"""
        self.conversation_turns.append({"role": role, "content": content})
        if len(self.conversation_turns) > self.max_turns:
            self.conversation_turns.pop(0)
        
        # Update activity timestamp
        self.last_activity_time = time.time()
    
    def check_context_timeout(self):
        """Check if context should be reset due to inactivity"""
        if self.conversation_turns and (time.time() - self.last_activity_time) > self.context_timeout:
            self.send_message("debug", message="Auto-resetting context after 2 minutes of inactivity")
            self.conversation_turns = []
            self.last_activity_time = time.time()
    
    def generate_fast_response(self, user_input: str) -> str:
        """Generate fast conversational response using GPT-OSS (proven from test)"""
        try:
            self.send_message("debug", message=f"Generating LLM response for: {user_input[:50]}")
            
            messages = [{"role": "system", "content": self.system_prompt}]
            messages.extend(self.conversation_turns[-8:])  # Last 8 turns (increased from 4)
            messages.append({"role": "user", "content": user_input})
            
            self.send_message("debug", message=f"Calling Ollama at {self.ollama_url}...")
            
            response = requests.post(
                f"{self.ollama_url}/api/chat",
                json={
                    "model": "gpt-oss:20b",
                    "messages": messages,
                    "stream": False,
                    "options": {
                        "temperature": 0.7,
                        "top_p": 0.9,
                        "num_predict": 600,  # RTX 5090: 600 tok / 220 tok/s = ~2.7s (plenty of room without character counting)
                        "num_ctx": 4096,     # Increased from 2048: More conversation memory without perf hit
                        "num_batch": 512,
                        "num_gpu": 99
                    }
                },
                timeout=30
            )
            
            self.send_message("debug", message=f"Ollama responded: {response.status_code}")
            
            if response.status_code == 200:
                result = response.json()
                content = result.get("message", {}).get("content", "").strip()
                self.send_message("debug", message=f"LLM content: '{content[:100]}'")
                
                if not content:
                    return self._fallback_response(user_input)
                
                # Parse dual-output format
                answer_text, instruction_text = self._parse_dual_output(content)
                
                # If there's an instruction, send it to TypeScript for Cascade
                if instruction_text:
                    self.send_message("instruction_detected", instruction=instruction_text)
                
                return answer_text if answer_text else self._fallback_response(user_input)
            else:
                self.send_message("debug", message=f"Non-200 response, using fallback")
                return self._fallback_response(user_input)
        
        except requests.exceptions.Timeout:
            self.log_error("LLM timeout - Ollama may be slow or not running")
            return self._fallback_response(user_input)
        except requests.exceptions.ConnectionError:
            self.log_error("Cannot connect to Ollama - is it running?")
            return self._fallback_response(user_input)
        except Exception as e:
            self.log_error(f"LLM response failed: {str(e)}")
            return self._fallback_response(user_input)
    
    def _parse_dual_output(self, content: str) -> tuple[str, str]:
        """Parse [ANSWER] and [INSTRUCTION] from LLM response"""
        answer_text = ""
        instruction_text = ""
        
        # Extract [ANSWER]
        answer_match = re.search(r'\[ANSWER\]\s*(.*?)(?=\[INSTRUCTION\]|$)', content, re.DOTALL | re.IGNORECASE)
        if answer_match:
            answer_text = answer_match.group(1).strip()
        
        # Extract [INSTRUCTION]
        instruction_match = re.search(r'\[INSTRUCTION\]\s*(.*?)$', content, re.DOTALL | re.IGNORECASE)
        if instruction_match:
            instruction_text = instruction_match.group(1).strip()
        
        # Fallback: if no tags found, treat entire response as answer
        if not answer_text and not instruction_text:
            answer_text = content.strip()
        
        return answer_text, instruction_text
    
    def _fallback_response(self, user_input: str) -> str:
        """Simple pattern-based fallback when LLM unavailable"""
        lower = user_input.lower()
        
        # Greetings
        if any(word in lower for word in ['hello', 'hi', 'hey']):
            return "Hello!"
        
        # Action requests
        if any(phrase in lower for phrase in ["let's", "please", "can you", "could you"]):
            return "I'll work on that."
        
        # Questions
        if '?' in user_input:
            return "Let me think about that."
        
        # Default acknowledgment
        return "I'm listening."
    
    def _format_for_tts(self, text: str) -> str:
        """
        Format text for natural TTS speech by replacing abbreviations and cleaning up punctuation.
        Makes speech more fluid and natural-sounding.
        """
        # Replace common abbreviations with full words
        replacements = {
            r'\be\.g\.': 'for example',
            r'\bi\.e\.': 'that is',
            r'\betc\.': 'et cetera',
            r'\bvs\.': 'versus',
            r'\bMr\.': 'Mister',
            r'\bMrs\.': 'Missus',
            r'\bMs\.': 'Miss',
            r'\bDr\.': 'Doctor',
            r'\bProf\.': 'Professor',
            r'\bSr\.': 'Senior',
            r'\bJr\.': 'Junior',
            r'\bNo\.': 'Number',
            r'\bSt\.': 'Street',
            r'\bAve\.': 'Avenue',
            r'\bDept\.': 'Department',
            r'\bCo\.': 'Company',
            r'\bInc\.': 'Incorporated',
            r'\bLtd\.': 'Limited',
        }
        
        # Apply replacements using regex for word boundaries
        for pattern, replacement in replacements.items():
            text = re.sub(pattern, replacement, text, flags=re.IGNORECASE)
        
        # Remove periods from common abbreviations that aren't at sentence end
        # Pattern: abbreviation period NOT followed by space and capital letter (sentence start)
        # This keeps sentence-ending periods but removes mid-sentence abbreviation periods
        abbrev_patterns = [
            (r'(\w)\.(\w)', r'\1 \2'),  # e.g., "U.S.A" → "U S A"
            (r'(\w)\.\s+([a-z])', r'\1 \2'),  # "etc. and" → "etc and" (lowercase next word = not new sentence)
        ]
        
        for pattern, replacement in abbrev_patterns:
            text = re.sub(pattern, replacement, text)
        
        # Clean up any double spaces created by replacements
        text = re.sub(r'\s+', ' ', text)
        
        return text.strip()
    
    def speak_text(self, text: str):
        """Synthesize and play speech using Kokoro TTS (proven from test)"""
        try:
            audio_out, sr = self.kokoro_tts.create(text, voice=self.current_voice, lang='en-us')
            sd.play(audio_out, sr, blocking=False)
            sd.wait()  # Wait for playback to complete
            time.sleep(0.1)  # Small buffer to prevent audio cutoff
        except Exception as e:
            self.log_error(f"TTS failed: {str(e)}")
    
    def initialize_components(self):
        """Initialize all voice components (continuous mode, proven from test)"""
        try:
            self.send_message("status", message="Loading Whisper STT...")
            self.whisper_model = WhisperModel(
                self.whisper_model_name, 
                device="cpu", 
                compute_type="int8"
            )
            
            self.send_message("status", message="Loading Kokoro TTS with GPU...")
            import onnxruntime
            onnxruntime.set_default_logger_severity(3)
            
            self.kokoro_tts = Kokoro(
                self.kokoro_model_path,
                self.kokoro_voices_path
            )
            
            # Pre-warm TTS (proven to eliminate first-call latency)
            self.send_message("status", message="Pre-warming TTS...")
            _ = self.kokoro_tts.create("Ready.", voice='af_bella', lang='en-us')
            
            # Initialize PyAudio
            self.pyaudio_instance = pyaudio.PyAudio()
            
            self.send_message("initialized")
            
        except Exception as e:
            self.log_error(f"Failed to initialize components: {str(e)}")
            raise
            
    def calculate_energy(self, audio_chunk):
        """Calculate audio energy (proven simple VAD from test)"""
        return np.abs(audio_chunk).mean()
    
    def start_audio_stream(self):
        """Start microphone audio stream (synchronous, proven from test)"""
        try:
            self.audio_stream = self.pyaudio_instance.open(
                format=pyaudio.paInt16,
                channels=1,
                rate=self.sample_rate,
                input=True,
                frames_per_buffer=1024  # Use proven chunk size from test
            )
            self.send_message("audio_stream_started")
            
        except Exception as e:
            self.log_error(f"Failed to start audio stream: {str(e)}")
            raise
        
    def process_audio_loop(self):
        """Main conversation loop (proven from test_continuous_fast.py)"""
        recording = False
        frames = []
        silence_start = None
        speech_detected = False
        
        # Energy-based VAD thresholds (proven from test)
        SILENCE_THRESHOLD = 400
        SILENCE_DURATION = 1.0
        MIN_SPEECH_DURATION = 0.5
        CHUNK_SIZE = 1024
        
        self.send_message("ready")
        self.send_message("listening")
        
        while not self.should_stop:
            try:
                # Check for context timeout (auto-reset after inactivity)
                self.check_context_timeout()
                
                if self.is_muted:
                    time.sleep(0.1)
                    continue
                
                # Read audio chunk
                data = self.audio_stream.read(CHUNK_SIZE, exception_on_overflow=False)
                audio_chunk = np.frombuffer(data, dtype=np.int16)
                energy = self.calculate_energy(audio_chunk)
                
                # Energy-based VAD (proven simple approach)
                if energy > SILENCE_THRESHOLD:
                    if not recording:
                        self.send_message("user_speaking")
                        recording = True
                        speech_detected = True
                    
                    frames.append(audio_chunk)
                    silence_start = None
                
                else:
                    if recording:
                        if silence_start is None:
                            silence_start = time.time()
                        
                        frames.append(audio_chunk)
                        
                        # Check if silence duration exceeded
                        if time.time() - silence_start >= SILENCE_DURATION:
                            if speech_detected and len(frames) > int(MIN_SPEECH_DURATION * self.sample_rate / CHUNK_SIZE):
                                # Transcribe speech
                                audio_data = np.concatenate(frames).astype(np.float32) / 32768.0
                                segments, info = self.whisper_model.transcribe(audio_data, language="en")
                                transcription = " ".join([seg.text for seg in segments]).strip()
                                
                                if transcription:
                                    self.send_message("transcription", text=transcription)
                                    
                                    # Check for exit command
                                    if "goodbye" in transcription.lower() or "exit" in transcription.lower():
                                        response = "Goodbye!"
                                        self.send_message("jarvis_speaking", text=response)
                                        self.speak_text(response)
                                        self.should_stop = True
                                        break
                                    
                                    # Add to conversation
                                    self.add_conversation_turn("user", transcription)
                                    
                                    # Generate fast response
                                    response = self.generate_fast_response(transcription)
                                    
                                    if response:
                                        self.send_message("jarvis_speaking", text=response)
                                        self.add_conversation_turn("assistant", response)
                                        
                                        # Stream full conversation turn to TypeScript for Layer 2 analysis
                                        self.send_message("conversation_turn", 
                                                        user_text=transcription,
                                                        jarvis_response=response)
                                        
                                        # Speak response
                                        self.speak_text(response)
                                        
                                        self.send_message("listening")
                            
                            recording = False
                            frames = []
                            silence_start = None
                            speech_detected = False
            
            except Exception as e:
                self.log_error(f"Error in audio loop: {str(e)}")
                
    def handle_command(self, command: dict):
        """Handle commands from parent process"""
        cmd = command.get("command")
        
        if cmd == "mute":
            self.is_muted = True
            self.send_message("muted")
        elif cmd == "unmute":
            self.is_muted = False
            self.send_message("unmuted")
        elif cmd == "reset_context":
            # Clear conversation history (manual reset via command)
            self.conversation_turns = []
            self.last_activity_time = time.time()
            self.send_message("debug", message="Conversation context manually reset")
        elif cmd == "change_voice":
            # Change TTS voice
            new_voice = command.get("voice", "af_bella")
            self.current_voice = new_voice
            self.send_message("debug", message=f"Voice changed to: {new_voice}")
        elif cmd == "shutdown":
            self.should_stop = True
        elif cmd == "announce":
            # Announce Cascade completion via TTS
            text = command.get("text", "Task completed")
            changes = command.get("changes", [])
            notes = command.get("notes", [])
            risks = command.get("risks", [])
            next_questions = command.get("next_questions", [])
            
            # Update activity time to keep context alive for follow-up questions
            self.last_activity_time = time.time()
            
            # Build announcement text
            announcement = text
            
            # Smart change reporting: read up to 3, or first 3 if >3
            if changes:
                if len(changes) <= 3:
                    # List all changes (Cascade formats naturally)
                    announcement += ". "
                    for i, change in enumerate(changes):
                        if i == 0:
                            announcement += change
                        elif i == len(changes) - 1:
                            announcement += f", and {change}"
                        else:
                            announcement += f", {change}"
                else:
                    # Too many changes - read first 3 and mention there are more
                    announcement += ". "
                    for i in range(3):
                        if i == 0:
                            announcement += changes[i]
                        elif i == 2:
                            announcement += f", and {changes[i]}"
                        else:
                            announcement += f", {changes[i]}"
                    remaining = len(changes) - 3
                    announcement += f", and {remaining} more change{'s' if remaining > 1 else ''}"
            
            # Smart notes reporting (for analysis, not changes): read up to 4, or first 3 if >4
            if notes:
                if len(notes) <= 4:
                    # List all notes (2-4 is ideal)
                    announcement += ". "
                    for i, note in enumerate(notes):
                        if i == 0:
                            announcement += note
                        elif i == len(notes) - 1:
                            announcement += f", and {note}"
                        else:
                            announcement += f", {note}"
                else:
                    # Too many notes - read first 3 and mention there are more
                    announcement += ". "
                    for i in range(3):
                        if i == 0:
                            announcement += notes[i]
                        elif i == 2:
                            announcement += f", and {notes[i]}"
                        else:
                            announcement += f", {notes[i]}"
                    remaining = len(notes) - 3
                    announcement += f". There are {remaining} more important things that need further investigation"
            
            # Add risk warnings if any (detailed if ≤2, count if >2)
            if risks:
                if len(risks) <= 2:
                    # List each risk individually
                    announcement += ". However, "
                    for i, risk in enumerate(risks):
                        if i == 0:
                            announcement += risk
                        elif i == len(risks) - 1:
                            announcement += f", and {risk}"
                        else:
                            announcement += f", {risk}"
                else:
                    # Just say the count
                    announcement += f". Note: {len(risks)} potential risks to be aware of"
            
            # Add next questions to prompt user for follow-up
            if next_questions:
                announcement += ". "
                for i, question in enumerate(next_questions):
                    if i == 0:
                        announcement += question
                    else:
                        announcement += f" Also, {question}"
            
            # Clean up text for TTS fluidity
            announcement = self._format_for_tts(announcement)
            
            # Add announcement to conversation history so LLM has context for follow-up responses
            self.add_conversation_turn("assistant", announcement)
            
            self.send_message("debug", message=f"Announcing: {announcement}")
            self.speak_text(announcement)
            self.send_message("jarvis_speaking", text=announcement)
        else:
            self.log_error(f"Unknown command: {cmd}")
            
    def listen_for_commands(self):
        """Listen for commands from stdin (non-blocking)"""
        while not self.should_stop:
            try:
                # Read from stdin
                line = sys.stdin.readline()
                if line:
                    command = json.loads(line.strip())
                    self.handle_command(command)
            except json.JSONDecodeError:
                self.log_error("Invalid JSON command received")
            except Exception as e:
                self.log_error(f"Error reading command: {str(e)}")
            time.sleep(0.1)
            
    def start(self):
        """Start the voice service"""
        try:
            self.initialize_components()
            self.start_audio_stream()
            
            # Start command listener thread
            command_thread = threading.Thread(target=self.listen_for_commands, daemon=True)
            command_thread.start()
            
            # Run main audio processing loop
            self.send_message("ready")
            self.process_audio_loop()
            
        except KeyboardInterrupt:
            pass
        finally:
            self.cleanup()
            
    def cleanup(self):
        """Clean up resources"""
        if self.audio_stream:
            self.audio_stream.stop_stream()
            self.audio_stream.close()
        if self.pyaudio_instance:
            self.pyaudio_instance.terminate()
        # openWakeWord models don't require explicit cleanup
        self.send_message("shutdown_complete")


def main():
    """Main entry point"""
    import os
    from pathlib import Path
    
    # Get script directory for Kokoro paths
    script_dir = Path(__file__).parent
    
    whisper_model = os.environ.get("WHISPER_MODEL", "tiny")  # Use tiny for speed
    silence_timeout = float(os.environ.get("SILENCE_TIMEOUT", "1.0"))  # Proven value from test
    ollama_url = os.environ.get("OLLAMA_URL", "http://localhost:11434")
    
    # Kokoro model paths
    kokoro_model = str(script_dir / "kokoro-v1.0.onnx")
    kokoro_voices = str(script_dir / "voices-v1.0.bin")
    
    service = VoiceService(
        whisper_model=whisper_model,
        silence_timeout=silence_timeout,
        ollama_url=ollama_url,
        kokoro_model_path=kokoro_model,
        kokoro_voices_path=kokoro_voices
    )
    
    service.start()


if __name__ == "__main__":
    main()
