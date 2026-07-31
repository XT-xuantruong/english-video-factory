from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

Language = Literal["vi", "en"]
ProviderName = Literal["vieneu", "edge"]
VieNeuStyle = Literal["tu_nhien", "tin_tuc", "doc_truyen"]


class ApiModel(BaseModel):
    model_config = ConfigDict(populate_by_name=True, extra="forbid")


class SegmentRequest(ApiModel):
    id: str = Field(min_length=1, max_length=180)
    language: Language
    text: str = Field(min_length=1, max_length=10_000)
    voice: str | None = None
    style: VieNeuStyle | None = None
    rate: str | None = None
    pitch: str | None = None
    # Kept for backward compatibility with older Node clients. The TTS service does not
    # render pauses; Node/FFmpeg owns timeline assembly. Vocabulary quizzes support
    # countdowns up to 10 seconds, so legacy payloads must still validate.
    pause_after_ms: int = Field(default=220, alias="pauseAfterMs", ge=0, le=10_000)


class SingleRequest(ApiModel):
    output_dir: str = Field(alias="outputDir", min_length=1)
    segment: SegmentRequest


class BatchRequest(ApiModel):
    output_dir: str = Field(alias="outputDir", min_length=1)
    segments: list[SegmentRequest] = Field(min_length=1, max_length=500)


class ManifestItem(ApiModel):
    id: str
    output_path: str = Field(alias="outputPath")
    duration_ms: int = Field(alias="durationMs", ge=0)
    content_hash: str = Field(alias="contentHash")
    cached: bool
    provider: ProviderName
    voice: str
    style: str | None = None
    rate: str | None = None
    pitch: str | None = None


class BatchResponse(ApiModel):
    items: list[ManifestItem]


class HealthResponse(ApiModel):
    status: Literal["ok"] = "ok"
    routing: dict[Language, ProviderName]
    defaults: dict[str, str]
