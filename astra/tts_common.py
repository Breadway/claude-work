"""Shared Gemini 3.8 TTS REST client and pronunciation rules.

Reference: https://ai.google.dev/gemini-api/docs/speech-generation
Credentials are read from GKEY and are never persisted. No automatic retries.
"""
import base64
import io
import json
import os
import re
import subprocess
import urllib.request
import wave
from pathlib import Path

MODEL = "gemini-3.8-flash-tts"
VOICE = "Sadaltager"
STYLE = "Clear, knowledgeable technical explainer. Use a natural, steady conversational pace and brief pauses between paragraphs. Keep the same voice and delivery throughout."
ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/interactions"

SPOKEN = [
    (r'\bv(\d)\b', r'version \1'), (r'Astra-7', 'Astra seven'), (r'ASTRA', 'Astra'),
    (r'AdvancedCpuPlayers', 'Advanced C P U players'), (r'AdvancedCpuPlayer', 'Advanced C P U player'), (r'AdvCPUs', 'Advanced C P Us'), (r'AdvCPU', 'Advanced C P U'), (r'ExpertCpu', 'Expert C P U'),
    (r'TD-value', 'T D value'), (r'\bBC\b', 'B C'), (r'\bRL\b', 'R L'), (r'\bPPO\b', 'P P O'), (r'\bGAE\b', 'G A E'), (r'\bMCTS\b', 'M C T S'),
    (r'\bPUCT\b', 'P U C T'), (r'\bGELU\b', 'gelu'), (r'\bMLP\b', 'M L P'), (r'\bGPU\b', 'G P U'), (r'\bCPU\b', 'C P U'),
    (r'4090-class', 'forty ninety class'), (r'\b3080\b', 'thirty eighty'), (r'λ', 'lambda'), (r'×', ' times '), (r'−', 'minus '), (r'±', 'plus or minus'),
    (r'100\+', 'over 100'), (r'\b400 plus\b', 'four hundred plus'), (r'dot-bin', 'dot bin'), (r'\*', ''),
]
def spoken(text):
    for a, b in SPOKEN: text = re.sub(a, b, text)
    return re.sub(r'\s+', ' ', text).strip()


SPOKEN += [
    (r"\bReLU\b", "rel-you"), (r"\bFP16\b", "F P sixteen"),
    (r"\bFP32\b", "F P thirty-two"), (r"\bMHA\b", "M H A"),
    (r"\bLayerNorm\b", "layer norm"), (r"\bsoftmax\b", "soft max"),
    (r"\bAlphaZero\b", "Alpha Zero"), (r"\bNaN\b", "nan"),
    (r"\bf16\b", "F sixteen"),
]

def request_body(text, model=MODEL, voice=VOICE, style=STYLE):
    content = {"type": "text", "text": text}
    if style:
        content["annotations"] = [{"type": "speech_metadata", "style": style}]
    return {
        "model": model,
        "input": [{"type": "user_input", "content": [content]}],
        "response_format": {"type": "audio", "mime_type": "audio/wav", "sample_rate": 24000},
        "generation_config": {"speech_config": [{"voice": voice}]},
    }

def decode_response(response):
    if response.get("status") not in (None, "completed"):
        raise ValueError(f"TTS interaction did not complete: {response.get('status')}")
    parts = [p for s in response.get("steps", []) if s.get("type") == "model_output"
             for p in s.get("content", []) if p.get("type") == "audio"]
    if not parts and response.get("output_audio"):
        parts = [response["output_audio"]]
    if not parts:
        raise ValueError("TTS response contained no audio")
    chunks = [base64.b64decode(p["data"], validate=True) for p in parts]
    # Unary audio blocks are complete WAVs. Join their frames, never their RIFF headers.
    params = None
    frames = []
    for chunk in chunks:
        with wave.open(io.BytesIO(chunk)) as audio:
            if audio.getnframes() == 0:
                raise ValueError("TTS response contained empty audio")
            current = (audio.getnchannels(), audio.getsampwidth(), audio.getframerate())
            if params is not None and current != params:
                raise ValueError("TTS audio blocks have incompatible formats")
            params = current
            frames.append(audio.readframes(audio.getnframes()))
    data = chunks[0]
    if len(chunks) > 1:
        buffer = io.BytesIO()
        with wave.open(buffer, "wb") as audio:
            audio.setnchannels(params[0]); audio.setsampwidth(params[1]); audio.setframerate(params[2])
            audio.writeframes(b"".join(frames))
        data = buffer.getvalue()
    usage = response.get("usage", response.get("usageMetadata", {}))
    return data, usage

def call(text, model=MODEL, voice=VOICE, style=STYLE, timeout=900):
    key = os.environ.get("GKEY")
    if not key:
        raise ValueError("Set GKEY in the environment before requesting speech")
    req = urllib.request.Request(ENDPOINT, data=json.dumps(request_body(text, model, voice, style)).encode(),
                                 headers={"x-goog-api-key": key, "Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=timeout) as result:
        return decode_response(json.load(result))

def atomic_json(path, data):
    path = Path(path)
    temp = path.with_name(path.name + ".tmp")
    temp.write_text(json.dumps(data, indent=1) + "\n")
    temp.replace(path)

def save_wav(data, path):
    path = Path(path)
    with wave.open(io.BytesIO(data)) as audio:
        if audio.getnframes() == 0:
            raise ValueError("Cannot cache empty WAV")
    temp = path.with_name(path.name + ".tmp")
    temp.write_bytes(data)
    temp.replace(path)

def probe(path):
    return float(subprocess.check_output([os.environ.get("FFPROBE", "ffprobe"), "-v", "error",
                 "-show_entries", "format=duration", "-of", "csv=p=0", str(path)]))
