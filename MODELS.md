# Model Guide - 2025 Recommendations

## Overview

This guide covers the best open source models available in 2025 for Jarvis components.

---

## 🧠 LLM Models (Intent Classification & Chatting)

### gpt-oss-20b (Recommended)

**Released:** August 2025 by OpenAI  
**License:** Apache 2.0 (fully open source)

**Specs:**
- 21B parameters total, 3.6B active (MoE)
- Runs in 16GB RAM
- MXFP4 quantization for efficiency
- Configurable reasoning levels (low/medium/high)

**Why Best for Jarvis:**
- Purpose-built for reasoning tasks
- Native chain-of-thought (visible for debugging)
- Better intent classification than chat models
- Agentic design with tool use support
- Faster than Llama 3.1 8B for structured tasks

**Install:**
```powershell
ollama pull gpt-oss-20b
```

**Use Cases:**
- Intent classification (primary)
- Chatting with user
- Prompt enhancement
- Response summarization

---

### Qwen3-Coder:30b (Alternative for Coding)

**Released:** Late 2024/Early 2025 by Alibaba

**Specs:**
- 30B parameters, 3.3B active (MoE)
- 256K context window
- Optimized for code understanding

**When to Use:**
- If you want better code generation
- Need longer context (256K vs typical 128K)
- Coding-focused intent detection

**Install:**
```powershell
ollama pull qwen3-coder:30b
```

---

### Llama 3.1:8b (Fallback)

**Released:** Mid 2024 by Meta

**Specs:**
- 8B parameters (dense model)
- Well-tested and stable
- Broad community support

**When to Use:**
- You prefer proven stability over cutting-edge
- Don't need reasoning capabilities
- Want maximum compatibility

**Install:**
```powershell
ollama pull llama3.1:8b
```

---

## 🎤 STT Models (Speech-to-Text)

### Whisper V3 Turbo (Recommended Default)

**Released:** 2024/2025 by OpenAI

**Specs:**
- 809M parameters
- RTFx: 216x (transcribe 1 hour in ~16 seconds)
- WER: ~7-8%
- Multilingual support

**Why Recommended:**
- Balanced accuracy and speed
- Huge community support
- Excellent multilingual
- Well-integrated tooling
- 5.4x faster than Whisper V2

**Install:**
```python
pip install faster-whisper
# Uses Whisper V3 Turbo automatically
```

---

### Canary Qwen 2.5B (Best Accuracy)

**Released:** 2025 by Nvidia

**Specs:**
- 2.5B parameters
- RTFx: 418x
- WER: 5.63% (best on leaderboard)
- Hybrid ASR + LLM architecture

**Why Best for Accuracy:**
- State-of-the-art accuracy
- 234,000 hours training data
- Speech-Augmented Language Model (SALM)
- Better context understanding

**When to Use:**
- You need maximum accuracy
- Can sacrifice some speed for quality
- English-focused use case

**Install:**
```python
pip install nemo_toolkit[all]
# Then download Canary Qwen from HuggingFace
```

---

### Parakeet TDT 0.6B (Ultra-Low Latency)

**Released:** 2025 by Nvidia

**Specs:**
- 600M parameters (tiny!)
- RTFx: 3386x (transcribe 1 hour in 1 second!)
- WER: 6.05%

**Why Fastest:**
- Blazing fast - sub-50ms possible
- Still accurate enough
- Minimal resource usage

**When to Use:**
- Real-time conversation mode
- Need <100ms end-to-end latency
- Resource-constrained deployment

**Install:**
```python
pip install nemo_toolkit[all]
```

---

## 🔊 TTS Models (Text-to-Speech)

### Windows SAPI (Default - No Setup)

**Built-in to Windows**

**Why Default:**
- Zero setup required
- Instant availability
- Good enough for testing
- No dependencies

**When to Use:**
- MVP / testing phase
- Don't want to install anything yet
- Just need basic voice output

**Already installed!**

---

### Kokoro-82M (Recommended Upgrade)

**Released:** 2025

**Specs:**
- 82M parameters (tiny!)
- 4.35 MOS score
- 3.2x faster than XTTSv2
- Apache 2.0 license

**Why Best:**
- Outperforms models 10x larger
- Natural-sounding voice
- Multiple voice packs
- Real-time capable
- Can process 510 tokens at once

**Quality:**
- Better than Windows SAPI
- Rivals commercial TTS
- Community consensus: "Kokoro is king"

**Install:**
```python
pip install kokoro-tts
```

**Voice Options:**
- American English (multiple voices)
- British English
- More languages coming

---

## 🎯 Recommended Combinations

### For Maximum Quality
```
LLM: gpt-oss-20b
STT: Canary Qwen 2.5B
TTS: Kokoro-82M
```

### For Best Speed
```
LLM: gpt-oss-20b (already fast)
STT: Parakeet TDT 0.6B
TTS: Kokoro-82M
```

### For Easy Setup (Start Here)
```
LLM: gpt-oss-20b
STT: Whisper V3 Turbo
TTS: Windows SAPI (upgrade to Kokoro later)
```

### For Coding Focus
```
LLM: Qwen3-Coder:30b
STT: Whisper V3 Turbo
TTS: Kokoro-82M
```

---

## 📊 Performance Comparison

### LLM Latency (Intent Classification)
- gpt-oss-20b: ~30-50ms
- Qwen3-Coder: ~40-60ms
- Llama 3.1 8B: ~50-70ms

### STT Latency (1 minute audio)
- Parakeet: ~18ms
- Canary Qwen: ~144ms
- Whisper V3 Turbo: ~278ms

### TTS Latency (100 chars)
- Windows SAPI: ~200-500ms
- Kokoro-82M: ~50-150ms

### Total Pipeline (Voice → Response)
**Optimal setup:**
- Voice capture: 50ms
- STT (Whisper): 278ms
- Intent (gpt-oss): 50ms
- Cascade: [variable]
- Summarize: 50ms
- TTS (Kokoro): 100ms
- **Total overhead: ~528ms** (sub-second!)

---

## 🔄 Switching Models

**Change LLM:**
```
Settings → Jarvis → LLM Model → "qwen3-coder:30b"
```

**Change STT:** Update `jarvis.stt.provider` in settings

**Change TTS:** Update `jarvis.tts.provider` in settings

**Reload extension** after changes (Ctrl+R in Extension Dev Host)

---

## 💾 Disk Space Requirements

- gpt-oss-20b: ~16 GB
- Qwen3-Coder:30b: ~19 GB
- Whisper V3 Turbo: ~1.5 GB
- Canary Qwen 2.5B: ~5 GB
- Kokoro-82M: ~400 MB

**Total for recommended setup:** ~23 GB

---

## 🔗 Resources

- [OpenAI gpt-oss](https://openai.com/open-models)
- [Ollama Library](https://ollama.com/library)
- [HuggingFace ASR Leaderboard](https://huggingface.co/spaces/hf-audio/open_asr_leaderboard)
- [Kokoro TTS](https://kokorotts.net/)
- [Qwen Models](https://qwenlm.github.io/)

---

## ⚡ Quick Commands

```powershell
# Install recommended LLM
ollama pull gpt-oss-20b

# Install alternative coding model
ollama pull qwen3-coder:30b

# Install voice models (Python)
pip install faster-whisper kokoro-tts

# List installed Ollama models
ollama list

# Test a model
ollama run gpt-oss-20b
```
