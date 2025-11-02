#!/usr/bin/env python3
"""
Parallel processing voice conversation:
- Starts transcription immediately when you pause (0.5s)
- Sends to GPT-OSS while still recording (parallel!)
- Starts TTS as soon as first words arrive (streaming!)
- Much lower latency
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

# Voice detection thresholds - AGGRESSIVE for speed
SILENCE_THRESHOLD = 400
SILENCE_DURATION = 0.8   # Very short pause = instant response
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
    
    def generate_response_streaming(self, user_input, on_chunk):
        """Generate response with streaming - calls on_chunk for each token"""
        try:
            messages = [{"role": "system", "content": self.system_prompt}]
            messages.extend(self.turns[-4:])
            messages.append({"role": "user", "content": user_input})
            
            # STREAMING for parallel TTS generation
            response = requests.post(
                f"{self.ollama_url}/api/chat",
                json={
                    "model": "gpt-oss:20b",
                    "messages": messages,
                    "stream": True,  # Stream tokens as they're generated
                    "options": {
                        "temperature": 0.7,
                        "top_p": 0.9,
                        "num_predict": 150,
                        "num_ctx": 2048,
                        "num_batch": 512,
                        "num_gpu": 99
                    }
                },
                stream=True,
                timeout=30
            )
            
            full_response = ""
            for line in response.iter_lines():
                if line:
                    try:
                        data = json.loads(line)
                        if "message" in data and "content" in data["message"]:
                            chunk = data["message"]["content"]
                            full_response += chunk
                            on_chunk(chunk)  # Send each chunk immediately
                    except json.JSONDecodeError:
                        continue
            
            return full_response.strip() if full_response else "I'm having trouble thinking."
        
        except Exception as e:
            print(f"\n   ⚠️  Error: {e}")
            return "Sorry, I had a momentary lapse."

def calculate_energy(audio_chunk):
    return np.abs(audio_chunk).mean()

def play_audio(audio_data, sample_rate):
    sd.play(audio_data, sample_rate, blocking=True)

def test_parallel():
    print("🎤 Initializing Jarvis (Parallel Mode)...")
    
    print("  Loading Whisper...")
    whisper = WhisperModel("tiny", device="cpu", compute_type="int8")
    
    print("  Loading Kokoro TTS with GPU...")
    import onnxruntime as ort
    providers = ort.get_available_providers()
    print(f"    GPU: {'✅' if 'CUDAExecutionProvider' in providers else '❌'}")
    
    kokoro = Kokoro(
        r'C:\DevMode\Jarvis\python\kokoro-v1.0.onnx',
        r'C:\DevMode\Jarvis\python\voices-v1.0.bin'
    )
    
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
    
    print("\n✅ Jarvis ready! (Parallel processing - maximum speed)")
    print("   Press Enter to start")
    print("   Say 'goodbye' to exit\n")
    
    input("Press Enter to start...")
    print("\n🎧 Listening...\n")
    
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
                    
                    # MUCH SHORTER WAIT - start processing immediately
                    if time.time() - silence_start >= SILENCE_DURATION:
                        if speech_detected and len(frames) > int(MIN_SPEECH_DURATION * SAMPLE_RATE / CHUNK_SIZE):
                            print("   ⚡ Processing (parallel)...")
                            
                            # PARALLEL STEP 1: Transcribe
                            audio_data = np.concatenate(frames).astype(np.float32) / 32768.0
                            segments, info = whisper.transcribe(audio_data, language="en")
                            transcription = " ".join([seg.text for seg in segments]).strip()
                            
                            if transcription:
                                print(f"   📝 You: \"{transcription}\"")
                                
                                if "goodbye" in transcription.lower():
                                    print("\n   Jarvis: \"Goodbye!\"")
                                    audio_out, sr = kokoro.create("Goodbye!", voice='af_bella', lang='en-us')
                                    play_audio(audio_out, sr)
                                    break
                                
                                history.add_turn("You", transcription)
                                
                                # PARALLEL STEP 2: Stream GPT-OSS response and generate TTS in parallel
                                print("   🧠 Thinking...", end="", flush=True)
                                
                                response_buffer = []
                                sentence_buffer = ""
                                first_chunk = True
                                
                                def on_chunk(chunk):
                                    nonlocal sentence_buffer, first_chunk
                                    sentence_buffer += chunk
                                    
                                    if first_chunk:
                                        print("\r   ", end="", flush=True)
                                        first_chunk = False
                                    
                                    # When we have a complete sentence, speak it immediately!
                                    if re.search(r'[.!?]\s*$', sentence_buffer):
                                        sentence = sentence_buffer.strip()
                                        if sentence:
                                            print(f"   🗣️  {sentence}")
                                            # Generate and play audio WHILE GPT-OSS is still thinking!
                                            audio_out, sr = kokoro.create(sentence, voice='af_bella', lang='en-us')
                                            play_audio(audio_out, sr)
                                        sentence_buffer = ""
                                
                                response = history.generate_response_streaming(transcription, on_chunk)
                                
                                # Speak any remaining text
                                if sentence_buffer.strip():
                                    print(f"   🗣️  {sentence_buffer.strip()}")
                                    audio_out, sr = kokoro.create(sentence_buffer.strip(), voice='af_bella', lang='en-us')
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
    test_parallel()
