from __future__ import annotations

import asyncio
import os
import subprocess
from pathlib import Path
from typing import Any

from .base import ResolvedVoice, TTSProvider
from ..schemas import SegmentRequest


class VieNeuProvider(TTSProvider):
    """Lazy, serialized VieNeu provider with optional tempo normalization.

    VieNeu loads a sizeable model, so the engine is created only on the first
    Vietnamese request and all inference calls share one lock. VIENEU_RATE is
    applied after synthesis with FFmpeg; values below 1.0 make narration slower.
    """

    def __init__(self) -> None:
        self._engine: Any | None = None
        self._load_lock = asyncio.Lock()
        self._infer_lock = asyncio.Lock()

    def resolve(self, request: SegmentRequest) -> ResolvedVoice:
        return ResolvedVoice(
            provider="vieneu",
            voice=request.voice or os.getenv("VIENEU_VOICE", "Trúc Ly"),
            style=request.style or os.getenv("VIENEU_STYLE", "tu_nhien"),
            rate=request.rate or os.getenv("VIENEU_RATE", "0.94"),
            extension="wav",
        )

    async def _get_engine(self) -> Any:
        if self._engine is not None:
            return self._engine

        async with self._load_lock:
            if self._engine is not None:
                return self._engine
            try:
                from vieneu import Vieneu
            except ImportError as exc:  # pragma: no cover - environment dependent
                raise RuntimeError(
                    "Chưa cài VieNeu. Chạy: "
                    "python -m pip install -e 'services/tts-python[vieneu]'"
                ) from exc

            backend = os.getenv("VIENEU_BACKEND", "onnx")
            precision = os.getenv("VIENEU_PRECISION", "int8")

            def load() -> Any:
                try:
                    return Vieneu(backend=backend, precision=precision)
                except TypeError:
                    try:
                        return Vieneu(backend=backend)
                    except TypeError:
                        return Vieneu()

            self._engine = await asyncio.to_thread(load)
            return self._engine

    @staticmethod
    def _tempo(value: str | None) -> float:
        try:
            tempo = float(value or "1")
        except ValueError as exc:
            raise RuntimeError(f"VIENEU_RATE không hợp lệ: {value}") from exc
        if not 0.5 <= tempo <= 2.0:
            raise RuntimeError("VIENEU_RATE phải nằm trong khoảng 0.5 đến 2.0")
        return tempo

    async def synthesize(
        self,
        request: SegmentRequest,
        resolved: ResolvedVoice,
        output_path: Path,
    ) -> None:
        engine = await self._get_engine()
        output_path.parent.mkdir(parents=True, exist_ok=True)
        raw_path = output_path.with_name(f"{output_path.stem}.raw{output_path.suffix}")
        raw_path.unlink(missing_ok=True)

        def infer() -> None:
            try:
                audio = engine.infer(
                    request.text,
                    voice=resolved.voice,
                    style=resolved.style,
                )
            except TypeError:
                try:
                    audio = engine.infer(request.text, voice=resolved.voice)
                except TypeError:
                    audio = engine.infer(text=request.text, voice=resolved.voice)

            if hasattr(engine, "save"):
                engine.save(audio, str(raw_path))
                return

            try:
                import soundfile as sf
            except ImportError as exc:  # pragma: no cover
                raise RuntimeError("VieNeu không có save() và thiếu soundfile") from exc

            sample_rate = int(getattr(engine, "sample_rate", 48_000))
            if isinstance(audio, tuple) and len(audio) == 2:
                audio, sample_rate = audio
            sf.write(str(raw_path), audio, sample_rate)

        def adjust_tempo() -> None:
            tempo = self._tempo(resolved.rate)
            if abs(tempo - 1.0) < 0.001:
                raw_path.replace(output_path)
                return
            subprocess.run(
                [
                    os.getenv("FFMPEG_BIN", "ffmpeg"),
                    "-y",
                    "-i",
                    str(raw_path),
                    "-filter:a",
                    f"atempo={tempo:.3f}",
                    "-ar",
                    "48000",
                    "-ac",
                    "1",
                    "-c:a",
                    "pcm_s16le",
                    str(output_path),
                ],
                check=True,
                capture_output=True,
                text=True,
            )
            raw_path.unlink(missing_ok=True)

        async with self._infer_lock:
            try:
                await asyncio.to_thread(infer)
                await asyncio.to_thread(adjust_tempo)
            finally:
                raw_path.unlink(missing_ok=True)
