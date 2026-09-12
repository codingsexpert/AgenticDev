"""
src/routes/tts.py — ElevenLabs Text-to-Speech API Router
"""

import os
from typing import Optional
from fastapi import APIRouter, HTTPException, Response
from pydantic import BaseModel
import urllib.request
import json

router = APIRouter(prefix="/api/tts", tags=["tts"])

class TTSRequest(BaseModel):
    text: str
    voice_id: Optional[str] = None

@router.post("/speak")
async def text_to_speech(req: TTSRequest):
    """
    Converts text to natural AI speech using ElevenLabs API (eleven_multilingual_v2 model).
    Falls back gracefully if ELEVENLABS_API_KEY is missing or invalid.
    """
    api_key = os.getenv("ELEVENLABS_API_KEY")
    if not api_key:
        raise HTTPException(
            status_code=400,
            detail="ELEVENLABS_API_KEY is not configured in environment."
        )

    clean_text = req.text.strip()
    if not clean_text:
        raise HTTPException(status_code=400, detail="Text payload cannot be empty.")

    # Limit text length to prevent excessive quota consumption
    if len(clean_text) > 3000:
        clean_text = clean_text[:3000]

    voice_id = req.voice_id or os.getenv("ELEVENLABS_VOICE_ID", "21m00Tcm4TlvDq8ikWAM") # Rachel / Default voice
    url = f"https://api.elevenlabs.io/v1/text-to-speech/{voice_id}"

    headers = {
        "xi-api-key": api_key,
        "Content-Type": "application/json",
        "Accept": "audio/mpeg"
    }

    payload = {
        "text": clean_text,
        "model_id": "eleven_multilingual_v2",
        "voice_settings": {
            "stability": 0.5,
            "similarity_boost": 0.75
        }
    }

    try:
        data_bytes = json.dumps(payload).encode("utf-8")
        request = urllib.request.Request(url, data=data_bytes, headers=headers, method="POST")
        with urllib.request.urlopen(request, timeout=15) as response:
            audio_data = response.read()
            return Response(content=audio_data, media_type="audio/mpeg")
    except urllib.error.HTTPError as e:
        error_body = e.read().decode("utf-8", errors="ignore")
        raise HTTPException(status_code=e.code, detail=f"ElevenLabs API Error: {error_body}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to generate speech: {str(e)}")
