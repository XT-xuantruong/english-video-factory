from __future__ import annotations

import os

from fastapi import FastAPI, HTTPException

from .schemas import (
    BatchRequest,
    BatchResponse,
    HealthResponse,
    ManifestItem,
    SingleRequest,
)
from .service import TTSService

app = FastAPI(
    title="English Video Factory TTS",
    version="3.2.0",
    description="VieNeu cho tiếng Việt và Edge TTS cho tiếng Anh.",
)
service = TTSService()


@app.get("/health", response_model=HealthResponse)
def health() -> HealthResponse:
    # Deliberately does not load the VieNeu model.
    return HealthResponse(
        routing={"vi": "vieneu", "en": "edge"},
        defaults={
            "viVoice": os.getenv("VIENEU_VOICE", "Trúc Ly"),
            "viStyle": os.getenv("VIENEU_STYLE", "tu_nhien"),
            "viRate": os.getenv("VIENEU_RATE", "0.94"),
            "enVoice": os.getenv("EDGE_VOICE", "en-US-AvaNeural"),
            "enRate": os.getenv("EDGE_RATE", "-10%"),
        },
    )


@app.get("/voices")
def voices() -> dict[str, object]:
    return {
        "vi": {
            "provider": "vieneu",
            "default": os.getenv("VIENEU_VOICE", "Trúc Ly"),
            "style": os.getenv("VIENEU_STYLE", "tu_nhien"),
            "rate": os.getenv("VIENEU_RATE", "0.94"),
            "recommended": ["Trúc Ly", "Phạm Tuyên"],
            "styles": ["tu_nhien", "tin_tuc", "doc_truyen"],
        },
        "en": {
            "provider": "edge",
            "default": os.getenv("EDGE_VOICE", "en-US-AvaNeural"),
            "rate": os.getenv("EDGE_RATE", "-10%"),
            "recommended": [
                "en-US-AvaNeural",
                "en-US-AndrewNeural",
                "en-US-EmmaNeural",
                "en-GB-SoniaNeural",
                "en-GB-RyanNeural",
            ],
        },
    }


@app.post("/v1/synthesize", response_model=ManifestItem)
async def synthesize(request: SingleRequest) -> ManifestItem:
    try:
        return await service.synthesize_one(request.segment, request.output_dir)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@app.post("/v1/synthesize/batch", response_model=BatchResponse)
async def synthesize_batch(request: BatchRequest) -> BatchResponse:
    try:
        return await service.synthesize_batch(request)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc
