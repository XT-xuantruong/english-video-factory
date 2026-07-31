from tts_service.providers.edge import EdgeTTSProvider
from tts_service.schemas import SegmentRequest
from tts_service.service import TTSService


def test_hash_uses_resolved_voice_defaults(monkeypatch):
    monkeypatch.setenv("EDGE_VOICE", "en-US-AvaNeural")
    provider = EdgeTTSProvider()
    segment = SegmentRequest(id="en-1", language="en", text="Hello")
    first = TTSService.content_hash(segment, provider.resolve(segment))

    monkeypatch.setenv("EDGE_VOICE", "en-US-AndrewNeural")
    second = TTSService.content_hash(segment, provider.resolve(segment))

    assert first != second


def test_hash_uses_vieneu_style():
    service = TTSService()
    natural = SegmentRequest(
        id="vi-1",
        language="vi",
        text="Xin chào",
        style="tu_nhien",
    )
    news = natural.model_copy(update={"style": "tin_tuc"})
    provider = service.provider("vi")[1]
    assert service.content_hash(natural, provider.resolve(natural)) != service.content_hash(
        news,
        provider.resolve(news),
    )


def test_vieneu_default_rate_is_part_of_cache_hash(monkeypatch):
    service = TTSService()
    provider = service.provider("vi")[1]
    segment = SegmentRequest(id="vi-rate", language="vi", text="Xin chào")

    monkeypatch.setenv("VIENEU_RATE", "0.94")
    slower = service.content_hash(segment, provider.resolve(segment))
    monkeypatch.setenv("VIENEU_RATE", "1.00")
    normal = service.content_hash(segment, provider.resolve(segment))

    assert slower != normal
