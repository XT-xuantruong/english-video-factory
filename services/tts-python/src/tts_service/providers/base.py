from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass
from pathlib import Path

from ..schemas import SegmentRequest


@dataclass(frozen=True, slots=True)
class ResolvedVoice:
    provider: str
    voice: str
    style: str | None = None
    rate: str | None = None
    pitch: str | None = None
    extension: str = "wav"


class TTSProvider(ABC):
    @abstractmethod
    def resolve(self, request: SegmentRequest) -> ResolvedVoice:
        """Resolve provider defaults before cache hashing."""

    @abstractmethod
    async def synthesize(
        self,
        request: SegmentRequest,
        resolved: ResolvedVoice,
        output_path: Path,
    ) -> None:
        """Synthesize one request into output_path."""
