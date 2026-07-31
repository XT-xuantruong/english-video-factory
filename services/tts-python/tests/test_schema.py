import pytest
from pydantic import ValidationError

from tts_service.schemas import SegmentRequest


def test_pause_after_ms_accepts_quiz_countdown_up_to_ten_seconds():
    segment = SegmentRequest(
        id="quiz-countdown",
        language="vi",
        text="Hãy bình luận đáp án trước khi xem kết quả nhé.",
        pauseAfterMs=10_000,
    )
    assert segment.pause_after_ms == 10_000


def test_pause_after_ms_rejects_values_above_ten_seconds():
    with pytest.raises(ValidationError):
        SegmentRequest(
            id="quiz-countdown-too-long",
            language="vi",
            text="Hãy chọn đáp án.",
            pauseAfterMs=10_001,
        )
