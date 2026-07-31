from fastapi.testclient import TestClient

from tts_service.api import app


def test_health_does_not_require_model_load():
    response = TestClient(app).get("/health")
    assert response.status_code == 200
    body = response.json()
    assert body["routing"] == {"vi": "vieneu", "en": "edge"}
    assert body["defaults"]["viVoice"]
    assert body["defaults"]["enVoice"]
