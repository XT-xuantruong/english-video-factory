from __future__ import annotations

import asyncio
import os
from pathlib import Path

from .base import ResolvedVoice, TTSProvider
from ..schemas import SegmentRequest


class EdgeTTSProvider(TTSProvider):
    def __init__(self) -> None:
        self._semaphore = asyncio.Semaphore(
            max(1, int(os.getenv("EDGE_TTS_CONCURRENCY", "4")))
        )

    def resolve(self, request: SegmentRequest) -> ResolvedVoice:
        return ResolvedVoice(
            provider="edge",
            voice=request.voice or os.getenv("EDGE_VOICE", "en-US-AvaNeural"),
            rate=request.rate or os.getenv("EDGE_RATE", "-10%"),
            pitch=request.pitch or os.getenv("EDGE_PITCH", "+0Hz"),
            extension="mp3",
        )

    async def synthesize(
        self,
        request: SegmentRequest,
        resolved: ResolvedVoice,
        output_path: Path,
    ) -> None:
        try:
            import edge_tts
        except ImportError as exc:  # pragma: no cover - environment dependent
            raise RuntimeError(
                "Chưa cài Edge TTS. Chạy: python -m pip install -e services/tts-python"
            ) from exc

        output_path.parent.mkdir(parents=True, exist_ok=True)
        async with self._semaphore:
            communicate = edge_tts.Communicate(
                text=request.text,
                voice=resolved.voice,
                rate=resolved.rate or "-10%",
                pitch=resolved.pitch or "+0Hz",
            )
            await communicate.save(str(output_path))
