#!/usr/bin/env python3
"""
Fast continuous conversation with streaming:
- Streams GPT-OSS responses
- Starts speaking first sentence immediately
- Much lower perceived latency
"""

import pyaudio
import numpy as np
from faster_whisper import WhisperModel
from kokoro_onnx import Kokoro
import sounddevice as sd
import time
import requests
import json
import re
import threading
import queue

# Audio config
SAMPLE_RATE = 16000
CHUNK_SIZE = 1024
FORMAT = pyaudio.paInt16

# Voice detection thresholds
SILENCE_THRESHOLD = 400  # Lower = more sensitive to quiet speech
SILENCE_DURATION = 1.0   # Shorter pause = faster response (was 2.0)
MIN_SPEECH_DURATION = 0.5

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

Keep responses VERY concise (1 sentence max). Be direct and helpful."""
    
    def add_turn(self, speaker, text):
        role = "user" if speaker == "You" else "assistant"
        self.turns.append({"role": role, "content": text})
    
    def split_sentences(self, text):
        """Split text into sentences"""
        sentences = re.split(r'([.!?]+\s+)', text)
        result = []
        for i in range(0, len(sentences)-1, 2):
            sentence = sentences[i] + (sentences[i+1] if i+1 < len(sentences) else "")
            if sentence.strip():
                result.append(sentence.strip())
        if sentences and sentences[-1].strip():
            result.append(sentences[-1].strip())
        return result
    
    def generate_response_fast(self, user_input):
        """Generate response as fast as possible - no streaming overhead"""
        try:
            messages = [{"role": "system", "content": self.system_prompt}]
            messages.extend(self.turns[-4:])  # Only last 4 turns = less to process = faster
            messages.append({"role": "user", "content": user_input})
            
            # Non-streaming for minimum latency
            response = requests.post(
                f"{self.ollama_url}/api/chat",
                json={
                    "model": "gpt-oss:20b",
                    "messages": messages,
                    "stream": False,
                    "options": {
                        "temperature": 0.7,
                        "top_p": 0.9,
                        "num_predict": 150,     # Need more tokens for thinking + response
                        "num_ctx": 2048,        # Smaller context window = faster processing
                        "num_batch": 512,       # Larger batch = faster generation
                        "num_gpu": 99,          # Use all GPU layers for speed
                        "stop": ["\n\n"]        # Stop at double newline for conciseness
                    }
                },
                timeout=10
            )
            
            if response.status_code == 200:
                result = response.json()
                content = result.get("message", {}).get("content", "").strip()
                if not content:
                    print(f"\n   ⚠️  Empty response from Ollama. Full result: {result}")
                    return "I'm having trouble thinking right now."
                return content
            else:
                print(f"\n   ⚠️  Ollama error {response.status_code}: {response.text[:200]}")
                return "I'm having trouble thinking right now."
        
        except requests.exceptions.ConnectionError:
            return "I can't connect to my brain. Is Ollama running?"
        except Exception as e:
            return "Sorry, I had a momentary lapse."

def calculate_energy(audio_chunk):
    return np.abs(audio_chunk).mean()

def play_audio(audio_data, sample_rate):
    """Play audio with minimal latency"""
    sd.play(audio_data, sample_rate, blocking=True)  # Blocking mode is actually faster for short clips

def play_audio_async(audio_data, sample_rate):
    """Play audio in background thread"""
    thread = threading.Thread(target=lambda: sd.play(audio_data, sample_rate) or sd.wait())
    thread.daemon = True
    thread.start()
    return thread

def test_continuous():
    print("🎤 Initializing Jarvis (Fast Mode)...")
    
    print("  Loading Whisper...")
    whisper = WhisperModel("tiny", device="cpu", compute_type="int8")
    
    print("  Loading Kokoro TTS with GPU acceleration...")
    import onnxruntime as ort
    
    # Check available providers
    providers = ort.get_available_providers()
    print(f"    Available providers: {providers}")
    
    # Set session options for GPU
    import onnxruntime
    onnxruntime.set_default_logger_severity(3)  # Reduce ONNX logging
    
    # Initialize Kokoro - it will automatically use CUDA if available
    kokoro = Kokoro(
        r'C:\DevMode\Jarvis\python\kokoro-v1.0.onnx',
        r'C:\DevMode\Jarvis\python\voices-v1.0.bin'
    )
    print(f"    Using: CUDAExecutionProvider (GPU)" if 'CUDAExecutionProvider' in providers else "    Using: CPUExecutionProvider")
    
    # PRE-WARM TTS MODEL - this eliminates first-call latency
    print("  Pre-warming TTS...")
    _ = kokoro.create("Ready.", voice='af_bella', lang='en-us')
    
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
    
    print("\n✅ Jarvis ready! (Streaming mode - faster responses)")
    print("   Press Enter to start continuous conversation")
    print("   Say 'goodbye' to exit\n")
    
    input("Press Enter to start...")
    
    print("\n🎧 Listening continuously...\n")
    
    try:
        recording = False
        frames = []
        silence_start = None
        speech_detected = False
        
        while True:
            data = stream.read(CHUNK_SIZE, exception_on_overflow=False)
            audio_chunk = np.frombuffer(data, dtype=np.int16)
            energy = calculate_energy(audio_chunk)
            
            if energy > SILENCE_THRESHOLD:
                if not recording:
                    print("🔴 Listening...")
                    recording = True
                    speech_detected = True
                
                frames.append(audio_chunk)
                silence_start = None
            
            else:
                if recording:
                    if silence_start is None:
                        silence_start = time.time()
                    
                    frames.append(audio_chunk)
                    
                    if time.time() - silence_start >= SILENCE_DURATION:
                        if speech_detected and len(frames) > int(MIN_SPEECH_DURATION * SAMPLE_RATE / CHUNK_SIZE):
                            print("   Processing...")
                            
                            audio_data = np.concatenate(frames).astype(np.float32) / 32768.0
                            segments, info = whisper.transcribe(audio_data, language="en")
                            transcription = " ".join([seg.text for seg in segments]).strip()
                            
                            if transcription:
                                print(f"   📝 You: \"{transcription}\"")
                                
                                if "goodbye" in transcription.lower() or "exit" in transcription.lower():
                                    print("\n   Jarvis: \"Goodbye!\"")
                                    audio_out, sr = kokoro.create("Goodbye!", voice='af_bella', lang='en-us')
                                    play_audio(audio_out, sr)
                                    break
                                
                                history.add_turn("You", transcription)
                                
                                # Generate response (fast!)
                                print("   🧠 Thinking...", end="", flush=True)
                                response = history.generate_response_fast(transcription)
                                
                                # Handle empty response
                                if not response or len(response.strip()) == 0:
                                    print("\r   ⚠️  Got empty response, retrying...")
                                    response = "I'm having trouble thinking. Could you repeat that?"
                                
                                print(f"\r   🤖 Jarvis: \"{response}\"")
                                
                                # Generate and play audio (single call = faster)
                                audio_out, sr = kokoro.create(response, voice='af_bella', lang='en-us')
                                play_audio(audio_out, sr)
                                
                                history.add_turn("Jarvis", response)
                                
                                print("\n🎧 Listening...")
                        
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

if __name__ == "__main__":
    test_continuous()
