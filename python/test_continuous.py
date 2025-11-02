
"""
Continuous conversation with Jarvis:
- Press Enter ONCE to start
- Jarvis continuously listens
- Detects when you stop speaking (silence detection)
- Responds automatically
- Keeps listening until you say "goodbye"
"""

import pyaudio
import numpy as np
from faster_whisper import WhisperModel
from kokoro_onnx import Kokoro
import sounddevice as sd
import time
import requests
import json

# Audio config

SAMPLE_RATE = 16000
CHUNK_SIZE = 1024
FORMAT = pyaudio.paInt16

# Voice detection thresholds
SILENCE_THRESHOLD = 500  # Energy threshold for silence detection
SILENCE_DURATION = 1.5   # Seconds of silence before processing
MIN_SPEECH_DURATION = 0.5  # Minimum speech duration to process

class ConversationHistory:
    def __init__(self, ollama_url="http://localhost:11434"):
        self.turns = []
        self.ollama_url = ollama_url
        self.system_prompt = """You are Jarvis, a helpful AI coding assistant with a British personality.
You help users with coding tasks through natural conversation.

When users ask you to write code:
1. Have a brief conversation to understand what they need
2. Ask ONE clarifying question if needed
3. When ready to code, say something like "I'll write that for you now" and describe what you'll do

Keep responses conversational and concise (1-2 sentences). Be helpful and friendly."""
    
    def add_turn(self, speaker, text):
        role = "user" if speaker == "You" else "assistant"
        self.turns.append({"role": role, "content": text})
    
    def generate_response(self, user_input):
        """Generate intelligent response using GPT-OSS via Ollama"""
        try:
            # Build messages with system prompt and conversation history
            messages = [{"role": "system", "content": self.system_prompt}]
            # Include last 6 turns for context
            messages.extend(self.turns[-6:])
            messages.append({"role": "user", "content": user_input})
            
            print("   🧠 Thinking...", end="", flush=True)
            
            # Call Ollama API
            response = requests.post(
                f"{self.ollama_url}/api/chat",
                json={
                    "model": "gpt-oss:20b",
                    "messages": messages,
                    "stream": False,
                    "options": {
                        "temperature": 0.7,
                        "top_p": 0.9
                    }
                },
                timeout=30
            )
            
            print("\r   ", end="")  # Clear thinking message
            
            if response.status_code == 200:
                result = response.json()
                return result["message"]["content"].strip()
            else:
                print(f"⚠️  Ollama error: {response.status_code}")
                return "I'm having trouble thinking right now. Could you repeat that?"
        
        except requests.exceptions.ConnectionError:
            print("⚠️  Cannot connect to Ollama")
            return "I can't connect to my brain. Is Ollama running with gpt-oss:20b?"
        except requests.exceptions.Timeout:
            print("⚠️  Ollama timeout")
            return "Sorry, I'm thinking too slowly. Let me try again."
        except Exception as e:
            print(f"⚠️  Error: {e}")
            return "Sorry, I had a momentary lapse. What were you saying?"

def calculate_energy(audio_chunk):
    """Calculate audio energy for silence detection"""
    return np.abs(audio_chunk).mean()

def play_audio(audio_data, sample_rate):
    """Play audio directly"""
    sd.play(audio_data, sample_rate)
    sd.wait()

def test_continuous():
    print("🎤 Initializing Jarvis...")
    
    # Initialize components
    print("  Loading Whisper...")
    whisper = WhisperModel("tiny", device="cpu", compute_type="int8")
    
    print("  Loading Kokoro TTS (British voice)...")
    kokoro = Kokoro(
        r'C:\DevMode\Jarvis\python\kokoro-v1.0.onnx',
        r'C:\DevMode\Jarvis\python\voices-v1.0.bin'
    )
    
    print("  Initializing microphone...")
    audio = pyaudio.PyAudio()
    stream = audio.open(
        format=FORMAT,
        channels=1,
        rate=SAMPLE_RATE,
        input=True,
        frames_per_buffer=CHUNK_SIZE
    )
    
    history = ConversationHistory()
    
    print("\n✅ Jarvis ready!")
    print("   Press Enter to start continuous conversation")
    print("   Say 'goodbye' to exit\n")
    
    input("Press Enter to start...")
    
    print("\n🎧 Listening continuously... (speak naturally)")
    print("   I'll respond when you finish speaking\n")
    
    try:
        recording = False
        frames = []
        silence_start = None
        speech_detected = False
        
        while True:
            # Read audio chunk
            data = stream.read(CHUNK_SIZE, exception_on_overflow=False)
            audio_chunk = np.frombuffer(data, dtype=np.int16)
            energy = calculate_energy(audio_chunk)
            
            # Check if speech or silence
            if energy > SILENCE_THRESHOLD:
                # Speech detected
                if not recording:
                    print("🔴 Listening...")
                    recording = True
                    speech_detected = True
                
                frames.append(audio_chunk)
                silence_start = None
            
            else:
                # Silence detected
                if recording:
                    if silence_start is None:
                        silence_start = time.time()
                    
                    frames.append(audio_chunk)
                    
                    # Check if silence duration exceeded
                    if time.time() - silence_start >= SILENCE_DURATION:
                        # Process the recorded audio
                        if speech_detected and len(frames) > int(MIN_SPEECH_DURATION * SAMPLE_RATE / CHUNK_SIZE):
                            print("   Processing...")
                            
                            # Transcribe
                            audio_data = np.concatenate(frames).astype(np.float32) / 32768.0
                            segments, info = whisper.transcribe(audio_data, language="en")
                            transcription = " ".join([seg.text for seg in segments]).strip()
                            
                            if transcription:
                                print(f"   📝 You: \"{transcription}\"")
                                
                                # Check for exit
                                if "goodbye" in transcription.lower() or "exit" in transcription.lower():
                                    print("\n   Jarvis: \"Goodbye!\"")
                                    response_audio, sr = kokoro.create("Goodbye!", voice='af_bella', lang='en-us')
                                    play_audio(response_audio, sr)
                                    break
                                
                                # Add to history
                                history.add_turn("You", transcription)
                                
                                # Generate response
                                response = history.generate_response(transcription)
                                print(f"   🤖 Jarvis: \"{response}\"")
                                
                                # Add to history
                                history.add_turn("Jarvis", response)
                                
                                # Speak
                                response_audio, sr = kokoro.create(response, voice='af_bella', lang='en-us')
                                play_audio(response_audio, sr)
                                
                                print("\n🎧 Listening...")
                        
                        # Reset for next turn
                        recording = False
                        frames = []
                        silence_start = None
                        speech_detected = False
    
    except KeyboardInterrupt:
        print("\n\n👋 Shutting down...")
    finally:
        stream.stop_stream()
        stream.close()
        audio.terminate()
        print("✅ Goodbye!")
        
        if history.turns:
            print("\n📋 Conversation history:")
            for turn in history.turns:
                print(f"   {turn['speaker']}: {turn['text']}")

if __name__ == "__main__":
    test_continuous()
