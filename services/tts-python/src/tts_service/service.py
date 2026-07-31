from __future__ import annotations

import asyncio
import hashlib
import json
import os
import re
import subprocess
from pathlib import Path

from .providers.base import ResolvedVoice, TTSProvider
from .providers.edge import EdgeTTSProvider
from .providers.vieneu import VieNeuProvider
from .schemas import BatchRequest, BatchResponse, ManifestItem, SegmentRequest

_SAFE_ID = re.compile(r"[^a-zA-Z0-9._-]+")


class TTSService:
    PROVIDER_VERSION = "3"

    def __init__(self) -> None:
        self._edge = EdgeTTSProvider()
        self._vieneu = VieNeuProvider()

    def provider(self, language: str) -> tuple[str, TTSProvider]:
        if language == "en":
            return "edge", self._edge
        if language == "vi":
            return "vieneu", self._vieneu
        raise ValueError(f"Ngôn ngữ không được hỗ trợ: {language}")

    @classmethod
    def content_hash(
        cls,
        segment: SegmentRequest,
        resolved: ResolvedVoice,
    ) -> str:
        payload = {
            "language": segment.language,
            "text": segment.text,
            "provider": resolved.provider,
            "voice": resolved.voice,
            "style": resolved.style,
            "rate": resolved.rate,
            "pitch": resolved.pitch,
            "provider_version": cls.PROVIDER_VERSION,
        }
        encoded = json.dumps(
            payload,
            ensure_ascii=False,
            sort_keys=True,
            separators=(",", ":"),
        ).encode("utf-8")
        return hashlib.sha256(encoded).hexdigest()

    @staticmethod
    def duration_ms(path: Path) -> int:
        process = subprocess.run(
            [
                os.getenv("FFPROBE_BIN", "ffprobe"),
                "-v",
                "error",
                "-show_entries",
                "format=duration",
                "-of",
                "default=noprint_wrappers=1:nokey=1",
                str(path),
            ],
            capture_output=True,
            text=True,
            check=True,
        )
        return round(float(process.stdout.strip()) * 1000)

    async def synthesize_one(
        self,
        segment: SegmentRequest,
        output_dir: str | Path,
    ) -> ManifestItem:
        directory = Path(output_dir).expanduser().resolve()
        directory.mkdir(parents=True, exist_ok=True)

        provider_name, provider = self.provider(segment.language)
        resolved = provider.resolve(segment)
        digest = self.content_hash(segment, resolved)
        safe_id = _SAFE_ID.sub("-", segment.id).strip("-.") or "segment"
        output_path = directory / f"{safe_id}-{digest[:12]}.{resolved.extension}"
        partial_path = output_path.with_name(f"{output_path.stem}.part{output_path.suffix}")

        cached = output_path.exists() and output_path.stat().st_size > 0
        if not cached:
            partial_path.unlink(missing_ok=True)
            try:
                await provider.synthesize(segment, resolved, partial_path)
                if not partial_path.exists() or partial_path.stat().st_size == 0:
                    raise RuntimeError(
                        f"TTS không tạo được audio cho segment '{segment.id}'"
                    )
                partial_path.replace(output_path)
            except Exception:
                partial_path.unlink(missing_ok=True)
                raise

        duration_ms = await asyncio.to_thread(self.duration_ms, output_path)
        return ManifestItem(
            id=segment.id,
            outputPath=str(output_path),
            durationMs=duration_ms,
            contentHash=digest,
            cached=cached,
            provider=provider_name,
            voice=resolved.voice,
            style=resolved.style,
            rate=resolved.rate,
            pitch=resolved.pitch,
        )

    async def synthesize_batch(self, request: BatchRequest) -> BatchResponse:
        # Edge requests can run concurrently. VieNeu serializes inference internally.
        items = await asyncio.gather(
            *(
                self.synthesize_one(segment, request.output_dir)
                for segment in request.segments
            )
        )
        return BatchResponse(items=list(items))
