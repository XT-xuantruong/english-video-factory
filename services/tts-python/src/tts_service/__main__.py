from __future__ import annotations

import os

import uvicorn


def main() -> None:
    uvicorn.run(
        "tts_service.api:app",
        host=os.getenv("TTS_HOST", "127.0.0.1"),
        port=int(os.getenv("TTS_PORT", "8124")),
        reload=False,
    )


if __name__ == "__main__":
    main()
